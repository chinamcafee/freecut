import {
  parseHtml,
  updateElementInHtml,
} from './htmlParser.js'
import {
  parseGsapScriptAcorn,
} from './gsapParserAcorn.js'
import {
  updateAnimationInScript,
} from './gsapWriterAcorn.js'
import {
  ensureHfIds,
} from './hfIds.js'
import {
  CSS_URL_RE,
  PATH_ATTRS,
  isNonRelativeUrl,
} from './assetReferencePrimitives.js'
import {
  maskNonScannableRanges,
} from './htmlAssetScanning.js'

describe('HyperFrames parsers runtime mirror', () => {
  it('round-trips HTML edits through the migrated parser source', () => {
    const html = `<!doctype html>
<html data-composition-id="intro" data-composition-duration="6">
  <body>
    <div id="stage" style="width: 1920px; height: 1080px">
      <div id="title" data-start="0" data-end="2" data-name="Title"><div>Hello</div></div>
      <img id="photo" data-start="1" data-end="5" data-name="Photo" src="assets/photo.png" />
    </div>
  </body>
</html>`

    const tagged = ensureHfIds(html)
    const parsed = parseHtml(tagged)

    expect(parsed.elements.map((element) => element.type)).toEqual(['text', 'image'])
    expect(parsed.elements[0]).toMatchObject({
      name: 'Title',
      content: 'Hello',
      startTime: 0,
      duration: 2,
    })

    const updated = updateElementInHtml(tagged, 'title', {
      name: 'Headline',
      content: 'Updated copy',
      startTime: 0.5,
      duration: 3,
      zIndex: 4,
    })
    const reparsed = parseHtml(updated)
    const headline = reparsed.elements.find((element) => element.name === 'Headline')

    expect(headline).toMatchObject({
      type: 'text',
      content: 'Updated copy',
      startTime: 0.5,
      duration: 3,
      zIndex: 4,
    })
    expect(reparsed.elements.find((element) => element.name === 'Photo')).toMatchObject({
      type: 'image',
      src: 'assets/photo.png',
    })
  })

  it('parses and rewrites GSAP with the migrated Acorn writer', () => {
    const script = `var tl = gsap.timeline({ paused: true });
tl.to("#hero", { opacity: 1, x: 10, duration: 0.5, ease: "power3.out" }, 0.2);
window.__timelines["main"] = tl;`

    const parsed = parseGsapScriptAcorn(script)
    expect(parsed.animations).toHaveLength(1)
    expect(parsed.animations[0]).toMatchObject({
      targetSelector: '#hero',
      method: 'to',
      position: 0.2,
      duration: 0.5,
      properties: {
        opacity: 1,
        x: 10,
      },
    })

    const animationId = parsed.animations[0]?.id
    expect(animationId).toBeTruthy()

    const updated = updateAnimationInScript(script, animationId ?? '', {
      duration: 1.25,
      ease: 'power2.in',
      properties: {
        opacity: 0.35,
        y: 24,
      },
    })
    const reparsed = parseGsapScriptAcorn(updated)

    expect(updated).toContain('"power2.in"')
    expect(reparsed.animations[0]).toMatchObject({
      duration: 1.25,
      ease: 'power2.in',
      properties: {
        opacity: 0.35,
        y: 24,
      },
    })
    expect(reparsed.animations[0]?.properties).not.toHaveProperty('x')
  })

  it('extracts relative asset paths with migrated asset primitives', () => {
    const html = `<!doctype html><html><body>
      <img src="assets/photo.png" />
      <a href="#local-anchor">skip anchor</a>
      <video src="https://cdn.example.com/remote.mp4"></video>
      <div style="background: url('../textures/bg.png')"></div>
      <!-- <img src="hidden/commented.png" /> -->
      <script>const hidden = '<img src="hidden/script.png" />'</script>
    </body></html>`

    const masked = maskNonScannableRanges(html)
    const document = new DOMParser().parseFromString(masked, 'text/html')
    const paths: string[] = []

    for (const element of Array.from(document.querySelectorAll('*'))) {
      for (const attr of PATH_ATTRS) {
        const value = element.getAttribute(attr)
        if (value && !isNonRelativeUrl(value)) {
          paths.push(value)
        }
      }

      const style = element.getAttribute('style') ?? ''
      for (const match of style.matchAll(CSS_URL_RE)) {
        const value = match[2]
        if (value && !isNonRelativeUrl(value)) {
          paths.push(value)
        }
      }
    }

    expect(paths).toEqual(['assets/photo.png', '../textures/bg.png'])
  })

  it('keeps hf ids deterministic and pinned after first write', () => {
    const raw = '<!doctype html><html><body><div class="card"><p>Hello</p></div></body></html>'
    const tagged = ensureHfIds(raw)
    const edited = tagged.replace('Hello', 'Hello world')

    expect(ensureHfIds(tagged)).toBe(tagged)
    expect(ensureHfIds(edited)).toBe(edited)
    expect(tagged.match(/data-hf-id=/g)).toHaveLength(2)
  })
})
