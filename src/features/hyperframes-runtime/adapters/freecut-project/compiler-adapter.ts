import type {
  HyperFramesDiagnostic,
  HyperFramesProjectDirectory,
} from '@/types/hyperframes'
import {
  injectScriptsIntoHtml,
  parseHTMLContent,
} from '../../upstream/core/compiler/htmlDocument.js'
import {
  compileTimingAttrs,
  injectDurations,
  type ResolvedDuration,
  type UnresolvedElement,
} from '../../upstream/core/compiler/timingCompiler.js'
import {
  inlineSubCompositions,
  type InlineSubCompositionsResult,
} from '../../upstream/core/compiler/inlineSubCompositions.js'
import {
  parseHostVariableValues,
  readDeclaredDefaults,
} from '../../upstream/core/runtime/getVariables.js'
import {
  hyperFramesCoreRuntimeAdapter,
  type HyperFramesRuntimeInjectionOptions,
} from './runtime-adapter'
import { stableHyperFramesHash } from './project-signatures'

export interface HyperFramesCompilerOptions {
  activeCompositionPath?: string
  runtime?: HyperFramesRuntimeInjectionOptions
  injectRuntime?: boolean
}

export interface HyperFramesCompilerResult {
  ok: boolean
  html: string | null
  diagnostics: HyperFramesDiagnostic[]
  unresolved: UnresolvedElement[]
  inlinedCompositionCount: number
  variablesByComposition: Record<string, Record<string, unknown>>
}

export interface HyperFramesCompilerAdapter {
  createPreviewHtml(
    directory: HyperFramesProjectDirectory,
    options?: HyperFramesCompilerOptions,
  ): Promise<HyperFramesCompilerResult>
}

function dirname(path: string): string {
  const index = path.lastIndexOf('/')
  return index > 0 ? path.slice(0, index) : ''
}

