import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import type { HyperFramesSkillImportPreview } from '../bridges/skills-bridge'
import { HyperFramesGenerationPreviewDrawer } from './HyperFramesGenerationPreviewDrawer'

afterEach(cleanup)

function preview(canConfirmImport: boolean): HyperFramesSkillImportPreview {
  return {
    id: 'preview-1',
    title: 'Generated launch video',
    fileTree: [{ path: 'compositions/main.html', kind: 'file', sizeBytes: 120 }],
    assets: [{ path: 'assets/logo.png', sizeBytes: 20 }],
    diagnostics: canConfirmImport ? [] : [{ id: 'block', severity: 'blocking', message: 'Missing composition' }],
    blockingDiagnostics: canConfirmImport ? [] : [{ id: 'block', severity: 'blocking', message: 'Missing composition' }],
    unsupportedFeatures: [],
    modelUsage: [{ modelId: 'planner', estimatedCost: 0.04 }],
    costSummary: { estimatedCost: 0.04, inputTokens: 100, outputTokens: 50, usage: [], currency: 'USD' },
    suggestedImportStrategy: 'source-link',
    selectedImportStrategy: 'source-link',
    importStrategyOptions: [
      { strategy: 'source-link', enabled: true, recommended: true, reason: 'Editable source' },
      { strategy: 'rendered-media', enabled: true, recommended: false, reason: 'Compatibility' },
    ],
    canConfirmImport,
  }
}

describe('HyperFramesGenerationPreviewDrawer', () => {
  it('shows files, assets, diagnostics, cost and import controls before confirmation', () => {
    const onConfirm = vi.fn()
    render(
      <HyperFramesGenerationPreviewDrawer open preview={preview(true)} onOpenChange={() => {}} onStrategyChange={() => {}} onConfirm={onConfirm} onDiscard={() => {}} />,
    )
    expect(screen.getByText('compositions/main.html')).toBeInTheDocument()
    expect(screen.getByText('assets/logo.png')).toBeInTheDocument()
    expect(screen.getByText(/0.0400/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Confirm import' }))
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('blocks import when preview diagnostics are blocking', () => {
    render(
      <HyperFramesGenerationPreviewDrawer open preview={preview(false)} onOpenChange={() => {}} onStrategyChange={() => {}} onConfirm={() => {}} onDiscard={() => {}} />,
    )
    expect(screen.getByText('Missing composition')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirm import' })).toBeDisabled()
  })
})
