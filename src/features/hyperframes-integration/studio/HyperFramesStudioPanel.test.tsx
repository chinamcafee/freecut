import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vite-plus/test'
import type { HyperFramesProjectDirectory } from '@/types/hyperframes'
import { HyperFramesStudioPanel } from './HyperFramesStudioPanel'

const projectDirectory: HyperFramesProjectDirectory = {
  projectId: 'hf-project',
  rootPath: 'hyperframes/hf-project',
  entryFile: 'index.html',
  activeCompositionPath: 'compositions/main.html',
  assets: [],
  warnings: [],
  unsupportedFeatures: [],
  manifest: {
    id: 'hf-project',
    name: 'Intro',
    schemaVersion: 1,
    projectDir: 'hyperframes/hf-project',
    entryFile: 'index.html',
    activeCompositionPath: 'compositions/main.html',
    width: 1920,
    height: 1080,
    fps: { num: 30, den: 1 },
    durationInFrames: 90,
    assets: [],
    compositions: [
      {
        id: 'main',
        path: 'compositions/main.html',
        name: 'Main',
        durationInFrames: 90,
      },
    ],
    source: 'hyperframes-project',
    createdAt: 1,
    updatedAt: 2,
  },
  files: {
    'index.html': '<main data-composition-src="compositions/main.html"></main>',
    'compositions/main.html': '<h1>Hello</h1>',
    'assets/readme.md': '# Notes',
  },
  fileIndex: [
    {
      path: 'index.html',
      contents: '<main data-composition-src="compositions/main.html"></main>',
      kind: 'entry',
      hash: 'entry',
    },
    {
      path: 'compositions/main.html',
      contents: '<h1>Hello</h1>',
      kind: 'composition',
      hash: 'main',
    },
    {
      path: 'assets/readme.md',
      contents: '# Notes',
      kind: 'metadata',
      hash: 'notes',
    },
  ],
}

describe('HyperFramesStudioPanel', () => {
  it('renders file tree, source editor, preview iframe, toolbar, and active composition bridge', () => {
    render(
      <HyperFramesStudioPanel
        projectDirectory={projectDirectory}
        activeCompositionPath="compositions/main.html"
        isOpen={true}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />,
    )

    expect(screen.getByRole('dialog', { name: 'HyperFrames Studio' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'index.html' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'compositions/main.html' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByLabelText('HyperFrames source editor')).toHaveValue('<h1>Hello</h1>')
    expect(screen.getByTitle('HyperFrames preview')).toHaveAttribute('sandbox')
    expect(screen.getAllByText('compositions/main.html')).toHaveLength(2)
  })

  it('tracks dirty state, saves edited files, and refreshes preview markup', () => {
    const onSave = vi.fn()

    render(
      <HyperFramesStudioPanel
        projectDirectory={projectDirectory}
        activeCompositionPath="compositions/main.html"
        isOpen={true}
        onClose={vi.fn()}
        onSave={onSave}
      />,
    )

    fireEvent.change(screen.getByLabelText('HyperFrames source editor'), {
      target: { value: '<h1>Updated</h1>' },
    })

    expect(screen.getByText('Unsaved changes')).toBeInTheDocument()
    expect(screen.getByTitle('HyperFrames preview')).toHaveAttribute(
      'srcDoc',
      expect.stringContaining('Updated'),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(onSave).toHaveBeenCalledWith({
      projectId: 'hf-project',
      activeCompositionPath: 'compositions/main.html',
      files: expect.objectContaining({
        'compositions/main.html': '<h1>Updated</h1>',
      }),
    })
    expect(screen.getByText('Saved')).toBeInTheDocument()
  })

  it('supports file switching and keyboard shortcuts', () => {
    const onClose = vi.fn()
    const onSave = vi.fn()

    render(
      <HyperFramesStudioPanel
        projectDirectory={projectDirectory}
        activeCompositionPath="compositions/main.html"
        isOpen={true}
        onClose={onClose}
        onSave={onSave}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'index.html' }))
    expect(screen.getByLabelText('HyperFrames source editor')).toHaveValue(
      '<main data-composition-src="compositions/main.html"></main>',
    )

    fireEvent.change(screen.getByLabelText('HyperFrames source editor'), {
      target: { value: '<main>Changed</main>' },
    })
    fireEvent.keyDown(screen.getByRole('dialog', { name: 'HyperFrames Studio' }), {
      key: 's',
      ctrlKey: true,
    })
    fireEvent.keyDown(screen.getByRole('dialog', { name: 'HyperFrames Studio' }), {
      key: 'Escape',
    })

    expect(onSave).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('does not render when closed', () => {
    render(
      <HyperFramesStudioPanel
        projectDirectory={projectDirectory}
        activeCompositionPath="compositions/main.html"
        isOpen={false}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />,
    )

    expect(screen.queryByRole('dialog', { name: 'HyperFrames Studio' })).toBeNull()
  })
})
