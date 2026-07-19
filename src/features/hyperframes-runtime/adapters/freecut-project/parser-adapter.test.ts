import { createHyperFramesParserAdapter } from './parser-adapter'

describe('HyperFrames parser adapter', () => {
  const adapter = createHyperFramesParserAdapter()

  it('wraps HTML parsing and updates in typed parser results', () => {
    const html = `<!doctype html>
<html data-composition-id="intro" data-composition-duration="5">
  <body>
    <div id="stage">
      <div id="title" data-start="0" data-end="2" data-name="Title"><div>Hello</div></div>
    </div>
  </body>
</html>`

    const parsed = adapter.parseHtml(html, { file: 'compositions/main.html' })
    expect(parsed.ok).toBe(true)
    expect(parsed.value?.elements[0]).toMatchObject({
      type: 'text',
      name: 'Title',
      content: 'Hello',
    })

    const updated = adapter.updateHtmlElement(
      html,
      'title',
      { content: 'Updated', duration: 3 },
      { file: 'compositions/main.html' },
    )

    expect(updated.ok).toBe(true)
    expect(adapter.parseHtml(updated.value ?? '').value?.elements[0]).toMatchObject({
      content: 'Updated',
      duration: 3,
    })
  })

  it('returns validation diagnostics instead of throwing invalid HTML to UI callers', () => {
    const result = adapter.validateHtml('<html><body><p>missing contract</p></body></html>', {
      file: 'compositions/broken.html',
    })

    expect(result.ok).toBe(false)
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: 'blocking',
          file: 'compositions/broken.html',
          message: 'Missing data-composition-id attribute on <html> element',
        }),
        expect.objectContaining({
          severity: 'blocking',
          message: 'Missing #stage element',
        }),
      ]),
    )
  })

  it('returns GSAP diagnostics for invalid scripts without throwing', () => {
    const result = adapter.parseGsap('var tl = gsap.timeline(); tl.to("#hero", {', {
      file: 'compositions/main.html',
    })

    expect(result.ok).toBe(false)
    expect(result.value).toBeNull()
    expect(result.diagnostics[0]).toMatchObject({
      severity: 'blocking',
      file: 'compositions/main.html',
      message: 'GSAP script could not be parsed for editing',
    })
  })

  it('wraps GSAP writes and reports missing animation ids as diagnostics', () => {
    const script = `var tl = gsap.timeline({ paused: true });
tl.to("#hero", { opacity: 1, duration: 0.5 }, 0);
window.__timelines["main"] = tl;`

    const parsed = adapter.parseGsap(script)
    const animationId = parsed.value?.animations[0]?.id
    const updated = adapter.updateGsapAnimation(script, animationId ?? '', {
      duration: 1,
      properties: { opacity: 0.25 },
    })
    const reparsed = adapter.parseGsap(updated.value ?? '')

    expect(updated.ok).toBe(true)
    expect(reparsed.value?.animations[0]).toMatchObject({
      duration: 1,
      properties: { opacity: 0.25 },
    })

    const missing = adapter.updateGsapAnimation(script, 'missing-animation', { duration: 2 })
    expect(missing.ok).toBe(false)
    expect(missing.diagnostics[0]).toMatchObject({
      severity: 'warning',
      message: 'No GSAP animation matched "missing-animation"',
    })
  })

  it('collects editable asset references while ignoring comments, scripts, and remote URLs', () => {
    const html = `<!doctype html><html><head>
      <style>.hero { background: url("assets/hero.png"); }</style>
    </head><body>
      <img src="assets/photo.png" />
      <a href="#anchor">skip</a>
      <video src="https://cdn.example.com/clip.mp4"></video>
      <div style="background-image: url('../textures/noise.png')"></div>
      <!-- <img src="hidden/comment.png" /> -->
      <script>const hidden = '<img src="hidden/script.png" />'</script>
    </body></html>`

    const result = adapter.collectAssetReferences(html)

    expect(result.ok).toBe(true)
    expect(result.value?.map((reference) => [reference.path, reference.source])).toEqual([
      ['assets/photo.png', 'attribute'],
      ['../textures/noise.png', 'inline-style'],
      ['assets/hero.png', 'style-block'],
    ])
  })
})
