import type { HyperFramesGenerationPlan } from './generationPlan'
import { createHyperFramesSkillJobQueue } from './skillJobQueue'
import {
  BrowserSkillExecutorError,
  checkBrowserSkillPlan,
  createBrowserSkillExecutor,
  type BrowserSkillModelInvoker,
} from './browserSkillExecutor'

function createBrowserPlan(
  overrides: Partial<HyperFramesGenerationPlan> = {},
): HyperFramesGenerationPlan {
  const plan: HyperFramesGenerationPlan = {
    id: 'browser-plan',
    title: 'Browser Skill Plan',
    status: 'confirmed',
    createdAt: 1_000,
    confirmedAt: 1_100,
    confirmedBy: 'user',
    skillId: 'motion-graphics',
    skillTitle: 'Motion Graphics',
    steps: [
      {
        id: 'collect-context',
        type: 'collect-context',
        title: 'Collect context',
        description: 'Collect user request.',
        toolPermissionIds: [],
        userVisible: true,
        writesToOutputDirectory: false,
        requiresPlanConfirmation: false,
        canExecute: true,
        environment: 'browser-light',
      },
      {
        id: 'call-model',
        type: 'call-model',
        title: 'Generate HTML',
        description: 'Generate lightweight HTML.',
        dependsOn: ['collect-context'],
        modelCapability: 'text.planning',
        toolPermissionIds: ['network.access'],
        userVisible: true,
        writesToOutputDirectory: false,
        requiresPlanConfirmation: false,
        canExecute: true,
        environment: 'remote-service',
      },
      {
        id: 'write-project-files',
        type: 'write-project-files',
        title: 'Write memory files',
        description: 'Write generated files to memory.',
        dependsOn: ['call-model'],
        toolPermissionIds: ['filesystem.temp-write'],
        userVisible: true,
        writesToOutputDirectory: true,
        requiresPlanConfirmation: true,
        canExecute: true,
        environment: 'browser-light',
      },
      {
        id: 'lint',
        type: 'lint',
        title: 'Browser lint',
        description: 'Lint memory project directory.',
        dependsOn: ['write-project-files'],
        toolPermissionIds: ['tool.browser'],
        userVisible: true,
        writesToOutputDirectory: false,
        requiresPlanConfirmation: false,
        canExecute: true,
        environment: 'browser-light',
      },
    ],
    toolPermissions: [
      {
        id: 'network.access',
        label: 'Network access',
        required: true,
        reason: 'Call configured browser-light model route.',
        environment: 'remote-service',
      },
      {
        id: 'filesystem.temp-write',
        label: 'In-memory project directory writes',
        required: true,
        reason: 'Write generated files to an in-memory output bundle.',
        environment: 'browser-light',
      },
      {
        id: 'tool.browser',
        label: 'Browser lint',
        required: true,
        reason: 'Validate generated HTML in the browser runtime.',
        environment: 'browser-light',
      },
    ],
    modelBudget: {
      currency: 'USD',
      estimatedMaxCost: 0.02,
      requiresPaidModel: true,
      requiresConfirmation: true,
      lineItems: [
        {
          capability: 'text.planning',
          requirementKind: 'text-planning',
          estimatedCost: 0.02,
          required: true,
        },
      ],
    },
    output: {
      directory: 'memory/hyperframes/browser-plan',
      format: 'hyperframes-project-directory',
      importStrategy: 'source-link',
      estimatedDurationFrames: 120,
      estimatedDurationSeconds: 4,
    },
    importStrategy: 'source-link',
    requiresNetwork: true,
    requiresPaidModel: true,
    requiresRenderRuntime: false,
    requiresUserConfirmation: true,
    canExecute: true,
    warnings: [],
  }

  return { ...plan, ...overrides }
}

