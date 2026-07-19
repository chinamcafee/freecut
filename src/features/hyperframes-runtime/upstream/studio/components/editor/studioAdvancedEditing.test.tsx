import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vite-plus/test'
import { DomEditOverlay } from './DomEditOverlay'
import { LayersPanel } from './LayersPanel'
import {
  applyDomEditOperationsToHtml,
  buildInlineStylePatch,
  buildManualMovePatch,
  buildMotionPathPatch,
  extractDomEditLayers,
  snapPointToGuides,
} from './studioAdvancedEditing'

const html = `<!doctype html><html><body>
<main data-composition-id="main">
  <h1 id="title" data-hf-id="hf-title" style="position: absolute; left: 40px; top: 24px; width: 240px; height: 80px; z-index: 2">Hello</h1>
  <div id="card" style="position: absolute; left: 80px; top: 120px; width: 320px; height: 160px">Card</div>
</main>
</body></html>`

describe('studio advanced editing helpers', () => {
  it('extracts editable layers from composition fragments', () => {
    expect(
      extractDomEditLayers(
        '<main data-composition-id="main">Original</main>',
        'compositions/main.html',
      ),
    ).toEqual([
      expect.objectContaining({
        key: 'main',
        label: 'main 1',
        tagName: 'main',
      }),
    ])
  })

  it('extracts editable layers and applies style, manual move, and motion path patches', () => {
    const layers = extractDomEditLayers(html, 'compositions/main.html')
    const title = layers.find((layer) => layer.key === 'hf-title')
    expect(title).toEqual(
      expect.objectContaining({
        label: 'title',
        tagName: 'h1',
        geometry: { left: 40, top: 24, width: 240, height: 80 },
      }),
    )

    const stylePatch = applyDomEditOperationsToHtml(html, title!.target, [
      buildInlineStylePatch('opacity', '0.8'),
    ])
    expect(stylePatch.matched).toBe(true)
    expect(stylePatch.html).toContain('opacity: 0.8')

    const movePatch = applyDomEditOperationsToHtml(html, title!.target, buildManualMovePatch(12, 8))
    expect(movePatch.html).toContain('--hf-studio-offset-x: 12px')
    expect(movePatch.html).toContain('--hf-studio-offset-y: 8px')

    const motionPatch = applyDomEditOperationsToHtml(
      html,
      title!.target,
      buildMotionPathPatch([
        { x: 0, y: 0 },
        { x: 120, y: 60 },
      ]),
    )
    expect(motionPatch.html).toContain('data-hf-studio-motion-path="M 0 0 L 120 60"')
    expect(motionPatch.html).toContain('offset-path: path(&quot;M 0 0 L 120 60&quot;)')
  })

  it('snaps points to nearby Studio guides', () => {
    expect(
      snapPointToGuides({ x: 98, y: 203 }, [
        { axis: 'x', value: 100 },
        { axis: 'y', value: 200 },
      ]),
    ).toEqual({
      x: 100,
      y: 200,
      guides: [
        { axis: 'x', value: 100 },
        { axis: 'y', value: 200 },
      ],
    })
  })
})

describe('advanced editing components', () => {
  it('selects overlay layers and emits patch operations from the layers panel', () => {
    const layers = extractDomEditLayers(html, 'compositions/main.html')
    const onSelectLayer = vi.fn()
    const onPatchLayer = vi.fn()

    render(
      <>
        <DomEditOverlay layers={layers} selectedLayerKey="hf-title" onSelectLayer={onSelectLayer} />
        <LayersPanel
          layers={layers}
          selectedLayerKey="hf-title"
          canUndo
          onSelectLayer={onSelectLayer}
          onPatchLayer={onPatchLayer}
          onUndo={() => undefined}
        />
      </>,
    )

    fireEvent.click(screen.getByTitle('title'))
    expect(onSelectLayer).toHaveBeenCalledWith(expect.objectContaining({ key: 'hf-title' }))

    fireEvent.click(screen.getByRole('button', { name: 'Apply Style' }))
    expect(onPatchLayer).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'hf-title' }),
      [expect.objectContaining({ type: 'inline-style', property: 'opacity', value: '0.85' })],
      'Style patch',
    )
  })
})
