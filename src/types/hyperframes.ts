/**
 * HyperFrames集成类型定义
 *
 * 定义HyperFrames composition和相关数据结构
 * 用于在FreeCut中支持HTML动画和HyperFrames渲染
 */

// ============================================================================
// 基础类型
// ============================================================================

/**
 * 帧率类型（使用有理数表示，避免浮点数精度问题）
 */
export interface Fps {
  num: number // 分子
  den: number // 分母
}

/**
 * 画布分辨率预设
 */
export type CanvasResolution =
  | '1920x1080' // 16:9 横屏
  | '1080x1920' // 9:16 竖屏（手机）
  | '1080x1080' // 1:1 正方形
  | '3840x2160' // 4K
  | '2160x3840' // 4K 竖屏

/**
 * Timeline元素类型
 */
export type TimelineElementType = 'text' | 'media' | 'composition'

/**
 * 媒体类型
 */
export type MediaType = 'video' | 'audio' | 'image'

// ============================================================================
// Asset类型
// ============================================================================

/**
 * HyperFrames资源
 */
export interface HyperFramesAsset {
  type: MediaType
  src: string // 资源URL或路径
  localPath?: string // 本地文件路径（用于OPFS存储）
  duration?: number // 媒体时长（秒）
  width?: number // 视频/图片宽度
  height?: number // 视频/图片高度
  hasAudio?: boolean // 视频是否包含音频
}

/**
 * HyperFrames项目目录中的资源引用。
 */
export interface HyperFramesAssetRef {
  id: string
  type: MediaType
  sourcePath: string
  projectPath: string
  hash: string
  duration?: number
  width?: number
  height?: number
  hasAudio?: boolean
}

// ============================================================================
// Timeline元素类型
// ============================================================================

/**
 * Timeline元素基础接口
 */
export interface TimelineElementBase {
  id: string
  type: TimelineElementType
  start: number // 开始时间（秒）
  duration: number // 持续时间（秒）
  trackIndex: number // 轨道索引（控制z-index）
}

/**
 * 媒体Timeline元素
 */
export interface TimelineMediaElement extends TimelineElementBase {
  type: 'media'
  mediaType: MediaType
  src: string
  volume?: number // 音量（0.0-1.0）
  hasAudio?: boolean
}

/**
 * 文本Timeline元素
 */
export interface TimelineTextElement extends TimelineElementBase {
  type: 'text'
  content: string
  fontSize?: number
  fontFamily?: string
  color?: string
}

/**
 * 子Composition元素
 */
export interface TimelineCompositionElement extends TimelineElementBase {
  type: 'composition'
  compositionId: string
  compositionSrc?: string // 子Composition的HTML路径
}

/**
 * Timeline元素联合类型
 */
export type TimelineElement =
  | TimelineMediaElement
  | TimelineTextElement
  | TimelineCompositionElement

// ============================================================================
// HyperFrames Composition
// ============================================================================

/**
 * HyperFrames Composition核心数据结构
 *
 * 代表一个完整的HTML动画composition，包含所有必要的元数据、
 * HTML内容、资源和动画timeline信息
 */
export interface HyperFramesComposition {
  /** Composition唯一标识符 */
  id: string

  /** Composition名称 */
  name: string

  /** 画布宽度（像素） */
  width: number

  /** 画布高度（像素） */
  height: number

  /** 总时长（秒） */
  duration: number

  /** 帧率 */
  fps: Fps

  /** 完整的HTML内容 */
  html: string

  /** 资源列表 */
  assets: HyperFramesAsset[]

  /** Timeline元素列表（可选，从HTML解析） */
  elements?: TimelineElement[]

  /** GSAP timelines数据（可选，JSON序列化） */
  timelines?: Record<string, unknown>

  /** 背景颜色 */
  backgroundColor?: string

  /** 创建时间戳 */
  createdAt?: number

  /** 更新时间戳 */
  updatedAt?: number

  /** Composition变量定义（用于动态内容） */
  variables?: HyperFramesVariable[]
}

// ============================================================================
// Composition变量系统
// ============================================================================

/**
 * Composition变量类型
 */
export type VariableType = 'string' | 'number' | 'boolean' | 'color'

/**
 * Composition变量定义
 *
 * 用于支持动态内容，允许在渲染时传递不同的值
 */
export interface HyperFramesVariable {
  /** 变量名称 */
  name: string

  /** 变量类型 */
  type: VariableType

  /** 默认值 */
  default: string | number | boolean

  /** 变量描述 */
  description?: string

  /** 是否必需 */
  required?: boolean
}

// ============================================================================
// Manifest-backed project directory model
// ============================================================================

/**
 * HyperFrames project directory manifest.
 *
 * The canonical source for HyperFrames-backed animation lives in a project
 * directory, not in a timeline item or JSON HTML blob.
 */
