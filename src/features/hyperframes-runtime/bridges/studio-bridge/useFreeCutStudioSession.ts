import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { HyperFramesProjectRepository } from '@/features/hyperframes-runtime/adapters/freecut-project/project-repository'
import type { HyperFramesProjectFile, HyperFramesProjectManifest } from '@/types/hyperframes'
import {
  createFreeCutStudioAdapter,
  type FreeCutStudioAdapter,
  type FreeCutStudioPatchMeta,
} from './createFreeCutStudioAdapter'
import { StudioSaveQueue } from './studioSaveQueue'
import {
  resolveHyperFramesStudioItem,
  type FreeCutStudioFileState,
  type FreeCutStudioReadyState,
  type FreeCutStudioSessionState,
  type FreeCutStudioTimelineItem,
} from './types'

export type FreeCutStudioRepositoryFactory = (
  freecutProjectId?: string,
) => HyperFramesProjectRepository

export type FreeCutStudioAdapterFactory = (freecutProjectId?: string) => FreeCutStudioAdapter

export interface UseFreeCutStudioSessionOptions {
  freecutProjectId: string
  item: FreeCutStudioTimelineItem | null
  adapterFactory?: FreeCutStudioAdapterFactory
  repositoryFactory?: FreeCutStudioRepositoryFactory
}

export interface FreeCutStudioSession {
  state: FreeCutStudioSessionState
  isDirty: boolean
  selectFile: (path: string) => void
  updateActiveContent: (content: string) => void
  saveAll: () => Promise<boolean>
  reload: () => Promise<void>
  discardChanges: () => void
}

function sortStudioFiles(files: readonly HyperFramesProjectFile[]): HyperFramesProjectFile[] {
  return [...files].sort((left, right) => left.path.localeCompare(right.path))
}

function makeFileState(file: HyperFramesProjectFile): FreeCutStudioFileState {
  return {
    path: file.path,
    content: file.content,
    originalContent: file.content,
    dirty: false,
  }
}

function selectInitialFilePath(
  files: readonly FreeCutStudioFileState[],
  manifest: HyperFramesProjectManifest,
  requestedPath: string | undefined,
): string {
  if (requestedPath && files.some((file) => file.path === requestedPath)) return requestedPath
  if (files.some((file) => file.path === manifest.activeCompositionPath)) {
    return manifest.activeCompositionPath
  }
  return files[0]?.path ?? manifest.activeCompositionPath
}

function sameFileState(left: FreeCutStudioFileState, right: FreeCutStudioFileState): boolean {
  return (
    left.path === right.path &&
    left.content === right.content &&
    left.originalContent === right.originalContent &&
    left.dirty === right.dirty
  )
}

function replaceFileState(
  files: readonly FreeCutStudioFileState[],
  path: string,
  updater: (file: FreeCutStudioFileState) => FreeCutStudioFileState,
): FreeCutStudioFileState[] {
  let changed = false
  const next = files.map((file) => {
    if (file.path !== path) return file
    const updated = updater(file)
    if (!sameFileState(file, updated)) changed = true
    return updated
  })
  return changed ? next : [...files]
}

function buildReadyState(input: {
  freecutProjectId: string
  item: FreeCutStudioTimelineItem
  manifest: HyperFramesProjectManifest
  files: FreeCutStudioFileState[]
  activeFilePath: string
  diagnostics?: FreeCutStudioReadyState['diagnostics']
  saving?: boolean
}): FreeCutStudioReadyState {
  const activeFile =
    input.files.find((file) => file.path === input.activeFilePath) ?? input.files[0] ?? null
  const dirtyFilePaths = input.files.filter((file) => file.dirty).map((file) => file.path)
  return {
    status: 'ready',
    freecutProjectId: input.freecutProjectId,
    hyperframesProjectId: input.manifest.id,
    item: input.item,
    manifest: input.manifest,
    files: input.files,
    activeFilePath: activeFile?.path ?? input.activeFilePath,
    activeContent: activeFile?.content ?? '',
    dirtyFilePaths,
    diagnostics:
      input.diagnostics ??
      input.manifest.diagnostics ??
      input.manifest.lintSummary?.diagnostics ??
      [],
    saving: input.saving ?? false,
  }
}

