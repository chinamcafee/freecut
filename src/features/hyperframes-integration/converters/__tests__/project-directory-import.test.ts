import { describe, expect, it } from 'vite-plus/test'
import { createHyperFramesConverterTestProject } from './test-project'
import { FreeCutToHyperFramesConverter } from '../FreeCutToHyperFramesConverter'
import { HyperFramesToFreeCutConverter } from '../HyperFramesToFreeCutConverter'

describe('HyperFramesToFreeCutConverter project directory import', () => {
  it('imports a HyperFrames project directory into FreeCut composition items and compositionLinks', () => {
    const exported = new FreeCutToHyperFramesConverter().convert(
      createHyperFramesConverterTestProject(),
    )
    const imported = new HyperFramesToFreeCutConverter().convert(exported.projectDirectory)

    expect(imported.project.timeline?.items).toEqual([
      expect.objectContaining({
        id: 'title',
        type: 'text',
        from: 15,
        durationInFrames: 45,
        text: 'Ship faster',
      }),
      expect.objectContaining({
        id: 'clip',
        type: 'video',
        from: 60,
        durationInFrames: 60,
        src: 'assets/launch.mp4',
      }),
      expect.objectContaining({
        id: 'hf-freecut-project-1',
        type: 'composition',
        sourceKind: 'hyperframes',
        compositionId: 'freecut-project-1',
      }),
    ])
    expect(imported.project.hyperframes?.projects['freecut-project-1']).toEqual(
      exported.projectDirectory.manifest,
    )
    expect(imported.project.hyperframes?.compositionLinks['hf-freecut-project-1']).toMatchObject({
      timelineItemId: 'hf-freecut-project-1',
      projectId: 'freecut-project-1',
      sourceKind: 'hyperframes',
      activeCompositionPath: 'compositions/main.html',
    })
    expect(imported.warnings).toContain(
      'Imported HyperFrames project as a source-linked FreeCut composition; arbitrary scripts remain canonical in the project directory',
    )
  })
})
