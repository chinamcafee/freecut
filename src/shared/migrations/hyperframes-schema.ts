/**
 * HyperFrames类型的Zod验证Schema
 *
 * 提供运行时数据验证，确保HyperFrames数据的完整性和正确性
 */

import { z } from 'zod'

// ============================================================================
// 基础类型Schema
// ============================================================================

/**
 * 帧率Schema
 */
export const FpsSchema = z.object({
  num: z.number().int().positive(),
  den: z.number().int().positive(),
})

/**
 * 画布分辨率Schema
 */
export const CanvasResolutionSchema = z.enum([
  '1920x1080',
  '1080x1920',
  '1080x1080',
  '3840x2160',
  '2160x3840',
])

/**
 * 媒体类型Schema
 */
export const MediaTypeSchema = z.enum(['video', 'audio', 'image'])

/**
 * Timeline元素类型Schema
 */
export const TimelineElementTypeSchema = z.enum(['text', 'media', 'composition'])

// ============================================================================
// Asset Schema
// ============================================================================

/**
 * HyperFrames资源Schema
 */
export const HyperFramesAssetSchema = z.object({
  type: MediaTypeSchema,
  src: z.string(),
  localPath: z.string().optional(),
  duration: z.number().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  hasAudio: z.boolean().optional(),
})

// ============================================================================
// Timeline元素Schema
// ============================================================================

/**
 * Timeline元素基础Schema
 */
const TimelineElementBaseSchema = z.object({
  id: z.string(),
  type: TimelineElementTypeSchema,
  start: z.number().nonnegative(),
  duration: z.number().positive(),
  trackIndex: z.number().int().nonnegative(),
})

/**
 * 媒体Timeline元素Schema
 */
export const TimelineMediaElementSchema = TimelineElementBaseSchema.extend({
  type: z.literal('media'),
  mediaType: MediaTypeSchema,
  src: z.string(),
  volume: z.number().min(0).max(1).optional(),
  hasAudio: z.boolean().optional(),
})

/**
 * 文本Timeline元素Schema
 */
export const TimelineTextElementSchema = TimelineElementBaseSchema.extend({
  type: z.literal('text'),
  content: z.string(),
  fontSize: z.number().positive().optional(),
  fontFamily: z.string().optional(),
  color: z.string().optional(),
})

/**
 * 子Composition元素Schema
 */
export const TimelineCompositionElementSchema = TimelineElementBaseSchema.extend({
  type: z.literal('composition'),
  compositionId: z.string(),
  compositionSrc: z.string().optional(),
})

/**
 * Timeline元素联合Schema
 */
export const TimelineElementSchema = z.union([
  TimelineMediaElementSchema,
  TimelineTextElementSchema,
  TimelineCompositionElementSchema,
])

// ============================================================================
// 变量系统Schema
// ============================================================================

/**
 * 变量类型Schema
 */
export const VariableTypeSchema = z.enum(['string', 'number', 'boolean', 'color'])

/**
 * Composition变量Schema
 */
export const HyperFramesVariableSchema = z.object({
  name: z.string(),
  type: VariableTypeSchema,
  default: z.union([z.string(), z.number(), z.boolean()]),
  description: z.string().optional(),
  required: z.boolean().optional(),
})

// ============================================================================
// HyperFrames Composition Schema
// ============================================================================

/**
 * HyperFrames Composition Schema
 */
export const HyperFramesCompositionSchema = z.object({
  id: z.string(),
  name: z.string(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  duration: z.number().positive(),
  fps: FpsSchema,
  html: z.string(),
  assets: z.array(HyperFramesAssetSchema),
  elements: z.array(TimelineElementSchema).optional(),
  timelines: z.record(z.string(), z.unknown()).optional(),
  backgroundColor: z.string().optional(),
  createdAt: z.number().optional(),
  updatedAt: z.number().optional(),
  variables: z.array(HyperFramesVariableSchema).optional(),
})

// ============================================================================
// 渲染配置Schema
// ============================================================================

/**
 * 渲染引擎Schema
 */
export const RenderingEngineSchema = z.enum(['freecut', 'hyperframes', 'hybrid'])

/**
 * 渲染质量Schema
 */
export const RenderQualitySchema = z.enum(['preview', 'production'])

/**
 * 视频编码格式Schema
 */
export const VideoCodecSchema = z.enum(['h264', 'h265', 'vp9', 'prores'])

/**
 * HyperFrames渲染配置Schema
 */
export const HyperFramesRenderConfigSchema = z.object({
  engine: RenderingEngineSchema,
  quality: RenderQualitySchema,
  codec: VideoCodecSchema.optional(),
  crf: z.number().int().min(0).max(51).optional(),
  transparent: z.boolean().optional(),
  ffmpegArgs: z.array(z.string()).optional(),
})

// ============================================================================
// AI技能系统Schema
// ============================================================================

/**
 * 技能执行历史Schema
 */
export const SkillExecutionHistorySchema = z.object({
  skillId: z.string(),
  skillName: z.string(),
  executedAt: z.number(),
  input: z.record(z.string(), z.unknown()),
  output: z.string().optional(),
  status: z.enum(['success', 'failed', 'pending']),
  error: z.string().optional(),
  duration: z.number().optional(),
})

// ============================================================================
// 验证函数
// ============================================================================

/**
 * 验证HyperFrames Composition数据
 */
export function validateComposition(data: unknown) {
  return HyperFramesCompositionSchema.safeParse(data)
}

/**
 * 验证Asset数据
 */
export function validateAsset(data: unknown) {
  return HyperFramesAssetSchema.safeParse(data)
}

/**
 * 验证Timeline元素数据
 */
export function validateTimelineElement(data: unknown) {
  return TimelineElementSchema.safeParse(data)
}

/**
 * 验证渲染配置数据
 */
export function validateRenderConfig(data: unknown) {
  return HyperFramesRenderConfigSchema.safeParse(data)
}

/**
 * 验证技能执行历史数据
 */
export function validateSkillHistory(data: unknown) {
  return SkillExecutionHistorySchema.safeParse(data)
}

// ============================================================================
// 类型推断导出
// ============================================================================

export type ValidatedComposition = z.infer<typeof HyperFramesCompositionSchema>
export type ValidatedAsset = z.infer<typeof HyperFramesAssetSchema>
export type ValidatedTimelineElement = z.infer<typeof TimelineElementSchema>
export type ValidatedRenderConfig = z.infer<typeof HyperFramesRenderConfigSchema>
export type ValidatedSkillHistory = z.infer<typeof SkillExecutionHistorySchema>
