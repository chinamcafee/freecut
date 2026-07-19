import type { HyperFramesDiagnostic, HyperFramesDiagnosticSeverity } from '@/types/hyperframes'
import {
  CSS_URL_RE,
  PATH_ATTRS,
  isNonRelativeUrl,
} from '../../upstream/parsers/assetReferencePrimitives.js'
import {
  maskNonScannableRanges,
} from '../../upstream/parsers/htmlAssetScanning.js'
import type { ParsedGsap } from '../../upstream/parsers/gsapSerialize.js'
import {
  parseGsapScriptAcorn,
  parseGsapScriptAcornForWrite,
} from '../../upstream/parsers/gsapParserAcorn.js'
import {
  updateAnimationInScript,
} from '../../upstream/parsers/gsapWriterAcorn.js'
import {
  ensureHfIds,
} from '../../upstream/parsers/hfIds.js'
import type { ParsedHtml } from '../../upstream/parsers/htmlParser.js'
import {
  parseHtml,
  updateElementInHtml,
  validateCompositionHtml,
} from '../../upstream/parsers/htmlParser.js'
import { DOMParser as LinkedomDOMParser } from 'linkedom'
import type { TimelineElement } from '../../upstream/parsers/types.js'
import { stableHyperFramesHash } from './project-signatures'

export type HyperFramesParserOperation =
  | 'html.parse'
  | 'html.validate'
  | 'html.update-element'
  | 'html.ensure-hf-ids'
  | 'gsap.parse'
  | 'gsap.update-animation'
  | 'assets.collect'

export interface HyperFramesParserContext {
  file?: string
  operation?: HyperFramesParserOperation
}

export interface HyperFramesParserResult<T> {
  ok: boolean
  value: T | null
  diagnostics: HyperFramesDiagnostic[]
}

export type HyperFramesGsapAnimationUpdate = Parameters<typeof updateAnimationInScript>[2]

export type HyperFramesAssetReferenceSource = 'attribute' | 'inline-style' | 'style-block'

export interface HyperFramesParsedAssetReference {
  path: string
  source: HyperFramesAssetReferenceSource
  attribute?: (typeof PATH_ATTRS)[number] | 'style'
  tagName?: string
  index: number
}

export interface HyperFramesParserAdapter {
  ensureStableHfIds(html: string, context?: HyperFramesParserContext): HyperFramesParserResult<string>
  parseHtml(html: string, context?: HyperFramesParserContext): HyperFramesParserResult<ParsedHtml>
  validateHtml(html: string, context?: HyperFramesParserContext): HyperFramesParserResult<void>
  updateHtmlElement(
    html: string,
    elementId: string,
    updates: Partial<TimelineElement>,
    context?: HyperFramesParserContext,
  ): HyperFramesParserResult<string>
  parseGsap(script: string, context?: HyperFramesParserContext): HyperFramesParserResult<ParsedGsap>
  updateGsapAnimation(
    script: string,
    animationId: string,
    updates: HyperFramesGsapAnimationUpdate,
    context?: HyperFramesParserContext,
  ): HyperFramesParserResult<string>
  collectAssetReferences(
    html: string,
    context?: HyperFramesParserContext,
  ): HyperFramesParserResult<HyperFramesParsedAssetReference[]>
}

type DomParserConstructor = typeof DOMParser

function withDomParser<T>(run: () => T): T {
  if (typeof globalThis.DOMParser !== 'undefined') {
    return run()
  }

  const globals = globalThis as typeof globalThis & { DOMParser?: DomParserConstructor }
  globals.DOMParser = LinkedomDOMParser as unknown as DomParserConstructor
  try {
    return run()
  } finally {
    Reflect.deleteProperty(globals, 'DOMParser')
  }
}

function ok<T>(value: T, diagnostics: HyperFramesDiagnostic[] = []): HyperFramesParserResult<T> {
  return {
    ok: diagnostics.every((diagnostic) => diagnostic.severity !== 'blocking'),
    value,
    diagnostics,
  }
}

function fail<T>(
  diagnostic: HyperFramesDiagnostic,
  diagnostics: HyperFramesDiagnostic[] = [],
): HyperFramesParserResult<T> {
  return {
    ok: false,
    value: null,
    diagnostics: [diagnostic, ...diagnostics],
  }
}

function diagnostic(
  code: string,
  severity: HyperFramesDiagnosticSeverity,
  message: string,
  context?: HyperFramesParserContext,
  error?: unknown,
): HyperFramesDiagnostic {
  const { line, column } = locationFromError(error)
  const file = context?.file
  return {
    id: `${code}:${stableHyperFramesHash({ code, file, message, line, column }).slice(0, 10)}`,
    severity,
    message,
    file,
    line,
    column,
  }
}

