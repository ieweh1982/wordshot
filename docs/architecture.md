# 直播话术提词器｜架构设计文档

> 版本：v3.1
> 日期：2026-05-12
> 技术栈：Electron + React + AI（统一 API 配置）

---

## 一、系统架构总览

```
┌─────────────────────────────────────────────────────────────────┐
│                        渲染进程 (Renderer)                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │  主提词区   │  │  常驻话术   │  │  公屏互动   │              │
│  │  ScriptView │  │  AmmoZone   │  │  DanmuPanel │              │
│  │ (可拖拽调整)│  │ (可拖拽调整)│  │ (可拖拽调整)│              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
│          │                │                │                    │
│          └────────────────┼────────────────┘                    │
│                           │                                     │
│                    ┌──────▼──────┐                             │
│                    │  状态管理   │  (Zustand)                   │
│                    └──────┬──────┘                             │
└───────────────────────────┼─────────────────────────────────────┘
                            │ IPC
┌───────────────────────────┼─────────────────────────────────────┐
│                        主进程 (Main)                             │
│  ┌─────────────┐  ┌──────▼──────┐  ┌─────────────┐              │
│  │  全局热键    │  │  窗口管理   │  │  托盘管理   │              │
│  │  HotkeyMgr  │  │  WindowMgr  │  │  TrayMgr    │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    IPC 事件总线                          │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                            │
              ┌─────────────▼─────────────┐
              │     AI Service Layer       │
              │  ┌───────────────────────┐ │
              │  │   AI Provider (多)   │ │
              │  │  baseURL+apiKey+model │ │
              │  └───────────────────────┘ │
              └─────────────────────────────┘
```

---

## 二、核心模块划分

### 2.1 模块依赖图

```
┌─────────────────────────────────────────────────────────────────┐
│                         UI Layer                                │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                       │
│  │ScriptView│  │AmmoZone │  │DanmuPanel│                       │
│  │(可拖拽)  │  │(可拖拽)  │  │(可拖拽)  │                       │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘                       │
│       └─────────────┴──────┬──────┴─────────────┘                │
│                            │                                    │
│                   ┌────────▼────────┐                          │
│                   │   Store Layer    │                          │
│                   │   (Zustand)     │                          │
│                   └────────┬────────┘                          │
│                            │                                    │
│       ┌────────────────────┼────────────────────┐              │
│       │                    │                    │              │
│ ┌──────────────┐  ┌─────────────────┐  ┌───────────────┐        │
│ │ScriptEngine  │  │AI Recommendation│  │DanmuService  │        │
│ │              │  │    Engine       │  │              │        │
│ └──────────────┘  └─────────────────┘  └──────────────┘        │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │                  窗口弹幕抓取 (DanmuCapture)                │ │
│ │  窗口选择 → DOM分析/OCR识别 → 弹幕解析 → 去重 → 传输         │ │
│ └─────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────┘

维护模式（独立页面）:
┌─────────────────────────────────────────────────────────────┐
│ maintenance/                                               │
│ ├── ScriptManagement      话术增删改查、待审核话术、批量操作│
│ ├── TemplateEditor        模板编辑（拖拽调整顺序）         │
│ ├── DisplayConfig         槽位映射配置、预设方案管理          │
│ ├── AIConfig               AI Provider配置                  │
│ ├── DanmuCaptureConfig     弹幕窗口选择、抓取频率、OCR配置   │
│ ├── ImportExport          导入导出（支持text/md）          │
│ ├── ThemeConfig           主题配置（多套主题切换）           │
│ └── Settings               系统设置（热键、透明度、去重等）  │
└─────────────────────────────────────────────────────────────┘
```

---

## 三、数据模型

### 3.1 话术 (Script)

```typescript
interface Script {
  id: string;                    // UUID
  category: ScriptCategory;      // 话术后端分类
  content: string;               // 话术内容
  color: string;                  // HEX 颜色
  priority: number;              // 优先级 1-10
  triggers: TriggerType[];       // 触发条件标签
  tags: string[];                 // 自定义标签（便于检索）
  usageCount: number;            // 使用次数统计
  lastUsedAt?: number;
  createdAt: number;
  updatedAt: number;
}

type ScriptCategory =
  | 'thanks'       // 感谢类
  | 'rebuttal'     // 回击类
  | 'interaction'  // 互动类
  | 'ad'           // 带货类
  | 'praise'       // 夸奖类
  | 'opening'      // 开播类
  | 'closing'      // 闭播类
  | 'lottery'      // 抽奖类
  | 'crisis';      // 危机类

type TriggerType =
  | 'gift' | 'big_gift' | 'follower' | 'vip'
  | 'hater' | 'ribbit' | 'provocative'
  | 'silent' | 'vote' | 'question'
  | 'ad_break' | 'lottery_time' | 'negative' | 'ban' | 'praise';
```

