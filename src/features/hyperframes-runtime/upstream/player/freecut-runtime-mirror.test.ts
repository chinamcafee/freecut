import { runtimeProtocolMetadata } from '../core/runtime/protocol.js'
import { changeAppLanguage } from '@/i18n'
import { CompositionProbe, readCompositionSizeFromDocument } from './composition-probe.js'
import { createControls } from './controls.js'
import { DirectTimelineClock } from './direct-timeline-clock.js'
import {
  createCompositionIframe,
  scaleIframeToFit,
} from './iframe-dom.js'
import { ParentMediaManager } from './parent-media.js'
import { handleRuntimeMessage, type MessageHandlerCallbacks } from './runtime-message-handler.js'
import { SlideshowController, type PlayerPort } from './slideshow/SlideshowController.js'
import { HyperframesPlayer } from './hyperframes-player.js'

function mockMediaElementMethods(): void {
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined)
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined)
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
}

function createParentMediaManager(overrides: Partial<ConstructorParameters<typeof ParentMediaManager>[0]> = {}) {
  return new ParentMediaManager({
    dispatchEvent: vi.fn(),
    getMuted: () => false,
    getVolume: () => 0.75,
    getPlaybackRate: () => 1,
    getCurrentTime: () => 1.5,
    isPaused: () => false,
    ...overrides,
  })
}

