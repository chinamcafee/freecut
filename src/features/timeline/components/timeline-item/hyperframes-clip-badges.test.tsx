import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vite-plus/test'
import type { CompositionItem } from '@/types/timeline'
import { HyperFramesClipBadges } from './hyperframes-clip-badges'
import { getHyperFramesClipColorClasses } from './hyperframes-clip-visual-state'

function item(overrides: Partial<CompositionItem> = {}): CompositionItem {
  return {
    id: 'hf-item',
    trackId: 'track-1',
    from: 0,
    durationInFrames: 120,
    label: 'HyperFrames clip',
    type: 'composition',
    compositionId: 'hf-project',
    sourceKind: 'hyperframes',
    hyperframesProjectId: 'hf-project',
    activeCompositionPath: 'compositions/main.html',
    compositionWidth: 1920,
    compositionHeight: 1080,
    ...overrides,
  }
}

describe('HyperFramesClipBadges', () => {
  it('shows HF, cache and unsaved Studio state for source-linked clips', () => {
    const sourceItem = item({
      hyperframesVisualState: {
        diagnosticStatus: 'ready',
        cacheStatus: 'fresh',
        renderStatus: 'idle',
        studioDirty: true,
      },
    })

    render(<HyperFramesClipBadges item={sourceItem} />)

    expect(screen.getByText('HF')).toBeInTheDocument()
    expect(screen.getByText('cached')).toBeInTheDocument()
    expect(screen.getByTitle('Unsaved Studio changes')).toBeInTheDocument()
    expect(getHyperFramesClipColorClasses(sourceItem)).toContain('border-cyan-300')
  })

  it('distinguishes errors and leaves ordinary compositions unchanged', () => {
    const errorItem = item({
      hyperframesVisualState: {
        diagnosticStatus: 'error',
        cacheStatus: 'stale',
        renderStatus: 'idle',
      },
    })
    const ordinaryItem = item({
      sourceKind: 'freecut',
      hyperframesProjectId: undefined,
      activeCompositionPath: undefined,
      hyperframesVisualState: undefined,
    })

    const { rerender } = render(<HyperFramesClipBadges item={errorItem} />)
    expect(screen.getByText('error')).toBeInTheDocument()
    expect(getHyperFramesClipColorClasses(errorItem)).toContain('border-red-400')

    rerender(<HyperFramesClipBadges item={ordinaryItem} />)
    expect(screen.queryByText('HF')).not.toBeInTheDocument()
    expect(getHyperFramesClipColorClasses(ordinaryItem)).toBeUndefined()
  })
})
