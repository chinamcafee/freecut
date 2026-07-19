import { describe, expect, it } from 'vite-plus/test'
import type {
  HyperFramesIntegrationState,
  ModelCapabilityBinding,
  ModelProfile,
  ToolPolicy,
} from '@/types/hyperframes'
import { DEFAULT_TOOL_POLICY } from '@/types/hyperframes'
import { createModelRegistry } from './modelRegistry'

const textProfile: ModelProfile = {
  id: 'cloud-text',
  name: 'Cloud text',
  providerType: 'cloud',
  baseUrl: 'https://cloud.example.test/v1',
  apiKeyRef: 'user-local:cloud-text',
  credentialScope: 'user-local',
  defaultModel: 'fast-text',
  privacyMode: 'cloud',
  enabled: true,
  models: [
    {
      id: 'fast-text',
      displayName: 'Fast Text',
      inputModalities: ['text'],
      outputModalities: ['text', 'json'],
      capabilities: ['text.planning', 'text.reasoning'],
      cost: { currency: 'USD', inputToken: 0.000001, outputToken: 0.000002 },
      latencyClass: 'fast',
      privacyClass: 'external',
      supportsStructuredOutput: true,
    },
  ],
}

const gatewayProfile: ModelProfile = {
  id: 'private-gateway',
  name: 'Private gateway',
  providerType: 'gateway',
  baseUrl: 'https://gateway.example.test/v1',
  apiKeyRef: 'team-secret:private-gateway',
  credentialScope: 'team-secret',
  defaultModel: 'agent-code',
  privacyMode: 'private-gateway',
  enabled: true,
  models: [
    {
      id: 'agent-code',
      displayName: 'Agent Code',
      inputModalities: ['text', 'image', 'file'],
      outputModalities: ['text', 'json'],
      capabilities: ['code.hyperframes', 'vision.understanding', 'tool.calling'],
      cost: { currency: 'USD', inputToken: 0.000002, outputToken: 0.000008 },
      latencyClass: 'balanced',
      privacyClass: 'private',
      supportsStructuredOutput: true,
      supportsToolCalls: true,
    },
  ],
}

const localProfile: ModelProfile = {
  id: 'local-audio',
  name: 'Local audio',
  providerType: 'freecut-built-in',
  defaultModel: 'freecut-transcriber',
  privacyMode: 'local',
  enabled: true,
  models: [
    {
      id: 'freecut-transcriber',
      displayName: 'FreeCut Transcriber',
      inputModalities: ['audio'],
      outputModalities: ['text', 'json'],
      capabilities: ['audio.transcription'],
      latencyClass: 'balanced',
      privacyClass: 'local',
    },
  ],
}

const confirmedToolPolicy: ToolPolicy = {
  ...DEFAULT_TOOL_POLICY,
  id: 'confirmed-tools',
  name: 'Confirmed tools',
  permissions: {
    ...DEFAULT_TOOL_POLICY.permissions,
    'source-files.read': { state: 'allowed' },
    'source-files.propose-write': { state: 'requires-confirmation' },
    'network.access': { state: 'requires-confirmation' },
  },
}

function binding(
  input: Partial<ModelCapabilityBinding> &
    Pick<ModelCapabilityBinding, 'id' | 'capability' | 'profileId' | 'modelId'>,
): ModelCapabilityBinding {
  return {
    quality: 'standard',
    enabled: true,
    ...input,
  }
}

function state(input: {
  profiles?: Record<string, ModelProfile>
  bindings?: Record<string, ModelCapabilityBinding>
  toolPolicies?: Record<string, ToolPolicy>
}): HyperFramesIntegrationState {
  return {
    schemaVersion: 1,
    projects: {},
    compositionLinks: {},
    renderCache: {},
    skills: {},
    modelProfiles: input.profiles ?? {},
    modelCapabilityBindings: input.bindings ?? {},
    toolPolicies: input.toolPolicies ?? {},
    renderConfig: {
      defaultEngine: 'hybrid-overlay',
      preferAlphaOverlay: true,
      cacheEnabled: true,
    },
  }
}

