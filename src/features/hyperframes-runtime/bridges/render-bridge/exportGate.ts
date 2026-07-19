import type { HyperFramesDiagnostic, HyperFramesProjectDirectory } from '@/types/hyperframes'
import type { HyperFramesRenderJobState } from './renderJobStore'
import type { HyperFramesRuntimeCheck } from './HyperFramesRenderService'

export type HyperFramesExportBlockerCode =
  | 'manifest-missing'
  | 'entry-file-missing'
  | 'active-composition-missing'
  | 'security-failed'
  | 'producer-missing'
  | 'render-incomplete'
  | 'render-failed'
  | 'transparent-overlay-failed'

export interface HyperFramesExportBlocker {
  code: HyperFramesExportBlockerCode
  message: string
  projectId?: string
  fixHint: string
}

export interface HyperFramesExportGateInput {
  projectId?: string
  directory?: HyperFramesProjectDirectory
  diagnostics?: HyperFramesDiagnostic[]
  runtime?: HyperFramesRuntimeCheck
  renderJob?: HyperFramesRenderJobState
  requiresTransparentOverlay?: boolean
}

export interface HyperFramesExportGateResult {
  allowed: boolean
  blockers: HyperFramesExportBlocker[]
  warnings: HyperFramesDiagnostic[]
}

export function evaluateHyperFramesExportGate(
  input: HyperFramesExportGateInput,
): HyperFramesExportGateResult {
  const blockers: HyperFramesExportBlocker[] = []
  const projectId = input.directory?.manifest.id ?? input.projectId
  const files = new Set(input.directory?.files.map((file) => file.path) ?? [])
  const add = (code: HyperFramesExportBlockerCode, message: string, fixHint: string) => {
    blockers.push({ code, message, projectId, fixHint })
  }

  if (!input.directory) {
    add('manifest-missing', 'HyperFrames project directory or manifest is missing.', 'Relink or restore the HyperFrames source project before export.')
  } else {
    if (!files.has(input.directory.manifest.entryFile)) {
      add('entry-file-missing', `Entry file is missing: ${input.directory.manifest.entryFile}`, 'Open Studio and restore the manifest entry file.')
    }
    if (!files.has(input.directory.manifest.activeCompositionPath)) {
      add('active-composition-missing', `Active composition is missing: ${input.directory.manifest.activeCompositionPath}`, 'Relink the active composition or select another valid composition.')
    }
  }

  if ((input.diagnostics ?? []).some((diagnostic) => diagnostic.severity === 'blocking')) {
    add('security-failed', 'HyperFrames security or lint validation contains blocking diagnostics.', 'Open diagnostics, repair every blocking item, then validate again.')
  }
  if (!input.runtime?.available || !input.runtime.chromeAvailable || !input.runtime.ffmpegAvailable) {
    add('producer-missing', 'HyperFrames Producer runtime is unavailable.', 'Open runtime diagnostics and install or reconnect Chrome and FFmpeg.')
  }
  if (!input.renderJob || input.renderJob.status === 'queued' || input.renderJob.status === 'rendering') {
    add('render-incomplete', 'HyperFrames production render has not completed.', 'Wait for the render job to complete or retry it.')
  } else if (input.renderJob.status === 'failed' || input.renderJob.status === 'cancelled') {
    add('render-failed', input.renderJob.error ?? 'HyperFrames render failed or was cancelled.', 'Open render logs, repair the failure, and rerun export.')
  } else if (!input.renderJob.output) {
    add('render-failed', 'HyperFrames render completed without an output artifact.', 'Clear the render cache and rerun the Producer job.')
  }
  if (input.requiresTransparentOverlay && input.renderJob?.output && !input.renderJob.output.alpha) {
    add('transparent-overlay-failed', 'The rendered overlay does not contain an alpha channel.', 'Render WebM, MOV, or PNG sequence with alpha enabled.')
  }

  return {
    allowed: blockers.length === 0,
    blockers,
    warnings: (input.diagnostics ?? []).filter((diagnostic) => diagnostic.severity !== 'blocking'),
  }
}
