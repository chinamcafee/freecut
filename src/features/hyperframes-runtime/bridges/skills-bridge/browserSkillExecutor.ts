import type {
  HyperFramesBinaryAsset,
  HyperFramesDiagnostic,
  HyperFramesModelUsageSummary,
  HyperFramesProjectCanvas,
  HyperFramesProjectDirectory,
  HyperFramesProjectFile,
  HyperFramesProjectManifest,
} from '@/types/hyperframes'
import {
  hyperFramesLintAdapter,
  type HyperFramesLintAdapter,
} from '../../adapters/freecut-project/lint-adapter'
import {
  hashHyperFramesText,
  stableHyperFramesHash,
} from '../../adapters/freecut-project/project-signatures'
import type { ModelRoutingPlan } from '../../model-center'
import type { HyperFramesGenerationPlan } from './generationPlan'
import type {
  HyperFramesSkillJob,
  HyperFramesSkillJobLogEntry,
  HyperFramesSkillJobStage,
  HyperFramesSkillOutputBundle,
} from './skillJobQueue'

export type BrowserSkillExecutorErrorCode =
  | 'canceled'
  | 'invalid-job-status'
  | 'missing-model-invoker'
  | 'unsupported-plan'

export class BrowserSkillExecutorError extends Error {
  constructor(
    public readonly code: BrowserSkillExecutorErrorCode,
    message: string,
    public readonly reasons: string[] = [],
  ) {
    super(message)
    this.name = 'BrowserSkillExecutorError'
  }
}

export interface BrowserSkillModelMessage {
  role: 'assistant' | 'system' | 'user'
  content: string
}

export interface BrowserSkillModelRequest {
  jobId: string
  skillId: string
  userInput: string
  plan: HyperFramesGenerationPlan
  modelRoutingPlan?: ModelRoutingPlan
  messages: BrowserSkillModelMessage[]
  outputDirectory: string
  signal?: AbortSignal
}

export interface BrowserSkillModelGeneratedFile {
  path: string
  content: string
}

export interface BrowserSkillModelResult {
  title?: string
  indexHtml?: string
  compositionHtml?: string
  files?: BrowserSkillModelGeneratedFile[]
  diagnostics?: HyperFramesDiagnostic[]
  modelUsage?: HyperFramesModelUsageSummary[]
}

export type BrowserSkillModelInvoker = (
  request: BrowserSkillModelRequest,
) => Promise<BrowserSkillModelResult>

export interface BrowserSkillExecutorCheck {
  ok: boolean
  reasons: string[]
  supportedToolPermissionIds: string[]
  unsupportedToolPermissionIds: string[]
}

export interface ExecuteBrowserSkillJobOptions {
  modelRoutingPlan?: ModelRoutingPlan
  signal?: AbortSignal
  now?: number
}

export interface BrowserSkillExecutorOptions {
  modelInvoker?: BrowserSkillModelInvoker
  lintAdapter?: HyperFramesLintAdapter
  now?: () => number
  allowNetwork?: boolean
  defaultCanvas?: Partial<HyperFramesProjectCanvas>
}

const SUPPORTED_TOOL_PERMISSION_IDS = new Set([
  'filesystem.temp-write',
  'network.access',
  'tool.browser',
])

export class BrowserSkillExecutor {
  private readonly modelInvoker?: BrowserSkillModelInvoker
  private readonly lintAdapter: HyperFramesLintAdapter
  private readonly now: () => number
  private readonly allowNetwork: boolean
  private readonly defaultCanvas: Partial<HyperFramesProjectCanvas>
  private logSequence = 0

  constructor(options: BrowserSkillExecutorOptions = {}) {
    this.modelInvoker = options.modelInvoker
    this.lintAdapter = options.lintAdapter ?? hyperFramesLintAdapter
    this.now = options.now ?? Date.now
    this.allowNetwork = options.allowNetwork ?? true
    this.defaultCanvas = options.defaultCanvas ?? {}
  }

  checkPlan(plan: HyperFramesGenerationPlan): BrowserSkillExecutorCheck {
    return checkBrowserSkillPlan(plan, { allowNetwork: this.allowNetwork })
  }

