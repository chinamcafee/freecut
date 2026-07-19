import type { HyperFramesProjectDirectory } from '@/types/hyperframes'
import { createHyperFramesCompilerAdapter } from './compiler-adapter'

const directory: HyperFramesProjectDirectory = {
  manifest: {
    schemaVersion: 1,
    id: 'hf-project',
    title: 'Compiler Project',
    entryFile: 'index.html',
    activeCompositionPath: 'compositions/main.html',
    canvas: {
      width: 1920,
      height: 1080,
      fps: 30,
      durationInFrames: 120,
    },
    assets: [
      {
        id: 'clip',
        path: 'compositions/assets/clip.mp4',
        kind: 'video',
        durationInFrames: 90,
      },
    ],
    variables: {
      headline: 'Runtime headline',
    },
    provenance: {
      source: 'skill-output',
      createdAt: 1784304000000,
    },
  },
  files: [
    {
      path: 'compositions/main.html',
      encoding: 'utf8',
      content: `<!doctype html><html><head></head><body>
        <div data-composition-id="main" data-width="1920" data-height="1080">
          <video src="assets/clip.mp4" data-start="0"></video>
          <div
            data-composition-id="card"
            data-composition-src="card.html"
            data-variable-values='{"headline":"Card headline"}'
          ></div>
        </div>
      </body></html>`,
    },
    {
      path: 'compositions/card.html',
      encoding: 'utf8',
      content: `<!doctype html>
        <html data-composition-variables='[{"id":"headline","type":"string","label":"Headline","default":"Default"}]'>
          <head>
            <style>.card { background: url("assets/card-bg.png"); }</style>
          </head>
          <body>
            <section data-composition-id="card" data-width="640" data-height="360">
              <img src="assets/logo.png" />
              <h1 data-var-text="headline">Default</h1>
            </section>
          </body>
        </html>`,
    },
  ],
  assets: [],
}

describe('HyperFrames compiler adapter', () => {
  const adapter = createHyperFramesCompilerAdapter()

  it('creates preview HTML from an in-memory project directory', async () => {
    const result = await adapter.createPreviewHtml(directory, {
      injectRuntime: true,
      runtime: {
        bootstrapSrc: '/assets/hyperframes-runtime.js',
        nonce: 'runtime-nonce',
      },
    })

    expect(result.ok).toBe(true)
    expect(result.diagnostics).toEqual([])
    expect(result.html).toContain('src="/assets/hyperframes-runtime.js"')
    expect(result.html).toContain('nonce="runtime-nonce"')
    expect(result.html).toContain('data-hf-runtime-config="true"')
    expect(result.html).toContain('id="hf-video-0"')
    expect(result.html).toContain('data-duration="3"')
    expect(result.html).toContain('data-end="3"')
    expect(result.html).toContain('data-composition-file="card.html"')
    expect(result.html).not.toContain('data-composition-src="card.html"')
    expect(result.html).toContain('assets/logo.png')
    expect(result.html).toContain('assets/card-bg.png')
    expect(result.variablesByComposition.card).toMatchObject({ headline: 'Card headline' })
    expect(result.inlinedCompositionCount).toBe(1)
  })

  it('leaves runtime injection to the preview document by default', async () => {
    const result = await adapter.createPreviewHtml(directory)

    expect(result.ok).toBe(true)
    expect(result.html).not.toContain('data-hf-runtime-config="true"')
    expect(result.html).not.toContain('data-hf-runtime-bootstrap="core"')
  })

  it('returns a blocking diagnostic when the active composition is missing', async () => {
    const result = await adapter.createPreviewHtml(directory, {
      activeCompositionPath: 'compositions/missing.html',
    })

    expect(result.ok).toBe(false)
    expect(result.html).toBeNull()
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        code: 'hyperframes.compiler.active-composition-missing',
        source: 'runtime',
        stage: 'preview',
        severity: 'blocking',
        file: 'compositions/missing.html',
      }),
    ])
  })
})
