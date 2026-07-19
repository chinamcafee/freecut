export type HyperFramesSkillCategory =
  | 'marketing-generation'
  | 'content-explanation'
  | 'video-packaging'
  | 'music-driven'
  | 'slideshow'
  | 'general-video'
  | 'domain-tool'

export type HyperFramesSkillInputKind =
  | 'audio'
  | 'code-change'
  | 'existing-project'
  | 'figma'
  | 'github-pr'
  | 'media-assets'
  | 'remotion-source'
  | 'text'
  | 'url'
  | 'video'

export type HyperFramesSkillModelRequirementKind =
  | 'audio-generation'
  | 'image-generation'
  | 'text-planning'
  | 'transcription'
  | 'tts'
  | 'vision'

export type HyperFramesSkillToolRequirementKind =
  | 'browser'
  | 'ffmpeg'
  | 'figma'
  | 'github-cli'
  | 'hyperframes-cli'
  | 'local-filesystem'
  | 'media-use'
  | 'node'
  | 'python'
  | 'render-runtime'
  | 'remotion'
  | 'skill-update'
  | 'subagent'

export interface HyperFramesSkillFileEntry {
  path: string
  content?: string
}

export interface HyperFramesSkillRequirement<TKind extends string> {
  kind: TKind
  label: string
  required: boolean
  evidence: string[]
  sourcePaths: string[]
}

export type HyperFramesSkillInputRequirement =
  HyperFramesSkillRequirement<HyperFramesSkillInputKind>

export type HyperFramesSkillModelRequirement =
  HyperFramesSkillRequirement<HyperFramesSkillModelRequirementKind>

export type HyperFramesSkillToolRequirement =
  HyperFramesSkillRequirement<HyperFramesSkillToolRequirementKind>

export interface HyperFramesSkillSourcePaths {
  root: string
  skillFile?: string
  catalogFiles: string[]
  references: string[]
  themes: string[]
  examples: string[]
  scripts: string[]
  agents: string[]
  categories: string[]
  templates: string[]
  assets: string[]
  all: string[]
}

export interface HyperFramesSkillDefinition {
  id: string
  title: string
  description: string
  categories: HyperFramesSkillCategory[]
  inputRequirements: HyperFramesSkillInputRequirement[]
  modelRequirements: HyperFramesSkillModelRequirement[]
  toolRequirements: HyperFramesSkillToolRequirement[]
  sourcePaths: HyperFramesSkillSourcePaths
  frontmatter: Record<string, string>
}

export interface ParseHyperFramesSkillDirectoryOptions {
  skillId?: string
  rootPath: string
  files: HyperFramesSkillFileEntry[]
}

export interface ParseHyperFramesSkillsCatalogOptions {
  rootPath: string
  files: HyperFramesSkillFileEntry[]
}

interface RequirementRule<TKind extends string> {
  kind: TKind
  label: string
  required?: boolean
  patterns: RegExp[]
}

const CATEGORY_LABELS: Record<HyperFramesSkillCategory, string> = {
  'marketing-generation': 'Marketing generation',
  'content-explanation': 'Content explanation',
  'video-packaging': 'Video packaging',
  'music-driven': 'Music driven',
  slideshow: 'Slideshow',
  'general-video': 'General video',
  'domain-tool': 'Domain tool',
}

const CATEGORY_BY_SKILL_ID: Partial<Record<string, HyperFramesSkillCategory[]>> = {
  'product-launch-video': ['marketing-generation'],
  'faceless-explainer': ['content-explanation'],
  'pr-to-video': ['content-explanation'],
  'embedded-captions': ['video-packaging'],
  'talking-head-recut': ['video-packaging'],
  'motion-graphics': ['video-packaging'],
  'music-to-video': ['music-driven'],
  slideshow: ['slideshow'],
  'general-video': ['general-video'],
  figma: ['domain-tool'],
  hyperframes: ['domain-tool'],
  'hyperframes-animation': ['domain-tool'],
  'hyperframes-cli': ['domain-tool'],
  'hyperframes-core': ['domain-tool'],
  'hyperframes-creative': ['domain-tool'],
  'hyperframes-keyframes': ['domain-tool'],
  'hyperframes-registry': ['domain-tool'],
  'media-use': ['domain-tool'],
  'remotion-to-hyperframes': ['domain-tool'],
}

