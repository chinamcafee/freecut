import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  DEFAULT_MATERIAL_SCOPE,
  DEFAULT_TOOL_POLICY,
  type MaterialScope,
  type ModelCapabilityBinding,
  type ModelDescriptor,
  type ModelProfile,
  type ModelProviderType,
  type ToolPolicy,
} from '@/types/hyperframes'
import type { BudgetPolicy } from './costEstimator'
import type { CredentialMetadata, CredentialScope } from './credentialStore'

export interface HyperFramesModelCenterSettings {
  profiles: Record<string, ModelProfile>
  activeProfileId: string
  capabilityBindings: Record<string, ModelCapabilityBinding>
  toolPolicies: Record<string, ToolPolicy>
  credentials: Record<string, CredentialMetadata>
  budgetPolicy: BudgetPolicy
  updatedAt: number
}

interface HyperFramesModelCenterActions {
  setActiveProfileId: (profileId: string) => void
  upsertModelProfile: (profile: ModelProfile) => void
  updateModelProfile: (profileId: string, patch: Partial<ModelProfile>) => void
  updateModelDescriptor: (
    profileId: string,
    modelId: string,
    patch: Partial<ModelDescriptor>,
  ) => void
  upsertCapabilityBinding: (binding: ModelCapabilityBinding) => void
  updateToolPolicy: (policyId: string, patch: Partial<ToolPolicy>) => void
  upsertCredentialMetadata: (
    ref: string,
    metadata: Omit<CredentialMetadata, 'ref' | 'createdAt'> & { createdAt?: number },
  ) => void
  deleteCredentialMetadata: (ref: string) => void
  updateBudgetPolicy: (patch: Partial<BudgetPolicy>) => void
  resetModelCenter: () => void
}

export type HyperFramesModelCenterStore = HyperFramesModelCenterSettings &
  HyperFramesModelCenterActions

const NOW = 1784304000000

function createModel(
  id: string,
  displayName: string,
  patch: Partial<ModelDescriptor>,
): ModelDescriptor {
  return {
    id,
    displayName,
    inputModalities: ['text'],
    outputModalities: ['text', 'json'],
    capabilities: ['text.planning'],
    latencyClass: 'balanced',
    privacyClass: 'external',
    supportsStructuredOutput: true,
    ...patch,
  }
}

