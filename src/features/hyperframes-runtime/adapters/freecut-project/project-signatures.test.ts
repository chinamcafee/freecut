import type { HyperFramesProjectDirectory, HyperFramesProjectManifest } from '@/types/hyperframes'
import {
  computeHyperFramesManifestSignature,
  computeHyperFramesPreviewSignature,
  computeHyperFramesRenderSignature,
  reconcileHyperFramesPreviewSignature,
} from './project-signatures'

const manifest: HyperFramesProjectManifest = {
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
    source: 'studio-edit',
    createdAt: 1784304000000,
    updatedAt: 1784305000000,
    freecutProjectId: 'freecut-project',
  },
}

const directory: HyperFramesProjectDirectory = {
  manifest,
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

describe('project-signatures', () => {
  it('computes stable manifest signatures while ignoring volatile signature fields', () => {
    const base = computeHyperFramesManifestSignature(manifest)
    const withVolatileFields = computeHyperFramesManifestSignature({
      ...manifest,
      previewSignature: 'old-preview',
      renderSignature: 'old-render',
      provenance: {
        ...manifest.provenance,
        createdAt: manifest.provenance.createdAt + 1,
        updatedAt: manifest.provenance.updatedAt! + 1,
      },
      lastStudioSave: {
        savedAt: Date.now(),
        files: ['index.html'],
      },
    })
    const changedManifest = computeHyperFramesManifestSignature({
      ...manifest,
      activeCompositionPath: 'compositions/other.html',
    })

    expect(withVolatileFields).toBe(base)
    expect(changedManifest).not.toBe(base)
  })

  it('keeps preview signatures stable across file and asset ordering', () => {
    const reordered: HyperFramesProjectDirectory = {
      manifest: {
        ...manifest,
        title: 'Renamed in UI',
        provenance: {
          ...manifest.provenance,
          updatedAt: manifest.provenance.updatedAt! + 1000,
        },
      },
      files: [...directory.files].reverse(),
      assets: [...directory.assets].reverse(),
    }

    expect(computeHyperFramesPreviewSignature(reordered)).toBe(
      computeHyperFramesPreviewSignature(directory),
    )
  })

  it('changes preview signatures when files or assets change', () => {
    const before = computeHyperFramesPreviewSignature(directory)
    const fileChanged = computeHyperFramesPreviewSignature({
      ...directory,
      files: directory.files.map((file) =>
        file.path === 'compositions/main.html'
          ? { ...file, content: '<main>changed</main>' }
          : file,
      ),
    })
    const assetChanged = computeHyperFramesPreviewSignature({
      ...directory,
      assets: [
        {
          ...directory.assets[0]!,
          bytes: new Uint8Array([3, 2, 1]),
        },
      ],
    })

    expect(fileChanged).not.toBe(before)
    expect(assetChanged).not.toBe(before)
  })

  it('changes render signatures when render settings change', () => {
    const baseInput = {
      width: 1920,
      height: 1080,
      fps: 30,
      quality: 'final',
      format: 'mp4',
      alpha: false,
      includeAudio: false,
      engine: 'hyperframes-producer' as const,
      producerVersion: 'producer-1',
    }
    const before = computeHyperFramesRenderSignature(directory, baseInput)

    expect(
      computeHyperFramesRenderSignature(directory, {
        ...baseInput,
        format: 'webm',
      }),
    ).not.toBe(before)
    expect(
      computeHyperFramesRenderSignature(directory, {
        ...baseInput,
        includeAudio: true,
      }),
    ).not.toBe(before)
  })

  it('preserves render signatures only when the preview signature is unchanged', () => {
    const signedManifest = reconcileHyperFramesPreviewSignature(directory)
    const cachedManifest = {
      ...signedManifest,
      renderSignature: 'render-cache-key',
    }

    const preserved = reconcileHyperFramesPreviewSignature({
      ...directory,
      manifest: cachedManifest,
    })
    const invalidated = reconcileHyperFramesPreviewSignature({
      ...directory,
      manifest: cachedManifest,
      files: directory.files.map((file) =>
        file.path === 'index.html' ? { ...file, content: '<changed></changed>' } : file,
      ),
    })

    expect(preserved.renderSignature).toBe('render-cache-key')
    expect(invalidated.renderSignature).toBeUndefined()
  })
})