export interface HyperFramesProjectManifest {
  id: string
  name: string
  schemaVersion: number
  projectDir: string
  entryFile: 'index.html' | string
  activeCompositionPath: string
  width: number
  height: number
  fps: Fps
  durationInFrames: number
  backgroundColor?: string
  assets: HyperFramesAssetRef[]
  compositions: Array<{
    id: string
    path: string
    name: string
    durationInFrames: number
  }>
  source: 'freecut-export' | 'hyperframes-project' | 'legacy-composition' | 'skill-output'
  provenance?: HyperFramesProvenance
  warnings?: string[]
  unsupportedFeatures?: string[]
  createdAt: number
  updatedAt: number
}

/**
 * Mapping from a FreeCut composition timeline item to a HyperFrames project
 * directory and active composition file.
 */
export interface HyperFramesCompositionLink {
  timelineItemId: string
  projectId: string
  sourceKind: 'hyperframes'
  activeCompositionPath: string
  manifestPath: string
  thumbnailPath?: string
  renderCacheKey?: string
  includeAudioInProducer?: boolean
}

export interface HyperFramesProjectFile {
  path: string
  contents: string
  kind: 'manifest' | 'entry' | 'composition' | 'asset-placeholder' | 'metadata'
  hash: string
}

export interface HyperFramesProjectDirectory {
  projectId: string
  rootPath: string
  manifest: HyperFramesProjectManifest
  entryFile: string
  activeCompositionPath: string
  files: Record<string, string>
  fileIndex: HyperFramesProjectFile[]
  assets: HyperFramesAssetRef[]
  warnings: string[]
  unsupportedFeatures: string[]
}

export interface HyperFramesRenderCacheEntry {
  key: string
  projectId: string
  status: 'pending' | 'ready' | 'error'
  outputPath?: string
  alphaPath?: string
  renderedAt?: number
  error?: string
}

export interface HyperFramesProvenance {
  source: 'freecut-export' | 'hyperframes-import' | 'skill-output' | 'legacy-migration'
  inputHash?: string
  outputHash?: string
  skillId?: string
  createdAt: number
  confirmedByUser?: boolean
}

export interface HyperFramesIntegrationState {
  schemaVersion: number
  projects: Record<string, HyperFramesProjectManifest>
  compositionLinks: Record<string, HyperFramesCompositionLink>
  renderCache?: Record<string, HyperFramesRenderCacheEntry>
  skills?: {
    enabled: string[]
    history: SkillExecutionHistory[]
  }
  renderConfig?: HyperFramesRenderConfig
}

// ============================================================================
// 渲染配置
// ============================================================================

/**
 * 渲染引擎类型
 */
export type RenderingEngine = 'freecut' | 'hyperframes-producer' | 'hybrid-overlay'

/**
 * 渲染质量预设
 */
export type RenderQuality = 'preview' | 'production'

/**
 * 视频编码格式
 */
export type VideoCodec = 'h264' | 'h265' | 'vp9' | 'prores'

/**
 * HyperFrames渲染配置
 */
export interface HyperFramesRenderConfig {
  /** 渲染引擎选择 */
  engine: RenderingEngine

  /** 渲染质量 */
  quality: RenderQuality

  /** 视频编码格式 */
  codec?: VideoCodec

  /** CRF质量值（越小质量越高，18为高质量） */
  crf?: number

  /** 是否透明背景 */
  transparent?: boolean

  /** 自定义FFmpeg参数 */
  ffmpegArgs?: string[]
}

// ============================================================================
// AI技能系统
// ============================================================================

/**
 * AI技能执行历史记录
 *
 * 记录在项目中使用的AI技能操作历史，用于追溯和重现
 */
export interface SkillExecutionHistory {
  /** 技能唯一标识符 */
  skillId: string

  /** 技能名称 */
  skillName: string

  /** 执行时间戳 */
  executedAt: number

  /** 输入参数 */
  input: Record<string, unknown>

  /** 输出结果引用（可能是composition ID） */
  output?: string

  /** 执行状态 */
  status: 'success' | 'failed' | 'pending'

  /** 错误信息（如果失败） */
  error?: string

  /** 执行时长（毫秒） */
  duration?: number
}

// ============================================================================
// 工具函数类型
// ============================================================================

/**
 * FPS转换为数字
 */
export function fpsToNumber(fps: Fps): number {
  return fps.num / fps.den
}

/**
 * FPS转换为FFmpeg参数格式
 */
export function fpsToFfmpegArg(fps: Fps): string {
  if (fps.den === 1) {
    return fps.num.toString()
  }
  return `${fps.num}/${fps.den}`
}

/**
 * 从字符串解析FPS
 */
export function parseFps(fpsString: string): Fps {
  if (fpsString.includes('/')) {
    const [num, den] = fpsString.split('/').map(Number) as [number, number]
    return { num, den }
  }
  return { num: parseInt(fpsString, 10), den: 1 }
}

/**
 * 获取画布分辨率的宽高
 */
export function getCanvasDimensions(resolution: CanvasResolution): {
  width: number
  height: number
} {
  const [width, height] = resolution.split('x').map(Number) as [number, number]
  return { width, height }
}
