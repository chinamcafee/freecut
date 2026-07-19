import type { ModelCapability } from '@/types/hyperframes'
import type { ModelRoutingPlan } from '../../model-center'
import type {
  HyperFramesSkillDefinition,
  HyperFramesSkillInputKind,
  HyperFramesSkillModelRequirementKind,
  HyperFramesSkillToolRequirementKind,
} from './skillDirectoryParser'
import type {
  HyperFramesSkillRecommendation,
  HyperFramesSkillRecommendationContext,
} from './skillRecommender'

export type HyperFramesGenerationPlanStatus = 'draft' | 'confirmed'

export type HyperFramesGenerationPlanStepType =
  | 'analyze-media'
  | 'call-model'
  | 'collect-context'
  | 'lint'
  | 'prepare-import'
  | 'preview'
  | 'render'
  | 'run-skill'
  | 'write-project-files'

export type HyperFramesGenerationImportStrategy =
  | 'rendered-media'
  | 'source-link'
  | 'source-link-with-approximations'

export type HyperFramesGenerationExecutionEnvironment =
  | 'browser-light'
  | 'local-service'
  | 'remote-service'

export interface HyperFramesGenerationPlanStep {
  id: string
  type: HyperFramesGenerationPlanStepType
  title: string
  description: string
  dependsOn?: string[]
  modelCapability?: ModelCapability
  estimatedCost?: number
  toolPermissionIds: string[]
  userVisible: boolean
  writesToOutputDirectory: boolean
  requiresPlanConfirmation: boolean
  canExecute: boolean
  environment: HyperFramesGenerationExecutionEnvironment
}

export interface HyperFramesGenerationToolPermission {
  id: string
  label: string
  required: boolean
  reason: string
  environment: HyperFramesGenerationExecutionEnvironment
}

export interface HyperFramesGenerationModelBudgetLineItem {
  capability: ModelCapability
  requirementKind: HyperFramesSkillModelRequirementKind
  estimatedCost?: number
  required: boolean
}

export interface HyperFramesGenerationModelBudget {
  currency: 'USD'
  estimatedMaxCost?: number
  requiresPaidModel: boolean
  requiresConfirmation: boolean
  lineItems: HyperFramesGenerationModelBudgetLineItem[]
}

export interface HyperFramesGenerationOutputPlan {
  directory: string
  format: 'hyperframes-project-directory' | 'media-file'
  importStrategy: HyperFramesGenerationImportStrategy
  estimatedDurationFrames?: number
  estimatedDurationSeconds?: number
}

export interface HyperFramesGenerationPlan {
  id: string
  title: string
  status: HyperFramesGenerationPlanStatus
  createdAt: number
  confirmedAt?: number
  confirmedBy?: string
  skillId: string
  skillTitle: string
  steps: HyperFramesGenerationPlanStep[]
  toolPermissions: HyperFramesGenerationToolPermission[]
  modelBudget: HyperFramesGenerationModelBudget
  output: HyperFramesGenerationOutputPlan
  importStrategy: HyperFramesGenerationImportStrategy
  requiresNetwork: boolean
  requiresPaidModel: boolean
  requiresRenderRuntime: boolean
  requiresUserConfirmation: boolean
  canExecute: boolean
  warnings: string[]
}

export interface CreateHyperFramesGenerationPlanOptions {
  recommendation: HyperFramesSkillRecommendation
  context: HyperFramesSkillRecommendationContext
  id?: string
  now?: number
  outputRoot?: string
  projectSlug?: string
  modelRoutingPlan?: ModelRoutingPlan
}

export interface ConfirmHyperFramesGenerationPlanOptions {
  confirmedAt?: number
  confirmedBy?: string
}

const MODEL_CAPABILITY_BY_REQUIREMENT: Record<
  HyperFramesSkillModelRequirementKind,
  ModelCapability
> = {
  'audio-generation': 'audio.music-generation',
  'image-generation': 'image.generation',
  'text-planning': 'text.planning',
  transcription: 'audio.transcription',
  tts: 'audio.synthesis',
  vision: 'vision.understanding',
}

const TOOL_PERMISSION_BY_REQUIREMENT: Record<
  HyperFramesSkillToolRequirementKind,
  Omit<HyperFramesGenerationToolPermission, 'required'>