describe('BrowserSkillExecutor', () => {
  it('executes model-backed browser-light jobs into a normalized SkillOutputBundle', async () => {
    const invoker = vi.fn<BrowserSkillModelInvoker>(async (request) => ({
      title: 'Generated Motion',
      compositionHtml: `<section data-hf-item="text"><h1>${request.userInput}</h1></section>`,
      modelUsage: [
        {
          modelId: 'planner',
          capability: 'text.planning',
          inputTokens: 120,
          outputTokens: 80,
          estimatedCost: 0.02,
          currency: 'USD',
          taskId: request.jobId,
        },
      ],
    }))
    const queue = createHyperFramesSkillJobQueue({ now: () => 10_000 })
    queue.enqueueJob({
      id: 'job-browser',
      plan: createBrowserPlan(),
      userInput: '做一个 4 秒标题动画',
    })
    const running = queue.startJob('job-browser', { at: 10_100 })
    const executor = createBrowserSkillExecutor({
      modelInvoker: invoker,
      now: () => 10_200,
    })

    const output = await executor.executeJob(running, { now: 10_200 })
    const completed = queue.completeJob('job-browser', { output, at: 10_300 })

    expect(invoker).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: 'job-browser',
        skillId: 'motion-graphics',
        outputDirectory: 'memory/hyperframes/browser-plan',
      }),
    )
    expect(output.outputDirectory).toBe('memory/hyperframes/browser-plan')
    expect(output.projectDirectory?.manifest).toMatchObject({
      id: 'browser-plan',
      title: 'Generated Motion',
      activeCompositionPath: 'compositions/main.html',
      provenance: {
        source: 'skill-output',
        skillId: 'motion-graphics',
        confirmedByUser: true,
      },
    })
    expect(output.generatedFiles.map((file) => file.path)).toEqual(
      expect.arrayContaining([
        'index.html',
        'compositions/main.html',
        'metadata/provenance.json',
        'metadata/diagnostics.json',
      ]),
    )
    expect(output.sourceAssets).toEqual([])
    expect(output.modelUsage[0]?.taskId).toBe('job-browser')
    expect(completed.output?.suggestedImportStrategy).toBe('source-link')
  })

  it('rejects plans that require local runtime tooling', async () => {
    const plan = createBrowserPlan({
      requiresRenderRuntime: true,
      toolPermissions: [
        {
          id: 'tool.ffmpeg',
          label: 'FFmpeg',
          required: true,
          reason: 'Needs media processing.',
          environment: 'local-service',
        },
      ],
    })
    const check = checkBrowserSkillPlan(plan)
    expect(check.ok).toBe(false)
    expect(check.unsupportedToolPermissionIds).toContain('tool.ffmpeg')

    const queue = createHyperFramesSkillJobQueue()
    queue.enqueueJob({
      id: 'job-local',
      plan,
      userInput: '渲染字幕视频',
    })
    const running = queue.startJob('job-local')
    const executor = createBrowserSkillExecutor({
      modelInvoker: async () => ({ compositionHtml: '<section></section>' }),
    })

    await expect(executor.executeJob(running)).rejects.toMatchObject({
      code: 'unsupported-plan',
      reasons: expect.arrayContaining([
        'Plan requires render runtime, which is not available in browser-light mode.',
        'Tool permission "tool.ffmpeg" is not supported by browser-light mode.',
      ]),
    })
  })

  it('normalizes unsafe model file paths into blocking diagnostics', async () => {
    const queue = createHyperFramesSkillJobQueue()
    queue.enqueueJob({
      id: 'job-unsafe-file',
      plan: createBrowserPlan(),
      userInput: '生成轻量 HTML',
    })
    const running = queue.startJob('job-unsafe-file')
    const executor = createBrowserSkillExecutor({
      modelInvoker: async () => ({
        files: [
          {
            path: '../escape.html',
            content: '<main>escape</main>',
          },
        ],
      }),
    })

    const output = await executor.executeJob(running)

    expect(output.generatedFiles.map((file) => file.path)).not.toContain('../escape.html')
    expect(output.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'hyperframes.browser_executor.unsafe_path',
          severity: 'blocking',
        }),
      ]),
    )
  })

  it('fails model-backed plans when no model invoker is configured', async () => {
    const queue = createHyperFramesSkillJobQueue()
    queue.enqueueJob({
      id: 'job-no-model',
      plan: createBrowserPlan(),
      userInput: '生成标题动画',
    })
    const running = queue.startJob('job-no-model')
    const executor = createBrowserSkillExecutor()

    await expect(executor.executeJob(running)).rejects.toBeInstanceOf(BrowserSkillExecutorError)
    await expect(executor.executeJob(running)).rejects.toMatchObject({
      code: 'missing-model-invoker',
    })
  })
})
