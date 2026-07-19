import { DOMParser as LinkedomDOMParser } from 'linkedom'
import type {
  HyperFramesCompositionLink,
  HyperFramesDiagnostic,
  HyperFramesIntegrationState,
  HyperFramesModelUsageSummary,
  HyperFramesProjectDirectory,
  HyperFramesProjectManifest,
} from '@/types/hyperframes'
import type { Project, ProjectTimeline } from '@/types/project'
import { stableHyperFramesHash } from '../../adapters/freecut-project/project-signatures'
import type {
  HyperFramesProjectRepository,
  HyperFramesProjectWriteMeta,
} from '../../adapters/freecut-project/project-repository'
import type { HyperFramesGenerationImportStrategy } from './generationPlan'
import type { HyperFramesSkillImportPreview } from './skillOutputImportPreview'

type ProjectTimelineItem = ProjectTimeline['items'][number]
type ProjectTimelineTrack = ProjectTimeline['tracks'][number]

export type HyperFramesSkillImportChangeKind =
  | 'composition-link'
  | 'manifest'
  | 'media-library'
  | 'project-directory'
  | 'render-cache'
  | 'timeline-item'

export interface HyperFramesSkillImportChange {
  op: 'add' | 'remove' | 'replace'
  kind: HyperFramesSkillImportChangeKind
  path: string
}

export interface HyperFramesSkillImportConfirmation {
  previewId: string
  jobId: string
  confirmedAt: number
  confirmedByUser: true
  confirmedBy?: string
  changes: HyperFramesSkillImportChange[]
  rollbackId: string
}

export interface HyperFramesSkillImportRollbackJournal {
  id: string
  confirmation: HyperFramesSkillImportConfirmation
  freecutProjectId: string
  hyperframesProjectId: string
  directoryExistedBefore: boolean
  directorySnapshotId?: string
  projectBefore: Project
  createdAt: number
}

export interface HyperFramesRenderedMediaImport {
  type: 'audio' | 'video'
  src: string
  mediaId?: string
  label?: string
  thumbnailUrl?: string
  durationInFrames?: number
  sourceWidth?: number
  sourceHeight?: number
}

export interface ConfirmHyperFramesSkillImportOptions {
  project: Project
  preview: HyperFramesSkillImportPreview
  jobId: string
  repository: HyperFramesProjectRepository
  confirmedByUser: boolean
  confirmedAt?: number
  confirmedBy?: string
  targetTrackId?: string
  insertFrame?: number
  timelineItemId?: string
  compositionLinkId?: string
  renderedMedia?: HyperFramesRenderedMediaImport
}

export interface HyperFramesSkillImportConfirmationResult {
  project: Project
  confirmation: HyperFramesSkillImportConfirmation
  rollbackJournal: HyperFramesSkillImportRollbackJournal
  importedTimelineItemIds: string[]
}

export interface RollbackHyperFramesSkillImportOptions {
  project: Project
  repository: HyperFramesProjectRepository
  rollbackJournal: HyperFramesSkillImportRollbackJournal
  rolledBackAt?: number
}

export interface HyperFramesSkillImportRollbackResult {
  project: Project
  rollbackId: string
  rolledBackAt: number
  restoredDirectorySnapshotId?: string
}

export type HyperFramesSkillRepairActionType =
  | 'open-studio-repair'
  | 'same-model-repair'
  | 'switch-model-repair'

export interface HyperFramesSkillRepairAction {
  type: HyperFramesSkillRepairActionType
  label: string
  enabled: boolean
  reason: string
  jobId: string
  skillId: string
  outputDirectory: string
  diagnostics: HyperFramesDiagnostic[]
  modelProfileId?: string
  candidateModelProfileIds?: string[]
  hyperframesProjectId?: string
  activeCompositionPath?: string
  requiresModelSelection?: boolean
}

