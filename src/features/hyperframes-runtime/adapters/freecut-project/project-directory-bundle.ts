import { unzipSync, zipSync } from 'fflate'
import type {
  HyperFramesBinaryAsset,
  HyperFramesProjectDirectory,
  HyperFramesProjectFile,
  HyperFramesProjectManifest,
} from '@/types/hyperframes'
import {
  assertHyperFramesManifestPaths,
  assertWritableFileType,
  normalizeHyperFramesProjectPath,
} from './project-path-guards'
import { hashHyperFramesBytes, hashHyperFramesText } from './project-signatures'

export const HYPERFRAMES_PROJECT_BUNDLE_VERSION = 1
export const HYPERFRAMES_PROJECT_BUNDLE_MANIFEST_PATH = 'hyperframes-bundle.json'
export const HYPERFRAMES_PROJECT_MANIFEST_PATH = 'manifest.json'

interface HyperFramesProjectBundleFileEntry {
  path: string
  encoding: 'utf8'
  hash: string
}

interface HyperFramesProjectBundleAssetEntry {
  path: string
  mimeType?: string
  hash: string
  bytes: number
}

interface HyperFramesProjectBundleManifest {
  schemaVersion: typeof HYPERFRAMES_PROJECT_BUNDLE_VERSION
  projectId: string
  manifestPath: typeof HYPERFRAMES_PROJECT_MANIFEST_PATH
  createdAt: number
  files: HyperFramesProjectBundleFileEntry[]
  assets: HyperFramesProjectBundleAssetEntry[]
}

export function packHyperFramesProjectDirectory(
  directory: HyperFramesProjectDirectory,
  options: { createdAt?: number } = {},
): Uint8Array {
  assertHyperFramesManifestPaths(directory.manifest)
  const files = normalizeProjectFiles(directory.files)
  const assets = normalizeProjectAssets(directory.assets)
  const entries: Record<string, Uint8Array> = {
    [HYPERFRAMES_PROJECT_MANIFEST_PATH]: encodeJson(directory.manifest),
  }

  for (const file of files) {
    assertNoDuplicateEntry(entries, file.path)
    entries[file.path] = encodeText(file.content)
  }
  for (const asset of assets) {
    assertNoDuplicateEntry(entries, asset.path)
    entries[asset.path] = new Uint8Array(asset.bytes)
  }

  const bundleManifest: HyperFramesProjectBundleManifest = {
    schemaVersion: HYPERFRAMES_PROJECT_BUNDLE_VERSION,
    projectId: directory.manifest.id,
    manifestPath: HYPERFRAMES_PROJECT_MANIFEST_PATH,
    createdAt: options.createdAt ?? Date.now(),
    files: files.map((file) => ({
      path: file.path,
      encoding: 'utf8',
      hash: file.hash ?? hashHyperFramesText(file.content),
    })),
    assets: assets.map((asset) => ({
      path: asset.path,
      mimeType: asset.mimeType,
      hash: asset.hash ?? hashHyperFramesBytes(asset.bytes),
      bytes: asset.bytes.byteLength,
    })),
  }
  entries[HYPERFRAMES_PROJECT_BUNDLE_MANIFEST_PATH] = encodeJson(bundleManifest)

  return zipSync(entries)
}

export function unpackHyperFramesProjectDirectory(
  bundleBytes: Uint8Array,
): HyperFramesProjectDirectory {
  const entries = unzipSync(bundleBytes)
  const bundleManifest = readBundleManifest(entries)
  const manifest = readProjectManifest(entries, bundleManifest)
  assertHyperFramesManifestPaths(manifest)

  const files = bundleManifest.files.map((entry): HyperFramesProjectFile => {
    assertWritableFileType(entry.path, undefined, 'text')
    const bytes = entries[entry.path]
    if (!bytes) {
      throw new Error(`HyperFrames bundle is missing file: ${entry.path}`)
    }
    const content = new TextDecoder().decode(bytes)
    return {
      path: entry.path,
      content,
      encoding: 'utf8',
      hash: entry.hash,
    }
  })

  const assets = bundleManifest.assets.map((entry): HyperFramesBinaryAsset => {
    assertWritableFileType(entry.path, entry.mimeType, 'asset')
    const bytes = entries[entry.path]
    if (!bytes) {
      throw new Error(`HyperFrames bundle is missing asset: ${entry.path}`)
    }
    return {
      path: entry.path,
      bytes: new Uint8Array(bytes),
      mimeType: entry.mimeType,
      hash: entry.hash,
    }
  })

  return {
    manifest,
    files,
    assets,
  }
}

function normalizeProjectFiles(files: HyperFramesProjectFile[]): HyperFramesProjectFile[] {
  const seen = new Set<string>()
  return files.map((file) => {
    assertWritableFileType(file.path, undefined, 'text')
    const path = normalizeHyperFramesProjectPath(file.path).path
    if (seen.has(path)) {
      throw new Error(`Duplicate HyperFrames project file path: ${path}`)
    }
    seen.add(path)
    return {
      ...file,
      path,
      encoding: 'utf8',
    }
  })
}

function normalizeProjectAssets(assets: HyperFramesBinaryAsset[]): HyperFramesBinaryAsset[] {
  const seen = new Set<string>()
  return assets.map((asset) => {
    assertWritableFileType(asset.path, asset.mimeType, 'asset')
    const path = normalizeHyperFramesProjectPath(asset.path).path
    if (seen.has(path)) {
      throw new Error(`Duplicate HyperFrames project asset path: ${path}`)
    }
    seen.add(path)
    return {
      ...asset,
      path,
      bytes: new Uint8Array(asset.bytes),
    }
  })
}

function readBundleManifest(
  entries: Record<string, Uint8Array>,
): HyperFramesProjectBundleManifest {
  const bytes = entries[HYPERFRAMES_PROJECT_BUNDLE_MANIFEST_PATH]
  if (!bytes) {
    throw new Error('HyperFrames bundle manifest is missing')
  }
  const parsed = JSON.parse(new TextDecoder().decode(bytes)) as HyperFramesProjectBundleManifest
  if (parsed.schemaVersion !== HYPERFRAMES_PROJECT_BUNDLE_VERSION) {
    throw new Error(`Unsupported HyperFrames bundle schema: ${parsed.schemaVersion}`)
  }
  if (parsed.manifestPath !== HYPERFRAMES_PROJECT_MANIFEST_PATH) {
    throw new Error(`Unsupported HyperFrames manifest path: ${parsed.manifestPath}`)
  }
  return parsed
}

function readProjectManifest(
  entries: Record<string, Uint8Array>,
  bundleManifest: HyperFramesProjectBundleManifest,
): HyperFramesProjectManifest {
  const bytes = entries[bundleManifest.manifestPath]
  if (!bytes) {
    throw new Error('HyperFrames project manifest is missing')
  }
  return JSON.parse(new TextDecoder().decode(bytes)) as HyperFramesProjectManifest
}

function encodeJson(value: unknown): Uint8Array {
  return encodeText(JSON.stringify(value, null, 2))
}

function encodeText(value: string): Uint8Array {
  return new Uint8Array(new TextEncoder().encode(value))
}

function assertNoDuplicateEntry(entries: Record<string, Uint8Array>, path: string): void {
  if (entries[path]) {
    throw new Error(`Duplicate HyperFrames bundle entry: ${path}`)
  }
}
