import { useCallback, useMemo, useRef, useState } from 'react'
import type { RefObject } from 'react'

export interface StudioTimelinePlayer {
  iframeRef: RefObject<HTMLIFrameElement | null>
  isPlaying: boolean
  currentTime: number
  play: () => void
  pause: () => void
  togglePlay: () => void
  seek: (time: number) => void
}

export function useTimelinePlayer(): StudioTimelinePlayer {
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)

  const seek = useCallback((time: number) => {
    const safeTime = Number.isFinite(time) && time > 0 ? time : 0
    setCurrentTime(safeTime)
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'hyperframes:studio:seek', time: safeTime },
      '*',
    )
  }, [])

  const play = useCallback(() => {
    setIsPlaying(true)
    iframeRef.current?.contentWindow?.postMessage({ type: 'hyperframes:studio:play' }, '*')
  }, [])

  const pause = useCallback(() => {
    setIsPlaying(false)
    iframeRef.current?.contentWindow?.postMessage({ type: 'hyperframes:studio:pause' }, '*')
  }, [])

  const togglePlay = useCallback(() => {
    if (isPlaying) pause()
    else play()
  }, [isPlaying, pause, play])

  return useMemo(
    () => ({
      iframeRef,
      isPlaying,
      currentTime,
      play,
      pause,
      togglePlay,
      seek,
    }),
    [currentTime, isPlaying, pause, play, seek, togglePlay],
  )
}
