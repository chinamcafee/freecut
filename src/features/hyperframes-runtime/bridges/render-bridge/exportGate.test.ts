import { describe, expect, it } from 'vite-plus/test'
import type { HyperFramesProjectDirectory } from '@/types/hyperframes'
import { evaluateHyperFramesExportGate } from './exportGate'

const directory: HyperFramesProjectDirectory = {
  manifest: { schemaVersion: 1, id: 'p1', title: 'P1', entryFile: 'index.html', activeCompositionPath: 'compositions/main.html', canvas: { width: 1280, height: 720, fps: 30, durationInFrames: 90 }, assets: [], provenance: { source: 'manual-import', createdAt: 1 } },
  files: [{ path: 'index.html', content: '', encoding: 'utf8' }, { path: 'compositions/main.html', content: '', encoding: 'utf8' }], assets: [],
}
const runtime = { available: true, chromeAvailable: true, ffmpegAvailable: true, diagnostics: [] }
const completed = { id: 'job', projectId: 'p1', compositionPath: 'compositions/main.html', status: 'completed' as const, progress: 100, phase: 'completed', renderedFrames: 90, totalFrames: 90, createdAt: 1, output: { path: 'cache/p1.webm', format: 'webm' as const, alpha: true }, logs: [] }

describe('HyperFrames export gate', () => {
  it('allows a validated completed alpha render', () => {
    expect(evaluateHyperFramesExportGate({ directory, runtime, renderJob: completed, requiresTransparentOverlay: true })).toEqual({ allowed: true, blockers: [], warnings: [] })
  })

  it('reports all independent blockers without mutating the project directory', () => {
    const before = structuredClone(directory)
    const result = evaluateHyperFramesExportGate({
      directory: { ...directory, files: [] },
      diagnostics: [{ id: 'unsafe', severity: 'blocking', message: 'Unsafe script' }],
      runtime: { available: false, chromeAvailable: false, ffmpegAvailable: false, diagnostics: [] },
      renderJob: { ...completed, status: 'failed', output: undefined, error: 'Capture failed' },
      requiresTransparentOverlay: true,
    })
    expect(result.allowed).toBe(false)
    expect(result.blockers.map((blocker) => blocker.code)).toEqual([
      'entry-file-missing', 'active-composition-missing', 'security-failed', 'producer-missing', 'render-failed',
    ])
    expect(directory).toEqual(before)
  })
})
