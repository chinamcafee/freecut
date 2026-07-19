import { parseHTMLContent, stripEmbeddedRuntimeScripts } from './htmlDocument.js'
import {
  compileTimingAttrs,
  injectDurations,
  extractResolvedMedia,
} from './timingCompiler.js'
import { resolveTimings } from './timingResolver.js'
import { inlineSubCompositions } from './inlineSubCompositions.js'
import {
  parseHostVariableValues,
  readDeclaredDefaults,
} from '../runtime/getVariables.js'
import { rewriteAssetPath } from './rewriteSubCompPaths.js'

describe('HyperFrames core compiler mirror', () => {
  it('compiles timing attrs and injects externally resolved media durations', () => {
    const html = `<!doctype html><html><body>
      <video src="assets/clip.mp4" data-start="1"></video>
      <audio id="voice" src="assets/voice.mp3" data-start="0" data-duration="5"></audio>
    </body></html>`

    const compiled = compileTimingAttrs(html)
    expect(compiled.unresolved).toContainEqual(
      expect.objectContaining({
        id: 'hf-video-0',
        tagName: 'video',
        src: 'assets/clip.mp4',
        start: 1,
      }),
    )
    expect(compiled.html).toContain('data-has-audio="true"')
    expect(compiled.html).toContain('data-end="5"')

    const resolved = injectDurations(compiled.html, [{ id: 'hf-video-0', duration: 3 }])
    expect(resolved).toContain('id="hf-video-0"')
    expect(resolved).toContain('data-duration="3"')
    expect(resolved).toContain('data-end="4"')
    expect(extractResolvedMedia(resolved)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'hf-video-0', duration: 3 }),
        expect.objectContaining({ id: 'voice', duration: 5 }),
      ]),
    )
  })

  it('strips embedded runtime scripts without removing authored scripts', () => {
    const html = `<!doctype html><html><head>
      <script>window.__playerReady = true;</script>
      <script>window.__hyperframeRuntimeBootstrapped = true;</script>
      <script>window.authored = true;</script>
    </head><body></body></html>`

    const stripped = stripEmbeddedRuntimeScripts(html)

    expect(stripped).not.toContain('__playerReady')
    expect(stripped).not.toContain('__hyperframeRuntimeBootstrapped')
    expect(stripped).toContain('window.authored = true')
  })

  it('inlines sub-compositions, scopes CSS and rewrites local asset paths', () => {
    const hostDoc = parseHTMLContent(`<!doctype html><html><head></head><body>
      <div
        data-composition-id="card"
        data-composition-src="compositions/card.html"
        data-variable-values='{"title":"Host title"}'
      ></div>
    </body></html>`)
    const host = hostDoc.querySelector('[data-composition-src]')
    expect(host).toBeTruthy()

    const subHtml = `<!doctype html>
      <html data-composition-variables='[{"id":"title","type":"string","label":"Title","default":"Default"}]'>
        <head>
          <style>.headline { background: url("../assets/bg.png"); }</style>
        </head>
        <body>
          <div data-composition-id="card" id="card-root" data-width="400" data-height="200">
            <img src="../assets/logo.png" style="background-image: url('../assets/inline.png')" />
            <script>window.__timelines["card"] = {};</script>
          </div>
        </body>
      </html>`

    const result = inlineSubCompositions(hostDoc, [host!], {
      resolveHtml: (src) => (src === 'compositions/card.html' ? subHtml : null),
      parseHtml: parseHTMLContent,
      rewriteInlineStyles: true,
      readVariableDefaults: readDeclaredDefaults,
      parseHostVariables: parseHostVariableValues,
    })

    expect(host?.getAttribute('data-composition-file')).toBe('compositions/card.html')
    expect(host?.hasAttribute('data-composition-src')).toBe(false)
    expect(host?.innerHTML).toContain('assets/logo.png')
    expect(host?.innerHTML).toContain('assets/inline.png')
    expect(result.styles[0]).toContain('[data-composition-id="card"]')
    expect(result.styles[0]).toContain('assets/bg.png')
    expect(result.scripts[0]).toContain('window.__timelines')
    expect(result.variablesByComp.card).toMatchObject({ title: 'Host title' })
    expect(rewriteAssetPath('compositions/card.html', '../assets/logo.png')).toBe('assets/logo.png')
  })

  it('resolves word-anchored timing deterministically', () => {
    const resolved = resolveTimings({
      elements: [
        { hfId: 'title', start: 0, duration: 2 },
        { hfId: 'logo', start: 4, duration: 1 },
      ],
      wordTimings: [{ index: 2, start: 1.5, end: 1.8 }],
      anchors: [
        {
          hfId: 'title',
          wordIndex: 2,
          enterDuration: 0.25,
          exitDuration: 0.5,
          slotEnd: 3,
        },
      ],
    })

    expect(resolved.title).toEqual({
      enterAt: 1.5,
      exitAt: 3,
      holdDuration: 0.75,
    })
    expect(resolved.logo).toEqual({
      enterAt: 4,
      exitAt: 5,
      holdDuration: 0,
    })
  })
})
