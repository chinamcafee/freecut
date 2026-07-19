import { memo } from 'react'
import { useTranslation } from 'react-i18next'

export interface StudioPropertyElement {
  id?: string | null
  selector?: string
  tagName?: string
  label?: string
  computedStyles?: Record<string, string>
  dataAttributes?: Record<string, string>
}

export interface PropertyPanelProps {
  element?: StudioPropertyElement | null
  multiSelectCount?: number
  onClearSelection?: () => void
}

export const PropertyPanel = memo(function PropertyPanel({
  element,
  multiSelectCount = 0,
  onClearSelection,
}: PropertyPanelProps) {
  const { t } = useTranslation()
  const labelForElement = (value: StudioPropertyElement): string =>
    value.label ??
    value.id ??
    value.selector ??
    value.tagName ??
    t('hyperframes.studio.selectedElement')
  if (!element) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-neutral-950 px-5 text-center text-neutral-400">
        <div className="text-sm font-medium text-neutral-200">
          {multiSelectCount > 1
            ? t('hyperframes.studio.elementsSelected', { count: multiSelectCount })
            : t('hyperframes.studio.nothingSelected')}
        </div>
        <p className="mt-2 max-w-[240px] text-xs leading-5">
          {t('hyperframes.studio.selectElementHint')}
        </p>
        {multiSelectCount > 0 && (
          <button
            type="button"
            className="mt-3 rounded border border-neutral-700 px-3 py-1 text-xs text-neutral-200"
            onClick={onClearSelection}
          >
            {t('hyperframes.studio.clearSelection')}
          </button>
        )}
      </div>
    )
  }

  const entries = Object.entries(element.dataAttributes ?? {})
  return (
    <aside className="flex h-full flex-col bg-neutral-950 text-neutral-200">
      <header className="border-b border-neutral-800 px-4 py-3">
        <div className="text-xs uppercase tracking-wide text-neutral-500">
          {t('hyperframes.studio.properties')}
        </div>
        <div className="mt-1 truncate text-sm font-medium">{labelForElement(element)}</div>
      </header>
      <div className="flex-1 overflow-auto px-4 py-3">
        <dl className="space-y-3 text-xs">
          <div>
            <dt className="text-neutral-500">{t('hyperframes.studio.tag')}</dt>
            <dd className="mt-1 font-mono text-neutral-200">
              {element.tagName ?? t('hyperframes.common.unknown')}
            </dd>
          </div>
          <div>
            <dt className="text-neutral-500">{t('hyperframes.studio.selector')}</dt>
            <dd className="mt-1 break-all font-mono text-neutral-200">
              {element.selector ?? element.id ?? t('hyperframes.common.unavailable')}
            </dd>
          </div>
          {entries.length > 0 && (
            <div>
              <dt className="text-neutral-500">{t('hyperframes.studio.dataAttributes')}</dt>
              <dd className="mt-2 space-y-1">
                {entries.map(([key, value]) => (
                  <div key={key} className="flex justify-between gap-3 font-mono">
                    <span className="text-neutral-500">{key}</span>
                    <span className="truncate text-neutral-200">{value}</span>
                  </div>
                ))}
              </dd>
            </div>
          )}
        </dl>
      </div>
    </aside>
  )
})
