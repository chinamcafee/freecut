import type {
  HyperFramesDiagnostic,
  HyperFramesDiagnosticStage,
} from '@/types/hyperframes'
import type { CompositionVariable } from '../../upstream/core/core.types.js'
import { applyVariableBindings } from '../../upstream/core/runtime/applyVariableBindings.js'
import {
  installRuntimeControlBridge,
  setRuntimeProtocolFps,
} from '../../upstream/core/runtime/bridge.js'
import {
  TransportClock,
  type AudioClockSource,
  type TransportClockSnapshot,
} from '../../upstream/core/runtime/clock.js'
import { injectCompositionCssVariables, getVariables } from '../../upstream/core/runtime/getVariables.js'
import {
  refreshRuntimeMediaCache,
  syncRuntimeMedia,
  type RuntimeMediaClip,
} from '../../upstream/core/runtime/media.js'
import {
  runtimeProtocolMetadata,
  type RuntimeProtocolV1,
} from '../../upstream/core/runtime/protocol.js'
import {
  formatVariableValidationIssue,
  validateVariables as validateRuntimeVariables,
  type VariableValidationIssue,
} from '../../upstream/core/runtime/validateVariables.js'
import { stableHyperFramesHash } from './project-signatures'

export const DEFAULT_HYPERFRAMES_RUNTIME_BOOTSTRAP_SRC = '/hyperframes-runtime/core/runtime.js'

export interface HyperFramesRuntimeGlobalsOptions {
  targetWindow?: Window
  variables?: Record<string, unknown>
  variablesByComposition?: Record<string, Record<string, unknown>>
  timelines?: Record<string, unknown>
  fps?: number
}

export interface HyperFramesRuntimeInjectionOptions {
  bootstrapSrc?: string
  configId?: string
  nonce?: string
  integrity?: string
  variables?: Record<string, unknown>
  variablesByComposition?: Record<string, Record<string, unknown>>
  fps?: number
}

export interface HyperFramesRuntimeInjectionPlan {
  protocol: RuntimeProtocolV1
  configId: string
  bootstrapSrc: string
  configScript: string
  bootstrapScript: string
  html: string
}

export interface HyperFramesRuntimeVariableValidationOptions {
  file?: string
  stage?: HyperFramesDiagnosticStage
}

export interface HyperFramesRuntimeVariableValidationResult {
  ok: boolean
  issues: VariableValidationIssue[]
  diagnostics: HyperFramesDiagnostic[]
}

export type HyperFramesTransportClockOptions = ConstructorParameters<typeof TransportClock>[0]
export type HyperFramesRuntimeMediaCacheOptions = Parameters<typeof refreshRuntimeMediaCache>[0]
export type HyperFramesRuntimeMediaSyncOptions = Parameters<typeof syncRuntimeMedia>[0]
export type HyperFramesRuntimeControlBridgeDeps = Parameters<typeof installRuntimeControlBridge>[0]
export type HyperFramesRuntimeControlBridgeCleanup = ReturnType<typeof installRuntimeControlBridge>

export interface HyperFramesCoreRuntimeAdapter {
  installGlobals(options?: HyperFramesRuntimeGlobalsOptions): void
  applyVariables(doc?: Document): void
  validateVariables(
    values: Record<string, unknown>,
    declarations: readonly CompositionVariable[],
    options?: HyperFramesRuntimeVariableValidationOptions,
  ): HyperFramesRuntimeVariableValidationResult
  createClock(options?: HyperFramesTransportClockOptions): TransportClock
  attachAudioClock(clock: TransportClock, source: AudioClockSource): TransportClockSnapshot
  refreshMediaCache(options?: HyperFramesRuntimeMediaCacheOptions): ReturnType<typeof refreshRuntimeMediaCache>
  syncMedia(options: HyperFramesRuntimeMediaSyncOptions): void
  installControlBridge(
    deps: HyperFramesRuntimeControlBridgeDeps,
    options?: { fps?: number },
  ): HyperFramesRuntimeControlBridgeCleanup
  createInjectionPlan(options?: HyperFramesRuntimeInjectionOptions): HyperFramesRuntimeInjectionPlan
  injectIntoHtml(html: string, options?: HyperFramesRuntimeInjectionOptions): string
}

type HyperFramesRuntimeWindow = Window & {
  __hfVariables?: Record<string, unknown>
  __hfVariablesByComp?: Record<string, Record<string, unknown>>
  __hyperframes?: Record<string, unknown>
  __timelines?: Record<string, unknown>
  __HF_EXPORT_RENDER_SEEK_CONFIG?: {
    fps: number
    fpsSource: 'render-options' | 'default'
  }
}

