import type {
  HyperFramesBinaryAsset,
  HyperFramesProjectDirectory,
  HyperFramesProjectFile,
  HyperFramesProjectManifest,
  HyperFramesRenderingEngine,
} from '@/types/hyperframes'

export interface HyperFramesRenderSignatureInput {
  compositionPath?: string
  width: number
  height: number
  fps: number
  quality: string
  format: string
  alpha: boolean
  includeAudio: boolean
  engine: HyperFramesRenderingEngine
  producerVersion?: string
  runtimeVersion?: string
}

export function computeHyperFramesManifestSignature(
  manifest: HyperFramesProjectManifest,
): string {
  return stableHyperFramesHash({
    kind: 'hyperframes-manifest-signature',
    schemaVersion: 1,
    manifest: manifestSignaturePayload(manifest),
  })
}

export function computeHyperFramesProjectDirectorySignature(
  directory: HyperFramesProjectDirectory,
): string {
  return stableHyperFramesHash({
    kind: 'hyperframes-project-directory-signature',
    schemaVersion: 1,
    manifestSignature: computeHyperFramesManifestSignature(directory.manifest),
    files: fileSignaturePayload(directory.files),
    assets: assetSignaturePayload(directory.assets),
  })
}

export function computeHyperFramesPreviewSignature(
  directory: HyperFramesProjectDirectory,
  options: { runtimeVersion?: string } = {},
): string {
  return stableHyperFramesHash({
    kind: 'hyperframes-preview-signature',
    schemaVersion: 1,
    runtimeVersion: options.runtimeVersion ?? directory.manifest.sourceRuntimeVersion ?? null,
    manifest: runtimeSignatureManifestPayload(directory.manifest),
    files: fileSignaturePayload(directory.files),
    assets: assetSignaturePayload(directory.assets),
  })
}

export function computeHyperFramesRenderSignature(
  directory: HyperFramesProjectDirectory,
  input: HyperFramesRenderSignatureInput,
): string {
  return stableHyperFramesHash({
    kind: 'hyperframes-render-signature',
    schemaVersion: 1,
    previewSignature: computeHyperFramesPreviewSignature(directory, {
      runtimeVersion: input.runtimeVersion,
    }),
    render: canonicalRenderInput(directory.manifest, input),
  })
}

export function reconcileHyperFramesPreviewSignature(
  directory: HyperFramesProjectDirectory,
): HyperFramesProjectManifest {
  const previewSignature = computeHyperFramesPreviewSignature(directory)
  return {
    ...directory.manifest,
    previewSignature,
    renderSignature:
      directory.manifest.previewSignature === previewSignature
        ? directory.manifest.renderSignature
        : undefined,
  }
}

export function hashHyperFramesText(content: string): string {
  return fnv1aString(`text:${content}`)
}

export function hashHyperFramesBytes(bytes: Uint8Array): string {
  let hash = 2166136261
  for (const byte of bytes) {
    hash ^= byte
    hash = Math.imul(hash, 16777619)
  }
  return `fnv1a:${(hash >>> 0).toString(16).padStart(8, '0')}`
}

export function stableHyperFramesHash(value: unknown): string {
  return fnv1aString(stableStringify(value))
}

function manifestSignaturePayload(manifest: HyperFramesProjectManifest): unknown {
  const {
    previewSignature: _previewSignature,
    renderSignature: _renderSignature,
    lintSummary,
    provenance,
    lastStudioSave: _lastStudioSave,
    lastModelMutation: _lastModelMutation,
    diagnostics,
    ...stableManifest
  } = manifest

  return {
    ...stableManifest,
    diagnostics: diagnostics?.map((diagnostic) => omitUndefined(diagnostic)),
    lintSummary: lintSummary
      ? {
          blockingCount: lintSummary.blockingCount,
          warningCount: lintSummary.warningCount,
          suggestionCount: lintSummary.suggestionCount,
          diagnostics: lintSummary.diagnostics.map((diagnostic) => omitUndefined(diagnostic)),
        }
      : undefined,
    provenance: provenance
      ? {
          source: provenance.source,
          freecutProjectId: provenance.freecutProjectId,
          timelineItemId: provenance.timelineItemId,
          upstreamRuntimeVersion: provenance.upstreamRuntimeVersion,
          adapterVersion: provenance.adapterVersion,
          skillId: provenance.skillId,
          confirmedByUser: provenance.confirmedByUser,
        }
      : undefined,
  }
}