> = {
  browser: {
    id: 'tool.browser',
    label: 'Browser preview or automation',
    reason: 'The skill needs browser preview, snapshots, or page inspection.',
    environment: 'local-service',
  },
  ffmpeg: {
    id: 'tool.ffmpeg',
    label: 'FFmpeg media processing',
    reason: 'The skill needs FFmpeg or ffprobe for media analysis or rendering.',
    environment: 'local-service',
  },
  figma: {
    id: 'tool.figma',
    label: 'Figma import tools',
    reason: 'The skill references Figma import or motion data.',
    environment: 'remote-service',
  },
  'github-cli': {
    id: 'tool.github-cli',
    label: 'GitHub PR access',
    reason: 'The skill reads pull request metadata, commits, or diffs.',
    environment: 'local-service',
  },
  'hyperframes-cli': {
    id: 'tool.hyperframes-cli',
    label: 'HyperFrames CLI',
    reason: 'The skill references HyperFrames init, lint, check, preview, snapshot, or render.',
    environment: 'local-service',
  },
  'local-filesystem': {
    id: 'filesystem.temp-write',
    label: 'Temporary project directory writes',
    reason:
      'The plan writes generated files only into a temporary output directory until import confirmation.',
    environment: 'local-service',
  },
  'media-use': {
    id: 'tool.media-use',
    label: 'media-use resource resolver',
    reason: 'The skill uses media-use for audio, images, logos, voices, or media provenance.',
    environment: 'local-service',
  },
  node: {
    id: 'tool.node',
    label: 'Node.js skill scripts',
    reason: 'The skill references Node.js scripts as part of its workflow.',
    environment: 'local-service',
  },
  python: {
    id: 'tool.python',
    label: 'Python helper scripts',
    reason: 'The skill references Python helper scripts.',
    environment: 'local-service',
  },
  'render-runtime': {
    id: 'tool.render-runtime',
    label: 'Render runtime',
    reason: 'The skill may render proof media or final media output.',
    environment: 'local-service',
  },
  remotion: {
    id: 'tool.remotion',
    label: 'Remotion source tooling',
    reason: 'The skill ports Remotion source into HyperFrames.',
    environment: 'local-service',
  },
  'skill-update': {
    id: 'tool.skills-update',
    label: 'Skill update check',
    reason: 'The upstream skill recommends a freshness check before execution.',
    environment: 'local-service',
  },
  subagent: {
    id: 'tool.subagent',
    label: 'Subagent orchestration',
    reason: 'The skill workflow dispatches frame or planning subagents.',
    environment: 'remote-service',
  },
}

export function createHyperFramesGenerationPlan(
  options: CreateHyperFramesGenerationPlanOptions,
): HyperFramesGenerationPlan {
  const now = options.now ?? Date.now()
  const skill = options.recommendation.skill
  const slug = options.projectSlug ?? createProjectSlug(skill, now)
  const outputRoot = trimSlashes(options.outputRoot ?? 'hyperframes/generated')
  const outputDirectory = `${outputRoot}/${slug}`
  const importStrategy = selectImportStrategy(skill, options.context)
  const requiresNetwork = inferRequiresNetwork(skill, options.context, options.modelRoutingPlan)
  const requiresRenderRuntime = inferRequiresRenderRuntime(skill, importStrategy)
  const toolPermissions = createToolPermissions(skill, options.context, requiresNetwork)
  const modelBudget = createModelBudget(skill, options.modelRoutingPlan)
  const steps = createPlanSteps({
    skill,
    context: options.context,
    importStrategy,
    requiresRenderRuntime,
    toolPermissions,
    modelBudget,
    confirmed: false,
  })

  return {
    id: options.id ?? `hf-plan-${now}-${slug}`,
    title: `Generate with ${skill.title}`,
    status: 'draft',
    createdAt: now,
    skillId: skill.id,
    skillTitle: skill.title,
    steps,
    toolPermissions,
    modelBudget,
    output: {
      directory: outputDirectory,
      format: importStrategy === 'rendered-media' ? 'media-file' : 'hyperframes-project-directory',
      importStrategy,
      estimatedDurationFrames: options.context.materials?.find(
        (material) => material.durationFrames !== undefined,
      )?.durationFrames,
      estimatedDurationSeconds: estimateDurationSeconds(options.context),
    },
    importStrategy,
    requiresNetwork,
    requiresPaidModel: modelBudget.requiresPaidModel,
    requiresRenderRuntime,
    requiresUserConfirmation: true,
    canExecute: false,
    warnings: createPlanWarnings(options.recommendation, options.modelRoutingPlan),
  }
}

export function confirmHyperFramesGenerationPlan(
  plan: HyperFramesGenerationPlan,
  options: ConfirmHyperFramesGenerationPlanOptions = {},
): HyperFramesGenerationPlan {
  const confirmedAt = options.confirmedAt ?? Date.now()
  return {
    ...plan,
    status: 'confirmed',
    confirmedAt,
    confirmedBy: options.confirmedBy,
    canExecute: true,
    steps: plan.steps.map((step) => ({
      ...step,
      canExecute: true,
    })),
  }
}

