/**
 * Config Storage - Browser compatible
 * Uses localStorage instead of fs for renderer process
 */

const CONFIG_PREFIX = 'wordshot_config_';

function getConfigPath(filename: string): string {
  return CONFIG_PREFIX + filename;
}

export function readJsonConfig<T>(filename: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(getConfigPath(filename));
    if (!item) return defaultValue;
    return JSON.parse(item) as T;
  } catch (error) {
    console.error(`Error reading config ${filename}:`, error);
    return defaultValue;
  }
}

export function writeJsonConfig<T>(filename: string, data: T): void {
  try {
    localStorage.setItem(getConfigPath(filename), JSON.stringify(data));
  } catch (error) {
    console.error(`Error writing config ${filename}:`, error);
  }
}

// Display profiles configuration
export interface DisplayProfilesConfig {
  profiles: import('../types').DisplayProfile[];
  activeProfileId: string | null;
}

export const defaultDisplayProfiles: DisplayProfilesConfig = {
  profiles: [],
  activeProfileId: null,
};

export function getDisplayProfiles(): DisplayProfilesConfig {
  return readJsonConfig('display_profiles.json', defaultDisplayProfiles);
}

export function saveDisplayProfiles(config: DisplayProfilesConfig): void {
  writeJsonConfig('display_profiles.json', config);
}

// AI providers configuration
export interface AIProvidersConfig {
  providers: import('../types').AIProviderConfig[];
}

export const defaultAIProviders: AIProvidersConfig = {
  providers: [],
};

export function getAIProviders(): AIProvidersConfig {
  return readJsonConfig('ai_providers.json', defaultAIProviders);
}

export function saveAIProviders(config: AIProvidersConfig): void {
  writeJsonConfig('ai_providers.json', config);
}

// Danmu capture configuration
export interface DanmuCaptureSettings {
  config: import('../types').DanmuCaptureConfig;
}

export const defaultDanmuCapture: DanmuCaptureSettings = {
  config: {
    enabled: false,
    windowTitle: '',
    captureIntervalMs: 2000,
    useOCR: false,
    ocrEngine: 'tesseract',
  },
};

export function getDanmuCaptureConfig(): import('../types').DanmuCaptureConfig {
  return readJsonConfig('danmu_capture.json', defaultDanmuCapture.config);
}

export function saveDanmuCaptureConfig(config: import('../types').DanmuCaptureConfig): void {
  writeJsonConfig('danmu_capture.json', { config });
}

// Hotkeys configuration
export interface HotkeysConfig {
  globalShortcuts: Record<string, string>;
  ammoSlotShortcuts: string[];
}

export const defaultHotkeys: HotkeysConfig = {
  globalShortcuts: {},
  ammoSlotShortcuts: ['1', '2', '3', '4', '5', '6', '7', '8', '9'],
};

export function getHotkeysConfig(): HotkeysConfig {
  return readJsonConfig('hotkeys.json', defaultHotkeys);
}

export function saveHotkeysConfig(config: HotkeysConfig): void {
  writeJsonConfig('hotkeys.json', config);
}

// Layout configuration
export interface LayoutConfig {
  panels: Record<string, { x: number; y: number; width: number; height: number }>;
}

export const defaultLayout: LayoutConfig = {
  panels: {},
};

export function getLayoutConfig(): LayoutConfig {
  return readJsonConfig('layout.json', defaultLayout);
}

export function saveLayoutConfig(config: LayoutConfig): void {
  writeJsonConfig('layout.json', config);
}

// Themes configuration
export interface ThemesConfig {
  themes: import('../types').Theme[];
  activeThemeId: string | null;
}

export const defaultThemes: ThemesConfig = {
  themes: [],
  activeThemeId: null,
};

export function getThemesConfig(): ThemesConfig {
  return readJsonConfig('themes.json', defaultThemes);
}

export function saveThemesConfig(config: ThemesConfig): void {
  writeJsonConfig('themes.json', config);
}

// Main script progress configuration
export interface MainScriptProgressConfig {
  currentScriptId: string | null;
  currentIndex: number;
  isPlaying: boolean;
  scrollPosition: number;
}

export const defaultMainScriptProgress: MainScriptProgressConfig = {
  currentScriptId: null,
  currentIndex: 0,
  isPlaying: false,
  scrollPosition: 0,
};

export function getMainScriptProgress(): MainScriptProgressConfig {
  return readJsonConfig('main_script_progress.json', defaultMainScriptProgress);
}

export function saveMainScriptProgress(config: MainScriptProgressConfig): void {
  writeJsonConfig('main_script_progress.json', config);
}