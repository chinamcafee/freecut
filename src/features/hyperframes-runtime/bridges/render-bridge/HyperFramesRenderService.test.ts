import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { HyperFramesRenderService, type HyperFramesRenderRequest, type HyperFramesRenderTransport } from './HyperFramesRenderService'
import { useHyperFramesRenderJobStore } from './renderJobStore'

const request: HyperFramesRenderRequest = {
  jobId: 'job-1', projectId: 'project-1', projectDirectoryPath: '/safe/project-1',
  compositionPath: 'compositions/main.html', width: 1280, height: 720, fps: 30,
  durationInFrames: 90, quality: 'standard', format: 'webm', alpha: true, includeAudio: true,
}

function transport(overrides: Partial<HyperFramesRenderTransport> = {}): HyperFramesRenderTransport {
  const render: HyperFramesRenderTransport['render'] = async (_request, options) => {
    options.onProgress({ phase: 'capture', progress: 50, renderedFrames: 45, totalFrames: 90, log: { level: 'info', message: 'Halfway' } })
    return { path: 'cache/project-1.webm', format: 'webm', alpha: true, bytes: 100 }
  }
  return {
    checkRuntime: vi.fn().mockResolvedValue({ available: true, chromeAvailable: true, ffmpegAvailable: true, diagnostics: [] }),
    estimate: vi.fn().mockResolvedValue({ estimatedDurationMs: 1000, estimatedOutputBytes: 100, frameCount: 90, warnings: [] }),
    render,
    cancel: vi.fn().mockResolvedValue(undefined),
    clearCache: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

describe('HyperFramesRenderService', () => {
  afterEach(() => useHyperFramesRenderJobStore.getState().reset())

  it('publishes progress, logs and output into the FreeCut-owned render job store', async () => {
    const service = new HyperFramesRenderService(transport(), () => 100)
    await service.start(request)
    await vi.waitFor(() => expect(service.getJob('job-1')?.status).toBe('completed'))

    expect(service.getOutput('job-1')).toMatchObject({ path: 'cache/project-1.webm', alpha: true })
    expect(useHyperFramesRenderJobStore.getState().jobs['job-1']).toMatchObject({
      status: 'completed', progress: 100, renderedFrames: 90,
    })
    expect(service.getJob('job-1')?.logs.map((log) => log.message)).toContain('Halfway')
  })

  it('cancels a running producer job and records the cancellation', async () => {
    let release!: () => void
    const pending = new Promise<void>((resolve) => { release = resolve })
    const pendingRender: HyperFramesRenderTransport['render'] = async (_request, options) => {
      await pending
      if (options.signal.aborted) throw new DOMException('Aborted', 'AbortError')
      return { path: 'unused.webm', format: 'webm', alpha: true }
    }
    const fake = transport({
      render: pendingRender,
    })
    const service = new HyperFramesRenderService(fake, () => 100)
    await service.start(request)
    await service.cancel('job-1')
    release()

    expect(service.getJob('job-1')?.status).toBe('cancelled')
    expect(fake.cancel).toHaveBeenCalledWith('job-1')
  })

  it('fails before enqueue when the Producer runtime is unavailable', async () => {
    const service = new HyperFramesRenderService(transport({
      checkRuntime: vi.fn().mockResolvedValue({ available: false, chromeAvailable: false, ffmpegAvailable: true, diagnostics: ['Chrome missing'] }),
    }))
    await expect(service.start(request)).rejects.toThrow('Chrome missing')
    expect(useHyperFramesRenderJobStore.getState().jobs).toEqual({})
  })
})
