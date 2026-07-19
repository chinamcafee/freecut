import { forwardRef, useImperativeHandle, useMemo } from 'react'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { InMemoryHyperFramesProjectRepository } from '@/features/hyperframes-runtime/adapters/freecut-project/project-repository'
import type {
  HyperFramesPlayerHostHandle,
  HyperFramesPlayerHostProps,
} from '@/features/hyperframes-runtime/bridges/player-bridge'
import { useProjectStore } from '@/features/editor/deps/projects'
import { usePlaybackStore } from '@/shared/state/playback'
import { resetPlaybackPreviewState } from '@/shared/state/playback-preview-test-helpers'
import { useSelectionStore } from '@/shared/state/selection'
import type { HyperFramesProjectDirectory } from '@/types/hyperframes'
import type { Project } from '@/types/project'
import type { TimelineItem } from '@/types/timeline'
import { HyperFramesPreviewOverlay } from './hyperframes-preview-overlay'

const fakePlayerHandles: HyperFramesPlayerHostHandle[] = []

function createFakePlayerHandle(): HyperFramesPlayerHostHandle {
  return {
    load: vi.fn(async () => undefined),
    seek: vi.fn(async () => undefined),
    seekFrame: vi.fn(async () => undefined),
    play: vi.fn(async () => undefined),
    pause: vi.fn(async () => undefined),
    setPlaybackRate: vi.fn(),
    setMuted: vi.fn(),
    setVolume: vi.fn(),
    dispose: vi.fn(),
    getCurrentTime: () => 0,
    getDuration: () => 0,
    getPlayerElement: () => null,
    resolveIframe: () => null,
  }
}

function getLastSeekSeconds(handle: HyperFramesPlayerHostHandle): number | undefined {
  const seekMock = handle.seek as unknown as { mock: { calls: Array<[number]> } }
  return seekMock.mock.calls.at(-1)?.[0]
}

const FakePlayerHost = forwardRef<HyperFramesPlayerHostHandle, HyperFramesPlayerHostProps>(
  function FakePlayerHost({ previewDocument }, ref) {
    const handle = useMemo(() => {
      const nextHandle = createFakePlayerHandle()
      fakePlayerHandles.push(nextHandle)
      return nextHandle
    }, [])
    useImperativeHandle(ref, () => handle, [handle])

    return <div data-testid="hf-player-host" data-srcdoc={previewDocument?.srcdoc ?? ''} />
  },
)

const hyperFramesDirectory: HyperFramesProjectDirectory = {
  manifest: {
    schemaVersion: 1,
    id: 'hf-project',
    title: 'HyperFrames Project',
    entryFile: 'index.html',
    activeCompositionPath: 'compositions/main.html',
    canvas: {
      width: 1920,
      height: 1080,
      fps: 30,
      durationInFrames: 90,
    },
    assets: [],
    provenance: {
      source: 'manual-import',
      createdAt: 1784304000000,
      freecutProjectId: 'freecut-project',
    },
  },
  files: [
    {
      path: 'compositions/main.html',
      content:
        '<!doctype html><html><head></head><body><main data-composition-id="main"></main></body></html>',
      encoding: 'utf8',
    },
  ],
  assets: [],
}

const hyperFramesItem: TimelineItem = {
  id: 'item-hf',
  type: 'composition',
  trackId: 'track-1',
  from: 12,
  durationInFrames: 60,
  label: 'HyperFrames',
  compositionId: 'hf-project',
  sourceKind: 'hyperframes',
  hyperframesProjectId: 'hf-project',
  activeCompositionPath: 'compositions/main.html',
  hyperframesManifestPath: 'hyperframes/hf-project/manifest.json',
  compositionWidth: 1920,
  compositionHeight: 1080,
}

const regularItem: TimelineItem = {
  id: 'item-video',
  type: 'video',
  trackId: 'track-1',
  from: 0,
  durationInFrames: 60,
  label: 'Video',
  mediaId: 'media-1',
  src: 'blob:media-1',
}

