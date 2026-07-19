import { describe, expect, it, vi } from 'vite-plus/test'
import type {
  HyperFramesIntegrationState,
  ModelCapabilityBinding,
  ModelProfile,
} from '@/types/hyperframes'
import { createModelRegistry } from '../modelRegistry'
import { createPrivateGatewayProvider } from './privateGatewayProvider'

const gatewayProfile: ModelProfile = {
  id: 'private-gateway-profile',
  name: 'Private Gateway',
  providerType: 'gateway',
  baseUrl: 'https://gateway.example.test/v1',
  apiKeyRef: 'team-secret:gateway-api-key',
  credentialScope: 'team-secret',
  defaultModel: 'gateway-agent',
  privacyMode: 'private-gateway',
  proxyRef: 'corp-proxy',
  enabled: true,
  customHeaders: [
    { name: 'x-freecut-org', value: 'org-1' },
    { name: 'x-gateway-secret', valueRef: 'team-secret:gateway-header', sensitive: true },
  ],
  models: [
    {
      id: 'gateway-agent',
      displayName: 'Gateway Agent',
      inputModalities: ['text', 'image', 'file'],
      outputModalities: ['text', 'json'],
      capabilities: ['code.hyperframes', 'vision.understanding', 'tool.calling'],
      latencyClass: 'balanced',
      privacyClass: 'private',
      supportsStructuredOutput: true,
      supportsToolCalls: true,
    },
  ],
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

function binding(
  input: Partial<ModelCapabilityBinding> & Pick<ModelCapabilityBinding, 'id' | 'capability'>,
): ModelCapabilityBinding {
  return {
    profileId: gatewayProfile.id,
    modelId: 'gateway-agent',
    quality: 'standard',
    enabled: true,
    ...input,
  }
}

function state(profile: ModelProfile): HyperFramesIntegrationState {
  return {
    schemaVersion: 1,
    projects: {},
    compositionLinks: {},
    renderCache: {},
    skills: {},
    modelProfiles: { [profile.id]: profile },
    modelCapabilityBindings: {
      code: binding({ id: 'code', capability: 'code.hyperframes' }),
      tools: binding({ id: 'tools', capability: 'tool.calling' }),
    },
    toolPolicies: {},
    renderConfig: {
      defaultEngine: 'hybrid-overlay',
      preferAlphaOverlay: true,
      cacheEnabled: true,
    },
  }
}

describe('privateGatewayProvider', () => {
  it('sends custom headers through a proxy with team policy headers', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ data: [{ id: 'gateway-agent' }] }))
    const provider = createPrivateGatewayProvider({
      teamPolicy: {
        id: 'team-policy-1',
        auditTag: 'audit-123',
        allowToolCalls: true,
        allowedBaseUrlHosts: ['gateway.example.test'],
        requireProxy: true,
      },
      fetch: fetchImpl,
      resolveApiKey: async () => 'gateway-api-key',
      resolveHeaderValueRef: async (valueRef) => `resolved:${valueRef}`,
      resolveProxyUrl: async (_proxyRef, url) =>
        `https://proxy.example.test/fetch?target=${encodeURIComponent(url)}`,
    })

    await expect(provider.validateConnection(gatewayProfile)).resolves.toMatchObject({
      ok: true,
      modelIds: ['gateway-agent'],
    })

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://proxy.example.test/fetch?target=https%3A%2F%2Fgateway.example.test%2Fv1%2Fmodels',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'Bearer gateway-api-key',
          'x-freecut-org': 'org-1',
          'x-gateway-secret': 'resolved:team-secret:gateway-header',
          'x-freecut-team-policy-id': 'team-policy-1',
          'x-freecut-audit-tag': 'audit-123',
        }),
      }),
    )
  })

  it('removes unsupported tool calling so routing can degrade', () => {
    const provider = createPrivateGatewayProvider({
      teamPolicy: {
        id: 'no-tools',
        allowToolCalls: false,
      },
      fetch: vi.fn(),
      resolveApiKey: async () => 'gateway-api-key',
    })
    const policyProfile = provider.applyTeamPolicy(gatewayProfile)
    const registry = createModelRegistry(state(policyProfile))

    const plan = registry.routeCapabilities([
      { capability: 'code.hyperframes', required: true },
      { capability: 'tool.calling', required: false },
    ])

    expect(policyProfile.models[0]?.supportsToolCalls).toBe(false)
    expect(policyProfile.models[0]?.capabilities).not.toContain('tool.calling')
    expect(plan.canProceed).toBe(true)
    expect(plan.routes.map((route) => route.requirement.capability)).toEqual(['code.hyperframes'])
    expect(plan.missing).toEqual([
      expect.objectContaining({
        capability: 'tool.calling',
        required: false,
        reason: 'Model does not declare the bound capability.',
      }),
    ])
  })

  it('blocks profiles outside team policy host and proxy requirements', async () => {
    const provider = createPrivateGatewayProvider({
      teamPolicy: {
        id: 'strict-team',
        allowToolCalls: true,
        allowedBaseUrlHosts: ['gateway.example.test'],
        requireProxy: true,
      },
      fetch: vi.fn(),
      resolveApiKey: async () => 'gateway-api-key',
    })

    await expect(
      provider.validateConnection({
        ...gatewayProfile,
        baseUrl: 'https://other.example.test/v1',
      }),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: 'bad-request' },
    })

    await expect(
      provider.validateConnection({
        ...gatewayProfile,
        proxyRef: undefined,
      }),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: 'missing-configuration' },
    })
  })
})
