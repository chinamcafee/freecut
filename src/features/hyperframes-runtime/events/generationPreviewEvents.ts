import type {
  HyperFramesGenerationImportStrategy,
  HyperFramesSkillImportPreview,
} from '../bridges/skills-bridge'

export const HYPERFRAMES_GENERATION_PREVIEW_EVENT =
  'freecut:hyperframes-generation:preview-ready'

export interface HyperFramesGenerationPreviewRequest {
  preview: HyperFramesSkillImportPreview
  onConfirm: (preview: HyperFramesSkillImportPreview) => Promise<void> | void
  onDiscard?: (preview: HyperFramesSkillImportPreview) => Promise<void> | void
  onStrategyChange?: (
    strategy: HyperFramesGenerationImportStrategy,
    preview: HyperFramesSkillImportPreview,
  ) => Promise<void> | void
}

export function emitHyperFramesGenerationPreview(
  request: HyperFramesGenerationPreviewRequest,
): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent<HyperFramesGenerationPreviewRequest>(
      HYPERFRAMES_GENERATION_PREVIEW_EVENT,
      { detail: request },
    ),
  )
}

export function subscribeHyperFramesGenerationPreview(
  listener: (request: HyperFramesGenerationPreviewRequest) => void,
): () => void {
  if (typeof window === 'undefined') return () => {}

  const handlePreview = (event: Event) => {
    const request = (event as CustomEvent<HyperFramesGenerationPreviewRequest>).detail
    if (request?.preview && typeof request.onConfirm === 'function') listener(request)
  }
  window.addEventListener(HYPERFRAMES_GENERATION_PREVIEW_EVENT, handlePreview)
  return () => window.removeEventListener(HYPERFRAMES_GENERATION_PREVIEW_EVENT, handlePreview)
}
