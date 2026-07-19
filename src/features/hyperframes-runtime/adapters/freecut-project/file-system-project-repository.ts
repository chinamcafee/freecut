import type {
  HyperFramesBinaryAsset,
  HyperFramesProjectDirectory,
  HyperFramesProjectFile,
  HyperFramesProjectManifest,
} from '@/types/hyperframes'
import {
  exists,
  listDirectory,
  readBlob,
  readJson,
  removeEntry,
  writeBlob,
  writeJsonAtomic,
} from '@/infrastructure/storage/workspace-fs/fs-primitives'
import { PROJECTS_DIR } from '@/infrastructure/storage/workspace-fs/paths'
import { requireWorkspaceRoot } from '@/infrastructure/storage/workspace-fs/root'
import type {
  HyperFramesProjectRef,
  HyperFramesProjectRepository,
  HyperFramesProjectSnapshot,
  HyperFramesProjectWriteMeta,
} from './project-repository'
import {
  assertHyperFramesManifestPaths,
  assertHyperFramesProjectId,
  assertWritableFileType,
  normalizeHyperFramesProjectPath,
} from './project-path-guards'
import {
  computeHyperFramesProjectDirectorySignature,
  hashHyperFramesBytes,
  hashHyperFramesText,
  reconcileHyperFramesPreviewSignature,
} from './project-signatures'

const HYPERFRAMES_DIR = 'hyperframes'
const MANIFEST_FILENAME = 'manifest.json'
const METADATA_DIR = '.freecut-hyperframes'
const DIRECTORY_INDEX_FILENAME = 'directory-index.json'
const SNAPSHOTS_DIR = 'snapshots'

interface FileSystemHyperFramesProjectRepositoryOptions {
  freecutProjectId?: string
}

interface DirectoryIndexFileRef {
  path: string
  hash?: string
}

interface DirectoryIndexAssetRef {
  path: string
  mimeType?: string
  hash?: string
}

interface DirectoryIndexSnapshotRef {
  id: string
  createdAt: number
  reason: string
}

interface DirectoryIndex {
  schemaVersion: 1
  files: DirectoryIndexFileRef[]
  assets: DirectoryIndexAssetRef[]
  snapshots: DirectoryIndexSnapshotRef[]
}

interface SerializedBinaryAsset extends Omit<HyperFramesBinaryAsset, 'bytes'> {
  bytes: number[]
}

interface SerializedSnapshot extends Omit<HyperFramesProjectSnapshot, 'assets'> {
  assets: SerializedBinaryAsset[]
}

export class FileSystemHyperFramesProjectRepository implements HyperFramesProjectRepository {
  private readonly freecutProjectId?: string
  private readonly locationCache = new Map<string, string[]>()
  private snapshotCounter = 0

  constructor(
    private readonly root: FileSystemDirectoryHandle,
    options: FileSystemHyperFramesProjectRepositoryOptions = {},
  ) {
    this.freecutProjectId = options.freecutProjectId
  }

  async listProjectRefs(freecutProjectId?: string): Promise<HyperFramesProjectRef[]> {
    const refs: HyperFramesProjectRef[] = []

    await this.collectRefsFromParent(topLevelHyperFramesSegments(), refs, freecutProjectId)

    if (freecutProjectId) {
      await this.collectRefsFromParent(scopedHyperFramesSegments(freecutProjectId), refs)
    } else {
      const projectDirs = await listDirectory(this.root, [PROJECTS_DIR])
      for (const entry of sortedDirectories(projectDirs)) {
        await this.collectRefsFromParent(scopedHyperFramesSegments(entry.name), refs)
      }
    }

    return refs.sort((left, right) => {
      const leftUpdatedAt = left.updatedAt ?? 0
      const rightUpdatedAt = right.updatedAt ?? 0
      if (leftUpdatedAt !== rightUpdatedAt) return rightUpdatedAt - leftUpdatedAt
      return left.id.localeCompare(right.id)
    })
  }

