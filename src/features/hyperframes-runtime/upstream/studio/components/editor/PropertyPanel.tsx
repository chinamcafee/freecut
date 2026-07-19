import { memo } from 'react'

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

function labelForElement(element: StudioPropertyElement): string {
  return element.label ?? element.id ?? element.selector ?? element.tagName ?? 'Selected element'
}

export const PropertyPanel = memo(function PropertyPanel({
  element,
  multiSelectCount = 0,
  onClearSelection,
}: PropertyPanelProps) {
  if (!element) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-neutral-950 px-5 text-center text-neutral-400">
        <div className="text-sm font-medium text-neutral-200">
          {multiSelectCount > 1 ? `${multiSelectCount} elements selected` : 'Nothing selected'}
        </div>
        <p className="mt-2 max-w-[240px] text-xs leading-5">
          Select an element in the Studio preview to inspect editable source properties.
        </p>
        {multiSelectCount > 0 && (
          <button
            type="button"
            className="mt-3 rounded border border-neutral-700 px-3 py-1 text-xs text-neutral-200"
            onClick={onClearSelection}
          >
            Clear selection
          </button>
        )}
      </div>
    )
  }

  const entries = Object.entries(element.dataAttributes ?? {})
  return (
    <aside className="flex h-full flex-col bg-neutral-950 text-neutral-200">
      <header className="border-b border-neutral-800 px-4 py-3">
        <div className="text-xs uppercase tracking-wide text-neutral-500">Properties</div>
        <div className="mt-1 truncate text-sm font-medium">{labelForElement(element)}</div>
      </header>
      <div className="flex-1 overflow-auto px-4 py-3">
        <dl className="space-y-3 text-xs">
          <div>
            <dt className="text-neutral-500">Tag</dt>
            <dd className="mt-1 font-mono text-neutral-200">{element.tagName ?? 'unknown'}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Selector</dt>
            <dd className="mt-1 break-all font-mono text-neutral-200">
              {element.selector ?? element.id ?? 'unavailable'}
            </dd>
          </div>
          {entries.length > 0 && (
            <div>
              <dt className="text-neutral-500">Data attributes</dt>
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
