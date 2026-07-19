import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import {
  FileTree,
  NLELayout,
  PropertyPanel,
  SourceEditor,
  applyPatch,
  mergeStyleIntoTag,
  resolvePreviewStageSize,
  resolveSourceFile,
  useTimelinePlayer,
} from './index'

describe('HyperFrames Studio runtime mirror', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('renders the first-batch NLE layout without global style assets', () => {
    render(
      <NLELayout
        toolbar={<div>Toolbar</div>}
        fileTree={<div>Files</div>}
        preview={<div>Preview</div>}
        sourceEditor={<div>Source</div>}
        propertyPanel={<div>Properties</div>}
        timeline={<div>Timeline</div>}
      />,
    )

    expect(screen.getByText('Toolbar')).toBeInTheDocument()
    expect(screen.getByText('Files')).toBeInTheDocument()
    expect(screen.getByText('Preview')).toBeInTheDocument()
    expect(screen.getByText('Source')).toBeInTheDocument()
    expect(screen.getByText('Properties')).toBeInTheDocument()
    expect(screen.getByText('Timeline')).toBeInTheDocument()
    expect(document.querySelector('[data-hf-studio-surface="true"]')).toBeInTheDocument()
  })

  it('keeps file tree and source editor usable through FreeCut callbacks', () => {
    const onSelectFile = vi.fn()
    const onChange = vi.fn()

    render(
      <>
        <FileTree
          files={['index.html', 'components/card.html', 'styles/main.css']}
          activeFile="index.html"
          onSelectFile={onSelectFile}
        />
        <SourceEditor content="<main>Old</main>" filePath="index.html" onChange={onChange} />
      </>,
    )

    fireEvent.click(screen.getByText('components'))
    fireEvent.click(screen.getByText('card.html'))
    expect(onSelectFile).toHaveBeenCalledWith('components/card.html')

    fireEvent.change(screen.getByLabelText('Source editor: index.html'), {
      target: { value: '<main>New</main>' },
    })
    expect(onChange).toHaveBeenCalledWith('<main>New</main>')
  })

  it('renders a first-batch property panel for selected source elements', () => {
    render(
      <PropertyPanel
        element={{
          id: 'title',
          tagName: 'h1',
          selector: '#title',
          dataAttributes: {
            start: '0',
            duration: '3',
          },
        }}
      />,
    )

    expect(screen.getByText('Properties')).toBeInTheDocument()
    expect(screen.getByText('#title')).toBeInTheDocument()
    expect(screen.getByText('h1')).toBeInTheDocument()
    expect(screen.getByText('duration')).toBeInTheDocument()
  })

  it('preserves preview sizing and player hook basics', () => {
    expect(resolvePreviewStageSize(1920, 1080, { width: 1080, height: 1920 }, true)).toEqual({
      width: 598.5,
      height: 1064,
    })

    const { result } = renderHook(() => useTimelinePlayer())
    expect(result.current.currentTime).toBe(0)
    act(() => {
      result.current.seek(2.5)
    })
    expect(result.current.currentTime).toBe(2.5)
  })

  it('keeps upstream source patch helpers available for FreeCut adapters', () => {
    const html = '<main><h1 id="title" class="hero">Old</h1></main>'
    expect(resolveSourceFile('title', '', { 'index.html': html })).toBe('index.html')
    expect(
      applyPatch(html, 'title', {
        type: 'inline-style',
        property: 'color',
        value: 'red',
      }),
    ).toContain('style="color: red"')
    expect(mergeStyleIntoTag('<h1 class="hero">', 'opacity: 0.5')).toBe(
      '<h1 class="hero" style="opacity: 0.5">',
    )
  })
})
