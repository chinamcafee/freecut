import { describe, expect, it } from 'vite-plus/test'
import type { HyperFramesIntegrationState } from '@/types/hyperframes'
import type { TimelineItem } from '@/types/timeline'
import {
  getHyperFramesCompositionActions,
  getHyperFramesCompositionShortcut,
} from './composition-actions'

const item = {
  id: 'hf-comp',
  type: 'composition',
  trackId: 'track-1',
  from: 0,
  durationInFrames: 120,
  label: 'Intro',
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
      name: 'Intro',
      schemaVersion: 1,
      projectDir: 'hyperframes/hf-project',
      entryFile: 'index.html',
      activeCompositionPath: 'compositions/main.html',
      width: 1920,
      height: 1080,
      fps: { num: 30, den: 1 },
      durationInFrames: 120,
      assets: [],
      compositions: [],
      source: 'hyperframes-project',
      createdAt: 1,
      updatedAt: 2,
    },
  },
  compositionLinks: {},
}

describe('HyperFrames composition actions', () => {
  it('exposes Studio, conversion, and export actions for context menus and double click', () => {
    expect(getHyperFramesCompositionActions(item, hyperframes)).toEqual([
      {
        id: 'open-studio',
        label: 'Open HyperFrames Studio',
        shortcut: 'Enter',
        disabled: false,
        reason: undefined,
      },
      {
        id: 'convert-to-freecut-compound',
        label: 'Convert to FreeCut compound clip',
        disabled: false,
        reason: undefined,
      },
      {
        id: 'export-project',
        label: 'Export HyperFrames project',
        shortcut: 'Mod+Shift+E',
        disabled: false,
        reason: undefined,
      },
    ])
  })

  it('keeps actions disabled for legacy composition clips', () => {
    const legacy = { ...item, sourceKind: 'freecut', hyperframesManifestPath: undefined } as TimelineItem

    expect(getHyperFramesCompositionActions(legacy, hyperframes)).toMatchObject([
      { disabled: true, reason: 'Not a HyperFrames-backed composition' },
      { disabled: true, reason: 'Not a HyperFrames-backed composition' },
      { disabled: true, reason: 'Not a HyperFrames-backed composition' },
    ])
  })

  it('documents keyboard shortcuts for the shared action model', () => {
    expect(getHyperFramesCompositionShortcut('open-studio')).toBe('Enter')
    expect(getHyperFramesCompositionShortcut('convert-to-freecut-compound')).toBe('Mod+Shift+C')
    expect(getHyperFramesCompositionShortcut('export-project')).toBe('Mod+Shift+E')
  })
})
