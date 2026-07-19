import type { FreeCutStudioTimelineItem } from './types'

export type HyperFramesTimelineAction =
  | 'convert-to-native'
  | 'export-project'
  | 'relink-project'
  | 'rerender'
  | 'view-source'

export interface HyperFramesTimelineActionRequest {
  action: HyperFramesTimelineAction
  timelineItemId: string
  hyperframesProjectId: string
  activeCompositionPath: string
  manifestPath?: string
}

export const HYPERFRAMES_TIMELINE_ACTION_EVENT = 'freecut:hyperframes-timeline:action'

export function createHyperFramesTimelineActionRequest(
  action: HyperFramesTimelineAction,
  item: FreeCutStudioTimelineItem,
): HyperFramesTimelineActionRequest {
  const hyperframesProjectId = item.hyperframesProjectId ?? item.compositionId
  if (!hyperframesProjectId || !item.activeCompositionPath) {
    throw new Error('HyperFrames timeline action requires a linked project and composition path')
  }
  return {
    action,
    timelineItemId: item.id,
    hyperframesProjectId,
    activeCompositionPath: item.activeCompositionPath,
    manifestPath: item.hyperframesManifestPath,
  }
}

export function emitHyperFramesTimelineAction(
  action: HyperFramesTimelineAction,
  item: FreeCutStudioTimelineItem,
): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent<HyperFramesTimelineActionRequest>(HYPERFRAMES_TIMELINE_ACTION_EVENT, {
      detail: createHyperFramesTimelineActionRequest(action, item),
    }),
  )
}

export function subscribeHyperFramesTimelineActions(
  listener: (request: HyperFramesTimelineActionRequest) => void,
): () => void {
  if (typeof window === 'undefined') return () => {}
  const handleAction = (event: Event) => {
    const request = (event as CustomEvent<HyperFramesTimelineActionRequest>).detail
    if (!request?.action || !request.hyperframesProjectId || !request.timelineItemId) return
    listener(request)
  }
  window.addEventListener(HYPERFRAMES_TIMELINE_ACTION_EVENT, handleAction)
  return () => window.removeEventListener(HYPERFRAMES_TIMELINE_ACTION_EVENT, handleAction)
}