  async readManifest(projectId: string): Promise<HyperFramesProjectManifest | undefined> {
    assertHyperFramesProjectId(projectId)
    const baseSegments = await this.findProjectBaseSegments(projectId)
    if (!baseSegments) return undefined
    const manifest = await readJson<HyperFramesProjectManifest>(
      this.root,
      manifestPath(baseSegments),
    )
    return manifest ? cloneManifest(manifest) : undefined
  }

  async writeManifest(
    projectId: string,
    manifest: HyperFramesProjectManifest,
    meta: HyperFramesProjectWriteMeta,
  ): Promise<void> {
    assertHyperFramesProjectId(projectId)
    assertHyperFramesManifestPaths(manifest)
    const baseSegments = await this.getProjectBaseSegmentsForWrite(projectId, manifest)
    const nextManifest = mergeManifestProvenance(manifest, meta)
    await writeJsonAtomic(this.root, manifestPath(baseSegments), nextManifest)
    await this.ensureIndex(baseSegments)
    await this.refreshPreviewSignature(baseSegments)
    this.locationCache.set(projectId, baseSegments)
  }

  async readFile(projectId: string, path: string): Promise<string | undefined> {
    assertHyperFramesProjectId(projectId)
    normalizeHyperFramesProjectPath(path)
    const baseSegments = await this.findProjectBaseSegments(projectId)
    if (!baseSegments) return undefined
    const blob = await readBlob(this.root, projectContentPath(baseSegments, path))
    return blob ? blob.text() : undefined
  }

  async writeFile(
    projectId: string,
    path: string,
    content: string,
    meta: HyperFramesProjectWriteMeta,
  ): Promise<void> {
    assertHyperFramesProjectId(projectId)
    assertWritableFileType(path, undefined, 'text')
    const baseSegments = await this.getProjectBaseSegmentsForWrite(projectId)
    await this.ensureManifest(baseSegments, projectId, meta)
    await writeBlob(this.root, projectContentPath(baseSegments, path), content)
    await this.updateIndex(baseSegments, (index) => {
      upsertByPath(index.files, {
        path,
        hash: hashHyperFramesText(content),
      })
    })
    await this.touchManifest(baseSegments, meta)
  }

  async copyAsset(
    projectId: string,
    asset: HyperFramesBinaryAsset,
    meta: HyperFramesProjectWriteMeta,
  ): Promise<void> {
    assertHyperFramesProjectId(projectId)
    assertWritableFileType(asset.path, asset.mimeType, 'asset')
    const baseSegments = await this.getProjectBaseSegmentsForWrite(projectId)
    await this.ensureManifest(baseSegments, projectId, meta)
    const assetBytes = cloneBytes(asset.bytes)
    await writeBlob(this.root, projectContentPath(baseSegments, asset.path), assetBytes)
    await this.updateIndex(baseSegments, (index) => {
      upsertByPath(index.assets, {
        path: asset.path,
        mimeType: asset.mimeType,
        hash: asset.hash ?? hashHyperFramesBytes(assetBytes),
      })
    })
    await this.touchManifest(baseSegments, meta)
  }

