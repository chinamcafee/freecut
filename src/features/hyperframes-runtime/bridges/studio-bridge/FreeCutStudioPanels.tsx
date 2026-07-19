import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { DomEditOverlay } from '@/features/hyperframes-runtime/upstream/studio/components/editor/DomEditOverlay'
import { FileTree } from '@/features/hyperframes-runtime/upstream/studio/components/editor/FileTree'
import { LayersPanel } from '@/features/hyperframes-runtime/upstream/studio/components/editor/LayersPanel'
import { PropertyPanel } from '@/features/hyperframes-runtime/upstream/studio/components/editor/PropertyPanel'
import { SourceEditor } from '@/features/hyperframes-runtime/upstream/studio/components/editor/SourceEditor'
import {
  applyDomEditOperationsToHtml,
  extractDomEditLayers,
  type DomEditLayerItem,
  type DomEditPatchResult,
} from '@/features/hyperframes-runtime/upstream/studio/components/editor/studioAdvancedEditing'
import { NLELayout } from '@/features/hyperframes-runtime/upstream/studio/components/nle/NLELayout'
import { NLEPreview } from '@/features/hyperframes-runtime/upstream/studio/components/nle/NLEPreview'
import type { StudioTimelinePlayer } from '@/features/hyperframes-runtime/upstream/studio/player/hooks/useTimelinePlayer'
import type { FreeCutStudioReadyState } from './types'

export interface FreeCutStudioPanelsProps {
  session: FreeCutStudioReadyState
  player: StudioTimelinePlayer
  toolbar: ReactNode
  previewUrl: string | null
  onSelectFile: (path: string) => void
  onActiveContentChange: (content: string) => void
}

function extensionLanguage(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase()
  if (!ext) return 'html'
  if (ext === 'md' || ext === 'markdown') return 'markdown'
  if (ext === 'js' || ext === 'jsx') return 'javascript'
  if (ext === 'ts' || ext === 'tsx') return 'typescript'
  if (ext === 'css') return 'css'
  if (ext === 'json') return 'json'
  return ext
}

function groupDiagnosticsByFile(session: FreeCutStudioReadyState) {
  const grouped = new Map<string, { count: number; messages: string[] }>()
  for (const diagnostic of session.diagnostics) {
    if (!diagnostic.file) continue
    const current = grouped.get(diagnostic.file) ?? { count: 0, messages: [] }
    current.count += 1
    current.messages.push(diagnostic.message)
    grouped.set(diagnostic.file, current)
  }
  return grouped
}

interface AdvancedUndoEntry {
  path: string
  content: string
  label: string
}

