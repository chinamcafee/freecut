import type { CompositionVariable } from '../../upstream/core/core.types.js'
import {
  DEFAULT_HYPERFRAMES_RUNTIME_BOOTSTRAP_SRC,
  createHyperFramesCoreRuntimeAdapter,
  type HyperFramesRuntimeControlBridgeDeps,
} from './runtime-adapter'

type RuntimeTestWindow = Window & {
  __hfVariables?: Record<string, unknown>
  __hfVariablesByComp?: Record<string, Record<string, unknown>>
  __hyperframes?: Record<string, unknown>
  __timelines?: Record<string, unknown>
  __HF_PREVIEW_SESSION__?: {
    projectId?: string
    compositionPath?: string
    nonce?: string
    sandboxToken?: string
  }
  __HF_EXPORT_RENDER_SEEK_CONFIG?: unknown
}

function cleanupRuntimeGlobals(): void {
  const win = window as RuntimeTestWindow
  Reflect.deleteProperty(win, '__hfVariables')
  Reflect.deleteProperty(win, '__hfVariablesByComp')
  Reflect.deleteProperty(win, '__hyperframes')
  Reflect.deleteProperty(win, '__timelines')
  Reflect.deleteProperty(win, '__HF_PREVIEW_SESSION__')
  Reflect.deleteProperty(win, '__HF_EXPORT_RENDER_SEEK_CONFIG')
  document.documentElement.removeAttribute('data-composition-variables')
  document.body.innerHTML = ''
  vi.restoreAllMocks()
}

