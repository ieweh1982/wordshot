import { create } from 'zustand';
import type { MainScriptTemplate, ScriptSegment, TemplateTheme, ScriptCategory, SegmentPattern } from '../types';
import * as templateService from '../services/templateService';
import { scriptStore } from './scriptStore';

interface TemplateState {
  templates: MainScriptTemplate[];
  selectedTemplateId: string | null;
  selectedSegmentId: string | null;
  themeFilter: TemplateTheme | 'all';
  isLoading: boolean;
}

interface TemplateActions {
  // Template CRUD
  loadTemplates: () => void;
  selectTemplate: (id: string | null) => void;
  createTemplate: (theme: TemplateTheme, name: string, totalDurationMinutes?: number) => Promise<MainScriptTemplate>;
  updateTemplate: (id: string, updates: Partial<MainScriptTemplate>) => void;
  deleteTemplate: (id: string) => void;

  // Segment CRUD
  selectSegment: (id: string | null) => void;
  addSegment: (templateId: string, name: string, category: ScriptCategory, durationSeconds: number, transition?: string, scriptIds?: string[]) => Promise<ScriptSegment>;
  updateSegment: (id: string, updates: Partial<ScriptSegment>) => void;
  deleteSegment: (id: string) => void;
  reorderSegments: (templateId: string, segmentIds: string[]) => void;

  // Filters
  setThemeFilter: (theme: TemplateTheme | 'all') => void;

  // Generation
  generateSegments: (templateId: string, patterns: SegmentPattern[], repeatCount: number) => Promise<ScriptSegment[]>;
  clearSegments: (templateId: string) => void;
  addScriptsToSegment: (segmentId: string, scriptIds: string[]) => void;
  removeScriptFromSegment: (segmentId: string, scriptId: string) => void;

  // Getters
  getSelectedTemplate: () => MainScriptTemplate | null;
  getFilteredTemplates: () => MainScriptTemplate[];
}

type TemplateStore = TemplateState & TemplateActions;

const initialState: TemplateState = {
  templates: [],
  selectedTemplateId: null,
  selectedSegmentId: null,
  themeFilter: 'all',
  isLoading: false,
};

