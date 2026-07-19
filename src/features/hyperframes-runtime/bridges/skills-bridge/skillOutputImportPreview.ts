import type {
  HyperFramesAssetRef,
  HyperFramesBinaryAsset,
  HyperFramesDiagnostic,
  HyperFramesDiagnosticSeverity,
  HyperFramesModelUsageSummary,
  HyperFramesProjectDirectory,
  HyperFramesProjectFile,
  HyperFramesProjectManifest,
} from '@/types/hyperframes'
import {
  createPreviewDocument,
  type HyperFramesPreviewDocument,
} from '../../adapters/freecut-preview'
import {
  hyperFramesLintAdapter,
  type HyperFramesLintAdapter,
  type HyperFramesLintAdapterResult,
} from '../../adapters/freecut-project/lint-adapter'
import { stableHyperFramesHash } from '../../adapters/freecut-project/project-signatures'
import type { HyperFramesGenerationImportStrategy } from './generationPlan'
import type { HyperFramesSkillOutputBundle } from './skillJobQueue'

export interface HyperFramesSkillImportPreviewFile {
  path: string
  kind: 'asset' | 'file'
  sizeBytes: number
  hash?: string
  mimeType?: string
}

export interface HyperFramesSkillImportPreviewAsset {
  id?: string
  path: string
  kind?: string
  mimeType?: string
  hash?: string
  sizeBytes?: number
}

export interface HyperFramesSkillImportStrategyOption {
  strategy: HyperFramesGenerationImportStrategy
  enabled: boolean
  recommended: boolean
  reason: string
}

export interface HyperFramesSkillImportCostSummary {
  currency?: string
  estimatedCost: number
  inputTokens: number
  outputTokens: number
  usage: HyperFramesModelUsageSummary[]
}

export interface HyperFramesSkillImportPreview {
  id: string
  title: string
  projectDirectory?: HyperFramesProjectDirectory
  manifest?: HyperFramesProjectManifest
  previewDocument?: HyperFramesPreviewDocument
  fileTree: HyperFramesSkillImportPreviewFile[]
  assets: HyperFramesSkillImportPreviewAsset[]
  diagnostics: HyperFramesDiagnostic[]
  blockingDiagnostics: HyperFramesDiagnostic[]
  unsupportedFeatures: HyperFramesDiagnostic[]
  modelUsage: HyperFramesModelUsageSummary[]
  costSummary: HyperFramesSkillImportCostSummary
  suggestedImportStrategy: HyperFramesGenerationImportStrategy
  selectedImportStrategy: HyperFramesGenerationImportStrategy
  importStrategyOptions: HyperFramesSkillImportStrategyOption[]
  canConfirmImport: boolean
  lintResult?: HyperFramesLintAdapterResult
}

export interface CreateHyperFramesSkillImportPreviewOptions {
  id?: string
  selectedImportStrategy?: HyperFramesGenerationImportStrategy
  lintAdapter?: HyperFramesLintAdapter
  checkedAt?: number
  sandboxToken?: string
}

export async function createHyperFramesSkillImportPreview(
  output: HyperFramesSkillOutputBundle,
  options: CreateHyperFramesSkillImportPreviewOptions = {},
): Promise<HyperFramesSkillImportPreview> {
  const normalized = normalizeSkillOutputBundle(output)
  const lintAdapter = options.lintAdapter ?? hyperFramesLintAdapter
  const lintResult = normalized.projectDirectory
    ? await lintAdapter.lintProjectDirectory(normalized.projectDirectory, {
        stage: 'import',
        checkedAt: options.checkedAt,
        activeCompositionOnly: false,
      })
    : undefined
  const diagnostics = [...normalized.diagnostics, ...(lintResult?.diagnostics ?? [])].map(
    (diagnostic) => ({ ...diagnostic }),
  )
  const blockingDiagnostics = diagnostics.filter((diagnostic) => diagnostic.severity === 'blocking')
  const importStrategyOptions = createImportStrategyOptions(
    output.suggestedImportStrategy,
    normalized.projectDirectory,
    output.sourceAssets,
  )
  const selectedImportStrategy = selectImportStrategy(
    importStrategyOptions,
    options.selectedImportStrategy ?? output.suggestedImportStrategy,
  )
  const previewDocument =
    normalized.projectDirectory && normalized.manifest && blockingDiagnostics.length === 0
      ? createPreviewDocumentForDirectory(
          normalized.projectDirectory,
          normalized.manifest,
          options.sandboxToken,
        )
      : undefined

  return {
    id:
      options.id ??
      `hf-import-preview-${stableHyperFramesHash(output.outputDirectory).slice(0, 10)}`,
    title: normalized.manifest?.title ?? 'Untitled HyperFrames output',
    projectDirectory: normalized.projectDirectory,
    manifest: normalized.manifest,
    previewDocument,
    fileTree: normalized.projectDirectory ? createFileTree(normalized.projectDirectory) : [],
    assets: normalized.projectDirectory
      ? createAssetList(normalized.projectDirectory, output.sourceAssets)
      : [],
    diagnostics,
    blockingDiagnostics,
    unsupportedFeatures: diagnostics.filter(isUnsupportedFeatureDiagnostic),
    modelUsage: output.modelUsage.map((usage) => ({ ...usage })),
    costSummary: summarizeModelUsage(output.modelUsage),
    suggestedImportStrategy: output.suggestedImportStrategy,
    selectedImportStrategy,
    importStrategyOptions,
    canConfirmImport: blockingDiagnostics.length === 0 && Boolean(previewDocument),
    lintResult,
  }
}