export function createStarterModelProfile(
  providerType: ModelProviderType,
  id = `hyperframes-${providerType}-${crypto.randomUUID()}`,
): ModelProfile {
  if (providerType === 'gateway') {
    return {
      id,
      name: 'Private gateway',
      providerType: 'gateway',
      baseUrl: 'https://gateway.example.internal/v1',
      endpoint: '/chat/completions',
      authRef: 'team-secret:hyperframes-gateway',
      credentialScope: 'team-secret',
      defaultModel: 'team-multimodal',
      models: [
        createModel('team-multimodal', 'Team multimodal model', {
          inputModalities: ['text', 'image', 'audio', 'file'],
          capabilities: [
            'text.planning',
            'code.hyperframes',
            'vision.understanding',
            'audio.transcription',
            'web.understanding',
          ],
          privacyClass: 'private',
          cost: {
            currency: 'USD',
            inputToken: 0.0004,
            outputToken: 0.0012,
            image: 0.004,
            audioMinute: 0.01,
            request: 0.001,
          },
        }),
      ],
      rateLimit: {
        requestsPerMinute: 60,
        tokensPerMinute: 120000,
        dailyBudget: 25,
        projectBudget: 100,
      },
      timeoutPolicy: {
        timeoutMs: 30000,
        retryCount: 1,
        retryBackoffMs: 1000,
      },
      customHeaders: [
        {
          name: 'x-freecut-team',
          valueRef: 'team-secret:hyperframes-team-header',
          sensitive: true,
        },
      ],
      proxyRef: 'team-secret:hyperframes-proxy',
      auditTag: 'freecut-hyperframes',
      privacyMode: 'private-gateway',
      enabled: false,
    }
  }

  if (providerType === 'local') {
    return {
      id,
      name: 'Local HTTP model',
      providerType: 'local',
      baseUrl: 'http://127.0.0.1:11434/v1',
      endpoint: '/chat/completions',
      credentialScope: 'none',
      defaultModel: 'local-hyperframes',
      models: [
        createModel('local-hyperframes', 'Local HyperFrames model', {
          inputModalities: ['text', 'image'],
          capabilities: ['text.planning', 'code.hyperframes', 'vision.understanding'],
          cost: { currency: 'USD', request: 0 },
          latencyClass: 'slow',
          privacyClass: 'local',
        }),
      ],
      localRuntime: {
        serviceUrl: 'http://127.0.0.1:11434',
        healthPath: '/api/tags',
        allowOffline: true,
      },
      timeoutPolicy: {
        timeoutMs: 5000,
        retryCount: 0,
      },
      privacyMode: 'local',
      enabled: true,
    }
  }

  if (providerType === 'freecut-built-in') {
    return {
      id,
      name: 'FreeCut built-in local models',
      providerType: 'freecut-built-in',
      credentialScope: 'none',
      defaultModel: 'freecut-transcription',
      models: [
        createModel('freecut-transcription', 'FreeCut transcription', {
          inputModalities: ['audio'],
          capabilities: ['audio.transcription'],
          cost: { currency: 'USD', audioMinute: 0 },
          privacyClass: 'local',
        }),
      ],
      localRuntime: {
        allowOffline: true,
      },
      privacyMode: 'local',
      enabled: true,
    }
  }

  return {
    id,
    name: 'OpenAI-compatible cloud',
    providerType: 'cloud',
    baseUrl: 'https://api.openai-compatible.example/v1',
    endpoint: '/chat/completions',
    apiKeyRef: 'user-local:openai-compatible',
    credentialScope: 'user-local',
    defaultModel: 'cloud-hyperframes',
    models: [
      createModel('cloud-hyperframes', 'Cloud HyperFrames model', {
        inputModalities: ['text', 'image', 'audio', 'file'],
        capabilities: [
          'text.planning',
          'code.hyperframes',
          'vision.understanding',
          'audio.transcription',
          'tool.calling',
        ],
        cost: {
          currency: 'USD',
          inputToken: 0.0003,
          outputToken: 0.001,
          image: 0.003,
          audioMinute: 0.008,
          request: 0.001,
        },
        latencyClass: 'fast',
        privacyClass: 'external',
        supportsToolCalls: true,
      }),
    ],
    rateLimit: {
      requestsPerMinute: 120,
      tokensPerMinute: 200000,
      dailyBudget: 20,
      projectBudget: 75,
    },
    timeoutPolicy: {
      timeoutMs: 30000,
      retryCount: 2,
      retryBackoffMs: 1000,
    },
    privacyMode: 'cloud',
    enabled: false,
  }
}

function cloneToolPolicy(policy: ToolPolicy): ToolPolicy {
  return {
    ...policy,
    permissions: { ...policy.permissions },
    materialScope: { ...policy.materialScope },
    allowedNetworkHosts: policy.allowedNetworkHosts ? [...policy.allowedNetworkHosts] : undefined,
  }
}

