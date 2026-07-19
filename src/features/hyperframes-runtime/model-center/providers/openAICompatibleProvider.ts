import type { ModelProfile, ModelUnitCost } from '@/types/hyperframes'

export type OpenAICompatibleErrorCode =
  | 'missing-configuration'
  | 'timeout'
  | 'unauthorized'
  | 'rate-limited'
  | 'bad-request'
  | 'server-error'
  | 'network-error'
  | 'invalid-response'

export class OpenAICompatibleProviderError extends Error {
  constructor(
    public readonly code: OpenAICompatibleErrorCode,
    message: string,
    public readonly status?: number,
    public readonly retryAfterMs?: number,
  ) {
    super(message)
    this.name = 'OpenAICompatibleProviderError'
  }
}

export interface OpenAICompatibleMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface OpenAICompatibleJsonSchema {
  name: string
  schema: Record<string, unknown>
  strict?: boolean
}

export interface OpenAICompatibleTextRequest {
  profile: ModelProfile
  modelId?: string
  messages: OpenAICompatibleMessage[]
  temperature?: number
  maxOutputTokens?: number
  jsonSchema?: OpenAICompatibleJsonSchema
  timeoutMs?: number
  signal?: AbortSignal
}

export interface OpenAICompatibleTextResult {
  id?: string
  modelId: string
  content: string
  structuredOutput?: unknown
  usage?: {
    inputTokens?: number
    outputTokens?: number
    totalTokens?: number
    estimatedCost?: number
    currency?: string
  }
}

export interface OpenAICompatibleConnectionResult {
  ok: boolean
  modelIds: string[]
  error?: OpenAICompatibleProviderError
}

export interface OpenAICompatibleProviderOptions {
  fetch?: typeof fetch
  resolveApiKey?: (authRef: string, profile: ModelProfile) => Promise<string | undefined>
  resolveHeaderValueRef?: (valueRef: string, profile: ModelProfile) => Promise<string | undefined>
  resolveProxyUrl?: (
    proxyRef: string,
    url: string,
    profile: ModelProfile,
  ) => Promise<string> | string
  defaultHeaders?: Record<string, string>
  defaultTimeoutMs?: number
}

export interface OpenAICompatibleProvider {
  id: 'openai-compatible'
  displayName: string
  validateConnection(
    profile: ModelProfile,
    options?: { timeoutMs?: number; signal?: AbortSignal },
  ): Promise<OpenAICompatibleConnectionResult>
  invokeText(request: OpenAICompatibleTextRequest): Promise<OpenAICompatibleTextResult>
}

interface OpenAIModelsResponse {
  data?: Array<{ id?: string }>
}

interface OpenAIChatResponse {
  id?: string
  model?: string
  choices?: Array<{
    message?: {
      content?: string | null
    }
  }>
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
    total_tokens?: number
  }
}

const DEFAULT_TIMEOUT_MS = 30_000

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '')
}

function resolveBaseUrl(profile: ModelProfile): string {
  const baseUrl = profile.baseUrl ?? profile.endpoint
  if (!baseUrl) {
    throw new OpenAICompatibleProviderError(
      'missing-configuration',
      'OpenAI-compatible provider requires baseUrl or endpoint.',
    )
  }
  return trimTrailingSlash(baseUrl)
}

function resolveModelId(profile: ModelProfile, requestedModelId?: string): string {
  const modelId = requestedModelId ?? profile.defaultModel
  if (!modelId) {
    throw new OpenAICompatibleProviderError(
      'missing-configuration',
      'OpenAI-compatible provider requires modelId.',
    )
  }
  return modelId
}

function retryAfterMs(headers: Headers): number | undefined {
  const retryAfter = headers.get('retry-after')
  if (!retryAfter) return undefined
  const seconds = Number(retryAfter)
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000)
  const dateMs = Date.parse(retryAfter)
  if (!Number.isNaN(dateMs)) return Math.max(0, dateMs - Date.now())
  return undefined
}

