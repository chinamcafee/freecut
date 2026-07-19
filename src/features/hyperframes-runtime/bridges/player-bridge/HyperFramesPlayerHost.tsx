import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type CSSProperties,
  type ReactNode,
} from 'react'
import type { HyperFramesDiagnostic } from '@/types/hyperframes'
import type { HyperFramesPreviewDocument } from '../../adapters/freecut-preview'
import '../../upstream/player/hyperframes-player.js'
import type { HyperframesPlayer } from '../../upstream/player/hyperframes-player.js'
import { mapPlayerErrorToDiagnostic } from './playerDiagnostics'
import { resolveHyperFramesIframe } from './resolveHyperFramesIframe'
import {
  isHyperFramesRuntimeMessageCandidate,
  validateHyperFramesRuntimeMessage,
  type HyperFramesRuntimeMessageEvent,
  type HyperFramesRuntimeMessageRejectedEvent,
  type HyperFramesRuntimeMessageType,
} from './runtimeMessageProtocol'

export type HyperFramesPlaybackState = 'playing' | 'paused'
export type HyperFramesPlayerElement = InstanceType<typeof HyperframesPlayer> & HTMLElement

export interface HyperFramesPlayerReadyEvent {
  projectId?: string
  compositionPath?: string
  duration: number
}

export interface HyperFramesPlayerTimeUpdateEvent {
  projectId?: string
  compositionPath?: string
  currentTime: number
}

export interface HyperFramesPlayerDurationEvent {
  projectId?: string
  compositionPath?: string
  duration: number
}

export interface HyperFramesPlayerSelectionEvent {
  projectId?: string
  compositionPath?: string
  detail: unknown
}

export interface HyperFramesPlayerHostProps {
  previewDocument?: HyperFramesPreviewDocument | null
  srcdoc?: string | null
  projectId?: string
  compositionPath?: string
  currentFrame?: number | null
  fps?: number
  playbackState?: HyperFramesPlaybackState
  controls?: boolean
  muted?: boolean
  volume?: number
  playbackRate?: number
  sessionNonce?: string
  sandboxToken?: string
  expectedOrigin?: string | readonly string[]
  allowedRuntimeMessageTypes?: readonly HyperFramesRuntimeMessageType[]
  className?: string
  style?: CSSProperties
  children?: ReactNode
  onReady?: (event: HyperFramesPlayerReadyEvent) => void
  onTimeUpdate?: (event: HyperFramesPlayerTimeUpdateEvent) => void
  onDuration?: (event: HyperFramesPlayerDurationEvent) => void
  onError?: (diagnostic: HyperFramesDiagnostic) => void
  onSelection?: (event: HyperFramesPlayerSelectionEvent) => void
  onRuntimeMessage?: (event: HyperFramesRuntimeMessageEvent) => void
  onRuntimeMessageRejected?: (event: HyperFramesRuntimeMessageRejectedEvent) => void
}

export interface HyperFramesPlayerHostHandle {
  load(srcdoc: string | HyperFramesPreviewDocument): Promise<void>
  seek(timeSeconds: number): Promise<void>
  seekFrame(frame: number, fps?: number): Promise<void>
  play(): Promise<void>
  pause(): Promise<void>
  setPlaybackRate(rate: number): void
  setMuted(muted: boolean): void
  setVolume(volume: number): void
  dispose(): void
  getCurrentTime(): number
  getDuration(): number
  getPlayerElement(): HyperFramesPlayerElement | null
  resolveIframe(): HTMLIFrameElement | null
}

function setBooleanAttribute(element: HTMLElement, name: string, enabled: boolean): void {
  if (enabled) element.setAttribute(name, '')
  else element.removeAttribute(name)
}

function readDuration(event: Event): number {
  const detail = event instanceof CustomEvent ? event.detail : null
  if (typeof detail === 'object' && detail !== null && 'duration' in detail) {
    const value = Number((detail as { duration?: unknown }).duration)
    return Number.isFinite(value) ? value : 0
  }
  return 0
}

function readCurrentTime(event: Event): number {
  const detail = event instanceof CustomEvent ? event.detail : null
  if (typeof detail === 'object' && detail !== null && 'currentTime' in detail) {
    const value = Number((detail as { currentTime?: unknown }).currentTime)
    return Number.isFinite(value) ? value : 0
  }
  return 0
}

function normalizeVolume(value: number | undefined): string | null {
  if (value === undefined) return null
  if (!Number.isFinite(value)) return null
  return String(Math.max(0, Math.min(1, value)))
}

function normalizePlaybackRate(value: number | undefined): string | null {
  if (value === undefined) return null
  if (!Number.isFinite(value) || value <= 0) return null
  return String(value)
}

