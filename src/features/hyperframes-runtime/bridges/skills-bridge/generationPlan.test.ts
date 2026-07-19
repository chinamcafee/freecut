import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { DEFAULT_MATERIAL_SCOPE } from '@/types/hyperframes'
import type { ModelRoutingPlan } from '../../model-center'
import {
  parseHyperFramesSkillsCatalog,
  type HyperFramesSkillFileEntry,
} from './skillDirectoryParser'
import {
  canExecuteHyperFramesGenerationPlan,
  confirmHyperFramesGenerationPlan,
  createHyperFramesGenerationPlan,
} from './generationPlan'
import { recommendHyperFramesSkills } from './skillRecommender'

const repoRoot = process.cwd()
const skillsRoot = join(repoRoot, 'src/features/hyperframes-runtime/upstream/skills')
const textExtensions = new Set([
  '.cjs',
  '.css',
  '.html',
  '.js',
  '.json',
  '.md',
  '.mjs',
  '.py',
  '.ts',
  '.tsx',
  '.txt',
  '.yaml',
  '.yml',
])

function collectCatalogFiles(): HyperFramesSkillFileEntry[] {
  const files: HyperFramesSkillFileEntry[] = []
  collectFiles(skillsRoot, skillsRoot, files)
  return files
}

function collectFiles(dir: string, base: string, files: HyperFramesSkillFileEntry[]): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      collectFiles(path, base, files)
      continue
    }
    if (!entry.isFile()) {
      continue
    }

    const relativePath = relative(base, path).replaceAll('\\', '/')
    files.push({
      path: relativePath,
      content: shouldReadAsText(path) ? readFileSync(path, 'utf8') : undefined,
    })
  }
}

function shouldReadAsText(path: string): boolean {
  const lowerPath = path.toLowerCase()
  for (const extension of textExtensions) {
    if (lowerPath.endsWith(extension)) {
      return true
    }
  }
  return false
}

const skillCatalog = parseHyperFramesSkillsCatalog({
  rootPath: 'src/features/hyperframes-runtime/upstream/skills',
  files: collectCatalogFiles(),
})

const routingPlan: ModelRoutingPlan = {
  routes: [
    {
      requirement: { capability: 'text.planning' },
      binding: {
        id: 'text',
        capability: 'text.planning',
        profileId: 'cloud',
        modelId: 'planner',
        quality: 'standard',
        enabled: true,
        maxCostPerTask: 0.03,
      },
      profile: {
        id: 'cloud',
        name: 'Cloud',
        providerType: 'cloud',
        defaultModel: 'planner',
        privacyMode: 'cloud',
        enabled: true,
        models: [
          {
            id: 'planner',
            displayName: 'Planner',
            inputModalities: ['text'],
            outputModalities: ['text', 'json'],
            capabilities: ['text.planning'],
            latencyClass: 'fast',
            privacyClass: 'external',
          },
        ],
      },
      model: {
        id: 'planner',
        displayName: 'Planner',
        inputModalities: ['text'],
        outputModalities: ['text', 'json'],
        capabilities: ['text.planning'],
        latencyClass: 'fast',
        privacyClass: 'external',
      },
      toolPolicy: {
        id: 'default',
        name: 'Default',
        permissions: {},
        materialScope: DEFAULT_MATERIAL_SCOPE,
        writeMode: 'proposal-requires-confirmation',
        networkMode: 'confirm-before-access',
        enabled: true,
      },
      usedFallback: false,
    },
  ],
  missing: [],
  estimatedMaxCost: 0.03,
  requiresNetwork: true,
  requiresConfirmation: true,
  canProceed: true,
}

