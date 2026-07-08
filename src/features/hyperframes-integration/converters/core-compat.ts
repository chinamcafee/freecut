import type { HyperFramesProjectDirectory } from '@/types/hyperframes'
import type { ProjectTimeline } from '@/types/project'

type TimelineItem = ProjectTimeline['items'][number]

export interface ConverterDiagnostic {
  code: 'missing-entry' | 'missing-active-composition' | 'unsafe-html'
  severity: 'error' | 'warning'
  message: string
}

export interface UnsupportedFeatureWarning {
  itemId: string
  feature:
    | 'webgpu-effect'
    | 'mask'
    | 'corner-pin'
    | 'audio-eq'
    | 'text-motion'
    | 'custom-js'
  severity: 'warning'
  message: string
}

export function validateHyperFramesProjectDirectory(directory: HyperFramesProjectDirectory): {
  diagnostics: ConverterDiagnostic[]
  signature: string
} {
  const diagnostics: ConverterDiagnostic[] = []
  if (directory.files[directory.entryFile] === undefined) {
    diagnostics.push({
      code: 'missing-entry',
      severity: 'error',
      message: `Missing entry file: ${directory.entryFile}`,
    })
  }
  if (directory.files[directory.activeCompositionPath] === undefined) {
    diagnostics.push({
      code: 'missing-active-composition',
      severity: 'error',
      message: `Missing active composition: ${directory.activeCompositionPath}`,
    })
  }
  for (const [path, contents] of Object.entries(directory.files)) {
    if (/<script(?![^>]*type=["']application\/json["'])/i.test(contents) || /\son[a-z]+\s*=/i.test(contents)) {
      diagnostics.push({
        code: 'unsafe-html',
        severity: 'warning',
        message: `Potentially unsafe HTML in ${path}`,
      })
    }
  }

  return {
    diagnostics,
    signature: stableHash(
      Object.keys(directory.files)
        .sort()
        .map((path) => `${path}:${stableHash(directory.files[path] ?? '')}`)
        .join('|'),
    ),
  }
}

export function classifyUnsupportedFeatures(items: TimelineItem[]): UnsupportedFeatureWarning[] {
  const warnings: UnsupportedFeatureWarning[] = []

  for (const item of items) {
    const record = item as Record<string, unknown>
    const effects = Array.isArray(record.effects)
      ? (record.effects as Array<{ type?: string; enabled?: boolean }>)
      : []
    if (effects.some((effect) => effect.enabled)) {
      for (const effect of effects.filter((effect) => effect.enabled)) {
        warnings.push({
          itemId: item.id,
          feature: 'webgpu-effect',
          severity: 'warning',
          message: `GPU/video effect ${effect.type} is preserved as an unsupported feature warning`,
        })
      }
    }
    if (record.cornerPin) {
      warnings.push({
        itemId: item.id,
        feature: 'corner-pin',
        severity: 'warning',
        message: 'Corner pin perspective transforms are not losslessly represented in HyperFrames HTML',
      })
    }
    if (record.textMotion) {
      warnings.push({
        itemId: item.id,
        feature: 'text-motion',
        severity: 'warning',
        message: 'FreeCut text motion is exported as static text with an unsupported feature warning',
      })
    }
    if (hasAudioEq(item)) {
      warnings.push({
        itemId: item.id,
        feature: 'audio-eq',
        severity: 'warning',
        message: 'Audio EQ stays in FreeCut mix metadata and is not rendered by HyperFrames',
      })
    }
    if (item.type === 'shape' && record.isMask) {
      warnings.push({
        itemId: item.id,
        feature: 'mask',
        severity: 'warning',
        message: 'Mask shapes are not losslessly represented in HyperFrames HTML',
      })
    }
  }

  return warnings
}

function hasAudioEq(item: TimelineItem): boolean {
  const record = item as Record<string, unknown>
  return Object.keys(record).some((key) => key.startsWith('audioEq') && record[key])
}

function stableHash(input: string): string {
  let hash = 5381
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 33) ^ input.charCodeAt(index)
  }
  return (hash >>> 0).toString(16)
}