export function canExecuteHyperFramesGenerationPlan(plan: HyperFramesGenerationPlan): boolean {
  return plan.status === 'confirmed' && plan.canExecute
}

function createPlanSteps(input: {
  skill: HyperFramesSkillDefinition
  context: HyperFramesSkillRecommendationContext
  importStrategy: HyperFramesGenerationImportStrategy
  requiresRenderRuntime: boolean
  toolPermissions: HyperFramesGenerationToolPermission[]
  modelBudget: HyperFramesGenerationModelBudget
  confirmed: boolean
}): HyperFramesGenerationPlanStep[] {
  const steps: HyperFramesGenerationPlanStep[] = [
    createStep({
      id: 'collect-context',
      type: 'collect-context',
      title: 'Collect context',
      description:
        'Read the user request, selected media, timeline position, model settings and skill metadata.',
      userVisible: true,
      environment: 'browser-light',
      confirmed: input.confirmed,
    }),
  ]

  if (shouldAnalyzeMedia(input.skill, input.context)) {
    steps.push(
      createStep({
        id: 'analyze-media',
        type: 'analyze-media',
        title: 'Analyze input media',
        description:
          'Inspect selected media, URL, audio, video, Figma or code-change context before generation.',
        dependsOn: ['collect-context'],
        modelCapability: firstModelCapability(input.skill, ['vision', 'transcription']),
        userVisible: true,
        environment: input.context.materials?.some((material) => material.type === 'url')
          ? 'remote-service'
          : 'local-service',
        toolPermissionIds: permissionsFor(input.toolPermissions, [
          'tool.browser',
          'tool.ffmpeg',
          'tool.figma',
          'tool.github-cli',
          'network.access',
        ]),
        estimatedCost: estimateStepCost(input.modelBudget, [
          'vision.understanding',
          'audio.transcription',
        ]),
        confirmed: input.confirmed,
      }),
    )
  }

  if (input.skill.modelRequirements.length > 0) {
    steps.push(
      createStep({
        id: 'call-model',
        type: 'call-model',
        title: 'Plan model calls',
        description:
          'Use the configured model center route for planning, code generation, media understanding or audio tasks.',
        dependsOn: [steps.at(-1)?.id ?? 'collect-context'],
        modelCapability: firstModelCapability(input.skill),
        userVisible: true,
        environment: 'remote-service',
        estimatedCost: input.modelBudget.estimatedMaxCost,
        confirmed: input.confirmed,
      }),
    )
  }

  steps.push(
    createStep({
      id: 'run-skill',
      type: 'run-skill',
      title: `Run ${input.skill.title}`,
      description:
        'Execute the selected skill workflow in the chosen execution environment after plan confirmation.',
      dependsOn: [steps.at(-1)?.id ?? 'collect-context'],
      userVisible: true,
      environment: input.toolPermissions.some(
        (permission) => permission.environment === 'local-service',
      )
        ? 'local-service'
        : 'browser-light',
      toolPermissionIds: input.toolPermissions.map((permission) => permission.id),
      confirmed: input.confirmed,
    }),
    createStep({
      id: 'write-project-files',
      type: 'write-project-files',
      title: 'Write temporary project files',
      description: 'Write generated HyperFrames files only into the temporary output directory.',
      dependsOn: ['run-skill'],
      userVisible: true,
      writesToOutputDirectory: true,
      requiresPlanConfirmation: true,
      environment: 'local-service',
      toolPermissionIds: permissionsFor(input.toolPermissions, ['filesystem.temp-write']),
      confirmed: input.confirmed,
    }),
    createStep({
      id: 'lint',
      type: 'lint',
      title: 'Lint generated project',
      description: 'Validate the generated project before it can enter import preview.',
      dependsOn: ['write-project-files'],
      userVisible: true,
      environment: 'browser-light',
      toolPermissionIds: permissionsFor(input.toolPermissions, ['tool.hyperframes-cli']),
      confirmed: input.confirmed,
    }),
    createStep({
      id: 'preview',
      type: 'preview',
      title: 'Prepare preview',
      description:
        'Prepare a preview, thumbnail or snapshot so the user can inspect the result before import.',
      dependsOn: ['lint'],
      userVisible: true,
      environment: 'browser-light',
      toolPermissionIds: permissionsFor(input.toolPermissions, ['tool.browser']),
      confirmed: input.confirmed,
    }),
  )

  if (input.requiresRenderRuntime || input.importStrategy === 'rendered-media') {
    steps.push(
      createStep({
        id: 'render',
        type: 'render',
        title: 'Render proof or media output',
        description:
          'Render media only after plan confirmation and before import confirmation when the strategy requires media output.',
        dependsOn: ['preview'],
        userVisible: true,
        environment: 'local-service',
        toolPermissionIds: permissionsFor(input.toolPermissions, [
          'tool.render-runtime',
          'tool.ffmpeg',
          'tool.browser',
        ]),
        confirmed: input.confirmed,
      }),
    )
  }

  steps.push(
    createStep({
      id: 'prepare-import',
      type: 'prepare-import',
      title: 'Prepare import preview',
      description:
        'Create diagnostics, cost summary and suggested import strategy without writing to the FreeCut timeline.',
      dependsOn: [steps.at(-1)?.id ?? 'preview'],
      userVisible: true,
      environment: 'browser-light',
      confirmed: input.confirmed,
    }),
  )

  return steps
}

