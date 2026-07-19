import type { HyperFramesDiagnostic, HyperFramesDiagnosticStage } from '@/types/hyperframes'
import { stableHyperFramesHash } from '../../adapters/freecut-project/project-signatures'

export interface HyperFramesPlayerDiagnosticContext {
  projectId?: string
  compositionPath?: string
  stage?: HyperFramesDiagnosticStage
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function errorMessageFromDetail(detail: unknown): string | null {
  if (typeof detail === 'string') return detail
  if (!isRecord(detail)) return null
  const message = detail.message
  if (typeof message === 'string') return message
  const error = detail.error
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return null
}

export function mapPlayerErrorToDiagnostic(
  error: unknown,
  context: HyperFramesPlayerDiagnosticContext = {},
): HyperFramesDiagnostic {
  const detail = error instanceof CustomEvent ? error.detail : null
  const message =
    errorMessageFromDetail(detail) ??
    (error instanceof Error ? error.message : null) ??
    (typeof error === 'string' ? error : null) ??
    'HyperFrames player preview failed.'
  const code = 'hyperframes.player.error'
  const stage = context.stage ?? 'preview'

  return {
    id: `${code}:${stableHyperFramesHash({
      code,
      stage,
      message,
      projectId: context.projectId,
      compositionPath: context.compositionPath,
    }).slice(0, 10)}`,
    code,
    source: 'runtime',
    stage,
    severity: 'blocking',
    message,
    file: context.compositionPath,
  }
}
