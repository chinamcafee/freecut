import { createWorkspaceHyperFramesProjectRepository } from '@/features/hyperframes-runtime/adapters/freecut-project/file-system-project-repository'
import type {
  HyperFramesProjectRepository,
  HyperFramesProjectRef,
  HyperFramesProjectSnapshot,
  HyperFramesProjectWriteMeta,
} from '@/features/hyperframes-runtime/adapters/freecut-project/project-repository'
import { hashHyperFramesText } from '@/features/hyperframes-runtime/adapters/freecut-project/project-signatures'
import {
  lintHyperframeHtml,
  shouldBlockRender as shouldBlockHyperFramesRender,
  type HyperframeLintFinding,
  type HyperframeLintResult,
} from '../../upstream/lint/browser.js'
import type {
  HyperFramesDiagnostic,
  HyperFramesLintSummary,
  HyperFramesProjectDirectory,
  HyperFramesProjectManifest,
} from '@/types/hyperframes'
import { normalizeStudioSelection, type FreeCutStudioSelection } from './StudioSelectionMapper'

export interface FreeCutStudioFileRef {
  path: string
  hash?: string
  bytes: number
}

export type FreeCutStudioProjectRef = HyperFramesProjectRef

export interface FreeCutStudioPatchMeta extends HyperFramesProjectWriteMeta {
  userInitiated?: boolean
}

export interface FreeCutStudioThumbnailOptions {
  compositionPath?: string
  width?: number
  height?: number
}

export interface FreeCutStudioThumbnail {
  url: string
  width: number
  height: number
  generatedAt: number
}

export interface FreeCutStudioRenderPreviewOptions {
  compositionPath: string
}

export interface FreeCutStudioRenderPreviewResult {
  ok: boolean
  previewUrl: string
  diagnostics: HyperFramesDiagnostic[]
}

export interface FreeCutStudioRenderOptions {
  compositionPath?: string
  format?: 'mp4' | 'webm' | 'mov'
  quality?: 'draft' | 'standard' | 'high'
}

export interface FreeCutStudioRenderJob {
  id: string
  projectId: string
  compositionPath: string
  status: 'queued' | 'blocked'
  createdAt: number
  diagnostics: HyperFramesDiagnostic[]
  previewUrl?: string
}

export interface FreeCutStudioWaveformOptions {
  peakCount?: number
}

export interface FreeCutStudioWaveform {
  assetPath: string
  peaks: number[]
  generatedAt: number
  source: 'asset-bytes-placeholder'
}

export interface FreeCutStudioRegistryBlock {
  id: string
  title: string
  description?: string
  tags?: string[]
}

export interface FreeCutStudioLintResult {
  ok: boolean
  shouldBlockRender: boolean
  summary: HyperFramesLintSummary
  diagnostics: HyperFramesDiagnostic[]
}

export interface FreeCutStudioBrowserLintAdapter {
  lintHtml: typeof lintHyperframeHtml
}

export interface FreeCutStudioAdapter {
  listProjects(): Promise<FreeCutStudioProjectRef[]>
  listFiles(projectId: string): Promise<FreeCutStudioFileRef[]>
  resolveProject(projectId: string): Promise<HyperFramesProjectDirectory | undefined>
  readFile(projectId: string, path: string): Promise<string | undefined>
  writeFile(
    projectId: string,
    path: string,
    content: string,
    patchMeta: FreeCutStudioPatchMeta,
  ): Promise<{ hash: string }>
  previewUrl(projectId: string, compositionPath: string): Promise<string>
  lint(projectId: string, compositionPath: string): Promise<FreeCutStudioLintResult>
  getSelection(projectId: string): Promise<FreeCutStudioSelection | null>
  updateSelection(projectId: string, selection: FreeCutStudioSelection | null): Promise<void>
  generateThumbnail(
    projectId: string,
    options?: FreeCutStudioThumbnailOptions,
  ): Promise<FreeCutStudioThumbnail>
  renderPreview(
    projectId: string,
    options: FreeCutStudioRenderPreviewOptions,
  ): Promise<FreeCutStudioRenderPreviewResult>
  startRender(
    projectId: string,
    options?: FreeCutStudioRenderOptions,
  ): Promise<FreeCutStudioRenderJob>
  generateWaveform(
    projectId: string,
    assetPath: string,
    options?: FreeCutStudioWaveformOptions,
  ): Promise<FreeCutStudioWaveform>
  listRegistryBlocks(): Promise<FreeCutStudioRegistryBlock[]>
  createSnapshot(projectId: string, reason: string): Promise<HyperFramesProjectSnapshot>
  restoreSnapshot(projectId: string, snapshotId: string): Promise<void>
  writeManifest(
    projectId: string,
    manifest: HyperFramesProjectManifest,
    patchMeta: FreeCutStudioPatchMeta,
  ): Promise<void>
}