function createStep(
  input: Omit<
    HyperFramesGenerationPlanStep,
    'canExecute' | 'toolPermissionIds' | 'writesToOutputDirectory' | 'requiresPlanConfirmation'
  > & {
    toolPermissionIds?: string[]
    writesToOutputDirectory?: boolean
    requiresPlanConfirmation?: boolean
    confirmed: boolean
  },
): HyperFramesGenerationPlanStep {
  const requiresPlanConfirmation = input.requiresPlanConfirmation ?? false
  return {
    ...input,
    toolPermissionIds: input.toolPermissionIds ?? [],
    writesToOutputDirectory: input.writesToOutputDirectory ?? false,
    requiresPlanConfirmation,
    canExecute: input.confirmed && (!requiresPlanConfirmation || input.confirmed),
  }
}

function createToolPermissions(
  skill: HyperFramesSkillDefinition,
  context: HyperFramesSkillRecommendationContext,
  requiresNetwork: boolean,
): HyperFramesGenerationToolPermission[] {
  const permissions = new Map<string, HyperFramesGenerationToolPermission>()

  for (const requirement of skill.toolRequirements) {
    const mapped = TOOL_PERMISSION_BY_REQUIREMENT[requirement.kind]
    permissions.set(mapped.id, {
      ...mapped,
      required: requirement.required,
    })
  }

  permissions.set('filesystem.temp-write', {
    ...TOOL_PERMISSION_BY_REQUIREMENT['local-filesystem'],
    required: true,
  })

  if (requiresNetwork) {
    permissions.set('network.access', {
      id: 'network.access',
      label: 'Network access',
      required: true,
      reason:
        'The plan needs to fetch or analyze URL, Figma, GitHub, remote media, or cloud model resources.',
      environment: 'remote-service',
    })
  }

  for (const material of context.materials ?? []) {
    permissions.set(`material.${material.type}.read`, {
      id: `material.${material.type}.read`,
      label: `Read ${material.type} material`,
      required: true,
      reason: material.label
        ? `The plan reads selected material "${material.label}".`
        : `The plan reads selected ${material.type} material.`,
      environment: 'browser-light',
    })
  }

  return [...permissions.values()].sort((left, right) => left.id.localeCompare(right.id))
}

function createModelBudget(
  skill: HyperFramesSkillDefinition,
  routingPlan: ModelRoutingPlan | undefined,
): HyperFramesGenerationModelBudget {
  const routedCosts = new Map<ModelCapability, number>()
  for (const route of routingPlan?.routes ?? []) {
    routedCosts.set(route.requirement.capability, route.binding.maxCostPerTask ?? 0)
  }

  const lineItems = skill.modelRequirements.map((requirement) => {
    const capability = MODEL_CAPABILITY_BY_REQUIREMENT[requirement.kind]
    return {
      capability,
      requirementKind: requirement.kind,
      estimatedCost: routedCosts.get(capability),
      required: requirement.required,
    }
  })
  const estimatedLineCost = lineItems.reduce(
    (sum, item) => sum + (item.estimatedCost ?? 0),
    routingPlan?.estimatedMaxCost ?? 0,
  )
  const estimatedMaxCost = estimatedLineCost > 0 ? estimatedLineCost : undefined
  const requiresPaidModel = skill.modelRequirements.length > 0 && estimatedMaxCost !== 0

  return {
    currency: 'USD',
    estimatedMaxCost,
    requiresPaidModel,
    requiresConfirmation: routingPlan?.requiresConfirmation ?? requiresPaidModel,
    lineItems,
  }
}

