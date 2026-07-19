import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import type { HyperFramesSkillImportPreview } from '../bridges/skills-bridge'
import {
  emitHyperFramesGenerationPreview,
  subscribeHyperFramesGenerationPreview,
} from './generationPreviewEvents'

const preview = {
  id: 'preview-1',
  title: 'Generated title',
  fileTree: [],
  assets: [],
  diagnostics: [],
  blockingDiagnostics: [],
  unsupportedFeatures: [],
  modelUsage: [],
  costSummary: { estimatedCost: 0, inputTokens: 0, outputTokens: 0, usage: [] },
  suggestedImportStrategy: 'source-link',
  selectedImportStrategy: 'source-link',
  importStrategyOptions: [],
  canConfirmImport: true,
} satisfies HyperFramesSkillImportPreview

afterEach(() => {
  vi.restoreAllMocks()
})

describe('generation preview events', () => {
  it('delivers preview requests and supports unsubscribe', () => {
    const listener = vi.fn()
    const request = { preview, onConfirm: vi.fn() }
    const unsubscribe = subscribeHyperFramesGenerationPreview(listener)

    emitHyperFramesGenerationPreview(request)
    expect(listener).toHaveBeenCalledWith(request)

    unsubscribe()
    emitHyperFramesGenerationPreview(request)
    expect(listener).toHaveBeenCalledOnce()
  })
})
