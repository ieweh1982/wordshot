/**
 * Script Engine - Renderer Compatible
 * Used in renderer process for live mode
 */

import type {
  MainScript,
  OrderedScript,
  Script,
  ScriptCategory,
  ScriptSegment,
  TemplateTheme,
  MainScriptTemplate,
  LiveSession,
  DeduplicationConfig,
} from '../types';
import * as templateService from './templateService';

// ============================================================================
// Types
// ============================================================================

export interface LiveFlowState {
  step: 'select_theme' | 'select_template' | 'select_display_config' | 'generated' | 'live';
  theme?: TemplateTheme;
  templateId?: string;
  displayProfileId?: string;
}

export interface MainScriptGenerationOptions {
  templateId: string;
  sessionId: string;
  deduplicationConfig?: Partial<DeduplicationConfig>;
}

// ============================================================================
// Default segments by theme (fallback when no template exists)
// ============================================================================

const DEFAULT_SEGMENTS: Record<TemplateTheme, ScriptSegment[]> = {
  standup: [
    { id: 'seg-1', templateId: '', name: '开场吸引', category: 'opening', durationSeconds: 300, order: 1 },
    { id: 'seg-2', templateId: '', name: '热场互动', category: 'interaction', durationSeconds: 600, order: 2 },
    { id: 'seg-3', templateId: '', name: '主题内容', category: 'thanks', durationSeconds: 1800, order: 3 },
    { id: 'seg-4', templateId: '', name: '互动拉票', category: 'interaction', durationSeconds: 600, order: 4 },
    { id: 'seg-5', templateId: '', name: '下播告别', category: 'closing', durationSeconds: 300, order: 5 },
  ],
  chat: [
    { id: 'seg-1', templateId: '', name: '开播问候', category: 'opening', durationSeconds: 300, order: 1 },
    { id: 'seg-2', templateId: '', name: '话题引入', category: 'interaction', durationSeconds: 600, order: 2 },
    { id: 'seg-3', templateId: '', name: '深入交流', category: 'interaction', durationSeconds: 1200, order: 3 },
    { id: 'seg-4', templateId: '', name: '粉丝互动', category: 'thanks', durationSeconds: 600, order: 4 },
    { id: 'seg-5', templateId: '', name: '结束预告', category: 'closing', durationSeconds: 300, order: 5 },
  ],
  ecommerce: [
    { id: 'seg-1', templateId: '', name: '开场引流', category: 'opening', durationSeconds: 300, order: 1 },
    { id: 'seg-2', templateId: '', name: '产品介绍', category: 'ad', durationSeconds: 900, order: 2 },
    { id: 'seg-3', templateId: '', name: '互动答疑', category: 'interaction', durationSeconds: 600, order: 3 },
    { id: 'seg-4', templateId: '', name: '促单成交', category: 'ad', durationSeconds: 600, order: 4 },
    { id: 'seg-5', templateId: '', name: '感谢收尾', category: 'closing', durationSeconds: 300, order: 5 },
  ],
};

// Time window options in milliseconds
export const DEDUP_TIME_WINDOWS = {
  '15min': 15 * 60 * 1000,
  '30min': 30 * 60 * 1000,
  '1hr': 60 * 60 * 1000,
  '2hr': 2 * 60 * 60 * 1000,
} as const;

export type DeduplicationTimeWindow = keyof typeof DEDUP_TIME_WINDOWS;

const DEFAULT_DEDUP_CONFIG: DeduplicationConfig = {
  enabled: true,
  timeWindowMs: DEDUP_TIME_WINDOWS['30min'],
  maxRepeatPerWindow: 1,
};

// Theme display names
export function getThemeDisplayName(theme: TemplateTheme): string {
  const names: Record<TemplateTheme, string> = {
    standup: '脱口秀直播',
    chat: '聊天互动',
    ecommerce: '日常带货',
  };
  return names[theme] || theme;
}

// Get templates by theme
export function getTemplatesByTheme(theme: TemplateTheme): MainScriptTemplate[] {
  // This should be called via IPC in renderer
  return [];
}

// Session Management - stubbed (should use IPC)
export function createSession(name: string): LiveSession {
  return {
    id: crypto.randomUUID(),
    name,
    startTime: Date.now(),
    usageHistory: [],
    totalScriptsUsed: 0,
  };
}

export function endSession(sessionId: string): LiveSession | undefined {
  return undefined;
}

export function getSession(sessionId: string): LiveSession | undefined {
  return undefined;
}

export function getActiveSessions(): LiveSession[] {
  return [];
}

// Usage History & Deduplication - stubbed
function getRecentUsageHistory(timeWindowMs: number): Array<{ scriptId: string; usedAt: number }> {
  return [];
}

export function isScriptRecentlyUsed(
  scriptId: string,
  timeWindowMs: number = DEFAULT_DEDUP_CONFIG.timeWindowMs
): boolean {
  const recentHistory = getRecentUsageHistory(timeWindowMs);
  return recentHistory.some(record => record.scriptId === scriptId);
}

