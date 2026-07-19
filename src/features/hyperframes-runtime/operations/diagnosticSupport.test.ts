import { describe, expect, it } from 'vite-plus/test'
import { createHyperFramesSupportInfo } from './diagnosticSupport'

describe('HyperFrames diagnostic support info', () => {
  it.each([
    ['Model provider is offline', 'model-unavailable'],
    ['Estimated cost exceeds budget', 'cost-exceeded'],
    ['Asset file not found', 'asset-missing'],
    ['FFmpeg render failed', 'render-failed'],
  ] as const)('maps %s to an actionable category', (message, category) => {
    const info = createHyperFramesSupportInfo({ id: category, severity: 'blocking', message, fixHint: 'Specific repair' })
    expect(info.category).toBe(category)
    expect(info.nextActions[0]).toBe('Specific repair')
    expect(info.nextActions.length).toBeGreaterThan(1)
  })
})
