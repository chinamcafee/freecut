import type { CompositionVariable } from './core.types.js'
import { applyVariableBindings } from './runtime/applyVariableBindings.js'
import { TransportClock } from './runtime/clock.js'
import { getVariables, injectCompositionCssVariables } from './runtime/getVariables.js'
import { refreshRuntimeMediaCache, syncRuntimeMedia } from './runtime/media.js'
import { validateVariables } from './runtime/validateVariables.js'

type RuntimeTestWindow = Window & {
  __hfVariables?: Record<string, unknown>
  __hfVariablesByComp?: Record<string, Record<string, unknown>>
  __hyperframes?: { getVariables?: () => Record<string, unknown> }
}

function cleanupRuntimeGlobals(): void {
  const win = window as RuntimeTestWindow
  Reflect.deleteProperty(win, '__hfVariables')
  Reflect.deleteProperty(win, '__hfVariablesByComp')
  Reflect.deleteProperty(win, '__hyperframes')
  document.documentElement.removeAttribute('data-composition-variables')
  document.body.innerHTML = ''
}

describe('HyperFrames core runtime mirror', () => {
  afterEach(() => {
    cleanupRuntimeGlobals()
  })

  it('reads declared variables, applies CSS variables and binds variable-driven DOM values', () => {
    document.documentElement.setAttribute(
      'data-composition-variables',
      JSON.stringify([
        { id: 'title', type: 'string', label: 'Title', default: 'Default title' },
        { id: 'accent', type: 'color', label: 'Accent', default: '#000000' },
        { id: 'logo', type: 'image', label: 'Logo', default: 'fallback.png' },
      ]),
    )
    document.body.innerHTML = `
      <section data-composition-id="main">
        <h1 data-var-text="title">Fallback</h1>
        <img data-var-src="logo" src="fallback.png" />
      </section>`

    const win = window as RuntimeTestWindow
    win.__hfVariables = {
      title: 'Runtime title',
      accent: '#ff0000',
      logo: { url: 'assets/logo.png' },
    }
    win.__hyperframes = { getVariables }

    expect(getVariables()).toMatchObject({
      title: 'Runtime title',
      accent: '#ff0000',
      logo: { url: 'assets/logo.png' },
    })

    injectCompositionCssVariables(document)
    applyVariableBindings(document)

    const root = document.querySelector('section')
    expect(document.querySelector('h1')?.textContent).toBe('Runtime title')
    expect(document.querySelector('img')?.getAttribute('src')).toBe('assets/logo.png')
    expect(document.documentElement.style.getPropertyValue('--accent')).toBe('#ff0000')
    expect((root as HTMLElement | null)?.style.getPropertyValue('--accent')).toBe('#ff0000')
  })

  it('validates variable values against the mirrored core type contract', () => {
    const declarations: CompositionVariable[] = [
      {
        id: 'count',
        type: 'number',
        label: 'Count',
        default: 1,
      },
      {
        id: 'mode',
        type: 'enum',
        label: 'Mode',
        default: 'light',
        options: [{ value: 'light', label: 'Light' }],
      },
    ]

    expect(validateVariables({ count: '2', missing: true, mode: 'dark' }, declarations)).toEqual([
      {
        kind: 'type-mismatch',
        variableId: 'count',
        expected: 'number',
        actual: 'string',
      },
      { kind: 'undeclared', variableId: 'missing' },
      { kind: 'enum-out-of-range', variableId: 'mode', allowed: ['light'], actual: 'dark' },
    ])
  })

  it('keeps the transport clock deterministic for play, rate changes and duration clamps', () => {
    let nowMs = 0
    const clock = new TransportClock({
      initialTime: 1,
      duration: 10,
      nowMs: () => nowMs,
    })

    expect(clock.snapshot()).toMatchObject({ time: 1, playing: false, source: 'monotonic' })
    expect(clock.play()).toBe(true)

    nowMs = 2_000
    expect(clock.now()).toBe(3)

    clock.setRate(2)
    nowMs = 3_000
    expect(clock.now()).toBe(5)

    clock.seek(9)
    nowMs = 4_000
    expect(clock.now()).toBe(10)
    expect(clock.reachedEnd()).toBe(true)
  })

  it('discovers timed media and synchronizes active media state', () => {
    document.body.innerHTML = `
      <video data-start="2" data-duration="4" data-volume="0.6" data-playback-start="0"></video>`
    const video = document.querySelector('video')
    expect(video).toBeInstanceOf(HTMLVideoElement)
    Object.defineProperty(video, 'duration', { value: 8, configurable: true })

    const cache = refreshRuntimeMediaCache()
    expect(cache.mediaClips).toHaveLength(1)
    expect(cache.maxMediaEnd).toBe(6)
    expect(cache.mediaClips[0]).toMatchObject({
      start: 2,
      duration: 4,
      end: 6,
      mediaStart: 0,
    })

    syncRuntimeMedia({
      clips: cache.mediaClips,
      timeSeconds: 3,
      playing: false,
      playbackRate: 1,
      userVolume: 0.5,
      outputMuted: true,
    })

    expect(video?.currentTime).toBeCloseTo(1)
    expect(video?.volume).toBeCloseTo(0.5)
    expect(video?.muted).toBe(true)
    expect(video?.preload).toBe('auto')
  })
})
