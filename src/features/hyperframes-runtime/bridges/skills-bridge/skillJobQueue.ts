import type {
  HyperFramesBinaryAsset,
  HyperFramesDiagnostic,
  HyperFramesModelUsageSummary,
  HyperFramesProjectDirectory,
  HyperFramesProjectFile,
  HyperFramesProjectManifest,
} from '@/types/hyperframes'
import {
  canExecuteHyperFramesGenerationPlan,
  confirmHyperFramesGenerationPlan,
  type ConfirmHyperFramesGenerationPlanOptions,
  type HyperFramesGenerationImportStrategy,
  type HyperFramesGenerationPlan,
  type HyperFramesGenerationPlanStep,
  type HyperFramesGenerationPlanStepType,
  type HyperFramesGenerationToolPermission,
} from './generationPlan'

export type HyperFramesSkillJobStatus =
  | 'canceled'
  | 'complete'
  | 'failed'
  | 'pending'
  | 'running'
  | 'waiting-confirmation'

export type HyperFramesSkillJobStage =
  | HyperFramesGenerationPlanStepType
  | 'canceled'
  | 'complete'
  | 'failed'
  | 'queued'
  | 'waiting-confirmation'

export type HyperFramesSkillJobLogLevel = 'error' | 'info' | 'warning'

export type HyperFramesSkillJobWaitingReason =
  | 'import-confirmation'
  | 'plan-confirmation'
  | 'retry-limit'

export interface HyperFramesSkillJobLogEntry {
  id: string
  at: number
  level: HyperFramesSkillJobLogLevel
  stage: HyperFramesSkillJobStage
  message: string
  data?: Record<string, unknown>
}

export interface HyperFramesSkillJobFailure {
  at: number
  stage: HyperFramesSkillJobStage
  message: string
  code?: string
  retryable: boolean
  diagnostics: HyperFramesDiagnostic[]
}

export interface HyperFramesSkillJobWaitingConfirmation {
  reason: HyperFramesSkillJobWaitingReason
  requestedAt: number
  message: string
}

export interface HyperFramesSkillOutputBundle {
  outputDirectory: string
  suggestedImportStrategy: HyperFramesGenerationImportStrategy
  projectDirectory?: HyperFramesProjectDirectory
  manifest?: HyperFramesProjectManifest
  generatedFiles: HyperFramesProjectFile[]
  sourceAssets: HyperFramesBinaryAsset[]
  logs: HyperFramesSkillJobLogEntry[]
  diagnostics: HyperFramesDiagnostic[]
  modelUsage: HyperFramesModelUsageSummary[]
}

export interface HyperFramesSkillJob {
  id: string
  skillId: string
  userInput: string
  plan: HyperFramesGenerationPlan
  status: HyperFramesSkillJobStatus
  currentStage: HyperFramesSkillJobStage
  attemptCount: number
  maxAttempts: number
  createdAt: number
  updatedAt: number
  startedAt?: number
  completedAt?: number
  failedAt?: number
  canceledAt?: number
  confirmedAt?: number
  confirmedBy?: string
  outputDirectory: string
  retainOutputDirectoryOnFailure: true
  cleanupRequired: boolean
  cancelRequested: boolean
  waitingConfirmation?: HyperFramesSkillJobWaitingConfirmation
  modelConfigSnapshot?: unknown
  logs: HyperFramesSkillJobLogEntry[]
  diagnostics: HyperFramesDiagnostic[]
  failures: HyperFramesSkillJobFailure[]
  output?: HyperFramesSkillOutputBundle
}

export interface EnqueueHyperFramesSkillJobOptions {
  plan: HyperFramesGenerationPlan
  userInput: string
  id?: string
  now?: number
  maxAttempts?: number
  modelConfigSnapshot?: unknown
  logs?: HyperFramesSkillJobLogEntry[]
}

export interface UpdateHyperFramesSkillJobLogOptions {
  level?: HyperFramesSkillJobLogLevel
  message: string
  stage?: HyperFramesSkillJobStage
  at?: number
  data?: Record<string, unknown>
}

export interface StartHyperFramesSkillJobOptions {
  stage?: HyperFramesGenerationPlanStepType
  at?: number
}

export interface CompleteHyperFramesSkillJobOptions {
  output: HyperFramesSkillOutputBundle
  at?: number
}

export interface FailHyperFramesSkillJobOptions {
  message: string
  code?: string
  stage?: HyperFramesSkillJobStage
  diagnostics?: HyperFramesDiagnostic[]
  retryable?: boolean
  at?: number
}

export interface CancelHyperFramesSkillJobOptions {
  reason?: string
  at?: number
}

