import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import type { CompositionItem } from '@/types/timeline'
import { InMemoryHyperFramesProjectRepository } from '../adapters/freecut-project'
import { HyperFramesPropertiesPanel } from './HyperFramesPropertiesPanel'
import { subscribeHyperFramesProjectUpdated } from '../events/projectEvents'

afterEach(cleanup)

const item: CompositionItem & { sourceKind: 'hyperframes' } = {
  id: 'item-1',
  trackId: 'track-1',
  from: 12,
  durationInFrames: 120,
  label: 'HF clip',
  type: 'composition',
  compositionId: 'hf-project',
  sourceKind: 'hyperframes',
  hyperframesProjectId: 'hf-project',
  activeCompositionPath: 'compositions/main.html',
  compositionWidth: 1920,
  compositionHeight: 1080,
}

function repository() {
  return new InMemoryHyperFramesProjectRepository([
    {
      manifest: {
        schemaVersion: 1,
        id: 'hf-project',
        title: 'Launch film',
        entryFile: 'index.html',
        activeCompositionPath: 'compositions/main.html',
        canvas: { width: 1920, height: 1080, fps: 30, durationInFrames: 180 },
        assets: [],
        variables: { headline: 'Original', enabled: true, accent: '#22d3ee' },
        provenance: {
          source: 'model-generation',
          createdAt: 10,
          skillId: 'product-launch-video',
          promptSummary: 'Create a product launch',
        },
      },
      files: [
        { path: 'index.html', content: '<html></html>', encoding: 'utf8' },
        { path: 'compositions/main.html', content: '<div></div>', encoding: 'utf8' },
      ],
      assets: [],
    },
  ])
}

describe('HyperFramesPropertiesPanel', () => {
  it('shows source-level properties and only persists variable drafts after save', async () => {
    const projectRepository = repository()
    const onProjectUpdated = vi.fn()
    const unsubscribe = subscribeHyperFramesProjectUpdated(onProjectUpdated)
    render(<HyperFramesPropertiesPanel item={item} repository={projectRepository} />)

    expect(await screen.findByText('Launch film')).toBeInTheDocument()
    expect(screen.getByText('product-launch-video')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('headline'), { target: { value: 'Updated' } })

    expect((await projectRepository.readManifest('hf-project'))?.variables?.headline).toBe('Original')
    fireEvent.click(screen.getByRole('button', { name: 'Save variables' }))
    await waitFor(async () => {
      expect((await projectRepository.readManifest('hf-project'))?.variables?.headline).toBe('Updated')
    })
    expect(onProjectUpdated).toHaveBeenCalledWith('hf-project')
    unsubscribe()
  })

  it('routes panel actions through the shared command boundary', async () => {
    const onAction = vi.fn()
    render(<HyperFramesPropertiesPanel item={item} repository={repository()} onAction={onAction} />)
    await screen.findByText('Launch film')

    fireEvent.click(screen.getByRole('button', { name: 'Open Studio' }))
    fireEvent.click(screen.getByRole('button', { name: 'Export source' }))
    expect(onAction).toHaveBeenNthCalledWith(1, 'open-studio')
    expect(onAction).toHaveBeenNthCalledWith(2, 'export-project')
  })
})
