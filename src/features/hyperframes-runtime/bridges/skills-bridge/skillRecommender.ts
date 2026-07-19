import type {
  HyperFramesSkillDefinition,
  HyperFramesSkillInputKind,
  HyperFramesSkillModelRequirement,
} from './skillDirectoryParser'

export type HyperFramesGenerationIntentKind =
  | 'caption-package'
  | 'new-video'
  | 'overlay'
  | 'recut'
  | 'studio-edit'
  | 'timeline-edit'
  | 'timeline-insert'

export type HyperFramesSkillRecommendationMaterialType =
  | 'audio'
  | 'figma'
  | 'github-pr'
  | 'image'
  | 'remotion-source'
  | 'text'
  | 'url'
  | 'video'

export interface HyperFramesSkillRecommendationMaterial {
  id: string
  type: HyperFramesSkillRecommendationMaterialType
  label?: string
  uri?: string
  durationFrames?: number
}

export interface HyperFramesSkillRecommendationTimelineContext {
  playheadFrame?: number
  selectedItemIds?: string[]
  selectedItemTypes?: HyperFramesSkillRecommendationMaterialType[]
  targetRange?: { startFrame: number; endFrame: number }
}

export interface HyperFramesSkillRecommendationContext {
  userText: string
  intentKind?: HyperFramesGenerationIntentKind
  materials?: HyperFramesSkillRecommendationMaterial[]
  timeline?: HyperFramesSkillRecommendationTimelineContext
  modelCapabilities?: string[]
}

export interface HyperFramesSkillRecommendation {
  skill: HyperFramesSkillDefinition
  score: number
  reasons: string[]
  matchedInputKinds: HyperFramesSkillInputKind[]
  missingModelRequirements: HyperFramesSkillModelRequirement[]
}

interface SkillSignalRule {
  skillId: string
  score: number
  reason: string
  patterns?: RegExp[]
  materialTypes?: HyperFramesSkillRecommendationMaterialType[]
  intentKinds?: HyperFramesGenerationIntentKind[]
  timelineSelectedTypes?: HyperFramesSkillRecommendationMaterialType[]
}

const SKILL_SIGNAL_RULES: SkillSignalRule[] = [
  {
    skillId: 'embedded-captions',
    score: 80,
    reason: 'caption/subtitle request',
    patterns: [/\bcaptions?\b/i, /\bsubtitles?\b/i, /字幕/, /caption/i, /酷炫字幕/, /特效字幕/],
    materialTypes: ['video'],
    intentKinds: ['caption-package'],
    timelineSelectedTypes: ['video'],
  },
  {
    skillId: 'talking-head-recut',
    score: 74,
    reason: 'talking-head graphic overlay request',
    patterns: [
      /talking[- ]head/i,
      /\boverlay cards?\b/i,
      /\blower[- ]third/i,
      /图文包装/,
      /访谈包装/,
    ],
    materialTypes: ['video'],
    intentKinds: ['recut', 'overlay'],
    timelineSelectedTypes: ['video'],
  },
  {
    skillId: 'motion-graphics',
    score: 82,
    reason: 'short motion-graphics or overlay request',
    patterns: [
      /\bmotion graphics?\b/i,
      /\bkinetic\b/i,
      /\bstat\b/i,
      /\bcount[- ]?up\b/i,
      /\bchart\b/i,
      /\blogo reveal\b/i,
      /\blower[- ]third/i,
      /\bcallout\b/i,
      /\bmap\b/i,
      /\btitle card\b/i,
      /动态图形/,
      /动效/,
      /标题动画/,
      /数据动画/,
    ],
    intentKinds: ['overlay', 'timeline-insert'],
  },
  {
    skillId: 'product-launch-video',
    score: 84,
    reason: 'website, product launch or promo request',
    patterns: [
      /https?:\/\//i,
      /\bwebsite\b/i,
      /\bsite\b/i,
      /\bproduct launch\b/i,
      /\bpromo\b/i,
      /\bmarketing\b/i,
      /\bSaaS\b/i,
      /官网/,
      /网站/,
      /产品/,
      /宣传/,
      /发布/,
    ],
    materialTypes: ['url'],
    intentKinds: ['new-video'],
  },
  {
    skillId: 'faceless-explainer',
    score: 78,
    reason: 'topic, article or text explainer request',
    patterns: [
      /\bexplainer\b/i,
      /\bexplain\b/i,
      /\barticle\b/i,
      /\bnotes?\b/i,
      /\bhow[- ]to\b/i,
      /讲解/,
      /解释/,
      /科普/,
      /文章/,
    ],
    materialTypes: ['text'],
    intentKinds: ['new-video'],
  },
  {
    skillId: 'music-to-video',
    score: 82,
    reason: 'music or beat-synced video request',
    patterns: [/\bmusic\b/i, /\baudio\b/i, /\blyric\b/i, /\bbeat\b/i, /音乐/, /节奏/, /歌词/],
    materialTypes: ['audio'],
    intentKinds: ['new-video'],
  },
  {
    skillId: 'pr-to-video',
    score: 82,
    reason: 'GitHub pull request or code-change video request',
    patterns: [
      /\bgithub\b/i,
      /\bpull request\b/i,
      /\bPR\b/,
      /\bdiff\b/i,
      /\bchangelog\b/i,
      /代码变更/,
    ],
    materialTypes: ['github-pr'],
    intentKinds: ['new-video'],
  },
  {
    skillId: 'slideshow',
    score: 78,
    reason: 'slideshow or presentation request',
    patterns: [
      /\bslideshow\b/i,
      /\bpresentation\b/i,
      /\bdeck\b/i,
      /\bslides?\b/i,
      /幻灯片/,
      /演示/,
      /PPT/i,
    ],
    intentKinds: ['new-video'],
  },
  {
    skillId: 'figma',
    score: 82,
    reason: 'Figma import request',
    patterns: [/\bfigma(?:\.com)?\b/i],
    materialTypes: ['figma'],
  },
  {
    skillId: 'remotion-to-hyperframes',
    score: 82,
    reason: 'Remotion source port request',
    patterns: [/\bremotion\b/i],
    materialTypes: ['remotion-source'],
  },
  {
    skillId: 'general-video',
    score: 28,
    reason: 'general custom HyperFrames video fallback',
    patterns: [/\bvideo\b/i, /\bscene\b/i, /视频/, /多场景/],
    intentKinds: ['new-video', 'studio-edit', 'timeline-edit'],
  },
]

