import type { ModelCapability, ModelProfile } from '@/types/hyperframes'
import {
  createOpenAICompatibleProvider,
  OpenAICompatibleProviderError,
  type OpenAICompatibleConnectionResult,
  type OpenAICompatibleProvider,
  type OpenAICompatibleProviderOptions,
  type OpenAICompatibleTextRequest,
  type OpenAICompatibleTextResult,
} from './openAICompatibleProvider'

export interface PrivateGatewayTeamPolicy {
  id: string
  displayName?: string
  auditTag?: string
  allowToolCalls: boolean
  allowedCapabilities?: ModelCapability[]
  allowedBaseUrlHosts?: string[]
  requireProxy?: boolean
}

export interface PrivateGatewayProviderOptions extends OpenAICompatibleProviderOptions {
  teamPolicy: PrivateGatewayTeamPolicy
}

export interface PrivateGatewayProvider extends Omit<
  OpenAICompatibleProvider,
  'id' | 'displayName' | 'invokeText' | 'validateConnection'
> {
  id: 'private-gateway'
  displayName: string
  teamPolicy: PrivateGatewayTeamPolicy
  applyTeamPolicy(profile: ModelProfile): ModelProfile
  validateConnection(
    profile: ModelProfile,
    options?: { timeoutMs?: number; signal?: AbortSignal },
  ): Promise<OpenAICompatibleConnectionResult>
  invokeText(request: OpenAICompatibleTextRequest): Promise<OpenAICompatibleTextResult>
}

function profileHost(profile: ModelProfile): string | undefined {
  const baseUrl = profile.baseUrl ?? profile.endpoint
  if (!baseUrl) return undefined
  try {
    return new URL(baseUrl).host
  } catch {
    return undefined
  }
}

function assertTeamPolicy(profile: ModelProfile, policy: PrivateGatewayTeamPolicy): void {
  if (profile.providerType !== 'gateway') {
    throw new OpenAICompatibleProviderError(
      'bad-request',
      'Private gateway provider requires a gateway model profile.',
    )
  }

  if (policy.requireProxy && !profile.proxyRef) {
    throw new OpenAICompatibleProviderError(
      'missing-configuration',
      'Private gateway team policy requires proxyRef.',
    )
  }

  if (policy.allowedBaseUrlHosts?.length) {
    const host = profileHost(profile)
    if (!host || !policy.allowedBaseUrlHosts.includes(host)) {
      throw new OpenAICompatibleProviderError(
        'bad-request',
        'Private gateway baseUrl host is not allowed by team policy.',
      )
    }
  }
}

export function applyPrivateGatewayTeamPolicy(
  profile: ModelProfile,
  policy: PrivateGatewayTeamPolicy,
): ModelProfile {
  const allowedCapabilities = new Set(policy.allowedCapabilities)
  const shouldFilterCapabilities = allowedCapabilities.size > 0

  return {
    ...profile,
    auditTag: policy.auditTag ?? profile.auditTag,
    models: profile.models.map((model) => {
      const capabilities = model.capabilities.filter((capability) => {
        if (!policy.allowToolCalls && capability === 'tool.calling') return false
        return shouldFilterCapabilities ? allowedCapabilities.has(capability) : true
      })
      return {
        ...model,
        capabilities,
        supportsToolCalls: policy.allowToolCalls ? model.supportsToolCalls : false,
      }
    }),
  }
}

export function createPrivateGatewayProvider(
  options: PrivateGatewayProviderOptions,
): PrivateGatewayProvider {
  const openAICompatible = createOpenAICompatibleProvider({
    ...options,
    defaultHeaders: {
      'x-freecut-team-policy-id': options.teamPolicy.id,
      ...(options.teamPolicy.auditTag
        ? { 'x-freecut-audit-tag': options.teamPolicy.auditTag }
        : {}),
      ...options.defaultHeaders,
    },
  })

  function applyAndAssert(profile: ModelProfile): ModelProfile {
    assertTeamPolicy(profile, options.teamPolicy)
    return applyPrivateGatewayTeamPolicy(profile, options.teamPolicy)
  }

  return {
    id: 'private-gateway',
    displayName: options.teamPolicy.displayName ?? 'Private gateway',
    teamPolicy: options.teamPolicy,
    applyTeamPolicy(profile) {
      return applyAndAssert(profile)
    },
    async validateConnection(profile, connectionOptions) {
      try {
        return await openAICompatible.validateConnection(applyAndAssert(profile), connectionOptions)
      } catch (error) {
        return {
          ok: false,
          modelIds: [],
          error:
            error instanceof OpenAICompatibleProviderError
              ? error
              : new OpenAICompatibleProviderError(
                  'network-error',
                  error instanceof Error ? error.message : 'Private gateway connection failed.',
                ),
        }
      }
    },
    invokeText(request) {
      return openAICompatible.invokeText({
        ...request,
        profile: applyAndAssert(request.profile),
      })
    },
  }
}
