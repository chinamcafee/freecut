import {
  DEFAULT_HYPERFRAMES_RUNTIME_BOOTSTRAP_SRC,
  hyperFramesCoreRuntimeAdapter,
  type HyperFramesRuntimeInjectionOptions,
} from '../freecut-project/runtime-adapter'

export const HYPERFRAMES_PREVIEW_MESSAGE_SOURCE = 'hf-preview'
export const HYPERFRAMES_PREVIEW_PARENT_MESSAGE_SOURCE = 'hf-parent'
export const HYPERFRAMES_PREVIEW_SESSION_CONFIG_ID = '__hf_preview_session'

export type HyperFramesPreviewSandboxToken =
  | 'allow-downloads'
  | 'allow-forms'
  | 'allow-modals'
  | 'allow-orientation-lock'
  | 'allow-pointer-lock'
  | 'allow-popups'
  | 'allow-popups-to-escape-sandbox'
  | 'allow-presentation'
  | 'allow-same-origin'
  | 'allow-scripts'
  | 'allow-top-navigation'
  | 'allow-top-navigation-by-user-activation'

export interface HyperFramesPreviewSandboxOptions {
  tokens?: readonly HyperFramesPreviewSandboxToken[]
  debugLabel?: string
}

export interface HyperFramesPreviewResourcePolicy {
  allowInlineScripts?: boolean
  allowInlineStyles?: boolean
  allowEval?: boolean
  scriptSrc?: readonly string[]
  styleSrc?: readonly string[]
  imgSrc?: readonly string[]
  mediaSrc?: readonly string[]
  fontSrc?: readonly string[]
  connectSrc?: readonly string[]
  frameSrc?: readonly string[]
  workerSrc?: readonly string[]
}

export interface HyperFramesPreviewDocumentOptions {
  html: string
  projectId: string
  compositionPath: string
  runtime?: HyperFramesRuntimeInjectionOptions
  sandbox?: HyperFramesPreviewSandboxOptions
  resourcePolicy?: HyperFramesPreviewResourcePolicy
  sessionNonce?: string
  sandboxToken?: string
  messageSource?: string
}

export interface HyperFramesPreviewDocument {
  srcdoc: string
  sandbox: string
  csp: string
  projectId: string
  compositionPath: string
  sessionNonce: string
  sandboxToken?: string
  runtimeBootstrapSrc: string
  messageSource: string
  debugLabel?: string
}

export interface HyperFramesPreviewMessage {
  source: string
  type: string
  nonce: string
  projectId?: string
  compositionPath?: string
  frame?: number
  payload?: unknown
  sandboxToken?: string
}

export interface HyperFramesPreviewMessageValidationOptions {
  sessionNonce: string
  projectId?: string
  compositionPath?: string
  source?: string
  sandboxToken?: string
  expectedOrigin?: string | readonly string[]
  allowedTypes?: readonly string[]
}

export interface HyperFramesPreviewMessageValidationResult {
  ok: boolean
  message?: HyperFramesPreviewMessage
  reason?: string
}

const DEFAULT_SANDBOX_TOKENS: readonly HyperFramesPreviewSandboxToken[] = ['allow-scripts']

const DEFAULT_SCRIPT_SOURCES = ['self', 'blob:'] as const
const DEFAULT_STYLE_SOURCES = ['self'] as const
const DEFAULT_MEDIA_SOURCES = ['self', 'blob:', 'data:'] as const

function unique(values: readonly string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)))
}

