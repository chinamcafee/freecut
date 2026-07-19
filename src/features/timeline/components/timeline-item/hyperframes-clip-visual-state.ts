import type { TimelineItem } from '@/types/timeline'

export interface HyperFramesClipVisualState {
  cacheStatus: 'fresh' | 'missing' | 'stale'
  diagnosticStatus: 'error' | 'ready' | 'warning'
  renderStatus: 'idle' | 'rendering'
  studioDirty: boolean
}

export function getHyperFramesClipVisualState(
  item: TimelineItem,
): HyperFramesClipVisualState | undefined {
  if (item.type !== 'composition' || item.sourceKind !== 'hyperframes') return undefined
  return {
    cacheStatus: item.hyperframesVisualState?.cacheStatus ?? 'missing',
    diagnosticStatus: item.hyperframesVisualState?.diagnosticStatus ?? 'ready',
    renderStatus: item.hyperframesVisualState?.renderStatus ?? 'idle',
    studioDirty: item.hyperframesVisualState?.studioDirty ?? false,
  }
}

export function getHyperFramesClipColorClasses(item: TimelineItem): string | undefined {
  const state = getHyperFramesClipVisualState(item)
  if (!state) return undefined
  if (state.renderStatus === 'rendering') return 'bg-sky-600/35 border-sky-300'
  if (state.diagnosticStatus === 'error') return 'bg-red-700/35 border-red-400'
  if (state.diagnosticStatus === 'warning' || state.cacheStatus === 'stale') {
    return 'bg-amber-600/35 border-amber-300'
  }
  if (state.cacheStatus === 'fresh') return 'bg-cyan-700/35 border-cyan-300'
  return 'bg-teal-700/35 border-teal-300'
}
