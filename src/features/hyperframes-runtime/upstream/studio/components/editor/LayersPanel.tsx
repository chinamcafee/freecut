import { memo, useMemo, useState } from 'react'
import {
  buildInlineStylePatch,
  buildManualMovePatch,
  buildMotionPathPatch,
  buildTextContentPatch,
  sortLayersByVisualStack,
  type DomEditLayerItem,
  type DomEditPatchResult,
} from './studioAdvancedEditing'

export interface LayersPanelProps {
  layers: readonly DomEditLayerItem[]
  selectedLayerKey?: string | null
  canUndo?: boolean
  onSelectLayer?: (layer: DomEditLayerItem) => void
  onPatchLayer?: (
    layer: DomEditLayerItem,
    operations: DomEditPatchResult['operations'],
    label: string,
  ) => void
  onUndo?: () => void
}

export const LayersPanel = memo(function LayersPanel({
  layers,
  selectedLayerKey,
  canUndo = false,
  onSelectLayer,
  onPatchLayer,
  onUndo,
}: LayersPanelProps) {
  const sortedLayers = useMemo(() => sortLayersByVisualStack(layers), [layers])
  const selected = sortedLayers.find((layer) => layer.key === selectedLayerKey) ?? null
  const [property, setProperty] = useState('opacity')
  const [value, setValue] = useState('0.85')
  const [textValue, setTextValue] = useState('Updated text')

  return (
    <aside className="flex h-full min-h-0 flex-col bg-neutral-950 text-neutral-200">
      <header className="border-b border-neutral-800 px-4 py-3">
        <div className="text-xs uppercase tracking-wide text-neutral-500">Layers</div>
        <div className="mt-1 text-sm font-medium">{layers.length} editable elements</div>
      </header>
      <div className="min-h-0 flex-1 overflow-auto">
        {sortedLayers.map((layer) => (
          <button
            key={layer.key}
            type="button"
            className={[
              'flex w-full items-center justify-between gap-3 border-b border-neutral-900 px-3 py-2 text-left text-xs',
              layer.key === selectedLayerKey ? 'bg-cyan-950/60 text-cyan-100' : 'text-neutral-300',
            ].join(' ')}
            style={{ paddingLeft: 12 + layer.depth * 12 }}
            onClick={() => onSelectLayer?.(layer)}
          >
            <span className="min-w-0 truncate">{layer.label}</span>
            <span className="shrink-0 font-mono text-[10px] text-neutral-500">{layer.tagName}</span>
          </button>
        ))}
      </div>
      <section className="border-t border-neutral-800 px-4 py-3 text-xs">
        <div className="mb-2 flex items-center justify-between">
          <span className="font-medium text-neutral-200">Patch</span>
          <button
            type="button"
            className="rounded border border-neutral-700 px-2 py-1 text-neutral-200 disabled:opacity-40"
            disabled={!canUndo}
            onClick={onUndo}
          >
            Undo
          </button>
        </div>
        <div className="space-y-2">
          <input
            className="w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-neutral-100"
            value={property}
            onChange={(event) => setProperty(event.target.value)}
            aria-label="Style property"
          />
          <input
            className="w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-neutral-100"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            aria-label="Style value"
          />
          <button
            type="button"
            className="w-full rounded bg-cyan-500 px-2 py-1 font-medium text-neutral-950 disabled:opacity-40"
            disabled={!selected || !property.trim()}
            onClick={() =>
              selected &&
              onPatchLayer?.(
                selected,
                [buildInlineStylePatch(property.trim(), value)],
                'Style patch',
              )
            }
          >
            Apply Style
          </button>
          <button
            type="button"
            className="w-full rounded border border-neutral-700 px-2 py-1 text-neutral-200 disabled:opacity-40"
            disabled={!selected}
            onClick={() =>
              selected && onPatchLayer?.(selected, buildManualMovePatch(12, 8), 'Manual move')
            }
          >
            Nudge 12,8
          </button>
          <button
            type="button"
            className="w-full rounded border border-neutral-700 px-2 py-1 text-neutral-200 disabled:opacity-40"
            disabled={!selected}
            onClick={() =>
              selected &&
              onPatchLayer?.(
                selected,
                buildMotionPathPatch([
                  { x: 0, y: 0 },
                  { x: 120, y: 60 },
                ]),
                'Motion path',
              )
            }
          >
            Add Motion Path
          </button>
          <input
            className="w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-neutral-100"
            value={textValue}
            onChange={(event) => setTextValue(event.target.value)}
            aria-label="Text content"
          />
          <button
            type="button"
            className="w-full rounded border border-neutral-700 px-2 py-1 text-neutral-200 disabled:opacity-40"
            disabled={!selected}
            onClick={() =>
              selected && onPatchLayer?.(selected, [buildTextContentPatch(textValue)], 'Text patch')
            }
          >
            Apply Text
          </button>
        </div>
      </section>
    </aside>
  )
})
