import { AlertCircle, Cloud, Cpu, KeyRound, WifiOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { useHyperFramesModelCenterStore } from './modelCenterStore'
import { translateBuiltInModelCenterValue } from './modelCenterI18n'
import { getHyperFramesModelStatus, openHyperFramesModelCenter } from './modelStatus'

export function HyperFramesModelStatusButton({
  currentTaskCost,
  online,
  onOpen,
}: {
  currentTaskCost?: number
  online?: boolean
  onOpen?: () => void
}) {
  const { t } = useTranslation()
  const settings = useHyperFramesModelCenterStore()
  const status = getHyperFramesModelStatus(settings, online)
  const profile = settings.profiles[settings.activeProfileId]
  const label = t(
    status.kind === 'offline' && (!profile || !profile.enabled)
      ? 'hyperframes.modelStatus.unavailable'
      : `hyperframes.modelStatus.${status.kind === 'missing-key' ? 'missingKey' : status.kind === 'quota-reached' ? 'quotaReached' : status.kind}`,
  )
  const detail =
    status.detail === 'No enabled model profile'
      ? t('hyperframes.modelStatus.noEnabledProfile')
      : translateBuiltInModelCenterValue(t, status.detail)
  const Icon =
    status.kind === 'local'
      ? Cpu
      : status.kind === 'missing-key'
        ? KeyRound
        : status.kind === 'offline'
          ? WifiOff
          : status.kind === 'configured'
            ? Cloud
            : AlertCircle
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-8 w-full justify-start px-2 text-xs"
      onClick={onOpen ?? openHyperFramesModelCenter}
      title={detail}
    >
      <Icon className="h-3.5 w-3.5" />
      <span className="min-w-0 flex-1 truncate text-left">{label}</span>
      {currentTaskCost !== undefined && (
        <span className="text-[10px] tabular-nums text-muted-foreground">
          ${currentTaskCost.toFixed(2)}
        </span>
      )}
    </Button>
  )
}
