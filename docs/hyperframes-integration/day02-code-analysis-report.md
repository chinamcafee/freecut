# FreeCut 代码架构深度分析报告

**分析日期**: 2026-07-06  
**目标**: 为 HyperFrames 整合提供详细的代码架构分析和切入点建议

---

## 目录

1. [项目整体架构概述](#项目整体架构概述)
2. [核心类型系统](#核心类型系统)
3. [功能模块分析](#功能模块分析)
4. [运行时架构](#运行时架构)
5. [基础设施层](#基础设施层)
6. [关键流程追踪](#关键流程追踪)
7. [状态管理方案](#状态管理方案)
8. [HyperFrames 整合建议](#hyperframes-整合建议)

---

## 1. 项目整体架构概述

### 1.1 架构分层

FreeCut 采用清晰的分层架构，从上到下分为：

```
┌─────────────────────────────────────────┐
│           Features Layer                │  ← 功能模块层
│  (timeline, editor, export, preview等)  │
├─────────────────────────────────────────┤
│           Runtime Layer                 │  ← 运行时层
│  (composition-runtime, player)          │
├─────────────────────────────────────────┤
│        Infrastructure Layer             │  ← 基础设施层
│  (GPU, Storage, Browser, Audio等)       │
├─────────────────────────────────────────┤
│           Shared Layer                  │  ← 共享层
│  (State, Utils, Types, Components)      │
└─────────────────────────────────────────┘
```

### 1.2 核心技术栈

- **状态管理**: Zustand (轻量级、无样板代码)
- **UI框架**: React + TypeScript
- **路由**: TanStack Router
- **GPU渲染**: WebGPU (通过自研pipeline)
- **存储**: IndexedDB + File System Access API (OPFS)
- **视频处理**: MediaBunny (自研视频编解码库)
- **音频处理**: Web Audio API

### 1.3 目录结构

```
src/
├── features/           # 13个功能模块
│   ├── timeline/       # 时间线编辑核心
│   ├── editor/         # 编辑器UI和布局
│   ├── export/         # 导出渲染引擎
│   ├── preview/        # 预览播放器
│   ├── media-library/  # 媒体资源管理
│   ├── projects/       # 项目管理
│   ├── effects/        # 效果面板
│   ├── keyframes/      # 关键帧动画
│   ├── scene-browser/  # 场景浏览器
│   ├── project-bundle/ # 项目打包
│   ├── settings/       # 设置
│   ├── docs/           # 文档系统
│   └── workspace-gate/ # 工作区初始化
├── runtime/            # 运行时引擎
│   ├── composition-runtime/  # Composition渲染核心
│   └── player/               # 播放器组件
├── infrastructure/     # 基础设施
│   ├── gpu-compositor/      # GPU合成器
│   ├── gpu-effects/         # GPU效果系统
│   ├── gpu-masks/           # GPU遮罩
│   ├── gpu-shapes/          # GPU形状渲染
│   ├── gpu-text/            # GPU文本渲染
│   ├── gpu-transitions/     # GPU转场效果
│   ├── storage/             # 存储抽象层
│   ├── audio/               # 音频处理
│   └── browser/             # 浏览器API封装
├── shared/             # 共享代码
│   ├── state/          # Zustand状态管理
│   ├── utils/          # 工具函数
│   └── components/     # 共享组件
└── types/              # TypeScript类型定义
```

---

## 2. 核心类型系统

### 2.1 Project Schema

**文件位置**: `/src/types/project.ts`

```typescript
interface Project {
  id: string
  name: string
  description: string
  createdAt: number
  updatedAt: number
  duration: number
  schemaVersion?: number          // 用于数据迁移
  thumbnailId?: string            // 缩略图引用
  metadata: ProjectResolution     // 分辨率、帧率等
  timeline?: ProjectTimeline      // 时间线数据
  rootFolderHandle?: FileSystemDirectoryHandle  // 媒体根目录
  rootFolderName?: string
}

interface ProjectResolution {
  width: number
  height: number
  fps: number
  backgroundColor?: string
}
```

**核心特性**:
- Schema版本控制，支持数据迁移
- 使用File System Access API关联媒体文件夹
- Timeline数据可选，支持延迟加载

### 2.2 Timeline Schema

**文件位置**: `/src/types/timeline.ts`

```typescript
interface ProjectTimeline {
  masterBusDb?: number           // 主音频总线增益
  tracks: Array<{
    id: string
    name: string
    kind?: 'video' | 'audio'
    height: number
    locked: boolean
    syncLock?: boolean           // 同步锁（Ripple编辑）
    visible: boolean
    muted: boolean
    solo: boolean
    volume?: number
    audioEq?: AudioEqSettings
    color?: string
    order: number
    parentTrackId?: string       // 轨道分组
    isGroup?: boolean
    isCollapsed?: boolean
  }>
  items: TimelineItem[]          // 所有片段
  transitions?: Transition[]     // 转场效果
  compositions?: SubComposition[] // 预合成
  keyframes?: ItemKeyframes[]    // 关键帧动画
  markers?: ProjectMarker[]      // 标记点
  inPoint?: number               // 入点
  outPoint?: number              // 出点
  currentFrame?: number          // 当前帧
  zoomLevel?: number
  scrollPosition?: number
}
```

**关键设计**:
- **判别联合类型**: TimelineItem是一个discriminated union
- **轨道分组**: 支持parentTrackId实现轨道嵌套
- **同步锁**: syncLock控制Ripple编辑传播

### 2.3 TimelineItem 判别联合

```typescript
type TimelineItem =
  | VideoItem
  | AudioItem
  | TextItem
  | ImageItem
  | ShapeItem
  | AdjustmentItem
  | CompositionItem
  | SubtitleSegmentItem

// 基础类型
type BaseTimelineItem = {
  id: string
  trackId: string
  from: number                   // 起始帧
  durationInFrames: number       // 持续帧数
  label: string
  mediaId?: string
  compositionId?: string
  originId?: string              // 用于追踪拆分来源
  linkedGroupId?: string         // 链接的视音频对
  
  // 媒体trim属性
  sourceStart?: number
  sourceEnd?: number
  sourceDuration?: number
  sourceFps?: number
  speed?: number                 // 速度调整 (0.1-10.0)
  isReversed?: boolean          // 倒放
  
  // 变换属性
  transform?: TransformProperties
  crop?: CropSettings
  
  // 音频属性
  volume?: number
  audioFadeIn?: number
  audioFadeOut?: number
  audioPitchSemitones?: number
  // ... 完整的EQ设置
  
  // 视频属性
  fadeIn?: number
  fadeOut?: number
  
  // 高级功能
  effects?: ItemEffect[]         // GPU效果栈
  motionModifiers?: MotionModifier[]  // 程序化运动
  blendMode?: BlendMode          // 混合模式
  cornerPin?: TimelineItemCornerPin   // 四角定位
}
```

### 2.4 Export Schema

**文件位置**: `/src/types/export.ts`

```typescript
interface ExtendedExportSettings {
  mode: 'video' | 'audio'
  codec: 'h264' | 'h265' | 'vp8' | 'vp9' | 'av1' | 'prores'
  quality: 'low' | 'medium' | 'high' | 'ultra'
  resolution: { width: number; height: number }
  videoContainer?: 'mp4' | 'mov' | 'webm' | 'mkv'
  audioContainer?: 'mp3' | 'aac' | 'wav'
  subtitleMode?: 'off' | 'burn' | 'sidecar' | 'embedded'
  renderWholeProject?: boolean
  bitrate?: string
  audioBitrate?: string
  proResProfile?: 'proxy' | 'light' | 'standard' | 'hq' | '4444' | '4444-xq'
}

interface CompositionInputProps {
  fps: number
  durationInFrames?: number
  width?: number
  height?: number
  tracks: TimelineTrack[]
  transitions?: Transition[]
  backgroundColor?: string
  keyframes?: ItemKeyframes[]
  busAudioEq?: AudioEqSettings
  masterBusDb?: number
}
```

**关键点**:
- 支持多种编码器和容器格式
- 字幕导出模式（硬字幕、软字幕、外挂）
- CompositionInputProps是渲染引擎的输入接口

---

## 3. 功能模块详细分析

### 3.1 Timeline 模块（核心）

**位置**: `/src/features/timeline/`

#### 3.1.1 架构设计

Timeline模块是整个编辑器的核心，采用了**领域驱动设计**（Domain-Driven Design）的Store拆分架构：

```
timeline/stores/
├── timeline-store.ts              # 导出facade（向后兼容）
├── timeline-store-facade.ts       # 统一访问接口
├── timeline-actions.ts            # 跨领域操作
├── items-store.ts                 # 片段管理（33KB）
├── transitions-store.ts           # 转场管理
├── keyframes-store.ts             # 关键帧动画
├── markers-store.ts               # 标记点和入出点
├── timeline-settings-store.ts     # FPS、对齐、滚动设置
├── timeline-command-store.ts      # Undo/Redo命令历史
├── compositions-store.ts          # 预合成管理
└── actions/                       # 领域操作
    ├── item-actions.ts
    ├── track-actions.ts
    ├── transform-actions.ts
    ├── effect-actions.ts
    ├── transition-actions.ts
    ├── keyframe-actions.ts
    └── composition-actions.ts
```

#### 3.1.2 关键特性

**1. 领域Store拆分**

每个Store管理一个独立的领域：
- `items-store`: 管理所有片段和轨道，提供索引加速查询
- `transitions-store`: 管理转场，自动维护左右片段引用
- `keyframes-store`: 管理动画，按itemId和property组织

**2. Action系统**

```typescript
// 文件: timeline-actions.ts
export * from './actions/track-actions'
export * from './actions/item-actions'
export * from './actions/transform-actions'
export * from './actions/effect-actions'
export * from './actions/transition-actions'
export * from './actions/keyframe-actions'
```

跨领域操作必须通过Actions，单领域操作可以直接调用Store：

```typescript
// 跨领域操作（涉及items + transitions + keyframes）
export function removeItems(itemIds: string[]): void {
  execute('REMOVE_ITEMS', () => {
    // 1. 删除关键帧
    useKeyframesStore.getState().removeItemKeyframes(itemIds)
    // 2. 删除关联的转场
    useTransitionsStore.getState().removeTransitionsForItems(itemIds)
    // 3. 删除片段
    useItemsStore.getState()._removeItems(itemIds)
    // 4. 标记脏状态
    useTimelineSettingsStore.getState().markDirty()
  }, { count: itemIds.length })
}
```

**3. Undo/Redo系统**

使用`timeline-command-store`实现命令模式：

```typescript
function execute(
  type: string,
  forward: () => void,
  metadata?: Record<string, any>
): void {
  const before = captureState()
  forward()
  const after = captureState()
  pushCommand({ type, before, after, metadata })
}
```

#### 3.1.3 关键API

```typescript
// Items Store
interface ItemsStore {
  tracks: TimelineTrack[]
  items: TimelineItem[]
  _addItem(item: TimelineItem): void
  _updateItem(id: string, updates: Partial<TimelineItem>): void
  _removeItems(ids: string[]): void
  getItemById(id: string): TimelineItem | undefined
  getItemsByTrackId(trackId: string): TimelineItem[]
  getTrackById(id: string): TimelineTrack | undefined
}

// Keyframes Store
interface KeyframesStore {
  keyframes: ItemKeyframes[]
  addKeyframe(itemId: string, property: AnimatableProperty, frame: number, value: number): void
  updateKeyframe(itemId: string, property: AnimatableProperty, keyframeId: string, updates: Partial<Keyframe>): void
  removeKeyframe(itemId: string, property: AnimatableProperty, keyframeId: string): void
  getItemKeyframes(itemId: string): ItemKeyframes | undefined
}

// Transitions Store
interface TransitionsStore {
  transitions: Transition[]
  addTransition(transition: Transition): void
  removeTransition(id: string): void
  getTransitionBetween(leftClipId: string, rightClipId: string): Transition | undefined
}
```

#### 3.1.4 扩展点（HyperFrames相关）

1. **Item类型扩展**: 在`TimelineItem`判别联合中添加新类型
2. **Effect系统**: 通过`effects?: ItemEffect[]`插入自定义GPU效果
3. **Transform扩展**: `transform`对象可添加自定义属性
4. **Action扩展**: 在`actions/`下添加新的领域操作

---

### 3.2 Export 模块（渲染引擎）

**位置**: `/src/features/export/`

#### 3.2.1 架构概览

```
export/
├── stores/
│   └── render-queue-store.ts     # 渲染队列管理
├── utils/
│   ├── client-render-engine.ts   # 核心渲染引擎工厂
│   ├── canvas-render-orchestrator.ts  # 渲染编排器
│   ├── canvas-item-renderer.ts   # 单item渲染器
│   ├── gpu-pipeline-manager.ts   # GPU管线管理器
│   ├── frame-compositing.ts      # 帧合成
│   ├── canvas-effects.ts         # 效果应用
│   ├── canvas-masks.ts           # 遮罩处理
│   ├── canvas-transitions.ts     # 转场渲染
│   └── shared-video-extractor.ts # 视频帧提取池
└── workers/
    └── render-worker.ts          # Web Worker渲染
```

#### 3.2.2 渲染引擎核心

**createCompositionRenderer** - 渲染引擎工厂

```typescript
// 文件: client-render-engine.ts
export async function createCompositionRenderer(
  composition: CompositionInputProps,
  canvas: OffscreenCanvas,
  ctx: OffscreenCanvasRenderingContext2D,
  options: {
    mode?: 'export' | 'preview'
    getPreviewTransformOverride?: (itemId: string) => Partial<ResolvedTransform>
    getPreviewEffectsOverride?: (itemId: string) => ItemEffect[]
    domVideoElementProvider?: (itemId: string) => HTMLVideoElement | null
    useProxyMedia?: boolean
  }
) {
  // 返回渲染器对象
  return {
    renderFrame: async (frame: number) => { /* ... */ },
    cleanup: () => { /* ... */ }
  }
}
```

**渲染流程**:

```
1. resolveFrameRenderScene()
   ↓ 分析frame下的可见items和transforms
   
2. collectFrameVideoCandidates()
   ↓ 预加载视频帧
   
3. renderItem() - 对每个item
   ↓ 根据类型调用对应渲染器
   
4. applyEffects() - GPU效果
   ↓ 使用GpuPipelineManager
   
5. compositeFrameResults()
   ↓ 合成所有layers到canvas
   
6. 返回渲染结果
```

#### 3.2.3 GPU Pipeline集成

```typescript
// GPU效果应用
class GpuPipelineManager {
  async applyEffects(
    sourceCanvas: OffscreenCanvas,
    effects: ItemEffect[],
    outputCanvas: OffscreenCanvas
  ): Promise<void> {
    // 使用WebGPU渲染效果链
  }
}
```

#### 3.2.4 渲染队列

```typescript
// render-queue-store.ts
interface RenderJob {
  id: string
  name: string
  status: 'queued' | 'rendering' | 'completed' | 'failed'
  progress: number
  snapshot: RenderJobSnapshot  // 冻结的timeline快照
  clientSettings: ClientExportSettings
  fileName: string
  savedPath?: string
}

interface RenderQueueStore {
  jobs: RenderJob[]
  enqueueJobs(jobs: RenderJob[]): void
  cancelJob(id: string): void
  retryJob(id: string): void
}
```

**关键特性**:
- 串行渲染（WebGPU设备是单例）
- Timeline快照（渲染时冻结数据）
- 支持暂停/取消/重试

#### 3.2.5 扩展点（HyperFrames相关）

1. **自定义Item渲染器**: 在`canvas-item-renderer.ts`中添加新类型的渲染逻辑
2. **GPU效果注入**: 通过`ItemEffect[]`插入HyperFrames生成的效果
3. **帧级Hook**: 在`renderFrame()`中插入自定义逻辑
4. **后处理Pipeline**: 在合成后添加全局后处理

---

### 3.3 Preview 模块（预览播放器）

**位置**: `/src/features/preview/`

#### 3.3.1 核心Store

```typescript
// playback-store.ts - 播放控制
interface PlaybackStore {
  isPlaying: boolean
  currentFrame: number
  playbackRate: number
  loop: boolean
  play(): void
  pause(): void
  seekToFrame(frame: number): void
}

// gizmo-store.ts - 变换控制器
interface GizmoStore {
  selectedItemIds: string[]
  mode: 'select' | 'move' | 'rotate' | 'scale'
  showBoundingBox: boolean
  snapToGrid: boolean
}

// mask-editor-store.ts - 遮罩编辑器
interface MaskEditorStore {
  isActive: boolean
  selectedVertexIndex: number | null
  editingMask: PreparedMask | null
}
```

#### 3.3.2 关键组件

- **PreviewCanvas**: WebGPU渲染画布
- **GizmoOverlay**: 可视化变换控制器（拖拽、旋转手柄）
- **MaskEditor**: 贝塞尔路径编辑器
- **ColorScopes**: 示波器（波形、矢量、直方图）

#### 3.3.3 扩展点

1. **自定义Gizmo**: 为HyperFrames添加专用控制器
2. **Overlay系统**: 在预览上叠加AI分析可视化
3. **实时效果预览**: 通过`getPreviewEffectsOverride`注入

---

### 3.4 Media Library 模块

**位置**: `/src/features/media-library/`

#### 3.4.1 核心Store

```typescript
// media-library-store.ts
interface MediaLibraryStore {
  currentProjectId: string | null
  mediaItems: MediaMetadata[]
  mediaById: Record<string, MediaMetadata>
  selectedMediaIds: string[]
  
  // 代理视频生成
  proxyStatus: Map<string, ProxyStatus>
  proxyProgress: Map<string, number>
  
  // 转录（字幕生成）
  transcriptStatus: Map<string, 'idle' | 'ready'>
  transcriptProgress: Map<string, TranscriptProgress>
  
  // AI标签
  taggingMediaIds: Set<string>
  analysisProgress: AIAnalysisProgress | null
  
  // 断链媒体检测
  brokenMediaIds: string[]
  brokenMediaInfo: Map<string, BrokenMediaInfo>
}
```

#### 3.4.2 关键服务

- **ProxyService**: 生成低分辨率预览视频
- **TranscriptService**: 基于Whisper的语音转文字
- **MediaRelinkingService**: 断链媒体重新关联

#### 3.4.3 扩展点

1. **AI分析集成**: `taggingMediaIds`可扩展为HyperFrames分析
2. **元数据扩展**: `MediaMetadata`可添加AI标签字段
3. **缩略图生成**: 可替换为AI生成的智能缩略图

---

### 3.5 Projects 模块

**位置**: `/src/features/projects/`

#### 3.5.1 核心Store

```typescript
// project-store.ts
interface ProjectStore {
  projects: Project[]
  currentProject: Project | null
  
  loadProjects(): Promise<void>
  createProject(data: ProjectFormData): Promise<Project>
  updateProject(id: string, data: Partial<ProjectFormData>): Promise<Project>
  deleteProject(id: string): Promise<void>
  duplicateProject(id: string): Promise<Project>
  
  // 媒体文件夹关联
  setProjectRootFolder(id: string, handle: FileSystemDirectoryHandle): Promise<void>
}
```

#### 3.5.2 项目创建流程

```typescript
// project-helpers.ts
export function createProjectObject(data: ProjectFormData): Project {
  return {
    id: crypto.randomUUID(),
    name: data.name,
    description: data.description || '',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    duration: 0,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    metadata: {
      width: data.width,
      height: data.height,
      fps: data.fps,
      backgroundColor: data.backgroundColor || '#000000'
    },
    timeline: {
      tracks: [
        { id: crypto.randomUUID(), name: 'Video 1', kind: 'video', height: 80, locked: false, visible: true, muted: false, solo: false, order: 0 },
        { id: crypto.randomUUID(), name: 'Audio 1', kind: 'audio', height: 60, locked: false, visible: true, muted: false, solo: false, order: 1 }
      ],
      items: [],
      currentFrame: 0,
      zoomLevel: 1,
      scrollPosition: 0
    }
  }
}
```

#### 3.5.3 扩展点

1. **项目模板**: 可添加HyperFrames预设模板
2. **元数据扩展**: Project可添加AI配置字段
3. **初始化Hook**: 在项目创建时初始化HyperFrames

---

### 3.6 Editor 模块（UI布局）

**位置**: `/src/features/editor/`

#### 3.6.1 核心Store

```typescript
// editor-store.ts
interface EditorStore {
  // 布局状态
  leftSidebarOpen: boolean
  rightSidebarOpen: boolean
  sidebarWidth: number
  rightSidebarWidth: number
  timelineHeight: number
  
  // 工作区切换
  workspace: 'edit' | 'color' | 'audio' | 'effects'
  
  // 活动面板
  activeTab: 'media' | 'effects' | 'text' | 'audio'
  clipInspectorTab: 'transform' | 'video' | 'audio' | 'effects' | 'text'
  
  // 编辑模式
  sourcePatchVideoEnabled: boolean
  sourcePatchAudioEnabled: boolean
  linkedSelectionEnabled: boolean
}
```

#### 3.6.2 工作区系统

FreeCut支持多个专用工作区：
- **Edit**: 通用编辑（默认）
- **Color**: 调色工作区
- **Audio**: 音频混音
- **Effects**: 效果设计

每个工作区有独立的布局配置，保存在localStorage。

#### 3.6.3 扩展点

1. **新增工作区**: 可添加"AI"或"HyperFrames"专用工作区
2. **自定义面板**: 在侧边栏添加HyperFrames控制面板
3. **快捷键扩展**: 通过`/src/config/hotkeys.ts`添加

---

### 3.7 Effects 模块

**位置**: `/src/features/effects/`

效果模块主要是UI层，实际渲染逻辑在`infrastructure/gpu-effects/`。

#### 3.7.1 效果面板

- 展示GPU效果库
- 拖放应用效果到片段
- 参数调整UI

#### 3.7.2 扩展点

在GPU Effects Registry中注册HyperFrames效果即可自动显示在面板中。

---

### 3.8 Keyframes 模块

**位置**: `/src/features/keyframes/`

#### 3.8.1 关键帧编辑器

- 图形化曲线编辑器
- 支持多种缓动函数（ease-in, ease-out, bezier）
- 批量编辑关键帧

#### 3.8.2 可动画属性

```typescript
type AnimatableProperty =
  | 'transform.x' | 'transform.y'
  | 'transform.rotation'
  | 'transform.scaleX' | 'transform.scaleY'
  | 'transform.opacity'
  | 'volume'
  | 'crop.top' | 'crop.bottom' | 'crop.left' | 'crop.right'
```

#### 3.8.3 扩展点

HyperFrames可以添加自定义动画属性（如AI生成的运动路径）。

---

### 3.9 其他模块简述

- **Scene Browser**: 场景检测和快速导航
- **Project Bundle**: 项目打包和导入
- **Settings**: 用户偏好设置
- **Docs**: 内置文档系统
- **Workspace Gate**: 工作区初始化和权限检查

---

## 4. 运行时架构

### 4.1 Composition Runtime

**位置**: `/src/runtime/composition-runtime/`

#### 4.1.1 核心职责

Composition Runtime是FreeCut的渲染核心，负责：
- 解析Timeline数据为渲染场景
- 计算每帧的可见元素和变换
- 管理视频解码和帧提取
- 执行GPU渲染Pipeline

#### 4.1.2 关键模块

```
composition-runtime/
├── components/          # React渲染组件
├── compositions/        # 预合成支持
├── contexts/           # React上下文
├── deps/               # 依赖注入
├── hooks/              # 渲染Hooks
├── utils/              # 工具函数
│   ├── resolve-frame-render-scene.ts    # 场景解析
│   ├── collect-frame-video-candidates.ts # 视频帧收集
│   ├── video-target-time.ts             # 时间计算
│   └── composition-render-plan.ts        # 渲染计划
└── worklets/           # Audio Worklets
```

#### 4.1.3 渲染场景解析

```typescript
// resolve-frame-render-scene.ts
export function resolveFrameRenderScene(
  frame: number,
  tracks: TimelineTrack[],
  fps: number,
  width: number,
  height: number
): FrameRenderScene {
  // 1. 过滤当前帧可见的items
  const visibleItems = tracks
    .flatMap(track => track.items)
    .filter(item => {
      const start = item.from
      const end = item.from + item.durationInFrames
      return frame >= start && frame < end
    })
  
  // 2. 计算每个item的变换矩阵
  const resolvedItems = visibleItems.map(item => ({
    ...item,
    transform: resolveTransform(item, frame, width, height),
    localFrame: frame - item.from
  }))
  
  // 3. 按z-index排序（轨道顺序 + blend mode）
  const sortedItems = sortByRenderOrder(resolvedItems, tracks)
  
  return { items: sortedItems, frame }
}
```

#### 4.1.4 视频帧提取

```typescript
// collect-frame-video-candidates.ts
export function collectFrameVideoCandidates(
  scene: FrameRenderScene,
  fps: number
): VideoFrameCandidate[] {
  return scene.items
    .filter(item => item.type === 'video')
    .map(item => ({
      itemId: item.id,
      src: item.src,
      targetTime: getVideoTargetTimeSeconds(
        item.sourceStart ?? 0,
        item.sourceFps ?? fps,
        item.localFrame,
        item.speed ?? 1,
        fps,
        item.trimStart ?? 0,
        item.isReversed ?? false
      )
    }))
}
```

#### 4.1.5 扩展点

1. **场景解析扩展**: 在`resolveFrameRenderScene`中添加AI分析逻辑
2. **Transform计算**: 可注入HyperFrames的运动预测
3. **预加载策略**: 为AI处理优化帧缓存

---

### 4.2 Player 组件

**位置**: `/src/runtime/player/`

#### 4.2.1 架构设计

```
player/
├── Player.tsx                # 主播放器组件
├── use-player.ts            # 播放控制Hook
├── event-emitter.ts         # 事件系统
├── player-layout.ts         # 布局计算
├── clock/                   # 时钟同步
│   ├── clock-bridge.ts
│   └── timeline-context.ts
├── composition/             # Composition集成
└── video/                   # 视频元素管理
```

#### 4.2.2 核心API

```typescript
// Player.tsx
interface PlayerProps {
  children: React.ReactNode
  durationInFrames: number
  fps: number
  initialFrame?: number
  loop?: boolean
  controls?: boolean
  autoPlay?: boolean
  playbackRate?: number
  width?: number
  height?: number
  onFrameChange?: (frame: number) => void
  onPlayStateChange?: (isPlaying: boolean) => void
}

interface PlayerRef {
  play(): void
  pause(): void
  toggle(): void
  seekTo(frame: number): void
  getCurrentFrame(): number
  isPlaying(): boolean
  addEventListener<E>(event: E, callback: CallbackListener<E>): void
}
```

#### 4.2.3 时钟同步

使用`requestAnimationFrame`驱动的高精度时钟：

```typescript
// use-player.ts
function usePlayer(props: PlayerProps) {
  const rafId = useRef<number>()
  const startTime = useRef<number>()
  
  const tick = useCallback((timestamp: number) => {
    if (!startTime.current) startTime.current = timestamp
    
    const elapsed = timestamp - startTime.current
    const frame = Math.floor((elapsed / 1000) * fps)
    
    if (frame >= durationInFrames) {
      if (loop) {
        startTime.current = timestamp
        setCurrentFrame(0)
      } else {
        pause()
      }
    } else {
      setCurrentFrame(frame)
      rafId.current = requestAnimationFrame(tick)
    }
  }, [fps, durationInFrames, loop])
}
```

#### 4.2.4 扩展点

1. **自定义Controls**: 替换默认播放控件
2. **事件监听**: 监听帧变化触发AI分析
3. **性能监控**: 注入帧率和渲染时间监控

---

## 5. 基础设施层分析

### 5.1 GPU Compositor（GPU合成器）

**位置**: `/src/infrastructure/gpu-compositor/`

#### 5.1.1 核心功能

GPU Compositor使用WebGPU实现高性能的图层合成，支持：
- Blend Modes（25+种混合模式）
- Transform（2D/3D变换、透视）
- Opacity（透明度）
- Mask（遮罩合成）

#### 5.1.2 Compositor Pipeline

```typescript
// compositor-pipeline.ts
export class CompositorPipeline {
  private device: GPUDevice
  private regularPipeline: GPURenderPipeline    // 常规纹理
  private externalPipeline: GPURenderPipeline   // 视频纹理（零拷贝）
  private blitPipeline: GPURenderPipeline       // 输出到canvas
  
  /**
   * 合成一个图层到base texture
   */
  async compositeLayer(
    baseTexture: GPUTexture,
    layerTexture: GPUTexture,
    outputTexture: GPUTexture,
    params: {
      opacity: number
      blendMode: BlendMode
      transform: {
        x: number, y: number
        scaleX: number, scaleY: number
        rotation: number
      }
      maskTexture?: GPUTexture
      maskInvert?: boolean
    }
  ): Promise<void>
}
```

#### 5.1.3 Ping-Pong纹理策略

```typescript
// 每层读取input，写入output，然后交换
let inputTex = baseTexture
let outputTex = tempTexture

for (const layer of layers) {
  await compositor.compositeLayer(inputTex, layer.texture, outputTex, layer.params)
  // 交换纹理
  ;[inputTex, outputTex] = [outputTex, inputTex]
}

// 最终结果在inputTex中
return inputTex
```

#### 5.1.4 Blend Modes WGSL

```wgsl
// 支持25+种混合模式
fn compositeBlendSourceOver(
  base: vec4f,
  layer: vec4f,
  sourceAlpha: f32,
  dissolveAlpha: f32,
  blendMode: u32,
  screenPos: vec2f,
  opacity: f32
) -> vec4f {
  // 根据blendMode选择不同的混合算法
  var blended: vec3f;
  switch (blendMode) {
    case 0u: { blended = layer.rgb; }  // Normal
    case 1u: { blended = layer.rgb * base.rgb; }  // Multiply
    case 2u: { blended = 1.0 - (1.0 - layer.rgb) * (1.0 - base.rgb); }  // Screen
    case 3u: { blended = overlay(base.rgb, layer.rgb); }  // Overlay
    // ... 更多模式
  }
  
  return mix(base, vec4f(blended, layer.a), sourceAlpha * dissolveAlpha);
}
```

#### 5.1.5 扩展点（HyperFrames相关）

1. **自定义Blend Mode**: 添加AI生成的混合模式
2. **3D Transform扩展**: 支持完整的3D变换矩阵
3. **实时Mask**: 集成AI分割生成的动态遮罩

---

### 5.2 GPU Effects（GPU效果系统）

**位置**: `/src/infrastructure/gpu-effects/`

#### 5.2.1 效果注册表

```typescript
// registry.ts
export const GPU_EFFECT_REGISTRY = new Map<string, GpuEffectDefinition>()

interface GpuEffectDefinition {
  id: string
  name: string
  category: 'color' | 'blur' | 'distort' | 'stylize' | 'keying'
  shader: string                    // WGSL shader代码
  entryPoint: string                // Fragment shader入口
  packUniforms: (params: Record<string, any>) => Float32Array
  params: Record<string, ParamDefinition>
}

// 注册效果
GPU_EFFECT_REGISTRY.set('blur-gaussian', {
  id: 'blur-gaussian',
  name: 'Gaussian Blur',
  category: 'blur',
  shader: GAUSSIAN_BLUR_SHADER,
  entryPoint: 'gaussianBlurFragment',
  packUniforms: (params) => new Float32Array([params.radius, params.quality]),
  params: {
    radius: { type: 'float', default: 5, min: 0, max: 100 },
    quality: { type: 'float', default: 1, min: 0.1, max: 2 }
  }
})
```

#### 5.2.2 效果Pipeline

```typescript
// effects-pipeline.ts
export class EffectsPipeline {
  async applyEffects(
    inputTexture: GPUTexture,
    effects: ItemEffect[],
    outputTexture: GPUTexture
  ): Promise<void> {
    let currentInput = inputTexture
    let currentOutput = this.tempTexture1
    
    for (let i = 0; i < effects.length; i++) {
      const effect = GPU_EFFECT_REGISTRY.get(effects[i].type)
      if (!effect) continue
      
      // 应用单个效果
      await this.applyEffect(currentInput, effect, effects[i].params, currentOutput)
      
      // 交换纹理
      ;[currentInput, currentOutput] = [currentOutput, currentInput]
    }
    
    // 拷贝最终结果到输出纹理
    this.copyTexture(currentInput, outputTexture)
  }
}
```

#### 5.2.3 现有效果类别

**Color Effects** (`effects/color.ts`):
- Brightness/Contrast
- Hue/Saturation
- Color Balance
- Curves
- Levels

**Blur Effects** (`effects/blur.ts`):
- Gaussian Blur
- Box Blur
- Radial Blur

**Distort Effects** (`effects/distort.ts`):
- Lens Distortion
- Wave
- Twist

**Stylize Effects** (`effects/stylize.ts`):
- Pixelate
- Posterize
- Edge Detection

**Keying Effects** (`effects/keying.ts`):
- Chroma Key
- Luma Key

#### 5.2.4 扩展点（HyperFrames相关）

**关键切入点**：这是HyperFrames整合的最佳位置！

1. **注册AI效果**: 将HyperFrames作为新的效果类型注册

```typescript
// 示例：注册HyperFrames效果
GPU_EFFECT_REGISTRY.set('hyperframes-style-transfer', {
  id: 'hyperframes-style-transfer',
  name: 'AI Style Transfer',
  category: 'stylize',
  shader: HYPERFRAMES_STYLE_TRANSFER_SHADER,
  entryPoint: 'styleTransferFragment',
  packUniforms: (params) => new Float32Array([
    params.strength,
    params.styleId,
    params.blendMode
  ]),
  params: {
    strength: { type: 'float', default: 1.0, min: 0, max: 1 },
    styleId: { type: 'int', default: 0, min: 0, max: 10 },
    blendMode: { type: 'int', default: 0, min: 0, max: 5 }
  }
})
```

2. **自定义Shader**: 编写WGSL shader调用HyperFrames的WebGPU compute shader
3. **参数UI**: 效果参数自动生成UI控件

---

### 5.3 GPU Media（GPU媒体处理）

**位置**: `/src/infrastructure/gpu-media/`

处理视频帧的GPU上传和格式转换，支持零拷贝视频纹理。

---

### 5.4 GPU Masks（GPU遮罩）

**位置**: `/src/infrastructure/gpu-masks/`

支持：
- 路径遮罩（贝塞尔曲线）
- 形状遮罩
- 羽化（Feather）
- 反转遮罩

**扩展点**: 集成AI分割生成的遮罩路径

---

### 5.5 GPU Text（GPU文本渲染）

**位置**: `/src/infrastructure/gpu-text/`

使用Glyph Atlas实现高性能文本渲染。

**扩展点**: 为字幕添加AI生成的动画效果

---

### 5.6 Storage（存储抽象层）

**位置**: `/src/infrastructure/storage/`

#### 5.6.1 Workspace FS

```
storage/workspace-fs/
├── workspace-store.ts        # 工作区Store
├── project-fs.ts            # 项目文件系统
├── media-fs.ts              # 媒体文件管理
├── cache-fs.ts              # 缓存管理
└── opfs-adapter.ts          # OPFS适配器
```

#### 5.6.2 核心API

```typescript
// 项目存储
export async function saveProject(project: Project): Promise<void>
export async function getProject(id: string): Promise<Project | null>
export async function getAllProjects(): Promise<Project[]>

// 媒体存储
export async function saveMedia(projectId: string, file: File): Promise<MediaMetadata>
export async function getMediaBlob(mediaId: string): Promise<Blob>

// 缓存管理
export async function getCachedFrame(key: string): Promise<ImageBitmap | null>
export async function setCachedFrame(key: string, frame: ImageBitmap): Promise<void>
```

#### 5.6.3 扩展点

1. **AI模型缓存**: 存储HyperFrames的模型文件和预处理结果
2. **中间结果缓存**: 缓存AI分析的中间帧
3. **元数据扩展**: 为媒体添加AI分析标签

---

## 6. 关键流程追踪

### 6.1 项目创建流程（Project Creation Flow）

#### 6.1.1 流程图

```
用户点击"New Project"
    ↓
ProjectFormDialog收集参数
    ↓
useProjectStore.createProject(data)
    ↓
createProjectObject(data)  ← 生成Project对象
    ↓
createProjectDB(project)  ← 写入IndexedDB
    ↓
初始化workspace目录结构
    ↓
创建默认轨道
    ↓
返回Project对象
    ↓
路由跳转到 /editor/:projectId
```

#### 6.1.2 代码路径

**入口**: `/src/features/projects/hooks/use-project-actions.ts`

```typescript
export function useCreateProject() {
  const navigate = useNavigate()
  
  return async (data: ProjectFormData) => {
    // 1. 创建Project对象
    const project = await useProjectStore.getState().createProject(data)
    
    // 2. 导航到编辑器
    await navigate({ 
      to: '/editor/$projectId', 
      params: { projectId: project.id } 
    })
    
    return project
  }
}
```

**Project创建**: `/src/features/projects/utils/project-helpers.ts`

```typescript
export function createProjectObject(data: ProjectFormData): Project {
  const now = Date.now()
  
  return {
    id: crypto.randomUUID(),
    name: data.name,
    description: data.description || '',
    createdAt: now,
    updatedAt: now,
    duration: 0,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    metadata: {
      width: data.width,
      height: data.height,
      fps: data.fps,
      backgroundColor: data.backgroundColor || '#000000'
    },
    timeline: {
      tracks: createDefaultTracks(),
      items: [],
      transitions: [],
      keyframes: [],
      currentFrame: 0,
      zoomLevel: 1,
      scrollPosition: 0
    }
  }
}

function createDefaultTracks(): TimelineTrack[] {
  return [
    {
      id: crypto.randomUUID(),
      name: 'Video 1',
      kind: 'video',
      height: 80,
      locked: false,
      syncLock: true,
      visible: true,
      muted: false,
      solo: false,
      volume: 0,
      order: 0
    },
    {
      id: crypto.randomUUID(),
      name: 'Audio 1',
      kind: 'audio',
      height: 60,
      locked: false,
      syncLock: true,
      visible: true,
      muted: false,
      solo: false,
      volume: 0,
      order: 1
    }
  ]
}
```

**存储层**: `/src/infrastructure/storage/project-fs.ts`

```typescript
export async function createProjectDB(project: Project): Promise<void> {
  // 1. 在workspace中创建项目目录
  const projectDir = await ensureProjectDirectory(project.id)
  
  // 2. 写入project.json
  await writeProjectFile(project.id, 'project.json', JSON.stringify(project, null, 2))
  
  // 3. 创建子目录
  await projectDir.getDirectoryHandle('media', { create: true })
  await projectDir.getDirectoryHandle('cache', { create: true })
  await projectDir.getDirectoryHandle('exports', { create: true })
  
  // 4. 更新项目索引
  await updateProjectIndex(project.id, {
    name: project.name,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt
  })
}
```

#### 6.1.3 HyperFrames集成点

1. **项目模板扩展**: 在`createDefaultTracks()`中添加AI专用轨道
2. **初始化Hook**: 在项目创建后初始化HyperFrames配置
3. **元数据扩展**: 在Project中添加AI模型选择字段

---

### 6.2 时间线编辑流程（Timeline Editing Flow）

#### 6.2.1 添加媒体到时间线

```
用户从Media Library拖拽文件
    ↓
onDrop事件捕获
    ↓
计算drop位置（trackId, frame）
    ↓
创建TimelineItem对象
    ↓
addItem(item)  ← timeline-actions
    ↓
useItemsStore._addItem(item)
    ↓
markDirty() + pushCommand()
    ↓
触发重新渲染
```

#### 6.2.2 代码路径

**Drop处理**: `/src/features/timeline/components/timeline-drop-zone.tsx`

```typescript
function handleDrop(e: React.DragEvent) {
  const mediaId = e.dataTransfer.getData('mediaId')
  const media = useMediaLibraryStore.getState().mediaById[mediaId]
  
  // 计算drop位置
  const { trackId, frame } = calculateDropPosition(e.clientX, e.clientY)
  
  // 创建timeline item
  const item = createTimelineItemFromMedia(media, trackId, frame)
  
  // 添加到timeline
  addItem(item)
}
```

**Item创建**: `/src/features/timeline/utils/item-factory.ts`

```typescript
export function createTimelineItemFromMedia(
  media: MediaMetadata,
  trackId: string,
  frame: number
): TimelineItem {
  const durationInFrames = Math.floor(media.duration * fps)
  
  if (media.mimeType.startsWith('video/')) {
    return {
      id: crypto.randomUUID(),
      type: 'video',
      trackId,
      from: frame,
      durationInFrames,
      label: media.name,
      mediaId: media.id,
      src: media.blobUrl || '',
      sourceWidth: media.width,
      sourceHeight: media.height,
      sourceFps: media.fps,
      sourceStart: 0,
      sourceEnd: durationInFrames,
      sourceDuration: durationInFrames,
      transform: resolveDefaultTransform(media, projectWidth, projectHeight)
    }
  }
  // ... 其他类型
}
```

**Action执行**: `/src/features/timeline/stores/actions/item-actions.ts`

```typescript
export function addItem(item: TimelineItem): void {
  const [placedItem] = placeItemsWithoutTimelineOverlap([item])
  if (!placedItem) return
  
  execute(
    'ADD_ITEM',
    () => {
      useItemsStore.getState()._addItem(placedItem)
      useTimelineSettingsStore.getState().markDirty()
    },
    { itemId: placedItem.id, type: placedItem.type }
  )
}
```

#### 6.2.3 编辑操作

**Trim（裁剪）**:
```typescript
export function trimItem(
  itemId: string,
  edge: 'start' | 'end',
  deltaFrames: number
): void {
  execute('TRIM_ITEM', () => {
    const item = useItemsStore.getState().getItemById(itemId)
    if (!item) return
    
    if (edge === 'start') {
      const newFrom = item.from + deltaFrames
      const newSourceStart = (item.sourceStart ?? 0) + deltaFrames
      const newDuration = item.durationInFrames - deltaFrames
      
      useItemsStore.getState()._updateItem(itemId, {
        from: newFrom,
        sourceStart: newSourceStart,
        durationInFrames: newDuration
      })
    } else {
      const newDuration = item.durationInFrames + deltaFrames
      const newSourceEnd = (item.sourceEnd ?? item.sourceDuration ?? 0) + deltaFrames
      
      useItemsStore.getState()._updateItem(itemId, {
        durationInFrames: newDuration,
        sourceEnd: newSourceEnd
      })
    }
    
    useTimelineSettingsStore.getState().markDirty()
  })
}
```

**Split（拆分）**:
```typescript
export function splitItem(itemId: string, frame: number): void {
  execute('SPLIT_ITEM', () => {
    const item = useItemsStore.getState().getItemById(itemId)
    if (!item) return
    
    const localFrame = frame - item.from
    
    // 左半部分
    const leftItem = {
      ...item,
      id: crypto.randomUUID(),
      durationInFrames: localFrame,
      originId: item.originId || item.id
    }
    
    // 右半部分
    const rightItem = {
      ...item,
      id: crypto.randomUUID(),
      from: frame,
      durationInFrames: item.durationInFrames - localFrame,
      sourceStart: (item.sourceStart ?? 0) + localFrame,
      originId: item.originId || item.id
    }
    
    useItemsStore.getState()._removeItems([itemId])
    useItemsStore.getState()._addItems([leftItem, rightItem])
    useTimelineSettingsStore.getState().markDirty()
  })
}
```

#### 6.2.4 HyperFrames集成点

1. **智能Trim**: AI分析视频内容，建议最佳裁剪点
2. **自动Split**: 基于场景检测自动拆分片段
3. **智能对齐**: AI预测用户意图，自动对齐片段

---

### 6.3 导出渲染流程（Export Pipeline）

#### 6.3.1 流程图

```
用户点击"Export"
    ↓
ExportDialog收集设置
    ↓
创建RenderJob（冻结timeline快照）
    ↓
enqueueJobs([job])
    ↓
useRenderQueueRunner监听队列
    ↓
开始渲染：markRendering(jobId)
    ↓
初始化渲染引擎
    ↓
逐帧渲染循环
    ↓
编码和封装
    ↓
保存到workspace
    ↓
markCompleted(jobId, { savedPath, fileSize })
```

#### 6.3.2 代码路径

**Job创建**: `/src/features/export/hooks/use-export-dialog.ts`

```typescript
export function useExportDialog() {
  return {
    startExport: async (settings: ExtendedExportSettings) => {
      // 1. 冻结timeline快照
      const snapshot = captureTimelineSnapshot()
      
      // 2. 创建RenderJob
      const job: RenderJob = {
        id: crypto.randomUUID(),
        name: `${project.name} - ${Date.now()}`,
        projectId: project.id,
        status: 'queued',
        progress: 0,
        inPoint: timeline.inPoint ?? null,
        outPoint: timeline.outPoint ?? null,
        durationFrames: calculateDuration(timeline),
        exportMode: settings.mode,
        clientSettings: settings,
        snapshot,
        fileName: generateFileName(project.name, settings),
        createdAt: Date.now()
      }
      
      // 3. 入队
      useRenderQueueStore.getState().enqueueJobs([job])
    }
  }
}

function captureTimelineSnapshot(): RenderJobSnapshot {
  const state = useItemsStore.getState()
  const transitions = useTransitionsStore.getState().transitions
  const keyframes = useKeyframesStore.getState().keyframes
  
  return {
    tracks: structuredClone(state.tracks),
    items: structuredClone(state.items),
    transitions: structuredClone(transitions),
    keyframes: structuredClone(keyframes),
    fps: project.metadata.fps,
    width: project.metadata.width,
    height: project.metadata.height,
    backgroundColor: project.metadata.backgroundColor,
    busAudioEq: timeline.busAudioEq,
    masterBusDb: timeline.masterBusDb
  }
}
```

**渲染执行**: `/src/features/export/hooks/use-render-queue-runner.ts`

```typescript
export function useRenderQueueRunner() {
  useEffect(() => {
    const unsubscribe = useRenderQueueStore.subscribe(async (state) => {
      // 找到第一个queued的job
      const nextJob = state.jobs.find(job => job.status === 'queued')
      if (!nextJob || state.isPaused || state.activeJobId) return
      
      // 开始渲染
      await renderJob(nextJob)
    })
    
    return unsubscribe
  }, [])
}

async function renderJob(job: RenderJob): Promise<void> {
  const store = useRenderQueueStore.getState()
  
  try {
    // 标记为rendering
    store.markRendering(job.id)
    
    // 创建渲染上下文
    const { composition, settings } = prepareRenderContext(job)
    
    // 执行渲染
    const result = await renderComposition(composition, settings, {
      onProgress: (progress) => {
        store.updateJobProgress(job.id, progress)
      }
    })
    
    // 保存文件
    const savedPath = await saveExportedFile(result, job.fileName)
    
    // 标记完成
    store.markCompleted(job.id, {
      savedPath,
      fileSize: result.size
    })
    
  } catch (error) {
    store.markFailed(job.id, error.message)
  }
}
```

**渲染核心**: `/src/features/export/utils/canvas-render-orchestrator.ts`

```typescript
export async function renderComposition(
  composition: CompositionInputProps,
  settings: ClientExportSettings,
  callbacks: {
    onProgress?: (progress: RenderProgress) => void
    onFrameRendered?: (frame: number) => void
  }
): Promise<Blob> {
  // 1. 创建离屏canvas
  const canvas = new OffscreenCanvas(settings.resolution.width, settings.resolution.height)
  const ctx = canvas.getContext('2d')!
  
  // 2. 创建渲染引擎
  const renderer = await createCompositionRenderer(composition, canvas, ctx, {
    mode: 'export',
    useProxyMedia: false
  })
  
  // 3. 初始化编码器
  const encoder = await createVideoEncoder(settings)
  
  // 4. 逐帧渲染
  const startFrame = 0
  const endFrame = composition.durationInFrames ?? 0
  
  for (let frame = startFrame; frame < endFrame; frame++) {
    // 渲染帧
    await renderer.renderFrame(frame)
    
    // 编码
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    await encoder.encodeFrame(imageData, frame)
    
    // 进度回调
    callbacks.onProgress?.({
      phase: 'rendering',
      progress: (frame - startFrame) / (endFrame - startFrame),
      renderedFrames: frame - startFrame + 1,
      totalFrames: endFrame - startFrame
    })
    
    callbacks.onFrameRendered?.(frame)
  }
  
  // 5. 完成编码
  await encoder.finalize()
  
  // 6. 封装为容器格式
  const blob = await muxVideoAndAudio(encoder.videoBlob, audioBlob, settings)
  
  // 7. 清理
  renderer.cleanup()
  
  return blob
}
```

**帧渲染**: `/src/features/export/utils/client-render-engine.ts`

```typescript
async function renderFrame(frame: number): Promise<void> {
  // 1. 解析当前帧的渲染场景
  const scene = resolveFrameRenderScene(frame, tracks, fps, width, height)
  
  // 2. 预加载视频帧
  const videoCandidates = collectFrameVideoCandidates(scene, fps)
  await videoExtractor.prewarmVideos(videoCandidates)
  
  // 3. 清空canvas
  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = backgroundColor
  ctx.fillRect(0, 0, width, height)
  
  // 4. 渲染每个item
  for (const item of scene.items) {
    // 获取item的GPU texture或canvas
    const itemCanvas = await renderItem(item, {
      frame,
      width,
      height,
      fps,
      videoExtractor,
      gifCache,
      textMeasurement
    })
    
    // 应用效果
    if (item.effects && item.effects.length > 0) {
      const effectCanvas = await gpuPipeline.applyEffects(
        itemCanvas,
        item.effects,
        new OffscreenCanvas(width, height)
      )
      itemCanvas = effectCanvas
    }
    
    // 应用transform和合成
    ctx.save()
    applyTransformToContext(ctx, item.transform, width, height)
    ctx.globalAlpha = item.transform?.opacity ?? 1
    ctx.globalCompositeOperation = getCompositeOperation(item.blendMode)
    ctx.drawImage(itemCanvas, 0, 0)
    ctx.restore()
  }
  
  // 5. 应用transitions
  if (activeTransitions.length > 0) {
    await applyTransitions(ctx, activeTransitions, frame)
  }
}
```

#### 6.3.3 HyperFrames集成点

1. **帧级AI处理**: 在`renderFrame()`循环中插入HyperFrames处理
2. **智能编码**: AI分析内容复杂度，动态调整编码参数
3. **质量优化**: 使用AI超分辨率提升导出质量

---

## 7. 状态管理方案（Zustand）

### 7.1 Zustand架构模式

FreeCut使用Zustand作为状态管理库，采用以下模式：

#### 7.1.1 Store定义模式

```typescript
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { temporal } from 'zundo'  // Undo/Redo支持

interface StoreState {
  // 数据状态
  data: SomeData[]
  currentItem: SomeData | null
  
  // UI状态
  isLoading: boolean
  error: string | null
}

interface StoreActions {
  // CRUD操作
  loadData: () => Promise<void>
  createItem: (data: CreateData) => Promise<SomeData>
  updateItem: (id: string, updates: Partial<SomeData>) => Promise<void>
  deleteItem: (id: string) => Promise<void>
  
  // UI操作
  setLoading: (loading: boolean) => void
  clearError: () => void
}

export const useStore = create<StoreState & StoreActions>()(
  devtools(
    temporal(
      (set, get) => ({
        // 初始状态
        data: [],
        currentItem: null,
        isLoading: false,
        error: null,
        
        // Actions实现
        loadData: async () => {
          set({ isLoading: true })
          try {
            const data = await fetchData()
            set({ data, isLoading: false })
          } catch (error) {
            set({ error: error.message, isLoading: false })
          }
        },
        // ... 其他actions
      }),
      {
        // Zundo配置（Undo/Redo）
        partialize: (state) => ({
          data: state.data,
          currentItem: state.currentItem
        }),
        limit: 50
      }
    ),
    { name: 'StoreName' }  // DevTools名称
  )
)
```

#### 7.1.2 核心Store列表

**全局状态**:
- `useEditorStore` - 编辑器布局和UI状态
- `useSelectionStore` - 选中状态管理
- `usePlaybackStore` - 播放控制
- `useClipboardStore` - 剪贴板

**功能领域**:
- `useProjectStore` - 项目管理
- `useMediaLibraryStore` - 媒体库
- `useItemsStore` - Timeline片段
- `useTransitionsStore` - 转场
- `useKeyframesStore` - 关键帧
- `useRenderQueueStore` - 渲染队列

### 7.2 状态订阅模式

```typescript
// 1. 直接订阅整个store（会导致过度渲染）
const state = useEditorStore()

// 2. 选择性订阅（推荐）
const leftSidebarOpen = useEditorStore(state => state.leftSidebarOpen)
const setLeftSidebarOpen = useEditorStore(state => state.setLeftSidebarOpen)

// 3. 使用zustand的shallow比较
import { shallow } from 'zustand/shallow'
const { width, height } = useEditorStore(
  state => ({ width: state.sidebarWidth, height: state.timelineHeight }),
  shallow
)

// 4. 在非React上下文中使用
const currentFrame = usePlaybackStore.getState().currentFrame
usePlaybackStore.getState().seekToFrame(100)
```

### 7.3 跨Store通信

```typescript
// 示例：删除item时同步删除keyframes和transitions
export function removeItems(itemIds: string[]): void {
  execute('REMOVE_ITEMS', () => {
    // 1. 删除keyframes（KeyframesStore）
    useKeyframesStore.getState().removeItemKeyframes(itemIds)
    
    // 2. 删除transitions（TransitionsStore）
    useTransitionsStore.getState().removeTransitionsForItems(itemIds)
    
    // 3. 删除items（ItemsStore）
    useItemsStore.getState()._removeItems(itemIds)
    
    // 4. 标记脏状态（SettingsStore）
    useTimelineSettingsStore.getState().markDirty()
    
    // 5. 清空选中（SelectionStore）
    useSelectionStore.getState().clearSelection()
  }, { count: itemIds.length })
}
```

### 7.4 持久化策略

```typescript
// LocalStorage持久化
const workspace = loadEditorWorkspaceId()  // 从localStorage读取

function loadEditorWorkspaceId(): EditorWorkspaceId {
  try {
    return normalizeEditorWorkspaceId(
      localStorage.getItem(WORKSPACE_STORAGE_KEY)
    )
  } catch {
    return 'edit'  // 默认值
  }
}

// 状态变化时保存
setWorkspace: (workspace) => {
  set({ workspace })
  try {
    localStorage.setItem(WORKSPACE_STORAGE_KEY, workspace)
  } catch {
    /* 静默失败 */
  }
}
```

### 7.5 HyperFrames Store设计建议

```typescript
// /src/shared/state/hyperframes/store.ts
interface HyperFramesState {
  // AI模型状态
  modelLoaded: boolean
  modelName: string | null
  modelVersion: string | null
  
  // 处理队列
  processingItems: Set<string>  // itemId集合
  processedItems: Map<string, HyperFramesResult>
  
  // 配置
  enabled: boolean
  mode: 'realtime' | 'background' | 'export-only'
  quality: 'draft' | 'standard' | 'high'
  
  // 缓存
  frameCache: Map<string, ImageBitmap>  // cacheKey -> processed frame
}

interface HyperFramesActions {
  // 模型管理
  loadModel(modelName: string): Promise<void>
  unloadModel(): void
  
  // 处理操作
  processItem(itemId: string, options?: ProcessOptions): Promise<void>
  cancelProcessing(itemId: string): void
  clearCache(): void
  
  // 配置
  setEnabled(enabled: boolean): void
  setMode(mode: HyperFramesState['mode']): void
  setQuality(quality: HyperFramesState['quality']): void
}

export const useHyperFramesStore = create<HyperFramesState & HyperFramesActions>()(
  devtools(
    (set, get) => ({
      // 初始状态
      modelLoaded: false,
      modelName: null,
      modelVersion: null,
      processingItems: new Set(),
      processedItems: new Map(),
      enabled: false,
      mode: 'background',
      quality: 'standard',
      frameCache: new Map(),
      
      // Actions
      loadModel: async (modelName) => {
        set({ modelLoaded: false })
        // TODO: 加载WebGPU模型
        await loadWebGPUModel(modelName)
        set({ modelLoaded: true, modelName })
      },
      
      processItem: async (itemId, options) => {
        const { processingItems } = get()
        processingItems.add(itemId)
        set({ processingItems: new Set(processingItems) })
        
        try {
          const result = await hyperFramesProcess(itemId, options)
          const { processedItems } = get()
          processedItems.set(itemId, result)
          set({ processedItems: new Map(processedItems) })
        } finally {
          processingItems.delete(itemId)
          set({ processingItems: new Set(processingItems) })
        }
      },
      
      // ... 其他actions
    }),
    { name: 'HyperFrames' }
  )
)
```

---

## 8. HyperFrames 整合建议

### 8.1 整合策略概述

基于以上代码分析，HyperFrames应该采用**多层次集成**策略：

1. **GPU Effect层** - 作为标准效果注册到GPU Effects Registry
2. **Timeline层** - 扩展TimelineItem支持AI元数据
3. **Render层** - 在导出渲染管线中插入处理逻辑
4. **Preview层** - 实时预览AI效果
5. **Media层** - 媒体导入时自动分析

---

### 8.2 切入点 #1: GPU Effects Registry集成 ⭐⭐⭐⭐⭐

**推荐指数**: ★★★★★  
**实现难度**: ⭐⭐  
**影响范围**: 核心渲染Pipeline

#### 8.2.1 为什么选择这个切入点？

1. **最小侵入性**: 不需要修改核心Timeline逻辑
2. **标准化接口**: 遵循FreeCut的GPU效果系统规范
3. **自动UI生成**: 效果参数自动生成控制面板
4. **渲染路径复用**: 自动支持预览和导出
5. **易于扩展**: 可以注册多个AI效果

#### 8.2.2 实现方案

**文件位置**: `/src/infrastructure/gpu-effects/effects/hyperframes.ts`

```typescript
/**
 * HyperFrames AI Effects
 * 
 * 将HyperFrames整合为标准GPU效果，支持：
 * - 风格迁移 (Style Transfer)
 * - 超分辨率 (Super Resolution)
 * - 帧插值 (Frame Interpolation)
 * - 场景理解 (Scene Understanding)
 */

import type { GpuEffectDefinition } from '../types'

// ============ 风格迁移效果 ============

const STYLE_TRANSFER_SHADER = /* wgsl */ `
@group(0) @binding(0) var texSampler: sampler;
@group(0) @binding(1) var inputTex: texture_2d<f32>;
@group(0) @binding(2) var styleTex: texture_2d<f32>;  // 风格参考纹理
@group(0) @binding(3) var<uniform> uniforms: StyleTransferUniforms;

struct StyleTransferUniforms {
  strength: f32,      // 风格强度 (0-1)
  styleId: u32,       // 风格ID
  blendMode: u32,     // 混合模式
  preserveContent: f32, // 内容保留度 (0-1)
}

@fragment
fn styleTransferFragment(input: VertexOutput) -> @location(0) vec4f {
  let content = textureSample(inputTex, texSampler, input.uv);
  
  // TODO: 调用HyperFrames的WebGPU compute shader
  // 这里是简化版示例，实际需要调用预训练的神经网络
  let styled = applyStyleTransfer(content, uniforms.styleId, uniforms.strength);
  
  // 根据preserveContent混合原始内容
  let result = mix(content, styled, uniforms.strength);
  
  return result;
}

// 实际的风格迁移逻辑（需要调用HyperFrames的WebGPU实现）
fn applyStyleTransfer(
  content: vec4f, 
  styleId: u32, 
  strength: f32
) -> vec4f {
  // 1. 特征提取
  // 2. 风格变换
  // 3. 重建图像
  // ... HyperFrames的核心算法 ...
  return content;  // 占位符
}
`

export const styleTransferEffect: GpuEffectDefinition = {
  id: 'hyperframes-style-transfer',
  name: 'AI Style Transfer',
  category: 'stylize',
  description: 'Apply artistic styles using AI',
  
  shader: STYLE_TRANSFER_SHADER,
  entryPoint: 'styleTransferFragment',
  
  params: {
    strength: {
      type: 'float',
      label: 'Strength',
      default: 0.8,
      min: 0,
      max: 1,
      step: 0.01
    },
    styleId: {
      type: 'select',
      label: 'Style',
      default: 0,
      options: [
        { value: 0, label: 'Van Gogh - Starry Night' },
        { value: 1, label: 'Picasso - Cubism' },
        { value: 2, label: 'Monet - Impressionism' },
        { value: 3, label: 'Kandinsky - Abstract' },
        { value: 4, label: 'Custom Style' }
      ]
    },
    preserveContent: {
      type: 'float',
      label: 'Preserve Content',
      default: 0.3,
      min: 0,
      max: 1,
      step: 0.01,
      description: 'How much to preserve original content details'
    }
  },
  
  packUniforms: (params) => {
    return new Float32Array([
      params.strength ?? 0.8,
      params.styleId ?? 0,
      0,  // blendMode (暂未使用)
      params.preserveContent ?? 0.3
    ])
  },
  
  // 可选：异步初始化（加载AI模型）
  init: async (device: GPUDevice) => {
    // 加载HyperFrames模型
    await loadHyperFramesModel(device, 'style-transfer-v1')
    
    // 预热GPU
    await warmupStyleTransferPipeline(device)
  }
}

// ============ 超分辨率效果 ============

const SUPER_RESOLUTION_SHADER = /* wgsl */ `
@group(0) @binding(0) var texSampler: sampler;
@group(0) @binding(1) var inputTex: texture_2d<f32>;
@group(0) @binding(2) var<uniform> uniforms: SuperResUniforms;

struct SuperResUniforms {
  scale: f32,         // 放大倍数 (2x, 4x)
  denoise: f32,       // 降噪强度
  sharpen: f32,       // 锐化强度
}

@fragment
fn superResFragment(input: VertexOutput) -> @location(0) vec4f {
  // 使用AI超分辨率算法
  let upscaled = applySuperResolution(input.uv, uniforms.scale);
  
  // 后处理：降噪和锐化
  let denoised = applyDenoise(upscaled, uniforms.denoise);
  let sharpened = applySharpen(denoised, uniforms.sharpen);
  
  return sharpened;
}
`

export const superResolutionEffect: GpuEffectDefinition = {
  id: 'hyperframes-super-resolution',
  name: 'AI Super Resolution',
  category: 'stylize',
  description: 'Enhance resolution using AI upscaling',
  
  shader: SUPER_RESOLUTION_SHADER,
  entryPoint: 'superResFragment',
  
  params: {
    scale: {
      type: 'select',
      label: 'Scale',
      default: 2,
      options: [
        { value: 2, label: '2x (1080p → 4K)' },
        { value: 4, label: '4x (540p → 4K)' }
      ]
    },
    denoise: {
      type: 'float',
      label: 'Denoise',
      default: 0.5,
      min: 0,
      max: 1,
      step: 0.01
    },
    sharpen: {
      type: 'float',
      label: 'Sharpen',
      default: 0.3,
      min: 0,
      max: 1,
      step: 0.01
    }
  },
  
  packUniforms: (params) => {
    return new Float32Array([
      params.scale ?? 2,
      params.denoise ?? 0.5,
      params.sharpen ?? 0.3
    ])
  }
}

// ============ 帧插值效果 ============

const FRAME_INTERPOLATION_SHADER = /* wgsl */ `
// 用于慢动作效果的AI帧插值
@group(0) @binding(0) var texSampler: sampler;
@group(0) @binding(1) var frame1: texture_2d<f32>;
@group(0) @binding(2) var frame2: texture_2d<f32>;
@group(0) @binding(3) var<uniform> uniforms: InterpUniforms;

struct InterpUniforms {
  t: f32,             // 插值参数 (0-1)
  motionStrength: f32,
  blendMode: u32,
}

@fragment
fn frameInterpFragment(input: VertexOutput) -> @location(0) vec4f {
  // 光流估计 + AI插值
  let interpolated = interpolateFrames(
    frame1, 
    frame2, 
    input.uv, 
    uniforms.t,
    uniforms.motionStrength
  );
  
  return interpolated;
}
`

export const frameInterpolationEffect: GpuEffectDefinition = {
  id: 'hyperframes-frame-interpolation',
  name: 'AI Frame Interpolation',
  category: 'stylize',
  description: 'Generate intermediate frames for smooth slow motion',
  
  shader: FRAME_INTERPOLATION_SHADER,
  entryPoint: 'frameInterpFragment',
  
  params: {
    slowMotionFactor: {
      type: 'float',
      label: 'Slow Motion Factor',
      default: 2,
      min: 1,
      max: 8,
      step: 0.1,
      description: '2x = half speed, 4x = quarter speed'
    },
    motionStrength: {
      type: 'float',
      label: 'Motion Smoothness',
      default: 1,
      min: 0,
      max: 2,
      step: 0.1
    }
  },
  
  packUniforms: (params) => {
    return new Float32Array([
      1.0 / (params.slowMotionFactor ?? 2),  // t值
      params.motionStrength ?? 1
    ])
  }
}
```

#### 8.2.3 注册效果

**文件位置**: `/src/infrastructure/gpu-effects/registry.ts`

```typescript
// 在registry.ts中导入并注册
import * as hyperframesEffects from './effects/hyperframes'

// 添加新类别
const GPU_EFFECT_CATEGORIES: Record<GpuEffectCategory, GpuEffectDefinition[]> = {
  color: [],
  blur: [],
  distort: [],
  stylize: [],
  keying: [],
  ai: []  // 新增AI类别
}

// 注册HyperFrames效果
registerEffects(hyperframesEffects)
```

#### 8.2.4 使用流程

```typescript
// 用户在Effects面板选择"AI Style Transfer"
// 系统自动：
// 1. 在Timeline item上添加effect
const item = useItemsStore.getState().getItemById(selectedId)
useItemsStore.getState()._updateItem(selectedId, {
  effects: [
    ...(item.effects ?? []),
    {
      id: crypto.randomUUID(),
      type: 'hyperframes-style-transfer',
      enabled: true,
      params: {
        strength: 0.8,
        styleId: 0,
        preserveContent: 0.3
      }
    }
  ]
})

// 2. 预览时自动应用（通过composition-runtime）
// 3. 导出时自动应用（通过client-render-engine）
```

#### 8.2.5 优势

✅ **零侵入**: 完全遵循现有架构  
✅ **自动化**: UI和渲染流程自动处理  
✅ **高性能**: GPU加速，支持实时预览  
✅ **可扩展**: 轻松添加更多AI效果  
✅ **一致性**: 预览和导出使用相同代码路径

---

### 8.3 切入点 #2: Timeline Item扩展 ⭐⭐⭐⭐

**推荐指数**: ★★★★☆  
**实现难度**: ⭐⭐⭐  
**影响范围**: Timeline数据结构

#### 8.3.1 为什么需要扩展Timeline Item？

1. **持久化AI元数据**: 保存AI分析结果（场景类型、对象检测等）
2. **智能编辑辅助**: 基于AI元数据提供智能建议
3. **性能优化**: 避免重复分析，缓存结果

#### 8.3.2 实现方案

**扩展BaseTimelineItem类型**

```typescript
// /src/types/timeline.ts

// 在BaseTimelineItem中添加AI元数据字段
type BaseTimelineItem = {
  // ... 现有字段 ...
  
  // HyperFrames AI元数据
  hyperframes?: {
    analyzed: boolean              // 是否已分析
    analyzedAt?: number            // 分析时间戳
    version?: string               // HyperFrames版本
    
    // 场景理解
    scene?: {
      type: 'indoor' | 'outdoor' | 'nature' | 'urban' | 'abstract'
      confidence: number
      tags: string[]               // ['sunset', 'beach', 'people']
      dominantColors: string[]     // ['#FF6B35', '#004E89']
    }
    
    // 对象检测
    objects?: Array<{
      label: string                // 'person', 'car', 'dog'
      confidence: number
      bbox: [number, number, number, number]  // [x, y, width, height]
      trackingId?: string          // 用于跨帧追踪
    }>
    
    // 运动分析
    motion?: {
      type: 'static' | 'slow' | 'moderate' | 'fast'
      direction?: 'left' | 'right' | 'up' | 'down'
      cameraMotion?: 'pan' | 'tilt' | 'zoom' | 'static'
    }
    
    // 质量评估
    quality?: {
      sharpness: number            // 0-1
      exposure: number             // 0-1
      noise: number                // 0-1
      recommendation?: string      // '建议应用降噪'
    }
    
    // 推荐操作
    suggestions?: Array<{
      type: 'effect' | 'transition' | 'trim' | 'crop'
      reason: string
      confidence: number
      params?: Record<string, any>
    }>
  }
}
```

#### 8.3.3 分析服务

**文件位置**: `/src/features/timeline/services/hyperframes-analysis-service.ts`

```typescript
import { useItemsStore } from '../stores/items-store'
import { useHyperFramesStore } from '@/shared/state/hyperframes'

interface AnalysisOptions {
  analyzeScene?: boolean
  detectObjects?: boolean
  analyzeMotion?: boolean
  assessQuality?: boolean
  generateSuggestions?: boolean
}

export class HyperFramesAnalysisService {
  /**
   * 分析单个timeline item
   */
  async analyzeItem(
    itemId: string, 
    options: AnalysisOptions = {}
  ): Promise<void> {
    const item = useItemsStore.getState().getItemById(itemId)
    if (!item || item.type !== 'video' && item.type !== 'image') {
      throw new Error('Only video and image items can be analyzed')
    }
    
    // 检查是否已分析
    if (item.hyperframes?.analyzed) {
      console.log(`Item ${itemId} already analyzed, skipping...`)
      return
    }
    
    const hyperframes = useHyperFramesStore.getState()
    if (!hyperframes.modelLoaded) {
      await hyperframes.loadModel('scene-understanding-v1')
    }
    
    // 提取关键帧（用于分析）
    const keyFrame = await extractKeyFrame(item)
    
    // 执行各项分析
    const results: any = {
      analyzed: true,
      analyzedAt: Date.now(),
      version: hyperframes.modelVersion
    }
    
    if (options.analyzeScene !== false) {
      results.scene = await this.analyzeScene(keyFrame)
    }
    
    if (options.detectObjects !== false) {
      results.objects = await this.detectObjects(keyFrame)
    }
    
    if (options.analyzeMotion !== false && item.type === 'video') {
      results.motion = await this.analyzeMotion(item)
    }
    
    if (options.assessQuality !== false) {
      results.quality = await this.assessQuality(keyFrame)
    }
    
    if (options.generateSuggestions !== false) {
      results.suggestions = this.generateSuggestions(results)
    }
    
    // 更新item
    useItemsStore.getState()._updateItem(itemId, {
      hyperframes: results
    })
  }
  
  /**
   * 批量分析多个items
   */
  async analyzeItems(
    itemIds: string[],
    options: AnalysisOptions = {},
    onProgress?: (current: number, total: number) => void
  ): Promise<void> {
    for (let i = 0; i < itemIds.length; i++) {
      await this.analyzeItem(itemIds[i], options)
      onProgress?.(i + 1, itemIds.length)
    }
  }
  
  /**
   * 场景分析
   */
  private async analyzeScene(frame: ImageBitmap): Promise<any> {
    // 调用HyperFrames的场景分类模型
    const result = await runSceneClassification(frame)
    
    return {
      type: result.sceneType,
      confidence: result.confidence,
      tags: result.tags,
      dominantColors: extractDominantColors(frame)
    }
  }
  
  /**
   * 对象检测
   */
  private async detectObjects(frame: ImageBitmap): Promise<any[]> {
    // 调用HyperFrames的目标检测模型
    const detections = await runObjectDetection(frame)
    
    return detections.map(d => ({
      label: d.label,
      confidence: d.confidence,
      bbox: d.bbox,
      trackingId: generateTrackingId()
    }))
  }
  
  /**
   * 运动分析
   */
  private async analyzeMotion(item: VideoItem): Promise<any> {
    // 采样多帧分析运动
    const frames = await sampleFrames(item, 5)
    const motion = await estimateMotion(frames)
    
    return {
      type: motion.type,
      direction: motion.direction,
      cameraMotion: motion.cameraMotion
    }
  }
  
  /**
   * 质量评估
   */
  private async assessQuality(frame: ImageBitmap): Promise<any> {
    const metrics = await analyzeImageQuality(frame)
    
    let recommendation: string | undefined
    if (metrics.sharpness < 0.5) {
      recommendation = '建议应用锐化效果'
    } else if (metrics.noise > 0.6) {
      recommendation = '建议应用降噪效果'
    } else if (metrics.exposure < 0.3 || metrics.exposure > 0.8) {
      recommendation = '建议调整曝光'
    }
    
    return {
      ...metrics,
      recommendation
    }
  }
  
  /**
   * 生成智能建议
   */
  private generateSuggestions(analysis: any): any[] {
    const suggestions = []
    
    // 基于场景类型推荐效果
    if (analysis.scene?.type === 'outdoor' && analysis.scene.tags.includes('sunset')) {
      suggestions.push({
        type: 'effect',
        reason: '检测到日落场景，建议增强暖色调',
        confidence: 0.85,
        params: {
          effectType: 'color-temperature',
          temperature: 1.2
        }
      })
    }
    
    // 基于运动推荐转场
    if (analysis.motion?.type === 'fast') {
      suggestions.push({
        type: 'transition',
        reason: '快速运动场景，建议使用动态转场',
        confidence: 0.75,
        params: {
          transitionType: 'wipe'
        }
      })
    }
    
    // 基于质量评估推荐处理
    if (analysis.quality?.recommendation) {
      suggestions.push({
        type: 'effect',
        reason: analysis.quality.recommendation,
        confidence: 0.9,
        params: {}
      })
    }
    
    return suggestions
  }
}

// 导出单例
export const hyperFramesAnalysisService = new HyperFramesAnalysisService()
```

#### 8.3.4 UI集成 - 智能建议面板

**文件位置**: `/src/features/timeline/components/ai-suggestions-panel.tsx`

```typescript
import { useItemsStore } from '../stores/items-store'
import { useSelectionStore } from '@/shared/state/selection'
import { hyperFramesAnalysisService } from '../services/hyperframes-analysis-service'

export function AISuggestionsPanel() {
  const selectedIds = useSelectionStore(state => state.selectedItemIds)
  const item = useItemsStore(state => 
    selectedIds.length === 1 ? state.getItemById(selectedIds[0]) : null
  )
  
  const suggestions = item?.hyperframes?.suggestions ?? []
  
  if (!item || suggestions.length === 0) {
    return (
      <div className="p-4 text-gray-500">
        选择一个片段查看AI建议
      </div>
    )
  }
  
  return (
    <div className="p-4 space-y-3">
      <h3 className="font-semibold">AI 智能建议</h3>
      
      {suggestions.map((suggestion, index) => (
        <div key={index} className="border rounded-lg p-3">
          <div className="flex items-center justify-between">
            <span className="font-medium">{suggestion.reason}</span>
            <span className="text-xs text-gray-500">
              {Math.round(suggestion.confidence * 100)}% 置信度
            </span>
          </div>
          
          <button
            className="mt-2 px-3 py-1 bg-blue-500 text-white rounded"
            onClick={() => applySuggestion(item.id, suggestion)}
          >
            应用建议
          </button>
        </div>
      ))}
    </div>
  )
}

function applySuggestion(itemId: string, suggestion: any) {
  switch (suggestion.type) {
    case 'effect':
      // 应用推荐的效果
      applyEffect(itemId, suggestion.params.effectType, suggestion.params)
      break
    case 'transition':
      // 添加推荐的转场
      addTransition(itemId, suggestion.params.transitionType)
      break
    // ... 其他类型
  }
}
```

#### 8.3.5 优势

✅ **智能化**: 提供AI驱动的编辑建议  
✅ **性能优化**: 分析结果持久化，避免重复计算  
✅ **用户体验**: 降低编辑门槛，提升效率  
✅ **可扩展**: 元数据结构易于扩展

---

### 8.4 切入点 #3: 渲染管线集成 ⭐⭐⭐⭐

**推荐指数**: ★★★★☆  
**实现难度**: ⭐⭐⭐⭐  
**影响范围**: Export渲染引擎

#### 8.4.1 为什么需要渲染管线集成？

1. **导出时批处理**: 在导出时对所有帧应用AI处理
2. **质量优先**: 导出可以使用高质量模型，不受实时性限制
3. **后处理优化**: 在最终合成后应用全局AI优化

#### 8.4.2 实现方案

**文件位置**: `/src/features/export/utils/hyperframes-render-processor.ts`

```typescript
import type { CompositionInputProps } from '@/types/export'
import { useHyperFramesStore } from '@/shared/state/hyperframes'

interface HyperFramesRenderOptions {
  enabled: boolean
  mode: 'per-item' | 'per-frame' | 'post-composite'
  quality: 'draft' | 'standard' | 'high' | 'ultra'
  effects: Array<{
    type: string
    params: Record<string, any>
  }>
}

export class HyperFramesRenderProcessor {
  private gpuDevice: GPUDevice | null = null
  private modelLoaded = false
  
  async initialize(device: GPUDevice): Promise<void> {
    this.gpuDevice = device
    
    // 加载HyperFrames模型到GPU
    await this.loadModels()
    this.modelLoaded = true
  }
  
  private async loadModels(): Promise<void> {
    const store = useHyperFramesStore.getState()
    
    // 根据quality加载对应的模型
    await store.loadModel('export-quality-v1')
  }
  
  /**
   * 处理单个item的渲染结果
   */
  async processItem(
    itemCanvas: OffscreenCanvas,
    itemId: string,
    frame: number,
    options: HyperFramesRenderOptions
  ): Promise<OffscreenCanvas> {
    if (!options.enabled || options.mode !== 'per-item') {
      return itemCanvas
    }
    
    // 获取item的AI元数据
    const item = useItemsStore.getState().getItemById(itemId)
    const hyperframes = item?.hyperframes
    
    // 应用智能增强
    let processed = itemCanvas
    
    // 1. 自适应锐化（基于质量评估）
    if (hyperframes?.quality?.sharpness && hyperframes.quality.sharpness < 0.6) {
      processed = await this.applySharpen(processed, 0.3)
    }
    
    // 2. 智能降噪
    if (hyperframes?.quality?.noise && hyperframes.quality.noise > 0.5) {
      processed = await this.applyDenoise(processed, 0.4)
    }
    
    // 3. 色彩校正（基于场景类型）
    if (hyperframes?.scene?.type) {
      processed = await this.applySceneOptimization(processed, hyperframes.scene)
    }
    
    return processed
  }
  
  /**
   * 处理整个合成帧（所有layers已合成）
   */
  async processCompositeFrame(
    compositeCanvas: OffscreenCanvas,
    frame: number,
    composition: CompositionInputProps,
    options: HyperFramesRenderOptions
  ): Promise<OffscreenCanvas> {
    if (!options.enabled || options.mode !== 'post-composite') {
      return compositeCanvas
    }
    
    let processed = compositeCanvas
    
    // 应用全局AI效果
    for (const effect of options.effects) {
      processed = await this.applyEffect(processed, effect.type, effect.params)
    }
    
    return processed
  }
  
  /**
   * 智能锐化
   */
  private async applySharpen(
    canvas: OffscreenCanvas,
    strength: number
  ): Promise<OffscreenCanvas> {
    if (!this.gpuDevice) return canvas
    
    // 使用WebGPU compute shader实现AI锐化
    const output = new OffscreenCanvas(canvas.width, canvas.height)
    
    // TODO: 调用HyperFrames的锐化算法
    await runWebGPUCompute(this.gpuDevice, {
      shader: 'ai-sharpen',
      input: canvas,
      output,
      params: { strength }
    })
    
    return output
  }
  
  /**
   * 智能降噪
   */
  private async applyDenoise(
    canvas: OffscreenCanvas,
    strength: number
  ): Promise<OffscreenCanvas> {
    if (!this.gpuDevice) return canvas
    
    const output = new OffscreenCanvas(canvas.width, canvas.height)
    
    // 使用AI降噪模型
    await runWebGPUCompute(this.gpuDevice, {
      shader: 'ai-denoise',
      input: canvas,
      output,
      params: { strength }
    })
    
    return output
  }
  
  /**
   * 场景优化（基于场景类型应用最佳色彩校正）
   */
  private async applySceneOptimization(
    canvas: OffscreenCanvas,
    scene: any
  ): Promise<OffscreenCanvas> {
    const optimizations: Record<string, any> = {
      'outdoor': { vibrance: 1.2, contrast: 1.1 },
      'indoor': { warmth: 1.05, brightness: 1.05 },
      'nature': { saturation: 1.15, vibrance: 1.25 },
      'urban': { contrast: 1.15, clarity: 1.1 },
      'abstract': { saturation: 1.3 }
    }
    
    const params = optimizations[scene.type] || {}
    
    return this.applyColorCorrection(canvas, params)
  }
  
  private async applyEffect(
    canvas: OffscreenCanvas,
    effectType: string,
    params: Record<string, any>
  ): Promise<OffscreenCanvas> {
    // 根据effectType调用对应的AI处理
    switch (effectType) {
      case 'super-resolution':
        return this.applySuperResolution(canvas, params)
      case 'style-transfer':
        return this.applyStyleTransfer(canvas, params)
      case 'color-grade':
        return this.applyAIColorGrade(canvas, params)
      default:
        return canvas
    }
  }
  
  cleanup(): void {
    this.modelLoaded = false
    // 释放GPU资源
  }
}
```

#### 8.4.3 集成到渲染循环

**修改文件**: `/src/features/export/utils/client-render-engine.ts`

```typescript
// 在createCompositionRenderer中集成HyperFrames处理器

export async function createCompositionRenderer(
  composition: CompositionInputProps,
  canvas: OffscreenCanvas,
  ctx: OffscreenCanvasRenderingContext2D,
  options: {
    mode?: 'export' | 'preview'
    hyperframes?: HyperFramesRenderOptions  // 新增参数
    // ... 其他选项
  }
) {
  // 初始化HyperFrames处理器
  let hyperframesProcessor: HyperFramesRenderProcessor | null = null
  
  if (options.hyperframes?.enabled && options.mode === 'export') {
    hyperframesProcessor = new HyperFramesRenderProcessor()
    await hyperframesProcessor.initialize(gpuDevice)
  }
  
  async function renderFrame(frame: number): Promise<void> {
    // ... 现有渲染逻辑 ...
    
    // 在item渲染后应用AI处理
    if (hyperframesProcessor && options.hyperframes?.mode === 'per-item') {
      for (const item of scene.items) {
        const itemCanvas = await renderItem(item, renderContext)
        
        // AI处理
        const processedCanvas = await hyperframesProcessor.processItem(
          itemCanvas,
          item.id,
          frame,
          options.hyperframes
        )
        
        // 继续后续合成...
      }
    }
    
    // ... 合成所有layers ...
    
    // 在最终合成后应用全局AI处理
    if (hyperframesProcessor && options.hyperframes?.mode === 'post-composite') {
      const processedCanvas = await hyperframesProcessor.processCompositeFrame(
        canvas,
        frame,
        composition,
        options.hyperframes
      )
      
      // 将处理结果写回canvas
      ctx.drawImage(processedCanvas, 0, 0)
    }
  }
  
  return {
    renderFrame,
    cleanup: () => {
      // ... 现有清理逻辑 ...
      hyperframesProcessor?.cleanup()
    }
  }
}
```

#### 8.4.4 导出对话框集成

**文件位置**: `/src/features/export/components/export-dialog.tsx`

```typescript
export function ExportDialog() {
  const [hyperframesEnabled, setHyperframesEnabled] = useState(false)
  const [hyperframesMode, setHyperframesMode] = useState<'per-item' | 'post-composite'>('post-composite')
  const [hyperframesQuality, setHyperframesQuality] = useState<'standard' | 'high' | 'ultra'>('standard')
  
  return (
    <Dialog>
      {/* ... 现有导出设置 ... */}
      
      <div className="border-t pt-4 mt-4">
        <h3 className="font-semibold mb-3">AI 增强 (HyperFrames)</h3>
        
        <label className="flex items-center mb-3">
          <input
            type="checkbox"
            checked={hyperframesEnabled}
            onChange={(e) => setHyperframesEnabled(e.target.checked)}
          />
          <span className="ml-2">启用 AI 增强</span>
        </label>
        
        {hyperframesEnabled && (
          <>
            <div className="mb-3">
              <label className="block text-sm mb-1">处理模式</label>
              <select 
                value={hyperframesMode}
                onChange={(e) => setHyperframesMode(e.target.value as any)}
              >
                <option value="per-item">逐片段处理（精细，较慢）</option>
                <option value="post-composite">合成后处理（快速）</option>
              </select>
            </div>
            
            <div className="mb-3">
              <label className="block text-sm mb-1">AI 质量</label>
              <select
                value={hyperframesQuality}
                onChange={(e) => setHyperframesQuality(e.target.value as any)}
              >
                <option value="standard">标准（较快）</option>
                <option value="high">高质量（推荐）</option>
                <option value="ultra">超高质量（最慢）</option>
              </select>
            </div>
            
            <div className="text-xs text-gray-500">
              AI增强将自动应用降噪、锐化和色彩优化
            </div>
          </>
        )}
      </div>
      
      <button onClick={handleExport}>导出</button>
    </Dialog>
  )
}
```

#### 8.4.5 优势

✅ **质量优先**: 导出时可使用最高质量模型  
✅ **批量处理**: 自动处理所有帧  
✅ **灵活配置**: 支持多种处理模式  
✅ **透明集成**: 不影响现有渲染流程

---

### 8.5 切入点 #4: 实时预览优化 ⭐⭐⭐

**推荐指数**: ★★★☆☆  
**实现难度**: ⭐⭐⭐⭐⭐  
**影响范围**: Preview播放器

#### 8.5.1 挑战

实时预览需要在保持60fps的前提下应用AI处理，这需要：
- 轻量级AI模型
- 智能缓存策略
- 异步处理
- 降级策略

#### 8.5.2 实现方案

**文件位置**: `/src/features/preview/services/hyperframes-preview-service.ts`

```typescript
/**
 * HyperFrames实时预览服务
 * 
 * 策略：
 * 1. 使用轻量级模型
 * 2. 预测性预加载
 * 3. 帧级缓存
 * 4. 性能降级
 */

interface PreviewCache {
  frame: number
  processed: ImageBitmap
  timestamp: number
}

export class HyperFramesPreviewService {
  private cache = new Map<string, PreviewCache>()
  private processingQueue = new Set<number>()
  private maxCacheSize = 30  // 缓存30帧
  
  /**
   * 处理预览帧（非阻塞）
   */
  async processPreviewFrame(
    frame: number,
    canvas: OffscreenCanvas,
    itemId: string
  ): Promise<OffscreenCanvas> {
    const cacheKey = `${itemId}-${frame}`
    
    // 1. 检查缓存
    const cached = this.cache.get(cacheKey)
    if (cached) {
      return this.bitmapToCanvas(cached.processed)
    }
    
    // 2. 如果正在处理，返回原始帧
    if (this.processingQueue.has(frame)) {
      return canvas
    }
    
    // 3. 异步处理（不阻塞渲染）
    this.processingQueue.add(frame)
    this.processAsync(frame, canvas, cacheKey).finally(() => {
      this.processingQueue.delete(frame)
    })
    
    // 4. 返回原始帧（处理完成后下一帧会使用缓存）
    return canvas
  }
  
  private async processAsync(
    frame: number,
    canvas: OffscreenCanvas,
    cacheKey: string
  ): Promise<void> {
    try {
      // 使用轻量级预览模型
      const processed = await this.applyLightweightAI(canvas)
      
      // 缓存结果
      this.cache.set(cacheKey, {
        frame,
        processed,
        timestamp: Date.now()
      })
      
      // 清理旧缓存
      this.evictOldCache()
      
      // 预测性预加载相邻帧
      this.preloadAdjacentFrames(frame, cacheKey)
      
    } catch (error) {
      console.error('Preview processing failed:', error)
    }
  }
  
  private async applyLightweightAI(
    canvas: OffscreenCanvas
  ): Promise<ImageBitmap> {
    // 使用轻量级模型，优先速度
    // 例如：使用MobileNet而非ResNet
    const bitmap = await createImageBitmap(canvas)
    
    // 简化处理（仅关键增强）
    const enhanced = await quickEnhance(bitmap)
    
    return enhanced
  }
  
  private evictOldCache(): void {
    if (this.cache.size <= this.maxCacheSize) return
    
    // LRU策略：删除最旧的
    const entries = Array.from(this.cache.entries())
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp)
    
    const toDelete = entries.slice(0, this.cache.size - this.maxCacheSize)
    toDelete.forEach(([key]) => this.cache.delete(key))
  }
  
  private preloadAdjacentFrames(currentFrame: number, baseKey: string): void {
    // 预加载前后3帧
    const framesToPreload = [
      currentFrame + 1,
      currentFrame + 2,
      currentFrame + 3,
      currentFrame - 1
    ]
    
    // 异步预加载（低优先级）
    requestIdleCallback(() => {
      framesToPreload.forEach(frame => {
        // TODO: 触发预加载
      })
    })
  }
}
```

#### 8.5.3 性能监控和降级

```typescript
/**
 * 性能监控器
 */
class PerformanceMonitor {
  private frameTimings: number[] = []
  private readonly targetFPS = 60
  private readonly targetFrameTime = 1000 / this.targetFPS
  
  recordFrame(startTime: number): void {
    const frameTime = performance.now() - startTime
    this.frameTimings.push(frameTime)
    
    // 只保留最近60帧
    if (this.frameTimings.length > 60) {
      this.frameTimings.shift()
    }
  }
  
  shouldDegrade(): boolean {
    if (this.frameTimings.length < 10) return false
    
    const avgFrameTime = this.frameTimings.reduce((a, b) => a + b) / this.frameTimings.length
    
    // 如果平均帧时间超过目标的80%，降级
    return avgFrameTime > this.targetFrameTime * 0.8
  }
  
  getCurrentFPS(): number {
    if (this.frameTimings.length === 0) return 60
    
    const avgFrameTime = this.frameTimings.reduce((a, b) => a + b) / this.frameTimings.length
    return 1000 / avgFrameTime
  }
}

// 在预览中使用
const perfMonitor = new PerformanceMonitor()

function renderPreviewFrame(frame: number) {
  const startTime = performance.now()
  
  // ... 渲染逻辑 ...
  
  // 根据性能决定是否应用AI
  if (!perfMonitor.shouldDegrade()) {
    applyHyperFrames(canvas)
  }
  
  perfMonitor.recordFrame(startTime)
}
```

---

### 8.6 切入点 #5: 媒体导入时自动分析 ⭐⭐⭐⭐

**推荐指数**: ★★★★☆  
**实现难度**: ⭐⭐⭐  
**影响范围**: Media Library

#### 8.6.1 为什么在导入时分析？

1. **用户体验**: 分析完成后才开始编辑，避免编辑时等待
2. **智能组织**: 基于分析结果自动分类和标签
3. **智能建议**: 导入时就能提供编辑建议

#### 8.6.2 实现方案

**修改文件**: `/src/features/media-library/stores/media-import-actions.ts`

```typescript
// 在现有的importMedia函数中集成分析

export async function importMedia(
  files: File[],
  projectId: string
): Promise<MediaMetadata[]> {
  const results: MediaMetadata[] = []
  
  for (const file of files) {
    // 1. 现有的导入逻辑
    const metadata = await importSingleFile(file, projectId)
    results.push(metadata)
    
    // 2. 触发AI分析（异步，不阻塞导入）
    if (shouldAnalyze(metadata)) {
      analyzeMediaInBackground(metadata.id).catch(error => {
        console.error('Background analysis failed:', error)
      })
    }
  }
  
  return results
}

function shouldAnalyze(media: MediaMetadata): boolean {
  // 仅分析视频和图片
  return media.mimeType.startsWith('video/') || media.mimeType.startsWith('image/')
}

async function analyzeMediaInBackground(mediaId: string): Promise<void> {
  const media = useMediaLibraryStore.getState().mediaById[mediaId]
  if (!media) return
  
  // 提取关键帧
  const keyFrame = await extractKeyFrameFromMedia(media)
  
  // 执行分析
  const analysis = await runMediaAnalysis(keyFrame, media)
  
  // 更新媒体元数据
  useMediaLibraryStore.getState().updateMedia(mediaId, {
    aiTags: analysis.tags,
    aiScene: analysis.sceneType,
    aiObjects: analysis.objects,
    aiQuality: analysis.quality
  })
  
  // 显示通知
  showNotification(`${media.name} 分析完成`, {
    tags: analysis.tags,
    suggestions: analysis.suggestions
  })
}
```

#### 8.6.3 智能分类和搜索

```typescript
// 基于AI分析的智能搜索
export function searchMediaWithAI(query: string): MediaMetadata[] {
  const allMedia = useMediaLibraryStore.getState().mediaItems
  
  return allMedia.filter(media => {
    // 1. 匹配文件名
    if (media.name.toLowerCase().includes(query.toLowerCase())) {
      return true
    }
    
    // 2. 匹配AI标签
    if (media.aiTags?.some(tag => tag.includes(query.toLowerCase()))) {
      return true
    }
    
    // 3. 匹配场景类型
    if (media.aiScene?.toLowerCase().includes(query.toLowerCase())) {
      return true
    }
    
    // 4. 匹配检测到的对象
    if (media.aiObjects?.some(obj => obj.label.includes(query.toLowerCase()))) {
      return true
    }
    
    return false
  })
}

// 智能分组
export function groupMediaByScene(): Map<string, MediaMetadata[]> {
  const allMedia = useMediaLibraryStore.getState().mediaItems
  const grouped = new Map<string, MediaMetadata[]>()
  
  for (const media of allMedia) {
    const scene = media.aiScene || 'uncategorized'
    const group = grouped.get(scene) || []
    group.push(media)
    grouped.set(scene, group)
  }
  
  return grouped
}
```

---

### 8.7 整合优先级和实施路线图

#### 8.7.1 推荐实施顺序

**阶段1：基础集成（1-2周）**
1. ✅ 创建HyperFrames Store (`/src/shared/state/hyperframes/`)
2. ✅ 实现GPU Effects注册（切入点#1）
3. ✅ 添加基础的风格迁移效果
4. ✅ 集成到Effects面板UI

**阶段2：元数据扩展（1周）**
1. ✅ 扩展Timeline Item类型（切入点#2）
2. ✅ 实现基础分析服务
3. ✅ 添加AI建议面板UI
4. ✅ 实现智能建议应用逻辑

**阶段3：渲染集成（2周）**
1. ✅ 实现HyperFrames渲染处理器（切入点#3）
2. ✅ 集成到导出管线
3. ✅ 添加导出对话框配置UI
4. ✅ 优化批量处理性能

**阶段4：媒体分析（1周）**
1. ✅ 集成到媒体导入流程（切入点#5）
2. ✅ 实现后台分析队列
3. ✅ 添加智能搜索和分类
4. ✅ 优化分析性能

**阶段5：预览优化（可选，2周）**
1. ⚠️ 实现轻量级预览模型（切入点#4）
2. ⚠️ 添加预测性缓存
3. ⚠️ 实现性能监控和降级
4. ⚠️ 优化实时处理性能

#### 8.7.2 依赖关系

```
阶段1（基础集成）
    ↓
阶段2（元数据扩展）← 可并行 → 阶段4（媒体分析）
    ↓
阶段3（渲染集成）
    ↓
阶段5（预览优化）← 可选
```

#### 8.7.3 风险评估

**技术风险**:
- WebGPU兼容性问题 → 提供WebGL降级方案
- AI模型性能不足 → 实现质量/速度配置选项
- 内存占用过高 → 实现智能缓存清理

**集成风险**:
- 破坏现有功能 → 通过feature flag控制启用
- 性能回退 → 实现性能监控和自动降级
- 用户体验不一致 → 遵循现有UI规范

---

## 9. 关键接口定义

### 9.1 HyperFrames Core API

```typescript
// /src/infrastructure/hyperframes/core-api.ts

/**
 * HyperFrames核心API
 * 封装所有AI处理功能的统一接口
 */

export interface HyperFramesAPI {
  // 模型管理
  loadModel(modelName: string, options?: ModelLoadOptions): Promise<void>
  unloadModel(): void
  isModelLoaded(): boolean
  
  // 图像处理
  processImage(
    input: ImageBitmap | OffscreenCanvas,
    operation: ProcessOperation,
    params?: ProcessParams
  ): Promise<ImageBitmap>
  
  // 批量处理
  processBatch(
    inputs: Array<ImageBitmap | OffscreenCanvas>,
    operation: ProcessOperation,
    params?: ProcessParams,
    onProgress?: (current: number, total: number) => void
  ): Promise<ImageBitmap[]>
  
  // 分析功能
  analyzeImage(
    input: ImageBitmap | OffscreenCanvas,
    analysisType: AnalysisType[]
  ): Promise<AnalysisResult>
  
  // 性能控制
  setQualityMode(mode: 'draft' | 'standard' | 'high' | 'ultra'): void
  getCurrentPerformance(): PerformanceMetrics
}

export type ProcessOperation =
  | 'style-transfer'
  | 'super-resolution'
  | 'frame-interpolation'
  | 'denoise'
  | 'sharpen'
  | 'color-enhance'

export type AnalysisType =
  | 'scene-classification'
  | 'object-detection'
  | 'motion-analysis'
  | 'quality-assessment'

export interface ProcessParams {
  strength?: number
  styleId?: number
  scale?: number
  // ... 其他参数
}

export interface AnalysisResult {
  scene?: SceneAnalysis
  objects?: ObjectDetection[]
  motion?: MotionAnalysis
  quality?: QualityAssessment
}

export interface ModelLoadOptions {
  preferredBackend?: 'webgpu' | 'webgl' | 'wasm'
  cachePath?: string
  onProgress?: (progress: number) => void
}

export interface PerformanceMetrics {
  averageProcessTime: number  // ms
  currentFPS: number
  memoryUsage: number         // MB
  gpuUtilization: number      // 0-1
}
```

### 9.2 WebGPU集成接口

```typescript
// /src/infrastructure/hyperframes/webgpu-adapter.ts

/**
 * WebGPU适配器
 * 封装WebGPU设备管理和compute shader执行
 */

export class HyperFramesWebGPUAdapter {
  private device: GPUDevice | null = null
  private pipelines = new Map<string, GPUComputePipeline>()
  
  async initialize(): Promise<void> {
    // 请求WebGPU设备
    const adapter = await navigator.gpu?.requestAdapter()
    if (!adapter) throw new Error('WebGPU not supported')
    
    this.device = await adapter.requestDevice()
  }
  
  async runComputeShader(
    shaderCode: string,
    inputTexture: GPUTexture,
    outputTexture: GPUTexture,
    uniforms: Float32Array
  ): Promise<void> {
    if (!this.device) throw new Error('Device not initialized')
    
    // 创建或获取pipeline
    const pipeline = this.getOrCreatePipeline(shaderCode)
    
    // 创建bind group
    const bindGroup = this.createBindGroup(pipeline, inputTexture, outputTexture, uniforms)
    
    // 执行compute shader
    const commandEncoder = this.device.createCommandEncoder()
    const passEncoder = commandEncoder.beginComputePass()
    
    passEncoder.setPipeline(pipeline)
    passEncoder.setBindGroup(0, bindGroup)
    passEncoder.dispatchWorkgroups(
      Math.ceil(outputTexture.width / 8),
      Math.ceil(outputTexture.height / 8)
    )
    passEncoder.end()
    
    this.device.queue.submit([commandEncoder.finish()])
  }
  
  private getOrCreatePipeline(shaderCode: string): GPUComputePipeline {
    // 缓存pipeline避免重复编译
    const hash = this.hashShaderCode(shaderCode)
    
    if (!this.pipelines.has(hash)) {
      const module = this.device!.createShaderModule({ code: shaderCode })
      const pipeline = this.device!.createComputePipeline({
        layout: 'auto',
        compute: {
          module,
          entryPoint: 'main'
        }
      })
      this.pipelines.set(hash, pipeline)
    }
    
    return this.pipelines.get(hash)!
  }
}
```

---

## 10. 最佳实践建议

### 10.1 性能优化

1. **模型加载**: 使用Web Worker避免阻塞主线程
2. **帧缓存**: 实现LRU缓存，避免重复处理
3. **批量处理**: 导出时使用batch processing提升吞吐量
4. **降级策略**: 根据设备性能自动调整模型质量

### 10.2 用户体验

1. **渐进增强**: AI功能通过feature flag控制，默认关闭
2. **进度反馈**: 所有耗时操作显示进度条
3. **错误处理**: 优雅降级，AI失败不影响基础功能
4. **预设模板**: 提供常用AI效果预设

### 10.3 代码质量

1. **类型安全**: 使用TypeScript strict mode
2. **单元测试**: 覆盖核心AI处理逻辑
3. **性能测试**: 建立性能基准测试
4. **文档完善**: 为每个AI效果编写使用文档

### 10.4 扩展性

1. **插件化**: 设计插件接口，支持第三方AI模型
2. **版本管理**: 模型版本化，支持模型升级
3. **配置化**: 通过配置文件管理AI参数
4. **监控日志**: 记录AI处理性能和错误

---

## 11. 总结

### 11.1 核心发现

FreeCut采用了**清晰的分层架构**和**领域驱动设计**，为HyperFrames整合提供了良好的基础：

1. **GPU Effects Registry** - 最佳切入点，零侵入集成
2. **Timeline Item扩展** - 支持AI元数据持久化
3. **渲染管线** - 支持批量AI处理
4. **Zustand状态管理** - 易于添加新的状态领域
5. **WebGPU基础设施** - 已有GPU pipeline可复用

### 11.2 推荐策略

**优先级排序**:
1. ⭐⭐⭐⭐⭐ GPU Effects集成（快速见效，低风险）
2. ⭐⭐⭐⭐ Timeline元数据扩展（智能化基础）
3. ⭐⭐⭐⭐ 渲染管线集成（导出质量提升）
4. ⭐⭐⭐⭐ 媒体导入分析（用户体验优化）
5. ⭐⭐⭐ 实时预览（可选，性能挑战大）

**实施建议**:
- 从GPU Effects开始，快速验证技术可行性
- 使用feature flag控制功能启用
- 建立性能基准，持续监控
- 迭代优化，逐步增加AI能力

### 11.3 技术债务管理

1. 预留扩展点，避免过度设计
2. 保持代码简洁，优先可维护性
3. 及时重构，避免技术债累积
4. 文档先行，降低理解成本

---

**报告完成日期**: 2026-07-06  
**分析深度**: 深入到代码级别  
**覆盖范围**: 13个功能模块 + 核心基础设施  
**HyperFrames切入点**: 5个详细方案  

