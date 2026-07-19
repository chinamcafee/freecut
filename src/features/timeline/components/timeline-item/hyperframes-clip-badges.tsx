import { AlertTriangle, CheckCircle2, LoaderCircle, XCircle } from 'lucide-react'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import type { TimelineItem } from '@/types/timeline'
import { getHyperFramesClipVisualState } from './hyperframes-clip-visual-state'

export function HyperFramesClipBadges({ item }: { item: TimelineItem }) {
  const { t } = useTranslation()
  const state = getHyperFramesClipVisualState(item)
  if (!state) return null

  const status = resolveStatus(state, t)
  const StatusIcon = status.icon

  return (
    <div className="pointer-events-none absolute inset-0 z-20 text-[8px] font-semibold">
      <span
        className="absolute left-0.5 top-0.5 rounded-sm bg-black/75 px-1 py-0.5 leading-none text-cyan-200"
        title={t('hyperframes.timeline.sourceLinkedTitle')}
      >
        HF
      </span>
      <span
        className={`absolute bottom-0.5 right-0.5 flex items-center gap-0.5 rounded-sm bg-black/75 px-1 py-0.5 leading-none ${status.className}`}
        title={status.title}
      >
        <StatusIcon className={`h-2.5 w-2.5 ${status.spin ? 'animate-spin' : ''}`} />
        <span className="max-w-16 truncate">{status.label}</span>
      </span>
      {state.studioDirty && (
        <span
          className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full border border-black/70 bg-orange-400"
          title={t('hyperframes.timeline.unsavedStudioChanges')}
        />
      )}
    </div>
  )
}

function resolveStatus(state: ReturnType<typeof getHyperFramesClipVisualState> & {}, t: TFunction) {
  if (state.renderStatus === 'rendering') {
    return {
      icon: LoaderCircle,
      label: t('hyperframes.timeline.rendering'),
      title: t('hyperframes.timeline.renderingTitle'),
      className: 'text-sky-200',
      spin: true,
    }
  }
  if (state.diagnosticStatus === 'error') {
    return {
      icon: XCircle,
      label: t('hyperframes.timeline.error'),
      title: t('hyperframes.timeline.errorTitle'),
      className: 'text-red-200',
      spin: false,
    }
  }
  if (state.diagnosticStatus === 'warning') {
    return {
      icon: AlertTriangle,
      label: t('hyperframes.timeline.warning'),
      title: t('hyperframes.timeline.warningTitle'),
      className: 'text-amber-200',
      spin: false,
    }
  }
  if (state.cacheStatus === 'stale') {
    return {
      icon: AlertTriangle,
      label: t('hyperframes.timeline.stale'),
      title: t('hyperframes.timeline.staleTitle'),
      className: 'text-amber-200',
      spin: false,
    }
  }
  if (state.cacheStatus === 'fresh') {
    return {
      icon: CheckCircle2,
      label: t('hyperframes.timeline.cached'),
      title: t('hyperframes.timeline.cachedTitle'),
      className: 'text-emerald-200',
      spin: false,
    }
  }
  return {
    icon: CheckCircle2,
    label: t('hyperframes.timeline.live'),
    title: t('hyperframes.timeline.liveTitle'),
    className: 'text-cyan-200',
    spin: false,
  }
}
