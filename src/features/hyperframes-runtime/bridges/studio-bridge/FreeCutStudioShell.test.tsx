import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { InMemoryHyperFramesProjectRepository } from '@/features/hyperframes-runtime/adapters/freecut-project/project-repository'
import type { HyperFramesProjectDirectory } from '@/types/hyperframes'
import { FreeCutStudioShell } from './FreeCutStudioShell'
import { FREECUT_STUDIO_ICON_LIBRARY, FREECUT_STUDIO_THEME_VARIABLES } from './studioThemeAdapter'
import type { FreeCutStudioTimelineItem } from './types'

const directory: HyperFramesProjectDirectory = {
  manifest: {
    schemaVersion: 1,
    id: 'hf-project',
    title: 'Studio Project',
    entryFile: 'index.html',
    activeCompositionPath: 'compositions/main.html',
    canvas: {
      width: 1280,
      height: 720,
      fps: 30,
      durationInFrames: 90,
    },
    assets: [],
    provenance: {
      source: 'manual-import',
      createdAt: 1784304000000,
      freecutProjectId: 'freecut-project',
    },
  },
  files: [
    {
      path: 'compositions/main.html',
      content: '<main data-composition-id="main">Original</main>',
      encoding: 'utf8',
    },
    {
      path: 'index.html',
      content: '<iframe src="compositions/main.html"></iframe>',
      encoding: 'utf8',
    },
  ],
  assets: [],
}

const item: FreeCutStudioTimelineItem = {
  id: 'timeline-hf',
  type: 'composition',
  trackId: 'track-1',
  from: 0,
  durationInFrames: 90,
  label: 'HyperFrames Clip',
  compositionId: 'hf-project',
  sourceKind: 'hyperframes',
  hyperframesProjectId: 'hf-project',
  activeCompositionPath: 'compositions/main.html',
  hyperframesManifestPath: 'hyperframes/hf-project/manifest.json',
  compositionWidth: 1280,
  compositionHeight: 720,
}

function renderShell(repository = new InMemoryHyperFramesProjectRepository([directory])) {
  const onClose = vi.fn()
  const onDirtyChange = vi.fn()
  render(
    <FreeCutStudioShell
      freecutProjectId="freecut-project"
      item={item}
      repositoryFactory={() => repository}
      onClose={onClose}
      onDirtyChange={onDirtyChange}
    />,
  )
  return { repository, onClose, onDirtyChange }
}

describe('FreeCutStudioShell', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('loads the source-linked project into a scoped Studio surface', async () => {
    renderShell()

    expect(await screen.findAllByText('Studio Project')).toHaveLength(2)
    expect(screen.getByLabelText('Source editor: compositions/main.html')).toHaveValue(
      '<main data-composition-id="main">Original</main>',
    )
    const shell = document.querySelector('[data-hf-studio-shell]') as HTMLElement | null
    expect(shell).toHaveClass('freecut-hyperframes-studio')
    expect(shell).toHaveAttribute('data-hf-studio-icon-library', FREECUT_STUDIO_ICON_LIBRARY)
    expect(shell?.style.getPropertyValue('--hf-studio-bg')).toBe(
      FREECUT_STUDIO_THEME_VARIABLES['--hf-studio-bg'],
    )
    expect(document.documentElement.style.getPropertyValue('--hf-studio-bg')).toBe('')
    expect(document.querySelector('[data-hf-studio-surface]')).toBeInTheDocument()
  })

  it('blocks close when source edits are dirty until the user chooses a close action', async () => {
    const { onClose, onDirtyChange } = renderShell()
    const editor = await screen.findByLabelText('Source editor: compositions/main.html')

    fireEvent.change(editor, {
      target: { value: '<main data-composition-id="main">Changed</main>' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Close Studio' }))

    expect(await screen.findByText('Unsaved Studio changes')).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Keep Editing' }))
    expect(onClose).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Close Studio' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Discard Changes' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onDirtyChange).toHaveBeenLastCalledWith(false)
  })

  it('clears the timeline dirty state before saving and closing', async () => {
    const { onClose, onDirtyChange, repository } = renderShell()
    const editor = await screen.findByLabelText('Source editor: compositions/main.html')

    fireEvent.change(editor, {
      target: { value: '<main data-composition-id="main">Saved and closed</main>' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Close Studio' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Save and Close' }))

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(onDirtyChange).toHaveBeenLastCalledWith(false)
    await expect(repository.readFile('hf-project', 'compositions/main.html')).resolves.toContain(
      'Saved and closed',
    )
  })

  it('saves dirty source content through the Studio keyboard scope', async () => {
    const { repository } = renderShell()
    const editor = await screen.findByLabelText('Source editor: compositions/main.html')

    fireEvent.change(editor, {
      target: { value: '<main data-composition-id="main">Saved</main>' },
    })
    fireEvent.keyDown(editor, { key: 's', metaKey: true })

    await waitFor(async () => {
      await expect(repository.readFile('hf-project', 'compositions/main.html')).resolves.toContain(
        'Saved',
      )
    })
    await waitFor(() => expect(screen.queryByText('Dirty 1')).not.toBeInTheDocument())
  })

  it('owns playback, delete, and source undo keys inside the Studio scope', async () => {
    renderShell()
    const editor = await screen.findByLabelText('Source editor: compositions/main.html')
    const shell = document.querySelector('[data-hf-studio-shell]') as HTMLElement

    fireEvent.keyDown(shell, { key: ' ' })
    expect(screen.getByRole('button', { name: 'Pause Studio preview' })).toBeInTheDocument()

    const deleteEvent = new KeyboardEvent('keydown', {
      key: 'Delete',
      bubbles: true,
      cancelable: true,
    })
    shell.dispatchEvent(deleteEvent)
    expect(deleteEvent.defaultPrevented).toBe(true)

    const undoEvent = new KeyboardEvent('keydown', {
      key: 'z',
      metaKey: true,
      bubbles: true,
      cancelable: true,
    })
    editor.dispatchEvent(undoEvent)
    expect(undoEvent.defaultPrevented).toBe(false)
  })

  it('applies and undoes a visual layer style patch inside the Studio surface', async () => {
    renderShell()
    const editor = await screen.findByLabelText('Source editor: compositions/main.html')

    const layerButtons = await screen.findAllByRole('button', { name: /main 1/ })
    fireEvent.click(layerButtons[0]!)
    fireEvent.click(screen.getByRole('button', { name: 'Apply Style' }))

    await waitFor(() => {
      expect((editor as HTMLTextAreaElement).value).toContain('opacity: 0.85')
    })

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    await waitFor(() => {
      expect((editor as HTMLTextAreaElement).value).toBe(
        '<main data-composition-id="main">Original</main>',
      )
    })
  })
})