describe('HyperFrames player runtime mirror', () => {
  afterEach(async () => {
    await changeAppLanguage('en')
    document.body.innerHTML = ''
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('keeps imperative player controls synchronized with the FreeCut language', async () => {
    const parent = document.createElement('div')
    document.body.appendChild(parent)
    const controls = createControls(parent, {
      onPlay: vi.fn(),
      onPause: vi.fn(),
      onSeek: vi.fn(),
      onSpeedChange: vi.fn(),
      onMuteToggle: vi.fn(),
      onVolumeChange: vi.fn(),
    })

    await changeAppLanguage('zh')
    expect(parent.querySelector('.hfp-play-btn')).toHaveAttribute('aria-label', '播放')
    expect(parent.querySelector('.hfp-speed-btn')).toHaveAttribute('aria-label', '播放速度')
    expect(parent.querySelector('.hfp-mute-btn')).toHaveAttribute('aria-label', '静音')

    controls.updatePlaying(true)
    expect(parent.querySelector('.hfp-play-btn')).toHaveAttribute('aria-label', '暂停')

    await changeAppLanguage('de')
    expect(parent.querySelector('.hfp-play-btn')).toHaveAttribute('aria-label', 'Pause')
    expect(parent.querySelector('.hfp-speed-btn')).toHaveAttribute('aria-label', 'Playback speed')
    controls.destroy()
  })

  it('registers the mirrored web component and creates the composition iframe shell', () => {
    const element = document.createElement('hyperframes-player') as InstanceType<
      typeof HyperframesPlayer
    >
    const { container, iframe } = createCompositionIframe()

    Object.defineProperty(element, 'offsetWidth', { configurable: true, value: 960 })
    Object.defineProperty(element, 'offsetHeight', { configurable: true, value: 540 })

    expect(customElements.get('hyperframes-player')).toBe(HyperframesPlayer)
    expect(element.iframeElement).toBeInstanceOf(HTMLIFrameElement)
    expect(element.iframeElement.referrerPolicy).toBe('no-referrer')
    expect(container).toContainElement(iframe)
    expect(iframe.getAttribute('sandbox')).toContain('allow-scripts')
    expect(iframe.getAttribute('sandbox')).not.toContain('allow-top-navigation')
    expect(iframe.getAttribute('sandbox')).not.toContain('allow-popups')
    expect(scaleIframeToFit(element, iframe, 1920, 1080)).toBe(true)
    expect(iframe.style.transform).toContain('scale(0.5)')
  })

  it('exposes composition probing helpers without loading an external package', () => {
    const doc = document.implementation.createHTMLDocument('composition')
    doc.body.innerHTML = '<main data-composition-id="main" data-width="1280" data-height="720"></main>'
    const iframe = document.createElement('iframe')
    const probe = new CompositionProbe(iframe, {
      onReady: vi.fn(),
      onError: vi.fn(),
    })
    const timeline = {
      duration: () => 4,
      time: () => 1,
      seek: vi.fn(),
      play: vi.fn(),
      pause: vi.fn(),
    }

    expect(readCompositionSizeFromDocument(doc)).toEqual({ width: 1280, height: 720 })
    expect(probe.hasRuntimeBridge({ __hf: {} } as unknown as Window)).toBe(true)
    expect(
      probe.resolveDirectTimelineAdapterFromWindow({
        __timelines: {
          main: timeline,
        },
      } as unknown as Window),
    ).toBe(timeline)
  })

  it('drives direct timeline playback through the mirrored clock', () => {
    const rafCallbacks: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      rafCallbacks.push(callback)
      return rafCallbacks.length
    })
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    vi.spyOn(performance, 'now').mockReturnValue(150)

    let timelineTime = 0.5
    const timeline = {
      duration: () => 1,
      time: () => timelineTime,
      seek: vi.fn(),
      play: vi.fn(),
      pause: vi.fn(),
    }
    const callbacks = {
      onTimeUpdate: vi.fn(),
      onEnded: vi.fn(() => false),
      getLoop: vi.fn(() => false),
      restart: vi.fn(),
      onPaused: vi.fn(),
    }
    const clock = new DirectTimelineClock(callbacks)

    clock.start(timeline, () => timelineTime, () => 1, () => false)
    rafCallbacks.shift()?.(150)
    timelineTime = 1
    vi.spyOn(performance, 'now').mockReturnValue(300)
    rafCallbacks.shift()?.(300)

    expect(callbacks.onTimeUpdate).toHaveBeenCalledWith(0.5, 1)
    expect(callbacks.onTimeUpdate).toHaveBeenCalledWith(1, 1)
    expect(timeline.pause).toHaveBeenCalled()
    expect(callbacks.onPaused).toHaveBeenCalled()
  })

  it('mirrors iframe media into parent-owned proxies', () => {
    mockMediaElementMethods()
    const doc = document.implementation.createHTMLDocument('media')
    doc.head.innerHTML = '<base href="https://assets.example/project/">'
    doc.body.innerHTML = `
      <section data-composition-id="main">
        <audio src="clip.mp3" data-start="1" data-duration="2"></audio>
      </section>`
    const manager = createParentMediaManager()

    manager.setupFromIframe(doc)
    manager.promoteToParentProxy(doc)

    expect(manager.entries).toHaveLength(1)
    expect(manager.entries[0]).toMatchObject({
      start: 1,
      duration: 2,
    })
    expect(manager.entries[0]?.el.src).toBe('https://assets.example/project/clip.mp3')
    expect(manager.audioOwner).toBe('parent')
    expect(doc.querySelector('audio')?.muted).toBe(true)
  })

  it('routes runtime messages into player callbacks using the local protocol mirror', () => {
    const manager = createParentMediaManager()
    const setPlaybackState = vi.fn()
    const updateControlsTime = vi.fn()
    const onRuntimeReady = vi.fn()
    const onRuntimeTimelineReady = vi.fn()
    const setCompositionSize = vi.fn()
    const setScenes = vi.fn()
    const callbacks: MessageHandlerCallbacks = {
      getPlaybackState: () => ({
        currentTime: 0,
        duration: 0,
        paused: true,
        lastUpdateMs: 0,
      }),
      setPlaybackState,
      getShaderLoadingMode: () => 'player',
      shaderLoader: { update: vi.fn() } as unknown as MessageHandlerCallbacks['shaderLoader'],
      setCompositionSize,
      sendControl: vi.fn(),
      getIframeDoc: () => null,
      onRuntimeReady,
      onRuntimeTimelineReady,
      setScenes,
      updateControlsTime,
      updateControlsPlaying: vi.fn(),
      dispatchEvent: vi.fn(),
      seek: vi.fn(),
      play: vi.fn(),
      getLoop: () => false,
      media: manager,
    }
    const source = window

    handleRuntimeMessage(
      new MessageEvent('message', {
        source,
        data: {
          source: 'hf-preview',
          type: 'ready',
          ...runtimeProtocolMetadata(24),
        },
      }),
      source,
      callbacks,
    )
    handleRuntimeMessage(
      new MessageEvent('message', {
        source,
        data: {
          source: 'hf-preview',
          type: 'timeline',
          durationInFrames: 96,
          compositionWidth: 640,
          compositionHeight: 360,
          scenes: [{ id: 'intro', start: 0, duration: 2 }],
          ...runtimeProtocolMetadata(24),
        },
      }),
      source,
      callbacks,
    )

    expect(onRuntimeReady).toHaveBeenCalled()
    expect(onRuntimeTimelineReady).toHaveBeenCalledWith(4)
    expect(updateControlsTime).toHaveBeenCalledWith(0, 4)
    expect(setCompositionSize).toHaveBeenCalledWith(640, 360)
    expect(setScenes).toHaveBeenCalledWith([{ id: 'intro', start: 0, duration: 2 }])
    expect(setPlaybackState).toHaveBeenCalledWith(
      expect.objectContaining({
        duration: 4,
      }),
    )

    const acceptedCallCount = setPlaybackState.mock.calls.length
    handleRuntimeMessage(
      new MessageEvent('message', {
        source,
        data: {
          source: 'hf-preview',
          type: 'timeline',
          projectId: 'project-1',
          compositionPath: 'compositions/main.html',
          nonce: 'wrong',
          durationInFrames: 48,
          compositionWidth: 320,
          compositionHeight: 180,
          scenes: [],
          ...runtimeProtocolMetadata(24),
        },
      }),
      source,
      callbacks,
      {
        projectId: 'project-1',
        compositionPath: 'compositions/main.html',
        sessionNonce: 'nonce-123',
      },
    )
    expect(setPlaybackState).toHaveBeenCalledTimes(acceptedCallCount)
  })

  it('keeps the slideshow controller compilable against the mirrored parser types', () => {
    const port: PlayerPort = {
      seek: vi.fn(),
      play: vi.fn(),
      pause: vi.fn(),
      currentTime: 0,
      onTimeUpdate: vi.fn(() => vi.fn()),
    }
    const controller = new SlideshowController(port, {
      slides: [
        {
          sceneId: 'scene-1',
          start: 0,
          end: 10,
          fragments: [],
          hotspots: [],
        },
      ],
      sequences: {},
    })

    expect(port.seek).toHaveBeenCalledWith(5)
    expect(controller.counter).toEqual({ index: 1, total: 1 })
  })
})
