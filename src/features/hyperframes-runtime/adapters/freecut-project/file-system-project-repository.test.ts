import type { HyperFramesProjectDirectory } from '@/types/hyperframes'
import {
  asHandle,
  createRoot,
  readFileText,
} from '@/infrastructure/storage/workspace-fs/__tests__/in-memory-handle'
import { setWorkspaceRoot } from '@/infrastructure/storage/workspace-fs/root'
import {
  FileSystemHyperFramesProjectRepository,
  createWorkspaceHyperFramesProjectRepository,
} from './file-system-project-repository'

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
    assets: [
      {
        id: 'logo',
        path: 'assets/logo.png',
        kind: 'image',
        mimeType: 'image/png',
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
      content: '<!doctype html><html></html>',
      encoding: 'utf8',
    },
    {
      path: 'compositions/main.html',
      content: '<main>initial</main>',
      encoding: 'utf8',
    },
  ],
  assets: [
    {
      path: 'assets/logo.png',
      bytes: new Uint8Array([1, 2, 3]),
      mimeType: 'image/png',
    },
  ],
}

afterEach(() => {
  setWorkspaceRoot(null)
})

describe('FileSystemHyperFramesProjectRepository', () => {
  it('persists project directories across repository instances', async () => {
    const root = createRoot()
    const repository = new FileSystemHyperFramesProjectRepository(asHandle(root))

    await writeDirectory(repository, baseDirectory)

    const reloadedRepository = new FileSystemHyperFramesProjectRepository(asHandle(root))
    const reloaded = await reloadedRepository.readProjectDirectory('hf-project')

    expect(reloaded?.manifest.title).toBe('HyperFrames Project')
    expect(reloaded?.files.map((file) => file.path).sort()).toEqual([
      'compositions/main.html',
      'index.html',
    ])
    expect(reloaded?.files.find((file) => file.path === 'compositions/main.html')?.content).toBe(
      '<main>initial</main>',
    )
    expect(reloaded?.assets[0]?.bytes).toEqual(new Uint8Array([1, 2, 3]))

    const manifestText = await readFileText(
      root,
      'projects',
      'freecut-project',
      'hyperframes',
      'hf-project',
      'manifest.json',
    )
    expect(JSON.parse(manifestText!).id).toBe('hf-project')
  })

  it('lists refs by FreeCut project id from the workspace tree', async () => {
    const root = createRoot()
    const repository = new FileSystemHyperFramesProjectRepository(asHandle(root))

    await writeDirectory(repository, baseDirectory)
    await repository.writeManifest(
      'other-hf-project',
      {
        ...baseDirectory.manifest,
        id: 'other-hf-project',
        title: 'Other HyperFrames Project',
        provenance: {
          ...baseDirectory.manifest.provenance,
          freecutProjectId: 'other-freecut-project',
        },
      },
      { reason: 'seed other project' },
    )

    const refs = await repository.listProjectRefs('freecut-project')

    expect(refs).toHaveLength(1)
    expect(refs[0]).toMatchObject({
      id: 'hf-project',
      freecutProjectId: 'freecut-project',
    })
  })

  it('persists snapshots and restores them after repository recreation', async () => {
    const root = createRoot()
    const repository = new FileSystemHyperFramesProjectRepository(asHandle(root))
    await writeDirectory(repository, baseDirectory)

    const snapshot = await repository.createSnapshot('hf-project', 'before edit')
    await repository.writeFile('hf-project', 'compositions/main.html', '<main>changed</main>', {
      reason: 'edit',
    })
    expect(await repository.readFile('hf-project', 'compositions/main.html')).toBe(
      '<main>changed</main>',
    )

    const reloadedRepository = new FileSystemHyperFramesProjectRepository(asHandle(root))
    await reloadedRepository.restoreSnapshot('hf-project', snapshot.id)

    expect(await reloadedRepository.readFile('hf-project', 'compositions/main.html')).toBe(
      '<main>initial</main>',
    )
    const restored = await reloadedRepository.readProjectDirectory('hf-project')
    expect(restored?.assets[0]?.bytes).toEqual(new Uint8Array([1, 2, 3]))
  })

  it('deletes a persisted project directory', async () => {
    const root = createRoot()
    const repository = new FileSystemHyperFramesProjectRepository(asHandle(root))
    await writeDirectory(repository, baseDirectory)

    await repository.deleteProject('hf-project')

    expect(await repository.readProjectDirectory('hf-project')).toBeUndefined()
  })

  it('updates persisted preview signatures and invalidates stale render signatures', async () => {
    const root = createRoot()
    const repository = new FileSystemHyperFramesProjectRepository(asHandle(root))
    await writeDirectory(repository, baseDirectory)
    const initial = await repository.readManifest('hf-project')

    await repository.writeManifest(
      'hf-project',
      {
        ...initial!,
        renderSignature: 'render-cache-key',
      },
      { reason: 'mark render cache' },
    )
    expect((await repository.readManifest('hf-project'))?.renderSignature).toBe('render-cache-key')

    await repository.copyAsset(
      'hf-project',
      {
        path: 'assets/logo.png',
        bytes: new Uint8Array([9, 8, 7]),
        mimeType: 'image/png',
      },
      { reason: 'replace asset' },
    )

    const changed = await new FileSystemHyperFramesProjectRepository(asHandle(root)).readManifest(
      'hf-project',
    )
    expect(changed?.previewSignature).not.toBe(initial?.previewSignature)
    expect(changed?.renderSignature).toBeUndefined()
  })

  it('creates a repository from the active workspace root', async () => {
    const root = createRoot()
    setWorkspaceRoot(asHandle(root))

    const repository = createWorkspaceHyperFramesProjectRepository({
      freecutProjectId: 'freecut-project',
    })
    await repository.writeManifest('hf-project', baseDirectory.manifest, { reason: 'seed' })

    expect(await repository.readManifest('hf-project')).toMatchObject({
      id: 'hf-project',
      title: 'HyperFrames Project',
    })
  })

  it('rejects path traversal and dangerous file writes', async () => {
    const root = createRoot()
    const repository = new FileSystemHyperFramesProjectRepository(asHandle(root))
    await repository.writeManifest('hf-project', baseDirectory.manifest, { reason: 'seed' })

    await expect(
      repository.writeFile('hf-project', '../escape.html', '<main></main>', {
        reason: 'escape',
      }),
    ).rejects.toThrow(/Unsafe HyperFrames project path/)
    await expect(
      repository.writeFile('hf-project', 'scripts/install.sh', 'rm -rf /', {
        reason: 'shell script',
      }),
    ).rejects.toThrow(/dangerous file extension/)
    await expect(
      repository.copyAsset(
        'hf-project',
        {
          path: 'assets/logo.png',
          bytes: new Uint8Array([1]),
          mimeType: 'application/x-msdownload',
        },
        { reason: 'bad mime' },
      ),
    ).rejects.toThrow(/MIME/)
  })
})

async function writeDirectory(
  repository: FileSystemHyperFramesProjectRepository,
  directory: HyperFramesProjectDirectory,
): Promise<void> {
  await repository.writeManifest(directory.manifest.id, directory.manifest, {
    reason: 'seed manifest',
  })
  for (const file of directory.files) {
    await repository.writeFile(directory.manifest.id, file.path, file.content, {
      reason: 'seed file',
    })
  }
  for (const asset of directory.assets) {
    await repository.copyAsset(directory.manifest.id, asset, {
      reason: 'seed asset',
    })
  }
}
