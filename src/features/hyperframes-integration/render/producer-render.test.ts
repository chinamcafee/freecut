import { describe, expect, it } from 'vite-plus/test'
import {
  HyperFramesRenderJobManager,
  buildAlphaOverlayPlan,
  checkRenderRuntime,
  validateFrameSync,
} from './producer-render'

describe('HyperFrames producer render gate', () => {
  it('reports missing runtime dependencies with installation guidance', () => {
    expect(
      checkRenderRuntime({
        node: true,
        chromium: false,
        ffmpeg: true,
        producerBuild: false,
      }),
    ).toEqual({
      ok: false,
      missing: ['Chrome/Chromium', '@hyperframes/producer build'],
      guidance: [
        'Install Chrome or configure a remote Producer service',
        'Build or install @hyperframes/producer before production render',
      ],
    })
  })

  it('manages render job progress, completion, cancellation, and failure cleanup metadata', () => {
    const manager = new HyperFramesRenderJobManager()
    const job = manager.createJob({
      projectId: 'hf-project',
      compositionPath: 'compositions/main.html',
      fps: { num: 30, den: 1 },
      quality: 'production',
      format: 'webm',
      outputResolution: { width: 1920, height: 1080 },
      projectSignature: 'sig-1',
    })

    expect(job).toMatchObject({ status: 'queued', progress: 0, engine: 'producer' })
    manager.markRendering(job.id, 'launching-chromium')
    manager.updateProgress(job.id, 0.5, 30)
    expect(manager.getJob(job.id)).toMatchObject({
      status: 'rendering',
      progress: 0.5,
      currentFrame: 30,
      stage: 'launching-chromium',
    })
    manager.complete(job.id, 'renders/hf-project.webm')
    expect(manager.getJob(job.id)).toMatchObject({
      status: 'complete',
      progress: 1,
      outputPath: 'renders/hf-project.webm',
    })

    const cancelled = manager.createJob({
      projectId: 'hf-project',
      compositionPath: 'compositions/main.html',
      fps: { num: 24, den: 1 },
      quality: 'preview',
      format: 'mov',
      outputResolution: { width: 1280, height: 720 },
      projectSignature: 'sig-2',
    })
    manager.cancel(cancelled.id)
    expect(manager.getJob(cancelled.id)).toMatchObject({
      status: 'cancelled',
      cleanupRequired: true,
    })

    const failed = manager.createJob({
      projectId: 'hf-project',
      compositionPath: 'compositions/main.html',
      fps: { num: 30, den: 1 },
      quality: 'production',
      format: 'png-sequence',
      outputResolution: { width: 1920, height: 1080 },
      projectSignature: 'sig-3',
    })
    manager.fail(failed.id, 'Missing asset')
    expect(manager.getJob(failed.id)).toMatchObject({
      status: 'failed',
      error: 'Missing asset',
      cleanupRequired: true,
    })
  })

  it('builds an alpha overlay plan and defaults audio source to FreeCut unless manifest opts in', () => {
    expect(
      buildAlphaOverlayPlan({
        baseVideoPath: 'renders/freecut-base.mov',
        overlayPath: 'renders/hf-alpha.webm',
        outputPath: 'renders/final.mov',
        alphaFormat: 'webm',
        hyperframesAudioEnabled: false,
      }),
    ).toEqual({
      baseVideoPath: 'renders/freecut-base.mov',
      overlayPath: 'renders/hf-alpha.webm',
      outputPath: 'renders/final.mov',
      alphaFormat: 'webm',
      audioSource: 'freecut',
      command: [
        'ffmpeg',
        '-i',
        'renders/freecut-base.mov',
        '-i',
        'renders/hf-alpha.webm',
        '-filter_complex',
        '[0:v][1:v]overlay=format=auto[v]',
        '-map',
        '[v]',
        '-map',
        '0:a?',
        'renders/final.mov',
      ],
    })
  })

  it('validates preview, producer, and final export frames within one frame', () => {
    expect(validateFrameSync({ previewFrame: 120, producerFrame: 121, exportFrame: 120 })).toEqual({
      ok: true,
      maxDeltaFrames: 1,
    })
    expect(validateFrameSync({ previewFrame: 120, producerFrame: 123, exportFrame: 120 })).toEqual({
      ok: false,
      maxDeltaFrames: 3,
    })
  })
})
