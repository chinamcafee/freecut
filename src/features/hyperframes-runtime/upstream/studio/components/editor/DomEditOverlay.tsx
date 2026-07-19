import { memo } from 'react'
import type { DomEditLayerItem, StudioSnapGuide } from './studioAdvancedEditing'

export interface DomEditOverlayProps {
  layers: readonly DomEditLayerItem[]
  selectedLayerKey?: string | null
  snapGuides?: readonly StudioSnapGuide[]
  onSelectLayer?: (layer: DomEditLayerItem) => void
}

export const DomEditOverlay = memo(function DomEditOverlay({
  layers,
  selectedLayerKey,
  snapGuides = [],
  onSelectLayer,
}: DomEditOverlayProps) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10" data-hf-dom-edit-overlay="true">
      {snapGuides.map((guide, index) => (
        <div
          key={`${guide.axis}:${guide.value}:${index}`}
          className="absolute bg-cyan-400/50"
          style={
            guide.axis === 'x'
              ? { left: guide.value, top: 0, bottom: 0, width: 1 }
              : { top: guide.value, left: 0, right: 0, height: 1 }
          }
        />
      ))}
      {layers.map((layer) => {
        const geometry = layer.geometry
        if (!geometry) return null
        const selected = layer.key === selectedLayerKey
        return (
          <button
            key={layer.key}
            type="button"
            className={[
              'pointer-events-auto absolute border bg-transparent text-left',
              selected
                ? 'border-cyan-300 shadow-[0_0_0_1px_rgba(103,232,249,0.9)]'
                : 'border-cyan-500/40',
            ].join(' ')}
            style={{
              left: geometry.left,
              top: geometry.top,
              width: geometry.width,
              height: geometry.height,
            }}
            title={layer.label}
            onClick={(event) => {
              event.stopPropagation()
              onSelectLayer?.(layer)
            }}
          >
            <span className="absolute left-0 top-0 max-w-full truncate bg-cyan-500 px-1 py-0.5 text-[10px] font-medium text-neutral-950">
              {layer.label}
            </span>
            {selected && (
              <>
                <span className="absolute -left-1 -top-1 size-2 bg-cyan-200" />
                <span className="absolute -right-1 -top-1 size-2 bg-cyan-200" />
                <span className="absolute -bottom-1 -left-1 size-2 bg-cyan-200" />
                <span className="absolute -bottom-1 -right-1 size-2 bg-cyan-200" />
              </>
            )}
          </button>
        )
      })}
    </div>
  )
})
