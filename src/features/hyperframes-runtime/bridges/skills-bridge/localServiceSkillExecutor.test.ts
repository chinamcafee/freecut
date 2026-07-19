import type { HyperFramesProjectDirectory, HyperFramesProjectManifest } from '@/types/hyperframes'
import type { HyperFramesGenerationPlan } from './generationPlan'
import { createHyperFramesSkillJobQueue, type HyperFramesSkillOutputBundle } from './skillJobQueue'
import {
  createLocalServiceScriptPermissions,
  createLocalServiceSkillExecutor,
  inferLocalServiceCapabilities,
  type LocalServiceSkillRuntime,
} from './localServiceSkillExecutor'

function createLocalServicePlan(): HyperFramesGenerationPlan {
  return {
    id: 'local-plan',
    title: 'Local Service Plan',
    status: 'confirmed',
    createdAt: 1_000,
    confirmedAt: 1_100,
    confirmedBy: 'user',
    skillId: 'embedded-captions',
    skillTitle: 'Embedded Captions',
    steps: [
      {
        id: 'collect-context',
        type: 'collect-context',
        title: 'Collect context',
        description: 'Collect selected video.',
        toolPermissionIds: [],
        userVisible: true,
        writesToOutputDirectory: false,
        requiresPlanConfirmation: false,
        canExecute: true,
        environment: 'browser-light',
      },
      {
        id: 'analyze-media',
        type: 'analyze-media',
        title: 'Analyze media',
        description: 'Transcribe selected media.',
        modelCapability: 'audio.transcription',
        toolPermissionIds: ['tool.ffmpeg'],
        userVisible: true,
        writesToOutputDirectory: false,
        requiresPlanConfirmation: false,
        canExecute: true,
        environment: 'local-service',
      },
      {
        id: 'run-skill',
        type: 'run-skill',
        title: 'Run caption skill',
        description: 'Run local caption workflow.',
        dependsOn: ['analyze-media'],
        toolPermissionIds: ['filesystem.temp-write', 'tool.browser', 'tool.ffmpeg'],
        userVisible: true,
        writesToOutputDirectory: false,
        requiresPlanConfirmation: false,
        canExecute: true,
        environment: 'local-service',
      },
      {
        id: 'write-project-files',
        type: 'write-project-files',
        title: 'Write project files',
        description: 'Write generated files.',
        dependsOn: ['run-skill'],
        toolPermissionIds: ['filesystem.temp-write'],
        userVisible: true,
        writesToOutputDirectory: true,
        requiresPlanConfirmation: true,
        canExecute: true,
        environment: 'local-service',
      },
    ],
    toolPermissions: [
      {
        id: 'filesystem.temp-write',
        label: 'Filesystem',
        required: true,
        reason: 'Write generated files.',
        environment: 'local-service',
      },
      {
        id: 'tool.browser',
        label: 'Chrome',
        required: true,
        reason: 'Capture screenshots.',
        environment: 'local-service',
      },
      {
        id: 'tool.ffmpeg',
        label: 'FFmpeg',
        required: true,
        reason: 'Analyze and render media.',
        environment: 'local-service',
      },
    ],
    modelBudget: {
      currency: 'USD',
      requiresPaidModel: false,
      requiresConfirmation: false,
      lineItems: [
        {
          capability: 'audio.transcription',
          requirementKind: 'transcription',
          required: true,
        },
      ],
    },
    output: {
      directory: 'tmp/hyperframes/local-captions',
      format: 'media-file',
      importStrategy: 'rendered-media',
      estimatedDurationFrames: 300,
      estimatedDurationSeconds: 10,
    },
    importStrategy: 'rendered-media',
    requiresNetwork: false,
    requiresPaidModel: false,
    requiresRenderRuntime: true,
    requiresUserConfirmation: true,
    canExecute: true,
    warnings: [],
  }
}

function createOutputBundle(): HyperFramesSkillOutputBundle {
  const manifest: HyperFramesProjectManifest = {
    schemaVersion: 1,
    id: 'local-captions',
    title: 'Local captions',
    entryFile: 'index.html',
    activeCompositionPath: 'compositions/main.html',
    canvas: {
      width: 1920,
      height: 1080,
      fps: 30,
      durationInFrames: 300,
    },
    assets: [],
    provenance: {
      source: 'skill-output',
      createdAt: 2_000,
      skillId: 'embedded-captions',
    },
  }
  const projectDirectory: HyperFramesProjectDirectory = {
    manifest,
    files: [
      {
        path: 'index.html',
        content: '<!doctype html><html></html>',
        encoding: 'utf8',
      },
      {
        path: 'compositions/main.html',
        content: '<section>captions</section>',
        encoding: 'utf8',
      },
    ],
    assets: [],
  }
  return {
    outputDirectory: 'tmp/hyperframes/local-captions',
    suggestedImportStrategy: 'rendered-media',
    projectDirectory,
    manifest,
    generatedFiles: projectDirectory.files,
    sourceAssets: [],
    logs: [],
    diagnostics: [],
    modelUsage: [],
  }
}

function createRunningJob() {
  const queue = createHyperFramesSkillJobQueue()
  queue.enqueueJob({
    id: 'job-local',
    plan: createLocalServicePlan(),
    userInput: '给当前视频加字幕',
  })
  return queue.startJob('job-local')
}

