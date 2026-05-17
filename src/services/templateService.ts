/**
 * Template Service - Renderer side
 * Uses IPC to communicate with main process for database operations
 */

import { MainScriptTemplate, ScriptSegment, TemplateTheme, ScriptCategory } from '../types';

const hasElectronAPI = () => typeof window !== 'undefined' && !!window.electronAPI;

export interface CreateTemplateInput {
  id: string;
  theme: TemplateTheme;
  name: string;
  totalDurationMinutes?: number;
  segments?: ScriptSegment[];
  patterns?: import('../types').SegmentPattern[];
  repeatCount?: number;
}

export interface UpdateTemplateInput {
  theme?: TemplateTheme;
  name?: string;
  totalDurationMinutes?: number;
  patterns?: import('../types').SegmentPattern[];
  repeatCount?: number;
  freeContent?: string;
}

export interface CreateSegmentInput {
  id: string;
  templateId: string;
  name: string;
  category: ScriptCategory;
  durationSeconds?: number;
  order?: number;
  transition?: string;
  scriptIds?: string[];
}

export interface UpdateSegmentInput {
  name?: string;
  category?: ScriptCategory;
  durationSeconds?: number;
  order?: number;
  transition?: string;
  scriptIds?: string[];
  customContent?: string;
}

// In-memory cache for templates in renderer
let templatesCache: MainScriptTemplate[] = [];

const TEMPLATES_STORAGE_KEY = 'wordshot-templates';

// Load templates from localStorage (browser fallback)
function loadTemplatesFromStorage(): MainScriptTemplate[] {
  try {
    const stored = localStorage.getItem(TEMPLATES_STORAGE_KEY);
    if (!stored) return [];
    const templates = JSON.parse(stored);
    // Parse JSON fields
    return templates.map((t: any) => ({
      ...t,
      patterns: typeof t.patterns === 'string' ? JSON.parse(t.patterns) : (t.patterns || []),
      repeatCount: t.repeatCount || 1,
      freeContent: t.freeContent || '',
      segments: (t.segments || []).map((s: any) => ({
        ...s,
        scriptIds: typeof s.scriptIds === 'string' ? JSON.parse(s.scriptIds) : (s.scriptIds || []),
        customContent: s.customContent || '',
      })),
    }));
  } catch {
    return [];
  }
}

// Save templates to localStorage (browser fallback)
function saveTemplatesToStorage(templates: MainScriptTemplate[]): void {
  try {
    localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(templates));
  } catch (e) {
    console.error('Failed to save templates to localStorage:', e);
  }
}

export function setTemplatesCache(templates: MainScriptTemplate[]): void {
  templatesCache.length = 0;
  templatesCache.push(...templates);
}

export function getTemplatesCache(): MainScriptTemplate[] {
  return templatesCache;
}

// Initialize templates
export async function initTemplates(): Promise<void> {
  if (hasElectronAPI()) {
    templatesCache = await window.electronAPI!.getAllTemplates();
  } else {
    templatesCache = loadTemplatesFromStorage();
  }
}

// Get all templates
export async function getAllTemplates(): Promise<MainScriptTemplate[]> {
  let templates: any[];
  if (hasElectronAPI()) {
    templates = await window.electronAPI!.getAllTemplates();
  } else {
    templates = loadTemplatesFromStorage();
    return templates;
  }
  // Parse JSON fields from database rows
  templatesCache = templates.map((t: any) => ({
    ...t,
    patterns: typeof t.patterns === 'string' ? JSON.parse(t.patterns) : (t.patterns || []),
    repeatCount: t.repeatCount || 1,
    freeContent: t.freeContent || '',
    segments: (t.segments || []).map((s: any) => ({
      ...s,
      scriptIds: typeof s.scriptIds === 'string' ? JSON.parse(s.scriptIds) : (s.scriptIds || []),
      customContent: s.customContent || '',
    })),
  }));
  return templatesCache;
}

