import type {
  ModelCapability,
  ModelCapabilityBinding,
  ModelProfile,
  ModelProviderType,
} from '@/types/hyperframes'
import { OpenAICompatibleProviderError } from './openAICompatibleProvider'

export type LocalModelStatus = 'ready' | 'not-running' | 'misconfigured' | 'unsupported' | 'error'

export interface LocalModelHealth {
  ok: boolean
  status: LocalModelStatus
  profileId: string
  modelId?: string
  message: string
  endpoint?: string
  offlineAllowed?: boolean
}

export interface LocalCommandResult {
  exitCode: number
  stdout?: string
  stderr?: string
}

export interface LocalCommandCheck {
  command: string
  args: string[]
  timeoutMs: number
  profile: ModelProfile
}

export interface LocalModelProviderOptions {
  fetch?: typeof fetch
  runCommand?: (check: LocalCommandCheck) => Promise<LocalCommandResult>
  builtInStatus?: (modelId: string, profile: ModelProfile) => Promise<LocalModelHealth | undefined>
  defaultTimeoutMs?: number
}

export interface LocalModelProvider {
  id: 'local-model'
  displayName: string
  checkStatus(profile: ModelProfile): Promise<LocalModelHealth>
}

const DEFAULT_TIMEOUT_MS = 5_000

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '')
}

function profileModelId(profile: ModelProfile): string | undefined {
  return profile.defaultModel || profile.models[0]?.id
}

function healthPath(profile: ModelProfile): string {
  const path = profile.localRuntime?.healthPath ?? '/health'
  return path.startsWith('/') ? path : `/${path}`
}

function localEndpoint(profile: ModelProfile): string | undefined {
  return profile.localRuntime?.serviceUrl ?? profile.baseUrl ?? profile.endpoint
}

function createHealth(input: {
  profile: ModelProfile
  ok: boolean
  status: LocalModelStatus
  message: string
  endpoint?: string
}): LocalModelHealth {
  return {
    ok: input.ok,
    status: input.status,
    profileId: input.profile.id,
    modelId: profileModelId(input.profile),
    message: input.message,
    endpoint: input.endpoint,
    offlineAllowed:
      input.profile.localRuntime?.allowOffline ?? input.profile.providerType === 'freecut-built-in',
  }
}

function createTimeoutSignal(timeoutMs: number) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  return {
    signal: controller.signal,
    cleanup() {
      clearTimeout(timeoutId)
    },
  }
}

async function checkHttpStatus(
  profile: ModelProfile,
  fetchImpl: typeof fetch,
  timeoutMs: number,
): Promise<LocalModelHealth> {
  const endpoint = localEndpoint(profile)
  if (!endpoint) {
    return createHealth({
      profile,
      ok: false,
      status: 'misconfigured',
      message: 'Local model service URL is not configured.',
    })
  }

  const url = `${trimTrailingSlash(endpoint)}${healthPath(profile)}`
  const timeout = createTimeoutSignal(timeoutMs)
  try {
    const response = await fetchImpl(url, {
      method: 'GET',
      signal: timeout.signal,
    })
    if (response.ok) {
      return createHealth({
        profile,
        ok: true,
        status: 'ready',
        endpoint: url,
        message: 'Local model service is ready.',
      })
    }
    return createHealth({
      profile,
      ok: false,
      status: response.status === 404 ? 'not-running' : 'error',
      endpoint: url,
      message:
        response.status === 404
          ? 'Local model service health endpoint was not found.'
          : `Local model service returned HTTP ${response.status}.`,
    })
  } catch (error) {
    const isTimeout =
      (error instanceof Error && error.name === 'AbortError') ||
      (typeof error === 'object' &&
        error !== null &&
        'name' in error &&
        error.name === 'AbortError')
    return createHealth({
      profile,
      ok: false,
      status: 'not-running',
      endpoint: url,
      message: isTimeout
        ? 'Local model service did not respond before the timeout.'
        : 'Local model service is not running or cannot be reached.',
    })
  } finally {
    timeout.cleanup()
  }
}

async function checkCommandStatus(
  profile: ModelProfile,
  runCommand: LocalModelProviderOptions['runCommand'],
  timeoutMs: number,
): Promise<LocalModelHealth> {
  const command = profile.localRuntime?.command
  if (!command) {
    return createHealth({
      profile,
      ok: false,
      status: 'misconfigured',
      message: 'Local command is not configured.',
    })
  }
  if (!runCommand) {
    return createHealth({
      profile,
      ok: false,
      status: 'unsupported',
      message: 'Local command status check requires a command runner.',
    })
  }

  const result = await runCommand({
    command,
    args: profile.localRuntime?.commandArgs ?? [],
    timeoutMs,
    profile,
  })
  if (result.exitCode === 0) {
    return createHealth({
      profile,
      ok: true,
      status: 'ready',
      message: result.stdout || 'Local command model is ready.',
    })
  }
  return createHealth({
    profile,
    ok: false,
    status: 'not-running',
    message: result.stderr || result.stdout || 'Local command model is not running.',
  })
}