export function normalizeSkillOutputBundle(output: HyperFramesSkillOutputBundle): {
  projectDirectory?: HyperFramesProjectDirectory
  manifest?: HyperFramesProjectManifest
  diagnostics: HyperFramesDiagnostic[]
} {
  const diagnostics = [...output.diagnostics.map((diagnostic) => ({ ...diagnostic }))]
  const manifest = output.projectDirectory?.manifest ?? output.manifest
  if (!manifest) {
    diagnostics.push(
      createPreviewDiagnostic(
        'missing_manifest',
        'blocking',
        'Generated output is missing manifest.',
      ),
    )
    return { diagnostics }
  }

  const files = output.projectDirectory?.files ?? output.generatedFiles
  const assets = output.projectDirectory?.assets ?? output.sourceAssets
  const projectDirectory: HyperFramesProjectDirectory = {
    manifest: cloneManifest(manifest),
    files: files.map((file) => ({ ...file })),
    assets: assets.map(cloneBinaryAsset),
  }

  if (projectDirectory.files.length === 0) {
    diagnostics.push(
      createPreviewDiagnostic('empty_output', 'blocking', 'Generated output has no project files.'),
    )
  }
  if (!projectDirectory.files.some((file) => file.path === projectDirectory.manifest.entryFile)) {
    diagnostics.push(
      createPreviewDiagnostic(
        'missing_entry_file',
        'blocking',
        `Generated output is missing entry file: ${projectDirectory.manifest.entryFile}.`,
      ),
    )
  }
  if (
    !projectDirectory.files.some(
      (file) => file.path === projectDirectory.manifest.activeCompositionPath,
    )
  ) {
    diagnostics.push(
      createPreviewDiagnostic(
        'missing_active_composition',
        'blocking',
        `Generated output is missing active composition: ${projectDirectory.manifest.activeCompositionPath}.`,
      ),
    )
  }

  return {
    projectDirectory,
    manifest: projectDirectory.manifest,
    diagnostics,
  }
}

function createImportStrategyOptions(
  suggested: HyperFramesGenerationImportStrategy,
  directory: HyperFramesProjectDirectory | undefined,
  sourceAssets: HyperFramesBinaryAsset[],
): HyperFramesSkillImportStrategyOption[] {
  const hasDirectory = Boolean(directory)
  const hasMediaAsset =
    sourceAssets.some(
      (asset) => asset.mimeType?.startsWith('video/') || asset.mimeType?.startsWith('audio/'),
    ) ||
    Boolean(
      directory?.manifest.assets.some((asset) => asset.kind === 'video' || asset.kind === 'audio'),
    )

  return [
    {
      strategy: 'source-link',
      enabled: hasDirectory,
      recommended: suggested === 'source-link',
      reason: 'Keep the HyperFrames project directory as the canonical source.',
    },
    {
      strategy: 'source-link-with-approximations',
      enabled: hasDirectory,
      recommended: suggested === 'source-link-with-approximations',
      reason: 'Create a source-linked composition and expose recognizable native timeline items.',
    },
    {
      strategy: 'rendered-media',
      enabled: hasMediaAsset || suggested === 'rendered-media',
      recommended: suggested === 'rendered-media',
      reason:
        'Import rendered media when stable playback or transparent overlay output is preferred.',
    },
  ]
}

function selectImportStrategy(
  options: HyperFramesSkillImportStrategyOption[],
  requested: HyperFramesGenerationImportStrategy,
): HyperFramesGenerationImportStrategy {
  const requestedOption = options.find((option) => option.strategy === requested && option.enabled)
  if (requestedOption) return requestedOption.strategy
  return options.find((option) => option.enabled)?.strategy ?? 'source-link'
}

function createPreviewDocumentForDirectory(
  directory: HyperFramesProjectDirectory,
  manifest: HyperFramesProjectManifest,
  sandboxToken: string | undefined,
): HyperFramesPreviewDocument | undefined {
  const html = directory.files.find((file) => file.path === manifest.activeCompositionPath)?.content
  if (!html) return undefined
  return createPreviewDocument({
    html,
    projectId: manifest.id,
    compositionPath: manifest.activeCompositionPath,
    sandbox: {
      debugLabel: `skill-import-preview:${manifest.id}`,
    },
    sandboxToken,
  })
}

