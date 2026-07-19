import type { HyperFramesDiagnostic, HyperFramesProjectDirectory } from '@/types/hyperframes'
import type { Project } from '@/types/project'
import { InMemoryHyperFramesProjectRepository } from '../../adapters/freecut-project'
import {
  confirmHyperFramesSkillImport,
  createHyperFramesSkillRepairOptions,
  rollbackHyperFramesSkillImport,
} from './skillImportConfirmation'
import { createHyperFramesSkillImportPreview } from './skillOutputImportPreview'
import type { HyperFramesSkillOutputBundle } from './skillJobQueue'

function createProject(): Project {
  return {
    id: 'freecut-project',
    name: 'FreeCut Project',
    description: '',
    createdAt: 1_000,
    updatedAt: 1_000,
    duration: 180,
    metadata: {
      width: 1920,
      height: 1080,
      fps: 30,
    },
    timeline: {
      currentFrame: 12,
      tracks: [
        {
          id: 'video-1',
          name: 'Video 1',
          kind: 'video',
          height: 80,
          locked: false,
          visible: true,
          muted: false,
          solo: false,
          order: 0,
        },
      ],
      items: [],
    },
  }
}

function createDirectory(
  options: { title?: string; text?: string } = {},
): HyperFramesProjectDirectory {
  const title = options.title ?? 'Preview Project'
  const text = options.text ?? 'Preview'
  return {
    manifest: {
      schemaVersion: 1,
      id: 'preview-project',
      title,
      entryFile: 'index.html',
      activeCompositionPath: 'compositions/main.html',
      canvas: {
        width: 1920,
        height: 1080,
        fps: 30,
        durationInFrames: 180,
      },
      assets: [],
      provenance: {
        source: 'skill-output',
        createdAt: 1_000,
        skillId: 'faceless-explainer',
        modelUsage: {
          modelProfileId: 'model-current',
          modelId: 'planner',
          inputTokens: 10,
          outputTokens: 5,
          estimatedCost: 0.01,
        },
      },
    },
    files: [
      {
        path: 'index.html',
        content: `<!doctype html>
<html>
  <body>
    <div data-composition-id="entry" data-width="1920" data-height="1080" data-start="0" data-duration="6">
      <iframe src="./compositions/main.html" title="${title}"></iframe>
    </div>
    <script>
      window.__timelines = window.__timelines || {};
      window.__timelines["entry"] = {};
    </script>
  </body>
</html>`,
        encoding: 'utf8',
      },
      {
        path: 'compositions/main.html',
        content: `<!doctype html>
<html>
  <body>
    <div data-composition-id="main" data-width="1920" data-height="1080" data-start="0" data-duration="6">
      <section class="clip" data-hf-item="text" data-start="1" data-duration="2"><h1>${text}</h1></section>
    </div>
    <script>
      window.__timelines = window.__timelines || {};
      window.__timelines["main"] = {};
    </script>
  </body>
</html>`,
        encoding: 'utf8',
      },
    ],
    assets: [],
  }
}

function createOutputBundle(directory = createDirectory()): HyperFramesSkillOutputBundle {
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
        modelProfileId: 'model-current',
        modelId: 'planner',
        capability: 'code.hyperframes',
        inputTokens: 100,
        outputTokens: 50,
        estimatedCost: 0.03,
        currency: 'USD',
      },
    ],
  }
}

async function createPreview(directory = createDirectory()) {
  const preview = await createHyperFramesSkillImportPreview(createOutputBundle(directory), {
    id: 'preview-1',
    checkedAt: 2_000,
  })
  expect(preview.blockingDiagnostics).toEqual([])
  return preview
}