const INPUT_KIND_BY_MATERIAL: Record<
  HyperFramesSkillRecommendationMaterialType,
  HyperFramesSkillInputKind
> = {
  audio: 'audio',
  figma: 'figma',
  'github-pr': 'github-pr',
  image: 'media-assets',
  'remotion-source': 'remotion-source',
  text: 'text',
  url: 'url',
  video: 'video',
}

const MODEL_CAPABILITY_ALIASES: Record<string, string[]> = {
  'audio-generation': ['audio-generation', 'audio', 'music', 'sfx', 'bgm'],
  'image-generation': ['image-generation', 'image', 'vision.generate'],
  'text-planning': ['text-planning', 'text', 'llm', 'code.hyperframes'],
  transcription: ['transcription', 'speech-to-text', 'stt', 'audio.transcription'],
  tts: ['tts', 'text-to-speech', 'voice'],
  vision: ['vision', 'image-understanding', 'visual', 'multimodal'],
}

export function recommendHyperFramesSkills(
  skills: HyperFramesSkillDefinition[],
  context: HyperFramesSkillRecommendationContext,
): HyperFramesSkillRecommendation[] {
  const text = buildSearchText(context)
  const materialTypes = new Set(context.materials?.map((material) => material.type) ?? [])
  const timelineSelectedTypes = new Set(context.timeline?.selectedItemTypes ?? [])
  const modelCapabilities = normalizeModelCapabilities(context.modelCapabilities ?? [])
  const inputKinds = collectContextInputKinds(context)

  const recommendations = skills.map((skill) => {
    const reasons = new Set<string>()
    const matchedInputKinds = matchInputKinds(skill, inputKinds, reasons)
    let score = scoreSkillSignals(
      skill.id,
      text,
      materialTypes,
      timelineSelectedTypes,
      context,
      reasons,
    )
    score += matchedInputKinds.length * 8
    score += scoreTimelineFit(skill, context, reasons)
    score += scoreCategoryFallback(skill, context, reasons)

    const missingModelRequirements = skill.modelRequirements.filter(
      (requirement) => !hasModelCapability(requirement.kind, modelCapabilities),
    )
    const satisfiedModelCount = skill.modelRequirements.length - missingModelRequirements.length
    if (satisfiedModelCount > 0) {
      score += satisfiedModelCount * 4
      reasons.add('available model capabilities satisfy part of the skill requirements')
    }
    if (missingModelRequirements.length > 0 && score > 0) {
      score -= Math.min(12, missingModelRequirements.length * 3)
    }

    if (skill.id === 'general-video' && score === 0) {
      score = 12
      reasons.add('fallback for unmatched video generation requests')
    }

    return {
      skill,
      score: Math.max(0, Math.round(score)),
      reasons: [...reasons],
      matchedInputKinds,
      missingModelRequirements,
    }
  })

  return recommendations
    .filter((recommendation) => recommendation.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score
      }
      return left.skill.title.localeCompare(right.skill.title)
    })
}

