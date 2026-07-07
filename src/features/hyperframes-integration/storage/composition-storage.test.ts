import { describe, expect, it } from 'vite-plus/test'
import type { HyperFramesProjectDirectory } from '@/types/hyperframes'
import {
  HyperFramesProjectStorage,
  InMemoryHyperFramesFileSystemAdapter,
} from './composition-storage'

function createProjectDirectory(): HyperFramesProjectDirectory {
  return {
    projectId: 'freecut-project-1',
    rootPath: 'hyperframes/freecut-project-1',
    entryFile: 'index.html',
    activeCompositionPath: 'compositions/main.html',
    warnings: [],
    unsupportedFeatures: [],
    assets: [
      {
        id: 'asset-1',
        type: 'video',
        sourcePath: '/media/source.mp4',
        projectPath: 'assets/source.mp4',
        hash: 'hash-source',
      },
    ],
    files: {
      'manifest.json': '{"id":"freecut-project-1"}',
      'index.html': '<div data-composition-src="compositions/main.html"></div>',
      'compositions/main.html': '<main data-hf-stage></main>',
    },
    fileIndex: [],
    manifest: {
      id: 'freecut-project-1',
      name: 'Project 1',
      schemaVersion: 1,
      projectDir: 'hyperframes/freecut-project-1',
      entryFile: 'index.html',
      activeCompositionPath: 'compositions/main.html',
      width: 1920,
      height: 1080,
      fps: { num: 30, den: 1 },
      durationInFrames: 90,
      assets: [],
      compositions: [
        {
          id: 'main',
          path: 'compositions/main.html',
          name: 'Project 1',
          durationInFrames: 90,
        },
      ],
      source: 'freecut-export',
      createdAt: 1,
      updatedAt: 2,
    },
  }
}

describe('HyperFramesProjectStorage', () => {
  it('persists and loads a manifest-backed project directory', async () => {
    const adapter = new InMemoryHyperFramesFileSystemAdapter()
    const storage = new HyperFramesProjectStorage(adapter)
    const projectDirectory = createProjectDirectory()

    const saved = await storage.saveProject(projectDirectory)
    const loaded = await storage.loadProject('freecut-project-1')

    expect(saved.success).toBe(true)
    expect(loaded.success).toBe(true)
    expect(loaded.data?.manifest).toEqual(projectDirectory.manifest)
    expect(loaded.data?.files['index.html']).toContain('data-composition-src')
    expect(await adapter.readFile('hyperframes/freecut-project-1/compositions/main.html')).toContain(
      'data-hf-stage',
    )
  })

  it('rejects unsafe project directory paths', async () => {
    const storage = new HyperFramesProjectStorage(new InMemoryHyperFramesFileSystemAdapter())
    const projectDirectory = createProjectDirectory()
    projectDirectory.files['../outside.html'] = 'escape'

    const result = await storage.saveProject(projectDirectory)

    expect(result.success).toBe(false)
    expect(result.error).toContain('Unsafe HyperFrames project path')
  })

  it('lists and deletes stored project manifests', async () => {
    const storage = new HyperFramesProjectStorage(new InMemoryHyperFramesFileSystemAdapter())
    await storage.saveProject(createProjectDirectory())

    expect((await storage.listProjects()).data).toEqual([
      expect.objectContaining({ id: 'freecut-project-1', name: 'Project 1' }),
    ])
    expect((await storage.deleteProject('freecut-project-1')).success).toBe(true)
    expect((await storage.loadProject('freecut-project-1')).success).toBe(false)
  })
})
