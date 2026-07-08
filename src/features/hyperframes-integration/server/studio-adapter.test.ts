import { describe, expect, it } from 'vite-plus/test'
import type { HyperFramesProjectDirectory } from '@/types/hyperframes'
import { createHyperCutStudioAdapter, safeProjectPath } from './studio-adapter'

const projectDirectory: HyperFramesProjectDirectory = {
  projectId: 'hf-project',
  rootPath: 'hyperframes/hf-project',
  entryFile: 'index.html',
  activeCompositionPath: 'compositions/main.html',
  assets: [
    {
      id: 'asset-1',
      type: 'audio',
      sourcePath: 'media/audio.wav',
      projectPath: 'assets/audio.wav',
      hash: 'audio-hash',
    },
  ],
  warnings: [],
  unsupportedFeatures: [],
  manifest: {
    id: 'hf-project',
    name: 'Adapter Project',
    schemaVersion: 1,
    projectDir: 'hyperframes/hf-project',
    entryFile: 'index.html',
    activeCompositionPath: 'compositions/main.html',
    width: 1280,
    height: 720,
    fps: { num: 30, den: 1 },
    durationInFrames: 60,
    assets: [],
    compositions: [],
    source: 'hyperframes-project',
    createdAt: 1,
    updatedAt: 2,
  },
  files: {
    'index.html': '<main data-composition-src="compositions/main.html"></main>',
    'compositions/main.html': '<section data-hf-item data-hf-type="text">Hello</section>',
  },
  fileIndex: [],
}

describe('HyperCut Studio adapter', () => {
  it('normalizes project-relative paths and rejects path escape attempts', () => {
    expect(safeProjectPath('compositions/../index.html')).toBe('index.html')
    expect(() => safeProjectPath('../outside.html')).toThrow('Unsafe project path')
    expect(() => safeProjectPath('/absolute.html')).toThrow('Unsafe project path')
    expect(() => safeProjectPath('nested//file.html')).toThrow('Unsafe project path')
  })

  it('lists projects, resolves manifests, bundles preview HTML, and lints unsafe HTML', async () => {
    const adapter = createHyperCutStudioAdapter({ projects: [projectDirectory] })

    await expect(adapter.listProjects()).resolves.toEqual([
      {
        id: 'hf-project',
        name: 'Adapter Project',
        activeCompositionPath: 'compositions/main.html',
        signature: expect.any(String),
      },
    ])
    await expect(adapter.resolveProject('hf-project')).resolves.toMatchObject({
      manifest: { id: 'hf-project' },
      signature: expect.any(String),
    })
    await expect(adapter.bundle('hf-project', 'compositions/main.html')).resolves.toMatchObject({
      html: expect.stringContaining('Hello'),
      signature: expect.any(String),
    })
    await expect(
      adapter.lint('hf-project', '<img src=x onerror="alert(1)"><script>alert(1)</script>'),
    ).resolves.toEqual({
      diagnostics: [
        expect.objectContaining({ code: 'unsafe-script' }),
        expect.objectContaining({ code: 'unsafe-attribute' }),
      ],
    })
  })

  it('reads, writes, creates, patches, deletes files, and changes project signatures', async () => {
    const adapter = createHyperCutStudioAdapter({ projects: [projectDirectory] })
    const before = (await adapter.resolveProject('hf-project')).signature

    await expect(adapter.readFile('hf-project', 'compositions/main.html')).resolves.toContain('Hello')
    await adapter.writeFile('hf-project', 'compositions/main.html', '<h1>Updated</h1>')
    await expect(adapter.readFile('hf-project', 'compositions/main.html')).resolves.toBe(
      '<h1>Updated</h1>',
    )
    await adapter.createFile('hf-project', 'compositions/extra.html', '<p>Extra</p>')
    await adapter.patchFile('hf-project', 'compositions/extra.html', [
      { search: 'Extra', replace: 'Patched' },
    ])
    await expect(adapter.readFile('hf-project', 'compositions/extra.html')).resolves.toBe(
      '<p>Patched</p>',
    )
    await adapter.deleteFile('hf-project', 'compositions/extra.html')
    await expect(adapter.readFile('hf-project', 'compositions/extra.html')).rejects.toThrow(
      'Missing file',
    )

    const after = (await adapter.resolveProject('hf-project')).signature
    expect(after).not.toBe(before)
  })

  it('stores selection and exposes thumbnail, waveform, registry, and dry-run render smoke APIs', async () => {
    const adapter = createHyperCutStudioAdapter({ projects: [projectDirectory] })

    await adapter.putSelection('hf-project', {
      activeCompositionPath: 'compositions/main.html',
      selectedNodeId: 'headline',
    })
    await expect(adapter.getSelection('hf-project')).resolves.toEqual({
      activeCompositionPath: 'compositions/main.html',
      selectedNodeId: 'headline',
    })
    await expect(adapter.thumbnail('hf-project', 'compositions/main.html')).resolves.toMatchObject({
      path: 'hyperframes/hf-project/thumbnails/compositions-main-html.svg',
      signature: expect.any(String),
    })
    await expect(adapter.waveform('hf-project', 'asset-1')).resolves.toMatchObject({
      assetId: 'asset-1',
      peaks: expect.any(Array),
    })
    await expect(adapter.registry.listBlocks()).resolves.toEqual([
      expect.objectContaining({ id: 'headline-basic' }),
    ])
    await adapter.registry.installBlock('hf-project', 'headline-basic')
    await expect(adapter.readFile('hf-project', 'blocks/headline-basic.html')).resolves.toContain(
      'data-hf-block',
    )
    await expect(adapter.startRender('hf-project', { dryRun: true })).resolves.toMatchObject({
      id: expect.any(String),
      status: 'queued',
      engine: 'dry-run',
    })
  })
})