describe('skill import confirmation', () => {
  it('rejects confirmation without explicit user approval and does not write output', async () => {
    const repository = new InMemoryHyperFramesProjectRepository()
    const preview = await createPreview()
    const project = createProject()

    await expect(
      confirmHyperFramesSkillImport({
        project,
        preview,
        jobId: 'job-1',
        repository,
        confirmedByUser: false,
      }),
    ).rejects.toThrow(/explicit user confirmation/)

    expect(await repository.readProjectDirectory('preview-project')).toBeUndefined()
    expect(project.timeline?.items).toHaveLength(0)
  })

  it('confirms a source-linked import with native approximations and rollback metadata', async () => {
    const repository = new InMemoryHyperFramesProjectRepository()
    const preview = await createPreview()
    const project = createProject()

    const result = await confirmHyperFramesSkillImport({
      project,
      preview,
      jobId: 'job-1',
      repository,
      confirmedByUser: true,
      confirmedAt: 3_000,
      timelineItemId: 'hf-source-item',
      compositionLinkId: 'hf-link-source-item',
    })

    expect(project.timeline?.items).toHaveLength(0)
    expect(await repository.readProjectDirectory('preview-project')).toBeDefined()
    expect(result.project.hyperframes?.projects['preview-project']).toMatchObject({
      id: 'preview-project',
      provenance: {
        freecutProjectId: 'freecut-project',
        confirmedByUser: true,
      },
    })
    expect(result.project.hyperframes?.compositionLinks['hf-link-source-item']).toMatchObject({
      timelineItemId: 'hf-source-item',
      importStrategy: 'source-linked-with-approximations',
    })
    expect(result.project.timeline?.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'hf-source-item',
          type: 'composition',
          sourceKind: 'hyperframes',
          hyperframesProjectId: 'preview-project',
        }),
        expect.objectContaining({
          id: 'hf-source-item-native-1',
          type: 'text',
          text: 'Preview',
          from: 42,
          durationInFrames: 60,
        }),
      ]),
    )
    expect(result.confirmation.changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          op: 'add',
          kind: 'project-directory',
          path: 'hyperframes/preview-project',
        }),
        expect.objectContaining({
          op: 'add',
          kind: 'composition-link',
          path: 'project.hyperframes.compositionLinks.hf-link-source-item',
        }),
      ]),
    )
    expect(result.rollbackJournal.directoryExistedBefore).toBe(false)
  })

  it('rolls back a confirmed new import by restoring project state and deleting the directory', async () => {
    const repository = new InMemoryHyperFramesProjectRepository()
    const preview = await createPreview()
    const project = createProject()
    const confirmed = await confirmHyperFramesSkillImport({
      project,
      preview,
      jobId: 'job-1',
      repository,
      confirmedByUser: true,
      confirmedAt: 3_000,
      timelineItemId: 'hf-source-item',
    })

    const rollback = await rollbackHyperFramesSkillImport({
      project: confirmed.project,
      repository,
      rollbackJournal: confirmed.rollbackJournal,
      rolledBackAt: 4_000,
    })

    expect(rollback.project.timeline?.items).toHaveLength(0)
    expect(rollback.project.hyperframes).toBeUndefined()
    expect(await repository.readProjectDirectory('preview-project')).toBeUndefined()
    expect(rollback.rolledBackAt).toBe(4_000)
  })

  it('restores a pre-existing project directory from a snapshot on rollback', async () => {
    const previousDirectory = createDirectory({ title: 'Existing', text: 'Existing text' })
    const repository = new InMemoryHyperFramesProjectRepository([previousDirectory])
    const preview = await createPreview(createDirectory({ title: 'Replacement', text: 'New text' }))
    const project = createProject()

    const confirmed = await confirmHyperFramesSkillImport({
      project,
      preview,
      jobId: 'job-1',
      repository,
      confirmedByUser: true,
      confirmedAt: 3_000,
      timelineItemId: 'hf-source-item',
    })
    expect(await repository.readFile('preview-project', 'compositions/main.html')).toContain(
      'New text',
    )

    await rollbackHyperFramesSkillImport({
      project: confirmed.project,
      repository,
      rollbackJournal: confirmed.rollbackJournal,
    })

    expect(await repository.readFile('preview-project', 'compositions/main.html')).toContain(
      'Existing text',
    )
    expect(confirmed.rollbackJournal.directoryExistedBefore).toBe(true)
    expect(confirmed.rollbackJournal.directorySnapshotId).toBeDefined()
  })

  it('offers same-model, switch-model and Studio repair actions for failed output', async () => {
    const diagnostic: HyperFramesDiagnostic = {
      id: 'diag-1',
      code: 'hyperframes.lint.missing_local_asset',
      severity: 'blocking',
      source: 'lint',
      stage: 'import',
      message: 'Missing local asset.',
    }
    const preview = await createPreview()

    const actions = createHyperFramesSkillRepairOptions({
      jobId: 'job-1',
      skillId: 'faceless-explainer',
      outputDirectory: 'tmp/hyperframes/preview-project',
      diagnostics: [diagnostic],
      currentModelProfileId: 'model-current',
      fallbackModelProfileIds: ['model-fallback'],
      preview,
    })

    expect(actions.map((action) => action.type)).toEqual([
      'same-model-repair',
      'switch-model-repair',
      'open-studio-repair',
    ])
    expect(actions).toContainEqual(
      expect.objectContaining({
        type: 'same-model-repair',
        enabled: true,
        modelProfileId: 'model-current',
      }),
    )
    expect(actions).toContainEqual(
      expect.objectContaining({
        type: 'switch-model-repair',
        enabled: true,
        candidateModelProfileIds: ['model-fallback'],
      }),
    )
    expect(actions).toContainEqual(
      expect.objectContaining({
        type: 'open-studio-repair',
        enabled: true,
        hyperframesProjectId: 'preview-project',
        activeCompositionPath: 'compositions/main.html',
      }),
    )
  })
})
