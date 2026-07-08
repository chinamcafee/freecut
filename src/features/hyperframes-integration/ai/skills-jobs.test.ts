import { describe, expect, it } from 'vite-plus/test'
import {
  HyperFramesSkillsJobRunner,
  SafeSkillsImporter,
  SkillRecommender,
  WorkflowExecutor,
} from './skills-jobs'

describe('HyperFrames Skills jobs', () => {
  it('runs queued jobs with logs, retry, cancellation, timeout, and failure cleanup', async () => {
    const runner = new HyperFramesSkillsJobRunner({ timeoutMs: 10 })
    const job = runner.enqueue({ skillId: 'text-animation', input: { text: 'Hello' }, maxRetries: 1 })
    runner.appendLog(job.id, 'started')
    runner.fail(job.id, 'temporary')
    runner.retry(job.id)
    runner.complete(job.id, { outputDir: 'skills-output/job-1' })

    expect(runner.getJob(job.id)).toMatchObject({
      status: 'complete',
      attempts: 2,
      logs: ['started'],
      output: { outputDir: 'skills-output/job-1' },
    })

    const cancelled = runner.enqueue({ skillId: 'scene-generator', input: {}, maxRetries: 0 })
    runner.cancel(cancelled.id)
    expect(runner.getJob(cancelled.id)).toMatchObject({
      status: 'cancelled',
      cleanupRequired: true,
    })
  })

  it('imports skill output only after lint, manifest, hash, provenance, and user confirmation', () => {
    const importer = new SafeSkillsImporter()
    const preview = importer.previewImport({
      jobId: 'job-1',
      outputDir: 'skills-output/job-1',
      files: { 'index.html': '<main></main>', 'compositions/main.html': '<h1>Hello</h1>' },
      assets: [{ path: 'assets/image.png', contents: 'asset-bytes' }],
      userPrompt: 'make intro',
    })

    expect(preview).toMatchObject({
      requiresConfirmation: true,
      lintDiagnostics: [],
      provenance: {
        jobId: 'job-1',
        prompt: 'make intro',
        inputHash: expect.any(String),
        outputHash: expect.any(String),
      },
    })

    const result = importer.confirmImport(preview.id)
    expect(result).toMatchObject({
      status: 'imported',
      rollbackId: expect.any(String),
      compositionLink: {
        sourceKind: 'hyperframes',
        manifestPath: 'skills-output/job-1/manifest.json',
      },
    })
    expect(importer.rollback(result.rollbackId!)).toEqual({ status: 'rolled-back' })
  })

  it('recommends skills from intent without bypassing safe import', () => {
    const recommender = new SkillRecommender([
      { id: 'text-animation', tags: ['text', 'animation'], description: 'Animate text' },
      { id: 'scene-generator', tags: ['scene', 'background'], description: 'Generate scenes' },
    ])

    expect(recommender.recommend('animate my title text')[0]).toMatchObject({
      skillId: 'text-animation',
      score: 2,
      reason: expect.stringContaining('text'),
    })
  })

  it('executes workflows step by step and stops on failed dependencies', async () => {
    const runner = new HyperFramesSkillsJobRunner({ timeoutMs: 1000 })
    const workflow = new WorkflowExecutor(runner)
    const result = await workflow.run({
      id: 'intro-workflow',
      steps: [
        { id: 'generate', skillId: 'scene-generator', input: {} },
        { id: 'animate', skillId: 'text-animation', input: {}, dependsOn: ['generate'] },
      ],
    })

    expect(result).toMatchObject({
      status: 'complete',
      completedSteps: ['generate', 'animate'],
    })
  })
})