### 3.2 常驻话术展示配置

```typescript
interface AmmoSlotConfig {
  slotId: string;
  hotkey: string;                // 快捷键
  displayName: string;           // 显示名称
  sourceCategory: ScriptCategory; // 数据来源
  displayCount: number;           // 显示话术数量
  enabled: boolean;
  autoRotateEnabled: boolean;
  autoRotateIntervalMs: number;   // 独立轮换间隔
}

interface DisplayProfile {
  id: string;
  name: string;                  // 配置方案名称
  slots: AmmoSlotConfig[];
  createdAt: number;
  updatedAt: number;
}
```

### 3.3 弹幕 (Danmu)

```typescript
interface Danmu {
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

type DanmuType =
  | 'normal' | 'gift' | 'big_gift' | 'follower'
  | 'question' | 'hater' | 'ribbit' | 'provocative'
  | 'vip' | 'pk' | 'praise';
```

### 3.4 直播场次与模板

```typescript
interface LiveSession {
  id: string;
  name: string;
  startTime: number;
  endTime?: number;
  usageHistory: ScriptUsageRecord[];
  totalScriptsUsed: number;
}

interface ScriptUsageRecord {
  scriptId: string;
  usedAt: number;
  usedInSession: string;
}

interface DeduplicationConfig {
  enabled: boolean;
  timeWindowMs: number;          // 默认 30 分钟
  maxRepeatPerWindow: number;
}

/**
 * 主脚本模板（按主题分类）
 */
interface MainScriptTemplate {
  id: string;
  theme: TemplateTheme;          // 模板主题
  name: string;                  // 模板名称
  totalDurationMinutes: number;
  segments: ScriptSegment[];
  createdAt: number;
  updatedAt: number;
}

type TemplateTheme =
  | 'standup'        // 脱口秀直播
  | 'chat'           // 聊天互动
  | 'ecommerce';     // 日常带货

interface ScriptSegment {
  id: string;
  name: string;
  category: ScriptCategory;
  durationSeconds: number;
  order: number;
  transition?: string;
}

/**
 * 主脚本实例（生成后可调整）
 */
interface MainScript {
  id: string;
  sessionId: string;
  templateId: string;
  orderedScripts: OrderedScript[];
  currentIndex: number;
  status: 'generated' | 'in_progress' | 'completed';
  generatedAt: number;
}

interface OrderedScript {
  order: number;
  script: Script;
  segmentId: string;
  segmentName: string;
  expectedTime?: number;
}

/**
 * 弹幕窗口抓取配置
 */
interface DanmuCaptureConfig {
  enabled: boolean;
  windowTitle: string;              // 窗口标题（用户选择后保存）
  captureIntervalMs: number;        // 抓取频率，默认 2000ms（可配置 2000/5000）
  useOCR: boolean;                  // 是否启用 OCR 兜底
  ocrEngine: 'tesseract' | 'cloud'; // OCR 引擎选择
}

interface DanmuCaptureWindow {
  id: string;
  title: string;                    // 窗口标题
  processName: string;              // 进程名
  position?: { x: number; y: number; width: number; height: number };
  selected: boolean;
}

/**
 * 主题配置
 */
interface Theme {
  id: string;
  name: string;                    // 主题名称
  background: string;              // 背景色
  textColor: string;               // 主文字色
  accentColor: string;             // 强调色
  highlightColor: string;          // 高亮色
  cardColors: Record<ScriptCategory, string>; // 各类别卡片颜色
  isDark: boolean;                 // 是否暗色主题
}
```

### 3.5 AI 推荐

```typescript
interface AIRecommendationResult {
  danmu: Danmu;
  replies: AIReplyItem[];
  generatedAt: number;
}

interface AIReplyItem {
  order: number;
  content: string;
  confidence: number;
}

interface AIProviderConfig {
  id: string;
  name: string;
  baseURL: string;
  apiKey?: string;
  model: string;
  enabled: boolean;
  priority: number;
  timeout: number;
}
```

---

## 四、界面布局

### 4.1 直播模式 - 可拖拽布局

