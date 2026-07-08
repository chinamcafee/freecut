import { describe, expect, it } from 'vite-plus/test'
import type { HyperFramesIntegrationState } from '@/types/hyperframes'
import type { TimelineItem } from '@/types/timeline'
import {
  isHyperFramesCompositionItem,
  removeHyperFramesCompositionLink,
  resolveHyperFramesCompositionInfo,
  upsertHyperFramesCompositionLink,
} from './composition-links'

const compositionItem = {
  id: 'clip-hf',
  type: 'composition',
  trackId: 'track-1',
  from: 0,
  durationInFrames: 90,
  label: 'HF title',
  compositionId: 'hf-project',
  compositionWidth: 1920,
  compositionHeight: 1080,
  sourceKind: 'hyperframes',
  hyperframesProjectId: 'hf-project',
  activeCompositionPath: 'compositions/main.html',
  hyperframesManifestPath: 'hyperframes/hf-project/manifest.json',
} as TimelineItem

const hyperframes: HyperFramesIntegrationState = {
  schemaVersion: 1,
  projects: {
    'hf-project': {
      id: 'hf-project',
      name: 'HF title',
      schemaVersion: 1,
      projectDir: 'hyperframes/hf-project',
      entryFile: 'index.html',
      activeCompositionPath: 'compositions/main.html',
      width: 1920,
      height: 1080,
      fps: { num: 30, den: 1 },
      durationInFrames: 90,
      assets: [],
      compositions: [
        {
          id: 'main',
          path: 'compositions/main.html',
          name: 'Main',
          durationInFrames: 90,
        },
      ],
      source: 'hyperframes-project',
      createdAt: 1,
      updatedAt: 2,
    },
  },
  compositionLinks: {
    'clip-hf': {
      timelineItemId: 'clip-hf',
      projectId: 'hf-project',
      sourceKind: 'hyperframes',
      activeCompositionPath: 'compositions/main.html',
      manifestPath: 'hyperframes/hf-project/manifest.json',
      thumbnailPath: 'hyperframes/hf-project/thumb.png',
      renderCacheKey: 'cache-1',
    },
  },
  renderCache: {
    'cache-1': {
      key: 'cache-1',
      projectId: 'hf-project',
      status: 'ready',
      outputPath: 'renders/hf-project.webm',
    },
  },
}

describe('HyperFrames composition timeline links', () => {
  it('recognizes HyperFrames-backed composition items without creating a new item type', () => {
    expect(isHyperFramesCompositionItem(compositionItem)).toBe(true)
    expect(resolveHyperFramesCompositionInfo(compositionItem, hyperframes)).toMatchObject({
      isHyperFramesBacked: true,
      thumbnailPath: 'hyperframes/hf-project/thumb.png',
      entryFile: 'index.html',
      activeCompositionPath: 'compositions/main.html',
      renderCache: {
        status: 'ready',
        outputPath: 'renders/hf-project.webm',
      },
    })
  })

  it('keeps legacy FreeCut composition items compatible', () => {
    const item = {
      ...compositionItem,
      id: 'legacy-comp',
      sourceKind: 'freecut',
      hyperframesProjectId: undefined,
      hyperframesManifestPath: undefined,
    } as TimelineItem

    expect(isHyperFramesCompositionItem(item)).toBe(false)
    expect(resolveHyperFramesCompositionInfo(item, hyperframes)).toEqual({
      isHyperFramesBacked: false,
      activeCompositionPath: undefined,
      entryFile: undefined,
      link: undefined,
      manifest: undefined,
      renderCache: undefined,
      thumbnailPath: undefined,
    })
  })

  it('upserts and removes composition links immutably for timeline store usage', () => {
    const next = upsertHyperFramesCompositionLink(hyperframes, {
      timelineItemId: 'clip-2',
      projectId: 'hf-project',
      sourceKind: 'hyperframes',
      activeCompositionPath: 'compositions/alt.html',
      manifestPath: 'hyperframes/hf-project/manifest.json',
    })

    expect(next).not.toBe(hyperframes)
    expect(next.compositionLinks['clip-2']?.activeCompositionPath).toBe('compositions/alt.html')

    const removed = removeHyperFramesCompositionLink(next, 'clip-2')
    expect(removed.compositionLinks['clip-2']).toBeUndefined()
    expect(hyperframes.compositionLinks['clip-2']).toBeUndefined()
  })
})
