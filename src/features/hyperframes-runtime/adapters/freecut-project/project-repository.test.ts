import type { HyperFramesProjectDirectory } from '@/types/hyperframes'
import { InMemoryHyperFramesProjectRepository } from './project-repository'

const baseDirectory: HyperFramesProjectDirectory = {
  manifest: {
    schemaVersion: 1,
    id: 'hf-project',
    title: 'HyperFrames Project',
    entryFile: 'index.html',
    activeCompositionPath: 'compositions/main.html',
    canvas: {
      width: 1920,
      height: 1080,
      fps: 30,
      durationInFrames: 90,
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
      content: '<!doctype html><html></html>',
      encoding: 'utf8',
    },
  ],
  assets: [],
}

describe('InMemoryHyperFramesProjectRepository', () => {
  it('persists manifests and source files', async () => {
    const repository = new InMemoryHyperFramesProjectRepository([baseDirectory])

    await repository.writeFile('hf-project', 'compositions/main.html', '<main></main>', {
      reason: 'test write',
    })

    const manifest = await repository.readManifest('hf-project')
    const file = await repository.readFile('hf-project', 'compositions/main.html')

    expect(manifest?.title).toBe('HyperFrames Project')
    expect(manifest?.provenance.updatedAt).toBeTypeOf('number')
    expect(file).toBe('<main></main>')
  })

  it('filters project refs by FreeCut project id', async () => {
    const repository = new InMemoryHyperFramesProjectRepository([baseDirectory])
    await repository.writeManifest(
      'other-project',
      {
        ...baseDirectory.manifest,
        id: 'other-project',
        title: 'Other',
        provenance: {
          ...baseDirectory.manifest.provenance,
          freecutProjectId: 'other-freecut-project',
        },
      },
      { reason: 'seed' },
    )

    const refs = await repository.listProjectRefs('freecut-project')

    expect(refs).toHaveLength(1)
    expect(refs[0]?.id).toBe('hf-project')
  })

  it('creates and restores snapshots', async () => {
    const repository = new InMemoryHyperFramesProjectRepository([baseDirectory])
    const snapshot = await repository.createSnapshot('hf-project', 'before edit')

    await repository.writeFile('hf-project', 'index.html', '<changed></changed>', {
      reason: 'edit',
    })
    expect(await repository.readFile('hf-project', 'index.html')).toBe('<changed></changed>')

    await repository.restoreSnapshot('hf-project', snapshot.id)

    expect(await repository.readFile('hf-project', 'index.html')).toBe(
      '<!doctype html><html></html>',
    )
  })

  it('deletes project directories created by a confirmed import rollback', async () => {
    const repository = new InMemoryHyperFramesProjectRepository([baseDirectory])

    await repository.deleteProject('hf-project')

    expect(await repository.readProjectDirectory('hf-project')).toBeUndefined()
  })

  it('computes signatures from manifest, files and assets', async () => {
    const repository = new InMemoryHyperFramesProjectRepository([baseDirectory])
    const before = await repository.computeSignature('hf-project')

    await repository.copyAsset(
      'hf-project',
      {
        path: 'assets/logo.png',
        bytes: new Uint8Array([1, 2, 3]),
        mimeType: 'image/png',
      },
      { reason: 'copy asset' },
    )
    const afterAsset = await repository.computeSignature('hf-project')

    await repository.writeFile('hf-project', 'index.html', '<changed></changed>', {
      reason: 'edit',
    })
    const afterFile = await repository.computeSignature('hf-project')

    expect(afterAsset).not.toBe(before)
    expect(afterFile).not.toBe(afterAsset)
  })

  it('updates preview signatures and invalidates stale render signatures on writes', async () => {
    const repository = new InMemoryHyperFramesProjectRepository([baseDirectory])
    const initial = await repository.readManifest('hf-project')
    expect(initial?.previewSignature).toMatch(/^fnv1a:/)

    await repository.writeManifest(
      'hf-project',
      {
        ...initial!,
        renderSignature: 'render-cache-key',
      },
      { reason: 'mark render cache' },
    )
    expect((await repository.readManifest('hf-project'))?.renderSignature).toBe('render-cache-key')

    await repository.writeFile('hf-project', 'index.html', '<changed></changed>', {
      reason: 'edit',
    })

    const changed = await repository.readManifest('hf-project')
    expect(changed?.previewSignature).not.toBe(initial?.previewSignature)
    expect(changed?.renderSignature).toBeUndefined()
  })
})