```
┌─────────────────────────────────────────────────────────────────┐
│ [直播模式] │ [维护模式]           直播时长 │ 00:45:23 │ ⚙️设置   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─ 主提词区域 (可拖拽调整大小/位置) ─┐  ┌─ 公屏互动区域 ─┐   │
│  │                                     │  │               │   │
│  │  超大字号显示                        │  │  实时弹幕流    │   │
│  │  自动滚动                            │  │  筛选高质量    │   │
│  │  空格暂停/继续                       │  │               │   │
│  │                                     │  │  ┌─────────┐  │   │
│  │  ┌─────────────────────────────┐    │  │ │ 👤张三: │  │   │
│  │  │ 欢迎来到直播间~             │    │  │ │ 主播真漂亮│  │   │
│  │  │ 今天给大家带来...           │    │  │ │          │  │   │
│  │  └─────────────────────────────┘    │  │ │推荐答复：│  │   │
│  │                                     │  │ │ 1.谢谢夸 │  │   │
│  │                                     │  │ │ 2.你也... │  │   │
│  │                                     │  │ │ 3.打赏... │  │   │
│  └─────────────────────────────────────┘  │  └─────────┘  │   │
│                                             └───────────────┘   │
│                                                                 │
│  ┌─ 常驻话术区域 (可拖拽调整大小/位置) ──────────────────────┐   │
│  │                                                            │   │
│  │  [1感谢] 话术A | 话术B | 话术C                              │   │
│  │  [2回击] 话术X | 话术Y | 话术Z                              │   │
│  │  [3互动] 话术P | 话术Q | 话术R                              │   │
│  │  [4拉票] ...                                               │   │
│  │                                                            │   │
│  │  快捷键: 1-9切换 │ 上下方向键预览 │ 自动轮换可配置           │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

布局保存：用户调整后的布局自动保存，重启后保持
```

### 4.2 维护模式 - 完整独立页面

**URL**: `http://localhost:5173/maintenance`（或独立 Electron 窗口）

```
┌─────────────────────────────────────────────────────────────────┐
│  [直播模式] │ [维护模式]                              维护后台  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  话术管理  │  模板编辑  │  槽位配置  │  AI配置  │  导入导出  │ │
│  ├──────────────────────────────────────────────────────────┤   │
│  │                                                          │   │
│  │  ┌─────────────────────────┐  ┌────────────────────────┐ │   │
│  │  │ 话术列表               │  │ 话术编辑器             │ │   │
│  │  │                        │  │                        │ │   │
│  │  │ [感谢类 ▼]  [标签筛选]  │  │ 内容: ┌────────────┐   │ │   │
│  │  │                        │  │        │           │   │ │   │
│  │  │ ┌──────────────────┐  │  │        └────────────┘   │ │   │
│  │  │ │ 话术1...    [编辑]│  │  │ 分类: [感谢类 ▼]       │ │   │
│  │  │ │ 话术2...    [编辑]│  │  │ 标签: [标签输入...]     │ │   │
│  │  │ │ 话术3...    [编辑]│  │  │ 优先级: [1-10]         │ │   │
│  │  │ └──────────────────┘  │  │                        │ │   │
│  │  │                        │  │ [保存] [AI改写] [删除]  │ │   │
│  │  │ [+ 新增] [批量导入]    │  └────────────────────────┘ │   │
│  │  │ [批量导出] [批量删除]  │                             │   │
│  │  └─────────────────────────┘                             │   │
│  │                                                          │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 4.3 模板编辑 - 拖拽调整

```
┌─────────────────────────────────────────────────────────────────┐
│  模板编辑                                                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  模板主题: [脱口秀直播 ▼]   模板名称: [自定义名称...]            │
│  总时长: [60] 分钟                                              │
│                                                                 │
│  ┌─ 主线脚本段落（拖拽调整顺序）─────────────────────────────┐   │
│  │                                                            │   │
│  │  ≡ 开场吸引 (开播类, 5分钟)              [编辑] [删除]    │   │
│  │  ≡ 热场互动 (互动类, 10分钟)             [编辑] [删除]    │   │
│  │  ≡ 主题内容 (脱口秀类, 30分钟)            [编辑] [删除]    │   │
│  │  ≡ 互动拉票 (互动类, 10分钟)             [编辑] [删除]    │   │
│  │  ≡ 下播告别 (闭播类, 5分钟)               [编辑] [删除]    │   │
│  │                                                            │   │
│  │  [+ 添加段落]  [AI批量生成段落内容]                         │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                 │
│  段落编辑弹窗:                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ 段落名称: [开场吸引]                                        │ │
│  │ 分类: [开播类 ▼]                                            │ │
│  │ 时长: [5] 分钟                                              │ │
│  │ 过渡语: [下一话题...]                                       │ │
│  │                                                            │ │
│  │ 预期话术: (自动从话术库选取，可手动调整)                      │ │
│  │ ┌────────────────────────────────────────────────────────┐ │ │
│  │ │ 话术1...                                    [移除]      │ │ │
│  │ │ 话术2...                                    [移除]      │ │ │
│  │ │ [+ 添加话术]                                         │ │ │
│  │ └────────────────────────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 4.4 导入功能 - 支持 text/md

