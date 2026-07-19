import {
  HyperFramesProjectPathError,
  normalizeHyperFramesProjectPath,
} from '@/features/hyperframes-runtime/adapters/freecut-project/project-path-guards'
import { hashHyperFramesText } from '@/features/hyperframes-runtime/adapters/freecut-project/project-signatures'
import type { HyperFramesDiagnostic, HyperFramesModelUsageSummary } from '@/types/hyperframes'
import {
  lintHyperframeHtml,
  shouldBlockRender,
  type HyperframeLintFinding,
} from '../../upstream/lint/browser.js'
import {
  patchElementInHtml,
  type PatchOperation,
  type SourceMutationTarget,
} from '../../upstream/studio-server/helpers/sourceMutation.js'
import type { FreeCutStudioAdapter, FreeCutStudioPatchMeta } from './createFreeCutStudioAdapter'
import { normalizeStudioSelection, type FreeCutStudioSelection } from './StudioSelectionMapper'

export interface StudioSelectionSnapshot {
  projectId: string
  filePath: string
  selection: FreeCutStudioSelection | null
  target: SourceMutationTarget
  contentHash: string
  snippet: string
  capturedAt: number
}

export interface StudioFilePatchProposal {
  id: string
  projectId: string
  filePath: string
  target: SourceMutationTarget
  operations: PatchOperation[]
  promptSummary?: string
  rationale?: string
  baseContentHash?: string
  modelUsage?: HyperFramesModelUsageSummary
  createdAt: number
}

export interface StudioFileDiffHunk {
  oldStart: number
  oldLines: string[]
  newStart: number
  newLines: string[]
}

export interface StudioFileDiff {
  filePath: string
  beforeHash: string
  afterHash: string
  changed: boolean
  hunks: StudioFileDiffHunk[]
}

export interface StudioFilePatchPreview {
  status: 'waiting-confirmation'
  proposal: StudioFilePatchProposal
  selectionSnapshot?: StudioSelectionSnapshot
  beforeContent: string
  afterContent: string
  matched: boolean
  inputHashMatches: boolean
  diff: StudioFileDiff
  diagnostics: HyperFramesDiagnostic[]
  shouldBlockConfirm: boolean
  risks: string[]
  canConfirm: boolean
}

export interface StudioPatchConfirmation {
  journal: StudioUndoJournalEntry
  diagnostics: HyperFramesDiagnostic[]
}

export interface StudioUndoJournalEntry {
  id: string
  projectId: string
  filePath: string
  proposalId: string
  snapshotId: string
  beforeHash: string
  afterHash: string
  confirmedAt: number
  confirmedByUser: true
  promptSummary?: string
  modelUsage?: HyperFramesModelUsageSummary
}

export interface StudioPatchRollbackResult {
  journalId: string
  projectId: string
  snapshotId: string
  rolledBackAt: number
}

function normalizeSafeFilePath(path: string): string {
  try {
    return normalizeHyperFramesProjectPath(path).path
  } catch (error) {
    if (error instanceof HyperFramesProjectPathError) throw error
    throw new HyperFramesProjectPathError('Unsafe HyperFrames project path')
  }
}

function selectionTarget(selection: FreeCutStudioSelection | null): SourceMutationTarget {
  if (!selection) return {}
  return {
    id: selection.elementId,
    selector: selection.selector,
  }
}

function snippetAround(content: string, startOffset?: number, endOffset?: number): string {
  if (startOffset == null || endOffset == null || startOffset < 0 || endOffset < startOffset) {
    return content.slice(0, 240)
  }
  const start = Math.max(0, startOffset - 80)
  const end = Math.min(content.length, endOffset + 80)
  return content.slice(start, end)
}

function splitLines(value: string): string[] {
  return value.length === 0 ? [] : value.split(/\r?\n/)
}

