import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import type { HyperFramesProjectManifest } from '@/types/hyperframes'
import type { TimelineItem } from '@/types/timeline'
import {
  createHyperFramesProjectLibraryEntries,
} from './projectLibraryModel'
import { HyperFramesProjectLibrary } from './HyperFramesProjectLibrary'

afterEach(cleanup)

function manifest(id: string, diagnostics: HyperFramesProjectManifest['diagnostics'] = []) {
  return {
    schemaVersion: 1,
    id,
    title: `Project ${id}`,
    entryFile: 'index.html',
    activeCompositionPath: 'compositions/main.html',
    canvas: { width: 1920, height: 1080, fps: 30, durationInFrames: 300 },
    assets: [],
    provenance: { source: 'skill-output', createdAt: 10, updatedAt: 20 },
    diagnostics,
    renderSignature: `render-${id}`,
  } satisfies HyperFramesProjectManifest
}

describe('HyperFramesProjectLibrary', () => {
  it('derives references, diagnostics and render cache state from live data', () => {
    const manifests = [
      manifest('linked'),
      manifest('unlinked', [
        { id: 'warning', severity: 'warning', message: 'Check overflow' },
      ]),
    ]
    const timelineItems = [
      {
        id: 'item-1',
        trackId: 'track-1',
        from: 0,
        durationInFrames: 300,
        label: 'Linked clip',
        type: 'composition',
        compositionId: 'linked',
        sourceKind: 'hyperframes',
        hyperframesProjectId: 'linked',
        activeCompositionPath: 'compositions/main.html',
        compositionWidth: 1920,
        compositionHeight: 1080,
      },
    ] satisfies TimelineItem[]

    const entries = createHyperFramesProjectLibraryEntries({
      manifests,
      timelineItems,
      renderCache: [
        {
          id: 'cache-1',
          hyperframesProjectId: 'linked',
          compositionPath: 'compositions/main.html',
          renderSignature: 'render-linked',
          engine: 'hyperframes-producer',
          format: 'mp4',
          outputPath: 'renders/linked.mp4',
          width: 1920,
          height: 1080,
          fps: 30,
          durationInFrames: 300,
          createdAt: 30,
          alpha: false,
        },
      ],
    })

    expect(entries.find((entry) => entry.id === 'linked')).toMatchObject({
      referenceCount: 1,
      referenceItemIds: ['item-1'],
      status: 'ready',
      cacheStatus: 'cached',
    })
    expect(entries.find((entry) => entry.id === 'unlinked')).toMatchObject({
      referenceCount: 0,
      status: 'warning',
      warningCount: 1,
      cacheStatus: 'missing',
    })
  })

  it('exposes project actions and prevents deleting referenced projects', () => {
    const onOpen = vi.fn()
    const onDelete = vi.fn()
    const entries = createHyperFramesProjectLibraryEntries({
      manifests: [manifest('linked'), manifest('unlinked')],
      timelineItems: [
        {
          id: 'item-1',
          trackId: 'track-1',
          from: 0,
          durationInFrames: 300,
          label: 'Linked clip',
          type: 'composition',
          compositionId: 'linked',
          sourceKind: 'hyperframes',
          hyperframesProjectId: 'linked',
          activeCompositionPath: 'compositions/main.html',
          compositionWidth: 1920,
          compositionHeight: 1080,
        },
      ],
    })

    render(
      <HyperFramesProjectLibrary entries={entries} onOpen={onOpen} onDelete={onDelete} />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Open Project linked in Studio' }))
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: 'linked' }))
    expect(
      screen.getByRole('button', {
        name: 'Cannot delete Project linked: project is referenced',
      }),
    ).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Delete Project unlinked' }))
    expect(onDelete).toHaveBeenCalledWith(expect.objectContaining({ id: 'unlinked' }))
  })
})
