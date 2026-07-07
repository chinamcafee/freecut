/**
 * Manifest-backed HyperFrames project directory storage.
 */

import type { HyperFramesProjectDirectory, HyperFramesProjectManifest } from '@/types/hyperframes'

export interface StorageResult<T = void> {
  success: boolean
  data?: T
  error?: string
}

export interface HyperFramesFileSystemAdapter {
  writeFile(path: string, contents: string): Promise<void>
  readFile(path: string): Promise<string>
  deleteFile(path: string): Promise<void>
  deleteDirectory(path: string): Promise<void>
  listFiles(prefix: string): Promise<string[]>
  exists(path: string): Promise<boolean>
}

export class InMemoryHyperFramesFileSystemAdapter implements HyperFramesFileSystemAdapter {
  private files = new Map<string, string>()

  async writeFile(path: string, contents: string): Promise<void> {
    this.files.set(normalizePath(path), contents)
  }

  async readFile(path: string): Promise<string> {
    const normalized = normalizePath(path)
    const contents = this.files.get(normalized)
    if (contents === undefined) {
      throw new Error(`File not found: ${normalized}`)
    }
    return contents
  }

  async deleteFile(path: string): Promise<void> {
    this.files.delete(normalizePath(path))
  }

  async deleteDirectory(path: string): Promise<void> {
    const prefix = ensureTrailingSlash(normalizePath(path))
    for (const filePath of this.files.keys()) {
      if (filePath.startsWith(prefix)) {
        this.files.delete(filePath)
      }
    }
  }

  async listFiles(prefix: string): Promise<string[]> {
    const normalizedPrefix = ensureTrailingSlash(normalizePath(prefix))
    return Array.from(this.files.keys())
      .filter((path) => path.startsWith(normalizedPrefix))
      .sort()
  }

  async exists(path: string): Promise<boolean> {
    return this.files.has(normalizePath(path))
  }
}

export class OpfsHyperFramesFileSystemAdapter implements HyperFramesFileSystemAdapter {
  private rootHandle: Promise<FileSystemDirectoryHandle>

  constructor(rootHandle?: Promise<FileSystemDirectoryHandle>) {
    this.rootHandle = rootHandle ?? navigator.storage.getDirectory()
  }

  async writeFile(path: string, contents: string): Promise<void> {
    const fileHandle = await this.getFileHandle(path, true)
    const writable = await fileHandle.createWritable()
    await writable.write(contents)
    await writable.close()
  }

  async readFile(path: string): Promise<string> {
    const fileHandle = await this.getFileHandle(path, false)
    return await (await fileHandle.getFile()).text()
  }

  async deleteFile(path: string): Promise<void> {
    const { directory, fileName } = await this.getParentDirectory(path, false)
    await directory.removeEntry(fileName)
  }

  async deleteDirectory(path: string): Promise<void> {
    const { directory, fileName } = await this.getParentDirectory(path, false)
    await directory.removeEntry(fileName, { recursive: true })
  }

  async listFiles(prefix: string): Promise<string[]> {
    const root = await this.rootHandle
    const normalizedPrefix = normalizePath(prefix)
    const directory = await getDirectoryByPath(root, normalizedPrefix, false)
    return await listDirectoryFiles(directory, normalizedPrefix)
  }

  async exists(path: string): Promise<boolean> {
    try {
      await this.getFileHandle(path, false)
      return true
    } catch {
      return false
    }
  }

  private async getFileHandle(path: string, create: boolean): Promise<FileSystemFileHandle> {
    const { directory, fileName } = await this.getParentDirectory(path, create)
    return await directory.getFileHandle(fileName, { create })
  }

  private async getParentDirectory(
    path: string,
    create: boolean,
  ): Promise<{ directory: FileSystemDirectoryHandle; fileName: string }> {
    const normalized = normalizePath(path)
    assertSafeRelativePath(normalized)
    const segments = normalized.split('/')
    const fileName = segments.pop()
    if (!fileName) {
      throw new Error(`Invalid file path: ${path}`)
    }

    const root = await this.rootHandle
    const directory = await getDirectoryBySegments(root, segments, create)
    return { directory, fileName }
  }
}

export class DirectoryHandleHyperFramesFileSystemAdapter extends OpfsHyperFramesFileSystemAdapter {
  constructor(directoryHandle: FileSystemDirectoryHandle) {
    super(Promise.resolve(directoryHandle))
  }
}

export class HyperFramesProjectStorage {
  private static readonly INDEX_PATH = 'hyperframes/index.json'

  constructor(private adapter?: HyperFramesFileSystemAdapter) {}

  async saveProject(projectDirectory: HyperFramesProjectDirectory): Promise<StorageResult<string>> {
    try {
      validateProjectDirectory(projectDirectory)

      for (const [relativePath, contents] of Object.entries(projectDirectory.files)) {
        assertSafeRelativePath(relativePath)
        await this.getAdapter().writeFile(joinPath(projectDirectory.rootPath, relativePath), contents)
      }

      await this.updateIndex((manifests) => {
        const next = manifests.filter((manifest) => manifest.id !== projectDirectory.manifest.id)
        next.push(projectDirectory.manifest)
        return next.sort((left, right) => right.updatedAt - left.updatedAt)
      })

      return {
        success: true,
        data: projectDirectory.rootPath,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '保存 HyperFrames 项目失败',
      }
    }
  }

