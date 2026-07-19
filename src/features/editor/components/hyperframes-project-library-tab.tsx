import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useProjectStore } from '@/features/editor/deps/projects'
import { useTimelineStore } from '@/features/editor/deps/timeline-store'
import { usePlaybackStore } from '@/shared/state/playback'
import { useSelectionStore } from '@/shared/state/selection'
import type { HyperFramesProjectManifest } from '@/types/hyperframes'
import type { CompositionItem } from '@/types/timeline'
import {
  HyperFramesProjectLibrary,
} from '@/features/hyperframes-runtime/components/HyperFramesProjectLibrary'
import {
  createHyperFramesProjectLibraryEntries,
  type HyperFramesProjectLibraryEntry,
} from '@/features/hyperframes-runtime/components/projectLibraryModel'
import {
  createWorkspaceHyperFramesProjectRepository,
} from '@/features/hyperframes-runtime/adapters/freecut-project/file-system-project-repository'
import { packHyperFramesProjectDirectory } from '@/features/hyperframes-runtime/adapters/freecut-project/project-directory-bundle'
import type { HyperFramesProjectRepository } from '@/features/hyperframes-runtime/adapters/freecut-project/project-repository'
import { emitFreeCutStudioOpenRequest } from '@/features/hyperframes-runtime/bridges/studio-bridge/studioEvents'
import {
  emitHyperFramesProjectUpdated,
  subscribeHyperFramesProjectUpdated,
} from '@/features/hyperframes-runtime/events/projectEvents'

