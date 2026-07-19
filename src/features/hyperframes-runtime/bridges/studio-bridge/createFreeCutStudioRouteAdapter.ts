import { normalizeHyperFramesProjectPath } from '@/features/hyperframes-runtime/adapters/freecut-project/project-path-guards'
import type { HyperFramesProjectDirectory } from '@/types/hyperframes'
import { normalizeStudioSelection, type FreeCutStudioSelection } from './StudioSelectionMapper'
import type {
  FreeCutStudioAdapter,
  FreeCutStudioFileRef,
  FreeCutStudioProjectRef,
  FreeCutStudioRegistryBlock,
  FreeCutStudioRenderJob,
  FreeCutStudioRenderOptions,
  FreeCutStudioRenderPreviewResult,
  FreeCutStudioThumbnail,
  FreeCutStudioThumbnailOptions,
  FreeCutStudioWaveform,
  FreeCutStudioWaveformOptions,
} from './createFreeCutStudioAdapter'

export interface FreeCutStudioProjectRouteBody {
  id: string
  title: string
  activeCompositionPath: string
  files: FreeCutStudioFileRef[]
  compositions: string[]
  manifest: HyperFramesProjectDirectory['manifest']
}

export type FreeCutStudioRouteResult<T> =
  | { ok: true; status: 200 | 201 | 202; body: T }
  | { ok: false; status: 400 | 403 | 404 | 501; body: { error: string } }

export interface FreeCutStudioRouteAdapter {
  projects: {
    list(): Promise<FreeCutStudioRouteResult<{ projects: FreeCutStudioProjectRef[] }>>
    resolve(projectId: string): Promise<FreeCutStudioRouteResult<FreeCutStudioProjectRouteBody>>
  }
  files: {
    list(projectId: string): Promise<FreeCutStudioRouteResult<{ files: FreeCutStudioFileRef[] }>>
    read(
      projectId: string,
      path: string,
    ): Promise<FreeCutStudioRouteResult<{ path: string; content: string }>>
    write(
      projectId: string,
      path: string,
      content: string,
      options?: { reason?: string },
    ): Promise<FreeCutStudioRouteResult<{ path: string; hash: string }>>
  }
  preview: {
    get(
      projectId: string,
      compositionPath?: string,
    ): Promise<FreeCutStudioRouteResult<{ previewUrl: string }>>
  }
  lint: {
    run(
      projectId: string,
      compositionPath?: string,
    ): Promise<FreeCutStudioRouteResult<Awaited<ReturnType<FreeCutStudioAdapter['lint']>>>>
  }
  thumbnail: {
    generate(
      projectId: string,
      options?: FreeCutStudioThumbnailOptions,
    ): Promise<FreeCutStudioRouteResult<FreeCutStudioThumbnail>>
  }
  selection: {
    get(
      projectId: string,
    ): Promise<FreeCutStudioRouteResult<{ selection: FreeCutStudioSelection | null }>>
    update(
      projectId: string,
      selection: FreeCutStudioSelection | null,
    ): Promise<FreeCutStudioRouteResult<{ selection: FreeCutStudioSelection | null }>>
  }
  render: {
    preview(
      projectId: string,
      compositionPath?: string,
    ): Promise<FreeCutStudioRouteResult<FreeCutStudioRenderPreviewResult>>
    start(
      projectId: string,
      options?: FreeCutStudioRenderOptions,
    ): Promise<FreeCutStudioRouteResult<FreeCutStudioRenderJob>>
  }
  waveform: {
    get(
      projectId: string,
      assetPath: string,
      options?: FreeCutStudioWaveformOptions,
    ): Promise<FreeCutStudioRouteResult<FreeCutStudioWaveform>>
  }
  registry: {
    list(): Promise<FreeCutStudioRouteResult<{ blocks: FreeCutStudioRegistryBlock[] }>>
    install(
      projectId: string,
      blockId: string,
    ): Promise<FreeCutStudioRouteResult<{ blockId: string }>>
  }
}

function ok<T>(body: T, status: 200 | 201 | 202 = 200): FreeCutStudioRouteResult<T> {
  return { ok: true, status, body }
}

function routeError(status: 400 | 403 | 404 | 501, error: string): FreeCutStudioRouteResult<never> {
  return { ok: false, status, body: { error } }
}

function normalizeRoutePath(path: string): FreeCutStudioRouteResult<string> {
  try {
    return ok(normalizeHyperFramesProjectPath(decodeURIComponent(path)).path)
  } catch {
    return routeError(403, 'forbidden')
  }
}

function compositionFiles(directory: HyperFramesProjectDirectory): string[] {
  return directory.files
    .filter((file) => file.path.endsWith('.html') && /data-composition-id\s*=/.test(file.content))
    .map((file) => file.path)
    .sort((left, right) => left.localeCompare(right))
}

function projectBody(
  directory: HyperFramesProjectDirectory,
  files: FreeCutStudioFileRef[],
): FreeCutStudioProjectRouteBody {
  return {
    id: directory.manifest.id,
    title: directory.manifest.title,
    activeCompositionPath: directory.manifest.activeCompositionPath,
    files,
    compositions: compositionFiles(directory),
    manifest: directory.manifest,
  }
}

function routeStatusForError(error: unknown): FreeCutStudioRouteResult<never> {
  if (error instanceof Error && /not found/i.test(error.message)) {
    return routeError(404, error.message)
  }
  return routeError(400, error instanceof Error ? error.message : String(error))
}

