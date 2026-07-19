import type { HyperFramesDiagnostic, ModelCapability } from '@/types/hyperframes'
import type { HyperFramesGenerationPlan } from './generationPlan'
import type {
  HyperFramesSkillJob,
  HyperFramesSkillJobLogEntry,
  HyperFramesSkillJobStage,
  HyperFramesSkillOutputBundle,
} from './skillJobQueue'

export type LocalServiceSkillExecutorErrorCode =
  | 'canceled'
  | 'execution-failed'
  | 'invalid-job-status'
  | 'runtime-unavailable'
  | 'timeout'

export class LocalServiceSkillExecutorError extends Error {
  constructor(
    public readonly code: LocalServiceSkillExecutorErrorCode,
    message: string,
    public readonly diagnostics: HyperFramesDiagnostic[] = [],
  ) {
    super(message)
    this.name = 'LocalServiceSkillExecutorError'
  }
}

export type LocalServiceCapability =
  | 'chrome'
  | 'ffmpeg'
  | 'filesystem'
  | 'network'
  | 'node'
  | 'python'
  | 'render-runtime'
  | 'screenshot'
  | 'transcription'

export interface LocalServiceScriptPermission {
  id: string
  capability: LocalServiceCapability
  required: boolean
  inputDirectories: string[]
  outputDirectory: string
  allowNetwork: boolean
  maxRuntimeMs: number
  cancellable: boolean
  reason: string
}

export interface LocalServiceRuntimeCheckRequest {
  jobId: string
  plan: HyperFramesGenerationPlan
  capabilities: LocalServiceCapability[]
  permissions: LocalServiceScriptPermission[]
}

export interface LocalServiceRuntimeCheckResult {
  ok: boolean
  availableCapabilities: LocalServiceCapability[]
  missingCapabilities: LocalServiceCapability[]
  diagnostics: HyperFramesDiagnostic[]
}

export interface LocalServiceRunSkillRequest {
  job: HyperFramesSkillJob
  plan: HyperFramesGenerationPlan
  permissions: LocalServiceScriptPermission[]
  outputDirectory: string
  signal: AbortSignal
}

export interface LocalServiceSkillRuntime {
  checkRuntime(request: LocalServiceRuntimeCheckRequest): Promise<LocalServiceRuntimeCheckResult>
  runSkill(request: LocalServiceRunSkillRequest): Promise<HyperFramesSkillOutputBundle>
  cancelJob?(jobId: string, reason: 'canceled' | 'timeout'): Promise<void> | void
}

export interface LocalServiceSkillExecutorOptions {
  runtime: LocalServiceSkillRuntime
  now?: () => number
  defaultMaxRuntimeMs?: number
  inputDirectories?: string[]
}

export interface ExecuteLocalServiceSkillJobOptions {
  signal?: AbortSignal
  maxRuntimeMs?: number
  inputDirectories?: string[]
  now?: number
}

export interface LocalServiceSkillPlanCheck {
  ok: boolean
  capabilities: LocalServiceCapability[]
  permissions: LocalServiceScriptPermission[]
  diagnostics: HyperFramesDiagnostic[]
}

const DEFAULT_MAX_RUNTIME_MS = 120_000

const TOOL_CAPABILITIES: Record<string, LocalServiceCapability[]> = {
  'filesystem.temp-write': ['filesystem'],
  'network.access': ['network'],
  'tool.browser': ['chrome', 'screenshot'],
  'tool.ffmpeg': ['ffmpeg'],
  'tool.figma': ['network'],
  'tool.github-cli': ['network'],
  'tool.hyperframes-cli': ['filesystem', 'node'],
  'tool.media-use': ['filesystem'],
  'tool.node': ['node'],
  'tool.python': ['python'],
  'tool.render-runtime': ['render-runtime'],
  'tool.subagent': ['network'],
}

const MODEL_CAPABILITIES: Partial<Record<ModelCapability, LocalServiceCapability[]>> = {
  'audio.transcription': ['transcription'],
  'vision.frame-analysis': ['chrome', 'screenshot'],
}

export class LocalServiceSkillExecutor {
  private readonly runtime: LocalServiceSkillRuntime
  private readonly now: () => number
  private readonly defaultMaxRuntimeMs: number
  private readonly inputDirectories: string[]
  private logSequence = 0

