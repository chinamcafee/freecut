import { describe, expect, it } from 'vite-plus/test'
import type { Project } from '@/types/project'
import type { HyperFramesProjectDirectory } from '@/types/hyperframes'
import { InMemoryHyperFramesProjectRepository } from '../../adapters/freecut-project'
import { importHyperFramesProjectDirectoryWithApproximations } from './hyperFramesEditableApproximation'

const directory: HyperFramesProjectDirectory = {
  manifest: {
    schemaVersion: 1, id: 'motion-project', title: 'Motion Project', entryFile: 'index.html',
    activeCompositionPath: 'compositions/main.html',
    canvas: { width: 1280, height: 720, fps: 30, durationInFrames: 120 },
    assets: [
      { id: 'video-asset', path: 'assets/clip.mp4', kind: 'video', originalUrl: 'blob:clip' },
      { id: 'audio-asset', path: 'assets/music.wav', kind: 'audio', originalUrl: 'blob:music' },
      { id: 'image-asset', path: 'assets/image.png', kind: 'image', originalUrl: 'blob:image' },
    ],
    provenance: { source: 'manual-import', createdAt: 100 },
  },
  files: [
    { path: 'index.html', content: '<div data-composition-src="compositions/main.html"></div>', encoding: 'utf8' },
    { path: 'compositions/child.html', content: '<div>Child</div>', encoding: 'utf8' },
    {
      path: 'compositions/main.html', encoding: 'utf8',
      content: `<!doctype html><main>
        <div id="title" data-hf-item data-hf-type="text" data-start="0" data-duration="2" style="left:10px;top:20px;color:#fff;font-size:42px;animation:fade 1s">Title</div>
        <video id="video" data-hf-item data-hf-type="video" data-start="1" data-duration="3" src="../assets/clip.mp4"></video>
        <audio id="audio" data-hf-item data-hf-type="audio" src="../assets/music.wav"></audio>
        <img id="image" data-hf-item data-hf-type="image" src="../assets/image.png">
        <svg id="shape" data-hf-item data-hf-type="shape"><circle cx="20" cy="20" r="20" fill="#f00"/></svg>
        <div id="child" data-hf-item data-composition-src="child.html"></div>
        <div id="unsupported" data-hf-item data-hf-type="custom"></div>
        <script>window.example = true</script>
      </main>`,
    },
  ],
  assets: [],
}

const project: Project = {
  id: 'freecut-target', name: 'Target', description: '', createdAt: 1, updatedAt: 1,
  duration: 120, metadata: { width: 1280, height: 720, fps: 30 },
  timeline: {
    tracks: [{ id: 'v1', name: 'V1', kind: 'video', order: 0, height: 80, locked: false, visible: true, muted: false, solo: false }],
    items: [],
  },
}

describe('HyperFrames editable approximations', () => {
  it('imports all supported native approximations while preserving the source-linked composition', async () => {
    const result = await importHyperFramesProjectDirectoryWithApproximations({
      project, directory, repository: new InMemoryHyperFramesProjectRepository(),
      timelineItemId: 'hf-source', importedAt: 200,
    })

    expect(result.canonicalSourcePreserved).toBe(true)
    expect(result.project.timeline?.items.find((item) => item.id === 'hf-source')).toMatchObject({
      type: 'composition', sourceKind: 'hyperframes', hyperframesProjectId: 'motion-project',
    })
    expect(result.approximationItems.map((item) => item.type)).toEqual([
      'text', 'video', 'audio', 'image', 'shape', 'composition',
    ])
    expect(result.approximationItems[0]).toMatchObject({ from: 0, durationInFrames: 60 })
    expect(result.approximationItems[1]).toMatchObject({ src: 'blob:clip', from: 30, durationInFrames: 90 })
    expect(result.compositionLink.importStrategy).toBe('source-linked-with-approximations')
    expect(result.lossRecords).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ fields: ['script'] }),
        expect.objectContaining({ elementId: 'title', fields: ['animation'] }),
        expect.objectContaining({ elementId: 'unsupported', severity: 'warning' }),
      ]),
    )
  })
})
