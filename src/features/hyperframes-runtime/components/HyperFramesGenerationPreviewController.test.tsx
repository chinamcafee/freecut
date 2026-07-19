import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import type { HyperFramesSkillImportPreview } from '../bridges/skills-bridge'
import { emitHyperFramesGenerationPreview } from '../events/generationPreviewEvents'
import { HyperFramesGenerationPreviewController } from './HyperFramesGenerationPreviewController'

afterEach(cleanup)

const preview = {
  id: 'preview-1',
  title: 'Generated launch video',
  fileTree: [{ path: 'compositions/main.html', kind: 'file', sizeBytes: 120 }],
  assets: [],
  diagnostics: [],
  blockingDiagnostics: [],
  unsupportedFeatures: [],
  modelUsage: [],
  costSummary: { estimatedCost: 0, inputTokens: 0, outputTokens: 0, usage: [] },
  suggestedImportStrategy: 'source-link',
  selectedImportStrategy: 'source-link',
  importStrategyOptions: [
    {
      strategy: 'source-link',
      enabled: true,
      recommended: true,
      reason: 'Keep source linked',
    },
  ],
  canConfirmImport: true,
} satisfies HyperFramesSkillImportPreview

describe('HyperFramesGenerationPreviewController', () => {
  it('mounts generated previews globally and delegates explicit confirmation', async () => {
    const onConfirm = vi.fn()
    render(<HyperFramesGenerationPreviewController />)

    act(() => emitHyperFramesGenerationPreview({ preview, onConfirm }))
    expect(await screen.findByRole('heading', { name: 'Generated launch video' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Confirm import' }))
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith(preview))
    await waitFor(() =>
      expect(
        screen.queryByRole('heading', { name: 'Generated launch video' }),
      ).not.toBeInTheDocument(),
    )
  })
})