  constructor(options: LocalServiceSkillExecutorOptions) {
    this.runtime = options.runtime
    this.now = options.now ?? Date.now
    this.defaultMaxRuntimeMs = options.defaultMaxRuntimeMs ?? DEFAULT_MAX_RUNTIME_MS
    this.inputDirectories = options.inputDirectories ?? []
  }

  checkPlan(
    plan: HyperFramesGenerationPlan,
    options: ExecuteLocalServiceSkillJobOptions = {},
  ): LocalServiceSkillPlanCheck {
    const maxRuntimeMs = options.maxRuntimeMs ?? this.defaultMaxRuntimeMs
    const inputDirectories = options.inputDirectories ?? this.inputDirectories
    const capabilities = inferLocalServiceCapabilities(plan)
    const permissions = createLocalServiceScriptPermissions(plan, {
      capabilities,
      inputDirectories,
      maxRuntimeMs,
    })

    return {
      ok: permissions.every((permission) => permission.cancellable && permission.maxRuntimeMs > 0),
      capabilities,
      permissions,
      diagnostics: [],
    }
  }

  async executeJob(
    job: HyperFramesSkillJob,
    options: ExecuteLocalServiceSkillJobOptions = {},
  ): Promise<HyperFramesSkillOutputBundle> {
    if (job.status !== 'running') {
      throw new LocalServiceSkillExecutorError(
        'invalid-job-status',
        `Local service skill executor requires a running job. Received ${job.status}.`,
      )
    }

    const now = options.now ?? this.now()
    const check = this.checkPlan(job.plan, options)
    const logs: HyperFramesSkillJobLogEntry[] = [
      this.createLog({
        at: now,
        level: 'info',
        stage: 'run-skill',
        message: 'Local service skill executor started.',
      }),
    ]

    const runtimeCheck = await this.runtime.checkRuntime({
      jobId: job.id,
      plan: job.plan,
      capabilities: check.capabilities,
      permissions: check.permissions,
    })
    if (!runtimeCheck.ok) {
      throw new LocalServiceSkillExecutorError(
        'runtime-unavailable',
        `Local service runtime is missing capabilities: ${runtimeCheck.missingCapabilities.join(', ')}.`,
        runtimeCheck.diagnostics,
      )
    }

    logs.push(
      this.createLog({
        at: now,
        level: 'info',
        stage: 'run-skill',
        message: 'Local service runtime preflight passed.',
        data: {
          capabilities: runtimeCheck.availableCapabilities,
          maxRuntimeMs: check.permissions[0]?.maxRuntimeMs ?? this.defaultMaxRuntimeMs,
        },
      }),
    )

    const controller = new AbortController()
    const disposeExternalAbort = bridgeExternalAbort(options.signal, controller, () => {
      void this.cancelRuntimeJob(job.id, 'canceled')
    })

    try {
      const output = await this.runWithTimeout({
        job,
        permissions: check.permissions,
        controller,
        maxRuntimeMs: options.maxRuntimeMs ?? this.defaultMaxRuntimeMs,
        externalSignal: options.signal,
      })

      logs.push(
        this.createLog({
          at: options.now ?? this.now(),
          level: 'info',
          stage: 'complete',
          message: 'Local service skill output received.',
        }),
      )

      return {
        ...output,
        logs: [...logs, ...output.logs],
      }
    } catch (error) {
      if (error instanceof LocalServiceSkillExecutorError) {
        throw error
      }
      const message =
        error instanceof Error ? error.message : 'Local service skill execution failed.'
      throw new LocalServiceSkillExecutorError('execution-failed', message)
    } finally {
      disposeExternalAbort()
    }
  }

  private async runWithTimeout(input: {
    job: HyperFramesSkillJob
    permissions: LocalServiceScriptPermission[]
    controller: AbortController
    maxRuntimeMs: number
    externalSignal?: AbortSignal
  }): Promise<HyperFramesSkillOutputBundle> {
    let timeoutId: ReturnType<typeof setTimeout> | undefined

    const timeout = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(
          new LocalServiceSkillExecutorError(
            'timeout',
            `Local service skill execution exceeded ${input.maxRuntimeMs}ms.`,
          ),
        )
        void this.cancelRuntimeJob(input.job.id, 'timeout')
        input.controller.abort()
      }, input.maxRuntimeMs)
    })
    const externalCancel = createExternalCancelPromise(input.externalSignal)
    try {
      return await Promise.race([
        this.runtime.runSkill({
          job: input.job,
          plan: input.job.plan,
          permissions: input.permissions,
          outputDirectory: input.job.outputDirectory,
          signal: input.controller.signal,
        }),
        timeout,
        externalCancel,
      ])
    } finally {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId)
      }
    }
  }

  private async cancelRuntimeJob(jobId: string, reason: 'canceled' | 'timeout'): Promise<void> {
    await this.runtime.cancelJob?.(jobId, reason)
  }

  private createLog(input: Omit<HyperFramesSkillJobLogEntry, 'id'>): HyperFramesSkillJobLogEntry {
    return {
      ...input,
      id: `local-service-skill-log-${++this.logSequence}`,
      data: input.data ? { ...input.data } : undefined,
    }
  }
}