export function HyperFramesProjectLibraryTab() {
  const freecutProjectId = useProjectStore((state) => state.currentProject?.id)
  const timelineItems = useTimelineStore((state) => state.items)
  const tracks = useTimelineStore((state) => state.tracks)
  const addItem = useTimelineStore((state) => state.addItem)
  const currentFrame = usePlaybackStore((state) => state.currentFrame)
  const selectItems = useSelectionStore((state) => state.selectItems)
  const [manifests, setManifests] = useState<HyperFramesProjectManifest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>()
  const [busyProjectId, setBusyProjectId] = useState<string>()
  const repositoryRef = useRef<HyperFramesProjectRepository | undefined>(undefined)

  const loadProjects = useCallback(async () => {
    if (!freecutProjectId) {
      setManifests([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(undefined)
    try {
      const repository = createWorkspaceHyperFramesProjectRepository({ freecutProjectId })
      repositoryRef.current = repository
      const refs = await repository.listProjectRefs(freecutProjectId)
      const loaded = await Promise.all(refs.map((ref) => repository.readManifest(ref.id)))
      setManifests(loaded.filter((value): value is HyperFramesProjectManifest => Boolean(value)))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load projects')
    } finally {
      setLoading(false)
    }
  }, [freecutProjectId])

  useEffect(() => {
    void loadProjects()
  }, [loadProjects])

  useEffect(
    () => subscribeHyperFramesProjectUpdated(() => void loadProjects()),
    [loadProjects],
  )

  const entries = useMemo(
    () => createHyperFramesProjectLibraryEntries({ manifests, timelineItems }),
    [manifests, timelineItems],
  )

  const createTimelineItem = useCallback(
    (entry: HyperFramesProjectLibraryEntry): CompositionItem | undefined => {
      const track = tracks.find((candidate) => candidate.kind !== 'audio' && !candidate.locked)
      if (!track) return undefined
      return {
        id: crypto.randomUUID(),
        trackId: track.id,
        from: currentFrame,
        durationInFrames: entry.manifest.canvas.durationInFrames,
        label: entry.title,
        type: 'composition',
        compositionId: entry.id,
        sourceKind: 'hyperframes',
        hyperframesProjectId: entry.id,
        activeCompositionPath: entry.manifest.activeCompositionPath,
        hyperframesManifestPath: `hyperframes/${entry.id}/manifest.json`,
        hyperframesVisualState: {
          diagnosticStatus:
            entry.status === 'blocked' ? 'error' : entry.status === 'warning' ? 'warning' : 'ready',
          cacheStatus:
            entry.cacheStatus === 'cached'
              ? 'fresh'
              : entry.cacheStatus === 'stale'
                ? 'stale'
                : 'missing',
          renderStatus: 'idle',
          studioDirty: false,
        },
        compositionWidth: entry.manifest.canvas.width,
        compositionHeight: entry.manifest.canvas.height,
      }
    },
    [currentFrame, tracks],
  )

  const handleInsert = useCallback(
    (entry: HyperFramesProjectLibraryEntry) => {
      const item = createTimelineItem(entry)
      if (!item) {
        toast.error('No unlocked video track is available')
        return
      }
      addItem(item)
      selectItems([item.id])
      toast.success(`Inserted ${entry.title}`)
    },
    [addItem, createTimelineItem, selectItems],
  )

  const handleOpen = useCallback(
    (entry: HyperFramesProjectLibraryEntry) => {
      const linkedItem = timelineItems.find(
        (item): item is CompositionItem =>
          item.type === 'composition' &&
          item.sourceKind === 'hyperframes' &&
          (item.hyperframesProjectId ?? item.compositionId) === entry.id,
      )
      const item = linkedItem ?? createTimelineItem(entry)
      if (!item) {
        toast.error('No video track is available to open this project')
        return
      }
      emitFreeCutStudioOpenRequest({ item: { ...item, sourceKind: 'hyperframes' } })
    },
    [createTimelineItem, timelineItems],
  )

  const handleExport = useCallback(async (entry: HyperFramesProjectLibraryEntry) => {
    const repository = repositoryRef.current
    if (!repository) return
    setBusyProjectId(entry.id)
    try {
      const directory = await repository.readProjectDirectory(entry.id)
      if (!directory) throw new Error('Project directory not found')
      const bytes = packHyperFramesProjectDirectory(directory)
      const url = URL.createObjectURL(
        new Blob([bytes.buffer as ArrayBuffer], { type: 'application/zip' }),
      )
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `${entry.id}.hyperframes.zip`
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (exportError) {
      toast.error(exportError instanceof Error ? exportError.message : 'Export failed')
    } finally {
      setBusyProjectId(undefined)
    }
  }, [])

  const handleValidate = useCallback(async (entry: HyperFramesProjectLibraryEntry) => {
    const repository = repositoryRef.current
    if (!repository) return
    setBusyProjectId(entry.id)
    try {
      const directory = await repository.readProjectDirectory(entry.id)
      if (!directory) throw new Error('Project directory not found')
      const { hyperFramesLintAdapter } =
        await import('@/features/hyperframes-runtime/adapters/freecut-project/lint-adapter')
      const result = await hyperFramesLintAdapter.lintProjectDirectory(directory, {
        stage: 'preview',
      })
      const diagnostics = result.diagnostics
      await repository.writeManifest(
        entry.id,
        {
          ...directory.manifest,
          diagnostics,
          lintSummary: {
            checkedAt: Date.now(),
            blockingCount: diagnostics.filter((item) => item.severity === 'blocking').length,
            warningCount: diagnostics.filter((item) => item.severity === 'warning').length,
            suggestionCount: diagnostics.filter((item) => item.severity === 'suggestion').length,
            diagnostics,
          },
        },
        { reason: 'Validate project from library' },
      )
      emitHyperFramesProjectUpdated(entry.id)
      await loadProjects()
    } catch (validationError) {
      toast.error(validationError instanceof Error ? validationError.message : 'Validation failed')
    } finally {
      setBusyProjectId(undefined)
    }
  }, [loadProjects])

  const handleDelete = useCallback(async (entry: HyperFramesProjectLibraryEntry) => {
    if (entry.referenceCount > 0) return
    const repository = repositoryRef.current
    if (!repository) return
    setBusyProjectId(entry.id)
    try {
      await repository.deleteProject(entry.id)
      await loadProjects()
      toast.success(`Deleted ${entry.title}`)
    } catch (deleteError) {
      toast.error(deleteError instanceof Error ? deleteError.message : 'Delete failed')
    } finally {
      setBusyProjectId(undefined)
    }
  }, [loadProjects])

  return (
    <HyperFramesProjectLibrary
      entries={entries}
      loading={loading}
      error={error}
      busyProjectId={busyProjectId}
      onInsert={handleInsert}
      onOpen={handleOpen}
      onExport={(entry) => void handleExport(entry)}
      onValidate={(entry) => void handleValidate(entry)}
      onDelete={(entry) => void handleDelete(entry)}
    />
  )
}
