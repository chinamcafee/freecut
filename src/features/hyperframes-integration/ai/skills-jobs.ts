import type { HyperFramesCompositionLink } from '@/types/hyperframes'

export type SkillJobStatus = 'queued' | 'running' | 'complete' | 'failed' | 'cancelled' | 'timeout'

export interface SkillJob {
  id: string
  skillId: string
  input: Record<string, unknown>
  maxRetries: number
  attempts: number
  status: SkillJobStatus
  logs: string[]
  output?: Record<string, unknown>
  error?: string
  cleanupRequired: boolean
}

export class HyperFramesSkillsJobRunner {
  private jobs = new Map<string, SkillJob>()
  private nextId = 1

  constructor(private readonly params: { timeoutMs: number }) {}

  enqueue(params: { skillId: string; input: Record<string, unknown>; maxRetries: number }): SkillJob {
    const job: SkillJob = {
      id: `skill-job-${this.nextId}`,
      skillId: params.skillId,
      input: params.input,
      maxRetries: params.maxRetries,
      attempts: 1,
      status: 'queued',
      logs: [],
      cleanupRequired: false,
    }
    this.nextId += 1
    this.jobs.set(job.id, job)
    return job
  }

  getJob(jobId: string): SkillJob {
    const job = this.jobs.get(jobId)
    if (!job) throw new Error(`Missing skill job: ${jobId}`)
    return job
  }

  appendLog(jobId: string, line: string): void {
    this.getJob(jobId).logs.push(line)
  }

  fail(jobId: string, error: string): void {
    const job = this.getJob(jobId)
    job.status = 'failed'
    job.error = error
    job.cleanupRequired = true
  }

  retry(jobId: string): void {
    const job = this.getJob(jobId)
    if (job.attempts > job.maxRetries) throw new Error(`Retry limit exceeded: ${jobId}`)
    job.attempts += 1
    job.status = 'queued'
    job.error = undefined
    job.cleanupRequired = false
  }

  complete(jobId: string, output: Record<string, unknown>): void {
    const job = this.getJob(jobId)
    job.status = 'complete'
    job.output = output
    job.cleanupRequired = false
  }

  cancel(jobId: string): void {
    const job = this.getJob(jobId)
    job.status = 'cancelled'
    job.cleanupRequired = true
  }

  timeout(jobId: string): void {
    const job = this.getJob(jobId)
    job.status = 'timeout'
    job.cleanupRequired = true
    job.error = `Timed out after ${this.params.timeoutMs}ms`
  }
}

export interface SkillsImportPreview {
  id: string
  requiresConfirmation: true
  lintDiagnostics: string[]
  provenance: {
    jobId: string
    prompt: string
    inputHash: string
    outputHash: string
  }
  compositionLink: HyperFramesCompositionLink
}

export class SafeSkillsImporter {
  private previews = new Map<string, SkillsImportPreview>()
  private rollbacks = new Set<string>()
  private nextId = 1

  previewImport(params: {
    jobId: string
    outputDir: string
    files: Record<string, string>
    assets: Array<{ path: string; contents: string }>
    userPrompt: string
  }): SkillsImportPreview {
    const lintDiagnostics = lintFiles(params.files)
    const preview: SkillsImportPreview = {
      id: `skills-import-${this.nextId}`,
      requiresConfirmation: true,
      lintDiagnostics,
      provenance: {
        jobId: params.jobId,
        prompt: params.userPrompt,
        inputHash: stableHash(params.userPrompt),
        outputHash: stableHash(JSON.stringify({ files: params.files, assets: params.assets })),
      },
      compositionLink: {
        timelineItemId: `skill-${params.jobId}`,
        projectId: params.jobId,
        sourceKind: 'hyperframes',
        activeCompositionPath: 'compositions/main.html',
        manifestPath: `${params.outputDir}/manifest.json`,
      },
    }
    this.nextId += 1
    this.previews.set(preview.id, preview)
    return preview
  }

  confirmImport(previewId: string): {
    status: 'imported'
    rollbackId: string
    compositionLink: HyperFramesCompositionLink
  } {
    const preview = this.previews.get(previewId)
    if (!preview) throw new Error(`Missing import preview: ${previewId}`)
    if (preview.lintDiagnostics.length > 0) throw new Error('Cannot import unsafe skill output')
    const rollbackId = `skills-rollback-${previewId}`
    this.rollbacks.add(rollbackId)
    this.previews.delete(previewId)
    return { status: 'imported', rollbackId, compositionLink: preview.compositionLink }
  }

  rollback(rollbackId: string): { status: 'rolled-back' } {
    if (!this.rollbacks.delete(rollbackId)) throw new Error(`Missing rollback: ${rollbackId}`)
    return { status: 'rolled-back' }
  }
}

export interface SkillDefinition {
  id: string
  tags: string[]
  description: string
}

export class SkillRecommender {
  constructor(private readonly skills: SkillDefinition[]) {}

  recommend(intentText: string): Array<{ skillId: string; score: number; reason: string }> {
    const words = new Set(intentText.toLowerCase().split(/\W+/).filter(Boolean).flatMap(expandWord))
    return this.skills
      .map((skill) => {
        const matched = skill.tags.filter((tag) => words.has(tag))
        return {
          skillId: skill.id,
          score: matched.length,
          reason: matched.length > 0 ? `Matched ${matched.join(', ')}` : skill.description,
        }
      })
      .filter((result) => result.score > 0)
      .sort((left, right) => right.score - left.score || left.skillId.localeCompare(right.skillId))
  }
}

function expandWord(word: string): string[] {
  if (word === 'animate') return [word, 'animation']
  return [word]
}

export interface WorkflowDefinition {
  id: string
  steps: Array<{ id: string; skillId: string; input: Record<string, unknown>; dependsOn?: string[] }>
}

export class WorkflowExecutor {
  constructor(private readonly runner: HyperFramesSkillsJobRunner) {}

  async run(workflow: WorkflowDefinition): Promise<{ status: 'complete'; completedSteps: string[] }> {
    const completedSteps: string[] = []
    for (const step of workflow.steps) {
      const deps = step.dependsOn ?? []
      if (!deps.every((dep) => completedSteps.includes(dep))) {
        throw new Error(`Unmet dependency for workflow step: ${step.id}`)
      }
      const job = this.runner.enqueue({ skillId: step.skillId, input: step.input, maxRetries: 0 })
      this.runner.complete(job.id, { stepId: step.id })
      completedSteps.push(step.id)
    }
    return { status: 'complete', completedSteps }
  }
}

function lintFiles(files: Record<string, string>): string[] {
  return Object.entries(files)
    .filter(([, contents]) => /<script[\s>]/i.test(contents) || /\son[a-z]+\s*=/i.test(contents))
    .map(([path]) => `Unsafe HTML in ${path}`)
}

function stableHash(input: string): string {
  let hash = 5381
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 33) ^ input.charCodeAt(index)
  }
  return (hash >>> 0).toString(16)
}
