import { memo } from 'react'
import { Loader2, Pause, Play, Save, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

export interface FreeCutStudioToolbarProps {
  title: string
  itemLabel: string
  activeFilePath: string
  dirty: boolean
  dirtyCount: number
  saving: boolean
  diagnosticsCount: number
  isPlaying: boolean
  onTogglePlay: () => void
  onSave: () => void
  onClose: () => void
}

export const FreeCutStudioToolbar = memo(function FreeCutStudioToolbar({
  title,
  itemLabel,
  activeFilePath,
  dirty,
  dirtyCount,
  saving,
  diagnosticsCount,
  isPlaying,
  onTogglePlay,
  onSave,
  onClose,
}: FreeCutStudioToolbarProps) {
  return (
    <div className="flex h-12 items-center gap-3 border-b border-neutral-800 bg-neutral-950 px-3 text-neutral-100">
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <div className="truncate text-sm font-semibold">{title}</div>
          {dirty && (
            <span className="shrink-0 rounded border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-200">
              Dirty {dirtyCount}
            </span>
          )}
          {diagnosticsCount > 0 && (
            <span className="shrink-0 rounded border border-red-400/30 bg-red-400/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-red-200">
              {diagnosticsCount} diagnostics
            </span>
          )}
        </div>
        <div className="mt-0.5 truncate text-[11px] text-neutral-500">
          {itemLabel} / {activeFilePath}
        </div>
      </div>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-neutral-300 hover:bg-neutral-800 hover:text-white"
        onClick={onTogglePlay}
        aria-label={isPlaying ? 'Pause Studio preview' : 'Play Studio preview'}
      >
        {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </Button>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="h-8 gap-1.5"
        onClick={onSave}
        disabled={!dirty || saving}
      >
        {saving ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Save className="h-3.5 w-3.5" />
        )}
        Save
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-neutral-300 hover:bg-neutral-800 hover:text-white"
        onClick={onClose}
        aria-label="Close Studio"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  )
})