export const HyperFramesPlayerHost = forwardRef<
  HyperFramesPlayerHostHandle,
  HyperFramesPlayerHostProps
>(function HyperFramesPlayerHost(
  {
    previewDocument,
    srcdoc,
    projectId,
    compositionPath,
    currentFrame,
    fps = 30,
    playbackState,
    controls = false,
    muted = false,
    volume = 1,
    playbackRate = 1,
    sessionNonce,
    sandboxToken,
    expectedOrigin,
    allowedRuntimeMessageTypes,
    className,
    style,
    children,
    onReady,
    onTimeUpdate,
    onDuration,
    onError,
    onSelection,
    onRuntimeMessage,
    onRuntimeMessageRejected,
  },
  ref,
) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const playerRef = useRef<HyperFramesPlayerElement | null>(null)
  const effectiveProjectId = projectId ?? previewDocument?.projectId
  const effectiveCompositionPath = compositionPath ?? previewDocument?.compositionPath
  const effectiveSessionNonce = sessionNonce ?? previewDocument?.sessionNonce
  const effectiveSandboxToken = sandboxToken ?? previewDocument?.sandboxToken

  useEffect(() => {
    const container = containerRef.current
    if (!container || playerRef.current) return

    const player = document.createElement('hyperframes-player') as HyperFramesPlayerElement
    player.style.display = 'block'
    player.style.width = '100%'
    player.style.height = '100%'
    player.setAttribute('data-freecut-hyperframes-player', 'true')
    container.appendChild(player)
    playerRef.current = player

    return () => {
      try {
        player.pause()
      } catch {
        /* disconnected player */
      }
      player.remove()
      if (playerRef.current === player) playerRef.current = null
    }
  }, [])

  useEffect(() => {
    const player = playerRef.current
    if (!player) return
    const nextSrcdoc = previewDocument?.srcdoc ?? srcdoc ?? null
    if (nextSrcdoc === null) {
      player.removeAttribute('srcdoc')
      return
    }
    if (player.getAttribute('srcdoc') !== nextSrcdoc) player.setAttribute('srcdoc', nextSrcdoc)
  }, [previewDocument, srcdoc])

  useEffect(() => {
    const player = playerRef.current
    if (!player) return
    if (effectiveProjectId) player.dataset.projectId = effectiveProjectId
    else delete player.dataset.projectId
    if (effectiveCompositionPath) player.dataset.compositionPath = effectiveCompositionPath
    else delete player.dataset.compositionPath
    if (effectiveSessionNonce) player.dataset.sessionNonce = effectiveSessionNonce
    else delete player.dataset.sessionNonce
    if (effectiveSandboxToken) player.dataset.sandboxToken = effectiveSandboxToken
    else delete player.dataset.sandboxToken
  }, [effectiveCompositionPath, effectiveProjectId, effectiveSandboxToken, effectiveSessionNonce])

  useEffect(() => {
    const player = playerRef.current
    if (!player) return
    setBooleanAttribute(player, 'controls', controls)
  }, [controls])

  useEffect(() => {
    const player = playerRef.current
    if (!player) return
    setBooleanAttribute(player, 'muted', muted)
  }, [muted])

  useEffect(() => {
    const player = playerRef.current
    if (!player) return
    const normalized = normalizeVolume(volume)
    if (normalized === null) player.removeAttribute('volume')
    else player.setAttribute('volume', normalized)
  }, [volume])

  useEffect(() => {
    const player = playerRef.current
    if (!player) return
    const normalized = normalizePlaybackRate(playbackRate)
    if (normalized === null) player.removeAttribute('playback-rate')
    else player.setAttribute('playback-rate', normalized)
  }, [playbackRate])

  useEffect(() => {
    const player = playerRef.current
    if (!player || currentFrame === null || currentFrame === undefined) return
    const safeFps = Number.isFinite(fps) && fps > 0 ? fps : 30
    void player.seek(currentFrame / safeFps)
  }, [currentFrame, fps])

  useEffect(() => {
    const player = playerRef.current
    if (!player || !playbackState) return
    if (playbackState === 'playing') void player.play()
    else player.pause()
  }, [playbackState])

  useEffect(() => {
    const player = playerRef.current
    if (!player) return

    const handleReady = (event: Event) => {
      const duration = readDuration(event)
      onReady?.({ projectId: effectiveProjectId, compositionPath: effectiveCompositionPath, duration })
      onDuration?.({ projectId: effectiveProjectId, compositionPath: effectiveCompositionPath, duration })
    }
    const handleTimeUpdate = (event: Event) => {
      onTimeUpdate?.({
        projectId: effectiveProjectId,
        compositionPath: effectiveCompositionPath,
        currentTime: readCurrentTime(event),
      })
    }
    const handleDurationChange = (event: Event) => {
      onDuration?.({
        projectId: effectiveProjectId,
        compositionPath: effectiveCompositionPath,
        duration: readDuration(event),
      })
    }
    const handleError = (event: Event) => {
      onError?.(
        mapPlayerErrorToDiagnostic(event, {
          projectId: effectiveProjectId,
          compositionPath: effectiveCompositionPath,
        }),
      )
    }
    const handleSelection = (event: Event) => {
      onSelection?.({
        projectId: effectiveProjectId,
        compositionPath: effectiveCompositionPath,
        detail: event instanceof CustomEvent ? event.detail : null,
      })
    }

    player.addEventListener('ready', handleReady)
    player.addEventListener('timeupdate', handleTimeUpdate)
    player.addEventListener('durationchange', handleDurationChange)
    player.addEventListener('error', handleError)
    player.addEventListener('selectionchange', handleSelection)

    return () => {
      player.removeEventListener('ready', handleReady)
      player.removeEventListener('timeupdate', handleTimeUpdate)
      player.removeEventListener('durationchange', handleDurationChange)
      player.removeEventListener('error', handleError)
      player.removeEventListener('selectionchange', handleSelection)
    }
  }, [
    effectiveCompositionPath,
    effectiveProjectId,
    onDuration,
    onError,
    onReady,
    onSelection,
    onTimeUpdate,
  ])

  useEffect(() => {
    if (!effectiveSessionNonce) return

    const handleMessage = (event: MessageEvent<unknown>) => {
      if (!isHyperFramesRuntimeMessageCandidate(event.data)) return
      const iframe = resolveHyperFramesIframe(playerRef.current)
      const result = validateHyperFramesRuntimeMessage(event, {
        sessionNonce: effectiveSessionNonce,
        projectId: effectiveProjectId,
        compositionPath: effectiveCompositionPath,
        sandboxToken: effectiveSandboxToken,
        expectedOrigin,
        sourceWindow: iframe?.contentWindow ?? null,
        allowedTypes: allowedRuntimeMessageTypes,
      })

      if (result.ok) {
        onRuntimeMessage?.({ message: result.message, nativeEvent: event })
        return
      }
      onRuntimeMessageRejected?.({ reason: result.reason, nativeEvent: event })
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [
    allowedRuntimeMessageTypes,
    effectiveCompositionPath,
    effectiveProjectId,
    effectiveSandboxToken,
    effectiveSessionNonce,
    expectedOrigin,
    onRuntimeMessage,
    onRuntimeMessageRejected,
  ])

  useImperativeHandle(
    ref,
    () => ({
      async load(next) {
        const player = playerRef.current
        if (!player) return
        const nextSrcdoc = typeof next === 'string' ? next : next.srcdoc
        player.setAttribute('srcdoc', nextSrcdoc)
      },
      async seek(timeSeconds) {
        playerRef.current?.seek(timeSeconds)
      },
      async seekFrame(frame, nextFps = fps) {
        const safeFps = Number.isFinite(nextFps) && nextFps > 0 ? nextFps : 30
        playerRef.current?.seek(frame / safeFps)
      },
      async play() {
        playerRef.current?.play()
      },
      async pause() {
        playerRef.current?.pause()
      },
      setPlaybackRate(rate) {
        const player = playerRef.current
        if (!player) return
        const normalized = normalizePlaybackRate(rate)
        if (normalized === null) player.removeAttribute('playback-rate')
        else player.setAttribute('playback-rate', normalized)
      },
      setMuted(nextMuted) {
        const player = playerRef.current
        if (!player) return
        setBooleanAttribute(player, 'muted', nextMuted)
      },
      setVolume(nextVolume) {
        const player = playerRef.current
        if (!player) return
        const normalized = normalizeVolume(nextVolume)
        if (normalized === null) player.removeAttribute('volume')
        else player.setAttribute('volume', normalized)
      },
      dispose() {
        const player = playerRef.current
        if (!player) return
        player.pause()
        player.remove()
        playerRef.current = null
      },
      getCurrentTime() {
        return playerRef.current?.currentTime ?? 0
      },
      getDuration() {
        return playerRef.current?.duration ?? 0
      },
      getPlayerElement() {
        return playerRef.current
      },
      resolveIframe() {
        return resolveHyperFramesIframe(playerRef.current)
      },
    }),
    [fps],
  )

  return (
    <div
      ref={containerRef}
      className={className}
      style={style}
      data-freecut-hyperframes-player-host="true"
    >
      {children}
    </div>
  )
})