  async executeJob(
    job: HyperFramesSkillJob,
    options: ExecuteBrowserSkillJobOptions = {},
  ): Promise<HyperFramesSkillOutputBundle> {
    if (job.status !== 'running') {
      throw new BrowserSkillExecutorError(
        'invalid-job-status',
        `Browser skill executor requires a running job. Received ${job.status}.`,
      )
    }

    const check = this.checkPlan(job.plan)
    if (!check.ok) {
      throw new BrowserSkillExecutorError(
        'unsupported-plan',
        'Generation plan requires capabilities outside the browser-light executor.',
        check.reasons,
      )
    }

    assertNotCanceled(options.signal)
    const now = options.now ?? this.now()
    const logs: HyperFramesSkillJobLogEntry[] = [
      this.createLog({
        at: now,
        level: 'info',
        stage: 'run-skill',
        message: 'Browser-light skill executor started.',
      }),
    ]

    const modelResult = await this.invokeModelIfNeeded(job, options, logs)
    assertNotCanceled(options.signal)

    const normalized = await this.normalizeOutput({
      job,
      modelResult,
      logs,
      now,
    })

    logs.push(
      this.createLog({
        at: now,
        level: 'info',
        stage: 'complete',
        message: 'Browser-light skill output normalized to SkillOutputBundle.',
      }),
    )

    return {
      outputDirectory: job.outputDirectory,
      suggestedImportStrategy: job.plan.importStrategy,
      projectDirectory: normalized.directory,
      manifest: normalized.directory.manifest,
      generatedFiles: normalized.directory.files,
      sourceAssets: normalized.directory.assets,
      logs,
      diagnostics: normalized.diagnostics,
      modelUsage: normalized.modelUsage,
    }
  }

  private async invokeModelIfNeeded(
    job: HyperFramesSkillJob,
    options: ExecuteBrowserSkillJobOptions,
    logs: HyperFramesSkillJobLogEntry[],
  ): Promise<BrowserSkillModelResult | undefined> {
    if (!requiresModelCall(job.plan)) {
      return undefined
    }
    if (!this.modelInvoker) {
      throw new BrowserSkillExecutorError(
        'missing-model-invoker',
        'Browser skill executor requires a modelInvoker for plans with model steps.',
      )
    }

    logs.push(
      this.createLog({
        at: options.now ?? this.now(),
        level: 'info',
        stage: 'call-model',
        message: 'Invoking browser-light model generation.',
      }),
    )

    return this.modelInvoker({
      jobId: job.id,
      skillId: job.skillId,
      userInput: job.userInput,
      plan: job.plan,
      modelRoutingPlan: options.modelRoutingPlan,
      messages: createModelMessages(job),
      outputDirectory: job.outputDirectory,
      signal: options.signal,
    })
  }

  private async normalizeOutput(input: {
    job: HyperFramesSkillJob
    modelResult: BrowserSkillModelResult | undefined
    logs: HyperFramesSkillJobLogEntry[]
    now: number
  }): Promise<{
    directory: HyperFramesProjectDirectory
    diagnostics: HyperFramesDiagnostic[]
    modelUsage: HyperFramesModelUsageSummary[]
  }> {
    const modelDiagnostics = input.modelResult?.diagnostics ?? []
    const fileNormalization = normalizeGeneratedFiles(
      input.job,
      input.modelResult,
      modelDiagnostics,
    )
    const manifest = createManifest({
      job: input.job,
      title: input.modelResult?.title,
      now: input.now,
      modelUsage: input.modelResult?.modelUsage?.[0],
      canvas: this.defaultCanvas,
    })
    let directory: HyperFramesProjectDirectory = {
      manifest,
      files: fileNormalization.files,
      assets: [],
    }

    const lintResult = await this.lintAdapter.lintProjectDirectory(directory, {
      stage: 'import',
      checkedAt: input.now,
      activeCompositionOnly: false,
    })
    const diagnostics = [
      ...fileNormalization.diagnostics,
      ...modelDiagnostics,
      ...lintResult.diagnostics,
    ]

    directory = {
      ...directory,
      manifest: {
        ...directory.manifest,
        diagnostics,
        lintSummary: lintResult.summary,
      },
      files: upsertProjectFile(
        directory.files,
        'metadata/diagnostics.json',
        JSON.stringify({ diagnostics }, null, 2),
      ),
    }

    input.logs.push(
      this.createLog({
        at: input.now,
        level: lintResult.ok ? 'info' : 'warning',
        stage: 'lint',
        message: lintResult.ok
          ? 'Browser-light project directory lint passed.'
          : 'Browser-light project directory lint produced diagnostics.',
        data: {
          blockingCount: lintResult.summary.blockingCount,
          warningCount: lintResult.summary.warningCount,
          suggestionCount: lintResult.summary.suggestionCount,
        },
      }),
    )

    return {
      directory,
      diagnostics,
      modelUsage: input.modelResult?.modelUsage ?? [],
    }
  }