const INPUT_RULES: Array<RequirementRule<HyperFramesSkillInputKind>> = [
  {
    kind: 'url',
    label: 'URL or website',
    patterns: [/\burl\b/i, /\bwebsite\b/i, /\bwebpage\b/i, /\bsite\b/i],
  },
  {
    kind: 'text',
    label: 'Text, script, notes or brief',
    patterns: [/\btext\b/i, /\bscript\b/i, /\bnotes?\b/i, /\bbrief\b/i, /\barticle\b/i],
  },
  {
    kind: 'video',
    label: 'Existing video or footage',
    patterns: [/\bvideo\b/i, /\bfootage\b/i, /\bclip\b/i, /\btalking-head\b/i],
  },
  {
    kind: 'audio',
    label: 'Audio or music track',
    patterns: [/\baudio\b/i, /\bmusic track\b/i, /\bsong\b/i, /\bvoiceover\b/i],
  },
  {
    kind: 'figma',
    label: 'Figma design or URL',
    patterns: [/\bfigma(?:\.com)?\b/i],
  },
  {
    kind: 'github-pr',
    label: 'GitHub pull request',
    patterns: [/\bgithub pull request\b/i, /\bPR URL\b/i, /\bpull request\b/i],
  },
  {
    kind: 'code-change',
    label: 'Code change',
    patterns: [/\bcode change\b/i, /\bdiff\b/i, /\bcommits?\b/i],
  },
  {
    kind: 'remotion-source',
    label: 'Remotion source',
    patterns: [/\bremotion\b/i, /\bReact\) composition\b/i],
  },
  {
    kind: 'media-assets',
    label: 'Media assets',
    patterns: [/\bimages?\b/i, /\blogos?\b/i, /\bassets?\b/i, /\bicons?\b/i],
  },
  {
    kind: 'existing-project',
    label: 'Existing HyperFrames project',
    patterns: [/\bexisting project\b/i, /\bhyperframes\.json\b/i, /\bcomposition\b/i],
  },
]

const MODEL_RULES: Array<RequirementRule<HyperFramesSkillModelRequirementKind>> = [
  {
    kind: 'text-planning',
    label: 'Text planning or reasoning',
    patterns: [/\bagent\b/i, /\bsub-?agent\b/i, /\bplan\b/i, /\bstoryboard\b/i],
  },
  {
    kind: 'vision',
    label: 'Vision or visual understanding',
    required: false,
    patterns: [
      /\bvision key\b/i,
      /\bGEMINI_API_KEY\b/,
      /\bGOOGLE_API_KEY\b/,
      /\basset-descriptions\b/i,
    ],
  },
  {
    kind: 'tts',
    label: 'Text to speech',
    required: false,
    patterns: [/\bTTS\b/i, /\bvoice\b/i, /\bHeyGen\b/i, /\bKokoro\b/i],
  },
  {
    kind: 'transcription',
    label: 'Transcription',
    required: false,
    patterns: [/\btranscrib/i, /\bWhisper\b/i, /\bword timings\b/i],
  },
  {
    kind: 'audio-generation',
    label: 'Audio, BGM or SFX generation',
    required: false,
    patterns: [/\bBGM\b/i, /\bSFX\b/i, /\bmusic generation\b/i, /\baudio engine\b/i],
  },
  {
    kind: 'image-generation',
    label: 'Image generation',
    required: false,
    patterns: [/\bimage generation\b/i, /\bgenerate images?\b/i],
  },
]