```
┌─────────────────────────────────────────────────────────────────┐
│  导入话术                                                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  导入来源:                                                       │
│  ○ JSON 文件                                                     │
│  ○ Excel 文件 (.xlsx)                                           │
│  ● 纯文本 / Markdown (自动格式转换)                              │
│                                                                 │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ 请粘贴话术内容...                                           │ │
│  │                                                            │ │
│  │ # 感谢类                                                    │ │
│  │ 感谢大哥送来的火箭！                                        │ │
│  │ 谢谢老板的礼物~                                            │ │
│  │                                                            │ │
│  │ # 回击类                                                    │ │
│  │ 来啊，有本事当面说！                                        │ │
│  │                                                            │ │
│  │ # 互动类                                                    │ │
│  │ 觉得主播好看的扣111                                        │ │
│  │                                                            │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  解析预览:                                                       │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ 发现 3 个分类，共 5 条话术                                  │ │
│  │                                                            │ │
│  │ [感谢类] 2条  ✓                                             │ │
│  │ [回击类] 1条  ✓                                             │ │
│  │ [互动类] 2条  ✓                                             │ │
│  │                                                            │ │
│  │ 注意：无法识别的内容将标记为 [未分类]                        │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  [开始导入]  [取消]                                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

LLM 自动识别分类和标签，用户确认后入库
```

---

## 五、AI 推荐机制

### 5.1 公屏弹幕处理

```
多条弹幕到达
       │
       ▼
┌──────────────────┐
│ AI智能筛选弹幕   │ ← 数量/质量/内容综合筛选
│ (非每条都回复)   │   忽略低质量弹幕
└────────┬─────────┘
         │
    响应时间足够？      → 否 → 从筛选结果选最优质1条弹幕
         │
        是
         │
         ▼
┌──────────────────┐
│ 生成一组话术      │ ← AI根据内容自行决定数量
│ (有逻辑先后顺序)  │   合理范围内（约1-5条）
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ 话术存入话术库   │ ← 新生成的话术自动入库
│ (标记为待审核)   │   需在维护模式审核后才可正式使用
└────────┬─────────┘
         │
         ▼
      展示推荐答复（仅展示，不做其他操作）
```

### 5.2 AI 推荐展示格式

```
┌─────────────────────────────────────┐
│ 👤 张三: 主播真漂亮                   │
│                                     │
│ 推荐答复：                           │
│ 1. 谢谢夸奖~你也很有眼光嘛           │
│ 2. 漂亮的人有漂亮的心               │
│ 3. 直播间的打赏的都漂亮              │
│                                     │
│ (话术已自动存入话术库，待审核)       │
└─────────────────────────────────────┘
```

### 5.3 关键词检索话术（快速存入库）

```
弹幕: "主播讲得太好了"
       │
       ▼
┌──────────────────┐
│ 关键词检索话术库  │ ← 根据弹幕内容匹配相似话术
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ 检索结果存入待选  │ ← 主播可选择使用或忽略
└──────────────────┘
```

---

## 六、核心流程

### 6.1 开播流程

```
开播
  │
  ▼
┌──────────────────┐
│ 选择模板主题    │ ← 脱口秀直播 / 聊天互动 / 日常带货
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ 选择/创建模板    │ ← 使用预设模板或自定义模板
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ 选择展示配置    │ ← 槽位映射关系
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ 生成主线脚本    │ ← 按模板顺序生成话术列表
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ 手动调整脚本    │ ← 可拖拽调整顺序、删除、新增
└────────┬─────────┘
         │
         ▼
      开始直播
```

### 6.3 弹幕抓取流程

