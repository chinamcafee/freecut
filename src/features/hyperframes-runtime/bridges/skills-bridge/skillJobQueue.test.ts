import type {
  HyperFramesDiagnostic,
  HyperFramesProjectDirectory,
  HyperFramesProjectManifest,
} from '@/types/hyperframes'
import { createHyperFramesSkillJobQueue, type HyperFramesSkillOutputBundle } from './skillJobQueue'
import type { HyperFramesGenerationPlan } from './generationPlan'

function createPlan(status: 'confirmed' | 'draft' = 'confirmed'): HyperFramesGenerationPlan {
  const confirmed = status === 'confirmed'
  return {
    id: `plan-${status}`,
    title: 'Generate launch video',
    status,
    createdAt: 1_000,
    confirmedAt: confirmed ? 1_100 : undefined,
    confirmedBy: confirmed ? 'user' : undefined,
    skillId: 'product-launch-video',
    skillTitle: 'Product Launch Video',
    steps: [
      {
        id: 'collect-context',
        type: 'collect-context',
        title: 'Collect context',
        description: 'Collect request context.',
        toolPermissionIds: [],
        userVisible: true,
        writesToOutputDirectory: false,
        requiresPlanConfirmation: false,
        canExecute: confirmed,
        environment: 'browser-light',
      },
      {
        id: 'write-project-files',
        type: 'write-project-files',
        title: 'Write project files',
        description: 'Write temporary project files.',
        dependsOn: ['collect-context'],
        toolPermissionIds: ['filesystem.temp-write'],
        userVisible: true,
        writesToOutputDirectory: true,
        requiresPlanConfirmation: true,
        canExecute: confirmed,
        environment: 'local-service',
      },
    ],
    toolPermissions: [
      {
        id: 'filesystem.temp-write',
        label: 'Temporary project directory writes',
        required: true,
        reason: 'Write generated files into a temporary directory.',
        environment: 'local-service',
      },
    ],
    modelBudget: {
      currency: 'USD',
      estimatedMaxCost: 0.04,
      requiresPaidModel: true,
      requiresConfirmation: true,
      lineItems: [
        {
          capability: 'text.planning',
          requirementKind: 'text-planning',
          estimatedCost: 0.04,
          required: true,
        },
      ],
    },
    output: {
      directory: 'tmp/hyperframes/product-launch',
      format: 'hyperframes-project-directory',
      importStrategy: 'source-link-with-approximations',
      estimatedDurationFrames: 240,
      estimatedDurationSeconds: 8,
    },
    importStrategy: 'source-link-with-approximations',
    requiresNetwork: true,
    requiresPaidModel: true,
    requiresRenderRuntime: false,
    requiresUserConfirmation: true,
    canExecute: confirmed,
    warnings: [],
  }
}

function createManifest(): HyperFramesProjectManifest {
  return {
    schemaVersion: 1,
    id: 'generated-project',
    title: 'Generated project',
    entryFile: 'index.html',
    activeCompositionPath: 'compositions/main.html',
    canvas: {
      width: 1920,
      height: 1080,
      fps: 30,
      durationInFrames: 240,
    },
    assets: [],
    provenance: {
      source: 'skill-output',
      createdAt: 2_000,
      skillId: 'product-launch-video',
    },
  }
}

function createOutputBundle(): HyperFramesSkillOutputBundle {
  const manifest = createManifest()
  const projectDirectory: HyperFramesProjectDirectory = {
    manifest,
    files: [
      {
        path: 'index.html',
        content: '<!doctype html><html><body>ok</body></html>',
        encoding: 'utf8',
      },
      {
        path: 'compositions/main.html',
        content: '<section>launch</section>',
        encoding: 'utf8',
      },
    ],
    assets: [],
  }

  return {
    outputDirectory: 'tmp/hyperframes/product-launch',
    suggestedImportStrategy: 'source-link-with-approximations',
    projectDirectory,
    manifest,
    generatedFiles: projectDirectory.files,
    sourceAssets: [],
    logs: [],
    diagnostics: [],
    modelUsage: [
      {
        modelId: 'planner',
        capability: 'text.planning',
        estimatedCost: 0.04,
        currency: 'USD',
      },
    ],
  }
}

