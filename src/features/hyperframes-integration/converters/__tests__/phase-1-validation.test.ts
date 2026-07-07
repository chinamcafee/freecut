import { performance } from 'node:perf_hooks'
import { describe, expect, it } from 'vite-plus/test'
import type { Project } from '@/types/project'
import { createHyperFramesConverterTestProject } from './test-project'
import { FreeCutToHyperFramesConverter } from '../FreeCutToHyperFramesConverter'
import { HyperFramesToFreeCutConverter } from '../HyperFramesToFreeCutConverter'

describe('HyperFrames Phase 1 validation', () => {
  it('records unsupported warnings when controlled keyframes cannot be parsed', () => {
    const exported = new FreeCutToHyperFramesConverter().convert(
      createHyperFramesConverterTestProject(),
    )
    const activePath = exported.projectDirectory.manifest.activeCompositionPath
    const compositionHtml = exported.projectDirectory.files[activePath]
    if (compositionHtml === undefined) {
      throw new Error(`Missing test composition at ${activePath}`)
    }
    exported.projectDirectory.files[activePath] = compositionHtml.replace(
      /<script id="hf-keyframes" type="application\/json">[\s\S]*?<\/script>/,
      '<script id="hf-keyframes" type="application/json">{not-valid-json}</script>',
    )

    const imported = new HyperFramesToFreeCutConverter().convert(exported.projectDirectory)

    expect(imported.unsupportedFeatures).toContain('keyframes-parse-error')
    expect(imported.warnings).toContain(
      'Unable to parse controlled HyperFrames keyframes; source project directory remains canonical',
    )
    expect(imported.project.timeline?.items).toContainEqual(
      expect.objectContaining({
        id: 'hf-freecut-project-1',
        type: 'composition',
        sourceKind: 'hyperframes',
      }),
    )
  })

  it('keeps simple and complex project directory round-trips within Phase 1 budgets', () => {
    const simpleMs = measureRoundTrip(createHyperFramesConverterTestProject())
    const complexMs = measureRoundTrip(createComplexProject(180))

    expect(simpleMs).toBeLessThan(1000)
    expect(complexMs).toBeLessThan(5000)
  })
})

function measureRoundTrip(project: Project): number {
  const start = performance.now()
  const exported = new FreeCutToHyperFramesConverter().convert(project)
  new HyperFramesToFreeCutConverter().convert(exported.projectDirectory)
  return performance.now() - start
}

function createComplexProject(itemCount: number): Project {
  const trackCount = 6
  const project = createHyperFramesConverterTestProject()

  return {
    ...project,
    id: 'complex-project',
    name: 'Complex Launch Cut',
    duration: 3600,
    timeline: {
      masterBusDb: 0,
      tracks: Array.from({ length: trackCount }, (_, index) => ({
        id: `complex-track-${index}`,
        name: `Track ${index + 1}`,
        kind: 'video',
        height: 80,
        locked: false,
        visible: true,
        muted: false,
        solo: false,
        order: index,
      })),
      items: Array.from({ length: itemCount }, (_, index) => ({
        id: `complex-title-${index}`,
        trackId: `complex-track-${index % trackCount}`,
        from: index * 10,
        durationInFrames: 45,
        label: `Title ${index + 1}`,
        type: 'text',
        text: `Scene ${index + 1}`,
        fontSize: 24 + (index % 8),
        fontFamily: 'Inter',
        color: index % 2 === 0 ? '#ffffff' : '#ffcc66',
        transform: {
          x: 40 + (index % 12) * 24,
          y: 80 + (index % 10) * 18,
          opacity: 0.8,
        },
      })),
      keyframes: Array.from({ length: itemCount }, (_, index) => ({
        itemId: `complex-title-${index}`,
        properties: [
          {
            property: 'x',
            keyframes: [
              { id: `complex-kf-${index}-a`, frame: index * 10, value: 40, easing: 'linear' },
              {
                id: `complex-kf-${index}-b`,
                frame: index * 10 + 45,
                value: 240,
                easing: 'ease-out',
              },
            ],
          },
        ],
      })),
    },
  }
}