export interface RetryHyperFramesSkillJobOptions {
  confirmedBy?: string
  at?: number
}

export interface HyperFramesSkillJobQueueOptions {
  now?: () => number
  idFactory?: (input: { plan: HyperFramesGenerationPlan; sequence: number; now: number }) => string
  maxAttempts?: number
}

export type HyperFramesSkillJobQueueListener = (jobs: HyperFramesSkillJob[]) => void

export class HyperFramesSkillJobQueue {
  private readonly jobs = new Map<string, HyperFramesSkillJob>()
  private readonly order: string[] = []
  private readonly listeners = new Set<HyperFramesSkillJobQueueListener>()
  private readonly now: () => number
  private readonly idFactory: NonNullable<HyperFramesSkillJobQueueOptions['idFactory']>
  private readonly defaultMaxAttempts: number
  private sequence = 0
  private logSequence = 0

  constructor(options: HyperFramesSkillJobQueueOptions = {}) {
    this.now = options.now ?? Date.now
    this.defaultMaxAttempts = options.maxAttempts ?? 2
    this.idFactory =
      options.idFactory ??
      ((input) => `hf-skill-job-${input.now}-${input.sequence}-${input.plan.skillId}`)
  }

  enqueueJob(options: EnqueueHyperFramesSkillJobOptions): HyperFramesSkillJob {
    const now = options.now ?? this.now()
    const sequence = ++this.sequence
    const id = options.id ?? this.idFactory({ plan: options.plan, sequence, now })
    if (this.jobs.has(id)) {
      throw new Error(`HyperFrames skill job already exists: ${id}`)
    }

    const planIsExecutable = canExecuteHyperFramesGenerationPlan(options.plan)
    const job: HyperFramesSkillJob = {
      id,
      skillId: options.plan.skillId,
      userInput: options.userInput,
      plan: clonePlan(options.plan),
      status: planIsExecutable ? 'pending' : 'waiting-confirmation',
      currentStage: planIsExecutable ? 'queued' : 'waiting-confirmation',
      attemptCount: 0,
      maxAttempts: options.maxAttempts ?? this.defaultMaxAttempts,
      createdAt: now,
      updatedAt: now,
      outputDirectory: options.plan.output.directory,
      retainOutputDirectoryOnFailure: true,
      cleanupRequired: false,
      cancelRequested: false,
      waitingConfirmation: planIsExecutable
        ? undefined
        : {
            reason: 'plan-confirmation',
            requestedAt: now,
            message: 'Generation plan must be confirmed before the skill job can run.',
          },
      modelConfigSnapshot: options.modelConfigSnapshot,
      logs: cloneLogs(options.logs ?? []),
      diagnostics: [],
      failures: [],
    }

    job.logs.push(
      this.createLogEntry({
        at: now,
        level: 'info',
        stage: job.currentStage,
        message: planIsExecutable
          ? 'Skill job queued for execution.'
          : 'Skill job is waiting for generation plan confirmation.',
      }),
    )

    this.jobs.set(job.id, job)
    this.order.push(job.id)
    this.notify()
    return cloneJob(job)
  }

  getJob(jobId: string): HyperFramesSkillJob | undefined {
    const job = this.jobs.get(jobId)
    return job ? cloneJob(job) : undefined
  }

  listJobs(status?: HyperFramesSkillJobStatus): HyperFramesSkillJob[] {
    return this.order
      .map((jobId) => this.jobs.get(jobId))
      .filter((job): job is HyperFramesSkillJob => Boolean(job))
      .filter((job) => !status || job.status === status)
      .map(cloneJob)
  }

  subscribe(listener: HyperFramesSkillJobQueueListener): () => void {
    this.listeners.add(listener)
    listener(this.listJobs())
    return () => {
      this.listeners.delete(listener)
    }
  }

  confirmWaitingJob(
    jobId: string,
    options: ConfirmHyperFramesGenerationPlanOptions = {},
  ): HyperFramesSkillJob {
    const job = this.requireJob(jobId)
    if (job.status !== 'waiting-confirmation' || !job.waitingConfirmation) {
      throw new Error(`HyperFrames skill job is not waiting for confirmation: ${jobId}`)
    }

    const now = options.confirmedAt ?? this.now()
    const confirmedBy = options.confirmedBy
    if (job.waitingConfirmation.reason === 'plan-confirmation') {
      job.plan = confirmHyperFramesGenerationPlan(job.plan, {
        confirmedAt: now,
        confirmedBy,
      })
    }

    job.status = 'pending'
    job.currentStage = 'queued'
    job.confirmedAt = now
    job.confirmedBy = confirmedBy
    job.updatedAt = now
    job.waitingConfirmation = undefined
    job.cancelRequested = false
    job.logs.push(
      this.createLogEntry({
        at: now,
        level: 'info',
        stage: 'queued',
        message: 'Skill job confirmation received and queued.',
      }),
    )

    this.notify()
    return cloneJob(job)
  }