export function createFreeCutStudioRouteAdapter(
  adapter: FreeCutStudioAdapter,
): FreeCutStudioRouteAdapter {
  async function resolveProject(
    projectId: string,
  ): Promise<FreeCutStudioRouteResult<HyperFramesProjectDirectory>> {
    try {
      const directory = await adapter.resolveProject(projectId)
      return directory ? ok(directory) : routeError(404, 'project not found')
    } catch {
      return routeError(403, 'forbidden')
    }
  }

  async function activeCompositionPath(
    projectId: string,
    compositionPath?: string,
  ): Promise<FreeCutStudioRouteResult<string>> {
    const directoryResult = await resolveProject(projectId)
    if (!directoryResult.ok) return directoryResult
    if (!compositionPath) return ok(directoryResult.body.manifest.activeCompositionPath)
    return normalizeRoutePath(compositionPath)
  }

  return {
    projects: {
      async list() {
        return ok({ projects: await adapter.listProjects() })
      },

      async resolve(projectId) {
        const directoryResult = await resolveProject(projectId)
        if (!directoryResult.ok) return directoryResult
        const files = await adapter.listFiles(projectId)
        return ok(projectBody(directoryResult.body, files))
      },
    },

    files: {
      async list(projectId) {
        const directoryResult = await resolveProject(projectId)
        if (!directoryResult.ok) return directoryResult
        return ok({ files: await adapter.listFiles(projectId) })
      },

      async read(projectId, path) {
        const directoryResult = await resolveProject(projectId)
        if (!directoryResult.ok) return directoryResult
        const pathResult = normalizeRoutePath(path)
        if (!pathResult.ok) return pathResult
        const content = await adapter.readFile(projectId, pathResult.body)
        if (content === undefined) return routeError(404, 'file not found')
        return ok({ path: pathResult.body, content })
      },

      async write(projectId, path, content, options = {}) {
        const directoryResult = await resolveProject(projectId)
        if (!directoryResult.ok) return directoryResult
        const pathResult = normalizeRoutePath(path)
        if (!pathResult.ok) return pathResult
        try {
          const result = await adapter.writeFile(projectId, pathResult.body, content, {
            reason: options.reason ?? 'studio-route-write',
            provenance: { source: 'studio-edit' },
          })
          return ok({ path: pathResult.body, hash: result.hash })
        } catch (error) {
          return routeStatusForError(error)
        }
      },
    },

    preview: {
      async get(projectId, compositionPath) {
        const pathResult = await activeCompositionPath(projectId, compositionPath)
        if (!pathResult.ok) return pathResult
        try {
          return ok({ previewUrl: await adapter.previewUrl(projectId, pathResult.body) })
        } catch (error) {
          return routeStatusForError(error)
        }
      },
    },

    lint: {
      async run(projectId, compositionPath) {
        const pathResult = await activeCompositionPath(projectId, compositionPath)
        if (!pathResult.ok) return pathResult
        try {
          return ok(await adapter.lint(projectId, pathResult.body))
        } catch (error) {
          return routeStatusForError(error)
        }
      },
    },

    thumbnail: {
      async generate(projectId, options = {}) {
        const pathResult = await activeCompositionPath(projectId, options.compositionPath)
        if (!pathResult.ok) return pathResult
        return ok(
          await adapter.generateThumbnail(projectId, {
            ...options,
            compositionPath: pathResult.body,
          }),
        )
      },
    },

    selection: {
      async get(projectId) {
        const directoryResult = await resolveProject(projectId)
        if (!directoryResult.ok) return directoryResult
        return ok({ selection: await adapter.getSelection(projectId) })
      },

      async update(projectId, selection) {
        const directoryResult = await resolveProject(projectId)
        if (!directoryResult.ok) return directoryResult
        const normalized = normalizeStudioSelection(selection)
        await adapter.updateSelection(projectId, normalized)
        return ok({ selection: normalized })
      },
    },

    render: {
      async preview(projectId, compositionPath) {
        const pathResult = await activeCompositionPath(projectId, compositionPath)
        if (!pathResult.ok) return pathResult
        try {
          return ok(await adapter.renderPreview(projectId, { compositionPath: pathResult.body }))
        } catch (error) {
          return routeStatusForError(error)
        }
      },

      async start(projectId, options = {}) {
        const pathResult = await activeCompositionPath(projectId, options.compositionPath)
        if (!pathResult.ok) return pathResult
        try {
          const job = await adapter.startRender(projectId, {
            ...options,
            compositionPath: pathResult.body,
          })
          return ok(job, 202)
        } catch (error) {
          return routeStatusForError(error)
        }
      },
    },

    waveform: {
      async get(projectId, assetPath, options) {
        const directoryResult = await resolveProject(projectId)
        if (!directoryResult.ok) return directoryResult
        const pathResult = normalizeRoutePath(assetPath)
        if (!pathResult.ok) return pathResult
        try {
          return ok(await adapter.generateWaveform(projectId, pathResult.body, options))
        } catch (error) {
          return routeStatusForError(error)
        }
      },
    },

    registry: {
      async list() {
        return ok({ blocks: await adapter.listRegistryBlocks() })
      },

      async install(projectId, blockId) {
        const directoryResult = await resolveProject(projectId)
        if (!directoryResult.ok) return directoryResult
        void blockId
        return routeError(501, 'registry install not configured')
      },
    },
  }
}
