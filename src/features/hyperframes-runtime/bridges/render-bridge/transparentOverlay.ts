import type { HyperFramesProjectManifest } from '@/types/hyperframes'
import type { CompositionItem } from '@/types/timeline'
import type { HyperFramesRenderOutput, HyperFramesRenderJobState } from './renderJobStore'
import type { HyperFramesRenderRequest } from './HyperFramesRenderService'
import { HyperFramesRenderService } from './HyperFramesRenderService'

export type HyperFramesAlphaFormat = 'webm' | 'mov' | 'png-sequence'

export interface HyperFramesTransparentOverlaySettings {
  projectDirectoryPath: string
  format?: HyperFramesAlphaFormat
  quality?: HyperFramesRenderRequest['quality']
  includeAudio?: boolean
}

export interface FreeCutTransparentOverlayDescriptor {
  projectId: string
  timelineItemId: string
  sourceCompositionPath: string
  output: HyperFramesRenderOutput
  from: number
  durationInFrames: number
  width: number
  height: number
  fps: number
  alphaMode: 'straight'
  includeAudio: boolean
}

export function createTransparentOverlayRenderRequest(
  item: CompositionItem,
  manifest: HyperFramesProjectManifest,
  settings: HyperFramesTransparentOverlaySettings,
): HyperFramesRenderRequest {
  if (item.sourceKind !== 'hyperframes') {
    throw new Error('Transparent HyperFrames overlay requires a source-linked composition.')
  }
  const format = settings.format ?? 'webm'
  return {
    projectId: manifest.id,
    projectDirectoryPath: settings.projectDirectoryPath,
    compositionPath: item.activeCompositionPath ?? manifest.activeCompositionPath,
    width: manifest.canvas.width,
    height: manifest.canvas.height,
    fps: manifest.canvas.fps,
    durationInFrames: item.durationInFrames,
    quality: settings.quality ?? 'high',
    format,
    alpha: true,
    includeAudio: settings.includeAudio ?? false,
  }
}

export async function renderHyperFramesTransparentOverlay(
  service: HyperFramesRenderService,
  item: CompositionItem,
  manifest: HyperFramesProjectManifest,
  settings: HyperFramesTransparentOverlaySettings,
): Promise<HyperFramesRenderJobState> {
  return service.start(createTransparentOverlayRenderRequest(item, manifest, settings))
}

export function createFreeCutTransparentOverlayDescriptor(
  item: CompositionItem,
  manifest: HyperFramesProjectManifest,
  output: HyperFramesRenderOutput,
  includeAudio = false,
): FreeCutTransparentOverlayDescriptor {
  if (!output.alpha) throw new Error('Producer output does not contain an alpha channel.')
  if (output.format !== 'webm' && output.format !== 'mov' && output.format !== 'png-sequence') {
    throw new Error(`Unsupported transparent overlay format: ${output.format}`)
  }
  return {
    projectId: manifest.id,
    timelineItemId: item.id,
    sourceCompositionPath: item.activeCompositionPath ?? manifest.activeCompositionPath,
    output: { ...output },
    from: item.from,
    durationInFrames: item.durationInFrames,
    width: manifest.canvas.width,
    height: manifest.canvas.height,
    fps: manifest.canvas.fps,
    alphaMode: 'straight',
    includeAudio,
  }
}