describe('HyperFrames skill job queue', () => {
  it('queues draft plans as waiting-confirmation before they can run', () => {
    let now = 10_000
    const queue = createHyperFramesSkillJobQueue({ now: () => now })
    const queued = queue.enqueueJob({
      id: 'job-draft',
      plan: createPlan('draft'),
      userInput: '做一个产品发布视频',
    })

    expect(queued.status).toBe('waiting-confirmation')
    expect(queued.waitingConfirmation?.reason).toBe('plan-confirmation')
    expect(queue.startNextJob()).toBeUndefined()

    now += 100
    const confirmed = queue.confirmWaitingJob('job-draft', {
      confirmedAt: now,
      confirmedBy: 'user',
    })
    expect(confirmed.status).toBe('pending')
    expect(confirmed.plan.status).toBe('confirmed')

    const running = queue.startNextJob({ at: now + 100 })
    expect(running?.status).toBe('running')
    expect(running?.attemptCount).toBe(1)
  })

  it('runs jobs, appends logs and completes with a normalized output bundle', () => {
    const queue = createHyperFramesSkillJobQueue({ now: () => 20_000 })
    queue.enqueueJob({
      id: 'job-complete',
      plan: createPlan(),
      userInput: '做一个 SaaS 官网宣传视频',
    })

    queue.startJob('job-complete', { stage: 'collect-context', at: 20_100 })
    queue.updateJobStage('job-complete', 'write-project-files', {
      at: 20_200,
      message: 'Temporary files written.',
    })
    const completed = queue.completeJob('job-complete', {
      at: 20_300,
      output: createOutputBundle(),
    })

    expect(completed.status).toBe('complete')
    expect(completed.currentStage).toBe('complete')
    expect(completed.output?.projectDirectory?.manifest.id).toBe('generated-project')
    expect(completed.output?.suggestedImportStrategy).toBe('source-link-with-approximations')
    expect(completed.logs.map((log) => log.message)).toEqual(
      expect.arrayContaining([
        'Temporary files written.',
        'Skill job completed and output bundle is ready for import preview.',
      ]),
    )
  })

  it('cancels pending and running jobs without cleaning the temporary directory', () => {
    const queue = createHyperFramesSkillJobQueue({ now: () => 30_000 })
    const queued = queue.enqueueJob({
      id: 'job-cancel',
      plan: createPlan(),
      userInput: '生成一个片头',
    })
    expect(queued.status).toBe('pending')

    const running = queue.startJob('job-cancel', { at: 30_100 })
    expect(running.status).toBe('running')

    const canceled = queue.cancelJob('job-cancel', {
      at: 30_200,
      reason: 'User pressed cancel.',
    })
    expect(canceled.status).toBe('canceled')
    expect(canceled.cancelRequested).toBe(true)
    expect(canceled.cleanupRequired).toBe(false)
    expect(canceled.outputDirectory).toBe('tmp/hyperframes/product-launch')
    expect(canceled.logs.at(-1)?.message).toBe('User pressed cancel.')
  })

  it('marks failures as retryable while retaining output directory, diagnostics and logs', () => {
    const diagnostic: HyperFramesDiagnostic = {
      id: 'diag-1',
      severity: 'blocking',
      message: 'Missing active composition.',
      source: 'lint',
      stage: 'import',
    }
    const queue = createHyperFramesSkillJobQueue({ now: () => 40_000, maxAttempts: 2 })
    queue.enqueueJob({
      id: 'job-fail',
      plan: createPlan(),
      userInput: '生成产品视频',
    })
    queue.startJob('job-fail', { at: 40_100 })
    queue.appendJobLog('job-fail', {
      at: 40_200,
      message: 'Generated index.html.',
      stage: 'write-project-files',
    })

    const failed = queue.failJob('job-fail', {
      at: 40_300,
      message: 'Lint failed.',
      stage: 'lint',
      diagnostics: [diagnostic],
    })
    expect(failed.status).toBe('failed')
    expect(failed.outputDirectory).toBe('tmp/hyperframes/product-launch')
    expect(failed.cleanupRequired).toBe(false)
    expect(failed.retainOutputDirectoryOnFailure).toBe(true)
    expect(failed.diagnostics).toContainEqual(diagnostic)
    expect(failed.logs.map((log) => log.message)).toEqual(
      expect.arrayContaining([
        'Generated index.html.',
        'Temporary output directory and logs were retained for retry or repair.',
      ]),
    )

    const retrying = queue.retryJob('job-fail', { at: 40_400 })
    expect(retrying.status).toBe('pending')
    expect(retrying.failures).toHaveLength(1)
    expect(retrying.logs.map((log) => log.message)).toContain(
      'Skill job queued for retry with retained temporary output directory and logs.',
    )

    const secondAttempt = queue.startJob('job-fail', { at: 40_500 })
    expect(secondAttempt.attemptCount).toBe(2)
  })

  it('moves retries over the attempt limit to waiting-confirmation', () => {
    const queue = createHyperFramesSkillJobQueue({ now: () => 50_000, maxAttempts: 1 })
    queue.enqueueJob({
      id: 'job-retry-limit',
      plan: createPlan(),
      userInput: '生成一个动态图形',
    })
    queue.startJob('job-retry-limit', { at: 50_100 })
    queue.failJob('job-retry-limit', {
      at: 50_200,
      message: 'Model output could not be parsed.',
      stage: 'call-model',
    })

    const waiting = queue.retryJob('job-retry-limit', { at: 50_300 })
    expect(waiting.status).toBe('waiting-confirmation')
    expect(waiting.waitingConfirmation?.reason).toBe('retry-limit')
    expect(waiting.outputDirectory).toBe('tmp/hyperframes/product-launch')

    const confirmed = queue.confirmWaitingJob('job-retry-limit', {
      confirmedAt: 50_400,
      confirmedBy: 'user',
    })
    expect(confirmed.status).toBe('pending')
    expect(confirmed.confirmedBy).toBe('user')
  })
})
