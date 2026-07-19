import { useMemo, useState } from 'react'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
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
import { translateBuiltInModelCenterValue } from './modelCenterI18n'

const PROVIDER_OPTIONS: ModelProviderType[] = ['cloud', 'gateway', 'local', 'freecut-built-in']

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

function translateEnum(t: TFunction, value: string): string {
  return t(`hyperframes.enums.${value.replaceAll(/[.-]/g, '_')}`, {
    defaultValue: humanize(value),
  })
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
  const { t } = useTranslation()
  return (
    <span
      className={cn(
        'rounded-full px-2 py-0.5 text-[11px] font-medium',
        enabled ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/5 text-muted-foreground',
      )}
    >
      {enabled ? t('hyperframes.common.enabled') : t('hyperframes.common.disabled')}
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
  const { t } = useTranslation()
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
  const [credentialLabel, setCredentialLabel] = useState('Default credential')
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
    <section
      className={cn('space-y-3', className)}
      aria-label={t('hyperframes.modelCenter.ariaLabel')}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-0.5">
          <h3 className="text-sm font-semibold">{t('hyperframes.modelCenter.title')}</h3>
          <p className="text-xs text-muted-foreground">
            {t('hyperframes.modelCenter.summary', {
              providers: profileList.length,
              bindings: bindingList.length,
              credentials: Object.keys(credentials).length,
            })}
          </p>
        </div>
        <Button variant="ghost" size="sm" className="h-8 gap-1.5" onClick={resetModelCenter}>
          <RotateCcw className="h-3.5 w-3.5" />
          {t('hyperframes.common.reset')}
        </Button>
      </div>

      <Tabs defaultValue={defaultTab} className="space-y-3">
        <TabsList className="grid h-auto w-full grid-cols-5 gap-1 bg-secondary/60 p-1">
          <TabsTrigger value="providers" className={TAB_TRIGGER_CLASS}>
            <Cloud className="h-3.5 w-3.5" />
            {t('hyperframes.modelCenter.tabs.providers')}
          </TabsTrigger>
          <TabsTrigger value="bindings" className={TAB_TRIGGER_CLASS}>
            <Route className="h-3.5 w-3.5" />
            {t('hyperframes.modelCenter.tabs.bindings')}
          </TabsTrigger>
          <TabsTrigger value="credentials" className={TAB_TRIGGER_CLASS}>
            <KeyRound className="h-3.5 w-3.5" />
            {t('hyperframes.modelCenter.tabs.credentials')}
          </TabsTrigger>
          <TabsTrigger value="budget" className={TAB_TRIGGER_CLASS}>
            <WalletCards className="h-3.5 w-3.5" />
            {t('hyperframes.modelCenter.tabs.budget')}
          </TabsTrigger>
          <TabsTrigger value="privacy" className={TAB_TRIGGER_CLASS}>
            <ShieldCheck className="h-3.5 w-3.5" />
            {t('hyperframes.modelCenter.tabs.privacy')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="providers" className={PANEL_CLASS}>
          <div className="grid grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] gap-3">
            <div className={cn(SECTION_CLASS, 'space-y-2')}>
              <div className="flex flex-wrap gap-1.5">
                {PROVIDER_OPTIONS.filter((providerType) => providerType !== 'freecut-built-in').map(
                  (providerType) => (
                    <Button
                      key={providerType}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1 px-2 text-xs"
                      onClick={() => addProfile(providerType)}
                    >
                      <Plus className="h-3 w-3" />
                      {translateEnum(t, providerType)}
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
                      <span className="truncate text-sm font-medium">
                        {translateBuiltInModelCenterValue(t, profile.name)}
                      </span>
                      <ProfileStatus enabled={profile.enabled} />
                    </span>
                    <span className="mt-1 block text-xs">
                      {translateEnum(t, profile.providerType)}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className={cn(SECTION_CLASS, 'space-y-3')}>
              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1">
                  <span className={LABEL_CLASS}>{t('hyperframes.modelCenter.providerName')}</span>
                  <Input
                    className={INPUT_CLASS}
                    value={translateBuiltInModelCenterValue(t, activeProfile.name)}
                    onChange={(event) => updateActiveProfile({ name: event.target.value })}
                  />
                </label>
                <label className="space-y-1">
                  <span className={LABEL_CLASS}>{t('hyperframes.modelCenter.providerType')}</span>
                  <select
                    className={cn(NATIVE_SELECT_CLASS, 'w-full')}
                    value={activeProfile.providerType}
                    aria-label={t('hyperframes.modelCenter.providerType')}
                    onChange={(event) =>
                      updateActiveProfile({
                        providerType: event.target.value as ModelProviderType,
                      })
                    }
                  >
                    {PROVIDER_OPTIONS.map((providerType) => (
                      <option key={providerType} value={providerType}>
                        {translateEnum(t, providerType)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className={LABEL_CLASS}>{t('hyperframes.modelCenter.baseUrl')}</span>
                  <Input
                    className={INPUT_CLASS}
                    value={activeProfile.baseUrl ?? ''}
                    onChange={(event) => updateActiveProfile({ baseUrl: event.target.value })}
                  />
                </label>
                <label className="space-y-1">
                  <span className={LABEL_CLASS}>{t('hyperframes.modelCenter.endpoint')}</span>
                  <Input
                    className={INPUT_CLASS}
                    value={activeProfile.endpoint ?? ''}
                    onChange={(event) => updateActiveProfile({ endpoint: event.target.value })}
                  />
                </label>
                <label className="space-y-1">
                  <span className={LABEL_CLASS}>{t('hyperframes.modelCenter.credentialRef')}</span>
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
                    <span className="block text-xs font-medium">
                      {t('hyperframes.common.enabled')}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {t('hyperframes.modelCenter.usedByRouting')}
                    </span>
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
                  <span className={LABEL_CLASS}>{t('hyperframes.modelCenter.defaultModelId')}</span>
                  <Input
                    className={INPUT_CLASS}
                    value={activeModel.id}
                    onChange={(event) => updateFirstModelAndDefault({ id: event.target.value })}
                  />
                </label>
                <label className="space-y-1">
                  <span className={LABEL_CLASS}>{t('hyperframes.modelCenter.displayName')}</span>
                  <Input
                    className={INPUT_CLASS}
                    value={translateBuiltInModelCenterValue(t, activeModel.displayName)}
                    onChange={(event) => updateActiveModel({ displayName: event.target.value })}
                  />
                </label>
              </div>
              <div className="space-y-1">
                <span className={LABEL_CLASS}>{t('hyperframes.modelCenter.capabilities')}</span>
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
                        {translateEnum(t, capability)}
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
                <span className={LABEL_CLASS}>{t('hyperframes.modelCenter.binding')}</span>
                <select
                  className={cn(NATIVE_SELECT_CLASS, 'w-full')}
                  aria-label={t('hyperframes.modelCenter.capabilityBinding')}
                  value={selectedBinding?.id ?? ''}
                  onChange={(event) => setSelectedBindingId(event.target.value)}
                >
                  {bindingList.map((binding) => (
                    <option key={binding.id} value={binding.id}>
                      {translateEnum(t, binding.capability)} / {translateEnum(t, binding.quality)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className={LABEL_CLASS}>{t('hyperframes.common.enabled')}</span>
                <div className="flex h-8 items-center justify-between rounded-md border border-border px-2.5">
                  <span className="text-sm">
                    {selectedBinding?.enabled
                      ? t('hyperframes.common.active')
                      : t('hyperframes.common.paused')}
                  </span>
                  <Switch
                    checked={selectedBinding?.enabled ?? false}
                    onCheckedChange={(enabled) => updateBinding({ enabled })}
                  />
                </div>
              </label>
              <label className="space-y-1">
                <span className={LABEL_CLASS}>{t('hyperframes.modelCenter.capability')}</span>
                <select
                  className={cn(NATIVE_SELECT_CLASS, 'w-full')}
                  value={selectedBinding?.capability ?? 'text.planning'}
                  aria-label={t('hyperframes.modelCenter.bindingCapability')}
                  onChange={(event) =>
                    updateBinding({ capability: event.target.value as ModelCapability })
                  }
                >
                  {MODEL_CAPABILITIES.map((capability) => (
                    <option key={capability} value={capability}>
                      {translateEnum(t, capability)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className={LABEL_CLASS}>{t('hyperframes.modelCenter.quality')}</span>
                <select
                  className={cn(NATIVE_SELECT_CLASS, 'w-full')}
                  value={selectedBinding?.quality ?? 'standard'}
                  aria-label={t('hyperframes.modelCenter.bindingQuality')}
                  onChange={(event) =>
                    updateBinding({ quality: event.target.value as ModelCapabilityQuality })
                  }
                >
                  {QUALITY_OPTIONS.map((quality) => (
                    <option key={quality} value={quality}>
                      {translateEnum(t, quality)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className={LABEL_CLASS}>{t('hyperframes.modelCenter.provider')}</span>
                <select
                  className={cn(NATIVE_SELECT_CLASS, 'w-full')}
                  value={selectedBinding?.profileId ?? activeProfile.id}
                  aria-label={t('hyperframes.modelCenter.bindingProvider')}
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
                      {translateBuiltInModelCenterValue(t, profile.name)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className={LABEL_CLASS}>{t('hyperframes.modelCenter.maxCostPerTask')}</span>
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
                <span className={LABEL_CLASS}>{t('hyperframes.modelCenter.credentialRef')}</span>
                <Input
                  className={INPUT_CLASS}
                  value={credentialRef}
                  onChange={(event) => setCredentialRef(event.target.value)}
                />
              </label>
              <label className="space-y-1">
                <span className={LABEL_CLASS}>{t('hyperframes.modelCenter.label')}</span>
                <Input
                  className={INPUT_CLASS}
                  value={translateBuiltInModelCenterValue(t, credentialLabel)}
                  onChange={(event) => setCredentialLabel(event.target.value)}
                />
              </label>
              <label className="space-y-1">
                <span className={LABEL_CLASS}>{t('hyperframes.modelCenter.scope')}</span>
                <select
                  className={cn(NATIVE_SELECT_CLASS, 'w-full')}
                  value={credentialScope}
                  aria-label={t('hyperframes.modelCenter.credentialScope')}
                  onChange={(event) => setCredentialScope(event.target.value)}
                >
                  <option value="user-local">{translateEnum(t, 'user-local')}</option>
                  <option value="team-secret">{translateEnum(t, 'team-secret')}</option>
                  <option value="session-token">{translateEnum(t, 'session-token')}</option>
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
                {t('hyperframes.common.save')}
              </Button>
            </div>
            <div className="space-y-1.5">
              {Object.values(credentials).map((credential) => (
                <div
                  key={credential.ref}
                  className="grid grid-cols-[minmax(0,1fr)_110px_auto] items-center gap-2 rounded-md border border-border px-2.5 py-2 text-sm"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">
                      {translateBuiltInModelCenterValue(t, credential.label ?? credential.ref)}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {credential.ref}
                    </span>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {translateEnum(t, credential.scope)}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => deleteCredentialMetadata(credential.ref)}
                  >
                    {t('hyperframes.common.remove')}
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
                    ['maxCostPerTask', 'hyperframes.modelCenter.taskBudget'],
                    ['projectBudgetRemaining', 'hyperframes.modelCenter.projectRemaining'],
                    ['userBudgetRemaining', 'hyperframes.modelCenter.userRemaining'],
                    ['teamBudgetRemaining', 'hyperframes.modelCenter.teamRemaining'],
                    ['dailyBudgetRemaining', 'hyperframes.modelCenter.dailyRemaining'],
                    ['confirmationThreshold', 'hyperframes.modelCenter.confirmAbove'],
                  ] as const
                ).map(([key, labelKey]) => (
                  <label key={key} className="space-y-1">
                    <span className={LABEL_CLASS}>{t(labelKey)}</span>
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
                    ['inputTokens', 'hyperframes.common.inputTokens'],
                    ['outputTokens', 'hyperframes.common.outputTokens'],
                    ['images', 'hyperframes.modelCenter.images'],
                    ['audioMinutes', 'hyperframes.modelCenter.audioMinutes'],
                    ['requests', 'hyperframes.modelCenter.requests'],
                  ] as const
                ).map(([key, labelKey]) => (
                  <label key={key} className="space-y-1">
                    <span className={LABEL_CLASS}>{t(labelKey)}</span>
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
                    ? t('hyperframes.modelCenter.requiresConfirmation')
                    : t('hyperframes.modelCenter.withinBudget')}
                </span>
                <span className="text-xs opacity-85">
                  {costEstimate?.estimatedCost === undefined
                    ? t('hyperframes.modelCenter.pricingIncomplete')
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
                  {selectedPolicy
                    ? translateBuiltInModelCenterValue(t, selectedPolicy.name)
                    : t('hyperframes.modelCenter.modelPolicy')}
                </div>
                <div className="text-xs text-muted-foreground">
                  {translateEnum(t, selectedPolicy?.networkMode ?? 'confirm-before-access')}
                </div>
              </div>
              <select
                className={cn(NATIVE_SELECT_CLASS, 'w-48')}
                value={selectedBinding?.toolPolicyId ?? selectedPolicy?.id ?? ''}
                aria-label={t('hyperframes.modelCenter.toolPolicy')}
                onChange={(event) => updateBinding({ toolPolicyId: event.target.value })}
              >
                {Object.values(toolPolicies).map((policy) => (
                  <option key={policy.id} value={policy.id}>
                    {translateBuiltInModelCenterValue(t, policy.name)}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {TOOL_PERMISSIONS.map((permission) => (
                <label key={permission} className="space-y-1">
                  <span className={LABEL_CLASS}>{translateEnum(t, permission)}</span>
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
                        {translateEnum(t, state)}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>

            <Separator className="bg-white/8" />

            <div className="grid grid-cols-3 gap-2">
              <label className="space-y-1">
                <span className={LABEL_CLASS}>{t('hyperframes.modelCenter.sourceFiles')}</span>
                <select
                  className={cn(NATIVE_SELECT_CLASS, 'w-full text-xs')}
                  value={
                    selectedPolicy?.materialScope.sourceFiles ?? DEFAULT_MATERIAL_SCOPE.sourceFiles
                  }
                  aria-label={t('hyperframes.modelCenter.sourceFileScope')}
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
                      {translateEnum(t, option)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className={LABEL_CLASS}>{t('hyperframes.modelCenter.uploadMode')}</span>
                <select
                  className={cn(NATIVE_SELECT_CLASS, 'w-full text-xs')}
                  value={selectedPolicy?.materialScope.uploadMode ?? 'none'}
                  aria-label={t('hyperframes.modelCenter.uploadMode')}
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
                  <option value="none">{translateEnum(t, 'none')}</option>
                  <option value="local-only">{translateEnum(t, 'local-only')}</option>
                  <option value="confirmed-external">
                    {translateEnum(t, 'confirmed-external')}
                  </option>
                </select>
              </label>
              <label className="space-y-1">
                <span className={LABEL_CLASS}>{t('hyperframes.modelCenter.localPaths')}</span>
                <select
                  className={cn(NATIVE_SELECT_CLASS, 'w-full text-xs')}
                  value={selectedPolicy?.materialScope.localPaths ?? 'redacted'}
                  aria-label={t('hyperframes.modelCenter.localPathPolicy')}
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
                  <option value="redacted">{translateEnum(t, 'redacted')}</option>
                  <option value="project-relative">{translateEnum(t, 'project-relative')}</option>
                  <option value="allowed-after-confirmation">
                    {translateEnum(t, 'allowed-after-confirmation')}
                  </option>
                </select>
              </label>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </section>
  )
}
