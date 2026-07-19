import { useCallback, useEffect, useState } from 'react'
import { FileCode2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useTimelineStore } from '@/features/editor/deps/timeline-store'
import { createWorkspaceHyperFramesProjectRepository } from '@/features/hyperframes-runtime/adapters/freecut-project/file-system-project-repository'
import { packHyperFramesProjectDirectory } from '@/features/hyperframes-runtime/adapters/freecut-project/project-directory-bundle'
import { emitFreeCutStudioOpenRequest } from '@/features/hyperframes-runtime/bridges/studio-bridge/studioEvents'
import {
  subscribeHyperFramesTimelineActions,
  type HyperFramesTimelineActionRequest,
} from '@/features/hyperframes-runtime/bridges/studio-bridge/timelineActions'
import type { HyperFramesProjectManifest } from '@/types/hyperframes'
import type { CompositionItem, TimelineItem } from '@/types/timeline'

interface HyperFramesTimelineActionControllerProps {
  freecutProjectId: string
}

interface RelinkState {
  request: HyperFramesTimelineActionRequest
  loading: boolean
  manifests: HyperFramesProjectManifest[]
  error?: string
}

function isHyperFramesItem(item: TimelineItem | undefined): item is CompositionItem {
  return item?.type === 'composition' && item.sourceKind === 'hyperframes'
}

