export const HYPERFRAMES_PROJECT_UPDATED_EVENT = 'freecut:hyperframes-project:updated'

export interface HyperFramesProjectUpdatedDetail {
  projectId: string
}

export function emitHyperFramesProjectUpdated(projectId: string): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent<HyperFramesProjectUpdatedDetail>(HYPERFRAMES_PROJECT_UPDATED_EVENT, {
      detail: { projectId },
    }),
  )
}

export function subscribeHyperFramesProjectUpdated(
  listener: (projectId: string) => void,
): () => void {
  if (typeof window === 'undefined') return () => {}

  const handleUpdated = (event: Event) => {
    const projectId = (event as CustomEvent<HyperFramesProjectUpdatedDetail>).detail?.projectId
    if (projectId) listener(projectId)
  }
  window.addEventListener(HYPERFRAMES_PROJECT_UPDATED_EVENT, handleUpdated)
  return () => window.removeEventListener(HYPERFRAMES_PROJECT_UPDATED_EVENT, handleUpdated)
}
