import { createRef } from 'react'
import { cleanup, render, waitFor } from '@testing-library/react'
import {
  HyperFramesPlayerHost,
  type HyperFramesPlayerHostHandle,
} from './HyperFramesPlayerHost'
import { createPreviewDocument } from './index'
import { mapPlayerErrorToDiagnostic } from './playerDiagnostics'
import { resolveHyperFramesIframe } from './resolveHyperFramesIframe'

describe('HyperFramesPlayerHost', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('loads a preview srcdoc into the mirrored player Web Component', async () => {
    const ref = createRef<HyperFramesPlayerHostHandle>()
    const previewDocument = createPreviewDocument({
      html: '<html><head></head><body><main data-composition-id="main"></main></body></html>',
      projectId: 'project-1',
      compositionPath: 'compositions/main.html',
      sessionNonce: 'nonce-123',
    })

    render(
      <HyperFramesPlayerHost
        ref={ref}
        previewDocument={previewDocument}
        projectId="project-1"
        compositionPath="compositions/main.html"
        controls
        muted
        volume={0.5}
        playbackRate={1.25}
      />,
    )

    await waitFor(() => expect(ref.current?.getPlayerElement()).not.toBeNull())

    const player = ref.current?.getPlayerElement()
    expect(player?.getAttribute('srcdoc')).toContain('Content-Security-Policy')
    expect(player?.dataset.projectId).toBe('project-1')
    expect(player?.dataset.compositionPath).toBe('compositions/main.html')
    expect(player?.hasAttribute('controls')).toBe(true)
    expect(player?.hasAttribute('muted')).toBe(true)
    expect(player?.getAttribute('volume')).toBe('0.5')
    expect(player?.getAttribute('playback-rate')).toBe('1.25')
    expect(player?.dataset.sessionNonce).toBe('nonce-123')
    expect(ref.current?.resolveIframe()).toBe(player?.iframeElement)
  })

  it('exposes imperative load and playback controls', async () => {
    const ref = createRef<HyperFramesPlayerHostHandle>()

    render(<HyperFramesPlayerHost ref={ref} fps={24} />)
    await waitFor(() => expect(ref.current?.getPlayerElement()).not.toBeNull())
    const player = ref.current?.getPlayerElement()
    expect(player).not.toBeNull()
    if (!player) return

    const seekSpy = vi.spyOn(player, 'seek')
    const playSpy = vi.spyOn(player, 'play').mockImplementation(() => undefined)
    const pauseSpy = vi.spyOn(player, 'pause').mockImplementation(() => undefined)

    await ref.current?.load('<html><head></head><body>loaded</body></html>')
    await ref.current?.seek(1.25)
    await ref.current?.seekFrame(48)
    await ref.current?.play()
    await ref.current?.pause()

    expect(player.getAttribute('srcdoc')).toContain('loaded')
    expect(seekSpy).toHaveBeenCalledWith(1.25)
    expect(seekSpy).toHaveBeenCalledWith(2)
    expect(playSpy).toHaveBeenCalled()
    expect(pauseSpy).toHaveBeenCalled()
  })

  it('maps player events to FreeCut callbacks and diagnostics', async () => {
    const ref = createRef<HyperFramesPlayerHostHandle>()
    const onReady = vi.fn()
    const onDuration = vi.fn()
    const onTimeUpdate = vi.fn()
    const onError = vi.fn()
    const onSelection = vi.fn()

    render(
      <HyperFramesPlayerHost
        ref={ref}
        projectId="project-1"
        compositionPath="compositions/main.html"
        onReady={onReady}
        onDuration={onDuration}
        onTimeUpdate={onTimeUpdate}
        onError={onError}
        onSelection={onSelection}
      />,
    )
    await waitFor(() => expect(ref.current?.getPlayerElement()).not.toBeNull())

    const player = ref.current?.getPlayerElement()
    expect(player).not.toBeNull()
    if (!player) return

    player.dispatchEvent(new CustomEvent('ready', { detail: { duration: 3 } }))
    player.dispatchEvent(new CustomEvent('timeupdate', { detail: { currentTime: 1.5 } }))
    player.dispatchEvent(new CustomEvent('selectionchange', { detail: { elementId: 'title' } }))
    player.dispatchEvent(new CustomEvent('error', { detail: { message: 'Preview failed' } }))

    expect(onReady).toHaveBeenCalledWith({
      projectId: 'project-1',
      compositionPath: 'compositions/main.html',
      duration: 3,
    })
    expect(onDuration).toHaveBeenCalledWith({
      projectId: 'project-1',
      compositionPath: 'compositions/main.html',
      duration: 3,
    })
    expect(onTimeUpdate).toHaveBeenCalledWith({
      projectId: 'project-1',
      compositionPath: 'compositions/main.html',
      currentTime: 1.5,
    })
    expect(onSelection).toHaveBeenCalledWith({
      projectId: 'project-1',
      compositionPath: 'compositions/main.html',
      detail: { elementId: 'title' },
    })
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'hyperframes.player.error',
        source: 'runtime',
        stage: 'preview',
        severity: 'blocking',
        message: 'Preview failed',
        file: 'compositions/main.html',
      }),
    )
  })

  it('validates runtime postMessage events before exposing them to FreeCut callbacks', async () => {
    const ref = createRef<HyperFramesPlayerHostHandle>()
    const onRuntimeMessage = vi.fn()
    const onRuntimeMessageRejected = vi.fn()
    const previewDocument = createPreviewDocument({
      html: '<html><head></head><body></body></html>',
      projectId: 'project-1',
      compositionPath: 'compositions/main.html',
      sessionNonce: 'nonce-123',
      sandboxToken: 'sandbox-abc',
    })

    render(
      <HyperFramesPlayerHost
        ref={ref}
        previewDocument={previewDocument}
        expectedOrigin="null"
        onRuntimeMessage={onRuntimeMessage}
        onRuntimeMessageRejected={onRuntimeMessageRejected}
      />,
    )
    await waitFor(() => expect(ref.current?.resolveIframe()).not.toBeNull())

    const iframeWindow = ref.current?.resolveIframe()?.contentWindow ?? null

    const validMessage = {
      source: 'hf-preview',
      type: 'ready',
      projectId: 'project-1',
      compositionPath: 'compositions/main.html',
      nonce: 'nonce-123',
      sandboxToken: 'sandbox-abc',
    }
    window.dispatchEvent(
      new MessageEvent('message', {
        origin: 'null',
        source: iframeWindow,
        data: validMessage,
      }),
    )
    window.dispatchEvent(
      new MessageEvent('message', {
        origin: 'https://attacker.example',
        source: iframeWindow,
        data: validMessage,
      }),
    )
    window.dispatchEvent(
      new MessageEvent('message', {
        origin: 'null',
        source: iframeWindow,
        data: { ...validMessage, nonce: 'wrong' },
      }),
    )

    expect(onRuntimeMessage).toHaveBeenCalledTimes(1)
    expect(onRuntimeMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.objectContaining({
          type: 'ready',
          nonce: 'nonce-123',
          projectId: 'project-1',
        }),
      }),
    )
    expect(onRuntimeMessageRejected).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'origin-mismatch' }),
    )
    expect(onRuntimeMessageRejected).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'nonce-mismatch' }),
    )
  })

  it('resolves iframe and diagnostic helpers independently from React', async () => {
    const ref = createRef<HyperFramesPlayerHostHandle>()
    render(<HyperFramesPlayerHost ref={ref} />)
    await waitFor(() => expect(ref.current?.getPlayerElement()).not.toBeNull())
    const player = ref.current?.getPlayerElement()

    expect(resolveHyperFramesIframe(player)).toBe(player?.iframeElement)
    expect(
      mapPlayerErrorToDiagnostic(new CustomEvent('error', { detail: { message: 'Bad frame' } }), {
        compositionPath: 'compositions/main.html',
      }),
    ).toMatchObject({
      code: 'hyperframes.player.error',
      message: 'Bad frame',
      file: 'compositions/main.html',
    })
  })
})