  async readProjectDirectory(projectId: string): Promise<HyperFramesProjectDirectory | undefined> {
    assertHyperFramesProjectId(projectId)
    const baseSegments = await this.findProjectBaseSegments(projectId)
    if (!baseSegments) return undefined

    const manifest = await readJson<HyperFramesProjectManifest>(
      this.root,
      manifestPath(baseSegments),
    )
    if (!manifest) return undefined

    const index = await this.readIndex(baseSegments)
    const fileRefs = selectFileRefs(manifest, index)
    const assetRefs = selectAssetRefs(manifest, index)

    const files = await Promise.all(
      fileRefs.map(async (ref): Promise<HyperFramesProjectFile | null> => {
        assertWritableFileType(ref.path, undefined, 'text')
        const blob = await readBlob(this.root, projectContentPath(baseSegments, ref.path))
        if (!blob) return null
        const content = await blob.text()
        return {
          path: ref.path,
          content,
          encoding: 'utf8',
          hash: ref.hash ?? hashHyperFramesText(content),
        }
      }),
    )
    const assets = await Promise.all(
      assetRefs.map(async (ref): Promise<HyperFramesBinaryAsset | null> => {
        assertWritableFileType(ref.path, ref.mimeType, 'asset')
        const blob = await readBlob(this.root, projectContentPath(baseSegments, ref.path))
        if (!blob) return null
        return {
          path: ref.path,
          bytes: new Uint8Array(await blob.arrayBuffer()),
          mimeType: ref.mimeType,
          hash: ref.hash,
        }
      }),
    )

    return {
      manifest: cloneManifest(manifest),
      files: files.filter((file): file is HyperFramesProjectFile => file !== null),
      assets: assets.filter((asset): asset is HyperFramesBinaryAsset => asset !== null),
    }
  }

  async createSnapshot(projectId: string, reason: string): Promise<HyperFramesProjectSnapshot> {
    assertHyperFramesProjectId(projectId)
    const baseSegments = await this.findProjectBaseSegments(projectId)
    if (!baseSegments) {
      throw new Error(`HyperFrames project not found: ${projectId}`)
    }

    const directory = await this.readProjectDirectory(projectId)
    if (!directory) {
      throw new Error(`HyperFrames project not found: ${projectId}`)
    }

    const snapshot: HyperFramesProjectSnapshot = {
      id: `snapshot-${Date.now().toString(36)}-${++this.snapshotCounter}`,
      projectId,
      createdAt: Date.now(),
      reason,
      manifest: cloneManifest(directory.manifest),
      files: directory.files.map(cloneFile),
      assets: directory.assets.map(cloneAsset),
    }
    await writeJsonAtomic(
      this.root,
      snapshotPath(baseSegments, snapshot.id),
      serializeSnapshot(snapshot),
    )
    await this.updateIndex(baseSegments, (index) => {
      upsertById(index.snapshots, {
        id: snapshot.id,
        createdAt: snapshot.createdAt,
        reason,
      })
    })
    return cloneSnapshot(snapshot)
  }

  async restoreSnapshot(projectId: string, snapshotId: string): Promise<void> {
    assertHyperFramesProjectId(projectId)
    const baseSegments = await this.findProjectBaseSegments(projectId)
    if (!baseSegments) {
      throw new Error(`HyperFrames project not found: ${projectId}`)
    }

    const serialized = await readJson<SerializedSnapshot>(
      this.root,
      snapshotPath(baseSegments, snapshotId),
    )
    if (!serialized) {
      throw new Error(`HyperFrames snapshot not found: ${snapshotId}`)
    }

    const snapshot = deserializeSnapshot(serialized)
    await this.writeProjectDirectory(baseSegments, snapshot)
    this.locationCache.set(projectId, baseSegments)
  }

  async deleteProject(projectId: string): Promise<void> {
    assertHyperFramesProjectId(projectId)
    const baseSegments = await this.findProjectBaseSegments(projectId)
    if (!baseSegments) return
    await removeEntry(this.root, baseSegments, { recursive: true })
    this.locationCache.delete(projectId)
  }

  async computeSignature(projectId: string): Promise<string> {
    assertHyperFramesProjectId(projectId)
    const directory = await this.readProjectDirectory(projectId)
    if (!directory) {
      throw new Error(`HyperFrames project not found: ${projectId}`)
    }
    return computeHyperFramesProjectDirectorySignature(directory)
  }