export function createLocalServiceSkillExecutor(
  options: LocalServiceSkillExecutorOptions,
): LocalServiceSkillExecutor {
  return new LocalServiceSkillExecutor(options)
}

export function inferLocalServiceCapabilities(
  plan: HyperFramesGenerationPlan,
): LocalServiceCapability[] {
  const capabilities = new Set<LocalServiceCapability>(['filesystem'])
  if (plan.requiresNetwork) {
    capabilities.add('network')
  }
  if (plan.requiresRenderRuntime) {
    capabilities.add('render-runtime')
  }

  for (const permission of plan.toolPermissions) {
    for (const capability of TOOL_CAPABILITIES[permission.id] ?? []) {
      capabilities.add(capability)
    }
  }
  for (const item of plan.modelBudget.lineItems) {
    for (const capability of MODEL_CAPABILITIES[item.capability] ?? []) {
      capabilities.add(capability)
    }
  }

  return [...capabilities].sort()
}

export function createLocalServiceScriptPermissions(
  plan: HyperFramesGenerationPlan,
  options: {
    capabilities?: LocalServiceCapability[]
    inputDirectories?: string[]
    maxRuntimeMs?: number
  } = {},
): LocalServiceScriptPermission[] {
  const capabilities = options.capabilities ?? inferLocalServiceCapabilities(plan)
  const maxRuntimeMs = options.maxRuntimeMs ?? DEFAULT_MAX_RUNTIME_MS
  const inputDirectories = options.inputDirectories ?? []
  return capabilities.map((capability) => ({
    id: `local-service.${capability}`,
    capability,
    required: true,
    inputDirectories,
    outputDirectory: plan.output.directory,
    allowNetwork: plan.requiresNetwork || capability === 'network',
    maxRuntimeMs,
    cancellable: true,
    reason: reasonForCapability(capability),
  }))
}

function reasonForCapability(capability: LocalServiceCapability): string {
  switch (capability) {
    case 'chrome':
      return 'Run browser-backed preview, capture or HTML validation.'
    case 'ffmpeg':
      return 'Process media, audio or rendered video output.'
    case 'filesystem':
      return 'Read inputs and write the generated HyperFrames project directory.'
    case 'network':
      return 'Fetch confirmed remote resources or call remote model services.'
    case 'node':
      return 'Run migrated TypeScript or Node-based skill helpers.'
    case 'python':
      return 'Run migrated Python helpers isolated in the local service.'
    case 'render-runtime':
      return 'Render proof media or final media through the local producer runtime.'
    case 'screenshot':
      return 'Capture thumbnails, frame checks or visual diagnostics.'
    case 'transcription':
      return 'Transcribe selected audio or video material.'
  }
}

function bridgeExternalAbort(
  externalSignal: AbortSignal | undefined,
  controller: AbortController,
  onAbort: () => void,
): () => void {
  if (!externalSignal) return () => {}
  const listener = () => {
    onAbort()
    controller.abort()
  }
  if (externalSignal.aborted) {
    listener()
    return () => {}
  }
  externalSignal.addEventListener('abort', listener, { once: true })
  return () => externalSignal.removeEventListener('abort', listener)
}

function createExternalCancelPromise(signal: AbortSignal | undefined): Promise<never> {
  return new Promise((_, reject) => {
    if (!signal) return
    const rejectCanceled = () =>
      reject(
        new LocalServiceSkillExecutorError('canceled', 'Local service skill job was canceled.'),
      )
    if (signal.aborted) {
      rejectCanceled()
      return
    }
    signal.addEventListener('abort', rejectCanceled, { once: true })
  })
}

export type { HyperFramesSkillJobStage }
