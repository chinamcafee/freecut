import {
  DEFAULT_TOOL_POLICY,
  type HyperFramesIntegrationState,
  type ModelCapability,
  type ModelCapabilityBinding,
  type ModelCapabilityQuality,
  type ModelDescriptor,
  type ModelProfile,
  type ModelPrivacyMode,
  type ToolPermission,
  type ToolPermissionRule,
  type ToolPolicy,
} from '@/types/hyperframes'

export interface ModelRequirement {
  capability: ModelCapability
  quality?: ModelCapabilityQuality
  required?: boolean
  maxCostPerTask?: number
  privacyModes?: ModelPrivacyMode[]
  requiredPermissions?: ToolPermission[]
}

export interface ModelRouteCandidate {
  binding: ModelCapabilityBinding
  profile?: ModelProfile
  model?: ModelDescriptor
  toolPolicy: ToolPolicy
  fallbackIndex?: number
  score: number
  issues: string[]
}

export interface ModelRoute {
  requirement: ModelRequirement
  binding: ModelCapabilityBinding
  profile: ModelProfile
  model: ModelDescriptor
  toolPolicy: ToolPolicy
  usedFallback: boolean
  fallbackIndex?: number
}

export interface ModelRoutingIssue {
  capability: ModelCapability
  required: boolean
  reason: string
  candidates: ModelRouteCandidate[]
}

export interface ModelRoutingPlan {
  routes: ModelRoute[]
  missing: ModelRoutingIssue[]
  estimatedMaxCost: number
  requiresNetwork: boolean
  requiresConfirmation: boolean
  canProceed: boolean
}

export interface ModelRegistry {
  profiles: Record<string, ModelProfile>
  bindings: Record<string, ModelCapabilityBinding>
  toolPolicies: Record<string, ToolPolicy>
  listProfiles(): ModelProfile[]
  listBindings(capability?: ModelCapability): ModelCapabilityBinding[]
  selectCapability(requirement: ModelRequirement): ModelRoute | ModelRoutingIssue
  routeCapabilities(requirements: ModelRequirement[]): ModelRoutingPlan
}

const qualityRank: Record<ModelCapabilityQuality, number> = {
  draft: 0,
  standard: 1,
  high: 2,
}

function getToolPolicy(
  binding: ModelCapabilityBinding,
  toolPolicies: Record<string, ToolPolicy>,
): ToolPolicy {
  if (!binding.toolPolicyId) return DEFAULT_TOOL_POLICY
  return toolPolicies[binding.toolPolicyId] ?? DEFAULT_TOOL_POLICY
}

function getRule(policy: ToolPolicy, permission: ToolPermission): ToolPermissionRule {
  return policy.permissions[permission] ?? { state: 'denied' }
}

function qualityScore(
  bindingQuality: ModelCapabilityQuality,
  requirementQuality?: ModelCapabilityQuality,
): number {
  if (!requirementQuality) return qualityRank[bindingQuality]
  const bindingRank = qualityRank[bindingQuality]
  const requirementRank = qualityRank[requirementQuality]
  if (bindingRank < requirementRank) return -1
  return bindingQuality === requirementQuality ? 30 : 20 + bindingRank
}

function isNetworkProfile(profile: ModelProfile): boolean {
  return profile.providerType === 'cloud' || profile.providerType === 'gateway'
}

function candidateCost(binding: ModelCapabilityBinding): number {
  return binding.maxCostPerTask ?? 0
}

function createCandidate(input: {
  requirement: ModelRequirement
  binding: ModelCapabilityBinding
  profile?: ModelProfile
  model?: ModelDescriptor
  toolPolicy: ToolPolicy
  fallbackIndex?: number
}): ModelRouteCandidate {
  const issues: string[] = []
  const scoreParts: number[] = []
  const quality = qualityScore(input.binding.quality, input.requirement.quality)

  if (!input.binding.enabled) issues.push('Binding is disabled.')
  if (quality < 0) issues.push('Binding quality is lower than required quality.')
  else scoreParts.push(quality)

  if (!input.profile) issues.push('Model profile was not found.')
  else if (!input.profile.enabled) issues.push('Model profile is disabled.')

  if (!input.model) issues.push('Model id was not found in the profile.')
  else if (!input.model.capabilities.includes(input.binding.capability)) {
    issues.push('Model does not declare the bound capability.')
  }
  if (
    input.profile &&
    input.requirement.privacyModes &&
    !input.requirement.privacyModes.includes(input.profile.privacyMode)
  ) {
    issues.push('Model privacy mode is not allowed for this requirement.')
  }

  if (
    input.requirement.maxCostPerTask !== undefined &&
    candidateCost(input.binding) > input.requirement.maxCostPerTask
  ) {
    issues.push('Binding exceeds the requirement max cost.')
  }

  for (const permission of input.requirement.requiredPermissions ?? []) {
    if (getRule(input.toolPolicy, permission).state === 'denied') {
      issues.push(`Tool permission denied: ${permission}.`)
    }
  }

  if (input.fallbackIndex !== undefined) scoreParts.push(-10 - input.fallbackIndex)
  if (input.profile && !isNetworkProfile(input.profile)) scoreParts.push(2)

  return {
    binding: input.binding,
    profile: input.profile,
    model: input.model,
    toolPolicy: input.toolPolicy,
    fallbackIndex: input.fallbackIndex,
    score: scoreParts.reduce((sum, value) => sum + value, 0),
    issues,
  }
}

