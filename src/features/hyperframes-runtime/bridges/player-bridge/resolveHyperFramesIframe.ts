export interface HyperFramesIframeOwner extends HTMLElement {
  iframeElement?: HTMLIFrameElement | null
}

export function resolveHyperFramesIframe(owner: Element | null | undefined): HTMLIFrameElement | null {
  if (!owner) return null
  if (owner instanceof HTMLIFrameElement) return owner

  const iframeElement = (owner as HyperFramesIframeOwner).iframeElement
  if (iframeElement instanceof HTMLIFrameElement) return iframeElement

  if (owner.shadowRoot) {
    const shadowIframe = owner.shadowRoot.querySelector('iframe')
    if (shadowIframe instanceof HTMLIFrameElement) return shadowIframe
  }

  const nestedIframe = owner.querySelector('iframe')
  return nestedIframe instanceof HTMLIFrameElement ? nestedIframe : null
}