function createFileTree(
  directory: HyperFramesProjectDirectory,
): HyperFramesSkillImportPreviewFile[] {
  return [
    ...directory.files.map((file) => ({
      path: file.path,
      kind: 'file' as const,
      sizeBytes: textBytes(file.content),
      hash: file.hash,
    })),
    ...directory.assets.map((asset) => ({
      path: asset.path,
      kind: 'asset' as const,
      sizeBytes: asset.bytes.byteLength,
      hash: asset.hash,
      mimeType: asset.mimeType,
    })),
  ].sort((left, right) => left.path.localeCompare(right.path))
}

function createAssetList(
  directory: HyperFramesProjectDirectory,
  sourceAssets: HyperFramesBinaryAsset[],
): HyperFramesSkillImportPreviewAsset[] {
  const assets = new Map<string, HyperFramesSkillImportPreviewAsset>()
  for (const asset of directory.manifest.assets) {
    assets.set(asset.path, assetFromManifest(asset))
  }
  for (const asset of [...directory.assets, ...sourceAssets]) {
    const existing = assets.get(asset.path)
    assets.set(asset.path, {
      ...existing,
      path: asset.path,
      mimeType: asset.mimeType ?? existing?.mimeType,
      hash: asset.hash ?? existing?.hash,
      sizeBytes: asset.bytes.byteLength,
    })
  }
  return [...assets.values()].sort((left, right) => left.path.localeCompare(right.path))
}

function assetFromManifest(asset: HyperFramesAssetRef): HyperFramesSkillImportPreviewAsset {
  return {
    id: asset.id,
    path: asset.path,
    kind: asset.kind,
    mimeType: asset.mimeType,
    hash: asset.hash,
  }
}

function summarizeModelUsage(
  usage: HyperFramesModelUsageSummary[],
): HyperFramesSkillImportCostSummary {
  return usage.reduce<HyperFramesSkillImportCostSummary>(
    (summary, item) => ({
      currency: summary.currency ?? item.currency,
      estimatedCost: summary.estimatedCost + (item.estimatedCost ?? 0),
      inputTokens: summary.inputTokens + (item.inputTokens ?? 0),
      outputTokens: summary.outputTokens + (item.outputTokens ?? 0),
      usage: [...summary.usage, { ...item }],
    }),
    {
      currency: usage.find((item) => item.currency)?.currency,
      estimatedCost: 0,
      inputTokens: 0,
      outputTokens: 0,
      usage: [],
    },
  )
}

function isUnsupportedFeatureDiagnostic(diagnostic: HyperFramesDiagnostic): boolean {
  const code = diagnostic.code ?? ''
  return code.includes('unsupported') || /unsupported|not supported/i.test(diagnostic.message)
}

function createPreviewDiagnostic(
  code: string,
  severity: HyperFramesDiagnosticSeverity,
  message: string,
): HyperFramesDiagnostic {
  const fullCode = `hyperframes.import_preview.${code}`
  return {
    id: `${fullCode}:${stableHyperFramesHash(message).slice(0, 10)}`,
    code: fullCode,
    source: 'storage',
    stage: 'import',
    severity,
    message,
  }
}

function cloneManifest(manifest: HyperFramesProjectManifest): HyperFramesProjectManifest {
  return {
    ...manifest,
    canvas: { ...manifest.canvas },
    assets: manifest.assets.map((asset) => ({ ...asset })),
    provenance: {
      ...manifest.provenance,
      modelUsage: manifest.provenance.modelUsage
        ? { ...manifest.provenance.modelUsage }
        : undefined,
    },
    diagnostics: manifest.diagnostics
      ? manifest.diagnostics.map((diagnostic) => ({ ...diagnostic }))
      : undefined,
    variables: manifest.variables ? { ...manifest.variables } : undefined,
    tags: manifest.tags ? [...manifest.tags] : undefined,
    lastStudioSave: manifest.lastStudioSave
      ? {
          ...manifest.lastStudioSave,
          files: [...manifest.lastStudioSave.files],
        }
      : undefined,
    lastModelMutation: manifest.lastModelMutation ? { ...manifest.lastModelMutation } : undefined,
    lintSummary: manifest.lintSummary
      ? {
          ...manifest.lintSummary,
          diagnostics: manifest.lintSummary.diagnostics.map((diagnostic) => ({ ...diagnostic })),
        }
      : undefined,
  }
}

function cloneBinaryAsset(asset: HyperFramesBinaryAsset): HyperFramesBinaryAsset {
  return {
    ...asset,
    bytes: Uint8Array.from(asset.bytes),
  }
}

function textBytes(value: string): number {
  return new TextEncoder().encode(value).byteLength
}

export type { HyperFramesProjectFile }
