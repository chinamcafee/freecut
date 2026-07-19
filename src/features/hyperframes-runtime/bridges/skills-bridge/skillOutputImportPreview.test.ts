import type { HyperFramesProjectDirectory, HyperFramesProjectManifest } from '@/types/hyperframes'
import type { HyperFramesSkillOutputBundle } from './skillJobQueue'
import {
  createHyperFramesSkillImportPreview,
  normalizeSkillOutputBundle,
} from './skillOutputImportPreview'

function createManifest(): HyperFramesProjectManifest {
  return {
    schemaVersion: 1,
    id: 'preview-project',
    title: 'Preview Project',
    entryFile: 'index.html',
    activeCompositionPath: 'compositions/main.html',
    canvas: {
      width: 1920,
      height: 1080,
      fps: 30,
      durationInFrames: 180,
    },
    assets: [
      {
        id: 'voiceover',
        path: 'assets/voiceover.mp3',
        kind: 'audio',
        mimeType: 'audio/mpeg',
        hash: 'sha256:voiceover',
      },
    ],
    provenance: {
      source: 'skill-output',
      createdAt: 1_000,
      skillId: 'faceless-explainer',
    },
  }
}

function createDirectory(): HyperFramesProjectDirectory {
  return {
    manifest: createManifest(),
    files: [
      {
        path: 'index.html',
        content: `<!doctype html>
<html>
  <body>
    <div data-composition-id="entry" data-width="1920" data-height="1080" data-start="0" data-duration="6">
      <iframe src="./compositions/main.html" title="Preview"></iframe>
    </div>
    <script>
      window.__timelines = window.__timelines || {};
      window.__timelines["entry"] = {};
    </script>
  </body>
</html>`,
        encoding: 'utf8',
        hash: 'sha256:index',
      },
      {
        path: 'compositions/main.html',
        content: `<!doctype html>
<html>
  <body>
    <div data-composition-id="main" data-width="1920" data-height="1080" data-start="0" data-duration="6">
      <section data-hf-item="text"><h1>Preview</h1></section>
    </div>
    <script>
      window.__timelines = window.__timelines || {};
      window.__timelines["main"] = {};
    </script>
  </body>
</html>`,
        encoding: 'utf8',
        hash: 'sha256:main',
      },
    ],
    assets: [
      {
        path: 'assets/voiceover.mp3',
        bytes: new Uint8Array([1, 2, 3, 4]),
        mimeType: 'audio/mpeg',
        hash: 'sha256:voiceover-bytes',
      },
    ],
  }
}

function createOutputBundle(): HyperFramesSkillOutputBundle {
  const directory = createDirectory()
  return {
    outputDirectory: 'tmp/hyperframes/preview-project',
    suggestedImportStrategy: 'source-link-with-approximations',
    projectDirectory: directory,
    manifest: directory.manifest,
    generatedFiles: directory.files,
    sourceAssets: directory.assets,
    logs: [],
    diagnostics: [],
    modelUsage: [
      {
        modelId: 'planner',
        capability: 'text.planning',
        inputTokens: 100,
        outputTokens: 50,
        estimatedCost: 0.03,
        currency: 'USD',
      },
      {
        modelId: 'vision',
        capability: 'vision.understanding',
        inputTokens: 80,
        outputTokens: 20,
        estimatedCost: 0.02,
        currency: 'USD',
      },
    ],
  }
}

describe('skill output import preview', () => {
  it('creates a linted import preview with file tree, assets, model cost and iframe document', async () => {
    const preview = await createHyperFramesSkillImportPreview(createOutputBundle(), {
      id: 'preview-1',
      checkedAt: 2_000,
      sandboxToken: 'token',
    })

    expect(preview.id).toBe('preview-1')
    expect(preview.title).toBe('Preview Project')
    expect(preview.blockingDiagnostics).toEqual([])
    expect(preview.canConfirmImport).toBe(true)
    expect(preview.previewDocument).toMatchObject({
      projectId: 'preview-project',
      compositionPath: 'compositions/main.html',
      sandboxToken: 'token',
    })
    expect(preview.fileTree.map((file) => file.path)).toEqual(
      expect.arrayContaining(['index.html', 'compositions/main.html', 'assets/voiceover.mp3']),
    )
    expect(preview.assets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'assets/voiceover.mp3',
          sizeBytes: 4,
        }),
      ]),
    )
    expect(preview.costSummary).toMatchObject({
      currency: 'USD',
      estimatedCost: 0.05,
      inputTokens: 180,
      outputTokens: 70,
    })
    expect(preview.selectedImportStrategy).toBe('source-link-with-approximations')
  })

  it('blocks import when the active composition is missing', async () => {
    const output = createOutputBundle()
    output.projectDirectory = {
      ...output.projectDirectory!,
      files: output.projectDirectory!.files.filter(
        (file) => file.path !== 'compositions/main.html',
      ),
    }
    output.generatedFiles = output.projectDirectory.files

    const preview = await createHyperFramesSkillImportPreview(output)

    expect(preview.canConfirmImport).toBe(false)
    expect(preview.previewDocument).toBeUndefined()
    expect(preview.blockingDiagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'hyperframes.import_preview.missing_active_composition',
        }),
      ]),
    )
  })

  it('allows the user to select a different enabled import strategy', async () => {
    const preview = await createHyperFramesSkillImportPreview(createOutputBundle(), {
      selectedImportStrategy: 'source-link',
    })

    expect(preview.selectedImportStrategy).toBe('source-link')
    expect(preview.importStrategyOptions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          strategy: 'source-link',
          enabled: true,
        }),
        expect.objectContaining({
          strategy: 'source-link-with-approximations',
          recommended: true,
        }),
        expect.objectContaining({
          strategy: 'rendered-media',
          enabled: true,
        }),
      ]),
    )
  })

  it('normalizes bundles that only provide manifest, generated files and source assets', () => {
    const directory = createDirectory()
    const normalized = normalizeSkillOutputBundle({
      ...createOutputBundle(),
      projectDirectory: undefined,
      manifest: directory.manifest,
      generatedFiles: directory.files,
      sourceAssets: directory.assets,
    })

    expect(normalized.projectDirectory?.manifest.id).toBe('preview-project')
    expect(normalized.projectDirectory?.files).toHaveLength(2)
    expect(normalized.projectDirectory?.assets).toHaveLength(1)
    expect(normalized.diagnostics).toEqual([])
  })
})
