import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import {
  parseHyperFramesSkillDirectory,
  parseHyperFramesSkillsCatalog,
  type HyperFramesSkillFileEntry,
} from './skillDirectoryParser'

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

function collectSkillFiles(skillId: string): HyperFramesSkillFileEntry[] {
  const skillRoot = join(skillsRoot, skillId)
  const files: HyperFramesSkillFileEntry[] = []
  collectFiles(skillRoot, skillRoot, files)
  return files
}

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

describe('HyperFrames skill directory parser', () => {
  it('parses a workflow skill title, categories, requirements and source paths', () => {
    const definition = parseHyperFramesSkillDirectory({
      skillId: 'product-launch-video',
      rootPath: 'src/features/hyperframes-runtime/upstream/skills/product-launch-video',
      files: collectSkillFiles('product-launch-video'),
    })

    expect(definition.id).toBe('product-launch-video')
    expect(definition.title).toBe('Product Launch to HyperFrames')
    expect(definition.description).toContain('product launch')
    expect(definition.categories).toContain('marketing-generation')
    expect(definition.inputRequirements.map((requirement) => requirement.kind)).toEqual(
      expect.arrayContaining(['url', 'text', 'figma']),
    )
    expect(definition.modelRequirements.map((requirement) => requirement.kind)).toEqual(
      expect.arrayContaining(['text-planning', 'vision', 'tts', 'audio-generation']),
    )
    expect(definition.toolRequirements.map((requirement) => requirement.kind)).toEqual(
      expect.arrayContaining([
        'hyperframes-cli',
        'skill-update',
        'node',
        'media-use',
        'figma',
        'subagent',
      ]),
    )
    expect(definition.sourcePaths.skillFile).toBe(
      'src/features/hyperframes-runtime/upstream/skills/product-launch-video/SKILL.md',
    )
    expect(definition.sourcePaths.references).toContain(
      'src/features/hyperframes-runtime/upstream/skills/product-launch-video/references/story-design.md',
    )
    expect(definition.sourcePaths.scripts).toContain(
      'src/features/hyperframes-runtime/upstream/skills/product-launch-video/scripts/build-frame.mjs',
    )
    expect(definition.sourcePaths.agents).toContain(
      'src/features/hyperframes-runtime/upstream/skills/product-launch-video/sub-agents/frame-worker.md',
    )
  })

  it('parses CATALOG, themes and local media requirements for caption skills', () => {
    const definition = parseHyperFramesSkillDirectory({
      skillId: 'embedded-captions',
      rootPath: 'src/features/hyperframes-runtime/upstream/skills/embedded-captions',
      files: collectSkillFiles('embedded-captions'),
    })

    expect(definition.title).toBe('Embedded Captions')
    expect(definition.categories).toContain('video-packaging')
    expect(definition.inputRequirements.map((requirement) => requirement.kind)).toContain('video')
    expect(definition.modelRequirements.map((requirement) => requirement.kind)).toEqual(
      expect.arrayContaining(['transcription', 'tts']),
    )
    expect(definition.toolRequirements.map((requirement) => requirement.kind)).toEqual(
      expect.arrayContaining(['ffmpeg', 'node', 'hyperframes-cli']),
    )
    expect(definition.sourcePaths.catalogFiles).toEqual([
      'src/features/hyperframes-runtime/upstream/skills/embedded-captions/CATALOG.md',
    ])
    expect(definition.sourcePaths.themes).toContain(
      'src/features/hyperframes-runtime/upstream/skills/embedded-captions/themes/anchor.json',
    )
    expect(definition.sourcePaths.scripts).toContain(
      'src/features/hyperframes-runtime/upstream/skills/embedded-captions/scripts/prepare.sh',
    )
    expect(definition.sourcePaths.assets.some((path) => path.includes('/assets/'))).toBe(true)
  })

  it('builds a full skill catalog without executing upstream scripts', () => {
    const definitions = parseHyperFramesSkillsCatalog({
      rootPath: 'src/features/hyperframes-runtime/upstream/skills',
      files: collectCatalogFiles(),
    })
    const ids = definitions.map((definition) => definition.id)

    expect(ids).toEqual([
      'embedded-captions',
      'faceless-explainer',
      'figma',
      'general-video',
      'hyperframes',
      'hyperframes-animation',
      'hyperframes-cli',
      'hyperframes-core',
      'hyperframes-creative',
      'hyperframes-keyframes',
      'hyperframes-registry',
      'media-use',
      'motion-graphics',
      'music-to-video',
      'pr-to-video',
      'product-launch-video',
      'remotion-to-hyperframes',
      'slideshow',
      'talking-head-recut',
    ])
    expect(definitions).toHaveLength(19)

    for (const definition of definitions) {
      expect(existsSync(join(repoRoot, definition.sourcePaths.skillFile ?? ''))).toBe(true)
      expect(definition.title.length).toBeGreaterThan(0)
      expect(definition.sourcePaths.root).toBe(
        `src/features/hyperframes-runtime/upstream/skills/${definition.id}`,
      )
      expect(definition.sourcePaths.all.length).toBeGreaterThan(0)
      for (const sourcePath of definition.sourcePaths.all) {
        expect(sourcePath).toMatch(/^src\/features\/hyperframes-runtime\/upstream\/skills\//)
        expect(statSync(join(repoRoot, sourcePath)).isFile()).toBe(true)
      }
    }

    expect(
      definitions.find((definition) => definition.id === 'motion-graphics')?.categories,
    ).toContain('video-packaging')
    expect(
      definitions.find((definition) => definition.id === 'music-to-video')?.categories,
    ).toContain('music-driven')
    expect(definitions.find((definition) => definition.id === 'slideshow')?.categories).toContain(
      'slideshow',
    )
  })
})
