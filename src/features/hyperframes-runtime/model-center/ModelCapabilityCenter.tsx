import { useMemo, useState } from 'react'
import {
  CheckCircle2,
  Cloud,
  KeyRound,
  Lock,
  Plus,
  RotateCcw,
  Route,
  ShieldCheck,
  WalletCards,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  DEFAULT_MATERIAL_SCOPE,
  MODEL_CAPABILITIES,
  TOOL_PERMISSIONS,
  type MaterialAccessLevel,
  type ModelCapability,
  type ModelCapabilityBinding,
  type ModelCapabilityQuality,
  type ModelDescriptor,
  type ModelProviderType,
  type ToolPermission,
  type ToolPermissionState,
} from '@/types/hyperframes'
import { cn } from '@/shared/ui/cn'
import { estimateModelCost, evaluateBudgetGate, type ModelUsageEstimate } from './costEstimator'
import {
  createStarterModelProfile,
  normalizeCredentialScope,
  useHyperFramesModelCenterStore,
} from './modelCenterStore'

const PROVIDER_OPTIONS: Array<{ value: ModelProviderType; label: string }> = [
  { value: 'cloud', label: 'Cloud' },
  { value: 'gateway', label: 'Private gateway' },
  { value: 'local', label: 'Local HTTP' },
  { value: 'freecut-built-in', label: 'FreeCut built-in' },
]

const QUALITY_OPTIONS: ModelCapabilityQuality[] = ['draft', 'standard', 'high']
const PERMISSION_STATES: ToolPermissionState[] = ['denied', 'requires-confirmation', 'allowed']
const MATERIAL_ACCESS_OPTIONS: MaterialAccessLevel[] = [
  'none',
  'summary',
  'metadata',
  'selection',
  'snippets',
  'selected-files',
  'selected-frames',
  'transcript',
  'full-after-confirmation',
]

const TAB_TRIGGER_CLASS = 'h-8 gap-1.5 px-2 text-xs'
const PANEL_CLASS = 'space-y-3'
const SECTION_CLASS = 'rounded-lg border border-border bg-background/40 p-3'
const LABEL_CLASS = 'text-xs font-medium text-muted-foreground'
const INPUT_CLASS = 'h-8'
const NATIVE_SELECT_CLASS =
  'h-8 rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring'

