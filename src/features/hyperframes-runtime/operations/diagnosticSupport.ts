import type { HyperFramesDiagnostic } from '@/types/hyperframes'

export type HyperFramesSupportCategory =
  | 'model-unavailable'
  | 'validation-failed'
  | 'render-failed'
  | 'asset-missing'
  | 'cost-exceeded'
  | 'unknown'

export interface HyperFramesSupportInfo {
  category: HyperFramesSupportCategory
  title: string
  message: string
  nextActions: string[]
  canRetry: boolean
  file?: string
  elementId?: string
}

export function createHyperFramesSupportInfo(
  diagnostic: HyperFramesDiagnostic,
): HyperFramesSupportInfo {
  const text = `${diagnostic.code ?? ''} ${diagnostic.message}`.toLowerCase()
  const category: HyperFramesSupportCategory =
    /model|provider|credential|api key/.test(text) ? 'model-unavailable' :
    /cost|budget|quota/.test(text) ? 'cost-exceeded' :
    /asset|media|file.*missing|not found/.test(text) ? 'asset-missing' :
    diagnostic.source === 'render' || /render|capture|ffmpeg|chrome/.test(text) ? 'render-failed' :
    diagnostic.severity === 'blocking' ? 'validation-failed' : 'unknown'
  const defaults = SUPPORT_DEFAULTS[category]
  return {
    category,
    title: defaults.title,
    message: diagnostic.message,
    nextActions: diagnostic.fixHint ? [diagnostic.fixHint, ...defaults.actions] : defaults.actions,
    canRetry: defaults.canRetry,
    file: diagnostic.file,
    elementId: diagnostic.elementId,
  }
}

const SUPPORT_DEFAULTS: Record<HyperFramesSupportCategory, { title: string; actions: string[]; canRetry: boolean }> = {
  'model-unavailable': { title: 'Model unavailable', actions: ['Open Model Center and verify the active profile.', 'Retry after the provider health check passes.'], canRetry: true },
  'validation-failed': { title: 'Validation failed', actions: ['Open the referenced file in Studio.', 'Run validation again after repairing blocking diagnostics.'], canRetry: true },
  'render-failed': { title: 'Render failed', actions: ['Open the render log and runtime diagnostics.', 'Clear stale cache and retry the Producer job.'], canRetry: true },
  'asset-missing': { title: 'Asset missing', actions: ['Relink the missing asset in the project library.', 'Validate the project directory before retrying.'], canRetry: true },
  'cost-exceeded': { title: 'Cost limit reached', actions: ['Review the estimate and project budget.', 'Choose a lower-cost model or explicitly raise the limit.'], canRetry: false },
  unknown: { title: 'HyperFrames issue', actions: ['Open diagnostics for the affected file or timeline item.'], canRetry: true },
}