const TOOL_RULES: Array<RequirementRule<HyperFramesSkillToolRequirementKind>> = [
  {
    kind: 'hyperframes-cli',
    label: 'HyperFrames CLI',
    patterns: [
      /\bnpx hyperframes\b/i,
      /\bhyperframes (?:init|lint|check|render|preview|snapshot)\b/i,
    ],
  },
  {
    kind: 'skill-update',
    label: 'HyperFrames skill updater',
    required: false,
    patterns: [/\bskills update\b/i],
  },
  {
    kind: 'node',
    label: 'Node.js scripts',
    patterns: [/\bnode <SKILL_DIR>\b/i, /\bnode [^\n]+(?:\.mjs|\.cjs)\b/i, /\bNode\.js\b/i],
  },
  {
    kind: 'ffmpeg',
    label: 'FFmpeg or ffprobe',
    patterns: [/\bffmpeg\b/i, /\bffprobe\b/i],
  },
  {
    kind: 'browser',
    label: 'Browser automation or preview',
    patterns: [/\bbrowser\b/i, /\bChrome\b/i, /\bsnapshot\b/i, /\bpreview\b/i],
  },
  {
    kind: 'render-runtime',
    label: 'Render runtime',
    patterns: [/\brender\b/i, /\bMP4\b/i, /\btransparent overlay\b/i],
  },
  {
    kind: 'local-filesystem',
    label: 'Local filesystem project writes',
    patterns: [/\bwrite\b/i, /\bfiles?\b/i, /\bproject dir\b/i, /\bPROJECT_DIR\b/i],
  },
  {
    kind: 'media-use',
    label: 'media-use skill',
    patterns: [/\/media-use\b/i, /\bmedia-use\b/i],
  },
  {
    kind: 'figma',
    label: 'Figma tooling',
    required: false,
    patterns: [/\bFigma\b/, /\bfigma\.com\b/i, /\bMCP\b/],
  },
  {
    kind: 'github-cli',
    label: 'GitHub CLI or PR access',
    required: false,
    patterns: [/\bgh\b/, /\bGitHub\b/, /\bpull request\b/i],
  },
  {
    kind: 'remotion',
    label: 'Remotion source tooling',
    required: false,
    patterns: [/\bRemotion\b/],
  },
  {
    kind: 'python',
    label: 'Python scripts',
    required: false,
    patterns: [/\bpython\b/i, /\.py\b/],
  },
  {
    kind: 'subagent',
    label: 'Subagent orchestration',
    required: false,
    patterns: [/\bsub-?agent\b/i, /\bdispatch\b/i],
  },
]

export function parseHyperFramesSkillDirectory(
  options: ParseHyperFramesSkillDirectoryOptions,
): HyperFramesSkillDefinition {
  const normalizedFiles = options.files.map((file) => ({
    path: normalizePath(file.path),
    content: file.content ?? '',
  }))
  const skillFile = normalizedFiles.find((file) => file.path === 'SKILL.md')
  const skillContent = skillFile?.content ?? ''
  const frontmatter = parseMarkdownFrontmatter(skillContent)
  const id = normalizeSkillId(frontmatter.name ?? options.skillId ?? basename(options.rootPath))
  const title = extractFirstHeading(skillContent) ?? formatSkillTitle(id)
  const searchableText = [skillContent, ...catalogText(normalizedFiles)].join('\n\n')
  const sourcePaths = collectSourcePaths(options.rootPath, normalizedFiles)

  return {
    id,
    title,
    description: frontmatter.description ?? '',
    categories: inferCategories(id, searchableText),
    inputRequirements: inferRequirements(INPUT_RULES, searchableText, sourcePaths.skillFile),
    modelRequirements: inferRequirements(MODEL_RULES, searchableText, sourcePaths.skillFile),
    toolRequirements: inferRequirements(TOOL_RULES, searchableText, sourcePaths.skillFile),
    sourcePaths,
    frontmatter,
  }
}

