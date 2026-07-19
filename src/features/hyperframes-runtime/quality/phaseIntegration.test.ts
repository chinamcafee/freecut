import { describe, expect, it, vi } from 'vite-plus/test'
import type { Project } from '@/types/project'
import { createHyperFramesCompilerAdapter, InMemoryHyperFramesProjectRepository } from '../adapters/freecut-project'
import { exportFreeCutProjectToHyperFramesDirectory, importHyperFramesProjectDirectoryWithApproximations } from '../bridges/conversion-bridge'
import { evaluateHyperFramesExportGate, HyperFramesRenderService, type HyperFramesRenderTransport } from '../bridges/render-bridge'
import { resolveHyperFramesStudioItem } from '../bridges/studio-bridge/types'

describe('HyperFrames phase integration', () => {
  it('exports, imports, previews, resolves Studio, renders and passes the export gate', async () => {
    const project: Project = {
      id: 'phase-project', name: 'Phase Project', description: '', createdAt: 1, updatedAt: 1,
      duration: 60, metadata: { width: 640, height: 360, fps: 30 },
      timeline: {
        tracks: [{ id: 'v1', name: 'V1', kind: 'video', order: 0, height: 80, locked: false, visible: true, muted: false, solo: false }],
        items: [{ id: 'title', type: 'text', trackId: 'v1', from: 0, durationInFrames: 60, label: 'Title', text: 'Integrated', color: '#fff' }],
      },
    }
    const generated = await exportFreeCutProjectToHyperFramesDirectory(project, { now: 10 })
    const repository = new InMemoryHyperFramesProjectRepository()
    const imported = await importHyperFramesProjectDirectoryWithApproximations({
      project: { ...project, id: 'target', timeline: { ...project.timeline!, items: [] } },
      directory: generated.directory, repository, importedAt: 20, timelineItemId: 'hf-source',
    })
    expect(resolveHyperFramesStudioItem(imported.timelineItem)).not.toBeNull()
    const stored = (await repository.readProjectDirectory(generated.directory.manifest.id))!
    const preview = await createHyperFramesCompilerAdapter().createPreviewHtml(stored)
    expect(preview.ok).toBe(true)

    const render: HyperFramesRenderTransport['render'] = async (_request, options) => {
      options.onProgress({ phase: 'capture', progress: 100, renderedFrames: 60 })
      return { path: 'cache/final.webm', format: 'webm', alpha: true }
    }
    const transport: HyperFramesRenderTransport = {
      checkRuntime: vi.fn().mockResolvedValue({ available: true, chromeAvailable: true, ffmpegAvailable: true, diagnostics: [] }),
      estimate: vi.fn().mockResolvedValue({ estimatedDurationMs: 100, estimatedOutputBytes: 100, frameCount: 60, warnings: [] }),
      render, cancel: vi.fn(), clearCache: vi.fn(),
    }
    const service = new HyperFramesRenderService(transport, () => 30)
    const job = await service.start({ jobId: 'phase-render', projectId: stored.manifest.id, projectDirectoryPath: '/safe/project', compositionPath: stored.manifest.activeCompositionPath, width: 640, height: 360, fps: 30, durationInFrames: 60, quality: 'high', format: 'webm', alpha: true, includeAudio: false })
    await vi.waitFor(() => expect(service.getJob(job.id)?.status).toBe('completed'))
    const gate = evaluateHyperFramesExportGate({ directory: stored, diagnostics: preview.diagnostics, runtime: await service.checkRuntime(), renderJob: service.getJob(job.id), requiresTransparentOverlay: true })
    expect(gate.allowed).toBe(true)
    expect(imported.canonicalSourcePreserved).toBe(true)
  })
})
