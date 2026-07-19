import type {
  HyperFramesBinaryAsset,
  HyperFramesProjectDirectory,
  HyperFramesProjectFile,
  HyperFramesProjectManifest,
  HyperFramesProvenance,
} from '@/types/hyperframes'
import {
  assertHyperFramesManifestPaths,
  assertHyperFramesProjectId,
  assertHyperFramesProjectPath,
  assertWritableFileType,
} from './project-path-guards'
import {
  computeHyperFramesProjectDirectorySignature,
  hashHyperFramesText,
  reconcileHyperFramesPreviewSignature,
} from './project-signatures'

export interface HyperFramesProjectRef {
  id: string
  title: string
  activeCompositionPath: string
  freecutProjectId?: string
  updatedAt?: number
}

export interface HyperFramesProjectWriteMeta {
  reason: string
  provenance?: Partial<HyperFramesProvenance>
}

export interface HyperFramesProjectSnapshot {
  id: string
  projectId: string
  createdAt: number
  reason: string
  manifest: HyperFramesProjectManifest
  files: HyperFramesProjectFile[]
  assets: HyperFramesBinaryAsset[]
}

export interface HyperFramesProjectRepository {
  listProjectRefs(freecutProjectId?: string): Promise<HyperFramesProjectRef[]>
  readManifest(projectId: string): Promise<HyperFramesProjectManifest | undefined>
  writeManifest(
    projectId: string,
    manifest: HyperFramesProjectManifest,
    meta: HyperFramesProjectWriteMeta,
  ): Promise<void>
  readFile(projectId: string, path: string): Promise<string | undefined>
  writeFile(
    projectId: string,
    path: string,
    content: string,
    meta: HyperFramesProjectWriteMeta,
  ): Promise<void>
  copyAsset(
    projectId: string,
    asset: HyperFramesBinaryAsset,
    meta: HyperFramesProjectWriteMeta,
  ): Promise<void>
  readProjectDirectory(projectId: string): Promise<HyperFramesProjectDirectory | undefined>
  createSnapshot(projectId: string, reason: string): Promise<HyperFramesProjectSnapshot>
  restoreSnapshot(projectId: string, snapshotId: string): Promise<void>
  deleteProject(projectId: string): Promise<void>
  computeSignature(projectId: string): Promise<string>
}

interface StoredHyperFramesProject {
  manifest: HyperFramesProjectManifest
  files: Map<string, HyperFramesProjectFile>
  assets: Map<string, HyperFramesBinaryAsset>
  snapshots: Map<string, HyperFramesProjectSnapshot>
}

export class InMemoryHyperFramesProjectRepository implements HyperFramesProjectRepository {
  private readonly projects = new Map<string, StoredHyperFramesProject>()
  private snapshotCounter = 0

  constructor(initialDirectories: HyperFramesProjectDirectory[] = []) {
    for (const directory of initialDirectories) {
      assertHyperFramesManifestPaths(directory.manifest)
      this.projects.set(directory.manifest.id, this.createStoredProject(directory))
    }
  }

  async listProjectRefs(freecutProjectId?: string): Promise<HyperFramesProjectRef[]> {
    return [...this.projects.values()]
      .filter((project) => {
        if (!freecutProjectId) return true
        return project.manifest.provenance.freecutProjectId === freecutProjectId
      })
      .map((project) => ({
        id: project.manifest.id,
        title: project.manifest.title,
        activeCompositionPath: project.manifest.activeCompositionPath,
        freecutProjectId: project.manifest.provenance.freecutProjectId,
        updatedAt: project.manifest.provenance.updatedAt,
      }))
  }

  async readManifest(projectId: string): Promise<HyperFramesProjectManifest | undefined> {
    assertHyperFramesProjectId(projectId)
    const project = this.projects.get(projectId)
    return project ? cloneManifest(project.manifest) : undefined
  }

  async writeManifest(
    projectId: string,
    manifest: HyperFramesProjectManifest,
    meta: HyperFramesProjectWriteMeta,
  ): Promise<void> {
    assertHyperFramesProjectId(projectId)
    assertHyperFramesManifestPaths(manifest)
    const project = this.ensureProject(projectId, manifest)
    project.manifest = mergeManifestProvenance(manifest, meta)
    this.refreshProjectPreviewSignature(project)
  }

  async readFile(projectId: string, path: string): Promise<string | undefined> {
    assertHyperFramesProjectPath(projectId, path)
    const project = this.projects.get(projectId)
    return project?.files.get(path)?.content
  }

  async writeFile(
    projectId: string,
    path: string,
    content: string,
    meta: HyperFramesProjectWriteMeta,
  ): Promise<void> {
    assertHyperFramesProjectId(projectId)
    assertWritableFileType(path, undefined, 'text')
    const project = this.ensureProject(projectId)
    project.files.set(path, {
      path,
      content,
      encoding: 'utf8',
      hash: hashHyperFramesText(content),
    })
    project.manifest = mergeManifestProvenance(project.manifest, meta)
    this.refreshProjectPreviewSignature(project)
  }