function escapeHtmlAttribute(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function escapeScriptJson(value: unknown): string {
  return JSON.stringify(value)
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
    .replaceAll('&', '\\u0026')
    .replaceAll('\u2028', '\\u2028')
    .replaceAll('\u2029', '\\u2029')
}

function sourceExpression(value: string): string {
  if (value === 'self' || value === "'self'") return "'self'"
  if (value === 'none' || value === "'none'") return "'none'"
  if (value === 'unsafe-inline' || value === "'unsafe-inline'") return "'unsafe-inline'"
  if (value === 'unsafe-eval' || value === "'unsafe-eval'") return "'unsafe-eval'"
  if (value === 'blob:' || value === 'data:') return value

  try {
    const url = new URL(value, globalThis.location?.href ?? 'https://freecut.local/')
    if (url.origin === 'null') return value
    if (value.startsWith('/') || value.startsWith('./') || value.startsWith('../')) {
      return "'self'"
    }
    return url.origin
  } catch {
    return value.startsWith('/') ? "'self'" : value
  }
}

function runtimeCspSource(bootstrapSrc: string): string {
  if (!bootstrapSrc) return "'self'"
  return sourceExpression(bootstrapSrc)
}

function createNonce(): string {
  const bytes = new Uint8Array(16)
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes)
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

function createDirective(name: string, values: readonly string[]): string {
  return `${name} ${unique(values).join(' ')}`
}

export function createHyperFramesPreviewSandbox(
  options: HyperFramesPreviewSandboxOptions = {},
): string {
  return unique(options.tokens ?? DEFAULT_SANDBOX_TOKENS).sort().join(' ')
}

export function createHyperFramesPreviewCsp(
  runtimeBootstrapSrc = DEFAULT_HYPERFRAMES_RUNTIME_BOOTSTRAP_SRC,
  sessionNonce: string,
  policy: HyperFramesPreviewResourcePolicy = {},
): string {
  const scriptSources = [
    policy.allowInlineScripts ?? true ? "'unsafe-inline'" : `'nonce-${sessionNonce}'`,
    policy.allowEval ? "'unsafe-eval'" : '',
    ...DEFAULT_SCRIPT_SOURCES.map(sourceExpression),
    runtimeCspSource(runtimeBootstrapSrc),
    ...(policy.scriptSrc ?? []).map(sourceExpression),
  ]
  const styleSources = [
    policy.allowInlineStyles ?? true ? "'unsafe-inline'" : '',
    ...DEFAULT_STYLE_SOURCES.map(sourceExpression),
    ...(policy.styleSrc ?? []).map(sourceExpression),
  ]
  const imgSources = [
    ...DEFAULT_MEDIA_SOURCES.map(sourceExpression),
    ...(policy.imgSrc ?? []).map(sourceExpression),
  ]
  const mediaSources = [
    ...DEFAULT_MEDIA_SOURCES.map(sourceExpression),
    ...(policy.mediaSrc ?? []).map(sourceExpression),
  ]
  const fontSources = [
    ...DEFAULT_MEDIA_SOURCES.map(sourceExpression),
    ...(policy.fontSrc ?? []).map(sourceExpression),
  ]
  const connectSources =
    policy.connectSrc && policy.connectSrc.length > 0
      ? policy.connectSrc.map(sourceExpression)
      : ["'none'"]
  const frameSources =
    policy.frameSrc && policy.frameSrc.length > 0 ? policy.frameSrc.map(sourceExpression) : ["'none'"]
  const workerSources =
    policy.workerSrc && policy.workerSrc.length > 0
      ? policy.workerSrc.map(sourceExpression)
      : ["'none'"]

  return [
    "default-src 'none'",
    createDirective('script-src', scriptSources),
    createDirective('style-src', styleSources),
    createDirective('img-src', imgSources),
    createDirective('media-src', mediaSources),
    createDirective('font-src', fontSources),
    createDirective('connect-src', connectSources),
    createDirective('frame-src', frameSources),
    createDirective('worker-src', workerSources),
    "base-uri 'none'",
    "object-src 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join('; ')
}

function injectHeadMarkup(html: string, markup: string): string {
  const headClose = /<\/head>/i.exec(html)
  if (headClose && headClose.index >= 0) {
    return `${html.slice(0, headClose.index)}${markup}\n${html.slice(headClose.index)}`
  }

  const headOpen = /<head[^>]*>/i.exec(html)
  if (headOpen && headOpen.index >= 0) {
    const insertAt = headOpen.index + headOpen[0].length
    return `${html.slice(0, insertAt)}\n${markup}${html.slice(insertAt)}`
  }

  const htmlOpen = /<html[^>]*>/i.exec(html)
  if (htmlOpen && htmlOpen.index >= 0) {
    const insertAt = htmlOpen.index + htmlOpen[0].length
    return `${html.slice(0, insertAt)}\n<head>\n${markup}</head>${html.slice(insertAt)}`
  }

  return `<!doctype html>\n<html><head>\n${markup}</head><body>${html}</body></html>`
}

function createSessionScript(options: {
  projectId: string
  compositionPath: string
  sessionNonce: string
  sandboxToken?: string
  messageSource: string
}): string {
  const session = {
    projectId: options.projectId,
    compositionPath: options.compositionPath,
    nonce: options.sessionNonce,
    sandboxToken: options.sandboxToken,
    messageSource: options.messageSource,
  }

  return [
    `<script type="application/json" id="${HYPERFRAMES_PREVIEW_SESSION_CONFIG_ID}" data-hf-preview-session="true" nonce="${escapeHtmlAttribute(options.sessionNonce)}">${escapeScriptJson(session)}</script>`,
    `<script nonce="${escapeHtmlAttribute(options.sessionNonce)}">(() => {`,
    `const element = document.getElementById('${HYPERFRAMES_PREVIEW_SESSION_CONFIG_ID}');`,
    `const session = element ? JSON.parse(element.textContent || '{}') : {};`,
    `Object.defineProperty(window, '__HF_PREVIEW_SESSION__', { value: Object.freeze(session), configurable: false });`,
    `window.__hfPostPreviewMessage = (message) => window.parent.postMessage({ ...message, source: session.messageSource, projectId: session.projectId, compositionPath: session.compositionPath, nonce: session.nonce, sandboxToken: session.sandboxToken }, '*');`,
    `})();</script>`,
  ].join('')
}

export function createPreviewDocument(
  options: HyperFramesPreviewDocumentOptions,
): HyperFramesPreviewDocument {
  const sessionNonce = options.sessionNonce ?? createNonce()
  const messageSource = options.messageSource ?? HYPERFRAMES_PREVIEW_MESSAGE_SOURCE
  const runtimePlan = hyperFramesCoreRuntimeAdapter.createInjectionPlan({
    ...options.runtime,
    nonce: options.runtime?.nonce ?? sessionNonce,
  })
  const csp = createHyperFramesPreviewCsp(
    runtimePlan.bootstrapSrc,
    sessionNonce,
    options.resourcePolicy,
  )
  const headMarkup = [
    `<meta http-equiv="Content-Security-Policy" content="${escapeHtmlAttribute(csp)}">`,
    createSessionScript({
      projectId: options.projectId,
      compositionPath: options.compositionPath,
      sessionNonce,
      sandboxToken: options.sandboxToken,
      messageSource,
    }),
    runtimePlan.html,
  ].join('\n')

  return {
    srcdoc: injectHeadMarkup(options.html, headMarkup),
    sandbox: createHyperFramesPreviewSandbox(options.sandbox),
    csp,
    projectId: options.projectId,
    compositionPath: options.compositionPath,
    sessionNonce,
    sandboxToken: options.sandboxToken,
    runtimeBootstrapSrc: runtimePlan.bootstrapSrc,
    messageSource,
    debugLabel: options.sandbox?.debugLabel,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function messageEventData(input: MessageEvent<unknown> | { data: unknown; origin?: string }): {
  data: unknown
  origin?: string
} {
  return {
    data: input.data,
    origin: input.origin,
  }
}

function expectedOriginMatches(
  actual: string | undefined,
  expected: string | readonly string[] | undefined,
): boolean {
  if (!expected) return true
  const expectedList = Array.isArray(expected) ? expected : [expected]
  return actual !== undefined && expectedList.includes(actual)
}

export function validateHyperFramesPreviewMessage(
  input: MessageEvent<unknown> | { data: unknown; origin?: string },
  options: HyperFramesPreviewMessageValidationOptions,
): HyperFramesPreviewMessageValidationResult {
  const event = messageEventData(input)
  if (!expectedOriginMatches(event.origin, options.expectedOrigin)) {
    return { ok: false, reason: 'origin-mismatch' }
  }
  if (!isRecord(event.data)) {
    return { ok: false, reason: 'message-not-object' }
  }

  const source = event.data.source
  const type = event.data.type
  const nonce = event.data.nonce
  const projectId = event.data.projectId
  const compositionPath = event.data.compositionPath
  const sandboxToken = event.data.sandboxToken

  if (source !== (options.source ?? HYPERFRAMES_PREVIEW_MESSAGE_SOURCE)) {
    return { ok: false, reason: 'source-mismatch' }
  }
  if (typeof type !== 'string' || !type) {
    return { ok: false, reason: 'type-missing' }
  }
  if (options.allowedTypes && !options.allowedTypes.includes(type)) {
    return { ok: false, reason: 'type-not-allowed' }
  }
  if (nonce !== options.sessionNonce) {
    return { ok: false, reason: 'nonce-mismatch' }
  }
  if (options.projectId && projectId !== options.projectId) {
    return { ok: false, reason: 'project-mismatch' }
  }
  if (options.compositionPath && compositionPath !== options.compositionPath) {
    return { ok: false, reason: 'composition-mismatch' }
  }
  if (options.sandboxToken && sandboxToken !== options.sandboxToken) {
    return { ok: false, reason: 'sandbox-token-mismatch' }
  }

  return {
    ok: true,
    message: {
      source,
      type,
      nonce,
      projectId: typeof projectId === 'string' ? projectId : undefined,
      compositionPath: typeof compositionPath === 'string' ? compositionPath : undefined,
      frame: typeof event.data.frame === 'number' ? event.data.frame : undefined,
      payload: event.data.payload,
      sandboxToken: typeof sandboxToken === 'string' ? sandboxToken : undefined,
    },
  }
}