function scoreSkillSignals(
  skillId: string,
  text: string,
  materialTypes: Set<HyperFramesSkillRecommendationMaterialType>,
  timelineSelectedTypes: Set<HyperFramesSkillRecommendationMaterialType>,
  context: HyperFramesSkillRecommendationContext,
  reasons: Set<string>,
): number {
  let score = 0

  for (const rule of SKILL_SIGNAL_RULES) {
    if (rule.skillId !== skillId) {
      continue
    }
    const matchedPattern = rule.patterns?.some((pattern) => pattern.test(text)) ?? false
    const matchedMaterial =
      rule.materialTypes?.some((materialType) => materialTypes.has(materialType)) ?? false
    const matchedIntent = rule.intentKinds?.includes(context.intentKind ?? 'new-video') ?? false
    const matchedTimeline =
      rule.timelineSelectedTypes?.some((materialType) => timelineSelectedTypes.has(materialType)) ??
      false

    if (matchedPattern || matchedMaterial || matchedIntent || matchedTimeline) {
      const matchCount = [matchedPattern, matchedMaterial, matchedIntent, matchedTimeline].filter(
        Boolean,
      ).length
      score += rule.score + Math.max(0, matchCount - 1) * 8
      reasons.add(rule.reason)
    }
  }

  return score
}

function matchInputKinds(
  skill: HyperFramesSkillDefinition,
  inputKinds: Set<HyperFramesSkillInputKind>,
  reasons: Set<string>,
): HyperFramesSkillInputKind[] {
  const matches: HyperFramesSkillInputKind[] = []
  for (const requirement of skill.inputRequirements) {
    if (inputKinds.has(requirement.kind)) {
      matches.push(requirement.kind)
    }
  }
  if (matches.length > 0) {
    reasons.add(`input matches: ${matches.join(', ')}`)
  }
  return matches
}

function scoreTimelineFit(
  skill: HyperFramesSkillDefinition,
  context: HyperFramesSkillRecommendationContext,
  reasons: Set<string>,
): number {
  const selectedTypes = new Set(context.timeline?.selectedItemTypes ?? [])
  const hasPlayhead = typeof context.timeline?.playheadFrame === 'number'
  const hasTargetRange = Boolean(context.timeline?.targetRange)

  if (context.intentKind === 'caption-package' && skill.id === 'embedded-captions') {
    reasons.add('caption workflow matches selected timeline video')
    return 20
  }
  if (context.intentKind === 'overlay' && skill.id === 'motion-graphics') {
    reasons.add('overlay intent can insert a HyperFrames motion graphic at the playhead')
    return hasPlayhead || hasTargetRange ? 18 : 12
  }
  if (
    context.intentKind === 'recut' &&
    selectedTypes.has('video') &&
    skill.id === 'talking-head-recut'
  ) {
    reasons.add('recut intent and selected video match talking-head packaging')
    return 18
  }
  if (context.intentKind === 'timeline-insert' && skill.id === 'motion-graphics') {
    reasons.add('timeline insert intent favors short motion graphics')
    return 14
  }
  return 0
}

function scoreCategoryFallback(
  skill: HyperFramesSkillDefinition,
  context: HyperFramesSkillRecommendationContext,
  reasons: Set<string>,
): number {
  if (context.intentKind !== 'new-video') {
    return 0
  }
  if (
    skill.categories.includes('marketing-generation') ||
    skill.categories.includes('content-explanation') ||
    skill.categories.includes('music-driven') ||
    skill.categories.includes('slideshow')
  ) {
    reasons.add('new-video intent matches a generation skill category')
    return 6
  }
  return 0
}

function collectContextInputKinds(
  context: HyperFramesSkillRecommendationContext,
): Set<HyperFramesSkillInputKind> {
  const inputKinds = new Set<HyperFramesSkillInputKind>()
  if (context.userText.trim().length > 24) {
    inputKinds.add('text')
  }
  if (/https?:\/\//i.test(context.userText)) {
    inputKinds.add('url')
  }
  if (/\bfigma(?:\.com)?\b/i.test(context.userText)) {
    inputKinds.add('figma')
  }
  if (/\bgithub\b|\bpull request\b|\bPR\b/.test(context.userText)) {
    inputKinds.add('github-pr')
    inputKinds.add('code-change')
  }
  if (/\bremotion\b/i.test(context.userText)) {
    inputKinds.add('remotion-source')
  }

  for (const material of context.materials ?? []) {
    inputKinds.add(INPUT_KIND_BY_MATERIAL[material.type])
    if (material.uri && /https?:\/\//i.test(material.uri)) {
      inputKinds.add('url')
    }
  }
  for (const itemType of context.timeline?.selectedItemTypes ?? []) {
    inputKinds.add(INPUT_KIND_BY_MATERIAL[itemType])
  }

  return inputKinds
}

function buildSearchText(context: HyperFramesSkillRecommendationContext): string {
  return [
    context.userText,
    context.intentKind ?? '',
    ...(context.materials ?? []).flatMap((material) => [
      material.type,
      material.label ?? '',
      material.uri ?? '',
    ]),
    ...(context.timeline?.selectedItemTypes ?? []),
  ].join('\n')
}

function normalizeModelCapabilities(capabilities: string[]): Set<string> {
  return new Set(capabilities.map((capability) => capability.trim().toLowerCase()).filter(Boolean))
}

function hasModelCapability(kind: string, capabilities: Set<string>): boolean {
  const aliases = MODEL_CAPABILITY_ALIASES[kind] ?? [kind]
  return aliases.some((alias) => capabilities.has(alias.toLowerCase()))
}