function createPlanWarnings(
  recommendation: HyperFramesSkillRecommendation,
  routingPlan: ModelRoutingPlan | undefined,
): string[] {
  const warnings: string[] = []
  if (recommendation.missingModelRequirements.length > 0) {
    warnings.push(
      `Missing model capabilities: ${recommendation.missingModelRequirements
        .map((requirement) => requirement.kind)
        .join(', ')}.`,
    )
  }
  if (routingPlan?.missing.length) {
    warnings.push(
      `Model routing has unresolved requirements: ${routingPlan.missing
        .map((issue) => issue.capability)
        .join(', ')}.`,
    )
  }
  return warnings
}

function selectImportStrategy(
  skill: HyperFramesSkillDefinition,
  context: HyperFramesSkillRecommendationContext,
): HyperFramesGenerationImportStrategy {
  if (skill.id === 'embedded-captions' || skill.id === 'music-to-video') {
    return 'rendered-media'
  }
  if (context.intentKind === 'overlay' || skill.id === 'motion-graphics') {
    return 'source-link'
  }
  if (
    skill.id === 'product-launch-video' ||
    skill.id === 'faceless-explainer' ||
    skill.id === 'pr-to-video'
  ) {
    return 'source-link-with-approximations'
  }
  return 'source-link'
}

function inferRequiresNetwork(
  skill: HyperFramesSkillDefinition,
  context: HyperFramesSkillRecommendationContext,
  routingPlan: ModelRoutingPlan | undefined,
): boolean {
  if (routingPlan?.requiresNetwork) {
    return true
  }
  if (/https?:\/\//i.test(context.userText)) {
    return true
  }
  if (context.materials?.some((material) => material.uri && /https?:\/\//i.test(material.uri))) {
    return true
  }
  return skill.inputRequirements.some((requirement) =>
    (['figma', 'github-pr', 'url'] as HyperFramesSkillInputKind[]).includes(requirement.kind),
  )
}

function inferRequiresRenderRuntime(
  skill: HyperFramesSkillDefinition,
  importStrategy: HyperFramesGenerationImportStrategy,
): boolean {
  if (importStrategy === 'rendered-media') {
    return true
  }
  return skill.toolRequirements.some((requirement) =>
    (['browser', 'render-runtime'] as HyperFramesSkillToolRequirementKind[]).includes(
      requirement.kind,
    ),
  )
}

function shouldAnalyzeMedia(
  skill: HyperFramesSkillDefinition,
  context: HyperFramesSkillRecommendationContext,
): boolean {
  if ((context.materials ?? []).length > 0) {
    return true
  }
  return skill.inputRequirements.some((requirement) =>
    (
      [
        'audio',
        'figma',
        'github-pr',
        'media-assets',
        'remotion-source',
        'url',
        'video',
      ] as HyperFramesSkillInputKind[]
    ).includes(requirement.kind),
  )
}

function firstModelCapability(
  skill: HyperFramesSkillDefinition,
  allowedKinds?: HyperFramesSkillModelRequirementKind[],
): ModelCapability | undefined {
  const requirement = skill.modelRequirements.find(
    (item) => !allowedKinds || allowedKinds.includes(item.kind),
  )
  if (!requirement) {
    return undefined
  }
  return MODEL_CAPABILITY_BY_REQUIREMENT[requirement.kind]
}

function estimateStepCost(
  budget: HyperFramesGenerationModelBudget,
  capabilities: ModelCapability[],
): number | undefined {
  const cost = budget.lineItems
    .filter((item) => capabilities.includes(item.capability))
    .reduce((sum, item) => sum + (item.estimatedCost ?? 0), 0)
  return cost > 0 ? cost : undefined
}

function permissionsFor(
  permissions: HyperFramesGenerationToolPermission[],
  ids: string[],
): string[] {
  const available = new Set(permissions.map((permission) => permission.id))
  return ids.filter((id) => available.has(id))
}

function createProjectSlug(skill: HyperFramesSkillDefinition, now: number): string {
  return `${skill.id}-${Math.max(0, Math.floor(now))}`
}

function estimateDurationSeconds(
  context: HyperFramesSkillRecommendationContext,
): number | undefined {
  const frames = context.materials?.find(
    (material) => material.durationFrames !== undefined,
  )?.durationFrames
  if (frames === undefined) {
    return undefined
  }
  return Math.round((frames / 30) * 100) / 100
}

function trimSlashes(value: string): string {
  return value.replace(/^\/+/, '').replace(/\/+$/, '')
}
