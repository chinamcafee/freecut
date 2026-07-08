import { useCallback, useEffect, useMemo, useState } from 'react'
import type { HyperFramesProjectDirectory } from '@/types/hyperframes'

export interface HyperFramesStudioSavePayload {
  projectId: string
  activeCompositionPath: string
  files: Record<string, string>
}

interface HyperFramesStudioPanelProps {
  projectDirectory: HyperFramesProjectDirectory
  activeCompositionPath: string
  isOpen: boolean
  onClose: () => void
  onSave: (payload: HyperFramesStudioSavePayload) => void
}

export function HyperFramesStudioPanel({
  projectDirectory,
  activeCompositionPath,
  isOpen,
  onClose,
  onSave,
}: HyperFramesStudioPanelProps) {
  const initialActivePath =
    projectDirectory.files[activeCompositionPath] !== undefined
      ? activeCompositionPath
      : projectDirectory.activeCompositionPath
  const [activeFilePath, setActiveFilePath] = useState(initialActivePath)
  const [files, setFiles] = useState(() => ({ ...projectDirectory.files }))
  const [savedFiles, setSavedFiles] = useState(() => ({ ...projectDirectory.files }))
  const [status, setStatus] = useState<'saved' | 'dirty'>('saved')
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    setActiveFilePath(initialActivePath)
    setFiles({ ...projectDirectory.files })
    setSavedFiles({ ...projectDirectory.files })
    setStatus('saved')
    setRefreshKey((value) => value + 1)
  }, [initialActivePath, projectDirectory])

  const filePaths = useMemo(
    () =>
      Object.keys(files).sort((left, right) => {
        if (left === projectDirectory.entryFile) return -1
        if (right === projectDirectory.entryFile) return 1
        return left.localeCompare(right)
      }),
    [files, projectDirectory.entryFile],
  )
  const activeSource = files[activeFilePath] ?? ''
  const previewHtml = useMemo(
    () =>
      assemblePreviewHtml({
        entryFile: projectDirectory.entryFile,
        activeCompositionPath: activeFilePath,
        files,
        refreshKey,
      }),
    [activeFilePath, files, projectDirectory.entryFile, refreshKey],
  )

  const save = useCallback(() => {
    onSave({
      projectId: projectDirectory.projectId,
      activeCompositionPath: activeFilePath,
      files,
    })
    setSavedFiles({ ...files })
    setStatus('saved')
  }, [activeFilePath, files, onSave, projectDirectory.projectId])

  const updateActiveSource = useCallback(
    (nextSource: string) => {
      setFiles((current) => ({
        ...current,
        [activeFilePath]: nextSource,
      }))
      setStatus(nextSource === savedFiles[activeFilePath] ? 'saved' : 'dirty')
      setRefreshKey((value) => value + 1)
    },
    [activeFilePath, savedFiles],
  )

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const key = event.key.toLowerCase()
      if ((event.ctrlKey || event.metaKey) && key === 's') {
        event.preventDefault()
        save()
        return
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    },
    [onClose, save],
  )

  if (!isOpen) return null

  return (
    <div
      role="dialog"
      aria-label="HyperFrames Studio"
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      className="fixed inset-6 z-50 grid grid-cols-[220px_minmax(0,1fr)_minmax(280px,40%)] grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-lg border border-border bg-background shadow-2xl"
    >
      <div className="col-span-3 flex items-center gap-2 border-b border-border px-3 py-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">HyperFrames Studio</div>
          <div className="truncate text-xs text-muted-foreground">{activeFilePath}</div>
        </div>
        <span className="rounded bg-muted px-2 py-1 text-xs">
          {status === 'dirty' ? 'Unsaved changes' : 'Saved'}
        </span>
        <span className="rounded bg-muted px-2 py-1 text-xs">refreshKey {refreshKey}</span>
        <button type="button" className="rounded border px-3 py-1 text-sm" onClick={save}>
          Save
        </button>
        <button type="button" className="rounded border px-3 py-1 text-sm" onClick={onClose}>
          Close
        </button>
      </div>

      <aside className="min-h-0 overflow-auto border-r border-border p-2">
        {filePaths.map((path) => (
          <button
            key={path}
            type="button"
            aria-pressed={path === activeFilePath}
            className="mb-1 block w-full truncate rounded px-2 py-1 text-left text-xs hover:bg-muted aria-pressed:bg-muted"
            onClick={() => setActiveFilePath(path)}
          >
            {path}
          </button>
        ))}
      </aside>

      <section className="min-h-0 border-r border-border">
        <textarea
          aria-label="HyperFrames source editor"
          className="h-full w-full resize-none bg-background p-3 font-mono text-xs outline-none"
          value={activeSource}
          onChange={(event) => updateActiveSource(event.target.value)}
          spellCheck={false}
        />
      </section>

      <section className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)]">
        <div className="border-b border-border px-3 py-2 text-xs text-muted-foreground">
          Preview · {projectDirectory.manifest.width}x{projectDirectory.manifest.height}
        </div>
        <iframe
          title="HyperFrames preview"
          sandbox="allow-scripts allow-same-origin"
          srcDoc={previewHtml}
          className="h-full w-full bg-black"
        />
      </section>
    </div>
  )
}

function assemblePreviewHtml(params: {
  entryFile: string
  activeCompositionPath: string
  files: Record<string, string>
  refreshKey: number
}): string {
  const entry = params.files[params.entryFile] ?? ''
  const active = params.files[params.activeCompositionPath] ?? entry

  return `<!doctype html>
<html>
  <head><meta charset="utf-8"><meta data-refresh-key="${params.refreshKey}"></head>
  <body data-active-composition-path="${escapeHtml(params.activeCompositionPath)}">
    ${active}
  </body>
</html>`
}

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;')
}