  startNextJob(options: StartHyperFramesSkillJobOptions = {}): HyperFramesSkillJob | undefined {
    const next = this.order
      .map((jobId) => this.jobs.get(jobId))
      .find((job): job is HyperFramesSkillJob => job?.status === 'pending')
    return next ? this.startJob(next.id, options) : undefined
  }

  startJob(jobId: string, options: StartHyperFramesSkillJobOptions = {}): HyperFramesSkillJob {
    const job = this.requireJob(jobId)
    if (job.status !== 'pending') {
      throw new Error(`HyperFrames skill job cannot start from status ${job.status}: ${jobId}`)
    }

    const now = options.at ?? this.now()
    job.status = 'running'
    job.currentStage = options.stage ?? firstRunnableStep(job.plan)
    job.attemptCount += 1
    job.startedAt = now
    job.updatedAt = now
    job.cancelRequested = false
    job.logs.push(
      this.createLogEntry({
        at: now,
        level: 'info',
        stage: job.currentStage,
        message: `Skill job attempt ${job.attemptCount} started.`,
      }),
    )

    this.notify()
    return cloneJob(job)
  }

  updateJobStage(
    jobId: string,
    stage: HyperFramesGenerationPlanStepType,
    options: Omit<UpdateHyperFramesSkillJobLogOptions, 'stage'> = {
      message: 'Skill job stage updated.',
    },
  ): HyperFramesSkillJob {
    const job = this.requireJob(jobId)
    if (job.status !== 'running') {
      throw new Error(`HyperFrames skill job is not running: ${jobId}`)
    }

    const now = options.at ?? this.now()
    job.currentStage = stage
    job.updatedAt = now
    job.logs.push(
      this.createLogEntry({
        at: now,
        level: options.level ?? 'info',
        stage,
        message: options.message,
        data: options.data,
      }),
    )
    this.notify()
    return cloneJob(job)
  }

  appendJobLog(jobId: string, options: UpdateHyperFramesSkillJobLogOptions): HyperFramesSkillJob {
    const job = this.requireJob(jobId)
    const now = options.at ?? this.now()
    job.updatedAt = now
    job.logs.push(
      this.createLogEntry({
        at: now,
        level: options.level ?? 'info',
        stage: options.stage ?? job.currentStage,
        message: options.message,
        data: options.data,
      }),
    )
    this.notify()
    return cloneJob(job)
  }

  completeJob(jobId: string, options: CompleteHyperFramesSkillJobOptions): HyperFramesSkillJob {
    const job = this.requireJob(jobId)
    if (job.status !== 'running') {
      throw new Error(`HyperFrames skill job cannot complete from status ${job.status}: ${jobId}`)
    }

    const now = options.at ?? this.now()
    const output = cloneOutputBundle(options.output)
    job.status = 'complete'
    job.currentStage = 'complete'
    job.completedAt = now
    job.updatedAt = now
    job.output = output
    job.diagnostics = [...job.diagnostics, ...cloneDiagnostics(output.diagnostics)]
    job.cleanupRequired = false
    job.cancelRequested = false
    job.logs.push(...cloneLogs(output.logs))
    job.logs.push(
      this.createLogEntry({
        at: now,
        level: 'info',
        stage: 'complete',
        message: 'Skill job completed and output bundle is ready for import preview.',
      }),
    )

    this.notify()
    return cloneJob(job)
  }

  failJob(jobId: string, options: FailHyperFramesSkillJobOptions): HyperFramesSkillJob {
    const job = this.requireJob(jobId)
    if (job.status === 'complete' || job.status === 'canceled') {
      throw new Error(`HyperFrames skill job cannot fail from status ${job.status}: ${jobId}`)
    }

    const now = options.at ?? this.now()
    const diagnostics = cloneDiagnostics(options.diagnostics ?? [])
    const failure: HyperFramesSkillJobFailure = {
      at: now,
      stage: options.stage ?? job.currentStage,
      message: options.message,
      code: options.code,
      retryable: options.retryable ?? true,
      diagnostics,
    }

    job.status = 'failed'
    job.currentStage = 'failed'
    job.failedAt = now
    job.updatedAt = now
    job.cleanupRequired = false
    job.cancelRequested = false
    job.failures.push(failure)
    job.diagnostics = [...job.diagnostics, ...diagnostics]
    job.logs.push(
      this.createLogEntry({
        at: now,
        level: 'error',
        stage: failure.stage,
        message: options.message,
        data: {
          code: options.code,
          outputDirectory: job.outputDirectory,
          retryable: failure.retryable,
        },
      }),
    )
    job.logs.push(
      this.createLogEntry({
        at: now,
        level: 'info',
        stage: 'failed',
        message: 'Temporary output directory and logs were retained for retry or repair.',
        data: { outputDirectory: job.outputDirectory },
      }),
    )

    this.notify()
    return cloneJob(job)
  }

