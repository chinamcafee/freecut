import {
  useHyperFramesRenderJobStore,
  type HyperFramesRenderJobLog,
  type HyperFramesRenderJobState,
  type HyperFramesRenderOutput,
} from './renderJobStore'

export interface HyperFramesRuntimeCheck {
  available: boolean
  producerVersion?: string
  chromeAvailable: boolean
  ffmpegAvailable: boolean
  gpuAvailable?: boolean
  diagnostics: string[]
}

export interface HyperFramesRenderRequest {
  jobId?: string
  projectId: string
  projectDirectoryPath: string
  compositionPath: string
  width: number
  height: number
  fps: number
  durationInFrames: number
  quality: 'draft' | 'standard' | 'high'
  format: HyperFramesRenderOutput['format']
  alpha: boolean
  includeAudio: boolean
}

export interface HyperFramesRenderEstimate {
  estimatedDurationMs: number
  estimatedOutputBytes: number
  frameCount: number
  warnings: string[]
}

export interface HyperFramesRenderProgressEvent {
  phase: string
  progress: number
  renderedFrames?: number
  totalFrames?: number
  log?: Omit<HyperFramesRenderJobLog, 'at'> & { at?: number }
}

export interface HyperFramesRenderTransport {
  checkRuntime(): Promise<HyperFramesRuntimeCheck>
  estimate(request: HyperFramesRenderRequest): Promise<HyperFramesRenderEstimate>
  render(
    request: HyperFramesRenderRequest & { jobId: string },
    options: {
      signal: AbortSignal
      onProgress: (event: HyperFramesRenderProgressEvent) => void
    },
  ): Promise<HyperFramesRenderOutput>
  cancel(jobId: string): Promise<void>
  clearCache(projectId: string): Promise<void>
}

export type HyperFramesRenderJobListener = (job: HyperFramesRenderJobState) => void

export class HyperFramesRenderService {
  private readonly jobs = new Map<string, HyperFramesRenderJobState>()
  private readonly controllers = new Map<string, AbortController>()
  private readonly listeners = new Map<string, Set<HyperFramesRenderJobListener>>()
  private sequence = 0

  constructor(
    private readonly transport: HyperFramesRenderTransport,
    private readonly now: () => number = Date.now,
  ) {}

  checkRuntime(): Promise<HyperFramesRuntimeCheck> {
    return this.transport.checkRuntime()
  }

  estimate(request: HyperFramesRenderRequest): Promise<HyperFramesRenderEstimate> {
    return this.transport.estimate(request)
  }

  async start(request: HyperFramesRenderRequest): Promise<HyperFramesRenderJobState> {
    const runtime = await this.checkRuntime()
    if (!runtime.available || !runtime.chromeAvailable || !runtime.ffmpegAvailable) {
      throw new Error(runtime.diagnostics[0] ?? 'HyperFrames Producer runtime is unavailable.')
    }
    const id = request.jobId ?? `hf-render-${this.now()}-${++this.sequence}`
    if (this.jobs.has(id)) throw new Error(`HyperFrames render job already exists: ${id}`)
    const job: HyperFramesRenderJobState = {
      id,
      projectId: request.projectId,
      compositionPath: request.compositionPath,
      status: 'queued',
      progress: 0,
      phase: 'queued',
      renderedFrames: 0,
      totalFrames: request.durationInFrames,
      createdAt: this.now(),
      logs: [],
    }
    this.publish(job)
    const controller = new AbortController()
    this.controllers.set(id, controller)
    void this.run(job, request, controller)
    return cloneJob(job)
  }

  async cancel(jobId: string): Promise<void> {
    const job = this.requireJob(jobId)
    if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') return
    this.controllers.get(jobId)?.abort()
    await this.transport.cancel(jobId)
    job.status = 'cancelled'
    job.phase = 'cancelled'
    job.finishedAt = this.now()
    this.appendLog(job, 'info', 'Render cancelled by FreeCut.')
    this.publish(job)
  }

  subscribe(jobId: string, listener: HyperFramesRenderJobListener): () => void {
    const listeners = this.listeners.get(jobId) ?? new Set()
    listeners.add(listener)
    this.listeners.set(jobId, listeners)
    const current = this.jobs.get(jobId)
    if (current) listener(cloneJob(current))
    return () => {
      listeners.delete(listener)
      if (listeners.size === 0) this.listeners.delete(jobId)
    }
  }

  getJob(jobId: string): HyperFramesRenderJobState | undefined {
    const job = this.jobs.get(jobId)
    return job ? cloneJob(job) : undefined
  }

  getOutput(jobId: string): HyperFramesRenderOutput | undefined {
    const output = this.jobs.get(jobId)?.output
    return output ? { ...output } : undefined
  }

  async clearCache(projectId: string): Promise<void> {
    await this.transport.clearCache(projectId)
    for (const [id, job] of this.jobs) {
      if (job.projectId === projectId && job.status !== 'rendering') this.jobs.delete(id)
    }
    useHyperFramesRenderJobStore.getState().clearProject(projectId)
  }

  private async run(
    job: HyperFramesRenderJobState,
    request: HyperFramesRenderRequest,
    controller: AbortController,
  ): Promise<void> {
    job.status = 'rendering'
    job.phase = 'preparing'
    job.startedAt = this.now()
    this.appendLog(job, 'info', 'Producer render started.')
    this.publish(job)
    try {
      const output = await this.transport.render(
        { ...request, jobId: job.id },
        {
          signal: controller.signal,
          onProgress: (event) => {
            if (job.status === 'cancelled') return
            job.phase = event.phase
            job.progress = clampProgress(event.progress)
            job.renderedFrames = event.renderedFrames ?? job.renderedFrames
            job.totalFrames = event.totalFrames ?? job.totalFrames
            if (event.log) {
              job.logs.push({ ...event.log, at: event.log.at ?? this.now() })
            }
            this.publish(job)
          },
        },
      )
      if (controller.signal.aborted) return
      job.status = 'completed'
      job.phase = 'completed'
      job.progress = 100
      job.renderedFrames = job.totalFrames
      job.output = { ...output }
      job.finishedAt = this.now()
      this.appendLog(job, 'info', `Render completed: ${output.path}`)
      this.publish(job)
    } catch (error) {
      if (controller.signal.aborted) return
      const message = error instanceof Error ? error.message : String(error)
      job.status = 'failed'
      job.phase = 'failed'
      job.error = message
      job.finishedAt = this.now()
      this.appendLog(job, 'error', message)
      this.publish(job)
    } finally {
      this.controllers.delete(job.id)
    }
  }

  private requireJob(jobId: string): HyperFramesRenderJobState {
    const job = this.jobs.get(jobId)
    if (!job) throw new Error(`HyperFrames render job not found: ${jobId}`)
    return job
  }

  private appendLog(
    job: HyperFramesRenderJobState,
    level: HyperFramesRenderJobLog['level'],
    message: string,
  ): void {
    job.logs.push({ at: this.now(), level, message })
  }

  private publish(job: HyperFramesRenderJobState): void {
    const snapshot = cloneJob(job)
    this.jobs.set(job.id, snapshot)
    useHyperFramesRenderJobStore.getState().upsertJob(snapshot)
    for (const listener of this.listeners.get(job.id) ?? []) listener(cloneJob(snapshot))
  }
}

function clampProgress(progress: number): number {
  if (!Number.isFinite(progress)) return 0
  return Math.min(100, Math.max(0, progress))
}

function cloneJob(job: HyperFramesRenderJobState): HyperFramesRenderJobState {
  return structuredClone(job)
}