export function HyperFramesTimelineActionController({
  freecutProjectId,
}: HyperFramesTimelineActionControllerProps) {
  const [relink, setRelink] = useState<RelinkState>()

  const findItem = useCallback((timelineItemId: string) => {
    const item = useTimelineStore.getState().items.find((candidate) => candidate.id === timelineItemId)
    return isHyperFramesItem(item) ? item : undefined
  }, [])

  const exportProject = useCallback(
    async (request: HyperFramesTimelineActionRequest) => {
      const repository = createWorkspaceHyperFramesProjectRepository({ freecutProjectId })
      const directory = await repository.readProjectDirectory(request.hyperframesProjectId)
      if (!directory) throw new Error('HyperFrames project directory not found')
      const bytes = packHyperFramesProjectDirectory(directory)
      const url = URL.createObjectURL(
        new Blob([bytes.buffer as ArrayBuffer], { type: 'application/zip' }),
      )
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `${request.hyperframesProjectId}.hyperframes.zip`
      anchor.click()
      URL.revokeObjectURL(url)
      toast.success('HyperFrames project exported')
    },
    [freecutProjectId],
  )

  const convertToNative = useCallback(
    async (request: HyperFramesTimelineActionRequest) => {
      const item = findItem(request.timelineItemId)
      if (!item) throw new Error('HyperFrames timeline item not found')
      const repository = createWorkspaceHyperFramesProjectRepository({ freecutProjectId })
      const directory = await repository.readProjectDirectory(request.hyperframesProjectId)
      if (!directory) throw new Error('HyperFrames project directory not found')
      const { createEditableFreeCutApproximations } = await import(
        '@/features/hyperframes-runtime/bridges/conversion-bridge/hyperFramesEditableApproximation'
      )
      const result = createEditableFreeCutApproximations({
        directory,
        targetTrackId: item.trackId,
        startFrame: item.from,
        parentTimelineItemId: item.id,
      })
      if (result.items.length === 0) {
        toast.info('No supported data-hf-item nodes were available for native conversion')
        return
      }
      useTimelineStore.getState().addItems(result.items as TimelineItem[])
      toast.success(
        `Added ${result.items.length} native approximation${result.items.length === 1 ? '' : 's'}`,
        {
          description:
            result.lossRecords.length > 0
              ? `${result.lossRecords.length} conversion limitation${result.lossRecords.length === 1 ? '' : 's'} recorded`
              : undefined,
        },
      )
    },
    [findItem, freecutProjectId],
  )

  const openRelink = useCallback(
    async (request: HyperFramesTimelineActionRequest) => {
      setRelink({ request, loading: true, manifests: [] })
      try {
        const repository = createWorkspaceHyperFramesProjectRepository({ freecutProjectId })
        const refs = await repository.listProjectRefs(freecutProjectId)
        const manifests = (
          await Promise.all(refs.map((ref) => repository.readManifest(ref.id)))
        ).filter((manifest): manifest is HyperFramesProjectManifest => Boolean(manifest))
        setRelink({ request, loading: false, manifests })
      } catch (error) {
        setRelink({
          request,
          loading: false,
          manifests: [],
          error: error instanceof Error ? error.message : 'Failed to load HyperFrames projects',
        })
      }
    },
    [freecutProjectId],
  )

  const handleRequest = useCallback(
    async (request: HyperFramesTimelineActionRequest) => {
      try {
        if (request.action === 'export-project') {
          await exportProject(request)
          return
        }
        if (request.action === 'convert-to-native') {
          await convertToNative(request)
          return
        }
        if (request.action === 'relink-project') {
          await openRelink(request)
          return
        }
        const item = findItem(request.timelineItemId)
        if (!item) throw new Error('HyperFrames timeline item not found')
        if (request.action === 'view-source') {
          emitFreeCutStudioOpenRequest({ item: { ...item, sourceKind: 'hyperframes' } })
          return
        }
        toast.error('HyperFrames Producer runtime is not configured', {
          description: 'Configure the local Producer service before rerendering this project.',
        })
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'HyperFrames action failed')
      }
    },
    [convertToNative, exportProject, findItem, openRelink],
  )

  useEffect(
    () => subscribeHyperFramesTimelineActions((request) => void handleRequest(request)),
    [handleRequest],
  )

  const applyRelink = (manifest: HyperFramesProjectManifest) => {
    if (!relink) return
    const item = findItem(relink.request.timelineItemId)
    if (!item) {
      toast.error('HyperFrames timeline item not found')
      return
    }
    const diagnostics = manifest.lintSummary?.diagnostics ?? manifest.diagnostics ?? []
    const hasBlocking = diagnostics.some((diagnostic) => diagnostic.severity === 'blocking')
    const hasWarning = diagnostics.some((diagnostic) => diagnostic.severity === 'warning')
    useTimelineStore.getState().updateItem(item.id, {
      compositionId: manifest.id,
      hyperframesProjectId: manifest.id,
      activeCompositionPath: manifest.activeCompositionPath,
      hyperframesManifestPath: `hyperframes/${manifest.id}/manifest.json`,
      compositionWidth: manifest.canvas.width,
      compositionHeight: manifest.canvas.height,
      hyperframesVisualState: {
        diagnosticStatus: hasBlocking ? 'error' : hasWarning ? 'warning' : 'ready',
        cacheStatus: 'missing',
        renderStatus: 'idle',
        studioDirty: false,
      },
    })
    setRelink(undefined)
    toast.success(`Relinked to ${manifest.title}`)
  }

  return (
    <Dialog open={Boolean(relink)} onOpenChange={(open) => !open && setRelink(undefined)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Relink HyperFrames project</DialogTitle>
          <DialogDescription>
            Choose another project directory for this timeline reference. Timeline position and
            trim are preserved.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-72 space-y-2 overflow-y-auto py-1">
          {relink?.loading && (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading projects...
            </div>
          )}
          {relink?.error && <p className="text-sm text-destructive">{relink.error}</p>}
          {relink && !relink.loading && !relink.error && relink.manifests.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No HyperFrames projects are available.
            </p>
          )}
          {relink?.manifests.map((manifest) => {
            const current = manifest.id === relink.request.hyperframesProjectId
            return (
              <button
                key={manifest.id}
                type="button"
                className="flex w-full items-center gap-3 rounded-md border border-border px-3 py-2 text-left hover:bg-accent disabled:cursor-default disabled:opacity-60"
                disabled={current}
                onClick={() => applyRelink(manifest)}
              >
                <FileCode2 className="h-4 w-4 shrink-0 text-primary" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{manifest.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {manifest.activeCompositionPath}
                  </span>
                </span>
                {current && <span className="text-xs text-muted-foreground">Current</span>}
              </button>
            )
          })}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setRelink(undefined)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