  async copyAsset(
    projectId: string,
    asset: HyperFramesBinaryAsset,
    meta: HyperFramesProjectWriteMeta,
  ): Promise<void> {
    assertHyperFramesProjectId(projectId)
    assertWritableFileType(asset.path, asset.mimeType, 'asset')
    const project = this.ensureProject(projectId)
    project.assets.set(asset.path, cloneAsset(asset))
    project.manifest = mergeManifestProvenance(project.manifest, meta)
    this.refreshProjectPreviewSignature(project)
  }

  async readProjectDirectory(projectId: string): Promise<HyperFramesProjectDirectory | undefined> {
    assertHyperFramesProjectId(projectId)
    const project = this.projects.get(projectId)
    if (!project) return undefined
    return {
      manifest: cloneManifest(project.manifest),
      files: [...project.files.values()].map(cloneFile),
      assets: [...project.assets.values()].map(cloneAsset),
    }
  }

  async createSnapshot(projectId: string, reason: string): Promise<HyperFramesProjectSnapshot> {
    assertHyperFramesProjectId(projectId)
    const project = this.requireProject(projectId)
    const snapshot: HyperFramesProjectSnapshot = {
      id: `snapshot-${++this.snapshotCounter}`,
      projectId,
      createdAt: Date.now(),
      reason,
      manifest: cloneManifest(project.manifest),
      files: [...project.files.values()].map(cloneFile),
      assets: [...project.assets.values()].map(cloneAsset),
    }
    project.snapshots.set(snapshot.id, snapshot)
    return cloneSnapshot(snapshot)
  }

  async restoreSnapshot(projectId: string, snapshotId: string): Promise<void> {
    assertHyperFramesProjectId(projectId)
    const project = this.requireProject(projectId)
    const snapshot = project.snapshots.get(snapshotId)
    if (!snapshot) {
      throw new Error(`HyperFrames snapshot not found: ${snapshotId}`)
    }
    this.projects.set(projectId, {
      manifest: cloneManifest(snapshot.manifest),
      files: new Map(snapshot.files.map((file) => [file.path, cloneFile(file)])),
      assets: new Map(snapshot.assets.map((asset) => [asset.path, cloneAsset(asset)])),
      snapshots: project.snapshots,
    })
    this.refreshProjectPreviewSignature(this.requireProject(projectId))
  }

  async deleteProject(projectId: string): Promise<void> {
    assertHyperFramesProjectId(projectId)
    this.projects.delete(projectId)
  }

  async computeSignature(projectId: string): Promise<string> {
    assertHyperFramesProjectId(projectId)
    const directory = await this.readProjectDirectory(projectId)
    if (!directory) {
      throw new Error(`HyperFrames project not found: ${projectId}`)
    }
    return computeHyperFramesProjectDirectorySignature(directory)
  }

  private ensureProject(
    projectId: string,
    manifest: HyperFramesProjectManifest = createPlaceholderManifest(projectId),
  ): StoredHyperFramesProject {
    const existing = this.projects.get(projectId)
    if (existing) return existing

    const project: StoredHyperFramesProject = {
      manifest: cloneManifest(manifest),
      files: new Map(),
      assets: new Map(),
      snapshots: new Map(),
    }
    this.projects.set(projectId, project)
    return project
  }

  private requireProject(projectId: string): StoredHyperFramesProject {
    const project = this.projects.get(projectId)
    if (!project) {
      throw new Error(`HyperFrames project not found: ${projectId}`)
    }
    return project
  }

  private createStoredProject(directory: HyperFramesProjectDirectory): StoredHyperFramesProject {
    for (const file of directory.files) {
      assertWritableFileType(file.path, undefined, 'text')
    }
    for (const asset of directory.assets) {
      assertWritableFileType(asset.path, asset.mimeType, 'asset')
    }
    const project = {
      manifest: cloneManifest(directory.manifest),
      files: new Map(directory.files.map((file) => [file.path, cloneFile(file)])),
      assets: new Map(directory.assets.map((asset) => [asset.path, cloneAsset(asset)])),
      snapshots: new Map(),
    }
    this.refreshProjectPreviewSignature(project)
    return project
  }

  private refreshProjectPreviewSignature(project: StoredHyperFramesProject): void {
    project.manifest = reconcileHyperFramesPreviewSignature({
      manifest: project.manifest,
      files: [...project.files.values()].map(cloneFile),
      assets: [...project.assets.values()].map(cloneAsset),
    })
  }
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
  const now = Date.now()
  return {
    ...cloneManifest(manifest),
    provenance: {
      ...manifest.provenance,
      ...meta.provenance,
      updatedAt: now,
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
    bytes: new Uint8Array(asset.bytes),
  }
}

function cloneSnapshot(snapshot: HyperFramesProjectSnapshot): HyperFramesProjectSnapshot {
  return {
    ...snapshot,
    manifest: cloneManifest(snapshot.manifest),
    files: snapshot.files.map(cloneFile),
    assets: snapshot.assets.map(cloneAsset),
  }
}