export interface CreateHyperFramesSkillRepairOptionsInput {
  jobId: string
  skillId: string
  outputDirectory: string
  diagnostics: HyperFramesDiagnostic[]
  currentModelProfileId?: string
  fallbackModelProfileIds?: string[]
  preview?: HyperFramesSkillImportPreview
}

export function createHyperFramesSkillRepairOptions(
  input: CreateHyperFramesSkillRepairOptionsInput,
): HyperFramesSkillRepairAction[] {
  const diagnostics = input.diagnostics.map((diagnostic) => ({ ...diagnostic }))
  const manifest = input.preview?.manifest

  return [
    {
      type: 'same-model-repair',
      label: 'Repair with the same model',
      enabled: true,
      reason: 'Use retained output, logs and diagnostics to ask the current model for a repair.',
      jobId: input.jobId,
      skillId: input.skillId,
      outputDirectory: input.outputDirectory,
      diagnostics,
      modelProfileId: input.currentModelProfileId,
    },
    {
      type: 'switch-model-repair',
      label: 'Repair with another model',
      enabled: true,
      reason: 'Route the repair through a different compatible model before retrying import.',
      jobId: input.jobId,
      skillId: input.skillId,
      outputDirectory: input.outputDirectory,
      diagnostics,
      candidateModelProfileIds: [...(input.fallbackModelProfileIds ?? [])],
      requiresModelSelection: (input.fallbackModelProfileIds ?? []).length === 0,
    },
    {
      type: 'open-studio-repair',
      label: 'Open Studio to repair manually',
      enabled: Boolean(input.preview?.projectDirectory && manifest),
      reason: manifest
        ? 'Open the generated project directory in the Studio surface without confirming import.'
        : 'A project directory is required before Studio repair can open.',
      jobId: input.jobId,
      skillId: input.skillId,
      outputDirectory: input.outputDirectory,
      diagnostics,
      hyperframesProjectId: manifest?.id,
      activeCompositionPath: manifest?.activeCompositionPath,
    },
  ]
}

export async function confirmHyperFramesSkillImport(
  options: ConfirmHyperFramesSkillImportOptions,
): Promise<HyperFramesSkillImportConfirmationResult> {
  if (!options.confirmedByUser) {
    throw new Error('HyperFrames skill import requires explicit user confirmation.')
  }
  if (!options.preview.canConfirmImport || options.preview.blockingDiagnostics.length > 0) {
    throw new Error('HyperFrames skill import preview is not confirmable.')
  }
  if (!options.preview.projectDirectory || !options.preview.manifest) {
    throw new Error('HyperFrames skill import preview is missing a project directory.')
  }

  const confirmedAt = options.confirmedAt ?? Date.now()
  const directory = cloneDirectory(options.preview.projectDirectory)
  const manifest = createConfirmedManifest({
    manifest: directory.manifest,
    freecutProjectId: options.project.id,
    confirmedAt,
  })
  directory.manifest = manifest

  const projectBefore = cloneProject(options.project)
  const existingDirectory = await options.repository.readProjectDirectory(manifest.id)
  const directorySnapshot = existingDirectory
    ? await options.repository.createSnapshot(
        manifest.id,
        `before-skill-import:${options.preview.id}`,
      )
    : undefined

  const writeMeta: HyperFramesProjectWriteMeta = {
    reason: 'skill-import-confirmed',
    provenance: {
      freecutProjectId: options.project.id,
      confirmedByUser: true,
      source: 'skill-output',
    },
  }

  try {
    await writeDirectory(options.repository, directory, writeMeta)
  } catch (error) {
    if (directorySnapshot) {
      await options.repository.restoreSnapshot(manifest.id, directorySnapshot.id)
    } else {
      await options.repository.deleteProject(manifest.id)
    }
    throw error
  }

  const storedManifest = (await options.repository.readManifest(manifest.id)) ?? manifest
  const imported = applyConfirmedImportToProject({
    project: projectBefore,
    manifest: storedManifest,
    preview: options.preview,
    confirmedAt,
    targetTrackId: options.targetTrackId,
    insertFrame: options.insertFrame,
    timelineItemId: options.timelineItemId,
    compositionLinkId: options.compositionLinkId,
    renderedMedia: options.renderedMedia,
  })
  const rollbackId = `hf-import-rollback-${stableHyperFramesHash({
    previewId: options.preview.id,
    jobId: options.jobId,
    confirmedAt,
  }).slice(0, 16)}`
  const confirmation: HyperFramesSkillImportConfirmation = {
    previewId: options.preview.id,
    jobId: options.jobId,
    confirmedAt,
    confirmedByUser: true,
    confirmedBy: options.confirmedBy,
    changes: createImportChanges({
      manifest: storedManifest,
      timelineItemIds: imported.importedTimelineItemIds,
      linkId: imported.linkId,
      directoryExistedBefore: Boolean(existingDirectory),
      strategy: options.preview.selectedImportStrategy,
    }),
    rollbackId,
  }

  return {
    project: imported.project,
    confirmation,
    rollbackJournal: {
      id: rollbackId,
      confirmation,
      freecutProjectId: options.project.id,
      hyperframesProjectId: storedManifest.id,
      directoryExistedBefore: Boolean(existingDirectory),
      directorySnapshotId: directorySnapshot?.id,
      projectBefore,
      createdAt: confirmedAt,
    },
    importedTimelineItemIds: imported.importedTimelineItemIds,
  }
}