describe('modelRegistry', () => {
  it('routes different capabilities to different providers', () => {
    const registry = createModelRegistry(
      state({
        profiles: {
          [textProfile.id]: textProfile,
          [gatewayProfile.id]: gatewayProfile,
          [localProfile.id]: localProfile,
        },
        toolPolicies: {
          [confirmedToolPolicy.id]: confirmedToolPolicy,
        },
        bindings: {
          text: binding({
            id: 'text',
            capability: 'text.planning',
            profileId: textProfile.id,
            modelId: 'fast-text',
            quality: 'draft',
            maxCostPerTask: 0.05,
          }),
          code: binding({
            id: 'code',
            capability: 'code.hyperframes',
            profileId: gatewayProfile.id,
            modelId: 'agent-code',
            quality: 'high',
            maxCostPerTask: 0.5,
            toolPolicyId: confirmedToolPolicy.id,
          }),
          audio: binding({
            id: 'audio',
            capability: 'audio.transcription',
            profileId: localProfile.id,
            modelId: 'freecut-transcriber',
            quality: 'standard',
          }),
        },
      }),
    )

    const plan = registry.routeCapabilities([
      { capability: 'text.planning', quality: 'draft' },
      {
        capability: 'code.hyperframes',
        quality: 'high',
        requiredPermissions: ['source-files.propose-write'],
      },
      { capability: 'audio.transcription', privacyModes: ['local'] },
    ])

    expect(plan.canProceed).toBe(true)
    expect(plan.missing).toEqual([])
    expect(plan.requiresNetwork).toBe(true)
    expect(plan.requiresConfirmation).toBe(true)
    expect(
      plan.routes.map((route) => [route.requirement.capability, route.profile.providerType]),
    ).toEqual([
      ['text.planning', 'cloud'],
      ['code.hyperframes', 'gateway'],
      ['audio.transcription', 'freecut-built-in'],
    ])
  })

  it('uses fallback providers and reports blocked tool permissions', () => {
    const disabledGateway: ModelProfile = {
      ...gatewayProfile,
      enabled: false,
    }
    const localCode: ModelProfile = {
      ...gatewayProfile,
      id: 'local-code',
      name: 'Local code',
      providerType: 'local',
      baseUrl: 'http://127.0.0.1:11434/v1',
      privacyMode: 'local',
      enabled: true,
      models: [
        {
          ...gatewayProfile.models[0]!,
          id: 'local-code-model',
          capabilities: [
            'code.hyperframes',
            'vision.understanding',
            'tool.calling',
            'web.understanding',
          ],
          privacyClass: 'local',
        },
      ],
    }

    const registry = createModelRegistry(
      state({
        profiles: {
          [disabledGateway.id]: disabledGateway,
          [localCode.id]: localCode,
        },
        bindings: {
          code: binding({
            id: 'code',
            capability: 'code.hyperframes',
            profileId: disabledGateway.id,
            modelId: 'agent-code',
            quality: 'high',
            fallback: [{ profileId: localCode.id, modelId: 'local-code-model' }],
          }),
          web: binding({
            id: 'web',
            capability: 'web.understanding',
            profileId: localCode.id,
            modelId: 'local-code-model',
            quality: 'standard',
          }),
        },
      }),
    )

    const codeRoute = registry.selectCapability({
      capability: 'code.hyperframes',
      quality: 'high',
      privacyModes: ['local'],
    })

    expect('profile' in codeRoute ? codeRoute.profile.id : undefined).toBe('local-code')
    expect('profile' in codeRoute ? codeRoute.usedFallback : undefined).toBe(true)

    const webRoute = registry.selectCapability({
      capability: 'web.understanding',
      requiredPermissions: ['network.access'],
    })

    expect('reason' in webRoute ? webRoute.reason : undefined).toBe(
      'Tool permission denied: network.access.',
    )
  })
})