```
用户选择弹幕窗口（按窗口标题匹配）
        │
        ▼
┌──────────────────┐
│ 定时抓取弹幕      │ ← 可配置 2s / 5s 间隔
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ 尝试DOM注入读取   │ ← 优先使用 DOM 分析获取文字
│ (WebView/嵌入式)  │
└────────┬─────────┘
         │
    DOM读取失败？
         │
        是            否
         │             │
         ▼             ▼
┌─────────────┐  ┌─────────────┐
│ OCR兜底识别 │  │  弹幕解析   │
│ (Tesseract) │  │  去重处理   │
└──────┬──────┘  └──────┬──────┘
       │               │
       └───────┬───────┘
               │
               ▼
        ┌─────────────┐
        │ 弹幕数据传输 │ → 公屏互动区展示
        │ 给主进程     │ → AI推荐生成
        └─────────────┘
```

### 6.4 主脚本播放流程

```
主线脚本加载
        │
        ▼
┌──────────────────┐
│ 自动滚动播放      │ ← 按预计时间自动翻页
│ (可配置速度)      │
└────────┬─────────┘
         │
    用户操作？
         │
    ┌────┴────┐
    │         │
  空格       ↑↓
    │         │
    ▼         ▼
 暂停/继续  手动翻页
```

```
按快捷键 (如 '1')
      │
      ▼
┌─────────────────┐
│ 主进程捕获热键  │
└────────┬────────┘
         │ IPC
         ▼
┌─────────────────┐
│ 过滤去重        │
│ 返回下一句      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 更新话术显示    │
│ (无动画 ≤50ms)  │
└─────────────────┘
```

---

## 七、存储方案

### 7.1 技术选型

| 需求 | 方案 |
|------|------|
| **结构化数据** | SQLite + better-sqlite3 |
| **全文检索** | SQLite FTS5 (Full-Text Search) |
| **向量特征** | SQLite Vec 或 sql.js 向量扩展 |
| **配置存储** | JSON 文件 (display profile 等) |

### 7.2 存储结构

```
wordshot/
├── data/
│   ├── wordshot.db          # SQLite 数据库
│   │   ├── scripts          # 话术表
│   │   ├── templates        # 模板表
│   │   ├── segments         # 段落表
│   │   ├── sessions         # 场次表
│   │   ├── usage_history    # 使用记录表
│   │   └── pending_scripts  # 待审核话术表（AI生成）
│   │   └── scripts_fts      # FTS5 全文检索表
│   ├── vectors.db           # 向量特征库
│   └── config/
│       ├── display_profiles.json   # 展示配置（槽位映射）
│       ├── ai_providers.json        # AI 配置
│       ├── danmu_capture.json       # 弹幕抓取配置（窗口标题、频率等）
│       ├── hotkeys.json            # 快捷键配置
│       ├── layout.json             # 布局位置/大小配置
│       ├── themes.json              # 主题配置
│       └── main_script_progress.json # 主脚本播放进度
└── logs/
```

### 7.3 向量检索设计

```typescript
// 话术入库时提取向量特征
interface ScriptVector {
  scriptId: string;
  content: string;
  embedding: number[];  // 向量特征
}

// 相似话术检索
interface SimilarScriptRequest {
  content: string;      // 待检索内容
  topK: number;         // 返回 Top K 相似
  threshold: number;     // 相似度阈值
}
```

---

## 八、技术选型

| 模块 | 选型 | 理由 |
|------|------|------|
| **桌面框架** | Electron 28+ | 全局热键、托盘、窗口管理成熟 |
| **前端框架** | React 18 + TypeScript | 组件化、类型安全 |
| **状态管理** | Zustand | 轻量、TypeScript 支持 |
| **路由** | React Router | 直播模式/维护模式独立路由 |
| **AI 集成** | 多 Provider | baseURL + apiKey + model |
| **存储** | SQLite (better-sqlite3) | 响应快、支持 FTS5/向量 |
| **热键** | electron-globalShortcut | 主进程级别 |
| **拖拽布局** | react-grid-layout | 拖拽调整位置/大小 |
| **打包** | electron-builder | 成熟、自动更新 |
| **窗口操作** | nut-js | 跨平台窗口/屏幕控制 |
| **OCR识别** | Tesseract.js (本地) | 免费、本地运行 |
| **主题** | CSS Variables + 预设主题 | 多套主题快速切换 |
| **弹幕抓取** | 窗口DOM注入 + OCR兜底 | 适配弹幕窗口 |

---

## 九、项目结构