describe('HyperFrames core runtime adapter', () => {
  const adapter = createHyperFramesCoreRuntimeAdapter()

  afterEach(() => {
    cleanupRuntimeGlobals()
  })

  it('installs runtime globals and applies mirrored variable bindings', () => {
    document.documentElement.setAttribute(
      'data-composition-variables',
      JSON.stringify([
        { id: 'title', type: 'string', label: 'Title', default: 'Fallback' },
        { id: 'logo', type: 'image', label: 'Logo', default: 'fallback.png' },
      ]),
    )
    document.body.innerHTML = `
      <main data-composition-id="main">
        <h1 data-var-text="title">Fallback</h1>
        <img data-var-src="logo" src="fallback.png" />
      </main>`

    adapter.installGlobals({
      fps: 24,
      variables: {
        title: 'Adapter title',
        logo: { url: 'assets/logo.png' },
      },
    })
    adapter.applyVariables(document)

    const win = window as RuntimeTestWindow
    expect(win.__timelines).toEqual({})
    expect(win.__HF_EXPORT_RENDER_SEEK_CONFIG).toMatchObject({ fps: 24 })
    expect(document.querySelector('h1')?.textContent).toBe('Adapter title')
    expect(document.querySelector('img')?.getAttribute('src')).toBe('assets/logo.png')
  })

  it('maps variable validation failures to FreeCut runtime diagnostics', () => {
    const declarations: CompositionVariable[] = [
      {
        id: 'count',
        type: 'number',
        label: 'Count',
        default: 1,
      },
    ]

    const result = adapter.validateVariables(
      { count: 'wrong' },
      declarations,
      { stage: 'export', file: 'compositions/main.html' },
    )

    expect(result.ok).toBe(false)
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        code: 'hyperframes.runtime.variable.type-mismatch',
        source: 'runtime',
        stage: 'export',
        severity: 'blocking',
        file: 'compositions/main.html',
        message: 'Variable "count" expected number, got string.',
      }),
    ])
  })

  it('creates a controlled runtime injection plan and inserts it before head close', () => {
    const injected = adapter.injectIntoHtml(
      '<!doctype html><html><head><title>x</title></head><body></body></html>',
      {
        bootstrapSrc: '/assets/hyperframes-runtime.js',
        nonce: 'nonce-123',
        fps: 29.97,
        variables: {
          title: '</script><img src=x>',
        },
      },
    )

    expect(injected.indexOf('data-hf-runtime-config="true"')).toBeLessThan(
      injected.indexOf('</head>'),
    )
    expect(injected).toContain('src="/assets/hyperframes-runtime.js"')
    expect(injected).toContain('nonce="nonce-123"')
    expect(injected).toContain('\\u003c/script\\u003e\\u003cimg src=x\\u003e')

    const defaultPlan = adapter.createInjectionPlan()
    expect(defaultPlan.bootstrapSrc).toBe(DEFAULT_HYPERFRAMES_RUNTIME_BOOTSTRAP_SRC)
    expect(defaultPlan.protocol.fps).toEqual({ numerator: 30, denominator: 1 })
  })

  it('installs the runtime control bridge with the mirrored protocol handlers', () => {
    const postSpy = vi.spyOn(window.parent, 'postMessage').mockImplementation(() => undefined)
    const deps: HyperFramesRuntimeControlBridgeDeps = {
      onPlay: vi.fn(),
      onPause: vi.fn(),
      onStopMedia: vi.fn(),
      onSeek: vi.fn(),
      onTick: vi.fn(),
      onSetMuted: vi.fn(),
      onSetVolume: vi.fn(),
      onSetMediaOutputMuted: vi.fn(),
      onSetNativeMediaSyncDisabled: vi.fn(),
      onSetWebAudioMediaDisabled: vi.fn(),
      onSetPlaybackRate: vi.fn(),
      onSetRootDuration: vi.fn(),
      onSetColorGrading: vi.fn(),
      onSetColorGradingCompare: vi.fn(),
      onEnablePickMode: vi.fn(),
      onDisablePickMode: vi.fn(),
      getCanonicalFps: () => 30,
    }

    const handler = adapter.installControlBridge(deps, { fps: 30 })
    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          source: 'hf-parent',
          type: 'control',
          action: 'seek',
          frame: 15,
        },
      }),
    )
    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          source: 'hf-parent',
          type: 'control',
          action: 'set-volume',
          volume: 0.25,
        },
      }),
    )
    window.removeEventListener('message', handler)

    expect(postSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'hf-preview',
        type: 'ready',
        protocolVersion: 1,
      }),
      '*',
    )
    expect(deps.onSeek).toHaveBeenCalledWith(0.5, 'commit')
    expect(deps.onSetVolume).toHaveBeenCalledWith(0.25)
  })

  it('adds preview session metadata to runtime messages and rejects mismatched control nonce', () => {
    const win = window as RuntimeTestWindow
    win.__HF_PREVIEW_SESSION__ = {
      projectId: 'project-1',
      compositionPath: 'compositions/main.html',
      nonce: 'nonce-123',
      sandboxToken: 'sandbox-abc',
    }
    const postSpy = vi.spyOn(window.parent, 'postMessage').mockImplementation(() => undefined)
    const deps: HyperFramesRuntimeControlBridgeDeps = {
      onPlay: vi.fn(),
      onPause: vi.fn(),
      onStopMedia: vi.fn(),
      onSeek: vi.fn(),
      onTick: vi.fn(),
      onSetMuted: vi.fn(),
      onSetVolume: vi.fn(),
      onSetMediaOutputMuted: vi.fn(),
      onSetNativeMediaSyncDisabled: vi.fn(),
      onSetWebAudioMediaDisabled: vi.fn(),
      onSetPlaybackRate: vi.fn(),
      onSetRootDuration: vi.fn(),
      onSetColorGrading: vi.fn(),
      onSetColorGradingCompare: vi.fn(),
      onEnablePickMode: vi.fn(),
      onDisablePickMode: vi.fn(),
      getCanonicalFps: () => 30,
    }

    const handler = adapter.installControlBridge(deps, { fps: 30 })
    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          source: 'hf-parent',
          type: 'control',
          action: 'seek',
          frame: 15,
          projectId: 'project-1',
          compositionPath: 'compositions/main.html',
          nonce: 'wrong',
          sandboxToken: 'sandbox-abc',
        },
      }),
    )
    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          source: 'hf-parent',
          type: 'control',
          action: 'seek',
          frame: 15,
          projectId: 'project-1',
          compositionPath: 'compositions/main.html',
          nonce: 'nonce-123',
          sandboxToken: 'sandbox-abc',
        },
      }),
    )
    window.removeEventListener('message', handler)

    expect(postSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'hf-preview',
        type: 'ready',
        projectId: 'project-1',
        compositionPath: 'compositions/main.html',
        nonce: 'nonce-123',
        sandboxToken: 'sandbox-abc',
      }),
      '*',
    )
    expect(deps.onSeek).toHaveBeenCalledTimes(1)
    expect(deps.onSeek).toHaveBeenCalledWith(0.5, 'commit')
  })
})
