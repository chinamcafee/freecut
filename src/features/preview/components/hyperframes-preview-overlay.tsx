import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  HyperFramesPlayerHost,
  createPreviewDocument,
  useFreeCutTimelineClock,
  type HyperFramesPlayerHostHandle,
  type HyperFramesPreviewDocument,
} from '@/features/hyperframes-runtime/bridges/player-bridge'
import { createWorkspaceHyperFramesProjectRepository } from '@/features/hyperframes-runtime/adapters/freecut-project/file-system-project-repository'
import type { HyperFramesProjectRepository } from '@/features/hyperframes-runtime/adapters/freecut-project/project-repository'
import { subscribeHyperFramesProjectUpdated } from '@/features/hyperframes-runtime/events/projectEvents'
import { useProjectStore } from '@/features/editor/deps/projects'
import { useSelectionStore } from '@/shared/state/selection'
import type { HyperFramesDiagnostic } from '@/types/hyperframes'
import type { CompositionItem, TimelineItem } from '@/types/timeline'

type RepositoryFactory = (freecutProjectId?: string) => HyperFramesProjectRepository

interface HyperFramesPreviewOverlayProps {
  items: TimelineItem[]
  fps: number
  repositoryFactory?: RepositoryFactory
  PlayerHostComponent?: typeof HyperFramesPlayerHost
}

interface HyperFramesPreviewTarget {
  item: CompositionItem
  projectId: string
  compositionPath: string
}

type HyperFramesPreviewState =
  | { status: 'idle' }
  | { status: 'loading'; target: HyperFramesPreviewTarget }
  | {
      status: 'ready'
      target: HyperFramesPreviewTarget
      document: HyperFramesPreviewDocument
      sourceFps: number
    }
  | {
      status: 'diagnostic'
      target: HyperFramesPreviewTarget
      diagnostic: HyperFramesDiagnostic
    }

const DEFAULT_REPOSITORY_FACTORY: RepositoryFactory = (freecutProjectId) =>
  createWorkspaceHyperFramesProjectRepository({ freecutProjectId })

function createPreviewDiagnostic(
  target: HyperFramesPreviewTarget,
  code: string,
  message: string,
): HyperFramesDiagnostic {
  return {
    id: `${code}:${target.item.id}`,
    code,
    source: 'runtime',
    stage: 'preview',
    severity: 'blocking',
    message,
    file: target.compositionPath,
  }
}

function resolveSelectedHyperFramesPreviewTarget(
  selectedItemIds: readonly string[],
  items: readonly TimelineItem[],
): HyperFramesPreviewTarget | null {
  if (selectedItemIds.length !== 1) return null
  const selectedItem = items.find((item) => item.id === selectedItemIds[0])
  if (!selectedItem || selectedItem.type !== 'composition') return null
  if (selectedItem.sourceKind !== 'hyperframes') return null
  const projectId = selectedItem.hyperframesProjectId ?? selectedItem.compositionId
  const compositionPath = selectedItem.activeCompositionPath
  if (!projectId || !compositionPath) return null
  return {
    item: selectedItem,
    projectId,
    compositionPath,
  }
}

function sameTarget(left: HyperFramesPreviewTarget | null, right: HyperFramesPreviewTarget | null) {
  return (
    left?.item.id === right?.item.id &&
    left?.projectId === right?.projectId &&
    left?.compositionPath === right?.compositionPath
  )
}

