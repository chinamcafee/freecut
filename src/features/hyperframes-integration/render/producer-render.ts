import type { Fps, RenderQuality } from '@/types/hyperframes'

export interface RenderRuntimeAvailability {
  node: boolean
  chromium: boolean
  ffmpeg: boolean
  producerBuild: boolean
}

export interface RenderRuntimeCheck {
  ok: boolean
  missing: string[]
  guidance: string[]
}

export interface HyperFramesRenderJobInput {
  projectId: string
  compositionPath: string
  fps: Fps
  quality: RenderQuality
  format: 'webm' | 'mov' | 'png-sequence'
  outputResolution: { width: number; height: number }
  projectSignature: string
}

export interface HyperFramesRenderJobState extends HyperFramesRenderJobInput {
  id: string
  engine: 'producer'
  status: 'queued' | 'rendering' | 'complete' | 'failed' | 'cancelled'
  progress: number
  stage?: string
  currentFrame?: number
  outputPath?: string
  error?: string
  cleanupRequired: boolean
  createdAt: number
  updatedAt: number
}

export function checkRenderRuntime(runtime: RenderRuntimeAvailability): RenderRuntimeCheck {
  const missing: string[] = []
  const guidance: string[] = []

  if (!runtime.node) {
    missing.push('Node.js')
    guidance.push('Run Producer from a Node-capable local service or desktop shell')
  }
  if (!runtime.chromium) {
    missing.push('Chrome/Chromium')
    guidance.push('Install Chrome or configure a remote Producer service')
  }
  if (!runtime.ffmpeg) {
    missing.push('FFmpeg')
    guidance.push('Install FFmpeg for final muxing and alpha overlay composition')
  }
  if (!runtime.producerBuild) {
    missing.push('@hyperframes/producer build')
    guidance.push('Build or install @hyperframes/producer before production render')
  }

  return {
    ok: missing.length === 0,
    missing,
    guidance,
  }
}

export class HyperFramesRenderJobManager {
  private jobs = new Map<string, HyperFramesRenderJobState>()
  private nextId = 1
  private now = 1

  createJob(input: HyperFramesRenderJobInput): HyperFramesRenderJobState {
    const job: HyperFramesRenderJobState = {
      ...input,
      id: `hf-render-${this.nextId}`,
      engine: 'producer',
      status: 'queued',
      progress: 0,
      cleanupRequired: false,
      createdAt: this.tick(),
      updatedAt: this.now,
    }
    this.nextId += 1
    this.jobs.set(job.id, job)
    return job
  }

  getJob(jobId: string): HyperFramesRenderJobState {
    const job = this.jobs.get(jobId)
    if (!job) throw new Error(`Missing render job: ${jobId}`)
    return job
  }

  markRendering(jobId: string, stage: string): HyperFramesRenderJobState {
    return this.update(jobId, {
      status: 'rendering',
      stage,
    })
  }

  updateProgress(jobId: string, progress: number, currentFrame?: number): HyperFramesRenderJobState {
    return this.update(jobId, {
      status: 'rendering',
      progress: clamp(progress, 0, 1),
      currentFrame,
    })
  }

  complete(jobId: string, outputPath: string): HyperFramesRenderJobState {
    return this.update(jobId, {
      status: 'complete',
      progress: 1,
      outputPath,
      cleanupRequired: false,
    })
  }

  cancel(jobId: string): HyperFramesRenderJobState {
    return this.update(jobId, {
      status: 'cancelled',
      cleanupRequired: true,
    })
  }

  fail(jobId: string, error: string): HyperFramesRenderJobState {
    return this.update(jobId, {
      status: 'failed',
      error,
      cleanupRequired: true,
    })
  }

  private update(
    jobId: string,
    patch: Partial<Omit<HyperFramesRenderJobState, 'id'>>,
  ): HyperFramesRenderJobState {
    const current = this.getJob(jobId)
    const next = {
      ...current,
      ...patch,
      updatedAt: this.tick(),
    }
    this.jobs.set(jobId, next)
    return next
  }

  private tick(): number {
    this.now += 1
    return this.now
  }
}

export interface AlphaOverlayPlanInput {
  baseVideoPath: string
  overlayPath: string
  outputPath: string
  alphaFormat: 'webm' | 'mov' | 'png-sequence'
  hyperframesAudioEnabled: boolean
}

export function buildAlphaOverlayPlan(input: AlphaOverlayPlanInput): {
  baseVideoPath: string
  overlayPath: string
  outputPath: string
  alphaFormat: AlphaOverlayPlanInput['alphaFormat']
  audioSource: 'freecut' | 'hyperframes'
  command: string[]
} {
  return {
    baseVideoPath: input.baseVideoPath,
    overlayPath: input.overlayPath,
    outputPath: input.outputPath,
    alphaFormat: input.alphaFormat,
    audioSource: input.hyperframesAudioEnabled ? 'hyperframes' : 'freecut',
    command: [
      'ffmpeg',
      '-i',
      input.baseVideoPath,
      '-i',
      input.overlayPath,
      '-filter_complex',
      '[0:v][1:v]overlay=format=auto[v]',
      '-map',
      '[v]',
      '-map',
      input.hyperframesAudioEnabled ? '1:a?' : '0:a?',
      input.outputPath,
    ],
  }
}

export function validateFrameSync(params: {
  previewFrame: number
  producerFrame: number
  exportFrame: number
}): {
  ok: boolean
  maxDeltaFrames: number
} {
  const deltas = [
    Math.abs(params.previewFrame - params.producerFrame),
    Math.abs(params.previewFrame - params.exportFrame),
    Math.abs(params.producerFrame - params.exportFrame),
  ]
  const maxDeltaFrames = Math.max(...deltas)
  return {
    ok: maxDeltaFrames <= 1,
    maxDeltaFrames,
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
