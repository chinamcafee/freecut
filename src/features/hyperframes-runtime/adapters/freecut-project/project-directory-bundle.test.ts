import { unzipSync, zipSync } from 'fflate'
import type { HyperFramesProjectDirectory } from '@/types/hyperframes'
import {
  HYPERFRAMES_PROJECT_BUNDLE_MANIFEST_PATH,
  HYPERFRAMES_PROJECT_MANIFEST_PATH,
  packHyperFramesProjectDirectory,
  unpackHyperFramesProjectDirectory,
} from './project-directory-bundle'

const directory: HyperFramesProjectDirectory = {
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
        hash: 'sha256:logo',
      },
    ],
    provenance: {
      source: 'skill-output',
      createdAt: 1784304000000,
      freecutProjectId: 'freecut-project',
      skillId: 'intro-generator',
      confirmedByUser: true,
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
      content: '<main>bundle</main>',
      encoding: 'utf8',
    },
  ],
  assets: [
    {
      path: 'assets/logo.png',
      bytes: new Uint8Array([1, 2, 3]),
      mimeType: 'image/png',
      hash: 'sha256:logo-bytes',
    },
  ],
}

describe('project-directory-bundle', () => {
  it('packs and unpacks a complete HyperFrames project directory', () => {
    const bundle = packHyperFramesProjectDirectory(directory, { createdAt: 1784305000000 })
    const unzipped = unzipSync(bundle)

    expect(Object.keys(unzipped)).toEqual(
      expect.arrayContaining([
        HYPERFRAMES_PROJECT_BUNDLE_MANIFEST_PATH,
        HYPERFRAMES_PROJECT_MANIFEST_PATH,
        'index.html',
        'compositions/main.html',
      ]),
    )
    expect(unzipped['assets/logo.png']).toEqual(new Uint8Array([1, 2, 3]))

    const restored = unpackHyperFramesProjectDirectory(bundle)

    expect(restored.manifest).toMatchObject({
      id: 'hf-project',
      activeCompositionPath: 'compositions/main.html',
      provenance: {
        source: 'skill-output',
        skillId: 'intro-generator',
        confirmedByUser: true,
      },
    })
    expect(restored.files.map((file) => [file.path, file.content])).toEqual([
      ['index.html', '<!doctype html><html></html>'],
      ['compositions/main.html', '<main>bundle</main>'],
    ])
    expect(restored.assets[0]?.bytes).toEqual(new Uint8Array([1, 2, 3]))
  })

  it('rejects unsafe project paths while packing', () => {
    expect(() =>
      packHyperFramesProjectDirectory({
        ...directory,
        files: [
          ...directory.files,
          {
            path: '../escape.html',
            content: '<main></main>',
            encoding: 'utf8',
          },
        ],
      }),
    ).toThrow(/Unsafe HyperFrames project path/)
  })

  it('rejects bundles missing declared files', () => {
    const brokenBundle = zipSync({
      [HYPERFRAMES_PROJECT_BUNDLE_MANIFEST_PATH]: bytes(
        JSON.stringify({
          schemaVersion: 1,
          projectId: 'hf-project',
          manifestPath: HYPERFRAMES_PROJECT_MANIFEST_PATH,
          createdAt: 1784305000000,
          files: [{ path: 'index.html', encoding: 'utf8', hash: 'hash' }],
          assets: [],
        }),
      ),
      [HYPERFRAMES_PROJECT_MANIFEST_PATH]: bytes(JSON.stringify(directory.manifest)),
    })

    expect(() => unpackHyperFramesProjectDirectory(brokenBundle)).toThrow(
      /missing file: index.html/,
    )
  })

  it('rejects unsupported bundle schema versions', () => {
    const brokenBundle = zipSync({
      [HYPERFRAMES_PROJECT_BUNDLE_MANIFEST_PATH]: bytes(
        JSON.stringify({
          schemaVersion: 999,
          projectId: 'hf-project',
          manifestPath: HYPERFRAMES_PROJECT_MANIFEST_PATH,
          createdAt: 1784305000000,
          files: [],
          assets: [],
        }),
      ),
      [HYPERFRAMES_PROJECT_MANIFEST_PATH]: bytes(JSON.stringify(directory.manifest)),
    })

    expect(() => unpackHyperFramesProjectDirectory(brokenBundle)).toThrow(
      /Unsupported HyperFrames bundle schema/,
    )
  })
})

function bytes(value: string): Uint8Array {
  return new Uint8Array(new TextEncoder().encode(value))
}