export async function rollbackHyperFramesSkillImport(
  options: RollbackHyperFramesSkillImportOptions,
): Promise<HyperFramesSkillImportRollbackResult> {
  const { rollbackJournal } = options
  if (rollbackJournal.directoryExistedBefore) {
    if (!rollbackJournal.directorySnapshotId) {
      throw new Error('HyperFrames import rollback is missing the directory snapshot id.')
    }
    await options.repository.restoreSnapshot(
      rollbackJournal.hyperframesProjectId,
      rollbackJournal.directorySnapshotId,
    )
  } else {
    await options.repository.deleteProject(rollbackJournal.hyperframesProjectId)
  }

  return {
    project: cloneProject(rollbackJournal.projectBefore),
    rollbackId: rollbackJournal.id,
    rolledBackAt: options.rolledBackAt ?? Date.now(),
    restoredDirectorySnapshotId: rollbackJournal.directorySnapshotId,
  }
}

async function writeDirectory(
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

function createConfirmedManifest(input: {
  manifest: HyperFramesProjectManifest
  freecutProjectId: string
  confirmedAt: number
}): HyperFramesProjectManifest {
  return {
    ...cloneManifest(input.manifest),
    provenance: {
      ...input.manifest.provenance,
      freecutProjectId: input.freecutProjectId,
      confirmedByUser: true,
      updatedAt: input.confirmedAt,
    },
    lastModelMutation: input.manifest.provenance.modelUsage
      ? {
          mutatedAt: input.confirmedAt,
          modelProfileId: input.manifest.provenance.modelUsage.modelProfileId,
          promptSummary: input.manifest.provenance.promptSummary,
          confirmedByUser: true,
        }
      : input.manifest.lastModelMutation,
  }
}

function applyConfirmedImportToProject(input: {
  project: Project
  manifest: HyperFramesProjectManifest
  preview: HyperFramesSkillImportPreview
  confirmedAt: number
  targetTrackId?: string
  insertFrame?: number
  timelineItemId?: string
  compositionLinkId?: string
  renderedMedia?: HyperFramesRenderedMediaImport
}): { project: Project; importedTimelineItemIds: string[]; linkId: string } {
  const project = cloneProject(input.project)
  const timeline = ensureTimeline(project)
  const state = ensureHyperFramesState(project)
  const targetTrackId = resolveTargetTrackId(timeline, input.targetTrackId)
  const startFrame = input.insertFrame ?? timeline.currentFrame ?? 0
  const itemId =
    input.timelineItemId ??
    `hf-${input.manifest.id}-${stableHyperFramesHash({
      previewId: input.preview.id,
      confirmedAt: input.confirmedAt,
    }).slice(0, 8)}`
  const linkId = input.compositionLinkId ?? `hf-link-${itemId}`
  const strategy = input.preview.selectedImportStrategy
  const importedItems =
    strategy === 'rendered-media'
      ? [
          createRenderedMediaItem({
            itemId,
            manifest: input.manifest,
            trackId: targetTrackId,
            startFrame,
            renderedMedia: input.renderedMedia,
          }),
        ]
      : [
          createSourceLinkedCompositionItem({
            itemId,
            manifest: input.manifest,
            trackId: targetTrackId,
            startFrame,
          }),
          ...createApproximationItems({
            manifest: input.manifest,
            preview: input.preview,
            trackId: targetTrackId,
            startFrame,
            parentItemId: itemId,
            enabled: strategy === 'source-link-with-approximations',
          }),
        ]

  state.projects[input.manifest.id] = cloneManifest(input.manifest)
  state.compositionLinks[linkId] = createCompositionLink({
    id: linkId,
    timelineItemId: itemId,
    manifest: input.manifest,
    createdAt: input.confirmedAt,
    strategy,
  })
  timeline.items = [
    ...timeline.items.filter((item) => !importedItems.some((imported) => imported.id === item.id)),
    ...importedItems,
  ]
  project.updatedAt = Math.max(project.updatedAt, input.confirmedAt)

  return {
    project,
    importedTimelineItemIds: importedItems.map((item) => item.id),
    linkId,
  }
}

function createSourceLinkedCompositionItem(input: {
  itemId: string
  manifest: HyperFramesProjectManifest
  trackId: string
  startFrame: number
}): ProjectTimelineItem {
  return {
    id: input.itemId,
    trackId: input.trackId,
    from: input.startFrame,
    durationInFrames: input.manifest.canvas.durationInFrames,
    label: input.manifest.title,
    type: 'composition',
    compositionId: input.manifest.id,
    sourceKind: 'hyperframes',
    hyperframesProjectId: input.manifest.id,
    activeCompositionPath: input.manifest.activeCompositionPath,
    hyperframesManifestPath: 'manifest.json',
    compositionWidth: input.manifest.canvas.width,
    compositionHeight: input.manifest.canvas.height,
  }
}

function createRenderedMediaItem(input: {
  itemId: string
  manifest: HyperFramesProjectManifest
  trackId: string
  startFrame: number
  renderedMedia?: HyperFramesRenderedMediaImport
}): ProjectTimelineItem {
  if (!input.renderedMedia) {
    throw new Error('Rendered media import requires rendered media output.')
  }
  return {
    id: input.itemId,
    trackId: input.trackId,
    from: input.startFrame,
    durationInFrames:
      input.renderedMedia.durationInFrames ?? input.manifest.canvas.durationInFrames,
    label: input.renderedMedia.label ?? input.manifest.title,
    type: input.renderedMedia.type,
    src: input.renderedMedia.src,
    mediaId: input.renderedMedia.mediaId,
    thumbnailUrl: input.renderedMedia.thumbnailUrl,
    sourceWidth: input.renderedMedia.sourceWidth ?? input.manifest.canvas.width,
    sourceHeight: input.renderedMedia.sourceHeight ?? input.manifest.canvas.height,
  }
}

function createApproximationItems(input: {
  manifest: HyperFramesProjectManifest
  preview: HyperFramesSkillImportPreview
  trackId: string
  startFrame: number
  parentItemId: string
  enabled: boolean
}): ProjectTimelineItem[] {
  if (!input.enabled || !input.preview.projectDirectory) return []
  const html = input.preview.projectDirectory.files.find(
    (file) => file.path === input.manifest.activeCompositionPath,
  )?.content
  if (!html) return []

  const parser = new LinkedomDOMParser()
  const document = parser.parseFromString(html, 'text/html')
  const elements = [...document.querySelectorAll('[data-hf-item]')]
  const fps = input.manifest.canvas.fps

  return elements
    .map((element, index) =>
      createApproximationItem({
        element,
        index,
        manifest: input.manifest,
        trackId: input.trackId,
        startFrame: input.startFrame,
        parentItemId: input.parentItemId,
        fps,
      }),
    )
    .filter((item): item is ProjectTimelineItem => item !== null)
}

function createApproximationItem(input: {
  element: Element
  index: number
  manifest: HyperFramesProjectManifest
  trackId: string
  startFrame: number
  parentItemId: string
  fps: number
}): ProjectTimelineItem | null {
  const kind = input.element.getAttribute('data-hf-item') ?? 'text'
  const id = `${input.parentItemId}-native-${input.index + 1}`
  const from =
    input.startFrame + secondsAttributeToFrames(input.element.getAttribute('data-start'), input.fps)
  const durationInFrames =
    secondsAttributeToFrames(input.element.getAttribute('data-duration'), input.fps) ||
    input.manifest.canvas.durationInFrames
  const label =
    input.element.getAttribute('aria-label') ?? input.element.textContent?.trim() ?? kind
  const base = {
    id,
    trackId: input.trackId,
    from,
    durationInFrames,
    label: label.slice(0, 80) || `HyperFrames ${kind}`,
    linkedGroupId: input.parentItemId,
    originId: input.parentItemId,
  }

  if (kind === 'text') {
    return {
      ...base,
      type: 'text',
      text: input.element.textContent?.trim() ?? '',
      color: input.element.getAttribute('data-color') ?? '#ffffff',
    }
  }

  if (kind === 'video' || kind === 'audio' || kind === 'image') {
    const src = sourceFromElement(input.element, kind)
    if (!src) return null
    return {
      ...base,
      type: kind,
      src,
    }
  }

  if (kind === 'shape') {
    return {
      ...base,
      type: 'shape',
      shapeType: 'rectangle',
      fillColor: input.element.getAttribute('data-fill') ?? '#ffffff',
    }
  }

  return null
}

function sourceFromElement(element: Element, kind: 'audio' | 'image' | 'video'): string | null {
  const direct = element.getAttribute('src')
  if (direct) return direct
  const selector = kind === 'image' ? 'img' : `${kind},source`
  return element.querySelector(selector)?.getAttribute('src') ?? null
}

function secondsAttributeToFrames(value: string | null, fps: number): number {
  if (!value) return 0
  const seconds = Number(value)
  return Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds * fps) : 0
}

