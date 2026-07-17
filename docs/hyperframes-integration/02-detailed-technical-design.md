# FreeCut + HyperFrames 整合方案 - 详细技术设计

> **文档版本**: v1.0  
> **最后更新**: 2026-07-06  
> **方案名称**: hyperCut基于FreeCut + HyperFrames

---

## 1. 整体架构设计

### 1.1 系统架构图

```
┌─────────────────────────────────────────────────────────────┐
│                    hyperCut 应用层                           │
│  ┌────────────────────────────────────────────────────────┐ │
│  │             统一用户界面 (Unified UI)                   │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐  │ │
│  │  │  NLE时间线   │  │ HTML动画编辑 │  │  预览面板   │  │ │
│  │  │  (FreeCut)   │  │ (HyperFrames)│  │            │  │ │
│  │  └──────────────┘  └──────────────┘  └─────────────┘  │ │
│  └────────────────────────────────────────────────────────┘ │
│                            │                                 │
│                            ↓                                 │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              业务逻辑层 (Business Logic)                │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐  │ │
│  │  │ 项目管理    │  │ 媒体管理    │  │ AI服务编排  │  │ │
│  │  │ (FreeCut)   │  │ (FreeCut)   │  │ (整合层)    │  │ │
│  │  └─────────────┘  └─────────────┘  └──────────────┘  │ │
│  └────────────────────────────────────────────────────────┘ │
│                            │                                 │
│                            ↓                                 │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                数据层 (Data Layer)                      │ │
│  │  ┌─────────────────────────────────────────────────┐  │ │
│  │  │         统一项目数据模型 (Unified Schema)        │  │ │
│  │  │  • FreeCut Project + HyperFrames Composition   │  │ │
│  │  │  • 双向转换器 (Bidirectional Converter)         │  │ │
│  │  └─────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────┘ │
│                            │                                 │
│                            ↓                                 │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              渲染引擎层 (Rendering Engine)              │ │
│  │  ┌──────────────┐         ┌──────────────────────┐    │ │
│  │  │FreeCut Export│  ←API→  │HyperFrames Producer  │    │ │
│  │  │(WebCodecs)   │         │(Puppeteer+FFmpeg)    │    │ │
│  │  └──────────────┘         └──────────────────────┘    │ │
│  └────────────────────────────────────────────────────────┘ │
│                            │                                 │
│                            ↓                                 │
│  ┌────────────────────────────────────────────────────────┐ │
│  │            基础设施层 (Infrastructure)                  │ │
│  │  • OPFS存储 (FreeCut)                                  │ │
│  │  • WebGPU管道 (FreeCut)                                │ │
│  │  • AI模型管理 (FreeCut + HyperFrames)                  │ │
│  │  • 文件系统访问 (File System Access API)               │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 核心设计原则

**1. 最小侵入原则**
- ✅ 保留FreeCut的完整功能和架构
- ✅ 保留HyperFrames的核心能力
- ✅ 通过适配器层进行整合,而非修改核心代码

**2. 渐进增强原则**
- ✅ 基础功能:纯FreeCut NLE编辑(Phase 1)
- ✅ 增强功能:添加HTML动画轨道(Phase 2)
- ✅ 完整功能:AI工作流和自动化(Phase 3)

**3. 数据优先原则**
- ✅ 统一的项目数据模型
- ✅ 可序列化、可版本控制
- ✅ 双向转换:FreeCut ↔ HyperFrames

**4. 用户体验一致性**
- ✅ 统一的UI设计语言
- ✅ 一致的交互模式
- ✅ 无缝的模式切换

### 1.3 技术栈选择

**前端框架**: React 19
- 理由:FreeCut和HyperFrames都使用React 19

**状态管理**: Zustand + Zundo
- 理由:FreeCut使用Zustand进行状态管理,Zundo提供undo/redo

**构建工具**: Vite
- 理由:FreeCut使用Vite,性能优秀

**样式方案**: Tailwind CSS 4
- 理由:FreeCut使用Tailwind CSS 4

**组件库**: Radix UI
- 理由:FreeCut使用Radix UI,无障碍性好

**类型系统**: TypeScript
- 理由:两者都是完整的TypeScript项目

**包管理**: npm
- 理由:FreeCut使用npm,HyperFrames使用Bun但兼容npm

---

## 2. UI整合方案

### 2.1 主界面布局

**双模式编辑器**:

```
┌──────────────────────────────────────────────────────────┐
│  菜单栏: 文件 编辑 视图 项目 窗口 帮助                    │
├──────────────────────────────────────────────────────────┤
│  工具栏: [模式切换] [工具] [播放控制] [导出]              │
├────────┬─────────────────────────────────────────┬───────┤
│        │                                         │       │
│ 媒体库 │            预览窗口                     │ 属性  │
│        │         (Program Monitor)               │ 面板  │
│  [素材]│                                         │       │
│  [特效]│                                         │[变换] │
│  [转场]│                                         │[特效] │
│  [字幕]│                                         │[音频] │
│  [AI]  │                                         │[关键帧│
│        │                                         │       │
├────────┴─────────────────────────────────────────┴───────┤
│                    时间线面板                             │
│  ┌────────────────────────────────────────────────────┐  │
│  │ 轨道1: [视频素材1][HTML动画1]                      │  │
│  │ 轨道2: [视频素材2]                                │  │
│  │ 轨道3: [音频]                                     │  │
│  │ 轨道4: [字幕]                                     │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

**模式切换**:
- **NLE模式**(默认): 传统时间线编辑,FreeCut完整功能
- **HTML动画模式**: 编辑选中的HTML动画片段,显示HyperFrames编辑器
- **混合模式**: 同时显示时间线和代码编辑器

### 2.2 HTML动画轨道设计

**轨道项类型扩展**:

FreeCut原有类型:
```typescript
type TimelineItemType = 
  | 'video' 
  | 'audio' 
  | 'text' 
  | 'image' 
  | 'shape' 
  | 'composition' 
  | 'adjustment'
```

添加新类型:
```typescript
type TimelineItemType = 
  | ... // 原有类型
  | 'hyperframes-composition'  // HyperFrames HTML动画
```

**HTML动画片段数据结构**:

```typescript
interface HyperFramesCompositionItem extends BaseTimelineItem {
  type: 'hyperframes-composition'
  compositionId: string  // 引用HyperFrames composition
  compositionHtml: string  // HTML源码
  compositionData: HyperFramesComposition  // 解析后的数据
  thumbnailUrl?: string  // 预览缩略图
  renderCache?: {
    videoUrl: string  // 预渲染的视频URL
    status: 'pending' | 'ready' | 'error'
  }
}

interface HyperFramesComposition {
  id: string
  width: number
  height: number
  duration: number
  fps: number
  html: string  // 完整HTML
  assets: Array<{
    type: 'video' | 'audio' | 'image'
    src: string
    localPath?: string  // 本地文件路径
  }>
  timelines: Record<string, any>  // GSAP timelines等
}
```

### 2.3 HyperFrames编辑器嵌入

**编辑器组件**:

```typescript
// src/features/hyperframes-editor/HyperFramesEditor.tsx

interface HyperFramesEditorProps {
  compositionId: string
  composition: HyperFramesComposition
  onChange: (composition: HyperFramesComposition) => void
  onClose: () => void
}

function HyperFramesEditor({ 
  compositionId, 
  composition, 
  onChange, 
  onClose 
}: HyperFramesEditorProps) {
  return (
    <div className="hyperframes-editor">
      {/* 代码编辑器 */}
      <CodeEditor 
        value={composition.html}
        onChange={(html) => onChange({ ...composition, html })}
        language="html"
      />
      
      {/* 预览窗口 */}
      <HyperFramesPreview composition={composition} />
      
      {/* 工具栏 */}
      <HyperFramesToolbar 
        onAddBlock={handleAddBlock}
        onValidate={handleValidate}
        onRender={handleRender}
      />
    </div>
  )
}
```

**编辑器激活方式**:
1. 双击时间线上的HTML动画片段
2. 右键菜单"编辑HTML动画"
3. 点击属性面板的"编辑代码"按钮

---

## 3. 数据模型设计

### 3.1 统一项目数据模型

**扩展FreeCut的Project Schema**:

```typescript
// src/types/project.ts (扩展)

interface Project {
  // ... FreeCut原有字段
  id: string
  name: string
  duration: number
  metadata: ProjectResolution
  timeline: ProjectTimeline
  
  // 新增:HyperFrames相关
  hyperframes?: {
    compositions: Record<string, HyperFramesComposition>
    skills?: {
      enabled: string[]  // 启用的skills列表
      history: SkillExecutionHistory[]  // AI操作历史
    }
    renderConfig?: {
      engine: 'freecut' | 'hyperframes' | 'auto'
      quality: 'preview' | 'production'
    }
  }
}

interface ProjectTimeline {
  // ... FreeCut原有字段
  tracks: Array<Track>
  items: Array<TimelineItem | HyperFramesCompositionItem>  // 扩展类型
  
  // 新增:全局设置
  hyperframesEnabled?: boolean  // 是否启用HyperFrames功能
}
```

### 3.2 双向转换器设计

**FreeCut → HyperFrames转换**:

```typescript
// src/features/hyperframes-integration/converters/freecut-to-hyperframes.ts

interface ConversionOptions {
  includeMedia: boolean  // 是否包含媒体资源
  flattenGroups: boolean  // 是否展平组轨道
  exportResolution: { width: number; height: number }
}

function convertFreeCutToHyperFrames(
  project: Project,
  options: ConversionOptions
): HyperFramesComposition {
  const { width, height } = options.exportResolution
  const fps = project.metadata.fps || 30
  const duration = project.duration
  
  // 1. 创建stage div
  const stageHtml = `
    <div id="stage" 
         data-composition-id="${project.id}"
         data-start="0"
         data-width="${width}"
         data-height="${height}">
  `
  
  // 2. 遍历timeline items,转换为HTML元素
  const itemsHtml = project.timeline.items
    .map(item => convertItemToHtml(item, fps))
    .join('\n')
  
  // 3. 生成GSAP动画脚本
  const animationScript = generateGsapAnimations(project)
  
  // 4. 组合完整HTML
  const html = `
    ${stageHtml}
    ${itemsHtml}
    ${animationScript}
    </div>
  `
  
  return {
    id: project.id,
    width,
    height,
    duration,
    fps,
    html,
    assets: extractAssets(project),
    timelines: parseTimelines(animationScript)
  }
}

function convertItemToHtml(
  item: TimelineItem, 
  fps: number
): string {
  const startSec = item.from / fps
  const durationSec = item.durationInFrames / fps
  
  switch (item.type) {
    case 'video':
      return `
        <video 
          class="clip"
          data-start="${startSec}"
          data-duration="${durationSec}"
          data-track-index="${item.trackId}"
          src="${item.src}"
          ${item.volume !== undefined ? `data-volume="${item.volume}"` : ''}
        ></video>
      `
    
    case 'text':
      return `
        <div 
          id="text-${item.id}"
          class="clip"
          data-start="${startSec}"
          data-duration="${durationSec}"
          data-track-index="${item.trackId}"
          style="${generateTextStyle(item)}"
        >
          ${item.text}
        </div>
      `
    
    // ... 其他类型转换
  }
}
```

**HyperFrames → FreeCut转换**:

```typescript
// src/features/hyperframes-integration/converters/hyperframes-to-freecut.ts

function convertHyperFramesToFreeCut(
  composition: HyperFramesComposition,
  targetProject: Project
): ProjectTimeline {
  // 1. 解析HTML,提取clip元素
  const clips = parseHtmlClips(composition.html)
  
  // 2. 转换为FreeCut timeline items
  const items: TimelineItem[] = clips.map(clip => {
    return {
      id: generateId(),
      trackId: findOrCreateTrack(clip.trackIndex),
      from: clip.start * targetProject.metadata.fps,
      durationInFrames: clip.duration * targetProject.metadata.fps,
      type: inferItemType(clip),
      src: clip.src,
      label: clip.id || 'Imported',
      // ... 其他属性映射
    }
  })
  
  // 3. 解析GSAP动画,转换为关键帧
  const keyframes = parseGsapToKeyframes(composition.timelines)
  
  return {
    tracks: generateTracks(items),
    items: items,
    // ... 其他timeline属性
  }
}
```

### 3.3 数据持久化

**存储策略**:
1. **项目元数据**: OPFS (FreeCut现有机制)
2. **媒体资源**: 文件系统引用(FreeCut现有机制)
3. **HyperFrames compositions**: 单独的JSON文件,存储在项目目录下

**目录结构**:
```
workspace/
└── projects/
    └── my-video-project/
        ├── project.json           # FreeCut项目文件
        ├── compositions/          # HyperFrames compositions
        │   ├── comp-1.html       # HTML动画1
        │   ├── comp-1.json       # 元数据
        │   └── comp-2.html       # HTML动画2
        ├── media/                # 媒体资源(软链接)
        └── cache/                # 缓存(波形、缩略图等)
```

---

## 4. 渲染管道设计

### 4.1 渲染引擎选择逻辑

**智能渲染引擎选择器**:

```typescript
// src/features/export/rendering-engine-selector.ts

type RenderingEngine = 'freecut' | 'hyperframes' | 'hybrid'

interface RenderingEngineDecision {
  engine: RenderingEngine
  reason: string
  estimatedTime: number
  quality: 'preview' | 'production'
}

function selectRenderingEngine(
  project: Project
): RenderingEngineDecision {
  // 分析项目复杂度
  const hasHyperFramesItems = project.timeline.items.some(
    item => item.type === 'hyperframes-composition'
  )
  
  const hasComplexAnimations = analyzeAnimationComplexity(project)
  const hasAdvancedEffects = project.timeline.items.some(
    item => item.effects && item.effects.length > 5
  )
  
  // 决策逻辑
  if (!hasHyperFramesItems && !hasComplexAnimations) {
    // 纯FreeCut项目,使用WebCodecs快速导出
    return {
      engine: 'freecut',
      reason: '项目仅包含基础NLE编辑,使用FreeCut快速导出',
      estimatedTime: estimateFreeCutExportTime(project),
      quality: 'production'
    }
  }
  
  if (hasHyperFramesItems && !hasAdvancedEffects) {
    // 纯HyperFrames动画,使用HyperFrames Producer
    return {
      engine: 'hyperframes',
      reason: '项目包含HTML动画,使用HyperFrames高质量渲染',
      estimatedTime: estimateHyperFramesExportTime(project),
      quality: 'production'
    }
  }
  
  // 混合项目,两阶段渲染
  return {
    engine: 'hybrid',
    reason: '混合项目,将使用两阶段渲染后合成',
    estimatedTime: estimateHybridExportTime(project),
    quality: 'production'
  }
}
```

### 4.2 FreeCut导出管道(基础)

**适用场景**:
- 纯NLE编辑项目
- 无复杂HTML动画
- 追求快速导出

**流程**:
```
FreeCut Timeline
  ↓
WebCodecs渲染
  ↓
MP4/WebM输出
```

**实现**: 使用FreeCut现有的`features/export/`模块

### 4.3 HyperFrames导出管道(高级)

**适用场景**:
- 包含HTML动画
- 复杂的GSAP/Lottie动画
- 需要HyperFrames特有功能

**流程**:
```
HyperFrames Composition
  ↓
转换为HTML文件
  ↓
HyperFrames Producer
  (Puppeteer + FFmpeg)
  ↓
MP4输出
```

**实现方案**:

```typescript
// src/features/export/hyperframes-export.ts

interface HyperFramesExportOptions {
  composition: HyperFramesComposition
  outputPath: string
  quality: 'preview' | 'production'
  onProgress: (progress: number) => void
}

async function exportWithHyperFrames(
  options: HyperFramesExportOptions
): Promise<string> {
  // 1. 准备composition文件
  const compositionPath = await writeCompositionToTemp(options.composition)
  
  // 2. 调用HyperFrames CLI (通过Node.js子进程)
  const result = await executeHyperFramesRender({
    input: compositionPath,
    output: options.outputPath,
    quality: options.quality,
    onProgress: options.onProgress
  })
  
  // 3. 清理临时文件
  await cleanupTempFiles(compositionPath)
  
  return result.outputPath
}

async function executeHyperFramesRender(config: any) {
  // 需要在Node.js环境中运行
  // 可以通过Electron或Tauri实现
  // 或者提供服务器端API
  
  return spawn('npx', [
    'hyperframes',
    'render',
    config.input,
    '--output', config.output,
    '--quality', config.quality
  ])
}
```

### 4.4 混合渲染管道(复杂)

**适用场景**:
- 同时包含NLE编辑和HTML动画
- 需要最大灵活性

**流程**:
```
1. 分离项目为两部分:
   - FreeCut部分 (video/audio/text items)
   - HyperFrames部分 (hyperframes-composition items)

2. 分别渲染:
   Phase A: FreeCut渲染 → video_a.mp4
   Phase B: HyperFrames渲染 → video_b.mp4

3. 合成:
   FFmpeg合成 video_a.mp4 + video_b.mp4 → final.mp4
```

**实现**:

```typescript
// src/features/export/hybrid-export.ts

async function exportHybridProject(
  project: Project,
  outputPath: string
): Promise<string> {
  // 1. 分析并分离项目
  const { freecutPart, hyperframesPart } = separateProject(project)
  
  // 2. 并行渲染两部分
  const [freecutVideo, hyperframesVideo] = await Promise.all([
    exportWithFreeCut(freecutPart),
    exportWithHyperFrames(hyperframesPart)
  ])
  
  // 3. 使用FFmpeg合成
  const finalVideo = await compositeVideos({
    layers: [
      { src: freecutVideo, zIndex: 0 },
      { src: hyperframesVideo, zIndex: 1 }
    ],
    output: outputPath,
    resolution: project.metadata
  })
  
  // 4. 清理中间文件
  await cleanup([freecutVideo, hyperframesVideo])
  
  return finalVideo
}

function separateProject(project: Project) {
  const freecutItems = project.timeline.items.filter(
    item => item.type !== 'hyperframes-composition'
  )
  
  const hyperframesItems = project.timeline.items.filter(
    item => item.type === 'hyperframes-composition'
  )
  
  return {
    freecutPart: { ...project, timeline: { ...project.timeline, items: freecutItems } },
    hyperframesPart: convertToHyperFramesProject(hyperframesItems)
  }
}
```

---

**文档状态**: 第2部分 - 技术设计(1/2)完成  
**下一节**: AI功能整合、实施路径