export function createDefaultHyperFramesModelCenterSettings(): HyperFramesModelCenterSettings {
  const cloud = createStarterModelProfile('cloud', 'cloud-openai-compatible')
  const gateway = createStarterModelProfile('gateway', 'private-gateway')
  const local = createStarterModelProfile('local', 'local-http')
  const builtIn = createStarterModelProfile('freecut-built-in', 'freecut-built-in')
  const conservativePolicy = cloneToolPolicy(DEFAULT_TOOL_POLICY)
  const privatePolicy: ToolPolicy = {
    ...cloneToolPolicy(DEFAULT_TOOL_POLICY),
    id: 'private-gateway-policy',
    name: 'Private gateway policy',
    networkMode: 'allowlisted',
    allowedNetworkHosts: ['gateway.example.internal'],
    permissions: {
      ...DEFAULT_TOOL_POLICY.permissions,
      'network.access': { state: 'requires-confirmation' },
      'source-files.read': { state: 'allowed' },
      'source-files.propose-write': { state: 'requires-confirmation' },
    },
  }

  return {
    profiles: {
      [cloud.id]: cloud,
      [gateway.id]: gateway,
      [local.id]: local,
      [builtIn.id]: builtIn,
    },
    activeProfileId: cloud.id,
    capabilityBindings: {
      'text.planning:standard': {
        id: 'text.planning:standard',
        capability: 'text.planning',
        profileId: cloud.id,
        modelId: cloud.defaultModel,
        fallback: [{ profileId: local.id, modelId: local.defaultModel }],
        quality: 'standard',
        maxCostPerTask: 0.5,
        requiresConfirmationAboveCost: 0.25,
        toolPolicyId: conservativePolicy.id,
        materialScope: DEFAULT_MATERIAL_SCOPE,
        enabled: true,
      },
      'code.hyperframes:high': {
        id: 'code.hyperframes:high',
        capability: 'code.hyperframes',
        profileId: gateway.id,
        modelId: gateway.defaultModel,
        fallback: [{ profileId: cloud.id, modelId: cloud.defaultModel }],
        quality: 'high',
        maxCostPerTask: 1,
        requiresConfirmationAboveCost: 0.35,
        toolPolicyId: privatePolicy.id,
        materialScope: DEFAULT_MATERIAL_SCOPE,
        enabled: true,
      },
      'audio.transcription:draft': {
        id: 'audio.transcription:draft',
        capability: 'audio.transcription',
        profileId: builtIn.id,
        modelId: builtIn.defaultModel,
        quality: 'draft',
        maxCostPerTask: 0,
        requiresConfirmationAboveCost: 0,
        toolPolicyId: conservativePolicy.id,
        materialScope: DEFAULT_MATERIAL_SCOPE,
        enabled: true,
      },
    },
    toolPolicies: {
      [conservativePolicy.id]: conservativePolicy,
      [privatePolicy.id]: privatePolicy,
    },
    credentials: {
      'user-local:openai-compatible': {
        ref: 'user-local:openai-compatible',
        scope: 'user-local',
        label: 'OpenAI-compatible API key',
        createdAt: NOW,
      },
      'team-secret:hyperframes-gateway': {
        ref: 'team-secret:hyperframes-gateway',
        scope: 'team-secret',
        label: 'Private gateway key',
        createdAt: NOW,
      },
    },
    budgetPolicy: {
      currency: 'USD',
      maxCostPerTask: 1,
      projectBudgetRemaining: 75,
      userBudgetRemaining: 20,
      teamBudgetRemaining: 100,
      dailyBudgetRemaining: 10,
      confirmationThreshold: 0.25,
    },
    updatedAt: NOW,
  }
}

function withUpdatedAt(settings: Partial<HyperFramesModelCenterSettings>) {
  return { ...settings, updatedAt: Date.now() }
}

function mergeSettings(
  persisted: Partial<HyperFramesModelCenterSettings> | undefined,
): HyperFramesModelCenterSettings {
  const defaults = createDefaultHyperFramesModelCenterSettings()
  if (!persisted) return defaults

  const profiles = { ...defaults.profiles, ...persisted.profiles }
  const activeProfileId =
    persisted.activeProfileId && profiles[persisted.activeProfileId]
      ? persisted.activeProfileId
      : defaults.activeProfileId

  return {
    ...defaults,
    ...persisted,
    profiles,
    activeProfileId,
    capabilityBindings: {
      ...defaults.capabilityBindings,
      ...persisted.capabilityBindings,
    },
    toolPolicies: {
      ...defaults.toolPolicies,
      ...persisted.toolPolicies,
    },
    credentials: {
      ...defaults.credentials,
      ...persisted.credentials,
    },
    budgetPolicy: {
      ...defaults.budgetPolicy,
      ...persisted.budgetPolicy,
    },
  }
}