export function getAvailableScriptsForCategory(
  category: ScriptCategory,
  timeWindowMs: number = DEFAULT_DEDUP_CONFIG.timeWindowMs
): Script[] {
  return [];
}

// Main Script Generation - uses template segments and scriptStore
export function generateMainScript(options: MainScriptGenerationOptions): MainScript {
  // This function is called in the renderer via templateService.getAllTemplates() and scriptStore
  // For LiveView, the actual generation happens in LiveView itself
  return {
    id: crypto.randomUUID(),
    sessionId: options.sessionId,
    templateId: options.templateId,
    orderedScripts: [],
    currentIndex: 0,
    status: 'generated',
    generatedAt: Date.now(),
  };
}

// Generate main script from template with actual scripts
export async function generateMainScriptFromTemplate(
  options: MainScriptGenerationOptions,
  scripts: Script[]
): Promise<MainScript> {
  const template = await templateService.getTemplateById(options.templateId);
  if (!template) {
    return {
      id: crypto.randomUUID(),
      sessionId: options.sessionId,
      templateId: options.templateId,
      orderedScripts: [],
      currentIndex: 0,
      status: 'generated',
      generatedAt: Date.now(),
    };
  }

  const orderedScripts: OrderedScript[] = [];
  let order = 0;

  // Process scripts from template segments
  for (const segment of template.segments || []) {
    for (const scriptId of segment.scriptIds || []) {
      const script = scripts.find(s => s.id === scriptId);
      if (script) {
        orderedScripts.push({
          order,
          script,
          segmentId: segment.id,
          segmentName: segment.name,
        });
        order++;
      }
    }
  }

  // Process freeContent - each line becomes a script
  if (template.freeContent && template.freeContent.trim()) {
    const freeContentLines = template.freeContent.split('\n').filter(line => line.trim());
    for (const line of freeContentLines) {
      const fakeScript: Script = {
        id: `free-content-${order}-${Date.now()}`,
        category: 'thanks', // Use 'thanks' as default category for free content
        content: line.trim(),
        color: '#ffffff',
        priority: 5,
        triggers: [],
        tags: ['free-content'],
        usageCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      orderedScripts.push({
        order,
        script: fakeScript,
        segmentId: 'free-content-segment',
        segmentName: '自由输入',
      });
      order++;
    }
  }

  return {
    id: crypto.randomUUID(),
    sessionId: options.sessionId,
    templateId: options.templateId,
    orderedScripts,
    currentIndex: 0,
    status: 'generated',
    generatedAt: Date.now(),
  };
}

export function getMainScriptProgress(): MainScriptProgressConfig | null {
  return null;
}

export function saveMainScriptProgress(progress: MainScriptProgressConfig): void {
  // Save via IPC
}

// Reorder scripts in main script - stubbed
export function reorderMainScriptScripts(
  mainScript: MainScript,
  fromIndex: number,
  toIndex: number
): MainScript {
  const scripts = [...mainScript.orderedScripts];
  const [removed] = scripts.splice(fromIndex, 1);
  scripts.splice(toIndex, 0, removed);
  return { ...mainScript, orderedScripts: scripts };
}

// Remove script from main script - stubbed
export function removeScriptFromMainScript(
  mainScript: MainScript,
  scriptId: string
): MainScript {
  return {
    ...mainScript,
    orderedScripts: mainScript.orderedScripts.filter(s => s.script.id !== scriptId),
  };
}

// Add script to main script - stubbed
export function addScriptToMainScript(
  mainScript: MainScript,
  script: Script,
  segmentId: string,
  segmentName: string
): MainScript {
  const orderedScript: OrderedScript = {
    order: mainScript.orderedScripts.length,
    script,
    segmentId,
    segmentName,
  };
  return {
    ...mainScript,
    orderedScripts: [...mainScript.orderedScripts, orderedScript],
  };
}

// Main Script playback state - stubbed
export function advanceScriptIndex(mainScript: MainScript): MainScript {
  return {
    ...mainScript,
    currentIndex: Math.min(mainScript.currentIndex + 1, mainScript.orderedScripts.length - 1),
  };
}

export function goToScriptIndex(mainScript: MainScript, index: number): MainScript {
  return {
    ...mainScript,
    currentIndex: Math.max(0, Math.min(index, mainScript.orderedScripts.length - 1)),
  };
}

export function completeMainScript(mainScript: MainScript): MainScript {
  return {
    ...mainScript,
    status: 'completed',
  };
}

// MainScriptProgressConfig interface
export interface MainScriptProgressConfig {
  mainScriptId: string;
  currentIndex: number;
  status: 'generated' | 'in_progress' | 'completed';
  lastUpdated: number;
}

// In-memory storage for scripts (used in renderer)
const scriptMemoryCache: Script[] = [];

export function setScriptsCache(scripts: Script[]): void {
  scriptMemoryCache.length = 0;
  scriptMemoryCache.push(...scripts);
}

export function getScriptsCache(): Script[] {
  return scriptMemoryCache;
}
