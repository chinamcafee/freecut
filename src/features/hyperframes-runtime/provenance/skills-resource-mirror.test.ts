import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { findUpstreamPackage } from './manifest'

const repoRoot = process.cwd()
const skillsRoot = join(repoRoot, 'src/features/hyperframes-runtime/upstream/skills')
const syncStatePath = join(
  repoRoot,
  'src/features/hyperframes-runtime/provenance/upstream-sync-state.json',
)

function collectFiles(dir: string, base = dir, files: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      collectFiles(path, base, files)
      continue
    }
    if (entry.isFile()) {
      files.push(relative(base, path).replaceAll('\\', '/'))
    }
  }
  return files
}

describe('HyperFrames skills resource mirror', () => {
  it('mirrors every top-level HyperFrames skill directory as resources', () => {
    const skillDirs = readdirSync(skillsRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort()

    expect(skillDirs).toEqual([
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

    for (const skillDir of skillDirs) {
      expect(existsSync(join(skillsRoot, skillDir, 'SKILL.md'))).toBe(true)
    }
  })

  it('contains SKILL, CATALOG, references, themes, examples and scripts resources', () => {
    const requiredResources = [
      'embedded-captions/SKILL.md',
      'embedded-captions/CATALOG.md',
      'embedded-captions/references/aesthetic-principles.md',
      'embedded-captions/themes/anchor.json',
      'embedded-captions/scripts/make-composition.cjs',
      'hyperframes-animation/examples/brand-reveal-assemble-zoom.html',
      'hyperframes-core/references/minimal-composition.md',
      'product-launch-video/scripts/assemble-index.mjs',
      'music-to-video/references/templates/card-flyby/index.html',
      'remotion-to-hyperframes/assets/test-corpus/tier-1-title-card/expected.json',
      'talking-head-recut/assets/vendor/gsap.min.js',
    ]

    for (const resource of requiredResources) {
      const path = join(skillsRoot, resource)
      expect(existsSync(path)).toBe(true)
      expect(statSync(path).isFile()).toBe(true)
    }
  })

  it('records skills provenance and sync state without requiring package execution', () => {
    const entry = findUpstreamPackage('skills')
    expect(entry).toEqual(
      expect.objectContaining({
        source: 'skills',
        target: 'src/features/hyperframes-runtime/upstream/skills',
        environment: 'task-sandbox',
        strategy: 'source-resource-copy',
      }),
    )

    const syncState = JSON.parse(readFileSync(syncStatePath, 'utf8'))
    const skillFiles = collectFiles(skillsRoot)
    expect(syncState.packages.skills).toEqual(
      expect.objectContaining({
        source: 'skills',
        target: 'src/features/hyperframes-runtime/upstream/skills',
        strategy: 'source-resource-copy',
        runtimeOnly: false,
        includePaths: [],
        fileCount: 841,
      }),
    )
    expect(skillFiles).toHaveLength(syncState.packages.skills.fileCount)
  })
})