export const HyperFramesPreviewOverlay = memo(function HyperFramesPreviewOverlay({
  items,
  fps,
  repositoryFactory = DEFAULT_REPOSITORY_FACTORY,
  PlayerHostComponent = HyperFramesPlayerHost,
}: HyperFramesPreviewOverlayProps) {
  const playerRef = useRef<HyperFramesPlayerHostHandle | null>(null)
  const [hostReady, setHostReady] = useState(false)
  const selectedItemIds = useSelectionStore((state) => state.selectedItemIds)
  const currentProject = useProjectStore((state) => state.currentProject)
  const [previewState, setPreviewState] = useState<HyperFramesPreviewState>({ status: 'idle' })
  const [projectRevision, setProjectRevision] = useState(0)
  const target = useMemo(
    () => resolveSelectedHyperFramesPreviewTarget(selectedItemIds, items),
    [items, selectedItemIds],
  )

  useEffect(
    () =>
      subscribeHyperFramesProjectUpdated((updatedProjectId) => {
        if (updatedProjectId === target?.projectId) {
          setProjectRevision((revision) => revision + 1)
        }
      }),
    [target?.projectId],
  )

  const setPlayerHostRef = useCallback((host: HyperFramesPlayerHostHandle | null) => {
    playerRef.current = host
    setHostReady(Boolean(host))
  }, [])

  useEffect(() => {
    if (!target || !currentProject) {
      setPreviewState((previous) => (previous.status === 'idle' ? previous : { status: 'idle' }))
      return
    }

    let cancelled = false
    setPreviewState((previous) =>
      sameTarget(previous.status === 'idle' ? null : previous.target, target)
        ? previous
        : { status: 'loading', target },
    )

    const loadPreview = async () => {
      try {
        const repository = repositoryFactory(currentProject.id)
        const [manifest, html] = await Promise.all([
          repository.readManifest(target.projectId),
          repository.readFile(target.projectId, target.compositionPath),
        ])
        if (cancelled) return
        if (!manifest) {
          setPreviewState({
            status: 'diagnostic',
            target,
            diagnostic: createPreviewDiagnostic(
              target,
              'hyperframes.preview.manifest-missing',
              `HyperFrames project manifest not found: ${target.projectId}`,
            ),
          })
          return
        }
        if (!html) {
          setPreviewState({
            status: 'diagnostic',
            target,
            diagnostic: createPreviewDiagnostic(
              target,
              'hyperframes.preview.composition-missing',
              `HyperFrames composition file not found: ${target.compositionPath}`,
            ),
          })
          return
        }

        setPreviewState({
          status: 'ready',
          target,
          sourceFps: manifest.canvas.fps,
          document: createPreviewDocument({
            html,
            projectId: manifest.id,
            compositionPath: target.compositionPath,
            runtime: {
              fps: manifest.canvas.fps,
            },
          }),
        })
      } catch (error) {
        if (cancelled) return
        setPreviewState({
          status: 'diagnostic',
          target,
          diagnostic: createPreviewDiagnostic(
            target,
            'hyperframes.preview.load-failed',
            error instanceof Error ? error.message : 'Failed to load HyperFrames preview.',
          ),
        })
      }
    }

    void loadPreview()
    return () => {
      cancelled = true
    }
  }, [currentProject, projectRevision, repositoryFactory, target])

  const activeTarget = previewState.status === 'idle' ? null : previewState.target
  const sourceOffsetFrame = activeTarget?.item.sourceStart ?? 0
  const sourceFps =
    previewState.status === 'ready' ? previewState.sourceFps : activeTarget?.item.sourceFps
  useFreeCutTimelineClock(playerRef, {
    enabled: previewState.status === 'ready' && hostReady,
    fps,
    sourceFps,
    timelineStartFrame: activeTarget?.item.from ?? 0,
    sourceOffsetFrame,
    speed: activeTarget?.item.speed,
  })

  if (!target || !currentProject) return null

  if (previewState.status === 'ready') {
    return (
      <div className="absolute inset-0 z-[7] bg-video-preview-background" data-hf-preview-overlay>
        <PlayerHostComponent
          ref={setPlayerHostRef}
          previewDocument={previewState.document}
          projectId={previewState.target.projectId}
          compositionPath={previewState.target.compositionPath}
          className="h-full w-full"
          style={{ display: 'block' }}
          onError={(diagnostic) =>
            setPreviewState({
              status: 'diagnostic',
              target: previewState.target,
              diagnostic,
            })
          }
          onRuntimeMessageRejected={(event) =>
            setPreviewState({
              status: 'diagnostic',
              target: previewState.target,
              diagnostic: createPreviewDiagnostic(
                previewState.target,
                'hyperframes.preview.message-rejected',
                `HyperFrames preview message rejected: ${event.reason}`,
              ),
            })
          }
        />
      </div>
    )
  }

  const message =
    previewState.status === 'diagnostic'
      ? previewState.diagnostic.message
      : 'Loading HyperFrames preview...'

  return (
    <div
      className="absolute inset-0 z-[7] flex items-center justify-center bg-black/75 px-6 text-center text-white"
      data-hf-preview-overlay
      data-hf-preview-diagnostic={previewState.status === 'diagnostic' ? 'true' : undefined}
    >
      <div className="max-w-sm rounded border border-white/15 bg-black/60 px-4 py-3 shadow-lg">
        <p className="text-sm font-semibold">HyperFrames preview unavailable</p>
        <p className="mt-1 text-xs text-white/75">{message}</p>
      </div>
    </div>
  )
})
