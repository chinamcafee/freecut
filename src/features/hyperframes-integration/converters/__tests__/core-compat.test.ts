import { describe, expect, it } from 'vite-plus/test'
import type { Project } from '@/types/project'
import { FreeCutToHyperFramesConverter } from '../FreeCutToHyperFramesConverter'
import {
  classifyUnsupportedFeatures,
  validateHyperFramesProjectDirectory,
} from '../core-compat'

const project: Project = {
  id: 'project-24',
  name: '24fps project',
  description: 'Converter compatibility fixture',
  createdAt: 1,
  updatedAt: 2,
  duration: 48,
  metadata: {
    width: 1920,
    height: 1080,
    fps: 24,
    backgroundColor: '#111111',
  },
  timeline: {
    tracks: [
      {
        id: 'track-1',
        name: 'V1',
        kind: 'video',
        height: 72,
        order: 0,
        visible: true,
        locked: false,
        muted: false,
        solo: false,
      },
    ],
    items: [
      {
        id: 'video-1',
        type: 'video',
        trackId: 'track-1',
        from: 24,
        durationInFrames: 24,
        sourceStart: 12,
        sourceDuration: 120,
        sourceFps: 24,
        label: 'Video',
        src: '/workspace/media/video.mp4',
        mediaId: 'media-1',
        effects: [{ id: 'blur-1', type: 'blur', enabled: true, params: { radius: 4 } }],
      } as unknown as NonNullable<Project['timeline']>['items'][number],
      {
        id: 'nested-1',
        type: 'composition',
        trackId: 'track-1',
        from: 0,
        durationInFrames: 24,
        label: 'Nested',
        compositionId: 'nested-comp',
        compositionWidth: 1920,
        compositionHeight: 1080,
        sourceKind: 'hyperframes',
        hyperframesProjectId: 'nested-hf',
        activeCompositionPath: 'compositions/nested.html',
        hyperframesManifestPath: 'hyperframes/nested-hf/manifest.json',
      },
    ],
  },
}

describe('HyperFrames converter core compatibility', () => {
  it('exports project-directory HTML using project fps, media start, composition src, manifest, and lint checks', () => {
    const result = new FreeCutToHyperFramesConverter().convert(project)
    const html = result.projectDirectory.files['compositions/main.html']

    expect(html).toContain('data-start="1"')
    expect(html).toContain('data-duration="1"')
    expect(html).toContain('data-media-start="0.5"')
    expect(html).toContain('data-composition-src="compositions/nested.html"')
    expect(result.projectDirectory.files['manifest.json']).toContain('"entryFile": "index.html"')
    expect(validateHyperFramesProjectDirectory(result.projectDirectory)).toEqual({
      diagnostics: [],
      signature: expect.any(String),
    })
  })

  it('classifies irreversible FreeCut features instead of dropping them silently', () => {
    expect(classifyUnsupportedFeatures(project.timeline!.items)).toEqual([
      {
        itemId: 'video-1',
        feature: 'webgpu-effect',
        severity: 'warning',
        message: 'GPU/video effect blur is preserved as an unsupported feature warning',
      },
    ])
  })
})
