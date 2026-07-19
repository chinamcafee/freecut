import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import {
  parseHyperFramesSkillsCatalog,
  type HyperFramesSkillFileEntry,
} from './skillDirectoryParser'
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

describe('HyperFrames skill recommender', () => {
  it('recommends motion-graphics for short dynamic graphics and overlay insertion', () => {
    const recommendations = recommendHyperFramesSkills(skillCatalog, {
      userText: '做一个 8 秒动态图形标题动画，带 stat count-up 和 lower-third callout',
      intentKind: 'overlay',
      timeline: {
        playheadFrame: 240,
        selectedItemTypes: ['text'],
      },
      modelCapabilities: ['text-planning'],
    })

    expect(recommendations[0]?.skill.id).toBe('motion-graphics')
    expect(recommendations[0]?.reasons.join(' ')).toContain('motion')
  })

  it('recommends embedded-captions for a selected talking-head video caption package', () => {
    const recommendations = recommendHyperFramesSkills(skillCatalog, {
      userText: '给当前说话人视频加酷炫字幕，字幕要贴合人物后方',
      intentKind: 'caption-package',
      materials: [{ id: 'clip-1', type: 'video', label: 'interview.mp4' }],
      timeline: {
        playheadFrame: 0,
        selectedItemIds: ['clip-1'],
        selectedItemTypes: ['video'],
      },
      modelCapabilities: ['transcription', 'tts'],
    })

    expect(recommendations[0]?.skill.id).toBe('embedded-captions')
    expect(recommendations[0]?.matchedInputKinds).toContain('video')
  })

  it('recommends product-launch-video for website and product promo requests', () => {
    const recommendations = recommendHyperFramesSkills(skillCatalog, {
      userText: '请把 https://example.com 做成一个 SaaS 产品发布宣传视频，展示网站卖点',
      intentKind: 'new-video',
      materials: [{ id: 'url-1', type: 'url', uri: 'https://example.com' }],
      modelCapabilities: ['text-planning', 'vision', 'tts'],
    })

    expect(recommendations[0]?.skill.id).toBe('product-launch-video')
    expect(recommendations[0]?.matchedInputKinds).toContain('url')
  })

  it('recommends faceless-explainer for article and topic explainer requests', () => {
    const recommendations = recommendHyperFramesSkills(skillCatalog, {
      userText: '把这段文章整理成一个 60 秒无人讲解科普视频，解释里面的核心概念',
      intentKind: 'new-video',
      materials: [{ id: 'article-1', type: 'text', label: 'article.md' }],
      modelCapabilities: ['text-planning', 'tts'],
    })

    expect(recommendations[0]?.skill.id).toBe('faceless-explainer')
    expect(recommendations[0]?.matchedInputKinds).toContain('text')
  })

  it('keeps model capability gaps visible without hiding the best skill match', () => {
    const recommendations = recommendHyperFramesSkills(skillCatalog, {
      userText: '给这个采访视频生成中文字幕',
      intentKind: 'caption-package',
      materials: [{ id: 'clip-1', type: 'video' }],
      timeline: { selectedItemTypes: ['video'] },
      modelCapabilities: ['text-planning'],
    })

    expect(recommendations[0]?.skill.id).toBe('embedded-captions')
    expect(
      recommendations[0]?.missingModelRequirements.some(
        (requirement) => requirement.kind === 'transcription',
      ),
    ).toBe(true)
  })
})