export function createStudioFileDiff(
  filePath: string,
  beforeContent: string,
  afterContent: string,
): StudioFileDiff {
  const beforeHash = hashHyperFramesText(beforeContent)
  const afterHash = hashHyperFramesText(afterContent)
  if (beforeContent === afterContent) {
    return { filePath, beforeHash, afterHash, changed: false, hunks: [] }
  }

  const beforeLines = splitLines(beforeContent)
  const afterLines = splitLines(afterContent)
  let prefix = 0
  while (
    prefix < beforeLines.length &&
    prefix < afterLines.length &&
    beforeLines[prefix] === afterLines[prefix]
  ) {
    prefix += 1
  }

  let suffix = 0
  while (
    suffix + prefix < beforeLines.length &&
    suffix + prefix < afterLines.length &&
    beforeLines[beforeLines.length - 1 - suffix] === afterLines[afterLines.length - 1 - suffix]
  ) {
    suffix += 1
  }

  return {
    filePath,
    beforeHash,
    afterHash,
    changed: true,
    hunks: [
      {
        oldStart: prefix + 1,
        oldLines: beforeLines.slice(prefix, beforeLines.length - suffix),
        newStart: prefix + 1,
        newLines: afterLines.slice(prefix, afterLines.length - suffix),
      },
    ],
  }
}

function mapLintSeverity(
  severity: HyperframeLintFinding['severity'],
): HyperFramesDiagnostic['severity'] {
  if (severity === 'error') return 'blocking'
  if (severity === 'warning') return 'warning'
  return 'suggestion'
}

function diagnosticHash(input: unknown): string {
  return hashHyperFramesText(JSON.stringify(input)).slice(0, 24)
}

function mapLintFinding(finding: HyperframeLintFinding, filePath: string): HyperFramesDiagnostic {
  const code = `hyperframes.studio-ai.${finding.code}`
  const file = finding.file ?? filePath
  return {
    id: `${code}:${diagnosticHash({
      code,
      file,
      selector: finding.selector,
      elementId: finding.elementId,
      message: finding.message,
    })}`,
    code,
    source: 'lint',
    stage: 'preview',
    severity: mapLintSeverity(finding.severity),
    message: finding.message,
    file,
    selector: finding.selector,
    elementId: finding.elementId,
    snippet: finding.snippet,
    fixHint: finding.fixHint,
  }
}

async function lintPreviewContent(
  filePath: string,
  content: string,
): Promise<{ diagnostics: HyperFramesDiagnostic[]; shouldBlockConfirm: boolean }> {
  const result = await lintHyperframeHtml(content, { filePath })
  const diagnostics = result.findings.map((finding) => mapLintFinding(finding, filePath))
  const blockingCount = diagnostics.filter(
    (diagnostic) => diagnostic.severity === 'blocking',
  ).length
  const warningCount = diagnostics.filter((diagnostic) => diagnostic.severity === 'warning').length
  return {
    diagnostics,
    shouldBlockConfirm: shouldBlockRender(true, false, blockingCount, warningCount),
  }
}

function previewRisks(input: {
  matched: boolean
  inputHashMatches: boolean
  diff: StudioFileDiff
  diagnostics: HyperFramesDiagnostic[]
  shouldBlockConfirm: boolean
}): string[] {
  const risks: string[] = []
  if (!input.matched) risks.push('Patch target did not match the current source file.')
  if (!input.inputHashMatches)
    risks.push('Source file changed after the model proposal was created.')
  if (!input.diff.changed) risks.push('Patch proposal does not change the source file.')
  if (input.shouldBlockConfirm) risks.push('Lint found blocking issues in the proposed source.')
  if (input.diagnostics.some((diagnostic) => diagnostic.severity === 'warning')) {
    risks.push('Lint found warnings that should be reviewed before confirmation.')
  }
  return risks
}

export async function captureStudioSelectionSnapshot(input: {
  adapter: FreeCutStudioAdapter
  projectId: string
  selection: FreeCutStudioSelection | null
  fallbackFilePath?: string
}): Promise<StudioSelectionSnapshot> {
  const directory = await input.adapter.resolveProject(input.projectId)
  if (!directory) throw new Error(`HyperFrames project not found: ${input.projectId}`)
  const selection = normalizeStudioSelection(input.selection)
  const filePath = normalizeSafeFilePath(
    selection?.sourceFile ?? input.fallbackFilePath ?? directory.manifest.activeCompositionPath,
  )
  const content = await input.adapter.readFile(input.projectId, filePath)
  if (content === undefined) throw new Error(`HyperFrames source file not found: ${filePath}`)
  return {
    projectId: input.projectId,
    filePath,
    selection,
    target: selectionTarget(selection),
    contentHash: hashHyperFramesText(content),
    snippet: snippetAround(content, selection?.startOffset, selection?.endOffset),
    capturedAt: Date.now(),
  }
}

