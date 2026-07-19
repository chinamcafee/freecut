import { describe, expect, it, vi } from 'vite-plus/test'
import type { HyperFramesIntegrationState, ModelProfile } from '@/types/hyperframes'
import { createModelRegistry } from '../modelRegistry'
import {
  createFreeCutBuiltInCapabilityBindings,
  createFreeCutBuiltInModelProfiles,
  createLocalModelProvider,
} from './localModelProvider'

const localHttpProfile: ModelProfile = {
  id: 'local-http',
  name: 'Local HTTP model',
  providerType: 'local',
  baseUrl: 'http://127.0.0.1:11434',
  defaultModel: 'local-agent',
  privacyMode: 'local',
  enabled: true,
  timeoutPolicy: { timeoutMs: 100 },
  localRuntime: {
    serviceUrl: 'http://127.0.0.1:11434',
    healthPath: '/api/tags',
    modelFilePath: '/models/local-agent.gguf',
    minMemoryGb: 8,
    allowOffline: true,
  },
  models: [
    {
      id: 'local-agent',
      displayName: 'Local Agent',
      inputModalities: ['text'],
      outputModalities: ['text', 'json'],
      capabilities: ['text.reasoning', 'code.hyperframes'],
      latencyClass: 'slow',
      privacyClass: 'local',
    },
  ],
}

const localCommandProfile: ModelProfile = {
  ...localHttpProfile,
  id: 'local-command',
  name: 'Local command model',
  baseUrl: undefined,
  endpoint: undefined,
  defaultModel: 'command-agent',
  localRuntime: {
    command: 'local-model-cli',
    commandArgs: ['status'],
    allowOffline: true,
  },
  models: [
    {
      ...localHttpProfile.models[0]!,
      id: 'command-agent',
      displayName: 'Command Agent',
    },
  ],
}

function state(): HyperFramesIntegrationState {
  return {
    schemaVersion: 1,
    projects: {},
    compositionLinks: {},
    renderCache: {},
    skills: {},
    modelProfiles: createFreeCutBuiltInModelProfiles(),
    modelCapabilityBindings: createFreeCutBuiltInCapabilityBindings(),
    toolPolicies: {},
    renderConfig: {
      defaultEngine: 'hybrid-overlay',
      preferAlphaOverlay: true,
      cacheEnabled: true,
    },
  }
}

describe('localModelProvider', () => {
  it('reports local HTTP service as ready', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
    const provider = createLocalModelProvider({ fetch: fetchImpl })

    await expect(provider.checkStatus(localHttpProfile)).resolves.toEqual(
      expect.objectContaining({
        ok: true,
        status: 'ready',
        endpoint: 'http://127.0.0.1:11434/api/tags',
        offlineAllowed: true,
      }),
    )
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://127.0.0.1:11434/api/tags',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('reports local HTTP service as not running with a UI-readable message', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('connect ECONNREFUSED'))
    const provider = createLocalModelProvider({ fetch: fetchImpl })

    await expect(provider.checkStatus(localHttpProfile)).resolves.toEqual(
      expect.objectContaining({
        ok: false,
        status: 'not-running',
        message: 'Local model service is not running or cannot be reached.',
      }),
    )
  })

  it('checks local command providers through an injected runner', async () => {
    const runCommand = vi.fn().mockResolvedValue({ exitCode: 0, stdout: 'ready' })
    const provider = createLocalModelProvider({ runCommand })

    await expect(provider.checkStatus(localCommandProfile)).resolves.toEqual(
      expect.objectContaining({
        ok: true,
        status: 'ready',
        message: 'ready',
      }),
    )
    expect(runCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        command: 'local-model-cli',
        args: ['status'],
      }),
    )
  })

  it('registers FreeCut built-in capabilities for local routing', () => {
    const registry = createModelRegistry(state())
    const plan = registry.routeCapabilities([
      { capability: 'audio.transcription', privacyModes: ['local'] },
      { capability: 'embedding.retrieval', privacyModes: ['local'] },
      { capability: 'audio.synthesis', privacyModes: ['local'] },
      { capability: 'audio.music-generation', privacyModes: ['local'] },
    ])

    expect(plan.canProceed).toBe(true)
    expect(plan.missing).toEqual([])
    expect(plan.routes.map((route) => route.profile.providerType)).toEqual([
      'freecut-built-in',
      'freecut-built-in',
      'freecut-built-in',
      'freecut-built-in',
    ])
  })
})
