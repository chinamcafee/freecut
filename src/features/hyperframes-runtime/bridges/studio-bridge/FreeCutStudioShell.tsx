import { memo, useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { emitHyperFramesProjectUpdated } from '@/features/hyperframes-runtime/events/projectEvents'
import { useTimelinePlayer } from '@/features/hyperframes-runtime/upstream/studio/player/hooks/useTimelinePlayer'
import { cn } from '@/shared/ui/cn'
import { FreeCutStudioPanels } from './FreeCutStudioPanels'
import { FreeCutStudioToolbar } from './FreeCutStudioToolbar'
import { isEditableKeyboardTarget } from './studioEvents'
import { createFreeCutStudioThemeTokens } from './studioThemeAdapter'
import {
  useFreeCutStudioSession,
  type FreeCutStudioAdapterFactory,
  type FreeCutStudioRepositoryFactory,
} from './useFreeCutStudioSession'
import type { FreeCutStudioTimelineItem } from './types'

export interface FreeCutStudioShellProps {
  freecutProjectId: string
  item: FreeCutStudioTimelineItem | null
  onClose: () => void
  onDirtyChange?: (dirty: boolean) => void
  adapterFactory?: FreeCutStudioAdapterFactory
  repositoryFactory?: FreeCutStudioRepositoryFactory
  className?: string
}

function createPreviewUrl(content: string | null): string | null {
  if (
    !content ||
    typeof URL === 'undefined' ||
    typeof URL.createObjectURL !== 'function' ||
    typeof Blob === 'undefined'
  ) {
    return null
  }
  return URL.createObjectURL(new Blob([content], { type: 'text/html' }))
}

export const FreeCutStudioShell = memo(function FreeCutStudioShell({
  freecutProjectId,
  item,
  onClose,
  onDirtyChange,
  adapterFactory,
  repositoryFactory,
  className,
}: FreeCutStudioShellProps) {
  const { t } = useTranslation()
  const session = useFreeCutStudioSession({
    freecutProjectId,
    item,
    adapterFactory,
    repositoryFactory,
  })
  const player = useTimelinePlayer()
  const theme = useMemo(() => createFreeCutStudioThemeTokens(), [])
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const onDirtyChangeRef = useRef(onDirtyChange)
  const hyperframesProjectId = item?.hyperframesProjectId ?? item?.compositionId
  onDirtyChangeRef.current = onDirtyChange

  useEffect(() => {
    onDirtyChangeRef.current?.(session.isDirty)
  }, [session.isDirty])

  useEffect(() => {
    const url = createPreviewUrl(
      session.state.status === 'ready' ? session.state.activeContent : null,
    )
    setPreviewUrl(url)
    return () => {
      if (url && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(url)
    }
  }, [session.state])

  const requestClose = useCallback(() => {
    if (session.isDirty) {
      setConfirmCloseOpen(true)
      return
    }
    onClose()
  }, [onClose, session.isDirty])

  const handleDiscardAndClose = useCallback(() => {
    session.discardChanges()
    onDirtyChange?.(false)
    setConfirmCloseOpen(false)
    onClose()
  }, [onClose, onDirtyChange, session])

  const handleSaveAndClose = useCallback(async () => {
    const saved = await session.saveAll()
    if (!saved) return
    if (hyperframesProjectId) emitHyperFramesProjectUpdated(hyperframesProjectId)
    onDirtyChange?.(false)
    setConfirmCloseOpen(false)
    onClose()
  }, [hyperframesProjectId, onClose, onDirtyChange, session])

  const handleSave = useCallback(async () => {
    const saved = await session.saveAll()
    if (!saved) return
    if (hyperframesProjectId) emitHyperFramesProjectUpdated(hyperframesProjectId)
    onDirtyChange?.(false)
  }, [hyperframesProjectId, onDirtyChange, session])

  const handleKeyDownCapture = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      const key = event.key.toLowerCase()
      const isMod = event.metaKey || event.ctrlKey
      const editableTarget = isEditableKeyboardTarget(event.target)

      if (isMod && key === 's') {
        event.preventDefault()
        event.stopPropagation()
        void handleSave()
        return
      }

      if (key === 'escape') {
        event.preventDefault()
        event.stopPropagation()
        requestClose()
        return
      }

      if (!editableTarget && key === ' ') {
        event.preventDefault()
        event.stopPropagation()
        player.togglePlay()
        return
      }

      if (!editableTarget && (key === 'delete' || key === 'backspace')) {
        event.preventDefault()
        event.stopPropagation()
        return
      }

      if (isMod && key === 'z') {
        // Keep native source-editor undo while preventing FreeCut timeline undo.
        if (!editableTarget) event.preventDefault()
        event.stopPropagation()
      }
    },
    [handleSave, player, requestClose],
  )

  if (!item) return null

  const ready = session.state.status === 'ready' ? session.state : null
  const title = ready?.manifest.title ?? item.label ?? t('hyperframes.studio.title')

  return (
    <div
      className={cn(
        theme.rootClassName,
        theme.surfaceClassName,
        'fixed inset-0 z-40 flex flex-col',
        className,
      )}
      style={theme.rootStyle}
      data-hf-studio-shell
      data-hf-studio-icon-library={theme.iconLibrary}
      role="dialog"
      aria-modal="true"
      aria-label={t('hyperframes.studio.title')}
      onKeyDownCapture={handleKeyDownCapture}
    >
      {ready ? (
        <FreeCutStudioPanels
          session={ready}
          player={player}
          previewUrl={previewUrl}
          onSelectFile={session.selectFile}
          onActiveContentChange={session.updateActiveContent}
          toolbar={
            <FreeCutStudioToolbar
              title={title}
              itemLabel={item.label ?? item.id}
              activeFilePath={ready.activeFilePath}
              dirty={ready.dirtyFilePaths.length > 0}
              dirtyCount={ready.dirtyFilePaths.length}
              saving={ready.saving}
              diagnosticsCount={ready.diagnostics.length}
              isPlaying={player.isPlaying}
              onTogglePlay={player.togglePlay}
              onSave={() => void handleSave()}
              onClose={requestClose}
            />
          }
        />
      ) : (
        <div className="flex h-full flex-col">
          <div className="flex h-12 items-center justify-between border-b border-neutral-800 px-3">
            <div className="min-w-0 truncate text-sm font-semibold">{title}</div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-neutral-300 hover:bg-neutral-800 hover:text-white"
              onClick={requestClose}
            >
              {t('hyperframes.common.close')}
            </Button>
          </div>
          <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-neutral-400">
            {session.state.status === 'error'
              ? session.state.message
              : t('hyperframes.studio.loading')}
          </div>
        </div>
      )}

      <AlertDialog open={confirmCloseOpen} onOpenChange={setConfirmCloseOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('hyperframes.studio.unsavedTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('hyperframes.studio.unsavedDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('hyperframes.studio.keepEditing')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDiscardAndClose}
            >
              {t('hyperframes.studio.discardChanges')}
            </AlertDialogAction>
            <AlertDialogAction onClick={() => void handleSaveAndClose()}>
              {t('hyperframes.studio.saveAndClose')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
})
