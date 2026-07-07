import { describe, expect, it } from 'vite-plus/test'
import { createHyperFramesConverterTestProject } from './test-project'
import { FreeCutToHyperFramesConverter } from '../FreeCutToHyperFramesConverter'

describe('FreeCutToHyperFramesConverter project directory export', () => {
  it('generates a manifest-backed HyperFrames project directory instead of a single HTML blob', () => {
    const result = new FreeCutToHyperFramesConverter().convert(createHyperFramesConverterTestProject())

    expect(result.projectDirectory.manifest).toMatchObject({
      id: 'freecut-project-1',
      name: 'Launch Cut',
      entryFile: 'index.html',
      activeCompositionPath: 'compositions/main.html',
      source: 'freecut-export',
    })
    expect(result.projectDirectory.files['manifest.json']).toContain('"activeCompositionPath"')
    expect(result.projectDirectory.files['index.html']).toContain(
      'data-composition-src="compositions/main.html"',
    )
    expect(result.projectDirectory.files['compositions/main.html']).toContain('data-hf-type="text"')
    expect(result.projectDirectory.files['compositions/main.html']).toContain('data-start="0.5"')
    expect(result.projectDirectory.files['compositions/main.html']).not.toContain('cdn.jsdelivr.net')
    expect(result.projectDirectory.assets).toEqual([
      expect.objectContaining({
        id: 'asset-1',
        sourcePath: '/media/launch.mp4',
        projectPath: 'assets/launch.mp4',
        hash: expect.any(String),
      }),
    ])
    expect(result.warnings).toContain(
      'Item clip 的音频 EQ 不能无损转换为 HyperFrames，已保留为 warning',
    )
    expect(result.unsupportedFeatures).toContain('audio-eq')
  })
})
