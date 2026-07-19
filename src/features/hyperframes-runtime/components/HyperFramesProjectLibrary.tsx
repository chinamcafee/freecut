import {
  AlertTriangle,
  Box,
  Download,
  ExternalLink,
  Film,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/shared/ui/cn'
import type {
  HyperFramesProjectLibraryCacheStatus,
  HyperFramesProjectLibraryEntry,
} from './projectLibraryModel'

export interface HyperFramesProjectLibraryProps {
  entries: HyperFramesProjectLibraryEntry[]
  loading?: boolean
  error?: string
  busyProjectId?: string
  onInsert?: (entry: HyperFramesProjectLibraryEntry) => void
  onOpen?: (entry: HyperFramesProjectLibraryEntry) => void
  onExport?: (entry: HyperFramesProjectLibraryEntry) => void
  onValidate?: (entry: HyperFramesProjectLibraryEntry) => void
  onDelete?: (entry: HyperFramesProjectLibraryEntry) => void
}

export function HyperFramesProjectLibrary({
  entries,
  loading = false,
  error,
  busyProjectId,
  onInsert,
  onOpen,
  onExport,
  onValidate,
  onDelete,
}: HyperFramesProjectLibraryProps) {
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
        Loading HyperFrames projects...
      </div>
    )
  }

  if (error) {
    return (
      <div className="m-3 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
        {error}
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-muted-foreground">
        <Box className="h-6 w-6" />
        <p className="text-xs">No HyperFrames projects in this FreeCut project.</p>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto p-3">
      <div className="space-y-2">
        {entries.map((entry) => {
          const busy = busyProjectId === entry.id
          return (
            <article key={entry.id} className="overflow-hidden rounded-md border border-border bg-secondary/20">
              <div className="relative aspect-video overflow-hidden border-b border-border bg-zinc-950">
                {entry.thumbnailUrl ? (
                  <img
                    src={entry.thumbnailUrl}
                    alt=""
                    className="h-full w-full object-cover"
                    draggable={false}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center bg-[linear-gradient(135deg,#18181b_0%,#27272a_52%,#111827_100%)]">
                    <Film className="h-7 w-7 text-zinc-500" />
                  </div>
                )}
                <span
                  className={cn(
                    'absolute left-2 top-2 rounded px-1.5 py-0.5 text-[10px] font-medium',
                    entry.status === 'blocked' && 'bg-red-500/90 text-white',
                    entry.status === 'warning' && 'bg-amber-400/90 text-black',
                    entry.status === 'ready' && 'bg-emerald-500/90 text-black',
                  )}
                >
                  {entry.status}
                </span>
                <span className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white">
                  {entry.manifest.canvas.width}x{entry.manifest.canvas.height}
                </span>
              </div>

              <div className="space-y-2 p-2.5">
                <div className="min-w-0">
                  <h3 className="truncate text-xs font-medium">{entry.title}</h3>
                  <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span>{entry.referenceCount} timeline references</span>
                    <span>{formatCacheStatus(entry.cacheStatus)}</span>
                  </div>
                </div>

                {(entry.blockingCount > 0 || entry.warningCount > 0) && (
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <AlertTriangle className="h-3 w-3" />
                    {entry.blockingCount} blocking · {entry.warningCount} warnings
                  </div>
                )}

                <div className="flex items-center justify-between gap-1 border-t border-border pt-2">
                  <div className="flex gap-1">
                    <LibraryAction
                      label={`Insert ${entry.title}`}
                      icon={Plus}
                      disabled={busy || !onInsert}
                      onClick={() => onInsert?.(entry)}
                    />
                    <LibraryAction
                      label={`Open ${entry.title} in Studio`}
                      icon={ExternalLink}
                      disabled={busy || !onOpen}
                      onClick={() => onOpen?.(entry)}
                    />
                    <LibraryAction
                      label={`Export ${entry.title}`}
                      icon={Download}
                      disabled={busy || !onExport}
                      onClick={() => onExport?.(entry)}
                    />
                    <LibraryAction
                      label={`Validate ${entry.title}`}
                      icon={RefreshCw}
                      disabled={busy || !onValidate}
                      onClick={() => onValidate?.(entry)}
                    />
                  </div>
                  <LibraryAction
                    label={
                      entry.referenceCount > 0
                        ? `Cannot delete ${entry.title}: project is referenced`
                        : `Delete ${entry.title}`
                    }
                    icon={Trash2}
                    destructive
                    disabled={busy || entry.referenceCount > 0 || !onDelete}
                    onClick={() => onDelete?.(entry)}
                  />
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}

function LibraryAction({
  label,
  icon: Icon,
  disabled,
  destructive = false,
  onClick,
}: {
  label: string
  icon: typeof Plus
  disabled: boolean
  destructive?: boolean
  onClick: () => void
}) {
  return (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      className={cn('h-7 w-7', destructive && 'text-destructive hover:text-destructive')}
      aria-label={label}
      data-tooltip={label}
      data-tooltip-side="bottom"
      disabled={disabled}
      onClick={onClick}
    >
      <Icon className="h-3.5 w-3.5" />
    </Button>
  )
}

function formatCacheStatus(status: HyperFramesProjectLibraryCacheStatus): string {
  if (status === 'cached') return 'render cached'
  if (status === 'stale') return 'cache stale'
  return 'not rendered'
}
