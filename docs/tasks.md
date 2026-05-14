# 直播话术提词器｜开发任务清单

> 版本：v1.0
> 日期：2026-05-12
> 状态：已完成

---

## 任务总览

| 总任务数 | 完成 | 进行中 | 待开始 |
|----------|------|--------|--------|
| 20 | 20 | 0 | 0 |

---

## 阶段一：基础设施

### #1 项目脚手架初始化 ✅ 已完成

- **描述**：Electron + React + TypeScript 项目初始化，配置 electron-builder、vite、路径别名等
- **依赖**：无
- **交付物**：package.json、vite.config.ts、electron/ 目录结构、src/ 基础结构

### #10 Zustand 状态管理 ✅ 已完成

- **描述**：创建 6 个 Zustand stores：scriptStore、ammoStore、danmuStore、displayStore、layoutStore、themeStore
- **依赖**：无
- **交付物**：src/stores/ 目录下的 store 文件

---

## 阶段二：核心功能

### #3 数据库设计与存储层 ✅ 已完成

- **描述**：设计 SQLite 数据库 schema：话术表、模板表、段落表、场次表、使用记录表、待审核话术表、FTS5 全文检索
- **依赖**：#1 项目脚手架, #10 Zustand 状态管理
- **交付物**：src/services/database.ts、数据库初始化脚本

---

### #7 全局热键系统 ✅ 已完成

- **描述**：实现主进程热键管理，支持 1-9 切换话术、↑↓预览、空格暂停、?帮助等全局快捷键，最小化状态下也能响应
- **依赖**：#1 项目脚手架, #10 Zustand 状态管理
- **交付物**：electron/services/HotkeyManager.ts

### #9 主提词区域 ScriptView ✅ 已完成

- **描述**：中央主提词区：超大字号显示、自动滚动播放、空格暂停/继续、上下键手动翻页、滚轮调速
- **依赖**：#1 项目脚手架, #10 Zustand 状态管理
- **交付物**：src/components/layout/ScriptView.tsx

### #5 话术弹药带 AmmoZone ✅ 已完成

- **描述**：底部9个话术分类弹药带：彩色卡片区分、快捷键1-9切换、自动轮换下一句、触发高亮闪烁、用完自动从话术库补充
- **依赖**：#1 项目脚手架, #10 Zustand 状态管理
- **交付物**：src/components/layout/AmmoZone.tsx

### #6 拖拽布局系统 ✅ 已完成

- **描述**：三区域可拖拽布局：使用 react-grid-layout 实现 ScriptView、AmmoZone、DanmuPanel 的位置/大小调整，自动保存布局配置
- **依赖**：#1 项目脚手架, #10 Zustand 状态管理
- **交付物**：src/components/layout/DraggablePanel.tsx、layoutStore.ts

### #2 直播模式 LiveView ✅ 已完成

- **描述**：直播模式主页面：整合 ScriptView + AmmoZone + DanmuPanel，顶部状态栏，模式切换入口
- **依赖**：#9 主提词区域, #5 话术弹药带, #4 拖拽布局, #6 公屏互动区
- **交付物**：src/routes/LiveView.tsx

### #4 公屏互动区 DanmuPanel ✅ 已完成

- **描述**：右侧公屏弹幕区：实时弹幕流、AI高亮优质/风险弹幕、推荐答复列表展示、存入话术库（待审核）
- **依赖**：#1 项目脚手架, #10 Zustand 状态管理
- **交付物**：src/components/layout/DanmuPanel.tsx

---

## 阶段三：维护模式

### #8 维护模式 - 话术管理 ✅ 已完成

- **描述**：话术管理页面：话术增删改查、分类筛选、标签管理、AI改写、AI批量新增、待审核话术管理
- **依赖**：#2 直播模式
- **交付物**：src/components/maintenance/ScriptManagement.tsx

### #20 维护模式 - 模板编辑 ✅ 已完成

- **描述**：模板编辑页面：拖拽调整段落顺序、删除/新增段落、段落分类/时长/过渡语配置、预期话术关联
- **依赖**：#2 直播模式
- **交付物**：src/components/maintenance/TemplateEditor.tsx