// Get template by ID
export async function getTemplateById(id: string): Promise<MainScriptTemplate | undefined> {
  let template: any;
  if (hasElectronAPI()) {
    template = await window.electronAPI!.getTemplateById(id);
  } else {
    template = templatesCache.find(t => t.id === id);
  }
  if (!template) return undefined;
  // Normalize the template same as in getAllTemplates
  return {
    ...template,
    patterns: typeof template.patterns === 'string' ? JSON.parse(template.patterns) : (template.patterns || []),
    repeatCount: template.repeatCount || 1,
    freeContent: template.freeContent || '',
    segments: (template.segments || []).map((s: any) => ({
      ...s,
      scriptIds: typeof s.scriptIds === 'string' ? JSON.parse(s.scriptIds) : (s.scriptIds || []),
      customContent: s.customContent || '',
    })),
  };
}

// Create a new template
export async function createTemplate(input: CreateTemplateInput): Promise<MainScriptTemplate> {
  const now = Date.now();
  const template: MainScriptTemplate = {
    id: input.id,
    theme: input.theme,
    name: input.name,
    totalDurationMinutes: input.totalDurationMinutes || 60,
    segments: input.segments || [],
    patterns: input.patterns || [],
    repeatCount: input.repeatCount || 1,
    createdAt: now,
    updatedAt: now,
  };

  if (hasElectronAPI()) {
    const created = await window.electronAPI!.createTemplate(template);
    templatesCache.push(created);
    return created;
  } else {
    templatesCache.push(template);
    saveTemplatesToStorage(templatesCache);
    return template;
  }
}

// Update a template
export async function updateTemplate(id: string, updates: UpdateTemplateInput): Promise<MainScriptTemplate | undefined> {
  if (hasElectronAPI()) {
    const updated = await window.electronAPI!.updateTemplate(id, updates);
    if (updated) {
      const index = templatesCache.findIndex(t => t.id === id);
      if (index !== -1) {
        templatesCache[index] = updated;
      }
    }
    return updated;
  } else {
    const index = templatesCache.findIndex(t => t.id === id);
    if (index !== -1) {
      templatesCache[index] = { ...templatesCache[index], ...updates, updatedAt: Date.now() };
      saveTemplatesToStorage(templatesCache);
      return templatesCache[index];
    }
    return undefined;
  }
}

// Delete a template
export async function deleteTemplate(id: string): Promise<boolean> {
  console.log('[TemplateService] deleteTemplate called with id:', id);
  console.log('[TemplateService] hasElectronAPI:', hasElectronAPI());
  console.log('[TemplateService] window.electronAPI:', !!window.electronAPI);

  if (hasElectronAPI()) {
    try {
      const result = await window.electronAPI!.deleteTemplate(id);
      console.log('[TemplateService] deleteTemplate result:', result);
      if (result) {
        templatesCache = templatesCache.filter(t => t.id !== id);
      }
      return result;
    } catch (error) {
      console.error('[TemplateService] deleteTemplate error:', error);
      return false;
    }
  } else {
    templatesCache = templatesCache.filter(t => t.id !== id);
    saveTemplatesToStorage(templatesCache);
    return true;
  }
}

// Get segments by template
export async function getSegmentsByTemplate(templateId: string): Promise<ScriptSegment[]> {
  if (hasElectronAPI()) {
    return window.electronAPI!.getSegmentsByTemplate(templateId);
  }
  const template = templatesCache.find(t => t.id === templateId);
  return template?.segments || [];
}

// Create a segment
export async function createSegment(input: CreateSegmentInput): Promise<ScriptSegment> {
  const segment: ScriptSegment = {
    id: input.id,
    templateId: input.templateId,
    name: input.name,
    category: input.category,
    durationSeconds: input.durationSeconds || 300,
    order: input.order || 0,
    transition: input.transition,
    scriptIds: input.scriptIds || [],
  };

  if (hasElectronAPI()) {
    const created = await window.electronAPI!.createSegment(segment);
    // Update local cache
    const template = templatesCache.find(t => t.id === input.templateId);
    if (template) {
      template.segments.push(created);
    }
    return created;
  } else {
    const template = templatesCache.find(t => t.id === input.templateId);
    if (template) {
      template.segments.push(segment);
      saveTemplatesToStorage(templatesCache);
    }
    return segment;
  }
}