function createCompositionLink(input: {
  id: string
  timelineItemId: string
  manifest: HyperFramesProjectManifest
  createdAt: number
  strategy: HyperFramesGenerationImportStrategy
}): HyperFramesCompositionLink {
  return {
    id: input.id,
    timelineItemId: input.timelineItemId,
    hyperframesProjectId: input.manifest.id,
    manifestPath: 'manifest.json',
    activeCompositionPath: input.manifest.activeCompositionPath,
    createdAt: input.createdAt,
    importStrategy: mapCompositionLinkStrategy(input.strategy),
  }
}

function createImportChanges(input: {
  manifest: HyperFramesProjectManifest
  timelineItemIds: string[]
  linkId: string
  directoryExistedBefore: boolean
  strategy: HyperFramesGenerationImportStrategy
}): HyperFramesSkillImportChange[] {
  const directoryOp = input.directoryExistedBefore ? 'replace' : 'add'
  return [
    {
      op: directoryOp,
      kind: 'project-directory',
      path: `hyperframes/${input.manifest.id}`,
    },
    {
      op: directoryOp,
      kind: 'manifest',
      path: `project.hyperframes.projects.${input.manifest.id}`,
    },
    {
      op: 'add',
      kind: 'composition-link',
      path: `project.hyperframes.compositionLinks.${input.linkId}`,
    },
    ...input.timelineItemIds.map(
      (itemId): HyperFramesSkillImportChange => ({
        op: 'add',
        kind: 'timeline-item',
        path: `project.timeline.items.${itemId}`,
      }),
    ),
    ...(input.strategy === 'rendered-media'
      ? [
          {
            op: 'add' as const,
            kind: 'media-library' as const,
            path: `media-library.rendered.${input.manifest.id}`,
          },
        ]
      : []),
  ]
}

