import {
  validateHyperFramesPreviewMessage,
  type HyperFramesPreviewMessage,
} from '../../adapters/freecut-preview'

export const HYPERFRAMES_RUNTIME_MESSAGE_TYPES = [
  'ready',
  'state',
  'timeline',
  'stage-size',
  'shader-transition-state',
  'media-autoplay-blocked',
  'diagnostic',
  'element-hovered',
  'element-pick-candidates',
  'element-picked',
  'element-picked-many',
  'pick-mode-cancelled',
  'analytics',
  'perf',
] as const

export type HyperFramesRuntimeMessageType = (typeof HYPERFRAMES_RUNTIME_MESSAGE_TYPES)[number]

export interface HyperFramesRuntimeMessage extends HyperFramesPreviewMessage {
  type: HyperFramesRuntimeMessageType
}

export interface HyperFramesRuntimeMessageValidationOptions {
  sessionNonce: string
  projectId?: string
  compositionPath?: string
  sandboxToken?: string
  expectedOrigin?: string | readonly string[]
  sourceWindow?: Window | null
  allowedTypes?: readonly HyperFramesRuntimeMessageType[]
}

export type HyperFramesRuntimeMessageRejectionReason =
  | 'source-window-mismatch'
  | 'message-not-object'
  | 'source-mismatch'
  | 'type-missing'
  | 'type-not-allowed'
  | 'nonce-mismatch'
  | 'project-mismatch'
  | 'composition-mismatch'
  | 'sandbox-token-mismatch'
  | 'origin-mismatch'
  | 'payload-schema-mismatch'

export type HyperFramesRuntimeMessageValidationResult =
  | { ok: true; message: HyperFramesRuntimeMessage }
  | { ok: false; reason: HyperFramesRuntimeMessageRejectionReason }

export interface HyperFramesRuntimeMessageEvent {
  message: HyperFramesRuntimeMessage
  nativeEvent: MessageEvent<unknown>
}

export interface HyperFramesRuntimeMessageRejectedEvent {
  reason: HyperFramesRuntimeMessageRejectionReason
  nativeEvent: MessageEvent<unknown>
}

type MessageLike = MessageEvent<unknown> | {
  data: unknown
  origin?: string
  source?: MessageEventSource | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isPositiveFiniteNumber(value: unknown): value is number {
  return isFiniteNumber(value) && value > 0
}

function isRuntimeMessageType(value: string): value is HyperFramesRuntimeMessageType {
  return HYPERFRAMES_RUNTIME_MESSAGE_TYPES.includes(value as HyperFramesRuntimeMessageType)
}

function hasValidArray(value: unknown): boolean {
  return Array.isArray(value)
}

function hasOptionalRecord(value: unknown): boolean {
  return value === undefined || isRecord(value)
}

function validateKnownRuntimePayload(type: HyperFramesRuntimeMessageType, data: Record<string, unknown>): boolean {
  switch (type) {
    case 'ready':
    case 'media-autoplay-blocked':
    case 'pick-mode-cancelled':
      return true
    case 'state':
      return isFiniteNumber(data.frame) && typeof data.isPlaying === 'boolean'
    case 'timeline':
      return (
        isPositiveFiniteNumber(data.durationSeconds) &&
        isPositiveFiniteNumber(data.durationInFrames) &&
        hasValidArray(data.clips) &&
        hasValidArray(data.scenes) &&
        (data.compositionWidth === undefined || isPositiveFiniteNumber(data.compositionWidth)) &&
        (data.compositionHeight === undefined || isPositiveFiniteNumber(data.compositionHeight))
      )
    case 'stage-size':
      return isPositiveFiniteNumber(data.width) && isPositiveFiniteNumber(data.height)
    case 'shader-transition-state':
      return hasOptionalRecord(data.state)
    case 'diagnostic':
      return typeof data.code === 'string' && data.code.length > 0 && hasOptionalRecord(data.details)
    case 'element-hovered':
    case 'element-picked':
      return isRecord(data.elementInfo)
    case 'element-pick-candidates':
      return hasValidArray(data.candidates) && isFiniteNumber(data.selectedIndex) && isRecord(data.point)
    case 'element-picked-many':
      return hasValidArray(data.elementInfos)
    case 'analytics':
      return typeof data.event === 'string' && data.event.length > 0 && isPlainRecord(data.properties)
    case 'perf':
      return typeof data.name === 'string' && data.name.length > 0 && isFiniteNumber(data.value) && isPlainRecord(data.tags)
  }
}

function sourceWindowMatches(input: MessageLike, sourceWindow: Window | null | undefined): boolean {
  if (!sourceWindow) return true
  if (!('source' in input)) return true
  return input.source === sourceWindow
}

export function isHyperFramesRuntimeMessageCandidate(data: unknown): boolean {
  return isRecord(data) && data.source === 'hf-preview'
}

export function validateHyperFramesRuntimeMessage(
  input: MessageLike,
  options: HyperFramesRuntimeMessageValidationOptions,
): HyperFramesRuntimeMessageValidationResult {
  if (!sourceWindowMatches(input, options.sourceWindow)) {
    return { ok: false, reason: 'source-window-mismatch' }
  }

  const base = validateHyperFramesPreviewMessage(input, {
    sessionNonce: options.sessionNonce,
    projectId: options.projectId,
    compositionPath: options.compositionPath,
    sandboxToken: options.sandboxToken,
    expectedOrigin: options.expectedOrigin,
    allowedTypes: options.allowedTypes ?? HYPERFRAMES_RUNTIME_MESSAGE_TYPES,
  })

  if (!base.ok) {
    return { ok: false, reason: base.reason as HyperFramesRuntimeMessageRejectionReason }
  }

  if (!base.message || !isRuntimeMessageType(base.message.type)) {
    return { ok: false, reason: 'type-not-allowed' }
  }
  if (!isRecord(input.data) || !validateKnownRuntimePayload(base.message.type, input.data)) {
    return { ok: false, reason: 'payload-schema-mismatch' }
  }

  return {
    ok: true,
    message: {
      ...base.message,
      type: base.message.type,
    },
  }
}
