import type { ProjectTimeline } from './project'
import type { CompositionItem } from './timeline'

describe('HyperFrames source-linked composition items', () => {
  it('uses the existing composition item type for HyperFrames timeline links', () => {
    const item: CompositionItem = {
      id: 'item-hf-intro',
      trackId: 'track-video',
      from: 0,
      durationInFrames: 150,
      label: 'HyperFrames Intro',
      type: 'composition',
      compositionId: 'hf-project-intro',
      sourceKind: 'hyperframes',
      hyperframesProjectId: 'hf-project-intro',
      activeCompositionPath: 'compositions/main.html',
      hyperframesManifestPath: 'manifest.json',
      compositionWidth: 1920,
      compositionHeight: 1080,
    }

    expect(item.type).toBe('composition')
    expect(item.sourceKind).toBe('hyperframes')
    expect(item.hyperframesProjectId).toBe(item.compositionId)
  })

  it('persists HyperFrames source-link fields in project timeline items', () => {
    const timeline: ProjectTimeline = {
      tracks: [
        {
          id: 'track-video',
          name: 'Video',
          height: 120,
          locked: false,
          visible: true,
          muted: false,
          solo: false,
          order: 0,
        },
      ],
      items: [
        {
          id: 'item-hf-intro',
          trackId: 'track-video',
          from: 0,
          durationInFrames: 150,
          label: 'HyperFrames Intro',
          type: 'composition',
          compositionId: 'hf-project-intro',
          sourceKind: 'hyperframes',
          hyperframesProjectId: 'hf-project-intro',
          activeCompositionPath: 'compositions/main.html',
          hyperframesManifestPath: 'manifest.json',
          compositionWidth: 1920,
          compositionHeight: 1080,
        },
      ],
    }

    expect(timeline.items[0]?.type).toBe('composition')
    expect(timeline.items[0]?.sourceKind).toBe('hyperframes')
  })
})
