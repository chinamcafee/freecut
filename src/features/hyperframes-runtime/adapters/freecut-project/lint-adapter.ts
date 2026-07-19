import type {
  HyperFramesDiagnostic,
  HyperFramesDiagnosticSeverity,
  HyperFramesDiagnosticStage,
  HyperFramesLintSummary,
  HyperFramesProjectDirectory,
} from '@/types/hyperframes'
import {
  lintHyperframeHtml,
  shouldBlockRender as shouldBlockHyperFramesRender,
} from '../../upstream/lint/browser.js'
import type {
  HyperframeLintFinding,
  HyperframeLintResult,
  HyperframeLintSeverity,
} from '../../upstream/lint/types.js'
import { hyperFramesParserAdapter } from './parser-adapter'
import { stableHyperFramesHash } from './project-signatures'

export type HyperFramesLintStage = HyperFramesDiagnosticStage

export interface HyperFramesLintOptions {
  stage: HyperFramesLintStage
  file?: string
  checkedAt?: number
  distributed?: boolean
  strictErrors?: boolean
  strictAll?: boolean
}

export interface HyperFramesProjectDirectoryLintOptions extends HyperFramesLintOptions {
  activeCompositionOnly?: boolean
}

export interface HyperFramesLintAdapterResult {
  ok: boolean
  shouldBlockRender: boolean
  summary: HyperFramesLintSummary
  diagnostics: HyperFramesDiagnostic[]
}

export interface HyperFramesLintAdapter {
  lintHtml(html: string, options: HyperFramesLintOptions): Promise<HyperFramesLintAdapterResult>
  lintProjectDirectory(
    directory: HyperFramesProjectDirectory,
    options: HyperFramesProjectDirectoryLintOptions,
  ): Promise<HyperFramesLintAdapterResult>
}

function mapSeverity(severity: HyperframeLintSeverity): HyperFramesDiagnosticSeverity {
  if (severity === 'error') return 'blocking'
  if (severity === 'warning') return 'warning'
  return 'suggestion'
}

export function mapHyperFrameLintFindingToDiagnostic(
  finding: HyperframeLintFinding,
  options: HyperFramesLintOptions,
): HyperFramesDiagnostic {
  const severity = mapSeverity(finding.severity)
  const file = finding.file ?? options.file
  const stage = options.stage
  const code = `hyperframes.lint.${finding.code}`

  return {
    id: `${code}:${stableHyperFramesHash({
      code,
      file,
      stage,
      selector: finding.selector,
      elementId: finding.elementId,
      message: finding.message,
    }).slice(0, 10)}`,
    code,
    source: 'lint',
    stage,
    severity,
    message: finding.message,
    file,
    selector: finding.selector,
    elementId: finding.elementId,
    snippet: finding.snippet,
    fixHint: finding.fixHint,
  }
}

function countDiagnostics(diagnostics: HyperFramesDiagnostic[]): {
  blockingCount: number
  warningCount: number
  suggestionCount: number
} {
  return diagnostics.reduce(
    (counts, diagnostic) => {
      if (diagnostic.severity === 'blocking') counts.blockingCount += 1
      else if (diagnostic.severity === 'warning') counts.warningCount += 1
      else counts.suggestionCount += 1
      return counts
    },
    { blockingCount: 0, warningCount: 0, suggestionCount: 0 },
  )
}

function resultFromDiagnostics(
  diagnostics: HyperFramesDiagnostic[],
  options: HyperFramesLintOptions,
): HyperFramesLintAdapterResult {
  const counts = countDiagnostics(diagnostics)
  const strictErrors = options.strictErrors ?? true
  const strictAll = options.strictAll ?? false
  const blocksRender = shouldBlockHyperFramesRender(
    strictErrors,
    strictAll,
    counts.blockingCount,
    counts.warningCount,
  )

  return {
    ok: counts.blockingCount === 0,
    shouldBlockRender: blocksRender,
    diagnostics,
    summary: {
      checkedAt: options.checkedAt ?? Date.now(),
      ...counts,
      diagnostics,
    },
  }
}

function mapLintResult(
  result: HyperframeLintResult,
  options: HyperFramesLintOptions,
): HyperFramesLintAdapterResult {
  return resultFromDiagnostics(
    result.findings.map((finding) => mapHyperFrameLintFindingToDiagnostic(finding, options)),
    options,
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
  const relative = clean.startsWith('/') ? clean.slice(1) : [dirname(filePath), clean].filter(Boolean).join('/')
  return normalizeProjectPath(relative)
}

function createMissingAssetDiagnostic(
  path: string,
  file: string,
  options: HyperFramesLintOptions,
): HyperFramesDiagnostic {
  return {
    id: `hyperframes.lint.missing_local_asset:${stableHyperFramesHash({
      path,
      file,
      stage: options.stage,
    }).slice(0, 10)}`,
    code: 'hyperframes.lint.missing_local_asset',
    source: 'lint',
    stage: options.stage,
    severity: 'blocking',
    message: `HyperFrames project file "${file}" references missing local asset "${path}".`,
    file,
    fixHint: 'Add the missing asset to the HyperFrames project directory or update the reference.',
  }
}

function lintDirectoryAssetReferences(
  directory: HyperFramesProjectDirectory,
  htmlFiles: Array<{ path: string; content: string }>,
  options: HyperFramesLintOptions,
): HyperFramesDiagnostic[] {
  const knownPaths = new Set([
    ...directory.files.map((file) => file.path),
    ...directory.assets.map((asset) => asset.path),
  ])
  const diagnostics: HyperFramesDiagnostic[] = []

  for (const file of htmlFiles) {
    const refs = hyperFramesParserAdapter.collectAssetReferences(file.content, { file: file.path })
    if (!refs.ok) {
      diagnostics.push(...refs.diagnostics.map((diagnostic) => ({ ...diagnostic, stage: options.stage })))
      continue
    }
    for (const reference of refs.value ?? []) {
      const resolved = resolveReferencePath(file.path, reference.path)
      if (!resolved || knownPaths.has(resolved)) continue
      diagnostics.push(createMissingAssetDiagnostic(reference.path, file.path, options))
    }
  }

  return diagnostics
}

function lintableHtmlFiles(
  directory: HyperFramesProjectDirectory,
  options: HyperFramesProjectDirectoryLintOptions,
): Array<{ path: string; content: string }> {
  const files = directory.files.filter((file) => file.path.endsWith('.html'))
  if (!options.activeCompositionOnly) return files
  return files.filter((file) => file.path === directory.manifest.activeCompositionPath)
}

export function createHyperFramesLintAdapter(): HyperFramesLintAdapter {
  return {
    async lintHtml(html, options) {
      const result = await lintHyperframeHtml(html, {
        filePath: options.file,
        distributed: options.distributed,
      })
      return mapLintResult(result, options)
    },

    async lintProjectDirectory(directory, options) {
      const htmlFiles = lintableHtmlFiles(directory, options)
      const diagnostics: HyperFramesDiagnostic[] = []

      for (const file of htmlFiles) {
        const result = await lintHyperframeHtml(file.content, {
          filePath: file.path,
          distributed: options.distributed,
        })
        diagnostics.push(
          ...result.findings.map((finding) =>
            mapHyperFrameLintFindingToDiagnostic(finding, { ...options, file: file.path }),
          ),
        )
      }

      diagnostics.push(...lintDirectoryAssetReferences(directory, htmlFiles, options))

      return resultFromDiagnostics(diagnostics, options)
    },
  }
}

export const hyperFramesLintAdapter = createHyperFramesLintAdapter()
