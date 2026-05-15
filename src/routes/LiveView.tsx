import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import GridLayout from 'react-grid-layout';
import { ScriptView } from '../components/layout/ScriptView';
import DanmuPanel from '../components/layout/DanmuPanel';
import { SlotCardPanel } from '../components/layout/SlotCardPanel';
import { useLayoutStore, LayoutItem } from '../stores/layoutStore';
import { useThemeStore } from '../stores/themeStore';
import { useAmmoStore } from '../stores/ammoStore';
import { useScriptStore } from '../stores/scriptStore';
import type { TemplateTheme, MainScriptTemplate, MainScript, DisplayProfile, Script } from '../types';
import {
  generateMainScript,
  getThemeDisplayName,
  DEDUP_TIME_WINDOWS,
} from '../services/ScriptEngine';
import * as templateService from '../services/templateService';
import { createLiveSession, endLiveSession } from '../services/sessionService';
import { getDisplayProfiles } from '../services/configStorage';
import './LiveView.css';

interface LiveStatus {
  duration: number; // seconds
  currentSegment: string;
  pkCountdown: number; // seconds
  newFollowers: number;
  giftAlerts: number;
}

// Flow steps for the live start modal
type LiveFlowStep = 'select_theme' | 'select_template' | 'select_display_config' | 'ready';

interface StartLiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartLive: (templateId: string, displayProfileId: string | null) => void;
}

const THEMES: { theme: TemplateTheme; icon: string; name: string; description: string }[] = [
  { theme: 'standup', icon: '🎤', name: '脱口秀直播', description: '适合脱口秀、评述类直播' },
  { theme: 'chat', icon: '💬', name: '聊天互动', description: '适合聊天、问答、互动类直播' },
  { theme: 'ecommerce', icon: '🛒', name: '日常带货', description: '适合带货、商品推荐类直播' },
];