function escapeScriptJson(value: unknown): string {
  return JSON.stringify(value)
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
    .replaceAll('&', '\\u0026')
    .replaceAll('\u2028', '\\u2028')
    .replaceAll('\u2029', '\\u2029')
}

function escapeHtmlAttribute(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function variableDiagnostic(
  issue: VariableValidationIssue,
  options: HyperFramesRuntimeVariableValidationOptions | undefined,
): HyperFramesDiagnostic {
  const stage = options?.stage ?? 'preview'
  const file = options?.file
  const code = `hyperframes.runtime.variable.${issue.kind}`
  const message = formatVariableValidationIssue(issue)

  return {
    id: `${code}:${stableHyperFramesHash({ code, file, stage, issue }).slice(0, 10)}`,
    code,
    source: 'runtime',
    stage,
    severity: 'blocking',
    message,
    file,
  }
}

function createScriptAttributes(attributes: Record<string, string | undefined>): string {
  return Object.entries(attributes)
    .filter((entry): entry is [string, string] => entry[1] !== undefined)
    .map(([name, value]) => `${name}="${escapeHtmlAttribute(value)}"`)
    .join(' ')
}

export function createHyperFramesCoreRuntimeAdapter(): HyperFramesCoreRuntimeAdapter {
  return {
    installGlobals(options = {}) {
      const target = (options.targetWindow ?? window) as HyperFramesRuntimeWindow
      const fps = Number.isFinite(options.fps) && options.fps && options.fps > 0 ? options.fps : 30

      target.__hfVariables = options.variables ?? target.__hfVariables ?? {}
      target.__hfVariablesByComp =
        options.variablesByComposition ?? target.__hfVariablesByComp ?? {}
      target.__timelines = options.timelines ?? target.__timelines ?? {}
      target.__hyperframes = {
        ...target.__hyperframes,
        getVariables,
      }
      target.__HF_EXPORT_RENDER_SEEK_CONFIG = {
        fps,
        fpsSource: options.fps ? 'render-options' : 'default',
      }
      setRuntimeProtocolFps(fps)
    },

    applyVariables(doc = document) {
      injectCompositionCssVariables(doc)
      applyVariableBindings(doc)
    },

    validateVariables(values, declarations, options) {
      const issues = validateRuntimeVariables(values, declarations)
      return {
        ok: issues.length === 0,
        issues,
        diagnostics: issues.map((issue) => variableDiagnostic(issue, options)),
      }
    },

    createClock(options) {
      return new TransportClock(options)
    },

    attachAudioClock(clock, source) {
      clock.attachAudioSource(source)
      return clock.snapshot()
    },

    refreshMediaCache(options) {
      return refreshRuntimeMediaCache(options)
    },

    syncMedia(options) {
      syncRuntimeMedia(options)
    },

    installControlBridge(deps, options) {
      setRuntimeProtocolFps(options?.fps ?? 30)
      return installRuntimeControlBridge(deps)
    },

    createInjectionPlan(options = {}) {
      const fps = Number.isFinite(options.fps) && options.fps && options.fps > 0 ? options.fps : 30
      const protocol = runtimeProtocolMetadata(fps)
      const configId = options.configId ?? '__hf_runtime_config'
      const bootstrapSrc = options.bootstrapSrc ?? DEFAULT_HYPERFRAMES_RUNTIME_BOOTSTRAP_SRC
      const configScript = `<script ${createScriptAttributes({
        type: 'application/json',
        id: configId,
        'data-hf-runtime-config': 'true',
        nonce: options.nonce,
      })}>${escapeScriptJson({
        protocol,
        variables: options.variables ?? {},
        variablesByComposition: options.variablesByComposition ?? {},
      })}</script>`
      const bootstrapScript = `<script ${createScriptAttributes({
        type: 'module',
        src: bootstrapSrc,
        integrity: options.integrity,
        nonce: options.nonce,
        'data-hf-runtime-bootstrap': 'core',
        'data-hf-runtime-config-id': configId,
      })}></script>`

      return {
        protocol,
        configId,
        bootstrapSrc,
        configScript,
        bootstrapScript,
        html: `${configScript}\n${bootstrapScript}`,
      }
    },

    injectIntoHtml(html, options) {
      const injection = this.createInjectionPlan(options).html
      const headClose = /<\/head>/i.exec(html)
      if (!headClose || headClose.index < 0) {
        return `${injection}\n${html}`
      }
      return `${html.slice(0, headClose.index)}${injection}\n${html.slice(headClose.index)}`
    },
  }
}

export const hyperFramesCoreRuntimeAdapter = createHyperFramesCoreRuntimeAdapter()

export type { RuntimeMediaClip }