  private createLog(input: Omit<HyperFramesSkillJobLogEntry, 'id'>): HyperFramesSkillJobLogEntry {
    return {
      ...input,
      id: `browser-skill-log-${++this.logSequence}`,
      data: input.data ? { ...input.data } : undefined,
    }
  }
}

export function createBrowserSkillExecutor(
  options: BrowserSkillExecutorOptions = {},
): BrowserSkillExecutor {
  return new BrowserSkillExecutor(options)
}

export function checkBrowserSkillPlan(
  plan: HyperFramesGenerationPlan,
  options: { allowNetwork?: boolean } = {},
): BrowserSkillExecutorCheck {
  const reasons: string[] = []
  const supportedToolPermissionIds: string[] = []
  const unsupportedToolPermissionIds: string[] = []
  const allowNetwork = options.allowNetwork ?? true

  if (plan.requiresRenderRuntime) {
    reasons.push('Plan requires render runtime, which is not available in browser-light mode.')
  }
  if (plan.requiresNetwork && !allowNetwork) {
    reasons.push('Plan requires network access, but browser-light network access is disabled.')
  }

  for (const step of plan.steps) {
    if (step.environment === 'local-service' && step.type !== 'write-project-files') {
      reasons.push(`Step "${step.id}" requires local-service execution.`)
    }
  }

  for (const permission of plan.toolPermissions) {
    if (isSupportedBrowserPermission(permission.id)) {
      supportedToolPermissionIds.push(permission.id)
      continue
    }
    unsupportedToolPermissionIds.push(permission.id)
    reasons.push(`Tool permission "${permission.id}" is not supported by browser-light mode.`)
  }

  return {
    ok: reasons.length === 0,
    reasons,
    supportedToolPermissionIds,
    unsupportedToolPermissionIds,
  }
}

function isSupportedBrowserPermission(permissionId: string): boolean {
  return (
    SUPPORTED_TOOL_PERMISSION_IDS.has(permissionId) ||
    /^material\.[a-z-]+\.read$/.test(permissionId)
  )
}

function requiresModelCall(plan: HyperFramesGenerationPlan): boolean {
  return (
    plan.steps.some((step) => step.type === 'call-model') || plan.modelBudget.lineItems.length > 0
  )
}

function createModelMessages(job: HyperFramesSkillJob): BrowserSkillModelMessage[] {
  return [
    {
      role: 'system',
      content:
        'Generate a lightweight HyperFrames project directory for FreeCut. Return safe HTML only; no scripts, no local filesystem access, no Chrome, no FFmpeg.',
    },
    {
      role: 'user',
      content: [
        `Skill: ${job.plan.skillTitle} (${job.skillId})`,
        `Import strategy: ${job.plan.importStrategy}`,
        `Output directory: ${job.outputDirectory}`,
        `User request: ${job.userInput}`,
      ].join('\n'),
    },
  ]
}

function normalizeGeneratedFiles(
  job: HyperFramesSkillJob,
  modelResult: BrowserSkillModelResult | undefined,
  diagnostics: HyperFramesDiagnostic[],
): { files: HyperFramesProjectFile[]; diagnostics: HyperFramesDiagnostic[] } {
  const files = new Map<string, string>()
  const normalizationDiagnostics: HyperFramesDiagnostic[] = []

  for (const file of modelResult?.files ?? []) {
    const normalizedPath = normalizeMemoryProjectPath(file.path)
    if (!normalizedPath) {
      normalizationDiagnostics.push(createUnsafePathDiagnostic(file.path))
      continue
    }
    files.set(normalizedPath, file.content)
  }

  const title = modelResult?.title ?? job.plan.title
  if (!files.has('compositions/main.html')) {
    files.set(
      'compositions/main.html',
      modelResult?.compositionHtml ?? createFallbackCompositionHtml(job.userInput),
    )
  }
  if (!files.has('index.html')) {
    files.set('index.html', modelResult?.indexHtml ?? createDefaultIndexHtml(title))
  }

  files.set(
    'metadata/provenance.json',
    JSON.stringify(
      {
        source: 'browser-light-skill-executor',
        jobId: job.id,
        planId: job.plan.id,
        skillId: job.skillId,
        outputDirectory: job.outputDirectory,
      },
      null,
      2,
    ),
  )
  files.set(
    'metadata/diagnostics.json',
    JSON.stringify(
      {
        diagnostics: [...diagnostics, ...normalizationDiagnostics],
      },
      null,
      2,
    ),
  )

  return {
    files: [...files.entries()].map(([path, content]) => createProjectFile(path, content)),
    diagnostics: normalizationDiagnostics,
  }
}