// Start Live Modal Component with multi-step flow
function StartLiveModal({ isOpen, onClose, onStartLive }: StartLiveModalProps) {
  const [step, setStep] = useState<LiveFlowStep>('select_theme');
  const [selectedTheme, setSelectedTheme] = useState<TemplateTheme | null>(null);
  const [templates, setTemplates] = useState<MainScriptTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [displayProfiles] = useState<DisplayProfile[]>(() => getDisplayProfiles().profiles);
  const [selectedDisplayProfileId, setSelectedDisplayProfileId] = useState<string | null>(null);

  // Load templates when theme is selected
  useEffect(() => {
    if (selectedTheme) {
      templateService.getAllTemplates().then(templates => {
        const themeTemplates = templates.filter(t => t.theme === selectedTheme);
        setTemplates(themeTemplates);
        setSelectedTemplateId(null);
        setStep('select_template');
      });
    }
  }, [selectedTheme]);

  const handleBack = () => {
    if (step === 'select_template') {
      setStep('select_theme');
      setSelectedTheme(null);
      setTemplates([]);
    } else if (step === 'select_display_config') {
      setStep('select_template');
      setSelectedDisplayProfileId(null);
    }
  };

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId);
    setStep('select_display_config');
  };

  const handleDisplayConfigSelect = (profileId: string | null) => {
    setSelectedDisplayProfileId(profileId);
    setStep('ready');
  };

  const handleStart = () => {
    if (selectedTemplateId) {
      onStartLive(selectedTemplateId, selectedDisplayProfileId);
      onClose();
    }
  };

  const handleClose = () => {
    setStep('select_theme');
    setSelectedTheme(null);
    setSelectedTemplateId(null);
    setSelectedDisplayProfileId(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            {step === 'select_theme' && '选择直播主题'}
            {step === 'select_template' && `选择模板 - ${getThemeDisplayName(selectedTheme!)}`}
            {step === 'select_display_config' && '选择展示配置'}
            {step === 'ready' && '准备开始'}
          </h2>
          <button className="modal-close" onClick={handleClose}>&times;</button>
        </div>
        <div className="modal-body">
          {/* Step 1: Select Theme */}
          {step === 'select_theme' && (
            <div className="template-grid">
              {THEMES.map((option) => (
                <div
                  key={option.theme}
                  className={`template-card ${selectedTheme === option.theme ? 'selected' : ''}`}
                  onClick={() => setSelectedTheme(option.theme)}
                >
                  <div className="template-icon">{option.icon}</div>
                  <div className="template-name">{option.name}</div>
                  <div className="template-desc">{option.description}</div>
                </div>
              ))}
            </div>
          )}

          {/* Step 2: Select Template */}
          {step === 'select_template' && (
            <div className="template-list">
              {templates.length === 0 ? (
                <div className="no-templates">
                  <p>暂无模板，将使用默认模板</p>
                  <button
                    className="btn btn-primary"
                    onClick={() => handleTemplateSelect(`default-${selectedTheme}`)}
                  >
                    使用默认模板
                  </button>
                </div>
              ) : (
                templates.map((template) => (
                  <div
                    key={template.id}
                    className={`template-item ${selectedTemplateId === template.id ? 'selected' : ''}`}
                    onClick={() => handleTemplateSelect(template.id)}
                  >
                    <div className="template-item-name">{template.name}</div>
                    <div className="template-item-info">
                      {template.totalDurationMinutes}分钟 · {template.segments.length}个段落
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Step 3: Select Display Config */}
          {step === 'select_display_config' && (
            <div className="display-config-list">
              <div
                className={`config-item ${selectedDisplayProfileId === null ? 'selected' : ''}`}
                onClick={() => handleDisplayConfigSelect(null)}
              >
                <div className="config-item-name">默认配置</div>
                <div className="config-item-info">使用系统默认槽位映射</div>
              </div>
              {displayProfiles.map((profile) => (
                <div
                  key={profile.id}
                  className={`config-item ${selectedDisplayProfileId === profile.id ? 'selected' : ''}`}
                  onClick={() => handleDisplayConfigSelect(profile.id)}
                >
                  <div className="config-item-name">{profile.name}</div>
                  <div className="config-item-info">{profile.slots.length}个槽位</div>
                </div>
              ))}
            </div>
          )}

          {/* Step 4: Ready */}
          {step === 'ready' && (
            <div className="ready-summary">
              <div className="summary-item">
                <span className="summary-label">主题</span>
                <span className="summary-value">{getThemeDisplayName(selectedTheme!)}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">模板</span>
                <span className="summary-value">
                  {selectedTemplateId?.startsWith('default-') ? '默认模板' : templates.find(t => t.id === selectedTemplateId)?.name}
                </span>
              </div>
              <div className="summary-item">
                <span className="summary-label">展示配置</span>
                <span className="summary-value">
                  {selectedDisplayProfileId
                    ? displayProfiles.find(p => p.id === selectedDisplayProfileId)?.name
                    : '默认配置'}
                </span>
              </div>
            </div>
          )}
        </div>
        <div className="modal-footer">
          {step !== 'select_theme' && (
            <button className="btn btn-secondary" onClick={handleBack}>上一步</button>
          )}
          <button className="btn btn-secondary" onClick={handleClose}>取消</button>
          {step === 'ready' && (
            <button
              className="btn btn-primary"
              onClick={handleStart}
              disabled={!selectedTemplateId}
            >
              开始直播
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Shortcut Help Modal
interface ShortcutHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function ShortcutHelpModal({ isOpen, onClose }: ShortcutHelpModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content shortcut-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>快捷键帮助</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          <div className="shortcut-section">
            <h3>主提词区</h3>
            <div className="shortcut-item"><kbd>空格</kbd> 暂停/继续</div>
            <div className="shortcut-item"><kbd>↑</kbd> 上一句</div>
            <div className="shortcut-item"><kbd>↓</kbd> 下一句</div>
            <div className="shortcut-item"><kbd>滚轮</kbd> 调整速度</div>
          </div>
          <div className="shortcut-section">
            <h3>话术弹药带</h3>
            <div className="shortcut-item"><kbd>1-9</kbd> 切换话术槽位</div>
            <div className="shortcut-item"><kbd>↑</kbd><kbd>↓</kbd> 上下翻页</div>
            <div className="shortcut-item"><kbd>空格</kbd> 开启/关闭自动轮换</div>
          </div>
          <div className="shortcut-section">
            <h3>通用</h3>
            <div className="shortcut-item"><kbd>?</kbd> 打开快捷键帮助</div>
            <div className="shortcut-item"><kbd>Esc</kbd> 关闭弹窗</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// TopBar Component
interface TopBarProps {
  status: LiveStatus;
  isLive: boolean;
  topBarCollapsed: boolean;
  onToggleCollapse: () => void;
  onSwitchToMaintenance: () => void;
  onShowShortcuts: () => void;
  onShowStartModal: () => void;
  onEndLive?: () => void;
}

function TopBar({ status, isLive, topBarCollapsed, onToggleCollapse, onSwitchToMaintenance, onShowShortcuts, onShowStartModal, onEndLive }: TopBarProps) {
  const formatDuration = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const formatCountdown = (seconds: number): string => {
    if (seconds <= 0) return '--:--';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`top-bar ${topBarCollapsed ? 'collapsed' : ''}`}>
      <div className="top-bar__left">
        <button
          className="top-bar__collapse-btn"
          onClick={onToggleCollapse}
          title={topBarCollapsed ? '展开' : '折叠'}
        >
          {topBarCollapsed ? '▼' : '▲'}
        </button>
        {!topBarCollapsed && (
          <>
            <button
              className={`mode-btn mode-btn--live ${isLive ? 'active' : ''}`}
              onClick={isLive ? onEndLive : onShowStartModal}
            >
              {isLive ? '结束直播' : '直播模式'}
            </button>
            <button
              className="mode-btn mode-btn--maintenance"
              onClick={onSwitchToMaintenance}
            >
              维护模式
            </button>
          </>
        )}
      </div>

      {/* Status section - hidden when collapsed */}
      {!topBarCollapsed && (
        <div className="top-bar__status">
          {isLive && (
            <>
              <div className="status-item">
                <span className="status-label">直播时长</span>
                <span className="status-value status-value--highlight">{formatDuration(status.duration)}</span>
              </div>
              <div className="status-divider" />
              <div className="status-item">
                <span className="status-label">当前环节</span>
                <span className="status-value">{status.currentSegment || '--'}</span>
              </div>
              <div className="status-divider" />
              <div className="status-item">
                <span className="status-label">PK倒计时</span>
                <span className="status-value status-value--warning">{formatCountdown(status.pkCountdown)}</span>
              </div>
              <div className="status-divider" />
              <div className="status-item">
                <span className="status-label">新增关注</span>
                <span className="status-value status-value--success">+{status.newFollowers}</span>
              </div>
              <div className="status-divider" />
              <div className="status-item">
                <span className="status-label">礼物提醒</span>
                <span className="status-value status-value--gift">{status.giftAlerts > 0 ? `🎁 ${status.giftAlerts}` : '0'}</span>
              </div>
            </>
          )}
        </div>
      )}

      <div className="top-bar__right">
        <button className="icon-btn" onClick={onShowShortcuts} title="快捷键帮助">
          ❓
        </button>
      </div>
    </div>
  );
}

// Live View Grid Layout
interface LiveViewGridProps {
  width: number;
  height: number;
  children: React.ReactNode;
  onLayoutChange: (layout: LayoutItem[]) => void;
}

function LiveViewGrid({ width, height, children, onLayoutChange }: LiveViewGridProps) {
  const { layout, setLayout, saveLayout } = useLayoutStore();
  const rowHeight = 50;
  const cols = 12;
  const margin: [number, number] = [8, 8];
  const containerPadding: [number, number] = [8, 8];

  const handleLayoutChange = useCallback(
    (newLayout: GridLayout.Layout[]) => {
      console.log('[LiveViewGrid] Layout changed:', newLayout);
      const layoutItems: LayoutItem[] = newLayout.map((item) => ({
        i: item.i,
        x: item.x,
        y: item.y,
        w: item.w,
        h: item.h,
        minW: item.minW,
        minH: item.minH,
      }));
      setLayout(layoutItems);
      saveLayout(layoutItems);
      onLayoutChange?.(layoutItems);
    },
    [setLayout, saveLayout, onLayoutChange]
  );

  return (
    <GridLayout
      className="live-view-grid"
      layout={layout}
      cols={cols}
      rowHeight={rowHeight}
      width={width}
      margin={margin}
      containerPadding={containerPadding}
      onLayoutChange={handleLayoutChange}
      draggableHandle=".panel-drag-handle"
      draggableCancel=".panel-content"
      resizeHandles={['se', 'e', 'w', 's', 'n']}
      useCSSTransforms
      compactType="vertical"
      preventCollision={false}
      isBounded={false}
    >
      {children}
    </GridLayout>
  );
}

// Main LiveView Component
export default function LiveView() {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [isLive, setIsLive] = useState(false);
  const [showStartModal, setShowStartModal] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [topBarCollapsed, setTopBarCollapsed] = useState(false);
  const [currentSession, setCurrentSession] = useState<string | null>(null);
  const [currentMainScript, setCurrentMainScript] = useState<MainScript | null>(null);
  const [templateScripts, setTemplateScripts] = useState<Script[]>([]); // Scripts from selected template
  const [status, setStatus] = useState<LiveStatus>({
    duration: 0,
    currentSegment: '',
    pkCountdown: 0,
    newFollowers: 0,
    giftAlerts: 0,
  });

  const { loadLayout } = useLayoutStore();
  const activeTheme = useThemeStore((state) => state.getActiveTheme());
  const { slots } = useAmmoStore();
  const { loadScripts } = useScriptStore();

  // Load scripts and layout on mount
  useEffect(() => {
    loadScripts();
    loadLayout();
  }, [loadScripts, loadLayout]);

  // Update dimensions on resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({ width: rect.width, height: rect.height });
      }
    };

    updateDimensions();

    // Use ResizeObserver for accurate container size detection
    const resizeObserver = new ResizeObserver(() => {
      updateDimensions();
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    window.addEventListener('resize', updateDimensions);
    return () => {
      window.removeEventListener('resize', updateDimensions);
      resizeObserver.disconnect();
    };
  }, []);

  // Duration timer
  useEffect(() => {
    if (!isLive) return;

    const interval = setInterval(() => {
      setStatus((prev) => ({
        ...prev,
        duration: prev.duration + 1,
        pkCountdown: Math.max(0, prev.pkCountdown - 1),
      }));
    }, 1000);

    return () => clearInterval(interval);
  }, [isLive]);

  // Simulate random events
  useEffect(() => {
    if (!isLive) return;

    const followerInterval = setInterval(() => {
      // Random chance of new follower
      if (Math.random() < 0.3) {
        setStatus((prev) => ({ ...prev, newFollowers: prev.newFollowers + 1 }));
      }
    }, 5000);

    const giftInterval = setInterval(() => {
      // Random chance of gift
      if (Math.random() < 0.2) {
        setStatus((prev) => ({ ...prev, giftAlerts: prev.giftAlerts + 1 }));
        // Auto-clear gift alert after 3 seconds
        setTimeout(() => {
          setStatus((prev) => ({ ...prev, giftAlerts: Math.max(0, prev.giftAlerts - 1) }));
        }, 3000);
      }
    }, 8000);

    return () => {
      clearInterval(followerInterval);
      clearInterval(giftInterval);
    };
  }, [isLive]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // '?' to show shortcuts
      if (e.key === '?' && !e.shiftKey) {
        e.preventDefault();
        setShowShortcuts(true);
      }
      // Escape to close modals
      if (e.key === 'Escape') {
        setShowShortcuts(false);
        setShowStartModal(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Handle mode switch
  const handleSwitchToMaintenance = useCallback(() => {
    navigate('/maintenance');
  }, [navigate]);

  // Handle start live - load template and scripts
  const handleStartLive = useCallback(async (templateId: string, displayProfileId: string | null) => {
    // Create a new live session
    const session = createLiveSession();
    setCurrentSession(session.id);

    // Load template and scripts
    const template = await templateService.getTemplateById(templateId);
    const allScripts = useScriptStore.getState().scripts;

    // Flatten scripts from template segments
    const scripts: Script[] = [];
    if (template?.segments) {
      for (const segment of template.segments) {
        for (const scriptId of segment.scriptIds || []) {
          const script = allScripts.find(s => s.id === scriptId);
          if (script) {
            scripts.push(script);
          }
        }
      }
    }
    setTemplateScripts(scripts);

    // Generate main script using ScriptEngine
    const mainScript = generateMainScript({
      templateId,
      sessionId: session.id,
      deduplicationConfig: {
        enabled: true,
        timeWindowMs: DEDUP_TIME_WINDOWS['30min'],
        maxRepeatPerWindow: 1,
      },
    });

    setCurrentMainScript(mainScript);

    // Get first segment name for status
    const firstSegmentName = template?.segments?.[0]?.name || '';

    // Update status
    setStatus((prev) => ({
      ...prev,
      currentSegment: firstSegmentName,
      pkCountdown: 300, // 5 minutes default
    }));

    setIsLive(true);
    setShowStartModal(false);
  }, []);

  // Handle end live
  const handleEndLive = useCallback(() => {
    if (currentSession) {
      endLiveSession(currentSession);
      setCurrentSession(null);
    }
    setCurrentMainScript(null);
    setTemplateScripts([]);
    setIsLive(false);
    setStatus({
      duration: 0,
      currentSegment: '',
      pkCountdown: 0,
      newFollowers: 0,
      giftAlerts: 0,
    });
  }, [currentSession]);

  // Apply theme CSS variables
  useEffect(() => {
    if (activeTheme) {
      const root = document.documentElement;
      root.style.setProperty('--theme-background', activeTheme.background);
      root.style.setProperty('--theme-text', activeTheme.textColor);
      root.style.setProperty('--theme-accent', activeTheme.accentColor);
      root.style.setProperty('--theme-highlight', activeTheme.highlightColor);
      root.style.setProperty('--panel-bg', 'transparent');
      root.style.setProperty('--panel-text', activeTheme.textColor);
    }
  }, [activeTheme]);

  // Render panel content
  const renderPanelContent = (panelId: string) => {
    switch (panelId) {
      case 'script':
        // Pass template scripts if available, otherwise ScriptView will use ammo slots
        return <ScriptView scripts={templateScripts.length > 0 ? templateScripts : undefined} />;
      case 'danmu':
        return <DanmuPanel />;
      default:
        return null;
    }
  };

  const { layout } = useLayoutStore();

  return (
    <div
      ref={containerRef}
      className="live-view"
      style={{
        '--theme-bg': 'transparent',
        '--theme-text': activeTheme?.textColor || '#ffffff',
        '--theme-accent': activeTheme?.accentColor || '#e94560',
      } as React.CSSProperties}
    >
      <TopBar
        status={status}
        isLive={isLive}
        topBarCollapsed={topBarCollapsed}
        onToggleCollapse={() => setTopBarCollapsed(!topBarCollapsed)}
        onSwitchToMaintenance={handleSwitchToMaintenance}
        onShowShortcuts={() => setShowShortcuts(true)}
        onShowStartModal={() => setShowStartModal(true)}
        onEndLive={handleEndLive}
      />

      <div className="live-view__content">
        {dimensions.width > 0 && dimensions.height > 0 && (
          <>
            {/* Main panels grid (script and danmu) */}
            <LiveViewGrid
              width={dimensions.width}
              height={dimensions.height}
              onLayoutChange={() => {}}
            >
              {layout.filter(item => item.i !== 'ammo').map((item) => (
                <div key={item.i} className={`panel-container panel-${item.i}`}>
                  <div className="panel-drag-handle">
                    <span className="panel-title">
                      {item.i === 'script' && '主提词区'}
                      {item.i === 'danmu' && '公屏互动'}
                    </span>
                    <span className="panel-resize-hint">⋮⋮</span>
                  </div>
                  <div className="panel-content">
                    {renderPanelContent(item.i)}
                  </div>
                </div>
              ))}
            </LiveViewGrid>
            {/* Floating slot card panels */}
            {slots.filter(slot => slot.enabled).map((slot) => (
              <SlotCardPanel key={slot.slotId} slot={slot} />
            ))}
          </>
        )}
      </div>

      <StartLiveModal
        isOpen={showStartModal}
        onClose={() => setShowStartModal(false)}
        onStartLive={handleStartLive}
      />

      <ShortcutHelpModal
        isOpen={showShortcuts}
        onClose={() => setShowShortcuts(false)}
      />
    </div>
  );
}