export const useHyperFramesModelCenterStore = create<HyperFramesModelCenterStore>()(
  persist(
    (set) => ({
      ...createDefaultHyperFramesModelCenterSettings(),

      setActiveProfileId: (profileId) =>
        set((state) =>
          state.profiles[profileId] ? withUpdatedAt({ activeProfileId: profileId }) : state,
        ),

      upsertModelProfile: (profile) =>
        set((state) =>
          withUpdatedAt({
            profiles: { ...state.profiles, [profile.id]: profile },
            activeProfileId: state.profiles[state.activeProfileId]
              ? state.activeProfileId
              : profile.id,
          }),
        ),

      updateModelProfile: (profileId, patch) =>
        set((state) => {
          const profile = state.profiles[profileId]
          if (!profile) return state
          const nextProfile = { ...profile, ...patch }
          return withUpdatedAt({
            profiles: { ...state.profiles, [profileId]: nextProfile },
          })
        }),

      updateModelDescriptor: (profileId, modelId, patch) =>
        set((state) => {
          const profile = state.profiles[profileId]
          if (!profile) return state
          const models = profile.models.map((model) =>
            model.id === modelId ? { ...model, ...patch } : model,
          )
          return withUpdatedAt({
            profiles: {
              ...state.profiles,
              [profileId]: {
                ...profile,
                models,
              },
            },
          })
        }),

      upsertCapabilityBinding: (binding) =>
        set((state) =>
          withUpdatedAt({
            capabilityBindings: { ...state.capabilityBindings, [binding.id]: binding },
          }),
        ),

      updateToolPolicy: (policyId, patch) =>
        set((state) => {
          const policy = state.toolPolicies[policyId]
          if (!policy) return state
          return withUpdatedAt({
            toolPolicies: {
              ...state.toolPolicies,
              [policyId]: {
                ...policy,
                ...patch,
                permissions: patch.permissions ?? policy.permissions,
                materialScope:
                  (patch.materialScope as MaterialScope | undefined) ?? policy.materialScope,
              },
            },
          })
        }),

      upsertCredentialMetadata: (ref, metadata) =>
        set((state) => {
          const existing = state.credentials[ref]
          const createdAt = existing?.createdAt ?? metadata.createdAt ?? Date.now()
          return withUpdatedAt({
            credentials: {
              ...state.credentials,
              [ref]: {
                ref,
                scope: metadata.scope,
                label: metadata.label,
                createdAt,
                updatedAt: existing ? Date.now() : undefined,
                expiresAt: metadata.expiresAt,
              },
            },
          })
        }),

      deleteCredentialMetadata: (ref) =>
        set((state) => {
          const { [ref]: _deleted, ...credentials } = state.credentials
          return withUpdatedAt({ credentials })
        }),

      updateBudgetPolicy: (patch) =>
        set((state) =>
          withUpdatedAt({
            budgetPolicy: { ...state.budgetPolicy, ...patch },
          }),
        ),

      resetModelCenter: () => set(createDefaultHyperFramesModelCenterSettings()),
    }),
    {
      name: 'freecut-hyperframes-model-center',
      version: 1,
      partialize: (state) => ({
        profiles: state.profiles,
        activeProfileId: state.activeProfileId,
        capabilityBindings: state.capabilityBindings,
        toolPolicies: state.toolPolicies,
        credentials: state.credentials,
        budgetPolicy: state.budgetPolicy,
        updatedAt: state.updatedAt,
      }),
      merge: (persistedState, currentState) =>
        ({
          ...currentState,
          ...mergeSettings(persistedState as Partial<HyperFramesModelCenterSettings> | undefined),
        }) as HyperFramesModelCenterStore,
    },
  ),
)

export function normalizeCredentialScope(value: string): CredentialScope {
  if (value === 'team-secret' || value === 'session-token') return value
  return 'user-local'
}