describe('HyperFrames generation plan', () => {
  it('creates a draft plan with steps, permissions, budget and temporary output directory', () => {
    const context = {
      userText: '请把 https://example.com 做成一个 SaaS 产品发布宣传视频',
      intentKind: 'new-video' as const,
      materials: [{ id: 'url-1', type: 'url' as const, uri: 'https://example.com' }],
      modelCapabilities: ['text-planning', 'vision', 'tts'],
    }
    const recommendation = recommendHyperFramesSkills(skillCatalog, context)[0]
    expect(recommendation?.skill.id).toBe('product-launch-video')

    const plan = createHyperFramesGenerationPlan({
      recommendation: recommendation!,
      context,
      id: 'plan-product',
      now: 1_000,
      outputRoot: 'tmp/hyperframes',
      projectSlug: 'example-product',
      modelRoutingPlan: routingPlan,
    })

    expect(plan.status).toBe('draft')
    expect(plan.canExecute).toBe(false)
    expect(plan.requiresUserConfirmation).toBe(true)
    expect(plan.output.directory).toBe('tmp/hyperframes/example-product')
    expect(plan.importStrategy).toBe('source-link-with-approximations')
    expect(plan.requiresNetwork).toBe(true)
    expect(plan.modelBudget.estimatedMaxCost).toBeGreaterThan(0)
    expect(plan.toolPermissions.map((permission) => permission.id)).toEqual(
      expect.arrayContaining(['network.access', 'filesystem.temp-write', 'tool.hyperframes-cli']),
    )
    expect(plan.steps.map((step) => step.type)).toEqual(
      expect.arrayContaining([
        'collect-context',
        'analyze-media',
        'call-model',
        'run-skill',
        'write-project-files',
        'lint',
        'preview',
        'prepare-import',
      ]),
    )

    const writeStep = plan.steps.find((step) => step.type === 'write-project-files')
    expect(writeStep?.requiresPlanConfirmation).toBe(true)
    expect(writeStep?.canExecute).toBe(false)
  })

  it('requires explicit confirmation before write steps can execute', () => {
    const context = {
      userText: '做一个 8 秒动态图形标题动画',
      intentKind: 'overlay' as const,
      timeline: { playheadFrame: 120, selectedItemTypes: ['text' as const] },
      modelCapabilities: ['text-planning'],
    }
    const recommendation = recommendHyperFramesSkills(skillCatalog, context)[0]
    const plan = createHyperFramesGenerationPlan({
      recommendation: recommendation!,
      context,
      id: 'plan-motion',
      now: 2_000,
    })

    expect(canExecuteHyperFramesGenerationPlan(plan)).toBe(false)
    const confirmed = confirmHyperFramesGenerationPlan(plan, {
      confirmedAt: 2_500,
      confirmedBy: 'user',
    })

    expect(confirmed.status).toBe('confirmed')
    expect(confirmed.confirmedAt).toBe(2_500)
    expect(confirmed.confirmedBy).toBe('user')
    expect(canExecuteHyperFramesGenerationPlan(confirmed)).toBe(true)
    expect(confirmed.steps.find((step) => step.type === 'write-project-files')?.canExecute).toBe(
      true,
    )
  })

  it('plans render-runtime and media import for caption packages', () => {
    const context = {
      userText: '给当前说话人视频加中文字幕',
      intentKind: 'caption-package' as const,
      materials: [
        { id: 'clip-1', type: 'video' as const, label: 'talking-head.mp4', durationFrames: 900 },
      ],
      timeline: { selectedItemTypes: ['video' as const] },
      modelCapabilities: ['transcription', 'tts'],
    }
    const recommendation = recommendHyperFramesSkills(skillCatalog, context)[0]
    expect(recommendation?.skill.id).toBe('embedded-captions')

    const plan = createHyperFramesGenerationPlan({
      recommendation: recommendation!,
      context,
      id: 'plan-captions',
      now: 3_000,
    })

    expect(plan.importStrategy).toBe('rendered-media')
    expect(plan.requiresRenderRuntime).toBe(true)
    expect(plan.output.format).toBe('media-file')
    expect(plan.output.estimatedDurationFrames).toBe(900)
    expect(plan.output.estimatedDurationSeconds).toBe(30)
    expect(plan.steps.map((step) => step.type)).toContain('render')
    expect(plan.toolPermissions.map((permission) => permission.id)).toEqual(
      expect.arrayContaining(['tool.ffmpeg', 'tool.render-runtime', 'material.video.read']),
    )
  })
})