function mapCompositionLinkStrategy(
  strategy: HyperFramesGenerationImportStrategy,
): HyperFramesCompositionLink['importStrategy'] {
  if (strategy === 'source-link-with-approximations') return 'source-linked-with-approximations'
  if (strategy === 'rendered-media') return 'rendered-media'
  return 'source-linked'
}

function ensureTimeline(project: Project): ProjectTimeline {
  if (!project.timeline) {
    project.timeline = {
      tracks: [createDefaultTrack()],
      items: [],
    }
  }
  if (project.timeline.tracks.length === 0) {
    project.timeline.tracks = [createDefaultTrack()]
  }
  return project.timeline
}

function createDefaultTrack(): ProjectTimelineTrack {
  return {
    id: 'track-hyperframes',
    name: 'HyperFrames',
    kind: 'video',
    height: 80,
    locked: false,
    visible: true,
    muted: false,
    solo: false,
    order: 0,
  }
}

function resolveTargetTrackId(
  timeline: ProjectTimeline,
  preferredTrackId: string | undefined,
): string {
  if (preferredTrackId && timeline.tracks.some((track) => track.id === preferredTrackId)) {
    return preferredTrackId
  }
  return (
    timeline.tracks.find((track) => track.kind === 'video' && !track.locked)?.id ??
    timeline.tracks.find((track) => !track.locked)?.id ??
    timeline.tracks[0]!.id
  )
}

