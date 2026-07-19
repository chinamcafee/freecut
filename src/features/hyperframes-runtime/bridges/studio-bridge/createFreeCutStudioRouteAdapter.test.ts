import { describe, expect, it, vi } from 'vite-plus/test'
import { InMemoryHyperFramesProjectRepository } from '@/features/hyperframes-runtime/adapters/freecut-project/project-repository'
import type { HyperFramesProjectDirectory } from '@/types/hyperframes'
import { createFreeCutStudioAdapter } from './createFreeCutStudioAdapter'
import { createFreeCutStudioRouteAdapter } from './createFreeCutStudioRouteAdapter'

const directory: HyperFramesProjectDirectory = {
  manifest: {
    schemaVersion: 1,
    id: 'hf-project',
    title: 'Route Project',
    entryFile: 'index.html',
    activeCompositionPath: 'compositions/main.html',
    canvas: {
      width: 1280,
      height: 720,
      fps: 30,
      durationInFrames: 150,
    },
    assets: [
      {
        id: 'voice',
        path: 'media/voice.wav',
        kind: 'audio',
        mimeType: 'audio/wav',
      },
    ],
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
      content: '<main data-composition-id="main"><h1>Hello</h1></main>',
      encoding: 'utf8',
    },
    {
      path: 'compositions/notes.txt',
      content: 'not a composition',
      encoding: 'utf8',
    },
  ],
  assets: [
    {
      path: 'media/voice.wav',
      mimeType: 'audio/wav',
      bytes: new Uint8Array([0, 32, 64, 96, 128, 160, 192, 224, 255]),
    },
  ],
}

function createRoutes() {
  const repository = new InMemoryHyperFramesProjectRepository([directory])
  const adapter = createFreeCutStudioAdapter({
    freecutProjectId: 'freecut-project',
    repository,
  })
  return {
    adapter,
    repository,
    routes: createFreeCutStudioRouteAdapter(adapter),
  }
}

describe('createFreeCutStudioRouteAdapter', () => {
  it('routes project, file, preview, lint, thumbnail, selection, render, waveform, and registry APIs', async () => {
    const { routes, repository } = createRoutes()

    await expect(routes.projects.list()).resolves.toMatchObject({
      ok: true,
      body: {
        projects: [
          {
            id: 'hf-project',
            title: 'Route Project',
            activeCompositionPath: 'compositions/main.html',
          },
        ],
      },
    })

    const project = await routes.projects.resolve('hf-project')
    expect(project).toMatchObject({
      ok: true,
      body: {
        id: 'hf-project',
        compositions: ['compositions/main.html'],
      },
    })

    await expect(routes.files.list('hf-project')).resolves.toMatchObject({
      ok: true,
      body: {
        files: expect.arrayContaining([expect.objectContaining({ path: 'index.html' })]),
      },
    })
    await expect(routes.files.read('hf-project', 'compositions/main.html')).resolves.toMatchObject({
      ok: true,
      body: { content: expect.stringContaining('data-composition-id="main"') },
    })
    await expect(
      routes.files.write(
        'hf-project',
        'compositions/main.html',
        '<!doctype html><html><body><main data-composition-id="main">Saved</main></body></html>',
      ),
    ).resolves.toMatchObject({
      ok: true,
      body: { path: 'compositions/main.html', hash: expect.stringMatching(/^fnv1a:/) },
    })
    await expect(repository.readFile('hf-project', 'compositions/main.html')).resolves.toContain(
      'Saved',
    )

    await expect(routes.preview.get('hf-project')).resolves.toMatchObject({
      ok: true,
      body: { previewUrl: expect.stringContaining('data:text/html') },
    })
    await expect(routes.lint.run('hf-project')).resolves.toMatchObject({
      ok: true,
      body: { diagnostics: expect.any(Array) },
    })
    await expect(routes.thumbnail.generate('hf-project', { width: 320 })).resolves.toMatchObject({
      ok: true,
      body: { width: 320, height: 720, url: expect.stringContaining('data:image/svg+xml') },
    })

    await expect(
      routes.selection.update('hf-project', {
        elementId: 'title',
        selector: '#title',
        sourceFile: 'compositions/main.html',
      }),
    ).resolves.toMatchObject({
      ok: true,
      body: { selection: { elementId: 'title' } },
    })
    await expect(routes.selection.get('hf-project')).resolves.toMatchObject({
      ok: true,
      body: { selection: { elementId: 'title' } },
    })

    await expect(routes.render.preview('hf-project')).resolves.toMatchObject({
      ok: true,
      body: {
        previewUrl: expect.stringContaining('data:text/html'),
        diagnostics: expect.any(Array),
      },
    })
    await expect(routes.render.start('hf-project')).resolves.toMatchObject({
      ok: true,
      status: 202,
      body: { projectId: 'hf-project', status: expect.stringMatching(/^(queued|blocked)$/) },
    })

    await expect(
      routes.waveform.get('hf-project', 'media/voice.wav', { peakCount: 16 }),
    ).resolves.toMatchObject({
      ok: true,
      body: { assetPath: 'media/voice.wav', peaks: expect.any(Array) },
    })

    await expect(routes.registry.list()).resolves.toEqual({
      ok: true,
      status: 200,
      body: { blocks: [] },
    })
    await expect(routes.registry.install('hf-project', 'hero-card')).resolves.toMatchObject({
      ok: false,
      status: 501,
    })
  })

  it('rejects unsafe paths before calling file or waveform adapter methods', async () => {
    const { adapter, routes } = createRoutes()
    const readFile = vi.spyOn(adapter, 'readFile')
    const writeFile = vi.spyOn(adapter, 'writeFile')
    const generateWaveform = vi.spyOn(adapter, 'generateWaveform')

    await expect(routes.files.read('hf-project', '../outside.html')).resolves.toMatchObject({
      ok: false,
      status: 403,
    })
    await expect(
      routes.files.write('hf-project', 'http://example.com/file.html', 'bad'),
    ).resolves.toMatchObject({
      ok: false,
      status: 403,
    })
    await expect(routes.waveform.get('hf-project', '../voice.wav')).resolves.toMatchObject({
      ok: false,
      status: 403,
    })

    expect(readFile).not.toHaveBeenCalled()
    expect(writeFile).not.toHaveBeenCalled()
    expect(generateWaveform).not.toHaveBeenCalled()
  })
})
