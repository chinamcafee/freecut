import { describe, expect, it, vi } from 'vite-plus/test'
import type { ModelProfile } from '@/types/hyperframes'
import {
  createOpenAICompatibleProvider,
  OpenAICompatibleProviderError,
} from './openAICompatibleProvider'

const profile: ModelProfile = {
  id: 'cloud-openai-compatible',
  name: 'Cloud OpenAI-compatible',
  providerType: 'cloud',
  baseUrl: 'https://models.example.test/v1/',
  apiKeyRef: 'user-local:openai-compatible',
  credentialScope: 'user-local',
  defaultModel: 'agent-json',
  privacyMode: 'cloud',
  enabled: true,
  timeoutPolicy: { timeoutMs: 5000 },
  models: [
    {
      id: 'agent-json',
      displayName: 'Agent JSON',
      inputModalities: ['text'],
      outputModalities: ['text', 'json'],
      capabilities: ['text.planning', 'code.hyperframes'],
      cost: {
        currency: 'USD',
        inputToken: 0.001,
        outputToken: 0.002,
      },
      latencyClass: 'fast',
      privacyClass: 'external',
      supportsStructuredOutput: true,
    },
  ],
}

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
    ...init,
  })
}

describe('openAICompatibleProvider', () => {
  it('validates connection with baseUrl and apiKeyRef', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ data: [{ id: 'agent-json' }] }))
    const provider = createOpenAICompatibleProvider({
      fetch: fetchImpl,
      resolveApiKey: async (authRef) => `resolved:${authRef}`,
    })

    await expect(provider.validateConnection(profile)).resolves.toEqual({
      ok: true,
      modelIds: ['agent-json'],
    })

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://models.example.test/v1/models',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'Bearer resolved:user-local:openai-compatible',
        }),
      }),
    )
  })

  it('invokes chat completions with structured output schema', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        id: 'chatcmpl-1',
        model: 'agent-json',
        choices: [{ message: { content: '{"plan":["write html"]}' } }],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15,
        },
      }),
    )
    const provider = createOpenAICompatibleProvider({
      fetch: fetchImpl,
      resolveApiKey: async () => 'secret-in-memory-only',
    })

    const result = await provider.invokeText({
      profile,
      messages: [{ role: 'user', content: 'Plan a HyperFrames scene.' }],
      jsonSchema: {
        name: 'generation_plan',
        schema: {
          type: 'object',
          properties: { plan: { type: 'array', items: { type: 'string' } } },
          required: ['plan'],
        },
      },
    })

    const request = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body)) as {
      model: string
      response_format: { type: string; json_schema: { name: string; strict: boolean } }
    }
    expect(request).toEqual(
      expect.objectContaining({
        model: 'agent-json',
        response_format: {
          type: 'json_schema',
          json_schema: expect.objectContaining({
            name: 'generation_plan',
            strict: true,
          }),
        },
      }),
    )
    expect(result).toEqual(
      expect.objectContaining({
        modelId: 'agent-json',
        structuredOutput: { plan: ['write html'] },
        usage: expect.objectContaining({
          inputTokens: 10,
          outputTokens: 5,
          estimatedCost: 0.02,
          currency: 'USD',
        }),
      }),
    )
  })

  it('maps unauthorized and rate limit responses', async () => {
    const unauthorizedProvider = createOpenAICompatibleProvider({
      fetch: vi.fn().mockResolvedValue(jsonResponse({ error: 'unauthorized' }, { status: 401 })),
      resolveApiKey: async () => 'bad-key',
    })
    await expect(unauthorizedProvider.validateConnection(profile)).resolves.toMatchObject({
      ok: false,
      error: { code: 'unauthorized', status: 401 },
    })

    const rateLimitedProvider = createOpenAICompatibleProvider({
      fetch: vi.fn().mockResolvedValue(
        jsonResponse(
          { error: 'rate limited' },
          {
            status: 429,
            headers: { 'retry-after': '2' },
          },
        ),
      ),
      resolveApiKey: async () => 'busy-key',
    })

    await expect(
      rateLimitedProvider.invokeText({
        profile,
        messages: [{ role: 'user', content: 'hello' }],
      }),
    ).rejects.toMatchObject({
      code: 'rate-limited',
      status: 429,
      retryAfterMs: 2000,
    })
  })

  it('maps timeout through AbortController', async () => {
    vi.useFakeTimers()
    const fetchImpl = vi.fn(
      (_url: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'))
          })
        }),
    )
    const provider = createOpenAICompatibleProvider({
      fetch: fetchImpl,
      resolveApiKey: async () => 'slow-key',
    })

    const result = provider.validateConnection(profile, { timeoutMs: 10 })
    await vi.advanceTimersByTimeAsync(10)

    await expect(result).resolves.toMatchObject({
      ok: false,
      error: { code: 'timeout' },
    })
    vi.useRealTimers()
  })

  it('does not expose plaintext keys in mapped provider errors', async () => {
    const provider = createOpenAICompatibleProvider({
      fetch: vi.fn(),
      resolveApiKey: async () => undefined,
    })

    const result = await provider.validateConnection(profile)

    expect(result.error).toBeInstanceOf(OpenAICompatibleProviderError)
    expect(JSON.stringify(result)).not.toContain('sk-')
    expect(JSON.stringify(result)).not.toContain('Bearer ')
  })
})