export function useFreeCutStudioSession({
  freecutProjectId,
  item,
  adapterFactory,
  repositoryFactory,
}: UseFreeCutStudioSessionOptions): FreeCutStudioSession {
  const { t } = useTranslation()
  const [state, setState] = useState<FreeCutStudioSessionState>({ status: 'idle' })
  const adapterFactoryRef = useRef(adapterFactory)
  const repositoryFactoryRef = useRef(repositoryFactory)
  const saveQueueRef = useRef(new StudioSaveQueue())
  adapterFactoryRef.current = adapterFactory
  repositoryFactoryRef.current = repositoryFactory

  const resolvedItem = useMemo(() => resolveHyperFramesStudioItem(item), [item])
  const hyperframesProjectId = resolvedItem?.hyperframesProjectId ?? resolvedItem?.compositionId

  const createAdapter = useCallback(() => {
    const explicitAdapter = adapterFactoryRef.current?.(freecutProjectId)
    if (explicitAdapter) return explicitAdapter
    return createFreeCutStudioAdapter({
      freecutProjectId,
      repository: repositoryFactoryRef.current?.(freecutProjectId),
    })
  }, [freecutProjectId])

  const load = useCallback(async () => {
    if (!resolvedItem || !hyperframesProjectId) {
      setState({ status: 'idle' })
      return
    }

    setState({ status: 'loading', hyperframesProjectId })
    try {
      const adapter = createAdapter()
      const directory = await adapter.resolveProject(hyperframesProjectId)
      if (!directory) {
        setState({
          status: 'error',
          hyperframesProjectId,
          message: t('hyperframes.studio.projectNotFound', { projectId: hyperframesProjectId }),
        })
        return
      }

      const files = sortStudioFiles(directory.files).map(makeFileState)
      const activeFilePath = selectInitialFilePath(
        files,
        directory.manifest,
        resolvedItem.activeCompositionPath,
      )
      setState(
        buildReadyState({
          freecutProjectId,
          item: resolvedItem,
          manifest: directory.manifest,
          files,
          activeFilePath,
        }),
      )
      const lintResult = await adapter.lint(hyperframesProjectId, activeFilePath)
      setState((current) =>
        current.status === 'ready' && current.hyperframesProjectId === hyperframesProjectId
          ? buildReadyState({
              ...current,
              manifest: {
                ...current.manifest,
                lintSummary: lintResult.summary,
              },
              diagnostics: lintResult.diagnostics,
            })
          : current,
      )
    } catch (error) {
      setState({
        status: 'error',
        hyperframesProjectId,
        message: error instanceof Error ? error.message : t('hyperframes.studio.loadFailed'),
      })
    }
  }, [createAdapter, freecutProjectId, hyperframesProjectId, resolvedItem, t])

  useEffect(() => {
    void load()
  }, [load])

  const selectFile = useCallback((path: string) => {
    setState((current) => {
      if (current.status !== 'ready') return current
      if (!current.files.some((file) => file.path === path)) return current
      return buildReadyState({ ...current, activeFilePath: path })
    })
  }, [])

  const updateActiveContent = useCallback((content: string) => {
    setState((current) => {
      if (current.status !== 'ready') return current
      const activeFilePath = current.activeFilePath
      const files = replaceFileState(current.files, activeFilePath, (file) => ({
        ...file,
        content,
        dirty: content !== file.originalContent,
      }))
      return buildReadyState({ ...current, files, activeFilePath })
    })
  }, [])

  const discardChanges = useCallback(() => {
    setState((current) => {
      if (current.status !== 'ready') return current
      const files = current.files.map((file) => ({
        ...file,
        content: file.originalContent,
        dirty: false,
      }))
      return buildReadyState({ ...current, files })
    })
  }, [])

  const saveAll = useCallback(async () => {
    const snapshot = state.status === 'ready' ? state : null
    if (!snapshot) return false
    if (snapshot.dirtyFilePaths.length === 0) return true

    setState((current) =>
      current.status === 'ready' ? buildReadyState({ ...current, saving: true }) : current,
    )

    try {
      await saveQueueRef.current.enqueue(async () => {
        const adapter = createAdapter()
        const dirtyFiles = snapshot.files.filter((file) => file.dirty)
        const meta: FreeCutStudioPatchMeta = {
          reason: 'studio-save',
          userInitiated: true,
          provenance: {
            source: 'studio-edit',
            freecutProjectId,
            timelineItemId: snapshot.item.id,
          },
        }
        const savedAt = Date.now()

        const snapshotId =
          dirtyFiles.length > 0
            ? (await adapter.createSnapshot(snapshot.hyperframesProjectId, 'studio-save')).id
            : undefined

        for (const file of dirtyFiles) {
          await adapter.writeFile(snapshot.hyperframesProjectId, file.path, file.content, meta)
        }

        const lintResult = await adapter.lint(
          snapshot.hyperframesProjectId,
          snapshot.activeFilePath,
        )
        await adapter.writeManifest(
          snapshot.hyperframesProjectId,
          {
            ...snapshot.manifest,
            lintSummary: lintResult.summary,
            lastStudioSave: {
              savedAt,
              files: dirtyFiles.map((file) => file.path),
              snapshotId,
            },
          },
          meta,
        )

        setState((current) => {
          if (current.status !== 'ready') return current
          const savedPathSet = new Set(dirtyFiles.map((file) => file.path))
          const files = current.files.map((file) =>
            savedPathSet.has(file.path)
              ? {
                  ...file,
                  originalContent: file.content,
                  dirty: false,
                }
              : file,
          )
          return buildReadyState({
            ...current,
            manifest: {
              ...current.manifest,
              lintSummary: lintResult.summary,
              lastStudioSave: {
                savedAt,
                files: dirtyFiles.map((file) => file.path),
                snapshotId,
              },
            },
            diagnostics: lintResult.diagnostics,
            files,
            saving: false,
          })
        })
      })
      return true
    } catch (error) {
      setState((current) => {
        if (current.status !== 'ready') return current
        return buildReadyState({
          ...current,
          manifest: {
            ...current.manifest,
            diagnostics: [
              ...(current.manifest.diagnostics ?? []),
              {
                id: `studio-save:${Date.now().toString(36)}`,
                code: 'hyperframes.studio.save-failed',
                source: 'storage',
                stage: 'studio-save',
                severity: 'blocking',
                message:
                  error instanceof Error ? error.message : t('hyperframes.studio.saveFailed'),
              },
            ],
          },
          saving: false,
        })
      })
      return false
    }
  }, [createAdapter, freecutProjectId, state, t])

  return {
    state,
    isDirty: state.status === 'ready' && state.dirtyFilePaths.length > 0,
    selectFile,
    updateActiveContent,
    saveAll,
    reload: load,
    discardChanges,
  }
}