function runtimeSignatureManifestPayload(manifest: HyperFramesProjectManifest): unknown {
  return {
    schemaVersion: manifest.schemaVersion,
    id: manifest.id,
    entryFile: manifest.entryFile,
    activeCompositionPath: manifest.activeCompositionPath,
    canvas: manifest.canvas,
    assets: manifest.assets
      .map((asset) =>
        omitUndefined({
          id: asset.id,
          path: asset.path,
          kind: asset.kind,
          mimeType: asset.mimeType,
          hash: asset.hash,
          bytes: asset.bytes,
          width: asset.width,
          height: asset.height,
          durationInFrames: asset.durationInFrames,
          originalMediaId: asset.originalMediaId,
        }),
      )
      .sort(compareByPath),
    variables: manifest.variables,
    tags: manifest.tags ? [...manifest.tags].sort() : undefined,
    sourceRuntimeVersion: manifest.sourceRuntimeVersion,
    adapterVersion: manifest.adapterVersion,
  }
}

function canonicalRenderInput(
  manifest: HyperFramesProjectManifest,
  input: HyperFramesRenderSignatureInput,
): unknown {
  return omitUndefined({
    projectId: manifest.id,
    compositionPath: input.compositionPath ?? manifest.activeCompositionPath,
    width: input.width,
    height: input.height,
    fps: input.fps,
    quality: input.quality,
    format: input.format,
    alpha: input.alpha,
    includeAudio: input.includeAudio,
    engine: input.engine,
    producerVersion: input.producerVersion,
    runtimeVersion: input.runtimeVersion ?? manifest.sourceRuntimeVersion,
  })
}

function fileSignaturePayload(files: HyperFramesProjectFile[]): Array<[string, string]> {
  return files
    .map((file): [string, string] => [file.path, file.hash ?? hashHyperFramesText(file.content)])
    .sort(compareTupleByFirst)
}

function assetSignaturePayload(assets: HyperFramesBinaryAsset[]): Array<[string, string]> {
  return assets
    .map((asset): [string, string] => [
      asset.path,
      asset.hash ?? hashHyperFramesBytes(asset.bytes),
    ])
    .sort(compareTupleByFirst)
}

function stableStringify(value: unknown): string {
  return JSON.stringify(toCanonicalValue(value))
}

function toCanonicalValue(value: unknown): unknown {
  if (value === undefined) return undefined
  if (value === null) return null
  if (Array.isArray(value)) {
    return value.map(toCanonicalValue).filter((item) => item !== undefined)
  }
  if (value instanceof Uint8Array) {
    return [...value]
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    return Object.keys(record)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        const canonical = toCanonicalValue(record[key])
        if (canonical !== undefined) {
          acc[key] = canonical
        }
        return acc
      }, {})
  }
  return value
}

function omitUndefined<T extends object>(value: T): Partial<T> {
  const record = value as Record<string, unknown>
  return Object.keys(record).reduce<Partial<T>>((acc, key) => {
    const entry = record[key]
    if (entry !== undefined) {
      acc[key as keyof T] = entry as T[keyof T]
    }
    return acc
  }, {})
}

function compareByPath(left: { path?: unknown }, right: { path?: unknown }): number {
  return String(left.path ?? '').localeCompare(String(right.path ?? ''))
}

function compareTupleByFirst(left: [string, string], right: [string, string]): number {
  return left[0].localeCompare(right[0])
}

function fnv1aString(input: string): string {
  let hash = 2166136261
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return `fnv1a:${(hash >>> 0).toString(16).padStart(8, '0')}`
}
