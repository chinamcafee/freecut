import { forwardRef } from 'react'
import type { CSSProperties } from 'react'

export interface StudioPlayerProps {
  projectId?: string
  directUrl?: string
  onLoad?: () => void
  onCompositionLoadingChange?: (loading: boolean) => void
  portrait?: boolean
  suppressLoadingOverlay?: boolean
  style?: CSSProperties
}

function resolvePlayerSrc(projectId: string | undefined, directUrl: string | undefined): string {
  if (directUrl) return directUrl
  if (!projectId) return 'about:blank'
  return `/hyperframes/projects/${encodeURIComponent(projectId)}/preview`
}

export const Player = forwardRef<HTMLIFrameElement, StudioPlayerProps>(function Player(
  {
    projectId,
    directUrl,
    onLoad,
    onCompositionLoadingChange,
    portrait: _portrait,
    suppressLoadingOverlay: _suppressLoadingOverlay,
    style,
  },
  ref,
) {
  const src = resolvePlayerSrc(projectId, directUrl)
  return (
    <iframe
      ref={ref}
      title="HyperFrames Studio preview"
      src={src}
      className="h-full w-full border-0 bg-black"
      sandbox="allow-scripts allow-same-origin"
      style={style}
      onLoad={() => {
        onCompositionLoadingChange?.(false)
        onLoad?.()
      }}
    />
  )
})