export interface CreateFreeCutStudioAdapterOptions {
  freecutProjectId?: string
  repository?: HyperFramesProjectRepository
  lintAdapter?: FreeCutStudioBrowserLintAdapter
}

const DEFAULT_LINT_ADAPTER: FreeCutStudioBrowserLintAdapter = {
  lintHtml: lintHyperframeHtml,
}

function dataUrlForHtml(html: string): string {
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`
}

function dataUrlForThumbnail(title: string, width: number, height: number): string {
  const safeTitle = title
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#111827"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#e5e7eb" font-family="system-ui, sans-serif" font-size="24">${safeTitle}</text></svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

function normalizePeakCount(value: number | undefined): number {
  if (!value || !Number.isFinite(value)) return 256
  return Math.max(16, Math.min(4096, Math.floor(value)))
}

function waveformPeaksFromBytes(bytes: Uint8Array, count: number): number[] {
  if (bytes.length === 0) return Array.from({ length: count }, () => 0)
  const step = bytes.length / count
  const peaks: number[] = []
  for (let index = 0; index < count; index += 1) {
    const start = Math.floor(index * step)
    const end = Math.min(bytes.length, Math.floor((index + 1) * step))
    let peak = 0
    for (let byteIndex = start; byteIndex < end; byteIndex += 1) {
      peak = Math.max(peak, Math.abs((bytes[byteIndex] ?? 128) - 128) / 128)
    }
    peaks.push(Math.round(peak * 1000) / 1000)
  }
  return peaks
}

function missingCompositionDiagnostic(
  projectId: string,
  compositionPath: string,
): HyperFramesDiagnostic {
  return {
    id: `hyperframes.studio.composition-missing:${projectId}:${compositionPath}`,
    code: 'hyperframes.studio.composition-missing',
    source: 'storage',
    stage: 'studio-save',
    severity: 'blocking',
    message: `HyperFrames composition file not found: ${compositionPath}`,
    file: compositionPath,
  }
}

function mapLintSeverity(
  severity: HyperframeLintFinding['severity'],
): HyperFramesDiagnostic['severity'] {
  if (severity === 'error') return 'blocking'
  if (severity === 'warning') return 'warning'
  return 'suggestion'
}

function diagnosticId(input: unknown): string {
  return hashHyperFramesText(JSON.stringify(input)).slice(0, 24)
}

function mapLintFindingToDiagnostic(
  finding: HyperframeLintFinding,
  file: string,
): HyperFramesDiagnostic {
  const code = `hyperframes.lint.${finding.code}`
  const diagnosticFile = finding.file ?? file
  return {
    id: `${code}:${diagnosticId({
      code,
      file: diagnosticFile,
      selector: finding.selector,
      elementId: finding.elementId,
      message: finding.message,
    })}`,
    code,
    source: 'lint',
    stage: 'studio-save',
    severity: mapLintSeverity(finding.severity),
    message: finding.message,
    file: diagnosticFile,
    selector: finding.selector,
    elementId: finding.elementId,
    snippet: finding.snippet,
    fixHint: finding.fixHint,
  }
}

function resultFromDiagnostics(diagnostics: HyperFramesDiagnostic[]): FreeCutStudioLintResult {
  const counts = diagnostics.reduce(
    (acc, diagnostic) => {
      if (diagnostic.severity === 'blocking') acc.blockingCount += 1
      else if (diagnostic.severity === 'warning') acc.warningCount += 1
      else acc.suggestionCount += 1
      return acc
    },
    { blockingCount: 0, warningCount: 0, suggestionCount: 0 },
  )

  const blocksRender = shouldBlockHyperFramesRender(
    true,
    false,
    counts.blockingCount,
    counts.warningCount,
  )

  return {
    ok: counts.blockingCount === 0,
    shouldBlockRender: blocksRender,
    diagnostics,
    summary: {
      checkedAt: Date.now(),
      ...counts,
      diagnostics,
    },
  }
}

function resultFromLintResult(result: HyperframeLintResult, file: string): FreeCutStudioLintResult {
  return resultFromDiagnostics(
    result.findings.map((finding) => mapLintFindingToDiagnostic(finding, file)),
  )
}

function cleanReferencePath(path: string): string {
  return path.trim().split(/[?#]/, 1)[0] ?? ''
}

function dirname(path: string): string {
  const index = path.lastIndexOf('/')
  return index > 0 ? path.slice(0, index) : ''
}

function normalizeProjectPath(path: string): string | null {
  const out: string[] = []
  for (const segment of path.split('/')) {
    if (!segment || segment === '.') continue
    if (segment === '..') {
      if (out.length === 0) return null
      out.pop()
      continue
    }
    out.push(segment)
  }
  return out.join('/')
}

function resolveReferencePath(filePath: string, referencePath: string): string | null {
  const clean = cleanReferencePath(referencePath)
  if (!clean) return null
  if (/^(?:[a-z][a-z0-9+.-]*:|#|\/\/)/i.test(clean)) return null
  const relative = clean.startsWith('/')
    ? clean.slice(1)
    : [dirname(filePath), clean].filter(Boolean).join('/')
  return normalizeProjectPath(relative)
}

function collectLocalAssetReferences(html: string): string[] {
  const references = new Set<string>()
  if (typeof DOMParser !== 'undefined') {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    for (const node of doc.querySelectorAll('[src], [href], source[srcset], img[srcset]')) {
      const src = node.getAttribute('src')
      const href = node.getAttribute('href')
      const srcset = node.getAttribute('srcset')
      if (src) references.add(src)
      if (href) references.add(href)
      if (srcset) {
        for (const entry of srcset.split(',')) {
          const candidate = entry.trim().split(/\s+/, 1)[0]
          if (candidate) references.add(candidate)
        }
      }
    }
    return [...references]
  }

  const attrPattern = /\b(?:src|href)=["']([^"']+)["']/gi
  for (const match of html.matchAll(attrPattern)) {
    if (match[1]) references.add(match[1])
  }
  return [...references]
}

function lintDirectoryAssetReferences(
  directory: HyperFramesProjectDirectory,
  filePath: string,
  html: string,
): HyperFramesDiagnostic[] {
  const knownPaths = new Set([
    ...directory.files.map((file) => file.path),
    ...directory.assets.map((asset) => asset.path),
  ])
  const diagnostics: HyperFramesDiagnostic[] = []
  for (const reference of collectLocalAssetReferences(html)) {
    const resolved = resolveReferencePath(filePath, reference)
    if (!resolved || knownPaths.has(resolved)) continue
    diagnostics.push({
      id: `hyperframes.lint.missing_local_asset:${diagnosticId({
        file: filePath,
        reference,
      })}`,
      code: 'hyperframes.lint.missing_local_asset',
      source: 'lint',
      stage: 'studio-save',
      severity: 'blocking',
      message: `HyperFrames project file "${filePath}" references missing local asset "${reference}".`,
      file: filePath,
      fixHint:
        'Add the missing asset to the HyperFrames project directory or update the reference.',
    })
  }
  return diagnostics
}

function requireDirectory(
  directory: HyperFramesProjectDirectory | undefined,
  projectId: string,
): HyperFramesProjectDirectory {
  if (!directory) {
    throw new Error(`HyperFrames project not found: ${projectId}`)
  }
  return directory
}

export function createFreeCutStudioAdapter({
  freecutProjectId,
  repository,
  lintAdapter = DEFAULT_LINT_ADAPTER,
}: CreateFreeCutStudioAdapterOptions = {}): FreeCutStudioAdapter {
  const projectRepository =
    repository ?? createWorkspaceHyperFramesProjectRepository({ freecutProjectId })
  const selectionByProjectId = new Map<string, FreeCutStudioSelection | null>()

  const adapter: FreeCutStudioAdapter = {
    listProjects() {
      return projectRepository.listProjectRefs(freecutProjectId)
    },

    async listFiles(projectId) {
      const directory = requireDirectory(
        await projectRepository.readProjectDirectory(projectId),
        projectId,
      )
      return directory.files
        .map((file) => ({
          path: file.path,
          hash: file.hash,
          bytes: new TextEncoder().encode(file.content).byteLength,
        }))
        .sort((left, right) => left.path.localeCompare(right.path))
    },

    resolveProject(projectId) {
      return projectRepository.readProjectDirectory(projectId)
    },

    readFile(projectId, path) {
      return projectRepository.readFile(projectId, path)
    },

    async writeFile(projectId, path, content, patchMeta) {
      await projectRepository.writeFile(projectId, path, content, patchMeta)
      return { hash: hashHyperFramesText(content) }
    },

    async previewUrl(projectId, compositionPath) {
      const html = await projectRepository.readFile(projectId, compositionPath)
      if (html === undefined) {
        throw new Error(`HyperFrames composition file not found: ${compositionPath}`)
      }
      return dataUrlForHtml(html)
    },

    async lint(projectId, compositionPath) {
      const directory = requireDirectory(
        await projectRepository.readProjectDirectory(projectId),
        projectId,
      )
      const file = directory.files.find((entry) => entry.path === compositionPath)
      if (!file) {
        const diagnostic = missingCompositionDiagnostic(projectId, compositionPath)
        return resultFromDiagnostics([diagnostic])
      }
      const htmlLint = await lintAdapter.lintHtml(file.content, { filePath: compositionPath })
      const htmlResult = resultFromLintResult(htmlLint, compositionPath)
      const assetDiagnostics = lintDirectoryAssetReferences(
        directory,
        compositionPath,
        file.content,
      )
      return resultFromDiagnostics([...htmlResult.diagnostics, ...assetDiagnostics])
    },

    async getSelection(projectId) {
      return selectionByProjectId.get(projectId) ?? null
    },

    async updateSelection(projectId, selection) {
      selectionByProjectId.set(projectId, normalizeStudioSelection(selection))
    },

    async generateThumbnail(projectId, options = {}) {
      const directory = requireDirectory(
        await projectRepository.readProjectDirectory(projectId),
        projectId,
      )
      const width = options.width ?? directory.manifest.canvas.width
      const height = options.height ?? directory.manifest.canvas.height
      return {
        url: dataUrlForThumbnail(directory.manifest.title, width, height),
        width,
        height,
        generatedAt: Date.now(),
      }
    },

    async renderPreview(projectId, options) {
      const [previewUrl, lintResult] = await Promise.all([
        adapter.previewUrl(projectId, options.compositionPath),
        adapter.lint(projectId, options.compositionPath),
      ])
      return {
        ok: lintResult.ok && !lintResult.shouldBlockRender,
        previewUrl,
        diagnostics: lintResult.diagnostics,
      }
    },

    async startRender(projectId, options = {}) {
      const directory = requireDirectory(
        await projectRepository.readProjectDirectory(projectId),
        projectId,
      )
      const compositionPath = options.compositionPath ?? directory.manifest.activeCompositionPath
      const preview = await adapter.renderPreview(projectId, { compositionPath })
      return {
        id: `studio-render-${projectId}-${Date.now()}`,
        projectId,
        compositionPath,
        status: preview.ok ? 'queued' : 'blocked',
        createdAt: Date.now(),
        diagnostics: preview.diagnostics,
        previewUrl: preview.previewUrl,
      }
    },

    async generateWaveform(projectId, assetPath, options = {}) {
      const directory = requireDirectory(
        await projectRepository.readProjectDirectory(projectId),
        projectId,
      )
      const asset = directory.assets.find((entry) => entry.path === assetPath)
      if (!asset) {
        throw new Error(`HyperFrames audio asset not found: ${assetPath}`)
      }
      return {
        assetPath,
        peaks: waveformPeaksFromBytes(asset.bytes, normalizePeakCount(options.peakCount)),
        generatedAt: Date.now(),
        source: 'asset-bytes-placeholder',
      }
    },

    async listRegistryBlocks() {
      return []
    },

    createSnapshot(projectId, reason) {
      return projectRepository.createSnapshot(projectId, reason)
    },

    restoreSnapshot(projectId, snapshotId) {
      return projectRepository.restoreSnapshot(projectId, snapshotId)
    },

    writeManifest(projectId, manifest, patchMeta) {
      return projectRepository.writeManifest(projectId, manifest, patchMeta)
    },
  }

  return adapter
}