export const FreeCutStudioPanels = memo(function FreeCutStudioPanels({
  session,
  player,
  toolbar,
  previewUrl,
  onSelectFile,
  onActiveContentChange,
}: FreeCutStudioPanelsProps) {
  const { t } = useTranslation()
  const diagnosticsByFile = groupDiagnosticsByFile(session)
  const layers = useMemo(
    () => extractDomEditLayers(session.activeContent, session.activeFilePath),
    [session.activeContent, session.activeFilePath],
  )
  const [selectedLayerKey, setSelectedLayerKey] = useState<string | null>(null)
  const [undoStack, setUndoStack] = useState<AdvancedUndoEntry[]>([])
  const selectedLayer = layers.find((layer) => layer.key === selectedLayerKey) ?? null

  useEffect(() => {
    if (selectedLayerKey && !layers.some((layer) => layer.key === selectedLayerKey)) {
      setSelectedLayerKey(null)
    }
  }, [layers, selectedLayerKey])

  useEffect(() => {
    setUndoStack([])
  }, [session.activeFilePath])

  const selectLayer = useCallback((layer: DomEditLayerItem) => {
    setSelectedLayerKey(layer.key)
  }, [])

  const patchLayer = useCallback(
    (layer: DomEditLayerItem, operations: DomEditPatchResult['operations'], label: string) => {
      const result = applyDomEditOperationsToHtml(session.activeContent, layer.target, operations)
      if (!result.matched || result.html === session.activeContent) return
      setUndoStack((current) => [
        ...current.slice(-9),
        { path: session.activeFilePath, content: session.activeContent, label },
      ])
      onActiveContentChange(result.html)
      setSelectedLayerKey(layer.key)
    },
    [onActiveContentChange, session.activeContent, session.activeFilePath],
  )

  const undoAdvancedPatch = useCallback(() => {
    setUndoStack((current) => {
      const entry = current[current.length - 1]
      if (!entry || entry.path !== session.activeFilePath) return current
      onActiveContentChange(entry.content)
      return current.slice(0, -1)
    })
  }, [onActiveContentChange, session.activeFilePath])

  return (
    <NLELayout
      toolbar={toolbar}
      fileTree={
        <FileTree
          files={session.files.map((file) => file.path)}
          activeFile={session.activeFilePath}
          onSelectFile={onSelectFile}
          lintFindingsByFile={diagnosticsByFile}
        />
      }
      preview={
        <div className="relative h-full min-h-0">
          <NLEPreview
            projectId={session.hyperframesProjectId}
            iframeRef={player.iframeRef}
            onIframeLoad={() => undefined}
            directUrl={previewUrl ?? undefined}
            suppressLoadingOverlay
          />
          <DomEditOverlay
            layers={layers}
            selectedLayerKey={selectedLayerKey}
            snapGuides={[
              { axis: 'x', value: session.manifest.canvas.width / 2, label: 'center-x' },
              { axis: 'y', value: session.manifest.canvas.height / 2, label: 'center-y' },
            ]}
            onSelectLayer={selectLayer}
          />
        </div>
      }
      sourceEditor={
        <SourceEditor
          filePath={session.activeFilePath}
          language={extensionLanguage(session.activeFilePath)}
          content={session.activeContent}
          onChange={onActiveContentChange}
          readOnly={session.saving}
        />
      }
      propertyPanel={
        <div className="flex h-full min-h-0 flex-col">
          <div className="min-h-0 flex-1 border-b border-neutral-800">
            <LayersPanel
              layers={layers}
              selectedLayerKey={selectedLayerKey}
              canUndo={undoStack.some((entry) => entry.path === session.activeFilePath)}
              onSelectLayer={selectLayer}
              onPatchLayer={patchLayer}
              onUndo={undoAdvancedPatch}
            />
          </div>
          <div className="min-h-0 flex-1">
            <PropertyPanel
              element={
                selectedLayer
                  ? {
                      label: selectedLayer.label,
                      selector: selectedLayer.target.selector,
                      tagName: selectedLayer.tagName,
                      dataAttributes: {
                        ...selectedLayer.dataAttributes,
                        sourceFile: selectedLayer.sourceFile,
                      },
                      computedStyles: selectedLayer.inlineStyles,
                    }
                  : {
                      label: session.manifest.title,
                      selector: `[data-composition-id="${session.hyperframesProjectId}"]`,
                      tagName: 'composition',
                      dataAttributes: {
                        project: session.hyperframesProjectId,
                        file: session.activeFilePath,
                      },
                    }
              }
              onClearSelection={() => setSelectedLayerKey(null)}
            />
          </div>
        </div>
      }
      timeline={
        <div className="flex h-full min-h-0 items-center justify-between gap-4 px-4 text-xs text-neutral-400">
          <div className="min-w-0 truncate">
            {t('hyperframes.studio.timelineSummary', {
              width: session.manifest.canvas.width,
              height: session.manifest.canvas.height,
              fps: session.manifest.canvas.fps,
              frames: session.manifest.canvas.durationInFrames,
            })}
          </div>
          <div className="font-mono tabular-nums text-neutral-500">
            {player.currentTime.toFixed(2)}s
          </div>
        </div>
      }
    />
  )
})