  private async collectRefsFromParent(
    parentSegments: string[],
    refs: HyperFramesProjectRef[],
    freecutProjectId?: string,
  ): Promise<void> {
    const projectDirs = await listDirectory(this.root, parentSegments)
    for (const entry of sortedDirectories(projectDirs)) {
      const baseSegments = [...parentSegments, entry.name]
      const manifest = await readJson<HyperFramesProjectManifest>(
        this.root,
        manifestPath(baseSegments),
      )
      if (!manifest) continue
      if (freecutProjectId && manifest.provenance.freecutProjectId !== freecutProjectId) {
        continue
      }
      refs.push({
        id: manifest.id,
        title: manifest.title,
        activeCompositionPath: manifest.activeCompositionPath,
        freecutProjectId: manifest.provenance.freecutProjectId,
        updatedAt: manifest.provenance.updatedAt,
      })
      this.locationCache.set(manifest.id, baseSegments)
    }
  }

  private async getProjectBaseSegmentsForWrite(
    projectId: string,
    manifest?: HyperFramesProjectManifest,
  ): Promise<string[]> {
    const existing = await this.findProjectBaseSegments(projectId)
    if (existing) return existing

    const freecutProjectId = manifest?.provenance.freecutProjectId ?? this.freecutProjectId
    const baseSegments = freecutProjectId
      ? scopedProjectSegments(freecutProjectId, projectId)
      : topLevelProjectSegments(projectId)
    this.locationCache.set(projectId, baseSegments)
    return baseSegments
  }

  private async findProjectBaseSegments(projectId: string): Promise<string[] | undefined> {
    const cached = this.locationCache.get(projectId)
    if (cached && (await exists(this.root, manifestPath(cached)))) {
      return cached
    }

    const candidates: string[][] = []
    if (this.freecutProjectId) {
      candidates.push(scopedProjectSegments(this.freecutProjectId, projectId))
    }
    candidates.push(topLevelProjectSegments(projectId))

    const projectDirs = await listDirectory(this.root, [PROJECTS_DIR])
    for (const entry of sortedDirectories(projectDirs)) {
      if (entry.name === this.freecutProjectId) continue
      candidates.push(scopedProjectSegments(entry.name, projectId))
    }

    for (const candidate of candidates) {
      if (await exists(this.root, manifestPath(candidate))) {
        this.locationCache.set(projectId, candidate)
        return candidate
      }
    }
    return undefined
  }

  private async ensureManifest(
    baseSegments: string[],
    projectId: string,
    meta: HyperFramesProjectWriteMeta,
  ): Promise<void> {
    const manifest = await readJson<HyperFramesProjectManifest>(
      this.root,
      manifestPath(baseSegments),
    )
    if (manifest) return
    await writeJsonAtomic(
      this.root,
      manifestPath(baseSegments),
      mergeManifestProvenance(createPlaceholderManifest(projectId), meta),
    )
  }

  private async touchManifest(
    baseSegments: string[],
    meta: HyperFramesProjectWriteMeta,
  ): Promise<void> {
    const manifest = await readJson<HyperFramesProjectManifest>(
      this.root,
      manifestPath(baseSegments),
    )
    if (!manifest) return
    await writeJsonAtomic(
      this.root,
      manifestPath(baseSegments),
      mergeManifestProvenance(manifest, meta),
    )
    await this.refreshPreviewSignature(baseSegments)
  }

  private async ensureIndex(baseSegments: string[]): Promise<DirectoryIndex> {
    const existing = await this.readIndex(baseSegments)
    await writeJsonAtomic(this.root, directoryIndexPath(baseSegments), existing)
    return existing
  }

  private async readIndex(baseSegments: string[]): Promise<DirectoryIndex> {
    const index = await readJson<DirectoryIndex>(this.root, directoryIndexPath(baseSegments))
    if (!index) return createEmptyIndex()
    return {
      schemaVersion: 1,
      files: Array.isArray(index.files) ? index.files.map((file) => ({ ...file })) : [],
      assets: Array.isArray(index.assets) ? index.assets.map((asset) => ({ ...asset })) : [],
      snapshots: Array.isArray(index.snapshots)
        ? index.snapshots.map((snapshot) => ({ ...snapshot }))
        : [],
    }
  }