describe('LocalServiceSkillExecutor', () => {
  it('declares filesystem, Chrome, FFmpeg, transcription and screenshot permissions', () => {
    const plan = createLocalServicePlan()
    const capabilities = inferLocalServiceCapabilities(plan)
    expect(capabilities).toEqual(
      expect.arrayContaining([
        'chrome',
        'ffmpeg',
        'filesystem',
        'render-runtime',
        'screenshot',
        'transcription',
      ]),
    )

    const permissions = createLocalServiceScriptPermissions(plan, {
      capabilities,
      inputDirectories: ['media/video.mp4'],
      maxRuntimeMs: 5_000,
    })
    expect(permissions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          capability: 'ffmpeg',
          inputDirectories: ['media/video.mp4'],
          outputDirectory: 'tmp/hyperframes/local-captions',
          maxRuntimeMs: 5_000,
          cancellable: true,
        }),
        expect.objectContaining({
          capability: 'screenshot',
          cancellable: true,
        }),
      ]),
    )
  })

  it('runs through the injected local runtime with permission declarations', async () => {
    const runtime: LocalServiceSkillRuntime = {
      checkRuntime: vi.fn<LocalServiceSkillRuntime['checkRuntime']>(async (request) => ({
        ok: true,
        availableCapabilities: request.capabilities,
        missingCapabilities: [],
        diagnostics: [],
      })),
      runSkill: vi.fn<LocalServiceSkillRuntime['runSkill']>(async (request) => {
        expect(request.permissions.every((permission) => permission.cancellable)).toBe(true)
        expect(request.permissions.every((permission) => permission.maxRuntimeMs === 8_000)).toBe(
          true,
        )
        expect(request.outputDirectory).toBe('tmp/hyperframes/local-captions')
        return createOutputBundle()
      }),
    }
    const executor = createLocalServiceSkillExecutor({
      runtime,
      defaultMaxRuntimeMs: 8_000,
      inputDirectories: ['media/video.mp4'],
    })

    const output = await executor.executeJob(createRunningJob(), { now: 3_000 })

    expect(runtime.checkRuntime).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: 'job-local',
        capabilities: expect.arrayContaining(['chrome', 'ffmpeg', 'filesystem']),
      }),
    )
    expect(runtime.runSkill).toHaveBeenCalled()
    expect(output.outputDirectory).toBe('tmp/hyperframes/local-captions')
    expect(output.logs.map((log) => log.message)).toEqual(
      expect.arrayContaining([
        'Local service skill executor started.',
        'Local service runtime preflight passed.',
        'Local service skill output received.',
      ]),
    )
  })

  it('fails runtime preflight when required local capabilities are missing', async () => {
    const runtime: LocalServiceSkillRuntime = {
      checkRuntime: vi.fn<LocalServiceSkillRuntime['checkRuntime']>(async () => ({
        ok: false,
        availableCapabilities: ['filesystem'],
        missingCapabilities: ['ffmpeg'],
        diagnostics: [
          {
            id: 'missing-ffmpeg',
            severity: 'blocking',
            message: 'FFmpeg is not available.',
            source: 'render',
            stage: 'import',
          },
        ],
      })),
      runSkill: vi.fn<LocalServiceSkillRuntime['runSkill']>(async () => createOutputBundle()),
    }
    const executor = createLocalServiceSkillExecutor({ runtime })

    await expect(executor.executeJob(createRunningJob())).rejects.toMatchObject({
      code: 'runtime-unavailable',
      diagnostics: expect.arrayContaining([
        expect.objectContaining({
          id: 'missing-ffmpeg',
        }),
      ]),
    })
    expect(runtime.runSkill).not.toHaveBeenCalled()
  })

  it('enforces max runtime and asks the local runtime to cancel', async () => {
    vi.useFakeTimers()
    const runtime: LocalServiceSkillRuntime = {
      checkRuntime: vi.fn<LocalServiceSkillRuntime['checkRuntime']>(async (request) => ({
        ok: true,
        availableCapabilities: request.capabilities,
        missingCapabilities: [],
        diagnostics: [],
      })),
      runSkill: vi.fn<LocalServiceSkillRuntime['runSkill']>(
        () =>
          new Promise<HyperFramesSkillOutputBundle>(() => {
            // Intentionally left pending so the executor timeout path owns cancellation.
          }),
      ),
      cancelJob: vi.fn<NonNullable<LocalServiceSkillRuntime['cancelJob']>>(),
    }
    const executor = createLocalServiceSkillExecutor({ runtime })
    const execution = executor.executeJob(createRunningJob(), { maxRuntimeMs: 50 })
    const rejection = expect(execution).rejects.toMatchObject({ code: 'timeout' })

    await vi.advanceTimersByTimeAsync(51)

    await rejection
    expect(runtime.cancelJob).toHaveBeenCalledWith('job-local', 'timeout')
    vi.useRealTimers()
  })

  it('propagates user cancellation to the local runtime', async () => {
    const controller = new AbortController()
    const runtime: LocalServiceSkillRuntime = {
      checkRuntime: vi.fn<LocalServiceSkillRuntime['checkRuntime']>(async (request) => ({
        ok: true,
        availableCapabilities: request.capabilities,
        missingCapabilities: [],
        diagnostics: [],
      })),
      runSkill: vi.fn<LocalServiceSkillRuntime['runSkill']>(
        () =>
          new Promise<HyperFramesSkillOutputBundle>(() => {
            // Intentionally left pending so the external abort path owns cancellation.
          }),
      ),
      cancelJob: vi.fn<NonNullable<LocalServiceSkillRuntime['cancelJob']>>(),
    }
    const executor = createLocalServiceSkillExecutor({ runtime })
    const execution = executor.executeJob(createRunningJob(), { signal: controller.signal })
    const rejection = expect(execution).rejects.toMatchObject({ code: 'canceled' })

    controller.abort()

    await rejection
    expect(runtime.cancelJob).toHaveBeenCalledWith('job-local', 'canceled')
  })
})