// Update a segment
export async function updateSegment(id: string, updates: UpdateSegmentInput): Promise<ScriptSegment | undefined> {
  if (hasElectronAPI()) {
    const updated = await window.electronAPI!.updateSegment(id, updates);
    if (updated) {
      // Update local cache
      for (const template of templatesCache) {
        const index = template.segments.findIndex(s => s.id === id);
        if (index !== -1) {
          template.segments[index] = updated;
          break;
        }
      }
    }
    return updated;
  } else {
    for (const template of templatesCache) {
      const index = template.segments.findIndex(s => s.id === id);
      if (index !== -1) {
        template.segments[index] = { ...template.segments[index], ...updates };
        saveTemplatesToStorage(templatesCache);
        return template.segments[index];
      }
    }
    return undefined;
  }
}

// Delete a segment
export async function deleteSegment(id: string): Promise<boolean> {
  if (hasElectronAPI()) {
    const result = await window.electronAPI!.deleteSegment(id);
    if (result) {
      // Update local cache
      for (const template of templatesCache) {
        const index = template.segments.findIndex(s => s.id === id);
        if (index !== -1) {
          template.segments.splice(index, 1);
          break;
        }
      }
    }
    return result;
  } else {
    for (const template of templatesCache) {
      const index = template.segments.findIndex(s => s.id === id);
      if (index !== -1) {
        template.segments.splice(index, 1);
        saveTemplatesToStorage(templatesCache);
        return true;
      }
    }
    return false;
  }
}

// Reorder segments
export async function reorderSegments(templateId: string, segmentIds: string[]): Promise<ScriptSegment[]> {
  if (hasElectronAPI()) {
    // This would need a dedicated IPC call for atomic reorder
    // For now, update locally and sync
  }
  const template = templatesCache.find(t => t.id === templateId);
  if (!template) return [];

  const reordered: ScriptSegment[] = [];
  for (const id of segmentIds) {
    const seg = template.segments.find(s => s.id === id);
    if (seg) reordered.push({ ...seg, order: reordered.length });
  }
  template.segments = reordered;
  saveTemplatesToStorage(templatesCache);
  return reordered;
}

// Add multiple segments
export async function addSegments(templateId: string, segments: ScriptSegment[]): Promise<void> {
  if (hasElectronAPI()) {
    for (const seg of segments) {
      await window.electronAPI!.createSegment(seg);
    }
  }
  const template = templatesCache.find(t => t.id === templateId);
  if (template) {
    template.segments.push(...segments);
    saveTemplatesToStorage(templatesCache);
  }
}

// Delete all segments for a template
export async function deleteAllSegments(templateId: string): Promise<void> {
  if (hasElectronAPI()) {
    const segments = await window.electronAPI!.getSegmentsByTemplate(templateId);
    for (const seg of segments) {
      await window.electronAPI!.deleteSegment(seg.id);
    }
  }
  const template = templatesCache.find(t => t.id === templateId);
  if (template) {
    template.segments = [];
    saveTemplatesToStorage(templatesCache);
  }
}

// Calculate total duration
export function calculateTemplateDuration(templateId: string): number {
  const template = templatesCache.find(t => t.id === templateId);
  if (!template) return 0;
  return template.segments.reduce((sum, seg) => sum + seg.durationSeconds, 0);
}

// Validate template
export function validateTemplate(templateId: string): { valid: boolean; errors: string[] } {
  const template = templatesCache.find(t => t.id === templateId);
  if (!template) {
    return { valid: false, errors: ['Template not found'] };
  }
  const errors: string[] = [];
  if (template.segments.length === 0) {
    errors.push('Template has no segments');
  }
  const totalDuration = calculateTemplateDuration(templateId);
  if (totalDuration < 60) {
    errors.push('Total duration is less than 1 minute');
  }
  return { valid: errors.length === 0, errors };
}