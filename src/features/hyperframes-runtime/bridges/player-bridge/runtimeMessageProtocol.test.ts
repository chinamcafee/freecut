import {
  validateHyperFramesRuntimeMessage,
  type HyperFramesRuntimeMessageValidationOptions,
} from './runtimeMessageProtocol'

const validationOptions: HyperFramesRuntimeMessageValidationOptions = {
  sessionNonce: 'nonce-123',
  projectId: 'project-1',
  compositionPath: 'compositions/main.html',
  sandboxToken: 'sandbox-abc',
  expectedOrigin: 'null',
  sourceWindow: window,
}

function runtimeEvent(overrides: Record<string, unknown> = {}): MessageEvent<unknown> {
  return new MessageEvent('message', {
    origin: 'null',
    source: window,
    data: {
      source: 'hf-preview',
      type: 'state',
      frame: 12,
      isPlaying: true,
      projectId: 'project-1',
      compositionPath: 'compositions/main.html',
      nonce: 'nonce-123',
      sandboxToken: 'sandbox-abc',
      ...overrides,
    },
  })
}

describe('HyperFrames runtime message protocol', () => {
  it('accepts runtime messages that match source window, origin, nonce, project, and schema', () => {
    const result = validateHyperFramesRuntimeMessage(runtimeEvent(), validationOptions)

    expect(result).toEqual({
      ok: true,
      message: expect.objectContaining({
        source: 'hf-preview',
        type: 'state',
        frame: 12,
        projectId: 'project-1',
        compositionPath: 'compositions/main.html',
        nonce: 'nonce-123',
        sandboxToken: 'sandbox-abc',
      }),
    })
  })

  it('rejects wrong origin, nonce, project, and payload schema', () => {
    expect(
      validateHyperFramesRuntimeMessage(
        new MessageEvent('message', {
          origin: 'https://attacker.example',
          source: window,
          data: runtimeEvent().data,
        }),
        validationOptions,
      ),
    ).toEqual({ ok: false, reason: 'origin-mismatch' })

    expect(
      validateHyperFramesRuntimeMessage(runtimeEvent({ nonce: 'wrong' }), validationOptions),
    ).toEqual({ ok: false, reason: 'nonce-mismatch' })
    expect(
      validateHyperFramesRuntimeMessage(runtimeEvent({ projectId: 'other' }), validationOptions),
    ).toEqual({ ok: false, reason: 'project-mismatch' })
    expect(
      validateHyperFramesRuntimeMessage(runtimeEvent({ frame: 'bad' }), validationOptions),
    ).toEqual({ ok: false, reason: 'payload-schema-mismatch' })
  })

  it('validates message-specific schemas', () => {
    expect(
      validateHyperFramesRuntimeMessage(
        runtimeEvent({
          type: 'timeline',
          durationSeconds: 3,
          durationInFrames: 90,
          clips: [],
          scenes: [],
          compositionWidth: 1920,
          compositionHeight: 1080,
        }),
        validationOptions,
      ),
    ).toEqual({
      ok: true,
      message: expect.objectContaining({ type: 'timeline' }),
    })

    expect(
      validateHyperFramesRuntimeMessage(
        runtimeEvent({
          type: 'stage-size',
          width: '1920',
          height: 1080,
        }),
        validationOptions,
      ),
    ).toEqual({ ok: false, reason: 'payload-schema-mismatch' })
  })
})