export async function prepareStudioFilePatch(input: {
  adapter: FreeCutStudioAdapter
  proposal: StudioFilePatchProposal
  selectionSnapshot?: StudioSelectionSnapshot
}): Promise<StudioFilePatchPreview> {
  const filePath = normalizeSafeFilePath(input.proposal.filePath)
  const beforeContent = await input.adapter.readFile(input.proposal.projectId, filePath)
  if (beforeContent === undefined) throw new Error(`HyperFrames source file not found: ${filePath}`)

  const beforeHash = hashHyperFramesText(beforeContent)
  const inputHashMatches =
    !input.proposal.baseContentHash || input.proposal.baseContentHash === beforeHash
  const patch = patchElementInHtml(beforeContent, input.proposal.target, input.proposal.operations)
  const afterContent = patch.html
  const diff = createStudioFileDiff(filePath, beforeContent, afterContent)
  const lint = await lintPreviewContent(filePath, afterContent)
  const risks = previewRisks({
    matched: patch.matched,
    inputHashMatches,
    diff,
    diagnostics: lint.diagnostics,
    shouldBlockConfirm: lint.shouldBlockConfirm,
  })

  return {
    status: 'waiting-confirmation',
    proposal: {
      ...input.proposal,
      filePath,
    },
    selectionSnapshot: input.selectionSnapshot,
    beforeContent,
    afterContent,
    matched: patch.matched,
    inputHashMatches,
    diff,
    diagnostics: lint.diagnostics,
    shouldBlockConfirm: lint.shouldBlockConfirm,
    risks,
    canConfirm: patch.matched && inputHashMatches && diff.changed && !lint.shouldBlockConfirm,
  }
}

export async function confirmStudioFilePatch(input: {
  adapter: FreeCutStudioAdapter
  preview: StudioFilePatchPreview
  confirmedByUser: boolean
}): Promise<StudioPatchConfirmation> {
  if (!input.confirmedByUser) {
    throw new Error('Studio file patch requires explicit user confirmation.')
  }
  if (!input.preview.canConfirm) {
    throw new Error('Studio file patch preview is not confirmable.')
  }

  const { proposal } = input.preview
  const snapshot = await input.adapter.createSnapshot(
    proposal.projectId,
    `studio-ai:${proposal.id}`,
  )
  const confirmedAt = Date.now()
  const patchMeta: FreeCutStudioPatchMeta = {
    reason: 'studio-ai-patch-confirmed',
    userInitiated: true,
    provenance: {
      source: 'model-generation',
      confirmedByUser: true,
      promptSummary: proposal.promptSummary,
      modelUsage: proposal.modelUsage,
    },
  }

  await input.adapter.writeFile(
    proposal.projectId,
    proposal.filePath,
    input.preview.afterContent,
    patchMeta,
  )

  const directory = await input.adapter.resolveProject(proposal.projectId)
  if (directory) {
    await input.adapter.writeManifest(
      proposal.projectId,
      {
        ...directory.manifest,
        lastModelMutation: {
          mutatedAt: confirmedAt,
          modelProfileId: proposal.modelUsage?.modelProfileId,
          promptSummary: proposal.promptSummary,
          confirmedByUser: true,
        },
      },
      patchMeta,
    )
  }

  const lint = await input.adapter.lint(proposal.projectId, proposal.filePath)
  return {
    diagnostics: lint.diagnostics,
    journal: {
      id: `studio-ai-journal-${proposal.id}-${confirmedAt.toString(36)}`,
      projectId: proposal.projectId,
      filePath: proposal.filePath,
      proposalId: proposal.id,
      snapshotId: snapshot.id,
      beforeHash: input.preview.diff.beforeHash,
      afterHash: input.preview.diff.afterHash,
      confirmedAt,
      confirmedByUser: true,
      promptSummary: proposal.promptSummary,
      modelUsage: proposal.modelUsage,
    },
  }
}

export async function rollbackStudioFilePatch(input: {
  adapter: FreeCutStudioAdapter
  journal: StudioUndoJournalEntry
}): Promise<StudioPatchRollbackResult> {
  await input.adapter.restoreSnapshot(input.journal.projectId, input.journal.snapshotId)
  return {
    journalId: input.journal.id,
    projectId: input.journal.projectId,
    snapshotId: input.journal.snapshotId,
    rolledBackAt: Date.now(),
  }
}