  cancelJob(jobId: string, options: CancelHyperFramesSkillJobOptions = {}): HyperFramesSkillJob {
    const job = this.requireJob(jobId)
    if (job.status === 'complete' || job.status === 'failed' || job.status === 'canceled') {
      throw new Error(`HyperFrames skill job cannot cancel from status ${job.status}: ${jobId}`)
    }

    const now = options.at ?? this.now()
    job.status = 'canceled'
    job.currentStage = 'canceled'
    job.canceledAt = now
    job.updatedAt = now
    job.cancelRequested = true
    job.cleanupRequired = false
    job.logs.push(
      this.createLogEntry({
        at: now,
        level: 'warning',
        stage: 'canceled',
        message: options.reason ?? 'Skill job canceled by user.',
        data: { outputDirectory: job.outputDirectory },
      }),
    )

    this.notify()
    return cloneJob(job)
  }

  retryJob(jobId: string, options: RetryHyperFramesSkillJobOptions = {}): HyperFramesSkillJob {
    const job = this.requireJob(jobId)
    if (job.status !== 'failed') {
      throw new Error(`Only failed HyperFrames skill jobs can be retried: ${jobId}`)
    }

    const now = options.at ?? this.now()
    const lastFailure = job.failures.at(-1)
    if (lastFailure && !lastFailure.retryable) {
      throw new Error(`HyperFrames skill job failure is not retryable: ${jobId}`)
    }

    if (job.attemptCount >= job.maxAttempts && !options.confirmedBy) {
      job.status = 'waiting-confirmation'
      job.currentStage = 'waiting-confirmation'
      job.updatedAt = now
      job.waitingConfirmation = {
        reason: 'retry-limit',
        requestedAt: now,
        message: 'Retry limit reached. User confirmation is required before another attempt.',
      }
      job.logs.push(
        this.createLogEntry({
          at: now,
          level: 'warning',
          stage: 'waiting-confirmation',
          message: 'Retry limit reached; waiting for user confirmation.',
          data: {
            attemptCount: job.attemptCount,
            maxAttempts: job.maxAttempts,
            outputDirectory: job.outputDirectory,
          },
        }),
      )
      this.notify()
      return cloneJob(job)
    }

    job.status = 'pending'
    job.currentStage = 'queued'
    job.failedAt = undefined
    job.updatedAt = now
    job.waitingConfirmation = undefined
    job.cancelRequested = false
    job.cleanupRequired = false
    job.confirmedAt = options.confirmedBy ? now : job.confirmedAt
    job.confirmedBy = options.confirmedBy ?? job.confirmedBy
    job.logs.push(
      this.createLogEntry({
        at: now,
        level: 'info',
        stage: 'queued',
        message: 'Skill job queued for retry with retained temporary output directory and logs.',
        data: {
          attemptCount: job.attemptCount,
          maxAttempts: job.maxAttempts,
          outputDirectory: job.outputDirectory,
        },
      }),
    )

    this.notify()
    return cloneJob(job)
  }

  private requireJob(jobId: string): HyperFramesSkillJob {
    const job = this.jobs.get(jobId)
    if (!job) {
      throw new Error(`HyperFrames skill job not found: ${jobId}`)
    }
    return job
  }

  private createLogEntry(
    input: Omit<HyperFramesSkillJobLogEntry, 'id'>,
  ): HyperFramesSkillJobLogEntry {
    return {
      ...input,
      id: `job-log-${++this.logSequence}`,
      data: input.data ? { ...input.data } : undefined,
    }
  }

  private notify(): void {
    if (this.listeners.size === 0) return
    const jobs = this.listJobs()
    for (const listener of this.listeners) {
      listener(jobs)
    }
  }
}

export function createHyperFramesSkillJobQueue(
  options: HyperFramesSkillJobQueueOptions = {},
): HyperFramesSkillJobQueue {
  return new HyperFramesSkillJobQueue(options)
}

function firstRunnableStep(plan: HyperFramesGenerationPlan): HyperFramesGenerationPlanStepType {
  return plan.steps.find((step) => step.canExecute)?.type ?? 'collect-context'
}