function humanize(value: string): string {
  return value
    .split(/[.-]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function numberOrUndefined(value: string): number | undefined {
  if (value.trim() === '') return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function firstModel(profile: { defaultModel: string; models: ModelDescriptor[] }) {
  return profile.models.find((model) => model.id === profile.defaultModel) ?? profile.models[0]
}

function replaceFirstModel(
  models: ModelDescriptor[],
  patch: Partial<ModelDescriptor>,
): ModelDescriptor[] {
  if (models.length === 0) {
    return [
      {
        id: 'model',
        displayName: 'Model',
        inputModalities: ['text'],
        outputModalities: ['text', 'json'],
        capabilities: ['text.planning'],
        latencyClass: 'balanced',
        privacyClass: 'external',
        ...patch,
      },
    ]
  }
  return models.map((model, index) => (index === 0 ? { ...model, ...patch } : model))
}

function toggleListValue<T extends string>(values: T[], value: T): T[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value]
}

function ProfileStatus({ enabled }: { enabled: boolean }) {
  return (
    <span
      className={cn(
        'rounded-full px-2 py-0.5 text-[11px] font-medium',
        enabled ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/5 text-muted-foreground',
      )}
    >
      {enabled ? 'Enabled' : 'Disabled'}
    </span>
  )
}

export interface ModelCapabilityCenterProps {
  className?: string
  defaultTab?: 'providers' | 'bindings' | 'credentials' | 'budget' | 'privacy'
}

export function ModelCapabilityCenter({
  className,
  defaultTab = 'providers',
}: ModelCapabilityCenterProps) {
  const profiles = useHyperFramesModelCenterStore((state) => state.profiles)
  const activeProfileId = useHyperFramesModelCenterStore((state) => state.activeProfileId)
  const capabilityBindings = useHyperFramesModelCenterStore((state) => state.capabilityBindings)
  const toolPolicies = useHyperFramesModelCenterStore((state) => state.toolPolicies)
  const credentials = useHyperFramesModelCenterStore((state) => state.credentials)
  const budgetPolicy = useHyperFramesModelCenterStore((state) => state.budgetPolicy)
  const setActiveProfileId = useHyperFramesModelCenterStore((state) => state.setActiveProfileId)
  const upsertModelProfile = useHyperFramesModelCenterStore((state) => state.upsertModelProfile)
  const updateModelProfile = useHyperFramesModelCenterStore((state) => state.updateModelProfile)
  const updateModelDescriptor = useHyperFramesModelCenterStore(
    (state) => state.updateModelDescriptor,
  )
  const upsertCapabilityBinding = useHyperFramesModelCenterStore(
    (state) => state.upsertCapabilityBinding,
  )
  const updateToolPolicy = useHyperFramesModelCenterStore((state) => state.updateToolPolicy)
  const upsertCredentialMetadata = useHyperFramesModelCenterStore(
    (state) => state.upsertCredentialMetadata,
  )
  const deleteCredentialMetadata = useHyperFramesModelCenterStore(
    (state) => state.deleteCredentialMetadata,
  )
  const updateBudgetPolicy = useHyperFramesModelCenterStore((state) => state.updateBudgetPolicy)
  const resetModelCenter = useHyperFramesModelCenterStore((state) => state.resetModelCenter)

  const profileList = useMemo(
    () => Object.values(profiles).sort((left, right) => left.name.localeCompare(right.name)),
    [profiles],
  )
  const activeProfile = profiles[activeProfileId] ?? profileList[0]
  const activeModel = activeProfile ? firstModel(activeProfile) : undefined
  const bindingList = useMemo(
    () =>
      Object.values(capabilityBindings).sort((left, right) =>
        left.capability.localeCompare(right.capability),
      ),
    [capabilityBindings],
  )
  const [selectedBindingId, setSelectedBindingId] = useState(bindingList[0]?.id ?? '')
  const selectedBinding = capabilityBindings[selectedBindingId] ?? bindingList[0]
  const selectedPolicyId = selectedBinding?.toolPolicyId
  const selectedPolicy = selectedPolicyId
    ? toolPolicies[selectedPolicyId]
    : Object.values(toolPolicies)[0]
  const [credentialRef, setCredentialRef] = useState('user-local:openai-compatible')
  const [credentialLabel, setCredentialLabel] = useState('OpenAI-compatible API key')
  const [credentialScope, setCredentialScope] = useState('user-local')
  const [usageEstimate, setUsageEstimate] = useState<ModelUsageEstimate>({
    inputTokens: 1000,
    outputTokens: 500,
    images: 1,
    requests: 1,
  })

  const costEstimate = useMemo(() => {
    if (!activeProfile || !activeModel) return undefined
    return estimateModelCost(activeProfile, activeModel.id, usageEstimate)
  }, [activeModel, activeProfile, usageEstimate])
  const budgetDecision = useMemo(
    () => (costEstimate ? evaluateBudgetGate(costEstimate, budgetPolicy) : undefined),
    [budgetPolicy, costEstimate],
  )

  if (!activeProfile || !activeModel) {
    return null
  }

  const updateActiveProfile = (patch: Parameters<typeof updateModelProfile>[1]) => {
    updateModelProfile(activeProfile.id, patch)
  }
  const updateActiveModel = (patch: Partial<ModelDescriptor>) => {
    updateModelDescriptor(activeProfile.id, activeModel.id, patch)
  }
  const updateFirstModelAndDefault = (patch: Partial<ModelDescriptor>) => {
    updateModelProfile(activeProfile.id, {
      defaultModel: patch.id ?? activeProfile.defaultModel,
      models: replaceFirstModel(activeProfile.models, patch),
    })
  }
  const addProfile = (providerType: ModelProviderType) => {
    const profile = createStarterModelProfile(providerType)
    upsertModelProfile(profile)
    setActiveProfileId(profile.id)
  }
  const updateBinding = (patch: Partial<ModelCapabilityBinding>) => {
    if (!selectedBinding) return
    upsertCapabilityBinding({ ...selectedBinding, ...patch })
  }
  const updatePolicyPermission = (permission: ToolPermission, state: ToolPermissionState) => {
    if (!selectedPolicy) return
    updateToolPolicy(selectedPolicy.id, {
      permissions: {
        ...selectedPolicy.permissions,
        [permission]: {
          ...selectedPolicy.permissions[permission],
          state,
        },
      },
    })
  }

  return (
    <section className={cn('space-y-3', className)} aria-label="Model and capability center">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-0.5">
          <h3 className="text-sm font-semibold">Model and capability center</h3>
          <p className="text-xs text-muted-foreground">
            {profileList.length} providers, {bindingList.length} bindings,{' '}
            {Object.keys(credentials).length} credential refs
          </p>
        </div>
        <Button variant="ghost" size="sm" className="h-8 gap-1.5" onClick={resetModelCenter}>
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
        </Button>
      </div>

      <Tabs defaultValue={defaultTab} className="space-y-3">
        <TabsList className="grid h-auto w-full grid-cols-5 gap-1 bg-secondary/60 p-1">
          <TabsTrigger value="providers" className={TAB_TRIGGER_CLASS}>
            <Cloud className="h-3.5 w-3.5" />
            Providers
          </TabsTrigger>
          <TabsTrigger value="bindings" className={TAB_TRIGGER_CLASS}>
            <Route className="h-3.5 w-3.5" />
            Bindings
          </TabsTrigger>
          <TabsTrigger value="credentials" className={TAB_TRIGGER_CLASS}>
            <KeyRound className="h-3.5 w-3.5" />
            Credentials
          </TabsTrigger>
          <TabsTrigger value="budget" className={TAB_TRIGGER_CLASS}>
            <WalletCards className="h-3.5 w-3.5" />
            Budget
          </TabsTrigger>
          <TabsTrigger value="privacy" className={TAB_TRIGGER_CLASS}>
            <ShieldCheck className="h-3.5 w-3.5" />
            Privacy
          </TabsTrigger>
        </TabsList>

        <TabsContent value="providers" className={PANEL_CLASS}>
          <div className="grid grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] gap-3">
            <div className={cn(SECTION_CLASS, 'space-y-2')}>
              <div className="flex flex-wrap gap-1.5">
                {PROVIDER_OPTIONS.filter((option) => option.value !== 'freecut-built-in').map(
                  (option) => (
                    <Button
                      key={option.value}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1 px-2 text-xs"
                      onClick={() => addProfile(option.value)}
                    >
                      <Plus className="h-3 w-3" />
                      {option.label}
                    </Button>
                  ),
                )}
              </div>
              <div className="space-y-1.5">
                {profileList.map((profile) => (
                  <button
                    key={profile.id}
                    type="button"
                    className={cn(
                      'w-full rounded-md border px-2.5 py-2 text-left transition-colors',
                      activeProfile.id === profile.id
                        ? 'border-primary/40 bg-primary/10 text-foreground'
                        : 'border-border bg-background/30 text-muted-foreground hover:text-foreground',
                    )}
                    onClick={() => setActiveProfileId(profile.id)}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium">{profile.name}</span>
                      <ProfileStatus enabled={profile.enabled} />
                    </span>
                    <span className="mt-1 block text-xs">{humanize(profile.providerType)}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className={cn(SECTION_CLASS, 'space-y-3')}>
              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1">
                  <span className={LABEL_CLASS}>Provider name</span>
                  <Input
                    className={INPUT_CLASS}
                    value={activeProfile.name}
                    onChange={(event) => updateActiveProfile({ name: event.target.value })}
                  />
                </label>
                <label className="space-y-1">
                  <span className={LABEL_CLASS}>Provider type</span>
                  <select
                    className={cn(NATIVE_SELECT_CLASS, 'w-full')}
                    value={activeProfile.providerType}
                    aria-label="Provider type"
                    onChange={(event) =>
                      updateActiveProfile({
                        providerType: event.target.value as ModelProviderType,
                      })
                    }
                  >
                    {PROVIDER_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className={LABEL_CLASS}>Base URL</span>
                  <Input
                    className={INPUT_CLASS}
                    value={activeProfile.baseUrl ?? ''}
                    onChange={(event) => updateActiveProfile({ baseUrl: event.target.value })}
                  />
                </label>
                <label className="space-y-1">
                  <span className={LABEL_CLASS}>Endpoint</span>
                  <Input
                    className={INPUT_CLASS}
                    value={activeProfile.endpoint ?? ''}
                    onChange={(event) => updateActiveProfile({ endpoint: event.target.value })}
                  />
                </label>
                <label className="space-y-1">
                  <span className={LABEL_CLASS}>Credential ref</span>
                  <Input
                    className={INPUT_CLASS}
                    value={activeProfile.apiKeyRef ?? activeProfile.authRef ?? ''}
                    onChange={(event) =>
                      updateActiveProfile(
                        activeProfile.providerType === 'gateway'
                          ? { authRef: event.target.value }
                          : { apiKeyRef: event.target.value },
                      )
                    }
                  />
                </label>
                <label className="flex items-end justify-between gap-2 rounded-md border border-border px-2.5 py-1.5">
                  <span>
                    <span className="block text-xs font-medium">Enabled</span>
                    <span className="text-[11px] text-muted-foreground">Used by routing plans</span>
                  </span>
                  <Switch
                    checked={activeProfile.enabled}
                    onCheckedChange={(enabled) => updateActiveProfile({ enabled })}
                  />
                </label>
              </div>

              <Separator className="bg-white/8" />

              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1">
                  <span className={LABEL_CLASS}>Default model ID</span>
                  <Input
                    className={INPUT_CLASS}
                    value={activeModel.id}
                    onChange={(event) => updateFirstModelAndDefault({ id: event.target.value })}
                  />
                </label>
                <label className="space-y-1">
                  <span className={LABEL_CLASS}>Display name</span>
                  <Input
                    className={INPUT_CLASS}
                    value={activeModel.displayName}
                    onChange={(event) => updateActiveModel({ displayName: event.target.value })}
                  />
                </label>
              </div>
              <div className="space-y-1">
                <span className={LABEL_CLASS}>Capabilities</span>
                <div className="flex flex-wrap gap-1.5">
                  {MODEL_CAPABILITIES.map((capability) => {
                    const active = activeModel.capabilities.includes(capability)
                    return (
                      <button
                        key={capability}
                        type="button"
                        aria-pressed={active}
                        className={cn(
                          'rounded-md border px-2 py-1 text-[11px] transition-colors',
                          active
                            ? 'border-primary/50 bg-primary/15 text-primary'
                            : 'border-border text-muted-foreground hover:text-foreground',
                        )}
                        onClick={() =>
                          updateActiveModel({
                            capabilities: toggleListValue(activeModel.capabilities, capability),
                          })
                        }
                      >
                        {capability}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="bindings" className={PANEL_CLASS}>
          <div className={cn(SECTION_CLASS, 'space-y-3')}>
            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1">
                <span className={LABEL_CLASS}>Binding</span>
                <select
                  className={cn(NATIVE_SELECT_CLASS, 'w-full')}
                  aria-label="Capability binding"
                  value={selectedBinding?.id ?? ''}
                  onChange={(event) => setSelectedBindingId(event.target.value)}
                >
                  {bindingList.map((binding) => (
                    <option key={binding.id} value={binding.id}>
                      {binding.capability} / {binding.quality}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className={LABEL_CLASS}>Enabled</span>
                <div className="flex h-8 items-center justify-between rounded-md border border-border px-2.5">
                  <span className="text-sm">{selectedBinding?.enabled ? 'Active' : 'Paused'}</span>
                  <Switch
                    checked={selectedBinding?.enabled ?? false}
                    onCheckedChange={(enabled) => updateBinding({ enabled })}
                  />
                </div>
              </label>
              <label className="space-y-1">
                <span className={LABEL_CLASS}>Capability</span>
                <select
                  className={cn(NATIVE_SELECT_CLASS, 'w-full')}
                  value={selectedBinding?.capability ?? 'text.planning'}
                  aria-label="Binding capability"
                  onChange={(event) =>
                    updateBinding({ capability: event.target.value as ModelCapability })
                  }
                >
                  {MODEL_CAPABILITIES.map((capability) => (
                    <option key={capability} value={capability}>
                      {capability}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className={LABEL_CLASS}>Quality</span>
                <select
                  className={cn(NATIVE_SELECT_CLASS, 'w-full')}
                  value={selectedBinding?.quality ?? 'standard'}
                  aria-label="Binding quality"
                  onChange={(event) =>
                    updateBinding({ quality: event.target.value as ModelCapabilityQuality })
                  }
                >
                  {QUALITY_OPTIONS.map((quality) => (
                    <option key={quality} value={quality}>
                      {humanize(quality)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className={LABEL_CLASS}>Provider</span>
                <select
                  className={cn(NATIVE_SELECT_CLASS, 'w-full')}
                  value={selectedBinding?.profileId ?? activeProfile.id}
                  aria-label="Binding provider"
                  onChange={(event) => {
                    const profile = profiles[event.target.value]
                    updateBinding({
                      profileId: event.target.value,
                      modelId: profile?.defaultModel ?? selectedBinding?.modelId,
                    })
                  }}
                >
                  {profileList.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className={LABEL_CLASS}>Max cost per task</span>
                <Input
                  className={INPUT_CLASS}
                  type="number"
                  min={0}
                  step={0.01}
                  value={selectedBinding?.maxCostPerTask ?? ''}
                  onChange={(event) =>
                    updateBinding({ maxCostPerTask: numberOrUndefined(event.target.value) })
                  }
                />
              </label>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="credentials" className={PANEL_CLASS}>
          <div className={cn(SECTION_CLASS, 'space-y-3')}>
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_150px_auto] gap-2">
              <label className="space-y-1">
                <span className={LABEL_CLASS}>Credential ref</span>
                <Input
                  className={INPUT_CLASS}
                  value={credentialRef}
                  onChange={(event) => setCredentialRef(event.target.value)}
                />
              </label>
              <label className="space-y-1">
                <span className={LABEL_CLASS}>Label</span>
                <Input
                  className={INPUT_CLASS}
                  value={credentialLabel}
                  onChange={(event) => setCredentialLabel(event.target.value)}
                />
              </label>
              <label className="space-y-1">
                <span className={LABEL_CLASS}>Scope</span>
                <select
                  className={cn(NATIVE_SELECT_CLASS, 'w-full')}
                  value={credentialScope}
                  aria-label="Credential scope"
                  onChange={(event) => setCredentialScope(event.target.value)}
                >
                  <option value="user-local">User local</option>
                  <option value="team-secret">Team secret</option>
                  <option value="session-token">Session token</option>
                </select>
              </label>
              <Button
                type="button"
                size="sm"
                className="mt-5 h-8 gap-1.5"
                onClick={() =>
                  upsertCredentialMetadata(credentialRef, {
                    scope: normalizeCredentialScope(credentialScope),
                    label: credentialLabel,
                  })
                }
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Save
              </Button>
            </div>
            <div className="space-y-1.5">
              {Object.values(credentials).map((credential) => (
                <div
                  key={credential.ref}
                  className="grid grid-cols-[minmax(0,1fr)_110px_auto] items-center gap-2 rounded-md border border-border px-2.5 py-2 text-sm"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{credential.label}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {credential.ref}
                    </span>
                  </span>
                  <span className="text-xs text-muted-foreground">{credential.scope}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => deleteCredentialMetadata(credential.ref)}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="budget" className={PANEL_CLASS}>
          <div className="grid grid-cols-2 gap-3">
            <div className={cn(SECTION_CLASS, 'space-y-2')}>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    ['maxCostPerTask', 'Task budget'],
                    ['projectBudgetRemaining', 'Project remaining'],
                    ['userBudgetRemaining', 'User remaining'],
                    ['teamBudgetRemaining', 'Team remaining'],
                    ['dailyBudgetRemaining', 'Daily remaining'],
                    ['confirmationThreshold', 'Confirm above'],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="space-y-1">
                    <span className={LABEL_CLASS}>{label}</span>
                    <Input
                      className={INPUT_CLASS}
                      type="number"
                      min={0}
                      step={0.01}
                      value={budgetPolicy[key] ?? ''}
                      onChange={(event) =>
                        updateBudgetPolicy({ [key]: numberOrUndefined(event.target.value) })
                      }
                    />
                  </label>
                ))}
              </div>
            </div>

            <div className={cn(SECTION_CLASS, 'space-y-2')}>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    ['inputTokens', 'Input tokens'],
                    ['outputTokens', 'Output tokens'],
                    ['images', 'Images'],
                    ['audioMinutes', 'Audio minutes'],
                    ['requests', 'Requests'],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="space-y-1">
                    <span className={LABEL_CLASS}>{label}</span>
                    <Input
                      className={INPUT_CLASS}
                      type="number"
                      min={0}
                      step={key.includes('Tokens') ? 100 : 1}
                      value={usageEstimate[key] ?? ''}
                      onChange={(event) =>
                        setUsageEstimate((current) => ({
                          ...current,
                          [key]: numberOrUndefined(event.target.value),
                        }))
                      }
                    />
                  </label>
                ))}
              </div>
              <div
                className={cn(
                  'rounded-md border px-2.5 py-2 text-sm',
                  budgetDecision?.status === 'requires-confirmation'
                    ? 'border-amber-500/40 bg-amber-500/10 text-amber-200'
                    : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
                )}
              >
                <span className="block font-medium">
                  {budgetDecision?.status === 'requires-confirmation'
                    ? 'Requires confirmation'
                    : 'Within budget'}
                </span>
                <span className="text-xs opacity-85">
                  {costEstimate?.estimatedCost === undefined
                    ? 'Pricing incomplete'
                    : `${costEstimate.currency ?? budgetPolicy.currency ?? 'USD'} ${costEstimate.estimatedCost.toFixed(4)}`}
                </span>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="privacy" className={PANEL_CLASS}>
          <div className={cn(SECTION_CLASS, 'space-y-3')}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-1.5 text-sm font-medium">
                  <Lock className="h-3.5 w-3.5" />
                  {selectedPolicy?.name ?? 'Model policy'}
                </div>
                <div className="text-xs text-muted-foreground">
                  {selectedPolicy?.networkMode ?? 'confirm-before-access'}
                </div>
              </div>
              <select
                className={cn(NATIVE_SELECT_CLASS, 'w-48')}
                value={selectedBinding?.toolPolicyId ?? selectedPolicy?.id ?? ''}
                aria-label="Tool policy"
                onChange={(event) => updateBinding({ toolPolicyId: event.target.value })}
              >
                {Object.values(toolPolicies).map((policy) => (
                  <option key={policy.id} value={policy.id}>
                    {policy.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {TOOL_PERMISSIONS.map((permission) => (
                <label key={permission} className="space-y-1">
                  <span className={LABEL_CLASS}>{humanize(permission)}</span>
                  <select
                    className={cn(NATIVE_SELECT_CLASS, 'w-full text-xs')}
                    value={selectedPolicy?.permissions[permission]?.state ?? 'denied'}
                    aria-label={permission}
                    onChange={(event) =>
                      updatePolicyPermission(permission, event.target.value as ToolPermissionState)
                    }
                  >
                    {PERMISSION_STATES.map((state) => (
                      <option key={state} value={state}>
                        {humanize(state)}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>

            <Separator className="bg-white/8" />

            <div className="grid grid-cols-3 gap-2">
              <label className="space-y-1">
                <span className={LABEL_CLASS}>Source files</span>
                <select
                  className={cn(NATIVE_SELECT_CLASS, 'w-full text-xs')}
                  value={
                    selectedPolicy?.materialScope.sourceFiles ?? DEFAULT_MATERIAL_SCOPE.sourceFiles
                  }
                  aria-label="Source file material scope"
                  onChange={(event) =>
                    selectedPolicy &&
                    updateToolPolicy(selectedPolicy.id, {
                      materialScope: {
                        ...selectedPolicy.materialScope,
                        sourceFiles: event.target.value as MaterialAccessLevel,
                      },
                    })
                  }
                >
                  {MATERIAL_ACCESS_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {humanize(option)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className={LABEL_CLASS}>Upload mode</span>
                <select
                  className={cn(NATIVE_SELECT_CLASS, 'w-full text-xs')}
                  value={selectedPolicy?.materialScope.uploadMode ?? 'none'}
                  aria-label="Upload mode"
                  onChange={(event) =>
                    selectedPolicy &&
                    updateToolPolicy(selectedPolicy.id, {
                      materialScope: {
                        ...selectedPolicy.materialScope,
                        uploadMode: event.target.value as typeof DEFAULT_MATERIAL_SCOPE.uploadMode,
                      },
                    })
                  }
                >
                  <option value="none">None</option>
                  <option value="local-only">Local only</option>
                  <option value="confirmed-external">Confirmed external</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className={LABEL_CLASS}>Local paths</span>
                <select
                  className={cn(NATIVE_SELECT_CLASS, 'w-full text-xs')}
                  value={selectedPolicy?.materialScope.localPaths ?? 'redacted'}
                  aria-label="Local path policy"
                  onChange={(event) =>
                    selectedPolicy &&
                    updateToolPolicy(selectedPolicy.id, {
                      materialScope: {
                        ...selectedPolicy.materialScope,
                        localPaths: event.target.value as typeof DEFAULT_MATERIAL_SCOPE.localPaths,
                      },
                    })
                  }
                >
                  <option value="redacted">Redacted</option>
                  <option value="project-relative">Project relative</option>
                  <option value="allowed-after-confirmation">Allowed after confirmation</option>
                </select>
              </label>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </section>
  )
}