```
wordshot/
├── package.json
├── electron/
│   ├── main.ts
│   ├── preload.ts
│   ├── ipc/
│   │   ├── handlers.ts
│   │   └── channels.ts
│   └── services/
│       ├── HotkeyManager.ts
│       ├── TrayManager.ts
│       └── WindowManager.ts
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── routes/
│   │   ├── LiveView.tsx          # 直播模式
│   │   └── Maintenance.tsx       # 维护模式
│   ├── components/
│   │   ├── layout/
│   │   │   ├── DraggablePanel.tsx    # 可拖拽面板
│   │   │   ├── ScriptView.tsx         # 主提词区域
│   │   │   ├── AmmoZone.tsx          # 常驻话术区
│   │   │   ├── DanmuPanel.tsx         # 公屏互动区
│   │   │   ├── ShortcutHelp.tsx       # 快捷键帮助弹窗
│   │   │   └── ThemeProvider.tsx       # 主题切换
│   │   └── maintenance/
│   │       ├── ScriptManagement.tsx     # 话术管理
│   │       ├── TemplateEditor.tsx      # 模板编辑
│   │       ├── DisplayConfig.tsx       # 槽位配置
│   │       ├── DanmuCaptureConfig.tsx  # 弹幕抓取配置
│   │       ├── ImportExport.tsx        # 导入导出
│   │       ├── AIConfig.tsx            # AI配置
│   │       ├── ThemeConfig.tsx         # 主题配置
│   │       └── Settings.tsx            # 系统设置
│   ├── stores/
│   │   ├── scriptStore.ts
│   │   ├── ammoStore.ts
│   │   ├── danmuStore.ts
│   │   ├── displayStore.ts
│   │   ├── layoutStore.ts
│   │   └── themeStore.ts
│   ├── services/
│   │   ├── ScriptEngine.ts
│   │   ├── AIRecommendationEngine.ts
│   │   ├── AIManager.ts
│   │   ├── DanmuCaptureService.ts     # 窗口弹幕抓取
│   │   └── ImportParser.ts            # 导入解析
│   └── types/
│       └── index.ts
├── resources/
│   └── icon.png
└── docs/
    └── architecture.md
```

---

## 十、验收标准

| 编号 | 功能点 | 验收条件 |
|------|--------|----------|
| A1 | 全局热键 | 最小化状态下，1-9 能切换话术 |
| A2 | 热键响应 | 热键触发到 UI 更新 ≤ 50ms |
| A3 | 拖拽布局 | 三个区域位置/大小可调整，自动保存 |
| A4 | 公屏筛选 | 非每条弹幕都回复，智能筛选 |
| A5 | AI推荐生成 | 生成一组有顺序的话术，存入话术库 |
| A6 | 模板编辑 | 拖拽调整顺序、删除、新增话术 |
| A7 | 导入解析 | 支持 text/md 格式，LLM 转换 |
| A8 | 数据持久化 | 话术、模板、配置、布局不丢失 |
| A9 | 向量检索 | 支持相似话术检索 |
| A10 | 话术入库 | AI生成话术后自动存入待审核库 |

---

## 十一、风险与对策

| 风险 | 影响 | 对策 |
|------|------|------|
| 热键冲突 | 与直播软件冲突 | 自定义热键配置 + 冲突检测 |
| AI响应慢 | 推荐延迟 | 缓存优先、异步生成、筛选弹幕 |
| 话术重复 | 短时间内重复 | 可配置去重时间窗口 |
| 直播伴侣遮挡 | 提词器被遮挡 | 置顶 + 透明度调节 |
| 导入格式多样 | 解析失败 | LLM 辅助解析，支持 text/md |

---

## 十二、确认事项

以下问题已在本轮讨论中确认：

| 问题 | 确认结论 |
|------|----------|
| 维护模式入口 | 独立完整页面，非弹窗 |
| 模板主题 | 脱口秀直播、聊天互动、日常带货 |
| 导入格式 | 支持 text/md，LLM 转换格式 |
| 存储方案 | SQLite + FTS5 + 向量扩展 |
| 主线脚本调整 | 可拖拽顺序、删除、修改、新增 |
| 布局调整 | 三区域都支持拖拽调整位置/大小 |
| AI推荐话术用途 | 不直接使用，存入话术库待审核 |
| AI推荐格式 | 👤用户名:弹幕内容 → 推荐答复: 1.2.3.列表展示 |
| 脚本环节匹配弹药卡 | 不需要，已移除 |
| AI推荐一键填充弹药带 | 不需要，已移除 |

---

> 文档状态：v3.0，整合所有已确认需求
> 下一步：技术方案评审 → 任务拆分 → 开发排期