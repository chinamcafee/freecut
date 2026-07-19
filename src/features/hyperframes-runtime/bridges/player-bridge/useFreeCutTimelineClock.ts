import { useEffect, useMemo } from 'react'
import type { RefObject } from 'react'
import { usePlaybackStore } from '@/shared/state/playback'
import type { HyperFramesPlayerHostHandle } from './HyperFramesPlayerHost'

export interface HyperFramesFrameClockMapping {
  /** FreeCut timeline frame rate. */
  fps: number
  /** HyperFrames source composition frame rate. Defaults to the FreeCut timeline fps. */
  sourceFps?: number
  timelineStartFrame?: number
  sourceOffsetFrame?: number
  speed?: number
}

export interface UseFreeCutTimelineClockOptions extends HyperFramesFrameClockMapping {
  enabled?: boolean
  maxPlayingDriftFrames?: number
}

export interface HyperFramesTimelineClockState {
  currentFrame: number
  currentTimeSeconds: number
  isPlaying: boolean
  playbackRate: number
  muted: boolean
  volume: number
}

function safeFps(fps: number | undefined, fallback = 30): number {
  return fps !== undefined && Number.isFinite(fps) && fps > 0 ? fps : fallback
}

function safeSpeed(speed: number | undefined): number {
  return speed !== undefined && Number.isFinite(speed) && speed > 0 ? speed : 1
}

export function freeCutFrameToHyperFramesSeconds(
  frame: number,
  mapping: HyperFramesFrameClockMapping,
): number {
  const timelineFps = safeFps(mapping.fps)
  const sourceFps = safeFps(mapping.sourceFps, timelineFps)
  const timelineStartFrame = mapping.timelineStartFrame ?? 0
  const sourceOffsetFrame = mapping.sourceOffsetFrame ?? 0
  const speed = safeSpeed(mapping.speed)
  const localTimelineFrames = frame - timelineStartFrame
  return sourceOffsetFrame / sourceFps + (localTimelineFrames * speed) / timelineFps
}

export function hyperFramesSecondsToFreeCutFrame(
  timeSeconds: number,
  mapping: HyperFramesFrameClockMapping,
): number {
  const timelineFps = safeFps(mapping.fps)
  const sourceFps = safeFps(mapping.sourceFps, timelineFps)
  const timelineStartFrame = mapping.timelineStartFrame ?? 0
  const sourceOffsetFrame = mapping.sourceOffsetFrame ?? 0
  const speed = safeSpeed(mapping.speed)
  return Math.round(((timeSeconds - sourceOffsetFrame / sourceFps) * timelineFps) / speed + timelineStartFrame)
}

export function useFreeCutTimelineClock(
  playerRef: RefObject<HyperFramesPlayerHostHandle | null>,
  options: UseFreeCutTimelineClockOptions,
): HyperFramesTimelineClockState {
  const enabled = options.enabled ?? true
  const fps = safeFps(options.fps)
  const sourceFps = safeFps(options.sourceFps, fps)
  const timelineStartFrame = options.timelineStartFrame ?? 0
  const sourceOffsetFrame = options.sourceOffsetFrame ?? 0
  const speed = safeSpeed(options.speed)
  const maxPlayingDriftFrames = options.maxPlayingDriftFrames ?? 1

  const currentFrame = usePlaybackStore((state) => state.currentFrame)
  const isPlaying = usePlaybackStore((state) => state.isPlaying)
  const playbackRate = usePlaybackStore((state) => state.playbackRate)
  const muted = usePlaybackStore((state) => state.muted)
  const volume = usePlaybackStore((state) => state.volume)

  const mapping = useMemo(
    () => ({
      fps,
      sourceFps,
      timelineStartFrame,
      sourceOffsetFrame,
      speed,
    }),
    [fps, sourceFps, sourceOffsetFrame, speed, timelineStartFrame],
  )
  const currentTimeSeconds = freeCutFrameToHyperFramesSeconds(currentFrame, mapping)

  useEffect(() => {
    if (!enabled) return
    const player = playerRef.current
    if (!player) return

    const playerFrame = hyperFramesSecondsToFreeCutFrame(player.getCurrentTime(), mapping)
    const driftFrames = Math.abs(playerFrame - currentFrame)
    const shouldSeek = !isPlaying || driftFrames > maxPlayingDriftFrames
    if (shouldSeek) void player.seek(currentTimeSeconds)
  }, [currentFrame, currentTimeSeconds, enabled, isPlaying, mapping, maxPlayingDriftFrames, playerRef])

  useEffect(() => {
    if (!enabled) return
    const player = playerRef.current
    if (!player) return
    if (isPlaying) void player.play()
    else void player.pause()
  }, [enabled, isPlaying, playerRef])

  useEffect(() => {
    if (!enabled) return
    playerRef.current?.setPlaybackRate(playbackRate)
  }, [enabled, playbackRate, playerRef])

  useEffect(() => {
    if (!enabled) return
    playerRef.current?.setMuted(muted)
  }, [enabled, muted, playerRef])

  useEffect(() => {
    if (!enabled) return
    playerRef.current?.setVolume(volume)
  }, [enabled, playerRef, volume])

  return {
    currentFrame,
    currentTimeSeconds,
    isPlaying,
    playbackRate,
    muted,
    volume,
  }
}
