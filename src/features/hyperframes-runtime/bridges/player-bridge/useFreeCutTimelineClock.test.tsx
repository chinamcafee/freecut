import { act, renderHook, waitFor } from '@testing-library/react'
import { resetPlaybackPreviewState } from '@/shared/state/playback-preview-test-helpers'
import { usePlaybackStore } from '@/shared/state/playback'
import type { HyperFramesPlayerHostHandle } from './HyperFramesPlayerHost'
import {
  freeCutFrameToHyperFramesSeconds,
  hyperFramesSecondsToFreeCutFrame,
  useFreeCutTimelineClock,
} from './useFreeCutTimelineClock'

function createPlayerHandle(): HyperFramesPlayerHostHandle {
  return {
    load: vi.fn(async () => undefined),
    seek: vi.fn(async () => undefined),
    seekFrame: vi.fn(async () => undefined),
    play: vi.fn(async () => undefined),
    pause: vi.fn(async () => undefined),
    setPlaybackRate: vi.fn(),
    setMuted: vi.fn(),
    setVolume: vi.fn(),
    dispose: vi.fn(),
    getCurrentTime: vi.fn(() => 0),
    getDuration: vi.fn(() => 0),
    getPlayerElement: vi.fn(() => null),
    resolveIframe: vi.fn(() => null),
  }
}

describe('useFreeCutTimelineClock', () => {
  afterEach(() => {
    resetPlaybackPreviewState()
    vi.restoreAllMocks()
  })

  it('converts FreeCut frames and HyperFrames seconds with source offsets', () => {
    const mapping = {
      fps: 24,
      timelineStartFrame: 24,
      sourceOffsetFrame: 12,
    }

    expect(freeCutFrameToHyperFramesSeconds(72, mapping)).toBe(2.5)
    expect(hyperFramesSecondsToFreeCutFrame(2.5, mapping)).toBe(72)
  })

  it('keeps first, middle, and tail preview frames within one frame for mixed frame rates', () => {
    const timelineStartFrame = 120
    const sourceOffsetFrame = 48
    const mapping = {
      fps: 30000 / 1001,
      sourceFps: 24000 / 1001,
      timelineStartFrame,
      sourceOffsetFrame,
    }
    const sampleFrames = [
      timelineStartFrame,
      timelineStartFrame + 150,
      timelineStartFrame + 299,
    ]

    for (const frame of sampleFrames) {
      const timeSeconds = freeCutFrameToHyperFramesSeconds(frame, mapping)
      const roundTripFrame = hyperFramesSecondsToFreeCutFrame(timeSeconds, mapping)
      const expectedSourceFrame =
        sourceOffsetFrame + ((frame - timelineStartFrame) / mapping.fps) * mapping.sourceFps

      expect(Math.abs(roundTripFrame - frame)).toBeLessThanOrEqual(1)
      expect(timeSeconds * mapping.sourceFps).toBeCloseTo(expectedSourceFrame, 6)
    }
  })

  it('syncs seek, play, pause, playback rate, mute, and volume from the playback store', async () => {
    resetPlaybackPreviewState(48)
    const player = createPlayerHandle()
    const ref = { current: player }

    const { result } = renderHook(() =>
      useFreeCutTimelineClock(ref, {
        fps: 24,
        timelineStartFrame: 24,
      }),
    )

    await waitFor(() => expect(player.seek).toHaveBeenCalledWith(1))
    expect(player.pause).toHaveBeenCalled()
    expect(player.setPlaybackRate).toHaveBeenCalledWith(1)
    expect(player.setMuted).toHaveBeenCalledWith(false)
    expect(player.setVolume).toHaveBeenCalledWith(1)
    expect(result.current.currentTimeSeconds).toBe(1)

    act(() => {
      usePlaybackStore.getState().setCurrentFrame(72)
    })
    await waitFor(() => expect(player.seek).toHaveBeenCalledWith(2))

    act(() => {
      usePlaybackStore.getState().play()
    })
    await waitFor(() => expect(player.play).toHaveBeenCalled())

    act(() => {
      usePlaybackStore.getState().pause()
    })
    await waitFor(() => expect(player.pause).toHaveBeenCalledTimes(2))

    act(() => {
      usePlaybackStore.getState().setPlaybackRate(1.5)
      usePlaybackStore.getState().setVolume(0.25)
      usePlaybackStore.getState().toggleMute()
    })

    await waitFor(() => expect(player.setPlaybackRate).toHaveBeenCalledWith(1.5))
    expect(player.setVolume).toHaveBeenCalledWith(0.25)
    expect(player.setMuted).toHaveBeenCalledWith(true)
  })

  it('does not seek every playing frame when player drift stays within tolerance', async () => {
    resetPlaybackPreviewState(24)
    const player = createPlayerHandle()
    vi.mocked(player.getCurrentTime).mockReturnValue(1)
    const ref = { current: player }

    renderHook(() =>
      useFreeCutTimelineClock(ref, {
        fps: 24,
        maxPlayingDriftFrames: 1,
      }),
    )
    await waitFor(() => expect(player.seek).toHaveBeenCalledWith(1))
    vi.mocked(player.seek).mockClear()

    act(() => {
      usePlaybackStore.getState().play()
    })
    act(() => {
      usePlaybackStore.getState().setCurrentFrame(25)
    })

    await waitFor(() => expect(player.play).toHaveBeenCalled())
    expect(player.seek).not.toHaveBeenCalled()
  })

  it('stays inert when disabled', () => {
    resetPlaybackPreviewState(48)
    const player = createPlayerHandle()
    const ref = { current: player }

    renderHook(() =>
      useFreeCutTimelineClock(ref, {
        fps: 24,
        enabled: false,
      }),
    )

    expect(player.seek).not.toHaveBeenCalled()
    expect(player.play).not.toHaveBeenCalled()
    expect(player.pause).not.toHaveBeenCalled()
  })
})