function makeProject(): Project {
  return {
    id: 'freecut-project',
    name: 'FreeCut Project',
    description: '',
    createdAt: 1784304000000,
    updatedAt: 1784304000000,
    duration: 90,
    metadata: {
      width: 1920,
      height: 1080,
      fps: 30,
    },
    hyperframes: {
      schemaVersion: 1,
      projects: {
        'hf-project': hyperFramesDirectory.manifest,
      },
      compositionLinks: {},
      renderCache: {},
      skills: {},
      modelProfiles: {},
      modelCapabilityBindings: {},
      toolPolicies: {},
      renderConfig: {
        defaultEngine: 'hybrid-overlay',
        preferAlphaOverlay: true,
        cacheEnabled: true,
      },
    },
  }
}

function renderOverlay(
  items: TimelineItem[],
  repository = new InMemoryHyperFramesProjectRepository([hyperFramesDirectory]),
  fps = 30,
) {
  return render(
    <div>
      <HyperFramesPreviewOverlay
        items={items}
        fps={fps}
        repositoryFactory={() => repository}
        PlayerHostComponent={FakePlayerHost}
      />
    </div>,
  )
}

describe('HyperFramesPreviewOverlay', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    fakePlayerHandles.length = 0
    resetPlaybackPreviewState()
    useProjectStore.setState({ currentProject: null })
    useSelectionStore.getState().clearSelection()
  })

  it('does not mount over the normal FreeCut preview for regular selected items', () => {
    useProjectStore.setState({ currentProject: makeProject() })
    useSelectionStore.getState().selectItems(['item-video'])

    renderOverlay([regularItem])

    expect(screen.queryByTestId('hf-player-host')).not.toBeInTheDocument()
    expect(document.querySelector('[data-hf-preview-overlay]')).not.toBeInTheDocument()
  })

  it('loads the selected HyperFrames source-linked composition as a srcdoc preview', async () => {
    useProjectStore.setState({ currentProject: makeProject() })
    useSelectionStore.getState().selectItems(['item-hf'])

    renderOverlay([hyperFramesItem])

    const host = await screen.findByTestId('hf-player-host')
    expect(host.getAttribute('data-srcdoc')).toContain('data-composition-id="main"')
    expect(host.getAttribute('data-srcdoc')).toContain('Content-Security-Policy')
    expect(host.getAttribute('data-srcdoc')).toContain('"projectId":"hf-project"')
  })

  it('shows a preview diagnostic when the active composition file is missing', async () => {
    const missingRepository = new InMemoryHyperFramesProjectRepository([
      {
        ...hyperFramesDirectory,
        files: [],
      },
    ])
    useProjectStore.setState({ currentProject: makeProject() })
    useSelectionStore.getState().selectItems(['item-hf'])

    renderOverlay([hyperFramesItem], missingRepository)

    await waitFor(() => {
      expect(screen.getByText('HyperFrames preview unavailable')).toBeInTheDocument()
    })
    expect(
      screen.getByText('HyperFrames composition file not found: compositions/main.html'),
    ).toBeInTheDocument()
  })

  it('syncs first, middle, and tail frames using the HyperFrames manifest fps', async () => {
    const timelineFps = 60
    const sourceLinkedItem = {
      ...hyperFramesItem,
      from: 30,
      durationInFrames: 120,
      sourceStart: 24,
    }
    useProjectStore.setState({ currentProject: makeProject() })
    useSelectionStore.getState().selectItems(['item-hf'])
    resetPlaybackPreviewState(sourceLinkedItem.from)

    renderOverlay([sourceLinkedItem], undefined, timelineFps)

    await screen.findByTestId('hf-player-host')
    const handle = fakePlayerHandles[0]
    if (!handle) throw new Error('Expected HyperFrames player host handle to be registered.')
    await waitFor(() => {
      expect(getLastSeekSeconds(handle)).toBeCloseTo(0.8, 6)
    })

    const samples = [
      { frame: sourceLinkedItem.from + 60, seconds: 1.8 },
      { frame: sourceLinkedItem.from + sourceLinkedItem.durationInFrames - 1, seconds: 2.783333 },
    ]

    for (const sample of samples) {
      act(() => {
        usePlaybackStore.getState().setCurrentFrame(sample.frame)
      })
      await waitFor(() => {
        expect(getLastSeekSeconds(handle)).toBeCloseTo(sample.seconds, 5)
      })
    }
  })
})
