import { describe, expect, it } from 'vite-plus/test'
import type { Project } from '@/types/project'
import { createHyperFramesCompilerAdapter } from '../adapters/freecut-project'
import { exportFreeCutProjectToHyperFramesDirectory } from '../bridges/conversion-bridge'
import { HyperFramesRenderCache } from '../bridges/render-bridge'

describe('HyperFrames performance budgets', () => {
  it('exports and compiles a 500-layer composition within the interactive budget', async () => {
    const project: Project = {
      id: 'perf', name: 'Performance', description: '', createdAt: 1, updatedAt: 1,
      duration: 300, metadata: { width: 1920, height: 1080, fps: 30 },
      timeline: {
        tracks: [{ id: 'v1', name: 'V1', order: 0, height: 80, locked: false, visible: true, muted: false, solo: false }],
        items: Array.from({ length: 500 }, (_, index) => ({ id: `text-${index}`, type: 'text' as const, trackId: 'v1', from: index % 300, durationInFrames: 30, label: `Text ${index}`, text: `Layer ${index}`, color: '#fff', transform: { x: index % 1000, y: index % 700 } })),
      },
    }
    const started = performance.now()
    const exported = await exportFreeCutProjectToHyperFramesDirectory(project)
    const compiled = await createHyperFramesCompilerAdapter().createPreviewHtml(exported.directory)
    const elapsed = performance.now() - started
    expect(compiled.ok).toBe(true)
    expect(compiled.html).toContain('Layer 499')
    expect(elapsed).toBeLessThan(3000)
  })

  it('serves repeated render cache hits within a small in-memory budget', async () => {
    const project: Project = { id: 'cache-perf', name: 'Cache', description: '', createdAt: 1, updatedAt: 1, duration: 30, metadata: { width: 640, height: 360, fps: 30 }, timeline: { tracks: [], items: [] } }
    const directory = (await exportFreeCutProjectToHyperFramesDirectory(project)).directory
    const request = { projectId: directory.manifest.id, projectDirectoryPath: '/cache', compositionPath: directory.manifest.activeCompositionPath, width: 640, height: 360, fps: 30, durationInFrames: 30, quality: 'draft' as const, format: 'webm' as const, alpha: true, includeAudio: false }
    const cache = new HyperFramesRenderCache()
    cache.put(directory, request, { path: 'cache/a.webm', format: 'webm', alpha: true })
    const started = performance.now()
    for (let index = 0; index < 1000; index++) expect((await cache.lookup(directory, request)).hit).toBe(true)
    expect(performance.now() - started).toBeLessThan(1000)
  })
})