function ensureHyperFramesState(project: Project): HyperFramesIntegrationState {
  project.hyperframes = cloneHyperFramesState(project.hyperframes) ?? createEmptyHyperFramesState()
  return project.hyperframes
}

function createEmptyHyperFramesState(): HyperFramesIntegrationState {
  return {
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
}

function cloneProject(project: Project): Project {
  return {
    ...project,
    metadata: { ...project.metadata },
    timeline: project.timeline
      ? {
          ...project.timeline,
          tracks: project.timeline.tracks.map((track) => ({ ...track })),
          items: project.timeline.items.map((item) => structuredClone(item)),
          markers: project.timeline.markers
            ? project.timeline.markers.map((marker) => ({ ...marker }))
            : undefined,
          transitions: project.timeline.transitions
            ? project.timeline.transitions.map((transition) => structuredClone(transition))
            : undefined,
          compositions: project.timeline.compositions
            ? project.timeline.compositions.map((composition) => structuredClone(composition))
            : undefined,
          keyframes: project.timeline.keyframes
            ? project.timeline.keyframes.map((keyframe) => structuredClone(keyframe))
            : undefined,
        }
      : undefined,
    hyperframes: cloneHyperFramesState(project.hyperframes),
  }
}

function cloneHyperFramesState(
  state: HyperFramesIntegrationState | undefined,
): HyperFramesIntegrationState | undefined {
  return state ? structuredClone(state) : undefined
}

function cloneDirectory(directory: HyperFramesProjectDirectory): HyperFramesProjectDirectory {
  return {
    manifest: cloneManifest(directory.manifest),
    files: directory.files.map((file) => ({ ...file })),
    assets: directory.assets.map((asset) => ({
      ...asset,
      bytes: new Uint8Array(asset.bytes),
    })),
  }
}

function cloneManifest(manifest: HyperFramesProjectManifest): HyperFramesProjectManifest {
  return structuredClone(manifest)
}

export type { HyperFramesModelUsageSummary }