export function createLocalModelProvider(
  options: LocalModelProviderOptions = {},
): LocalModelProvider {
  const fetchImpl = options.fetch ?? fetch
  const defaultTimeoutMs = options.defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS

  return {
    id: 'local-model',
    displayName: 'Local model',
    async checkStatus(profile) {
      const timeoutMs = profile.timeoutPolicy?.timeoutMs ?? defaultTimeoutMs
      if (profile.providerType === 'freecut-built-in') {
        const builtIn = await options.builtInStatus?.(profile.defaultModel, profile)
        return (
          builtIn ??
          createHealth({
            profile,
            ok: true,
            status: 'ready',
            message: 'FreeCut built-in model capability is registered.',
          })
        )
      }
      if (profile.providerType !== 'local') {
        return createHealth({
          profile,
          ok: false,
          status: 'unsupported',
          message: 'Local model provider only supports local or FreeCut built-in profiles.',
        })
      }
      if (localEndpoint(profile)) return checkHttpStatus(profile, fetchImpl, timeoutMs)
      if (profile.localRuntime?.command) {
        return checkCommandStatus(profile, options.runCommand, timeoutMs)
      }
      throw new OpenAICompatibleProviderError(
        'missing-configuration',
        'Local profile requires serviceUrl, baseUrl, endpoint or command.',
      )
    },
  }
}

function builtInProfile(input: {
  id: string
  name: string
  modelId: string
  capability: ModelCapability
  inputModalities: ModelProfile['models'][number]['inputModalities']
  outputModalities: ModelProfile['models'][number]['outputModalities']
}): ModelProfile {
  return {
    id: input.id,
    name: input.name,
    providerType: 'freecut-built-in' satisfies ModelProviderType,
    defaultModel: input.modelId,
    privacyMode: 'local',
    enabled: true,
    localRuntime: {
      allowOffline: true,
    },
    models: [
      {
        id: input.modelId,
        displayName: input.name,
        inputModalities: input.inputModalities,
        outputModalities: input.outputModalities,
        capabilities: [input.capability],
        latencyClass: 'balanced',
        privacyClass: 'local',
      },
    ],
  }
}

export function createFreeCutBuiltInModelProfiles(): Record<string, ModelProfile> {
  const profiles = [
    builtInProfile({
      id: 'freecut-built-in-transcription',
      name: 'FreeCut local transcription',
      modelId: 'freecut-transcriber',
      capability: 'audio.transcription',
      inputModalities: ['audio', 'video'],
      outputModalities: ['text', 'json'],
    }),
    builtInProfile({
      id: 'freecut-built-in-embeddings',
      name: 'FreeCut local embeddings',
      modelId: 'freecut-embeddings',
      capability: 'embedding.retrieval',
      inputModalities: ['text', 'file'],
      outputModalities: ['json'],
    }),
    builtInProfile({
      id: 'freecut-built-in-voice',
      name: 'FreeCut local voice',
      modelId: 'freecut-voice',
      capability: 'audio.synthesis',
      inputModalities: ['text'],
      outputModalities: ['audio'],
    }),
    builtInProfile({
      id: 'freecut-built-in-music',
      name: 'FreeCut local music',
      modelId: 'freecut-music',
      capability: 'audio.music-generation',
      inputModalities: ['text', 'audio'],
      outputModalities: ['audio'],
    }),
  ]
  return Object.fromEntries(profiles.map((profile) => [profile.id, profile]))
}

export function createFreeCutBuiltInCapabilityBindings(): Record<string, ModelCapabilityBinding> {
  return Object.fromEntries(
    Object.values(createFreeCutBuiltInModelProfiles()).map((profile) => {
      const capability = profile.models[0]?.capabilities[0]
      if (!capability) throw new Error(`Built-in profile has no capability: ${profile.id}`)
      const binding: ModelCapabilityBinding = {
        id: `${profile.id}:${capability}`,
        capability,
        profileId: profile.id,
        modelId: profile.defaultModel,
        quality: 'standard',
        enabled: true,
      }
      return [binding.id, binding]
    }),
  )
}
