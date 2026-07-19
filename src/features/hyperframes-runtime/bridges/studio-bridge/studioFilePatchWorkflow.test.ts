import { describe, expect, it, vi } from 'vite-plus/test'
import { hashHyperFramesText } from '@/features/hyperframes-runtime/adapters/freecut-project'
import { InMemoryHyperFramesProjectRepository } from '@/features/hyperframes-runtime/adapters/freecut-project/project-repository'
import type { HyperFramesProjectDirectory } from '@/types/hyperframes'
import { createFreeCutStudioAdapter } from './createFreeCutStudioAdapter'
import {
  captureStudioSelectionSnapshot,
  confirmStudioFilePatch,
  prepareStudioFilePatch,
  rollbackStudioFilePatch,
} from './studioFilePatchWorkflow'

const sourceHtml =
  '<!doctype html><html><body><main data-composition-id="main" data-width="1280" data-height="720" data-start="0" data-duration="3" data-no-timeline><h1 id="title" class="clip" data-start="0" data-duration="3" style="visibility: hidden">Hello</h1></main></body></html>'

const directory: HyperFramesProjectDirectory = {
  manifest: {
    schemaVersion: 1,
    id: 'hf-project',
    title: 'AI Patch Project',
    entryFile: 'index.html',
    activeCompositionPath: 'compositions/main.html',
    canvas: {
      width: 1280,
      height: 720,
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
      content: '<iframe src="compositions/main.html"></iframe>',
      encoding: 'utf8',
    },
    {
      path: 'compositions/main.html',
      content: sourceHtml,
      encoding: 'utf8',
    },
  ],
  assets: [],
}

function createWorkflowHarness() {
  const repository = new InMemoryHyperFramesProjectRepository([directory])
  const adapter = createFreeCutStudioAdapter({
    freecutProjectId: 'freecut-project',
    repository,
  })
  return { adapter, repository }
}

describe('studioFilePatchWorkflow', () => {
  it('previews a model patch without writing, then confirms and rolls back through a journal', async () => {
    const { adapter, repository } = createWorkflowHarness()
    const writeFile = vi.spyOn(adapter, 'writeFile')

    const selectionSnapshot = await captureStudioSelectionSnapshot({
      adapter,
      projectId: 'hf-project',
      selection: {
        elementId: 'title',
        selector: '#title',
        sourceFile: 'compositions/main.html',
        startOffset: sourceHtml.indexOf('Hello'),
        endOffset: sourceHtml.indexOf('Hello') + 'Hello'.length,
      },
    })

    expect(selectionSnapshot).toEqual(
      expect.objectContaining({
        filePath: 'compositions/main.html',
        contentHash: hashHyperFramesText(sourceHtml),
        target: { id: 'title', selector: '#title' },
      }),
    )

    const preview = await prepareStudioFilePatch({
      adapter,
      selectionSnapshot,
      proposal: {
        id: 'proposal-1',
        projectId: 'hf-project',
        filePath: selectionSnapshot.filePath,
        target: selectionSnapshot.target,
        operations: [{ type: 'inline-style', property: 'color', value: '#0066ff' }],
        baseContentHash: selectionSnapshot.contentHash,
        promptSummary: 'Set title color to brand blue',
        modelUsage: { modelProfileId: 'local-model', inputTokens: 12, outputTokens: 8 },
        createdAt: 1784304000000,
      },
    })

    expect(writeFile).not.toHaveBeenCalled()
    expect(preview.status).toBe('waiting-confirmation')
    expect({
      canConfirm: preview.canConfirm,
      matched: preview.matched,
      inputHashMatches: preview.inputHashMatches,
      changed: preview.diff.changed,
      risks: preview.risks,
      diagnostics: preview.diagnostics.map((diagnostic) => ({
        severity: diagnostic.severity,
        code: diagnostic.code,
      })),
    }).toEqual({
      canConfirm: true,
      matched: true,
      inputHashMatches: true,
      changed: true,
      risks: [],
      diagnostics: [],
    })
    expect(preview.afterContent).toContain('color: #0066ff')
    expect(preview.diff).toEqual(
      expect.objectContaining({
        filePath: 'compositions/main.html',
        changed: true,
      }),
    )

    await expect(
      confirmStudioFilePatch({ adapter, preview, confirmedByUser: false }),
    ).rejects.toThrow('explicit user confirmation')
    expect(writeFile).not.toHaveBeenCalled()

    const confirmation = await confirmStudioFilePatch({ adapter, preview, confirmedByUser: true })
    expect(confirmation.journal).toEqual(
      expect.objectContaining({
        projectId: 'hf-project',
        filePath: 'compositions/main.html',
        proposalId: 'proposal-1',
        confirmedByUser: true,
        snapshotId: expect.stringMatching(/^snapshot-/),
      }),
    )
    await expect(repository.readFile('hf-project', 'compositions/main.html')).resolves.toContain(
      'color: #0066ff',
    )
    await expect(repository.readManifest('hf-project')).resolves.toMatchObject({
      lastModelMutation: {
        modelProfileId: 'local-model',
        promptSummary: 'Set title color to brand blue',
        confirmedByUser: true,
      },
    })

    await expect(
      rollbackStudioFilePatch({ adapter, journal: confirmation.journal }),
    ).resolves.toEqual(
      expect.objectContaining({
        projectId: 'hf-project',
        snapshotId: confirmation.journal.snapshotId,
      }),
    )
    await expect(repository.readFile('hf-project', 'compositions/main.html')).resolves.toBe(
      sourceHtml,
    )
  })

  it('rejects unsafe paths and stale model proposals before confirmation', async () => {
    const { adapter } = createWorkflowHarness()

    await expect(
      prepareStudioFilePatch({
        adapter,
        proposal: {
          id: 'unsafe',
          projectId: 'hf-project',
          filePath: '../outside.html',
          target: { id: 'title' },
          operations: [{ type: 'inline-style', property: 'opacity', value: '0.8' }],
          createdAt: 1784304000000,
        },
      }),
    ).rejects.toThrow('Unsafe HyperFrames project path')

    const stalePreview = await prepareStudioFilePatch({
      adapter,
      proposal: {
        id: 'stale',
        projectId: 'hf-project',
        filePath: 'compositions/main.html',
        target: { id: 'title' },
        operations: [{ type: 'inline-style', property: 'opacity', value: '0.8' }],
        baseContentHash: 'fnv1a:stale',
        createdAt: 1784304000000,
      },
    })

    expect(stalePreview.inputHashMatches).toBe(false)
    expect(stalePreview.canConfirm).toBe(false)
    expect(stalePreview.risks).toContain(
      'Source file changed after the model proposal was created.',
    )
  })
})