export const templateStore = create<TemplateStore>((set, get) => ({
  ...initialState,

  loadTemplates: () => {
    set({ isLoading: true });
    templateService.getAllTemplates().then(templates => {
      // Ensure templates have patterns and repeatCount fields
      const normalizedTemplates = templates.map(t => ({
        ...t,
        patterns: t.patterns || [],
        repeatCount: t.repeatCount || 1,
        segments: t.segments.map(s => ({
          ...s,
          scriptIds: s.scriptIds || [],
        })),
      }));
      set({ templates: normalizedTemplates, isLoading: false });
    }).catch(error => {
      console.error('Failed to load templates:', error);
      set({ isLoading: false });
    });
  },

  selectTemplate: (id) => {
    set({ selectedTemplateId: id, selectedSegmentId: null });
  },

  createTemplate: async (theme, name, totalDurationMinutes = 60) => {
    const id = crypto.randomUUID();
    // Default patterns for each theme
    const defaultPatterns: Record<TemplateTheme, SegmentPattern[]> = {
      standup: [
        { name: '开场', category: 'opening', durationMinutes: 5 },
        { name: '互动', category: 'interaction', durationMinutes: 10 },
        { name: '幽默', category: 'thanks', durationMinutes: 5 },
        { name: '夸人', category: 'praise', durationMinutes: 5 },
        { name: '怼人', category: 'rebuttal', durationMinutes: 5 },
        { name: '拉票', category: 'lottery', durationMinutes: 5 },
      ],
      chat: [
        { name: '开场', category: 'opening', durationMinutes: 5 },
        { name: '互动', category: 'interaction', durationMinutes: 15 },
        { name: '感谢', category: 'thanks', durationMinutes: 10 },
        { name: '闭播', category: 'closing', durationMinutes: 5 },
      ],
      ecommerce: [
        { name: '开场', category: 'opening', durationMinutes: 5 },
        { name: '产品介绍', category: 'ad', durationMinutes: 15 },
        { name: '互动答疑', category: 'interaction', durationMinutes: 10 },
        { name: '促单', category: 'praise', durationMinutes: 10 },
        { name: '闭播', category: 'closing', durationMinutes: 5 },
      ],
    };
    const template = await templateService.createTemplate({
      id,
      theme,
      name,
      totalDurationMinutes,
      segments: [],
      patterns: defaultPatterns[theme],
      repeatCount: 1,
    });
    set((state) => ({ templates: [...state.templates, template], selectedTemplateId: id }));
    return template;
  },

  updateTemplate: (id, updates) => {
    templateService.updateTemplate(id, updates);
    set((state) => ({
      templates: state.templates.map((t) =>
        t.id === id ? { ...t, ...updates, updatedAt: Date.now() } : t
      ),
    }));
  },

  deleteTemplate: (id) => {
    console.log('[TemplateStore] deleteTemplate called with id:', id);
    templateService.deleteTemplate(id).then(result => {
      console.log('[TemplateStore] deleteTemplate result:', result);
    });
    set((state) => {
      console.log('[TemplateStore] set state after delete, filtering:', state.templates.length, 'templates');
      return {
        templates: state.templates.filter((t) => t.id !== id),
        selectedTemplateId: state.selectedTemplateId === id ? null : state.selectedTemplateId,
      };
    });
  },

  selectSegment: (id) => {
    set({ selectedSegmentId: id });
  },

  addSegment: async (templateId, name, category, durationSeconds, transition, scriptIds = []) => {
    const id = crypto.randomUUID();
    const template = get().templates.find(t => t.id === templateId);
    const order = template?.segments.length || 0;
    const segment = await templateService.createSegment({
      id,
      templateId,
      name,
      category,
      durationSeconds,
      order,
      transition,
      scriptIds,
    });
    set((state) => ({
      templates: state.templates.map((t) =>
        t.id === templateId
          ? { ...t, segments: [...t.segments, segment] }
          : t
      ),
    }));
    return segment;
  },

  updateSegment: (id, updates) => {
    templateService.updateSegment(id, updates).then(updated => {
      if (updated) {
        set((state) => ({
          templates: state.templates.map((t) => ({
            ...t,
            segments: t.segments.map((s) =>
              s.id === id ? { ...s, ...updates } : s
            ),
          })),
        }));
      }
    });
  },

  deleteSegment: (id) => {
    templateService.deleteSegment(id);
    set((state) => ({
      templates: state.templates.map((t) => ({
        ...t,
        segments: t.segments.filter((s) => s.id !== id),
      })),
      selectedSegmentId: state.selectedSegmentId === id ? null : state.selectedSegmentId,
    }));
  },

  clearSegments: (templateId) => {
    const template = get().templates.find(t => t.id === templateId);
    if (!template) return;
    // Delete all segments from database
    template.segments.forEach(s => templateService.deleteSegment(s.id));
    // Clear from local state
    set((state) => ({
      templates: state.templates.map((t) =>
        t.id === templateId ? { ...t, segments: [] } : t
      ),
    }));
  },

  reorderSegments: (templateId, segmentIds) => {
    const template = get().templates.find(t => t.id === templateId);
    if (!template) return;

    const reordered = segmentIds.map((id, index) => {
      const seg = template.segments.find(s => s.id === id);
      return seg ? { ...seg, order: index } : null;
    }).filter(Boolean) as ScriptSegment[];

    templateService.reorderSegments(templateId, segmentIds).then(() => {
      set((state) => ({
        templates: state.templates.map((t) =>
          t.id === templateId ? { ...t, segments: reordered } : t
        ),
      }));
    });
  },

  setThemeFilter: (theme) => {
    set({ themeFilter: theme });
  },

  // Generate segments based on patterns
  generateSegments: async (templateId, patterns, repeatCount) => {
    const template = get().templates.find(t => t.id === templateId);
    if (!template) return [];

    const scripts = scriptStore.getState().scripts;
    const AVG_SCRIPT_DURATION = 30; // 平均每条话术30秒

    const newSegments: ScriptSegment[] = [];
    let globalOrder = template.segments.length;

    for (let round = 0; round < repeatCount; round++) {
      for (const pattern of patterns) {
        // 检查是否超过总时长
        const currentTotal = newSegments.reduce((sum, s) => sum + s.durationSeconds, 0);
        const templateTotal = template.totalDurationMinutes * 60;
        if (currentTotal >= templateTotal) break;

        // 找到符合category的话术，优先使用usageCount低的
        const categoryScripts = scripts
          .filter(s => s.category === pattern.category)
          .sort((a, b) => a.usageCount - b.usageCount);

        // 根据时长计算需要多少条话术
        const neededCount = Math.max(1, Math.floor(pattern.durationMinutes * 60 / AVG_SCRIPT_DURATION));
        const selectedScripts = categoryScripts.slice(0, neededCount);
        const scriptIds = selectedScripts.map(s => s.id);

        const segment: ScriptSegment = {
          id: crypto.randomUUID(),
          templateId,
          name: pattern.name,
          category: pattern.category,
          durationSeconds: pattern.durationMinutes * 60,
          order: globalOrder++,
          scriptIds,
        };

        newSegments.push(segment);

        // 同时更新话术的usageCount
        selectedScripts.forEach(s => {
          scriptStore.getState().updateScript(s.id, {
            usageCount: (s.usageCount || 0) + 1,
            lastUsedAt: Date.now(),
          });
        });
      }
    }

    // 保存新生成的segments
    templateService.addSegments(templateId, newSegments.map(s => ({
      id: s.id,
      templateId: s.templateId,
      name: s.name,
      category: s.category,
      durationSeconds: s.durationSeconds,
      order: s.order,
      scriptIds: s.scriptIds,
    })));

    // 更新本地state
    set((state) => ({
      templates: state.templates.map((t) =>
        t.id === templateId ? { ...t, segments: [...t.segments, ...newSegments] } : t
      ),
    }));

    return newSegments;
  },

  addScriptsToSegment: (segmentId, scriptIds) => {
    set((state) => ({
      templates: state.templates.map((t) => ({
        ...t,
        segments: t.segments.map((s) =>
          s.id === segmentId
            ? { ...s, scriptIds: [...(s.scriptIds || []), ...scriptIds] }
            : s
        ),
      })),
    }));
    // Update in service
    const template = get().templates.find(t => t.segments.some(s => s.id === segmentId));
    const segment = template?.segments.find(s => s.id === segmentId);
    if (segment) {
      templateService.updateSegment(segmentId, { scriptIds: segment.scriptIds });
    }
  },

  removeScriptFromSegment: (segmentId, scriptId) => {
    set((state) => ({
      templates: state.templates.map((t) => ({
        ...t,
        segments: t.segments.map((s) =>
          s.id === segmentId
            ? { ...s, scriptIds: (s.scriptIds || []).filter(id => id !== scriptId) }
            : s
        ),
      })),
    }));
    const template = get().templates.find(t => t.segments.some(s => s.id === segmentId));
    const segment = template?.segments.find(s => s.id === segmentId);
    if (segment) {
      templateService.updateSegment(segmentId, { scriptIds: segment.scriptIds });
    }
  },

  getSelectedTemplate: () => {
    const { templates, selectedTemplateId } = get();
    return templates.find((t) => t.id === selectedTemplateId) || null;
  },

  getFilteredTemplates: () => {
    const { templates, themeFilter } = get();
    if (themeFilter === 'all') return templates;
    return templates.filter((t) => t.theme === themeFilter);
  },
}));

export const useTemplateStore = templateStore;