function createManifest(input: {
  job: HyperFramesSkillJob
  title: string | undefined
  now: number
  modelUsage: HyperFramesModelUsageSummary | undefined
  canvas: Partial<HyperFramesProjectCanvas>
}): HyperFramesProjectManifest {
  const durationInFrames =
    input.job.plan.output.estimatedDurationFrames ??
    Math.round((input.job.plan.output.estimatedDurationSeconds ?? 10) * (input.canvas.fps ?? 30))
  return {
    schemaVersion: 1,
    id: toProjectId(input.job.plan.id),
    title: input.title ?? input.job.plan.title,
    entryFile: 'index.html',
    activeCompositionPath: 'compositions/main.html',
    canvas: {
      width: input.canvas.width ?? 1920,
      height: input.canvas.height ?? 1080,
      fps: input.canvas.fps ?? 30,
      durationInFrames,
      backgroundColor: input.canvas.backgroundColor,
    },
    assets: [],
    provenance: {
      source: 'skill-output',
      createdAt: input.now,
      skillId: input.job.skillId,
      modelUsage: input.modelUsage,
      confirmedByUser: input.job.plan.status === 'confirmed',
    },
  }
}

function createProjectFile(path: string, content: string): HyperFramesProjectFile {
  return {
    path,
    content,
    encoding: 'utf8',
    hash: hashHyperFramesText(content),
  }
}

function upsertProjectFile(
  files: HyperFramesProjectFile[],
  path: string,
  content: string,
): HyperFramesProjectFile[] {
  const next = files.filter((file) => file.path !== path)
  next.push(createProjectFile(path, content))
  return next
}

function normalizeMemoryProjectPath(path: string): string | null {
  const parts: string[] = []
  for (const rawSegment of path.replaceAll('\\', '/').split('/')) {
    const segment = rawSegment.trim()
    if (!segment || segment === '.') continue
    if (segment === '..') return null
    parts.push(segment)
  }
  if (parts.length === 0) return null
  const normalized = parts.join('/')
  if (normalized.startsWith('/') || normalized.includes('\0')) return null
  return normalized
}

function createUnsafePathDiagnostic(path: string): HyperFramesDiagnostic {
  return {
    id: `hyperframes.browser_executor.unsafe_path:${stableHyperFramesHash(path).slice(0, 10)}`,
    code: 'hyperframes.browser_executor.unsafe_path',
    source: 'storage',
    stage: 'import',
    severity: 'blocking',
    message: `Browser-light model output contained an unsafe project path: ${path}.`,
    fixHint: 'Regenerate the file with a project-relative path inside the HyperFrames directory.',
  }
}

function createDefaultIndexHtml(title: string): string {
  return [
    '<!doctype html>',
    '<html>',
    '<head>',
    '<meta charset="utf-8">',
    `<title>${escapeHtml(title)}</title>`,
    '</head>',
    '<body>',
    '<iframe title="HyperFrames composition" src="./compositions/main.html"></iframe>',
    '</body>',
    '</html>',
  ].join('')
}

function createFallbackCompositionHtml(userInput: string): string {
  return `<section data-hf-item="text"><h1>${escapeHtml(userInput)}</h1></section>`
}

function toProjectId(value: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return normalized || `browser-skill-${stableHyperFramesHash(value).slice(0, 10)}`
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function assertNotCanceled(signal: AbortSignal | undefined): void {
  if (!signal?.aborted) return
  throw new BrowserSkillExecutorError('canceled', 'Browser skill execution was canceled.')
}

export type { HyperFramesBinaryAsset, HyperFramesSkillJobStage }
