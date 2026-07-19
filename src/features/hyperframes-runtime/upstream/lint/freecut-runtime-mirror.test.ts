import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { lintHyperframeHtml, shouldBlockRender } from './browser.js'
import { lintProject } from './project.js'

function compositionHtml(body: string): string {
  return `<!doctype html>
<html>
  <body>
    <div data-composition-id="main" data-width="1920" data-height="1080">
      ${body}
    </div>
  </body>
</html>`
}

describe('HyperFrames lint runtime mirror', () => {
  it('blocks unsafe non-deterministic inline script patterns', async () => {
    const result = await lintHyperframeHtml(
      compositionHtml('<script>const offset = Math.random() * 100;</script>'),
      { filePath: 'compositions/main.html' },
    )

    expect(result.ok).toBe(false)
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        code: 'non_deterministic_code',
        severity: 'error',
        file: 'compositions/main.html',
      }),
    )
  })

  it('reports missing project-local assets from project lint', async () => {
    const projectDir = mkdtempSync(join(tmpdir(), 'freecut-hyperframes-lint-'))
    try {
      writeFileSync(
        join(projectDir, 'index.html'),
        compositionHtml('<img id="poster" src="assets/missing-poster.png" />'),
      )

      const result = await lintProject(projectDir)
      const rootFindings = result.results.flatMap((entry) => entry.result.findings)

      expect(result.totalErrors).toBeGreaterThan(0)
      expect(rootFindings).toContainEqual(
        expect.objectContaining({
          code: 'missing_local_asset',
          severity: 'error',
        }),
      )
    } finally {
      rmSync(projectDir, { recursive: true, force: true })
    }
  })

  it('reports font and media findings with file locations', async () => {
    const result = await lintHyperframeHtml(
      compositionHtml(`
        <style>.title { font-family: "BrandSans"; }</style>
        <video id="clip" data-start="0" src="assets/clip.mp4" muted preload="none"></video>
      `),
      { filePath: 'compositions/main.html' },
    )

    expect(result.findings).toContainEqual(
      expect.objectContaining({
        code: 'font_family_without_font_face',
        severity: 'error',
        file: 'compositions/main.html',
      }),
    )
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        code: 'media_preload_none',
        severity: 'warning',
        file: 'compositions/main.html',
        elementId: 'clip',
      }),
    )
  })

  it('keeps shouldBlockRender aligned with strict error and strict all gates', () => {
    expect(shouldBlockRender(true, false, 1, 0)).toBe(true)
    expect(shouldBlockRender(true, false, 0, 1)).toBe(false)
    expect(shouldBlockRender(false, true, 0, 1)).toBe(true)
    expect(shouldBlockRender(false, false, 10, 10)).toBe(false)
  })
})