function stripUrlQuery(path: string): string {
  return path.split(/[?#]/, 1)[0] ?? ''
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

function resolveProjectReference(fromFile: string, reference: string): string | null {
  const clean = stripUrlQuery(reference.trim())
  if (!clean || /^[a-z][a-z0-9+.-]*:/i.test(clean) || clean.startsWith('//')) return null
  const relative = clean.startsWith('/') ? clean.slice(1) : [dirname(fromFile), clean].filter(Boolean).join('/')
  return normalizeProjectPath(relative)
}

function serializeDocument(doc: Document): string {
  const root = doc.documentElement?.outerHTML ?? doc.body?.innerHTML ?? ''
  return root.trimStart().toLowerCase().startsWith('<!doctype') ? root : `<!doctype html>\n${root}`
}

function escapeHtmlAttribute(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function styleTags(styles: readonly string[]): string {
  return styles.map((style) => `<style>${style.replaceAll('</style', '<\\/style')}</style>`).join('\n')
}

function linkTags(links: InlineSubCompositionsResult['externalLinks']): string {
  return links
    .map((link) => {
      const attrs = [
        `rel="${escapeHtmlAttribute(link.rel)}"`,
        `href="${escapeHtmlAttribute(link.href)}"`,
        link.crossorigin ? `crossorigin="${escapeHtmlAttribute(link.crossorigin)}"` : null,
      ]
        .filter(Boolean)
        .join(' ')
      return `<link ${attrs}>`
    })
    .join('\n')
}

function injectHeadMarkup(html: string, markup: string): string {
  if (!markup) return html
  if (html.includes('</head>')) {
    return html.replace('</head>', () => `${markup}\n</head>`)
  }
  if (html.includes('<body')) {
    return html.replace('<body', () => `${markup}\n<body`)
  }
  return `${markup}\n${html}`
}

function diagnostic(
  code: string,
  severity: HyperFramesDiagnostic['severity'],
  message: string,
  file?: string,
): HyperFramesDiagnostic {
  return {
    id: `${code}:${stableHyperFramesHash({ code, severity, message, file }).slice(0, 10)}`,
    code,
    source: 'runtime',
    stage: 'preview',
    severity,
    message,
    file,
  }
}

function fileMap(directory: HyperFramesProjectDirectory): Map<string, string> {
  return new Map(directory.files.map((file) => [file.path, file.content]))
}

function assetDurationSeconds(
  directory: HyperFramesProjectDirectory,
  assetPath: string,
  fps: number,
): number | null {
  const ref = directory.manifest.assets.find((asset) => asset.path === assetPath)
  if (!ref?.durationInFrames) return null
  return ref.durationInFrames / fps
}

function resolveMediaDurations(
  unresolved: UnresolvedElement[],
  directory: HyperFramesProjectDirectory,
  activeFile: string,
): ResolvedDuration[] {
  const fps = directory.manifest.canvas.fps || 30
  const resolved: ResolvedDuration[] = []

  for (const element of unresolved) {
    if ((element.tagName !== 'video' && element.tagName !== 'audio') || !element.src) continue
    const assetPath = resolveProjectReference(activeFile, element.src)
    if (!assetPath) continue
    const duration = assetDurationSeconds(directory, assetPath, fps)
    if (duration === null) continue
    const effective = Math.max(0, duration - element.mediaStart)
    if (effective > 0) {
      resolved.push({ id: element.id, duration: effective })
    }
  }

  return resolved
}

export function createHyperFramesCompilerAdapter(): HyperFramesCompilerAdapter {
  return {
    async createPreviewHtml(directory, options = {}) {
      const activePath = options.activeCompositionPath ?? directory.manifest.activeCompositionPath
      const files = fileMap(directory)
      const activeHtml = files.get(activePath)
      const diagnostics: HyperFramesDiagnostic[] = []

      if (!activeHtml) {
        return {
          ok: false,
          html: null,
          diagnostics: [
            diagnostic(
              'hyperframes.compiler.active-composition-missing',
              'blocking',
              `Active HyperFrames composition "${activePath}" was not found in the project directory.`,
              activePath,
            ),
          ],
          unresolved: [],
          inlinedCompositionCount: 0,
          variablesByComposition: {},
        }
      }

      const timing = compileTimingAttrs(activeHtml)
      const durations = resolveMediaDurations(timing.unresolved, directory, activePath)
      const withDurations = durations.length > 0 ? injectDurations(timing.html, durations) : timing.html
      const doc = parseHTMLContent(withDurations)
      const hosts = Array.from(doc.querySelectorAll('[data-composition-src]'))
      const inlineResult = inlineSubCompositions(doc, hosts, {
        resolveHtml: (srcPath) => {
          const resolved = resolveProjectReference(activePath, srcPath)
          if (!resolved) return null
          return files.get(resolved) ?? null
        },
        parseHtml: parseHTMLContent,
        rewriteInlineStyles: true,
        readVariableDefaults: readDeclaredDefaults,
        parseHostVariables: parseHostVariableValues,
        onMissingComposition: (srcPath, reason) => {
          diagnostics.push(
            diagnostic(
              'hyperframes.compiler.sub-composition-missing',
              'warning',
              reason
                ? `Sub-composition "${srcPath}" was skipped: ${reason}.`
                : `Sub-composition "${srcPath}" was not found.`,
              activePath,
            ),
          )
        },
      })

      let html = serializeDocument(doc)
      html = injectHeadMarkup(
        html,
        [linkTags(inlineResult.externalLinks), styleTags(inlineResult.styles)].filter(Boolean).join('\n'),
      )
      html = injectScriptsIntoHtml(html, [], inlineResult.scripts, false)

      if (options.injectRuntime ?? false) {
        html = hyperFramesCoreRuntimeAdapter.injectIntoHtml(html, {
          ...options.runtime,
          variables: directory.manifest.variables ?? options.runtime?.variables,
          variablesByComposition: {
            ...inlineResult.variablesByComp,
            ...options.runtime?.variablesByComposition,
          },
          fps: options.runtime?.fps ?? directory.manifest.canvas.fps,
        })
      }

      return {
        ok: diagnostics.every((item) => item.severity !== 'blocking'),
        html,
        diagnostics,
        unresolved: timing.unresolved,
        inlinedCompositionCount: hosts.length - diagnostics.length,
        variablesByComposition: inlineResult.variablesByComp,
      }
    },
  }
}

export const hyperFramesCompilerAdapter = createHyperFramesCompilerAdapter()
