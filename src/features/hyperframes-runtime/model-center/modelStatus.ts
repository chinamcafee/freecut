import type { HyperFramesModelCenterSettings } from './modelCenterStore'

export type HyperFramesModelStatusKind =
  | 'configured'
  | 'local'
  | 'missing-key'
  | 'offline'
  | 'quota-reached'

export interface HyperFramesModelStatus {
  kind: HyperFramesModelStatusKind
  label: string
  detail: string
}

export const OPEN_HYPERFRAMES_MODEL_CENTER_EVENT = 'freecut:settings:open-hyperframes-model-center'

export function getHyperFramesModelStatus(
  settings: HyperFramesModelCenterSettings,
  online = typeof navigator === 'undefined' ? true : navigator.onLine,
): HyperFramesModelStatus {
  const profile = settings.profiles[settings.activeProfileId]
  if (!profile || !profile.enabled) {
    return { kind: 'offline', label: 'Model unavailable', detail: 'No enabled model profile' }
  }
  const isLocal = profile.providerType === 'local' || profile.providerType === 'freecut-built-in'
  if (!online && !isLocal) {
    return { kind: 'offline', label: 'Model offline', detail: profile.name }
  }
  const credentialRef = profile.apiKeyRef ?? profile.authRef
  if (credentialRef && !settings.credentials[credentialRef]) {
    return { kind: 'missing-key', label: 'Model key required', detail: profile.name }
  }
  const remaining = [
    settings.budgetPolicy.dailyBudgetRemaining,
    settings.budgetPolicy.projectBudgetRemaining,
    settings.budgetPolicy.userBudgetRemaining,
    settings.budgetPolicy.teamBudgetRemaining,
  ].filter((value): value is number => value !== undefined)
  if (remaining.some((value) => value <= 0)) {
    return { kind: 'quota-reached', label: 'Model quota reached', detail: profile.name }
  }
  if (isLocal) return { kind: 'local', label: 'Local model', detail: profile.name }
  return { kind: 'configured', label: 'Models ready', detail: profile.name }
}

export function openHyperFramesModelCenter(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(OPEN_HYPERFRAMES_MODEL_CENTER_EVENT))
  }
}
