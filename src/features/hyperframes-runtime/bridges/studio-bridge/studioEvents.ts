import type { FreeCutStudioOpenRequest } from './types'

export const FREECUT_STUDIO_OPEN_EVENT = 'freecut:hyperframes-studio:open'

type FreeCutStudioOpenListener = (request: FreeCutStudioOpenRequest) => void

export function emitFreeCutStudioOpenRequest(request: FreeCutStudioOpenRequest): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent<FreeCutStudioOpenRequest>(FREECUT_STUDIO_OPEN_EVENT, {
      detail: request,
    }),
  )
}

export function subscribeFreeCutStudioOpenRequests(
  listener: FreeCutStudioOpenListener,
): () => void {
  if (typeof window === 'undefined') return () => {}

  const handleOpen = (event: Event) => {
    const detail = (event as CustomEvent<FreeCutStudioOpenRequest>).detail
    if (!detail?.item) return
    listener(detail)
  }

  window.addEventListener(FREECUT_STUDIO_OPEN_EVENT, handleOpen)
  return () => window.removeEventListener(FREECUT_STUDIO_OPEN_EVENT, handleOpen)
}

export function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tagName = target.tagName.toLowerCase()
  return (
    tagName === 'input' ||
    tagName === 'textarea' ||
    tagName === 'select' ||
    target.isContentEditable
  )
}
