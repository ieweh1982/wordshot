// Script types
export interface Script {
  id: string;
  category: ScriptCategory;
  content: string;
  color: string;
  priority: number;
  triggers: TriggerType[];
  tags: string[];
  usageCount: number;
  lastUsedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export type ScriptCategory =
  | 'thanks'
  | 'rebuttal'
  | 'interaction'
  | 'ad'
  | 'praise'
  | 'opening'
  | 'closing'
  | 'lottery'
  | 'crisis';

export type TriggerType =
  | 'gift'
  | 'big_gift'
  | 'follower'
  | 'vip'
  | 'hater'
  | 'ribbit'
  | 'provocative'
  | 'silent'
  | 'vote'
  | 'question'
  | 'ad_break'
  | 'lottery_time'
  | 'negative'
  | 'ban'
  | 'praise';

// Ammo types
export interface AmmoSlotConfig {
  slotId: string;
  hotkey: string;
  displayName: string;
  sourceCategory: ScriptCategory;
  displayCount: number;
  enabled: boolean;
  autoRotateEnabled: boolean;
  autoRotateIntervalMs: number;
}

export interface DisplayProfile {
  id: string;
  name: string;
  slots: AmmoSlotConfig[];
  createdAt: number;
  updatedAt: number;
}

// Danmu types
export interface Danmu {
  id: string;
  userId: string;
  username: string;
  content: string;
  type: DanmuType;
  timestamp: number;
  importance: 'normal' | 'highlight' | 'danger';
  sentiment: number;
  selectedForReply: boolean;
}

export type DanmuType =
  | 'normal'
  | 'gift'
  | 'big_gift'
  | 'follower'
  | 'question'
  | 'hater'
  | 'ribbit'
  | 'provocative'
  | 'vip'
  | 'pk'
  | 'praise';

// Theme types
export interface Theme {
  id: string;
  name: string;
  background: string;
  textColor: string;
  accentColor: string;
  highlightColor: string;
  fontSize?: number;
  cardColors: Record<ScriptCategory, string>;
  isDark: boolean;
}

// Live session types
export interface LiveSession {
  id: string;
  name: string;
  startTime: number;
  endTime?: number;
  usageHistory: ScriptUsageRecord[];
  totalScriptsUsed: number;
}

export interface ScriptUsageRecord {
  scriptId: string;
  usedAt: number;
  usedInSession: string;
}

// Template types
export type TemplateTheme = 'standup' | 'chat' | 'ecommerce';

// 节奏模式配置 - 每个段落的模板
export interface SegmentPattern {
  name: string;
  category: ScriptCategory;
  durationMinutes: number;
}

export interface MainScriptTemplate {
  id: string;
  theme: TemplateTheme;
  name: string;
  totalDurationMinutes: number;
  segments: ScriptSegment[];
  patterns: SegmentPattern[];  // 节奏模式配置
  repeatCount: number;          // 循环次数
  freeContent?: string;          // 自由输入内容（不依赖话术库，整段文本）
  createdAt: number;
  updatedAt: number;
}

export interface ScriptSegment {
  id: string;
  templateId: string;
  name: string;
  category: ScriptCategory;
  durationSeconds: number;
  order: number;
  transition?: string;
  scriptIds?: string[];
  customContent?: string;          // 自定义文本内容（多行，\n 分隔）
}

export interface MainScript {
  id: string;
  sessionId: string;
  templateId: string;
  orderedScripts: OrderedScript[];
  currentIndex: number;
  status: 'generated' | 'in_progress' | 'completed';
  generatedAt: number;
}

export interface OrderedScript {
  order: number;
  script: Script;
  segmentId: string;
  segmentName: string;
  expectedTime?: number;
}

// Danmu capture types
export interface DanmuCaptureConfig {
  enabled: boolean;
  windowTitle: string;
  captureIntervalMs: number;
  useOCR: boolean;
  ocrEngine: 'tesseract' | 'cloud';
}

export interface DanmuCaptureWindow {
  id: string;
  title: string;
  processName: string;
  position?: { x: number; y: number; width: number; height: number };
  selected: boolean;
  isChildWindow?: boolean;
  parentHwnd?: string | null;
}

export interface DanmuCaptureRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  name?: string;
}

// AI types
export interface AIRecommendationResult {
  danmu: Danmu;
  replies: AIReplyItem[];
  generatedAt: number;
}

export interface AIReplyItem {
  order: number;
  content: string;
  confidence: number;
}

// ============ PERSONA SYSTEM ============

export interface PersonaConfig {
  id: string;
  name: string;
  description: string;
  personalityTraits: string[];
  speakingStyle: PersonaSpeakingStyle;
  replyTone: PersonaReplyTone;
  responseLength: 'short' | 'medium' | 'long';
  customGuidelines: string;
  createdAt: number;
  updatedAt: number;
}

export type PersonaSpeakingStyle =
  | 'casual'
  | 'energetic'
  | 'warm'
  | 'humorous'
  | 'sarcastic'
  | 'professional'
  | 'playful'
  | 'cool'
  | 'rebellious';

export type PersonaReplyTone =
  | 'friendly'
  | 'teasing'
  | 'serious'
  | 'humorous'
  | 'stylish'
  | 'caring';

// ============ DANMU REPLY SERVICE TYPES ============

export interface DanmuReplyRequest {
  danmu: Danmu;
  persona?: PersonaConfig;
  maxReplies?: number;
}

