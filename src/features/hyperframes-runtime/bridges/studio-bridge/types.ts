import type { HyperFramesDiagnostic, HyperFramesProjectManifest } from '@/types/hyperframes'
import type { CompositionItem, TimelineItem } from '@/types/timeline'

export type FreeCutStudioTimelineItem = CompositionItem & {
  sourceKind: 'hyperframes'
  hyperframesProjectId?: string
  activeCompositionPath?: string
}

export interface FreeCutStudioOpenRequest {
  item: FreeCutStudioTimelineItem
}

export interface FreeCutStudioFileState {
  path: string
  content: string
  originalContent: string
  dirty: boolean
}

export interface FreeCutStudioReadyState {
  status: 'ready'
  freecutProjectId: string
  hyperframesProjectId: string
  item: FreeCutStudioTimelineItem
  manifest: HyperFramesProjectManifest
  files: FreeCutStudioFileState[]
  activeFilePath: string
  activeContent: string
  dirtyFilePaths: string[]
  diagnostics: HyperFramesDiagnostic[]
  saving: boolean
}

export type FreeCutStudioSessionState =
  | { status: 'idle' }
  | { status: 'loading'; hyperframesProjectId: string }
  | { status: 'error'; hyperframesProjectId: string; message: string }
  | FreeCutStudioReadyState

export function resolveHyperFramesStudioItem(
  item: TimelineItem | null | undefined,
): FreeCutStudioTimelineItem | null {
  if (!item || item.type !== 'composition') return null
  if (item.sourceKind !== 'hyperframes') return null
  const projectId = item.hyperframesProjectId ?? item.compositionId
  const compositionPath = item.activeCompositionPath
  if (!projectId || !compositionPath) return null
  return {
    ...item,
    sourceKind: 'hyperframes',
    hyperframesProjectId: projectId,
    activeCompositionPath: compositionPath,
  }
}

export function isHyperFramesStudioTimelineItem(
  item: TimelineItem | null | undefined,
): item is FreeCutStudioTimelineItem {
  return resolveHyperFramesStudioItem(item) !== null
}
