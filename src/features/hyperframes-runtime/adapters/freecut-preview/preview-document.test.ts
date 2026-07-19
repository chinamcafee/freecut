import {
  DEFAULT_HYPERFRAMES_RUNTIME_BOOTSTRAP_SRC,
  HYPERFRAMES_PREVIEW_MESSAGE_SOURCE,
  createHyperFramesPreviewCsp,
  createHyperFramesPreviewSandbox,
  createPreviewDocument,
  validateHyperFramesPreviewMessage,
} from '@/features/hyperframes-runtime'

describe('HyperFrames preview document adapter', () => {
  it('creates a sandboxed srcdoc with CSP, session nonce, and runtime injection', () => {
    const document = createPreviewDocument({
      html: '<!doctype html><html><head><title>Preview</title></head><body><script>window.compositionRan = true</script></body></html>',
      projectId: 'project-1',
      compositionPath: 'compositions/main.html',
      sessionNonce: 'nonce-123',
      sandboxToken: 'sandbox-abc',
      runtime: {
        bootstrapSrc: '/hyperframes-runtime/custom-runtime.js',
      },
    })

    expect(document.sandbox).toBe('allow-scripts')
    expect(document.sandbox).not.toContain('allow-same-origin')
    expect(document.sandbox).not.toContain('allow-top-navigation')
    expect(document.sandbox).not.toContain('allow-popups')
    expect(document.sandbox).not.toContain('allow-downloads')
    expect(document.srcdoc.indexOf('http-equiv="Content-Security-Policy"')).toBeLessThan(
      document.srcdoc.indexOf('data-hf-preview-session="true"'),
    )
    expect(document.srcdoc.indexOf('data-hf-preview-session="true"')).toBeLessThan(
      document.srcdoc.indexOf('data-hf-runtime-config="true"'),
    )
    expect(document.srcdoc).toContain('src="/hyperframes-runtime/custom-runtime.js"')
    expect(document.srcdoc).toContain('nonce="nonce-123"')
    expect(document.srcdoc).toContain('"sandboxToken":"sandbox-abc"')
    expect(document.csp).toContain("default-src 'none'")
    expect(document.csp).toContain("connect-src 'none'")
    expect(document.csp).toContain("frame-src 'none'")
    expect(document.csp).not.toContain("'unsafe-eval'")
    expect(document.csp).not.toContain('https://evil.example')
    expect(document.runtimeBootstrapSrc).toBe('/hyperframes-runtime/custom-runtime.js')
  })

  it('keeps the runtime URL switchable and whitelisted through CSP', () => {
    const first = createPreviewDocument({
      html: '<html><head></head><body></body></html>',
      projectId: 'project-1',
      compositionPath: 'compositions/main.html',
      sessionNonce: 'nonce-a',
      runtime: {
        bootstrapSrc: 'https://runtime-a.example/core.js',
      },
    })
    const second = createPreviewDocument({
      html: '<html><head></head><body></body></html>',
      projectId: 'project-1',
      compositionPath: 'compositions/main.html',
      sessionNonce: 'nonce-b',
      runtime: {
        bootstrapSrc: 'https://runtime-b.example/core.js',
      },
    })

    expect(first.srcdoc).toContain('src="https://runtime-a.example/core.js"')
    expect(first.csp).toContain('https://runtime-a.example')
    expect(first.csp).not.toContain('https://runtime-b.example')
    expect(second.srcdoc).toContain('src="https://runtime-b.example/core.js"')
    expect(second.csp).toContain('https://runtime-b.example')
    expect(second.csp).not.toContain('https://runtime-a.example')
  })

  it('allows explicit sandbox and resource policy overrides for debug hosts', () => {
    const sandbox = createHyperFramesPreviewSandbox({
      tokens: ['allow-scripts', 'allow-same-origin'],
      debugLabel: 'studio-debug',
    })
    const csp = createHyperFramesPreviewCsp(
      DEFAULT_HYPERFRAMES_RUNTIME_BOOTSTRAP_SRC,
      'nonce-123',
      {
        allowInlineScripts: false,
        scriptSrc: ['https://trusted-scripts.example/player.js'],
        imgSrc: ['https://assets.example'],
        connectSrc: ['https://api.example'],
      },
    )
    const scriptDirective = csp
      .split('; ')
      .find((directive) => directive.startsWith('script-src '))

    expect(sandbox).toBe('allow-same-origin allow-scripts')
    expect(csp).toContain("'nonce-nonce-123'")
    expect(scriptDirective).not.toContain("'unsafe-inline'")
    expect(csp).toContain('https://trusted-scripts.example')
    expect(csp).toContain('https://assets.example')
    expect(csp).toContain('https://api.example')
  })

  it('validates preview messages with nonce, source, project, composition, and type checks', () => {
    const accepted = validateHyperFramesPreviewMessage(
      {
        origin: 'null',
        data: {
          source: HYPERFRAMES_PREVIEW_MESSAGE_SOURCE,
          type: 'ready',
          nonce: 'nonce-123',
          projectId: 'project-1',
          compositionPath: 'compositions/main.html',
          sandboxToken: 'sandbox-abc',
        },
      },
      {
        expectedOrigin: 'null',
        sessionNonce: 'nonce-123',
        projectId: 'project-1',
        compositionPath: 'compositions/main.html',
        sandboxToken: 'sandbox-abc',
        allowedTypes: ['ready', 'error'],
      },
    )
    const wrongNonce = validateHyperFramesPreviewMessage(
      {
        origin: 'null',
        data: {
          source: HYPERFRAMES_PREVIEW_MESSAGE_SOURCE,
          type: 'ready',
          nonce: 'wrong',
        },
      },
      { sessionNonce: 'nonce-123' },
    )
    const wrongType = validateHyperFramesPreviewMessage(
      {
        origin: 'null',
        data: {
          source: HYPERFRAMES_PREVIEW_MESSAGE_SOURCE,
          type: 'unknown',
          nonce: 'nonce-123',
        },
      },
      { sessionNonce: 'nonce-123', allowedTypes: ['ready'] },
    )

    expect(accepted.ok).toBe(true)
    expect(accepted.message).toMatchObject({ type: 'ready', projectId: 'project-1' })
    expect(wrongNonce).toEqual({ ok: false, reason: 'nonce-mismatch' })
    expect(wrongType).toEqual({ ok: false, reason: 'type-not-allowed' })
  })
})