### #15 维护模式 - 槽位配置 ✅ 已完成

- **描述**：槽位配置页面：9个槽位与分类的映射关系、预设方案管理、快捷键绑定
- **依赖**：#2 直播模式
- **交付物**：src/components/maintenance/DisplayConfig.tsx

### #13 维护模式 - AI配置 ✅ 已完成

- **描述**：AI配置页面：多Provider支持（baseURL + apiKey + model + 优先级）、启用/禁用切换、超时配置
- **依赖**：#2 直播模式
- **交付物**：src/components/maintenance/AIConfig.tsx

### #12 维护模式 - 弹幕抓取配置 ✅ 已完成

- **描述**：弹幕抓取配置：窗口选择（按标题匹配）、抓取频率（2s/5s）、OCR设置（启用/引擎选择）
- **依赖**：#2 直播模式
- **交付物**：src/components/maintenance/DanmuCaptureConfig.tsx

### #18 维护模式 - 主题配置 ✅ 已完成

- **描述**：主题配置页面：多套主题管理（背景色、文字色、强调色、卡片颜色等）、预览、切换
- **依赖**：#2 直播模式
- **交付物**：src/components/maintenance/ThemeConfig.tsx

### #19 维护模式 - 系统设置 ✅ 已完成

- **描述**：系统设置页面：热键自定义、布局透明度调节、去重时间窗口配置
- **依赖**：#2 直播模式
- **交付物**：src/components/maintenance/Settings.tsx

### #16 维护模式 - 导入导出 ✅ 已完成

- **描述**：导入导出功能：text/md格式解析、LLM辅助识别分类标签、JSON/Excel导入、批量导出
- **依赖**：#2 直播模式
- **交付物**：src/components/maintenance/ImportExport.tsx

---

## 阶段四：高级功能

### #17 开播流程与主脚本生成 ✅ 已完成

- **描述**：开播流程：模板选择→场次创建→主脚本生成→话术去重检查→开始直播
- **依赖**：#2 直播模式
- **交付物**：src/services/ScriptEngine.ts、开播引导流程

### #11 AI推荐引擎 ✅ 已完成

- **描述**：AI推荐引擎：话术库检索优先、缓存策略、LLM生成（异步）、结果存入待审核库
- **依赖**：#1 项目脚手架, #3 数据库设计与存储层
- **交付物**：src/services/AIRecommendationEngine.ts、src/services/AIManager.ts

### #14 窗口弹幕抓取服务 ✅ 已完成

- **描述**：窗口弹幕抓取：DOM注入读取、OCR兜底（Tesseract.js）、弹幕解析、去重、传输到渲染进程
- **依赖**：#1 项目脚手架
- **交付物**：src/services/DanmuCaptureService.ts

---

## 任务依赖图

```
阶段一（无依赖，可并行）
├── #1 项目脚手架 ✅
└── #10 Zustand 状态管理 ✅

         │
         ▼
阶段二（依赖阶段一）
├── #3 数据库设计与存储层
├── #7 全局热键系统
├── #9 主提词区域 ScriptView
├── #5 话术弹药带 AmmoZone
├── #6 拖拽布局系统
└── #4 公屏互动区 DanmuPanel
         │
         ▼
阶段三（依赖阶段二核心功能完成）
└── #2 直播模式 LiveView
         │
         ▼
维护模式（依赖 #2）
├── #8 话术管理
├── #20 模板编辑
├── #15 槽位配置
├── #13 AI配置
├── #12 弹幕抓取配置
├── #18 主题配置
├── #19 系统设置
└── #16 导入导出

阶段四（依赖阶段一/三部分任务）
├── #17 开播流程与主脚本生成（依赖 #2）
├── #11 AI推荐引擎（依赖 #1, #3）
└── #14 窗口弹幕抓取服务（依赖 #1）
```

---

## 验收标准

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

> 最后更新：2026-05-12
> 文档状态：v1.0 已完成所有 20 个开发任务