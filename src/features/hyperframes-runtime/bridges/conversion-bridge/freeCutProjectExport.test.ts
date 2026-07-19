import { describe, expect, it } from 'vite-plus/test'
import type { Project } from '@/types/project'
import { createHyperFramesCompilerAdapter } from '../../adapters/freecut-project'
import { exportFreeCutProjectToHyperFramesDirectory } from './freeCutProjectExport'

const project: Project = {
  id: 'freecut-demo',
  name: 'FreeCut Demo',
  description: '',
  createdAt: 1784304000000,
  updatedAt: 1784305000000,
  duration: 90,
  metadata: { width: 1280, height: 720, fps: 30, backgroundColor: '#101010' },
  timeline: {
    tracks: [
      { id: 'video-track', name: 'V1', order: 0, height: 80, locked: false, visible: true, muted: false, solo: false },
    ],
    items: [
      {
        id: 'title', type: 'text', trackId: 'video-track', from: 0, durationInFrames: 60,
        label: 'Title', text: 'Exported title', fontSize: 48, color: '#ffffff',
        transform: { x: 100, y: 80, width: 600, height: 80 },
      },
      {
        id: 'video', type: 'video', trackId: 'video-track', from: 30, durationInFrames: 60,
        label: 'Video', src: 'workspace/hero.mp4', mediaId: 'media-1', sourceWidth: 1920,
        sourceHeight: 1080, sourceDuration: 300,
      },
    ],
  },
}

describe('exportFreeCutProjectToHyperFramesDirectory', () => {
  it('exports a manifest-backed directory that the HyperFrames compiler can preview', async () => {
    const result = await exportFreeCutProjectToHyperFramesDirectory(project, {
      now: 1784306000000,
      resolveAsset: ({ projectPath }) =>
        projectPath.endsWith('.mp4') ? new Uint8Array([1, 2, 3]) : undefined,
    })

    expect(result.directory.manifest).toMatchObject({
      id: 'freecut-freecut-demo',
      entryFile: 'index.html',
      activeCompositionPath: 'compositions/main.html',
      provenance: { source: 'freecut-export', freecutProjectId: 'freecut-demo' },
    })
    expect(result.directory.files.map((file) => file.path)).toEqual([
      'index.html',
      'compositions/main.html',
    ])
    expect(result.directory.manifest.assets[0]).toMatchObject({
      path: 'assets/1-hero.mp4',
      originalMediaId: 'media-1',
      bytes: 3,
    })
    expect(result.directory.assets[0]?.bytes).toEqual(new Uint8Array([1, 2, 3]))

    const compilation = await createHyperFramesCompilerAdapter().createPreviewHtml(
      result.directory,
    )
    expect(compilation.ok).toBe(true)
    expect(compilation.html).toContain('Exported title')
    expect(compilation.html).toContain('../assets/1-hero.mp4')
  })
})