function candidatesForRequirement(
  requirement: ModelRequirement,
  bindings: Record<string, ModelCapabilityBinding>,
  profiles: Record<string, ModelProfile>,
  toolPolicies: Record<string, ToolPolicy>,
): ModelRouteCandidate[] {
  const candidates: ModelRouteCandidate[] = []
  for (const binding of Object.values(bindings)) {
    if (binding.capability !== requirement.capability) continue
    const toolPolicy = getToolPolicy(binding, toolPolicies)
    const profile = profiles[binding.profileId]
    candidates.push(
      createCandidate({
        requirement,
        binding,
        profile,
        model: profile?.models.find((model) => model.id === binding.modelId),
        toolPolicy,
      }),
    )

    binding.fallback?.forEach((fallback, fallbackIndex) => {
      const fallbackProfile = profiles[fallback.profileId]
      candidates.push(
        createCandidate({
          requirement,
          binding,
          profile: fallbackProfile,
          model: fallbackProfile?.models.find((model) => model.id === fallback.modelId),
          toolPolicy,
          fallbackIndex,
        }),
      )
    })
  }
  return candidates.sort((left, right) => right.score - left.score)
}

function routeFromCandidate(
  requirement: ModelRequirement,
  candidate: ModelRouteCandidate,
): ModelRoute | null {
  if (candidate.issues.length > 0 || !candidate.profile || !candidate.model) return null
  return {
    requirement,
    binding: candidate.binding,
    profile: candidate.profile,
    model: candidate.model,
    toolPolicy: candidate.toolPolicy,
    usedFallback: candidate.fallbackIndex !== undefined,
    fallbackIndex: candidate.fallbackIndex,
  }
}

function issueFromCandidates(
  requirement: ModelRequirement,
  candidates: ModelRouteCandidate[],
): ModelRoutingIssue {
  const firstIssue = candidates.flatMap((candidate) => candidate.issues)[0]
  return {
    capability: requirement.capability,
    required: requirement.required !== false,
    reason: firstIssue ?? 'No model binding registered for capability.',
    candidates,
  }
}

function hasConfirmationRule(route: ModelRoute): boolean {
  if (route.binding.requiresConfirmationAboveCost !== undefined) return true
  if (route.toolPolicy.requiresConfirmationAboveCost !== undefined) return true
  return Object.values(route.toolPolicy.permissions).some(
    (rule) => rule?.state === 'requires-confirmation',
  )
}

export function createModelRegistry(state: HyperFramesIntegrationState): ModelRegistry {
  const profiles = state.modelProfiles
  const bindings = state.modelCapabilityBindings
  const toolPolicies = state.toolPolicies

  const registry: ModelRegistry = {
    profiles,
    bindings,
    toolPolicies,
    listProfiles() {
      return Object.values(profiles)
    },
    listBindings(capability) {
      const all = Object.values(bindings)
      return capability ? all.filter((binding) => binding.capability === capability) : all
    },
    selectCapability(requirement) {
      const candidates = candidatesForRequirement(requirement, bindings, profiles, toolPolicies)
      const route = candidates
        .map((candidate) => routeFromCandidate(requirement, candidate))
        .find(Boolean)
      return route ?? issueFromCandidates(requirement, candidates)
    },
    routeCapabilities(requirements) {
      return routeModelCapabilities(registry, requirements)
    },
  }

  return registry
}

export function routeModelCapabilities(
  registry: Pick<ModelRegistry, 'selectCapability'>,
  requirements: ModelRequirement[],
): ModelRoutingPlan {
  const routes: ModelRoute[] = []
  const missing: ModelRoutingIssue[] = []

  for (const requirement of requirements) {
    const result = registry.selectCapability(requirement)
    if ('profile' in result) routes.push(result)
    else missing.push(result)
  }

  return {
    routes,
    missing,
    estimatedMaxCost: routes.reduce((sum, route) => sum + candidateCost(route.binding), 0),
    requiresNetwork: routes.some((route) => isNetworkProfile(route.profile)),
    requiresConfirmation: routes.some((route) => hasConfirmationRule(route)),
    canProceed: missing.every((issue) => !issue.required),
  }
}