  private async updateIndex(
    baseSegments: string[],
    update: (index: DirectoryIndex) => void,
  ): Promise<void> {
    const index = await this.readIndex(baseSegments)
    update(index)
    await writeJsonAtomic(this.root, directoryIndexPath(baseSegments), index)
  }

  private async writeProjectDirectory(
    baseSegments: string[],
    snapshot: HyperFramesProjectSnapshot,
  ): Promise<void> {
    await writeJsonAtomic(this.root, manifestPath(baseSegments), cloneManifest(snapshot.manifest))

    const index = createEmptyIndex()
    for (const file of snapshot.files) {
      await writeBlob(this.root, projectContentPath(baseSegments, file.path), file.content)
      index.files.push({
        path: file.path,
        hash: file.hash ?? hashHyperFramesText(file.content),
      })
    }
    for (const asset of snapshot.assets) {
      const assetBytes = cloneBytes(asset.bytes)
      await writeBlob(this.root, projectContentPath(baseSegments, asset.path), assetBytes)
      index.assets.push({
        path: asset.path,
        mimeType: asset.mimeType,
        hash: asset.hash ?? hashHyperFramesBytes(assetBytes),
      })
    }

    const existingIndex = await this.readIndex(baseSegments)
    index.snapshots = existingIndex.snapshots
    await writeJsonAtomic(this.root, directoryIndexPath(baseSegments), index)
    await this.refreshPreviewSignature(baseSegments)
  }

  private async refreshPreviewSignature(baseSegments: string[]): Promise<void> {
    const manifest = await readJson<HyperFramesProjectManifest>(
      this.root,
      manifestPath(baseSegments),
    )
    if (!manifest) return
    const directory = await this.readProjectDirectory(manifest.id)
    if (!directory) return
    const signedManifest = reconcileHyperFramesPreviewSignature(directory)
    await writeJsonAtomic(this.root, manifestPath(baseSegments), signedManifest)
  }
}

export function createWorkspaceHyperFramesProjectRepository(
  options: FileSystemHyperFramesProjectRepositoryOptions = {},
): FileSystemHyperFramesProjectRepository {
  return new FileSystemHyperFramesProjectRepository(requireWorkspaceRoot(), options)
}

function topLevelHyperFramesSegments(): string[] {
  return [HYPERFRAMES_DIR]
}

function topLevelProjectSegments(projectId: string): string[] {
  return [...topLevelHyperFramesSegments(), assertHyperFramesProjectId(projectId)]
}

function scopedHyperFramesSegments(freecutProjectId: string): string[] {
  return [PROJECTS_DIR, assertHyperFramesProjectId(freecutProjectId), HYPERFRAMES_DIR]
}

function scopedProjectSegments(freecutProjectId: string, projectId: string): string[] {
  return [...scopedHyperFramesSegments(freecutProjectId), projectId]
}

function manifestPath(baseSegments: string[]): string[] {
  return [...baseSegments, MANIFEST_FILENAME]
}

function directoryIndexPath(baseSegments: string[]): string[] {
  return [...baseSegments, METADATA_DIR, DIRECTORY_INDEX_FILENAME]
}

function snapshotPath(baseSegments: string[], snapshotId: string): string[] {
  return [...baseSegments, METADATA_DIR, SNAPSHOTS_DIR, `${snapshotId}.json`]
}

function projectContentPath(baseSegments: string[], path: string): string[] {
  return [...baseSegments, ...normalizeHyperFramesProjectPath(path).segments]
}

function createEmptyIndex(): DirectoryIndex {
  return {
    schemaVersion: 1,
    files: [],
    assets: [],
    snapshots: [],
  }
}

