import type { Project, ProjectTimeline } from '@/types/project'
import type {
  HyperFramesCompositionLink,
  HyperFramesIntegrationState,
  HyperFramesProjectDirectory,
  HyperFramesProjectManifest,
} from '@/types/hyperframes'
import { stableHyperFramesHash } from '../../adapters/freecut-project/project-signatures'
import type {
  HyperFramesProjectRepository,
  HyperFramesProjectSnapshot,
  HyperFramesProjectWriteMeta,
} from '../../adapters/freecut-project/project-repository'
import type { FreeCutStudioTimelineItem } from '../studio-bridge/types'

export interface HyperFramesProjectImportOptions {
  project: Project
  directory: HyperFramesProjectDirectory
  repository: HyperFramesProjectRepository
  targetTrackId?: string
  insertFrame?: number
  timelineItemId?: string
  importedAt?: number
  confirmedByUser?: boolean
}

export interface HyperFramesProjectImportResult {
  project: Project
  timelineItem: FreeCutStudioTimelineItem
  compositionLink: HyperFramesCompositionLink
  replacedDirectorySnapshot?: HyperFramesProjectSnapshot
}

export async function importHyperFramesProjectDirectory(
  options: HyperFramesProjectImportOptions,
): Promise<HyperFramesProjectImportResult> {
  assertImportableDirectory(options.directory)
  const importedAt = options.importedAt ?? Date.now()
  const project = cloneProject(options.project)
  const timeline = ensureTimeline(project)
  const state = ensureHyperFramesState(project)
  const manifest = createImportedManifest(
    options.directory.manifest,
    project.id,
    importedAt,
    options.confirmedByUser ?? true,
  )
  const directory = cloneDirectory(options.directory)
  directory.manifest = manifest
  const repository = options.repository
  const existing = await repository.readProjectDirectory(manifest.id)
  const replacedDirectorySnapshot = existing
    ? await repository.createSnapshot(manifest.id, 'before-project-directory-import')
    : undefined
  const writeMeta: HyperFramesProjectWriteMeta = {
    reason: 'project-directory-import',
    provenance: {
      source: manifest.provenance.source,
      freecutProjectId: project.id,
      confirmedByUser: manifest.provenance.confirmedByUser,
    },
  }

  try {
    await writeProjectDirectory(repository, directory, writeMeta)
  } catch (error) {
    if (replacedDirectorySnapshot) {
      await repository.restoreSnapshot(manifest.id, replacedDirectorySnapshot.id)
    } else {
      await repository.deleteProject(manifest.id)
    }
    throw error
  }

  const storedManifest = (await repository.readManifest(manifest.id)) ?? manifest
  const trackId = resolveTargetTrackId(timeline, options.targetTrackId)
  const timelineItemId =
    options.timelineItemId ??
    `hf-${manifest.id}-${stableHyperFramesHash({
      freecutProjectId: project.id,
      importedAt,
    }).slice(0, 8)}`
  const timelineItem = createSourceLinkedItem(
    timelineItemId,
    trackId,
    options.insertFrame ?? timeline.currentFrame ?? 0,
    storedManifest,
  )
  const compositionLink: HyperFramesCompositionLink = {
    id: `hf-link-${timelineItemId}`,
    timelineItemId,
    hyperframesProjectId: storedManifest.id,
    manifestPath: `hyperframes/${storedManifest.id}/manifest.json`,
    activeCompositionPath: storedManifest.activeCompositionPath,
    createdAt: importedAt,
    importStrategy: 'source-linked',
  }

  timeline.items = [...timeline.items.filter((item) => item.id !== timelineItemId), timelineItem]
  state.projects[storedManifest.id] = cloneManifest(storedManifest)
  state.compositionLinks[timelineItemId] = compositionLink
  project.updatedAt = Math.max(project.updatedAt, importedAt)

  return { project, timelineItem, compositionLink, replacedDirectorySnapshot }
}

