import { describe, expect, it, vi } from 'vite-plus/test'
import type { FreeCutStudioTimelineItem } from './types'
import {
  createHyperFramesTimelineActionRequest,
  emitHyperFramesTimelineAction,
  subscribeHyperFramesTimelineActions,
} from './timelineActions'

const item: FreeCutStudioTimelineItem = {
  id: 'item-1',
  trackId: 'track-1',
  from: 20,
  durationInFrames: 100,
  label: 'HF clip',
  type: 'composition',
  compositionId: 'hf-project',
  sourceKind: 'hyperframes',
  hyperframesProjectId: 'hf-project',
  activeCompositionPath: 'compositions/main.html',
  hyperframesManifestPath: 'hyperframes/hf-project/manifest.json',
  compositionWidth: 1920,
  compositionHeight: 1080,
}

describe('HyperFrames timeline actions', () => {
  it('creates source-safe requests without outer trim values', () => {
    expect(createHyperFramesTimelineActionRequest('rerender', item)).toEqual({
      action: 'rerender',
      timelineItemId: 'item-1',
      hyperframesProjectId: 'hf-project',
      activeCompositionPath: 'compositions/main.html',
      manifestPath: 'hyperframes/hf-project/manifest.json',
    })
  })

  it('publishes typed requests to subscribers', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeHyperFramesTimelineActions(listener)
    emitHyperFramesTimelineAction('export-project', item)
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ action: 'export-project' }))
    unsubscribe()
  })
})