function mapHttpError(
  status: number,
  bodyText: string,
  headers: Headers,
): OpenAICompatibleProviderError {
  if (status === 401 || status === 403) {
    return new OpenAICompatibleProviderError(
      'unauthorized',
      'OpenAI-compatible provider rejected the credential reference.',
      status,
    )
  }
  if (status === 408) {
    return new OpenAICompatibleProviderError(
      'timeout',
      'OpenAI-compatible provider request timed out.',
      status,
    )
  }
  if (status === 429) {
    return new OpenAICompatibleProviderError(
      'rate-limited',
      'OpenAI-compatible provider rate limit was reached.',
      status,
      retryAfterMs(headers),
    )
  }
  if (status >= 500) {
    return new OpenAICompatibleProviderError(
      'server-error',
      bodyText || 'OpenAI-compatible provider returned a server error.',
      status,
    )
  }
  return new OpenAICompatibleProviderError(
    'bad-request',
    bodyText || 'OpenAI-compatible provider rejected the request.',
    status,
  )
}

function mapThrownError(error: unknown): OpenAICompatibleProviderError {
  if (error instanceof OpenAICompatibleProviderError) return error
  if (
    (error instanceof Error && error.name === 'AbortError') ||
    (typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError')
  ) {
    return new OpenAICompatibleProviderError(
      'timeout',
      'OpenAI-compatible provider request timed out.',
    )
  }
  const message =
    error instanceof Error ? error.message : 'OpenAI-compatible provider request failed.'
  return new OpenAICompatibleProviderError('network-error', message)
}

function estimateCost(
  cost: ModelUnitCost | undefined,
  inputTokens?: number,
  outputTokens?: number,
) {
  if (!cost) return undefined
  const input = inputTokens && cost.inputToken ? inputTokens * cost.inputToken : 0
  const output = outputTokens && cost.outputToken ? outputTokens * cost.outputToken : 0
  const total = input + output
  return total > 0 ? total : undefined
}

async function resolveAuthorizationHeader(
  profile: ModelProfile,
  resolveApiKey?: OpenAICompatibleProviderOptions['resolveApiKey'],
): Promise<Record<string, string>> {
  const authRef = profile.apiKeyRef ?? profile.authRef
  if (!authRef) return {}
  const key = await resolveApiKey?.(authRef, profile)
  if (!key) {
    throw new OpenAICompatibleProviderError(
      'missing-configuration',
      `No credential is available for authRef: ${authRef}.`,
    )
  }
  return { Authorization: `Bearer ${key}` }
}

async function resolveCustomHeaders(
  profile: ModelProfile,
  resolveHeaderValueRef?: OpenAICompatibleProviderOptions['resolveHeaderValueRef'],
): Promise<Record<string, string>> {
  const headers: Record<string, string> = {}
  for (const header of profile.customHeaders ?? []) {
    if ('value' in header) {
      headers[header.name] = header.value
      continue
    }

    const value = await resolveHeaderValueRef?.(header.valueRef, profile)
    if (!value) {
      throw new OpenAICompatibleProviderError(
        'missing-configuration',
        `No header value is available for valueRef: ${header.valueRef}.`,
      )
    }
    headers[header.name] = value
  }
  return headers
}

function buildResponseFormat(schema?: OpenAICompatibleJsonSchema) {
  if (!schema) return undefined
  return {
    type: 'json_schema',
    json_schema: {
      name: schema.name,
      schema: schema.schema,
      strict: schema.strict ?? true,
    },
  }
}

function parseStructuredOutput(content: string, schema?: OpenAICompatibleJsonSchema): unknown {
  if (!schema) return undefined
  try {
    return JSON.parse(content)
  } catch (error) {
    throw new OpenAICompatibleProviderError(
      'invalid-response',
      error instanceof Error ? error.message : 'Structured model output was not valid JSON.',
    )
  }
}

function createTimeoutSignal(timeoutMs: number, signal?: AbortSignal) {
  const controller = new AbortController()
  let timeoutId: ReturnType<typeof setTimeout> | undefined

  const abort = () => controller.abort()
  if (signal?.aborted) abort()
  else signal?.addEventListener('abort', abort, { once: true })

  timeoutId = setTimeout(abort, timeoutMs)

  return {
    signal: controller.signal,
    cleanup() {
      if (timeoutId !== undefined) clearTimeout(timeoutId)
      signal?.removeEventListener('abort', abort)
    },
  }
}

async function readErrorBody(response: Response): Promise<string> {
  try {
    return await response.text()
  } catch {
    return ''
  }
}

export function createOpenAICompatibleProvider(
  options: OpenAICompatibleProviderOptions = {},
): OpenAICompatibleProvider {
  const fetchImpl = options.fetch ?? fetch
  const defaultTimeoutMs = options.defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS

  async function requestJson<T>(
    profile: ModelProfile,
    path: string,
    init: Omit<RequestInit, 'signal'>,
    timeoutMs: number,
    signal?: AbortSignal,
  ): Promise<T> {
    const baseUrl = resolveBaseUrl(profile)
    const requestUrl = `${baseUrl}${path}`
    const url =
      profile.proxyRef && options.resolveProxyUrl
        ? await options.resolveProxyUrl(profile.proxyRef, requestUrl, profile)
        : requestUrl
    const timeout = createTimeoutSignal(timeoutMs, signal)
    try {
      const authHeaders = await resolveAuthorizationHeader(profile, options.resolveApiKey)
      const customHeaders = await resolveCustomHeaders(profile, options.resolveHeaderValueRef)
      const response = await fetchImpl(url, {
        ...init,
        signal: timeout.signal,
        headers: {
          'content-type': 'application/json',
          ...options.defaultHeaders,
          ...customHeaders,
          ...authHeaders,
          ...init.headers,
        },
      })
      if (!response.ok)
        throw mapHttpError(response.status, await readErrorBody(response), response.headers)
      return (await response.json()) as T
    } catch (error) {
      throw mapThrownError(error)
    } finally {
      timeout.cleanup()
    }
  }

  return {
    id: 'openai-compatible',
    displayName: 'OpenAI-compatible',
    async validateConnection(profile, connectionOptions) {
      try {
        const data = await requestJson<OpenAIModelsResponse>(
          profile,
          '/models',
          { method: 'GET' },
          connectionOptions?.timeoutMs ?? profile.timeoutPolicy?.timeoutMs ?? defaultTimeoutMs,
          connectionOptions?.signal,
        )
        return {
          ok: true,
          modelIds:
            data.data?.map((model) => model.id).filter((id): id is string => Boolean(id)) ?? [],
        }
      } catch (error) {
        return {
          ok: false,
          modelIds: [],
          error: mapThrownError(error),
        }
      }
    },
    async invokeText(request) {
      const modelId = resolveModelId(request.profile, request.modelId)
      const descriptor = request.profile.models.find((model) => model.id === modelId)
      const data = await requestJson<OpenAIChatResponse>(
        request.profile,
        '/chat/completions',
        {
          method: 'POST',
          body: JSON.stringify({
            model: modelId,
            messages: request.messages,
            temperature: request.temperature,
            max_tokens: request.maxOutputTokens,
            response_format: buildResponseFormat(request.jsonSchema),
          }),
        },
        request.timeoutMs ?? request.profile.timeoutPolicy?.timeoutMs ?? defaultTimeoutMs,
        request.signal,
      )
      const content = data.choices?.[0]?.message?.content
      if (typeof content !== 'string') {
        throw new OpenAICompatibleProviderError(
          'invalid-response',
          'OpenAI-compatible provider response did not include text content.',
        )
      }
      return {
        id: data.id,
        modelId: data.model ?? modelId,
        content,
        structuredOutput: parseStructuredOutput(content, request.jsonSchema),
        usage: {
          inputTokens: data.usage?.prompt_tokens,
          outputTokens: data.usage?.completion_tokens,
          totalTokens: data.usage?.total_tokens,
          estimatedCost: estimateCost(
            descriptor?.cost,
            data.usage?.prompt_tokens,
            data.usage?.completion_tokens,
          ),
          currency: descriptor?.cost?.currency,
        },
      }
    },
  }
}