function locationFromError(error: unknown): { line?: number; column?: number } {
  const loc = (error as { loc?: { line?: unknown; column?: unknown } } | null)?.loc
  return {
    line: typeof loc?.line === 'number' ? loc.line : undefined,
    column: typeof loc?.column === 'number' ? loc.column : undefined,
  }
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

function parserFailure(
  code: string,
  operation: HyperFramesParserOperation,
  context: HyperFramesParserContext | undefined,
  error: unknown,
): HyperFramesDiagnostic {
  return diagnostic(
    code,
    'blocking',
    `${operation}: ${errorMessage(error, 'HyperFrames parser failed')}`,
    { ...context, operation },
    error,
  )
}

function validationDiagnostics(
  errors: string[],
  warnings: string[],
  context?: HyperFramesParserContext,
): HyperFramesDiagnostic[] {
  return [
    ...errors.map((message) =>
      diagnostic('hyperframes.parser.html.validation-error', 'blocking', message, context),
    ),
    ...warnings.map((message) =>
      diagnostic('hyperframes.parser.html.validation-warning', 'warning', message, context),
    ),
  ]
}

function collectStyleUrls(
  cssText: string,
  source: HyperFramesAssetReferenceSource,
  references: HyperFramesParsedAssetReference[],
): void {
  for (const match of cssText.matchAll(CSS_URL_RE)) {
    const value = match[2]
    if (!value || isNonRelativeUrl(value)) continue
    references.push({
      path: value,
      source,
      attribute: 'style',
      index: references.length,
    })
  }
}

export function createHyperFramesParserAdapter(): HyperFramesParserAdapter {
  return {
    ensureStableHfIds(html, context) {
      try {
        return ok(ensureHfIds(html))
      } catch (error) {
        return fail(parserFailure('hyperframes.parser.html.hf-ids-failed', 'html.ensure-hf-ids', context, error))
      }
    },

    parseHtml(html, context) {
      try {
        return ok(withDomParser(() => parseHtml(html)))
      } catch (error) {
        return fail(parserFailure('hyperframes.parser.html.parse-failed', 'html.parse', context, error))
      }
    },

    validateHtml(html, context) {
      try {
        const result = withDomParser(() => validateCompositionHtml(html))
        return ok(undefined, validationDiagnostics(result.errors, result.warnings, context))
      } catch (error) {
        return fail(
          parserFailure('hyperframes.parser.html.validation-failed', 'html.validate', context, error),
        )
      }
    },

    updateHtmlElement(html, elementId, updates, context) {
      try {
        const updated = withDomParser(() => updateElementInHtml(html, elementId, updates))
        if (updated === html) {
          return fail(
            diagnostic(
              'hyperframes.parser.html.element-not-found',
              'warning',
              `No HyperFrames HTML element matched "${elementId}"`,
              context,
            ),
          )
        }
        return ok(updated)
      } catch (error) {
        return fail(
          parserFailure('hyperframes.parser.html.update-element-failed', 'html.update-element', context, error),
        )
      }
    },

    parseGsap(script, context) {
      try {
        if (script.trim() && !parseGsapScriptAcornForWrite(script)) {
          return fail(
            diagnostic(
              'hyperframes.parser.gsap.syntax-error',
              'blocking',
              'GSAP script could not be parsed for editing',
              context,
            ),
          )
        }
        return ok(parseGsapScriptAcorn(script))
      } catch (error) {
        return fail(parserFailure('hyperframes.parser.gsap.parse-failed', 'gsap.parse', context, error))
      }
    },

    updateGsapAnimation(script, animationId, updates, context) {
      try {
        const parsed = parseGsapScriptAcornForWrite(script)
        if (!parsed) {
          return fail(
            diagnostic(
              'hyperframes.parser.gsap.syntax-error',
              'blocking',
              'GSAP script could not be parsed for editing',
              context,
            ),
          )
        }
        if (!parsed.located.some((entry) => entry.id === animationId)) {
          return fail(
            diagnostic(
              'hyperframes.parser.gsap.animation-not-found',
              'warning',
              `No GSAP animation matched "${animationId}"`,
              context,
            ),
          )
        }
        return ok(updateAnimationInScript(script, animationId, updates))
      } catch (error) {
        return fail(
          parserFailure('hyperframes.parser.gsap.update-animation-failed', 'gsap.update-animation', context, error),
        )
      }
    },

    collectAssetReferences(html, context) {
      try {
        const references: HyperFramesParsedAssetReference[] = []
        const masked = maskNonScannableRanges(html)
        const document = withDomParser(() => new DOMParser().parseFromString(masked, 'text/html'))
        const rawDocument = withDomParser(() => new DOMParser().parseFromString(html, 'text/html'))

        for (const element of Array.from(document.querySelectorAll('*'))) {
          const tagName = element.tagName.toLowerCase()
          for (const attr of PATH_ATTRS) {
            const value = element.getAttribute(attr)
            if (!value || isNonRelativeUrl(value)) continue
            references.push({
              path: value,
              source: 'attribute',
              attribute: attr,
              tagName,
              index: references.length,
            })
          }

          collectStyleUrls(element.getAttribute('style') ?? '', 'inline-style', references)
        }

        for (const style of Array.from(rawDocument.querySelectorAll('style'))) {
          collectStyleUrls(style.textContent ?? '', 'style-block', references)
        }

        return ok(references)
      } catch (error) {
        return fail(parserFailure('hyperframes.parser.assets.collect-failed', 'assets.collect', context, error))
      }
    },
  }
}

export const hyperFramesParserAdapter = createHyperFramesParserAdapter()