  async loadProject(projectId: string): Promise<StorageResult<HyperFramesProjectDirectory>> {
    try {
      const manifest = await this.getManifest(projectId)
      const filePaths = await this.getAdapter().listFiles(manifest.projectDir)
      const files: Record<string, string> = {}

      for (const filePath of filePaths) {
        const relativePath = filePath.slice(ensureTrailingSlash(manifest.projectDir).length)
        files[relativePath] = await this.getAdapter().readFile(filePath)
      }

      return {
        success: true,
        data: {
          projectId: manifest.id,
          rootPath: manifest.projectDir,
          manifest,
          entryFile: manifest.entryFile,
          activeCompositionPath: manifest.activeCompositionPath,
          files,
          fileIndex: Object.entries(files).map(([path, contents]) => ({
            path,
            contents,
            kind:
              path === 'manifest.json'
                ? 'manifest'
                : path === manifest.entryFile
                  ? 'entry'
                  : 'composition',
            hash: stableHash(contents),
          })),
          assets: manifest.assets,
          warnings: manifest.warnings ?? [],
          unsupportedFeatures: manifest.unsupportedFeatures ?? [],
        },
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '加载 HyperFrames 项目失败',
      }
    }
  }

  async deleteProject(projectId: string): Promise<StorageResult> {
    try {
      const manifest = await this.getManifest(projectId)
      await this.getAdapter().deleteDirectory(manifest.projectDir)
      await this.updateIndex((manifests) => manifests.filter((entry) => entry.id !== projectId))
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '删除 HyperFrames 项目失败',
      }
    }
  }

  async listProjects(): Promise<StorageResult<HyperFramesProjectManifest[]>> {
    try {
      return {
        success: true,
        data: await this.readIndex(),
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '列出 HyperFrames 项目失败',
      }
    }
  }

  async exists(projectId: string): Promise<boolean> {
    const manifest = await this.getManifestSafe(projectId)
    return manifest
      ? await this.getAdapter().exists(joinPath(manifest.projectDir, 'manifest.json'))
      : false
  }

  private async getManifest(projectId: string): Promise<HyperFramesProjectManifest> {
    const manifest = await this.getManifestSafe(projectId)
    if (!manifest) {
      throw new Error(`HyperFrames project not found: ${projectId}`)
    }
    return manifest
  }

  private async getManifestSafe(projectId: string): Promise<HyperFramesProjectManifest | null> {
    return (await this.readIndex()).find((manifest) => manifest.id === projectId) ?? null
  }

  private async readIndex(): Promise<HyperFramesProjectManifest[]> {
    try {
      return JSON.parse(await this.getAdapter().readFile(HyperFramesProjectStorage.INDEX_PATH))
    } catch {
      return []
    }
  }

  private async updateIndex(
    updater: (manifests: HyperFramesProjectManifest[]) => HyperFramesProjectManifest[],
  ): Promise<void> {
    const next = updater(await this.readIndex())
    await this.getAdapter().writeFile(
      HyperFramesProjectStorage.INDEX_PATH,
      JSON.stringify(next, null, 2),
    )
  }

  private getAdapter(): HyperFramesFileSystemAdapter {
    this.adapter ??= new OpfsHyperFramesFileSystemAdapter()
    return this.adapter
  }
}

export const compositionStorage = new HyperFramesProjectStorage()

function validateProjectDirectory(projectDirectory: HyperFramesProjectDirectory): void {
  assertSafeRelativePath(projectDirectory.rootPath)
  if (projectDirectory.rootPath !== projectDirectory.manifest.projectDir) {
    throw new Error('HyperFrames project rootPath must match manifest.projectDir')
  }
  if (!projectDirectory.files['manifest.json']) {
    projectDirectory.files['manifest.json'] = JSON.stringify(projectDirectory.manifest, null, 2)
  }
  if (!projectDirectory.files[projectDirectory.manifest.entryFile]) {
    throw new Error(`Missing HyperFrames entry file: ${projectDirectory.manifest.entryFile}`)
  }
  if (!projectDirectory.files[projectDirectory.manifest.activeCompositionPath]) {
    throw new Error(
      `Missing active HyperFrames composition: ${projectDirectory.manifest.activeCompositionPath}`,
    )
  }
}

function assertSafeRelativePath(path: string): void {
  const normalized = normalizePath(path)
  if (
    normalized.startsWith('/') ||
    normalized.includes('../') ||
    normalized === '..' ||
    normalized.includes('\0')
  ) {
    throw new Error(`Unsafe HyperFrames project path: ${path}`)
  }
}

function normalizePath(path: string): string {
  return path.replaceAll('\\', '/').replace(/\/+/g, '/').replace(/^\.\//, '').replace(/\/$/, '')
}

function ensureTrailingSlash(path: string): string {
  return normalizePath(path) + '/'
}

function joinPath(...parts: string[]): string {
  return normalizePath(parts.join('/'))
}

async function getDirectoryByPath(
  root: FileSystemDirectoryHandle,
  path: string,
  create: boolean,
): Promise<FileSystemDirectoryHandle> {
  return await getDirectoryBySegments(root, normalizePath(path).split('/').filter(Boolean), create)
}

async function getDirectoryBySegments(
  root: FileSystemDirectoryHandle,
  segments: string[],
  create: boolean,
): Promise<FileSystemDirectoryHandle> {
  let current = root
  for (const segment of segments) {
    current = await current.getDirectoryHandle(segment, { create })
  }
  return current
}

async function listDirectoryFiles(
  directory: FileSystemDirectoryHandle,
  prefix: string,
): Promise<string[]> {
  const paths: string[] = []
  for await (const [name, handle] of directory.entries()) {
    const path = joinPath(prefix, name)
    if (handle.kind === 'file') {
      paths.push(path)
    } else {
      paths.push(...(await listDirectoryFiles(handle as FileSystemDirectoryHandle, path)))
    }
  }
  return paths.sort()
}

function stableHash(input: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`
}