function selectFileRefs(
  manifest: HyperFramesProjectManifest,
  index: DirectoryIndex,
): DirectoryIndexFileRef[] {
  if (index.files.length > 0) return index.files.map((file) => ({ ...file }))
  return uniqueStrings([manifest.entryFile, manifest.activeCompositionPath]).map((path) => ({
    path,
  }))
}

function selectAssetRefs(
  manifest: HyperFramesProjectManifest,
  index: DirectoryIndex,
): DirectoryIndexAssetRef[] {
  if (index.assets.length > 0) return index.assets.map((asset) => ({ ...asset }))
  return manifest.assets.map((asset) => ({
    path: asset.path,
    mimeType: asset.mimeType,
    hash: asset.hash,
  }))
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))]
}

function sortedDirectories(entries: Array<{ name: string; kind: 'file' | 'directory' }>) {
  return entries
    .filter((entry) => entry.kind === 'directory')
    .sort((left, right) => left.name.localeCompare(right.name))
}

function upsertByPath<T extends { path: string }>(items: T[], item: T): void {
  const index = items.findIndex((candidate) => candidate.path === item.path)
  if (index >= 0) {
    items[index] = item
  } else {
    items.push(item)
  }
  items.sort((left, right) => left.path.localeCompare(right.path))
}

function upsertById<T extends { id: string }>(items: T[], item: T): void {
  const index = items.findIndex((candidate) => candidate.id === item.id)
  if (index >= 0) {
    items[index] = item
  } else {
    items.push(item)
  }
  items.sort((left, right) => left.id.localeCompare(right.id))
}

function createPlaceholderManifest(projectId: string): HyperFramesProjectManifest {
  return {
    schemaVersion: 1,
    id: projectId,
    title: projectId,
    entryFile: 'index.html',
    activeCompositionPath: 'index.html',
    canvas: {
      width: 1920,
      height: 1080,
      fps: 30,
      durationInFrames: 1,
    },
    assets: [],
    provenance: {
      source: 'manual-import',
      createdAt: Date.now(),
    },
  }
}

function mergeManifestProvenance(
  manifest: HyperFramesProjectManifest,
  meta: HyperFramesProjectWriteMeta,
): HyperFramesProjectManifest {
  return {
    ...cloneManifest(manifest),
    provenance: {
      ...manifest.provenance,
      ...meta.provenance,
      updatedAt: Date.now(),
    },
  }
}

function cloneManifest(manifest: HyperFramesProjectManifest): HyperFramesProjectManifest {
  return structuredClone(manifest)
}

function cloneFile(file: HyperFramesProjectFile): HyperFramesProjectFile {
  return { ...file }
}

function cloneAsset(asset: HyperFramesBinaryAsset): HyperFramesBinaryAsset {
  return {
    ...asset,
    bytes: cloneBytes(asset.bytes),
  }
}

function cloneBytes(bytes: Uint8Array): Uint8Array {
  return new Uint8Array(bytes)
}

function cloneSnapshot(snapshot: HyperFramesProjectSnapshot): HyperFramesProjectSnapshot {
  return {
    ...snapshot,
    manifest: cloneManifest(snapshot.manifest),
    files: snapshot.files.map(cloneFile),
    assets: snapshot.assets.map(cloneAsset),
  }
}

function serializeSnapshot(snapshot: HyperFramesProjectSnapshot): SerializedSnapshot {
  return {
    ...snapshot,
    manifest: cloneManifest(snapshot.manifest),
    files: snapshot.files.map(cloneFile),
    assets: snapshot.assets.map((asset) => ({
      ...asset,
      bytes: [...asset.bytes],
    })),
  }
}

function deserializeSnapshot(snapshot: SerializedSnapshot): HyperFramesProjectSnapshot {
  return {
    ...snapshot,
    manifest: cloneManifest(snapshot.manifest),
    files: snapshot.files.map(cloneFile),
    assets: snapshot.assets.map((asset) => ({
      ...asset,
      bytes: new Uint8Array(asset.bytes),
    })),
  }
}
