import { describe, expect, it } from 'vite-plus/test'
import type { CompositionItem } from '@/types/timeline'
import type { HyperFramesProjectManifest } from '@/types/hyperframes'
import { createFreeCutTransparentOverlayDescriptor, createTransparentOverlayRenderRequest } from './transparentOverlay'

const item: CompositionItem = {
  id: 'hf-item', type: 'composition', trackId: 'v1', from: 30, durationInFrames: 90,
  label: 'Overlay', compositionId: 'hf-project', sourceKind: 'hyperframes',
  hyperframesProjectId: 'hf-project', activeCompositionPath: 'compositions/main.html',
  compositionWidth: 1280, compositionHeight: 720,
}
const manifest: HyperFramesProjectManifest = {
  schemaVersion: 1, id: 'hf-project', title: 'Overlay', entryFile: 'index.html',
  activeCompositionPath: 'compositions/main.html',
  canvas: { width: 1280, height: 720, fps: 30, durationInFrames: 90 }, assets: [],
  provenance: { source: 'manual-import', createdAt: 1 },
}

describe('transparent HyperFrames overlays', () => {
  it('creates an alpha render request and a FreeCut compositing descriptor', () => {
    const request = createTransparentOverlayRenderRequest(item, manifest, {
      projectDirectoryPath: '/safe/hf-project', format: 'webm', includeAudio: true,
    })
    expect(request).toMatchObject({ alpha: true, format: 'webm', includeAudio: true })

    const descriptor = createFreeCutTransparentOverlayDescriptor(item, manifest, {
      path: 'cache/hf-project.webm', format: 'webm', alpha: true,
    }, true)
    expect(descriptor).toMatchObject({ from: 30, durationInFrames: 90, alphaMode: 'straight', includeAudio: true })
  })

  it('rejects opaque producer output from the transparent compositing path', () => {
    expect(() => createFreeCutTransparentOverlayDescriptor(item, manifest, {
      path: 'cache/opaque.mp4', format: 'mp4', alpha: false,
    })).toThrow('does not contain an alpha channel')
  })
})