export function parseHyperFramesSkillsCatalog(
  options: ParseHyperFramesSkillsCatalogOptions,
): HyperFramesSkillDefinition[] {
  const grouped = new Map<string, HyperFramesSkillFileEntry[]>()

  for (const file of options.files) {
    const path = normalizePath(file.path)
    const [skillId, ...parts] = path.split('/')
    const relativePath = parts.join('/')
    if (!skillId || !relativePath) {
      continue
    }
    const group = grouped.get(skillId) ?? []
    group.push({ path: relativePath, content: file.content })
    grouped.set(skillId, group)
  }

  return [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .filter(([, files]) => files.some((file) => normalizePath(file.path) === 'SKILL.md'))
    .map(([skillId, files]) =>
      parseHyperFramesSkillDirectory({
        skillId,
        rootPath: joinSourcePath(options.rootPath, skillId),
        files,
      }),
    )
}

function parseMarkdownFrontmatter(content: string): Record<string, string> {
  if (!content.startsWith('---')) {
    return {}
  }

  const lines = content.split(/\r?\n/)
  if (lines[0] !== '---') {
    return {}
  }

  const result: Record<string, string> = {}
  let index = 1
  while (index < lines.length) {
    const line = lines[index]
    if (line === '---') {
      break
    }

    const match = /^([A-Za-z][A-Za-z0-9_-]*):(?:\s*(.*))?$/.exec(line ?? '')
    if (!match?.[1]) {
      index += 1
      continue
    }

    const key = match[1]
    const rawValue = match[2] ?? ''
    if (rawValue === '>' || rawValue === '|') {
      const block: string[] = []
      index += 1
      while (index < lines.length) {
        const blockLine = lines[index] ?? ''
        if (blockLine === '---' || /^[A-Za-z][A-Za-z0-9_-]*:/.test(blockLine)) {
          index -= 1
          break
        }
        block.push(blockLine.trim())
        index += 1
      }
      result[key] = normalizeWhitespace(block.join(' '))
    } else {
      result[key] = unquoteYamlScalar(rawValue)
    }
    index += 1
  }

  return result
}

function extractFirstHeading(content: string): string | undefined {
  const match = /^#\s+(.+)$/m.exec(content)
  return match?.[1]?.trim()
}

function inferCategories(id: string, content: string): HyperFramesSkillCategory[] {
  const categories = new Set(CATEGORY_BY_SKILL_ID[id] ?? [])

  if (/\bmarketing\b|\bpromo\b|\bproduct launch\b|\bcommercial URL\b/i.test(content)) {
    categories.add('marketing-generation')
  }
  if (/\bexplainer\b|\bPR\b|\bcode-change\b|\bhow-to\b|\btopic\b/i.test(content)) {
    categories.add('content-explanation')
  }
  if (
    /\bcaptions?\b|\blower-third\b|\boverlay\b|\bmotion graphic\b|\btitle card\b/i.test(content)
  ) {
    categories.add('video-packaging')
  }
  if (/\bmusic track\b|\bbeat-synced\b|\blyric video\b/i.test(content)) {
    categories.add('music-driven')
  }
  if (/\bslideshow\b|\bpresentation\b|\bdeck\b/i.test(content)) {
    categories.add('slideshow')
  }
  if (/\bgeneral video\b|\bfreeform\b|\bmulti-scene\b/i.test(content)) {
    categories.add('general-video')
  }
  if (categories.size === 0) {
    categories.add('domain-tool')
  }

  return [...categories].sort((left, right) =>
    CATEGORY_LABELS[left].localeCompare(CATEGORY_LABELS[right]),
  )
}

function inferRequirements<TKind extends string>(
  rules: Array<RequirementRule<TKind>>,
  content: string,
  skillFilePath: string | undefined,
): Array<HyperFramesSkillRequirement<TKind>> {
  const sourcePaths = skillFilePath ? [skillFilePath] : []
  return rules
    .map((rule) => {
      const evidence = collectEvidence(rule.patterns, content)
      if (evidence.length === 0) {
        return undefined
      }
      return {
        kind: rule.kind,
        label: rule.label,
        required: rule.required ?? true,
        evidence,
        sourcePaths,
      }
    })
    .filter((requirement): requirement is HyperFramesSkillRequirement<TKind> =>
      Boolean(requirement),
    )
}

function collectEvidence(patterns: RegExp[], content: string): string[] {
  const evidence = new Set<string>()
  for (const pattern of patterns) {
    const match = pattern.exec(content)
    if (match?.[0]) {
      evidence.add(match[0])
    }
  }
  return [...evidence].slice(0, 4)
}

function collectSourcePaths(
  rootPath: string,
  files: HyperFramesSkillFileEntry[],
): HyperFramesSkillSourcePaths {
  const root = normalizePath(rootPath)
  const all = files.map((file) => joinSourcePath(root, file.path)).sort()
  const byRelativePath = files.map((file) => normalizePath(file.path))
  const sourcePaths: HyperFramesSkillSourcePaths = {
    root,
    skillFile: byRelativePath.includes('SKILL.md') ? joinSourcePath(root, 'SKILL.md') : undefined,
    catalogFiles: [],
    references: [],
    themes: [],
    examples: [],
    scripts: [],
    agents: [],
    categories: [],
    templates: [],
    assets: [],
    all,
  }

  for (const relativePath of byRelativePath) {
    const absolutePath = joinSourcePath(root, relativePath)
    const lowerPath = relativePath.toLowerCase()
    if (basename(relativePath).toLowerCase() === 'catalog.md') {
      sourcePaths.catalogFiles.push(absolutePath)
    }
    if (lowerPath.startsWith('references/') || lowerPath.includes('/references/')) {
      sourcePaths.references.push(absolutePath)
    }
    if (lowerPath.startsWith('themes/') || lowerPath.includes('/themes/')) {
      sourcePaths.themes.push(absolutePath)
    }
    if (lowerPath.startsWith('examples/') || lowerPath.includes('/examples/')) {
      sourcePaths.examples.push(absolutePath)
    }
    if (lowerPath.startsWith('scripts/') || lowerPath.includes('/scripts/')) {
      sourcePaths.scripts.push(absolutePath)
    }
    if (
      lowerPath.startsWith('agents/') ||
      lowerPath.startsWith('sub-agents/') ||
      lowerPath.includes('/agents/') ||
      lowerPath.includes('/sub-agents/')
    ) {
      sourcePaths.agents.push(absolutePath)
    }
    if (lowerPath.startsWith('categories/') || lowerPath.includes('/categories/')) {
      sourcePaths.categories.push(absolutePath)
    }
    if (lowerPath.startsWith('templates/') || lowerPath.includes('/templates/')) {
      sourcePaths.templates.push(absolutePath)
    }
    if (
      lowerPath.startsWith('assets/') ||
      lowerPath.includes('/assets/') ||
      lowerPath.includes('/vendor/')
    ) {
      sourcePaths.assets.push(absolutePath)
    }
  }

  return {
    ...sourcePaths,
    catalogFiles: uniqueSorted(sourcePaths.catalogFiles),
    references: uniqueSorted(sourcePaths.references),
    themes: uniqueSorted(sourcePaths.themes),
    examples: uniqueSorted(sourcePaths.examples),
    scripts: uniqueSorted(sourcePaths.scripts),
    agents: uniqueSorted(sourcePaths.agents),
    categories: uniqueSorted(sourcePaths.categories),
    templates: uniqueSorted(sourcePaths.templates),
    assets: uniqueSorted(sourcePaths.assets),
  }
}

function catalogText(files: HyperFramesSkillFileEntry[]): string[] {
  return files
    .filter((file) => basename(file.path).toLowerCase() === 'catalog.md')
    .map((file) => file.content ?? '')
}

function normalizeSkillId(value: string): string {
  return value.trim().replace(/^\/+/, '').toLowerCase()
}

function formatSkillTitle(id: string): string {
  return id
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(' ')
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function unquoteYamlScalar(value: string): string {
  const trimmed = value.trim()
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).replaceAll("''", "'")
  }
  return trimmed
}

function normalizePath(path: string): string {
  return path.replaceAll('\\', '/').replace(/^\/+/, '').replace(/\/+$/, '')
}

function joinSourcePath(root: string, path: string): string {
  return [normalizePath(root), normalizePath(path)].filter(Boolean).join('/')
}

function basename(path: string): string {
  const parts = normalizePath(path).split('/')
  return parts.at(-1) ?? path
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort()
}
