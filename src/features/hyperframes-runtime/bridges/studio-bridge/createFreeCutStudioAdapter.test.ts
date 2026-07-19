import { describe, expect, it } from 'vite-plus/test'
import { InMemoryHyperFramesProjectRepository } from '@/features/hyperframes-runtime/adapters/freecut-project/project-repository'
import type { HyperFramesProjectDirectory } from '@/types/hyperframes'
import { createFreeCutStudioAdapter } from './createFreeCutStudioAdapter'
import type { FreeCutStudioSelection } from './StudioSelectionMapper'

const directory: HyperFramesProjectDirectory = {
  manifest: {
    schemaVersion: 1,
    id: 'hf-project',
    title: 'Adapter Project',
    entryFile: 'index.html',
    activeCompositionPath: 'compositions/main.html',
    canvas: {
      width: 1920,
      height: 1080,
      fps: 30,
      durationInFrames: 120,
    },
    assets: [],
    provenance: {
      source: 'manual-import',
      createdAt: 1784304000000,
      freecutProjectId: 'freecut-project',
    },
  },
  files: [
    {
      path: 'index.html',
      content: '<iframe src="compositions/main.html"></iframe>',
      encoding: 'utf8',
    },
    {
      path: 'compositions/main.html',
      content:
        '<!doctype html><html><body><main data-composition-id="main"><img src="./missing.png" /></main></body></html>',
      encoding: 'utf8',
    },
  ],
  assets: [],
}

function createAdapter() {
  const repository = new InMemoryHyperFramesProjectRepository([directory])
  return {
    repository,
    adapter: createFreeCutStudioAdapter({
      freecutProjectId: 'freecut-project',
      repository,
    }),
  }
}

describe('createFreeCutStudioAdapter', () => {
  it('lists, reads, and writes project files through the repository boundary', async () => {
    const { adapter, repository } = createAdapter()

    await expect(adapter.listFiles('hf-project')).resolves.toEqual([
      expect.objectContaining({ path: 'compositions/main.html' }),
      expect.objectContaining({ path: 'index.html' }),
    ])
    await expect(adapter.readFile('hf-project', 'compositions/main.html')).resolves.toContain(
      'data-composition-id="main"',
    )

    const result = await adapter.writeFile(
      'hf-project',
      'compositions/main.html',
      '<main data-composition-id="main">Saved</main>',
      { reason: 'test-save', provenance: { source: 'studio-edit' } },
    )

    expect(result.hash).toMatch(/^fnv1a:/)
    await expect(repository.readFile('hf-project', 'compositions/main.html')).resolves.toContain(
      'Saved',
    )
  })

  it('provides preview, lint, selection, thumbnail, and renderPreview capabilities', async () => {
    const { adapter } = createAdapter()

    await expect(adapter.previewUrl('hf-project', 'compositions/main.html')).resolves.toContain(
      'data:text/html',
    )

    const lint = await adapter.lint('hf-project', 'compositions/main.html')
    expect(lint.ok).toBe(false)
    expect(lint.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'hyperframes.lint.missing_local_asset',
          file: 'compositions/main.html',
        }),
      ]),
    )

    const selection: FreeCutStudioSelection = {
      elementId: 'title',
      selector: '#title',
      sourceFile: 'compositions/main.html',
      startOffset: 4,
    }
    await adapter.updateSelection('hf-project', selection)
    await expect(adapter.getSelection('hf-project')).resolves.toEqual(selection)

    const thumbnail = await adapter.generateThumbnail('hf-project', { width: 320, height: 180 })
    expect(thumbnail).toEqual(
      expect.objectContaining({
        url: expect.stringContaining('data:image/svg+xml'),
        width: 320,
        height: 180,
      }),
    )

    const renderPreview = await adapter.renderPreview('hf-project', {
      compositionPath: 'compositions/main.html',
    })
    expect(renderPreview.ok).toBe(false)
    expect(renderPreview.previewUrl).toContain('data:text/html')
    expect(renderPreview.diagnostics.length).toBeGreaterThan(0)
  })
})