export interface DanmuReplyResult {
  reply: AIReplyItem;
  matchType: 'trigger' | 'content' | 'llm';
  matchedScriptId?: string;
}

export interface DanmuReplyResponse {
  danmu: Danmu;
  replies: DanmuReplyResult[];
  generatedAt: number;
  personaUsed?: string;
}

export interface AIProviderConfig {
  id: string;
  name: string;
  baseURL: string;
  apiKey?: string;
  model: string;
  enabled: boolean;
  priority: number;
  timeout: number;
}

// Deduplication
export interface DeduplicationConfig {
  enabled: boolean;
  timeWindowMs: number;
  maxRepeatPerWindow: number;
}

// Electron API types exposed via preload
export interface HotkeyConfig {
  version: number;
  hotkeys: Record<string, string>;
}

export interface HotkeyConflictResult {
  hasConflict: boolean;
  conflictingKeys: string[];
}

export interface ElectronAPI {
  // Hotkey events
  onTogglePause: (callback: () => void) => void;
  onPrev: (callback: () => void) => void;
  onNext: (callback: () => void) => void;
  removeAllListeners: (channel: string) => void;

  // Hotkey configuration
  getHotkeyConfig: () => Promise<HotkeyConfig | null>;
  updateHotkeyConfig: (action: string, newAccelerator: string) => Promise<boolean>;
  checkHotkeyConflict: (accelerator: string) => Promise<HotkeyConflictResult>;

  // Database operations
  getAllScripts: () => Promise<Script[]>;
  getScriptById: (id: string) => Promise<Script | undefined>;
  createScript: (script: Script) => Promise<Script>;
  updateScript: (id: string, updates: Partial<Script>) => Promise<Script | undefined>;
  deleteScript: (id: string) => Promise<boolean>;
  searchScripts: (query: string) => Promise<Script[]>;

  // Template operations
  getAllTemplates: () => Promise<MainScriptTemplate[]>;
  getTemplateById: (id: string) => Promise<MainScriptTemplate | undefined>;
  createTemplate: (template: MainScriptTemplate) => Promise<MainScriptTemplate>;
  updateTemplate: (id: string, updates: Partial<MainScriptTemplate>) => Promise<MainScriptTemplate | undefined>;
  deleteTemplate: (id: string) => Promise<boolean>;

  // Segment operations
  getSegmentsByTemplate: (templateId: string) => Promise<ScriptSegment[]>;
  createSegment: (segment: ScriptSegment) => Promise<ScriptSegment>;
  updateSegment: (id: string, updates: Partial<ScriptSegment>) => Promise<ScriptSegment | undefined>;
  deleteSegment: (id: string) => Promise<boolean>;

  // Danmu capture
  getDanmuWindows: () => Promise<DanmuCaptureWindow[]>;
  getAllDanmuWindows: () => Promise<DanmuCaptureWindow[]>;
  findDanmuWindowsByProcess: (processName: string) => Promise<DanmuCaptureWindow[]>;
  findDanmuWindowsByTitle: (titlePattern: string) => Promise<DanmuCaptureWindow[]>;
  findHudongWindow: () => Promise<DanmuCaptureWindow | null>;
  setDanmuCaptureRegion: (region: { x: number; y: number; width: number; height: number }) => Promise<boolean>;
  getDanmuCaptureRegion: () => Promise<{ x: number; y: number; width: number; height: number } | null>;
  captureDanmuRegion: (region: { x: number; y: number; width: number; height: number }) => Promise<Danmu[]>;
  selectDanmuWindow: (windowId: string) => Promise<DanmuCaptureWindow | null>;
  getDanmuConfig: () => Promise<DanmuCaptureConfig>;
  updateDanmuConfig: (config: Partial<DanmuCaptureConfig>) => Promise<DanmuCaptureConfig>;
  startDanmuCapture: () => Promise<boolean>;
  stopDanmuCapture: () => Promise<boolean>;
  pauseDanmuCapture: () => Promise<boolean>;
  resumeDanmuCapture: () => Promise<boolean>;
  getDanmuCaptureStatus: () => Promise<{ isCapturing: boolean; isPaused: boolean; status: 'capturing' | 'paused' | 'stopped' }>;
  onDanmuNew: (callback: (danmu: Danmu) => void) => void;
  onDanmuBatch: (callback: (danmuList: Danmu[]) => void) => void;
  onDanmuError: (callback: (error: string) => void) => void;
  onDanmuStatus: (callback: (status: DanmuCaptureStatus) => void) => void;

  // Layout management
  saveLayout: (layout: import('../stores/layoutStore').LayoutItem[]) => Promise<void>;
  loadLayout: () => Promise<import('../stores/layoutStore').LayoutItem[]>;

  // AI connection test (uses main process network to avoid CORS)
  testAIConnection: (provider: { baseURL: string; apiKey?: string; model: string; timeout: number }) => Promise<{ success: boolean; message: string }>;

  // Clear all scripts from database
  clearAllScripts: () => Promise<{ success: boolean; deletedCount?: number; error?: string }>;

  // AI Chat Completion (uses main process network to avoid CORS)
  chatCompletion: (request: { provider: { baseURL: string; apiKey?: string; model: string; timeout: number }; messages: Array<{role: string; content: string}>; temperature?: number; max_tokens?: number }) => Promise<{ success: boolean; content?: string; error?: string; usage?: any }>;
}

export interface DanmuCaptureStatus {
  status: 'capturing' | 'paused' | 'stopped';
  config: DanmuCaptureConfig;
  selectedWindow: DanmuCaptureWindow | null;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}