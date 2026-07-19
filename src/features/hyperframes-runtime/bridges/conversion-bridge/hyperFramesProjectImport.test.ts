import { describe, expect, it } from 'vite-plus/test'
import type { Project } from '@/types/project'
import { InMemoryHyperFramesProjectRepository, createHyperFramesCompilerAdapter } from '../../adapters/freecut-project'
import { resolveHyperFramesStudioItem } from '../studio-bridge/types'
import { exportFreeCutProjectToHyperFramesDirectory } from './freeCutProjectExport'
import { importHyperFramesProjectDirectory } from './hyperFramesProjectImport'

const targetProject: Project = {
  id: 'target-project', name: 'Target', description: '', createdAt: 1, updatedAt: 1,
  duration: 120, metadata: { width: 1280, height: 720, fps: 30 },
  timeline: {
    tracks: [{ id: 'v1', name: 'V1', kind: 'video', order: 0, height: 80, locked: false, visible: true, muted: false, solo: false }],
    items: [], currentFrame: 45,
  },
}

describe('importHyperFramesProjectDirectory', () => {
  it('persists the directory and creates a source-linked composition that Studio and Player can resolve', async () => {
    const exported = await exportFreeCutProjectToHyperFramesDirectory({
      ...targetProject,
      id: 'source-project',
      name: 'Imported Motion',
      timeline: {
        ...targetProject.timeline!,
        items: [{ id: 'text', type: 'text', trackId: 'v1', from: 0, durationInFrames: 90, label: 'Text', text: 'Hello' }],
      },
    }, { now: 100 })
    const repository = new InMemoryHyperFramesProjectRepository()
    const imported = await importHyperFramesProjectDirectory({
      project: targetProject,
      directory: exported.directory,
      repository,
      importedAt: 200,
      timelineItemId: 'hf-timeline-item',
    })

    expect(imported.timelineItem).toMatchObject({
      id: 'hf-timeline-item', from: 45, type: 'composition', sourceKind: 'hyperframes',
      hyperframesProjectId: 'freecut-source-project', activeCompositionPath: 'compositions/main.html',
    })
    expect(imported.project.hyperframes?.compositionLinks['hf-timeline-item']).toEqual(
      imported.compositionLink,
    )
    expect(resolveHyperFramesStudioItem(imported.timelineItem)).not.toBeNull()

    const stored = await repository.readProjectDirectory('freecut-source-project')
    expect(stored).toBeDefined()
    const preview = await createHyperFramesCompilerAdapter().createPreviewHtml(stored!)
    expect(preview.ok).toBe(true)
    expect(preview.html).toContain('Hello')
  })

  it('rejects an incomplete directory before writing project state', async () => {
    const exported = await exportFreeCutProjectToHyperFramesDirectory(targetProject)
    exported.directory.files = exported.directory.files.filter(
      (file) => file.path !== exported.directory.manifest.activeCompositionPath,
    )
    const repository = new InMemoryHyperFramesProjectRepository()

    await expect(
      importHyperFramesProjectDirectory({ project: targetProject, directory: exported.directory, repository }),
    ).rejects.toThrow('active composition is missing')
    await expect(repository.listProjectRefs()).resolves.toEqual([])
  })
})