function assertImportableDirectory(directory: HyperFramesProjectDirectory): void {
  const files = new Set(directory.files.map((file) => file.path))
  if (!files.has(directory.manifest.entryFile)) {
    throw new Error(`HyperFrames entry file is missing: ${directory.manifest.entryFile}`)
  }
  if (!files.has(directory.manifest.activeCompositionPath)) {
    throw new Error(
      `HyperFrames active composition is missing: ${directory.manifest.activeCompositionPath}`,
    )
  }
}

async function writeProjectDirectory(
  repository: HyperFramesProjectRepository,
  directory: HyperFramesProjectDirectory,
  meta: HyperFramesProjectWriteMeta,
): Promise<void> {
  await repository.writeManifest(directory.manifest.id, directory.manifest, meta)
  for (const file of directory.files) {
    await repository.writeFile(directory.manifest.id, file.path, file.content, meta)
  }
  for (const asset of directory.assets) {
    await repository.copyAsset(directory.manifest.id, asset, meta)
  }
}

function createImportedManifest(
  manifest: HyperFramesProjectManifest,
  freecutProjectId: string,
  importedAt: number,
  confirmedByUser: boolean,
): HyperFramesProjectManifest {
  return {
    ...cloneManifest(manifest),
    provenance: {
      ...manifest.provenance,
      freecutProjectId,
      updatedAt: importedAt,
      confirmedByUser,
    },
  }
}

function createSourceLinkedItem(
  id: string,
  trackId: string,
  from: number,
  manifest: HyperFramesProjectManifest,
): FreeCutStudioTimelineItem {
  return {
    id,
    trackId,
    from,
    durationInFrames: manifest.canvas.durationInFrames,
    label: manifest.title,
    type: 'composition',
    compositionId: manifest.id,
    sourceKind: 'hyperframes',
    hyperframesProjectId: manifest.id,
    activeCompositionPath: manifest.activeCompositionPath,
    hyperframesManifestPath: `hyperframes/${manifest.id}/manifest.json`,
    compositionWidth: manifest.canvas.width,
    compositionHeight: manifest.canvas.height,
  }
}

function ensureTimeline(project: Project): ProjectTimeline {
  if (!project.timeline) project.timeline = { tracks: [], items: [] }
  if (project.timeline.tracks.length === 0) {
    project.timeline.tracks.push({
      id: 'track-hyperframes',
      name: 'HyperFrames',
      kind: 'video',
      height: 80,
      locked: false,
      visible: true,
      muted: false,
      solo: false,
      order: 0,
    })
  }
  return project.timeline
}

function resolveTargetTrackId(timeline: ProjectTimeline, preferred?: string): string {
  if (preferred && timeline.tracks.some((track) => track.id === preferred)) return preferred
  return (
    timeline.tracks.find((track) => track.kind === 'video' && !track.locked)?.id ??
    timeline.tracks.find((track) => !track.locked)?.id ??
    timeline.tracks[0]!.id
  )
}

function ensureHyperFramesState(project: Project): HyperFramesIntegrationState {
  project.hyperframes ??= {
    schemaVersion: 1,
    projects: {},
    compositionLinks: {},
    renderCache: {},
    skills: {},
    modelProfiles: {},
    modelCapabilityBindings: {},
    toolPolicies: {},
    renderConfig: {
      defaultEngine: 'hybrid-overlay',
      preferAlphaOverlay: true,
      cacheEnabled: true,
    },
  }
  return project.hyperframes
}

function cloneProject(project: Project): Project {
  return structuredClone(project)
}

function cloneManifest(manifest: HyperFramesProjectManifest): HyperFramesProjectManifest {
  return structuredClone(manifest)
}

function cloneDirectory(directory: HyperFramesProjectDirectory): HyperFramesProjectDirectory {
  return {
    manifest: cloneManifest(directory.manifest),
    files: directory.files.map((file) => ({ ...file })),
    assets: directory.assets.map((asset) => ({ ...asset, bytes: asset.bytes.slice() })),
  }
}