function cloneJob(job: HyperFramesSkillJob): HyperFramesSkillJob {
  return {
    ...job,
    plan: clonePlan(job.plan),
    waitingConfirmation: job.waitingConfirmation ? { ...job.waitingConfirmation } : undefined,
    logs: cloneLogs(job.logs),
    diagnostics: cloneDiagnostics(job.diagnostics),
    failures: job.failures.map(cloneFailure),
    output: job.output ? cloneOutputBundle(job.output) : undefined,
  }
}

function clonePlan(plan: HyperFramesGenerationPlan): HyperFramesGenerationPlan {
  return {
    ...plan,
    steps: plan.steps.map(clonePlanStep),
    toolPermissions: plan.toolPermissions.map(cloneToolPermission),
    modelBudget: {
      ...plan.modelBudget,
      lineItems: plan.modelBudget.lineItems.map((item) => ({ ...item })),
    },
    output: { ...plan.output },
    warnings: [...plan.warnings],
  }
}

function clonePlanStep(step: HyperFramesGenerationPlanStep): HyperFramesGenerationPlanStep {
  return {
    ...step,
    dependsOn: step.dependsOn ? [...step.dependsOn] : undefined,
    toolPermissionIds: [...step.toolPermissionIds],
  }
}

function cloneToolPermission(
  permission: HyperFramesGenerationToolPermission,
): HyperFramesGenerationToolPermission {
  return { ...permission }
}

function cloneLogs(logs: HyperFramesSkillJobLogEntry[]): HyperFramesSkillJobLogEntry[] {
  return logs.map((log) => ({
    ...log,
    data: log.data ? { ...log.data } : undefined,
  }))
}

function cloneDiagnostics(diagnostics: HyperFramesDiagnostic[]): HyperFramesDiagnostic[] {
  return diagnostics.map((diagnostic) => ({ ...diagnostic }))
}

function cloneFailure(failure: HyperFramesSkillJobFailure): HyperFramesSkillJobFailure {
  return {
    ...failure,
    diagnostics: cloneDiagnostics(failure.diagnostics),
  }
}

function cloneOutputBundle(output: HyperFramesSkillOutputBundle): HyperFramesSkillOutputBundle {
  return {
    ...output,
    projectDirectory: output.projectDirectory
      ? cloneProjectDirectory(output.projectDirectory)
      : undefined,
    manifest: output.manifest ? cloneManifest(output.manifest) : undefined,
    generatedFiles: output.generatedFiles.map(cloneProjectFile),
    sourceAssets: output.sourceAssets.map(cloneBinaryAsset),
    logs: cloneLogs(output.logs),
    diagnostics: cloneDiagnostics(output.diagnostics),
    modelUsage: output.modelUsage.map((usage) => ({ ...usage })),
  }
}

function cloneProjectDirectory(
  directory: HyperFramesProjectDirectory,
): HyperFramesProjectDirectory {
  return {
    manifest: cloneManifest(directory.manifest),
    files: directory.files.map(cloneProjectFile),
    assets: directory.assets.map(cloneBinaryAsset),
  }
}

function cloneManifest(manifest: HyperFramesProjectManifest): HyperFramesProjectManifest {
  return {
    ...manifest,
    canvas: { ...manifest.canvas },
    assets: manifest.assets.map((asset) => ({ ...asset })),
    provenance: {
      ...manifest.provenance,
      modelUsage: manifest.provenance.modelUsage
        ? { ...manifest.provenance.modelUsage }
        : undefined,
    },
    diagnostics: manifest.diagnostics ? cloneDiagnostics(manifest.diagnostics) : undefined,
    variables: manifest.variables ? { ...manifest.variables } : undefined,
    tags: manifest.tags ? [...manifest.tags] : undefined,
    lastStudioSave: manifest.lastStudioSave
      ? {
          ...manifest.lastStudioSave,
          files: [...manifest.lastStudioSave.files],
        }
      : undefined,
    lastModelMutation: manifest.lastModelMutation ? { ...manifest.lastModelMutation } : undefined,
    lintSummary: manifest.lintSummary
      ? {
          ...manifest.lintSummary,
          diagnostics: cloneDiagnostics(manifest.lintSummary.diagnostics),
        }
      : undefined,
  }
}

function cloneProjectFile(file: HyperFramesProjectFile): HyperFramesProjectFile {
  return { ...file }
}

function cloneBinaryAsset(asset: HyperFramesBinaryAsset): HyperFramesBinaryAsset {
  return {
    ...asset,
    bytes: Uint8Array.from(asset.bytes),
  }
}
