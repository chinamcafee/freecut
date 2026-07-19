import { describe, expect, it } from 'vite-plus/test'
import { scanCssRules } from './cssRuleScanner'

describe('scanCssRules', () => {
  it('scans nested browser CSS without splitting quoted or data URL values', () => {
    const rules = scanCssRules(`
      /* ignored */
      .card, [data-composition-id="main"] {
        background: url("data:image/svg+xml;utf8,<svg></svg>");
        pointer-events: none;
      }
      @media (min-width: 600px) {
        .hf-texture-lava { -webkit-mask-image: linear-gradient(red, blue); }
      }
      @font-face { font-family: "Test"; src: url(test.woff2); }
    `)

    expect(rules).toHaveLength(2)
    expect(rules[0]?.selectors).toEqual(['.card', '[data-composition-id="main"]'])
    expect(rules[0]?.body).toContain('pointer-events: none')
    expect(rules[0]?.declarations).toContainEqual({
      property: 'pointer-events',
      value: 'none',
    })
    expect(rules[1]?.selector).toBe('.hf-texture-lava')
  })
})
