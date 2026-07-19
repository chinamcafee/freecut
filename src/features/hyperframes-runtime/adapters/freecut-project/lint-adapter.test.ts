import type { HyperFramesProjectDirectory } from '@/types/hyperframes'
import {
  createHyperFramesLintAdapter,
  mapHyperFrameLintFindingToDiagnostic,
  type HyperFramesLintStage,
} from './lint-adapter'

const html = `<!doctype html>
<html>
  <body>
    <div data-composition-id="main" data-width="1920" data-height="1080">
      <video id="clip" data-start="0" src="assets/clip.mp4" muted preload="none"></video>
    </div>
  </body>
</html>`

const directory: HyperFramesProjectDirectory = {
  manifest: {
    schemaVersion: 1,
    id: 'hf-project',
    title: 'HyperFrames Project',
    entryFile: 'index.html',
    activeCompositionPath: 'compositions/main.html',
    canvas: {
      width: 1920,
      height: 1080,
      fps: 30,
      durationInFrames: 90,
    },
    assets: [],
    provenance: {
      source: 'skill-output',
      createdAt: 1784304000000,
    },
  },
  files: [
    {
      path: 'index.html',
      content: '<!doctype html><html><body></body></html>',
      encoding: 'utf8',
    },
    {
      path: 'compositions/main.html',
      content: `<!doctype html>
<html>
  <body>
    <div data-composition-id="main" data-width="1920" data-height="1080">
      <img id="poster" src="../assets/missing-poster.png" />
    </div>
  </body>
</html>`,
      encoding: 'utf8',
    },
  ],
  assets: [],
}

describe('HyperFrames lint adapter', () => {
  const adapter = createHyperFramesLintAdapter()

  it('maps upstream lint findings to FreeCut diagnostics with location metadata', () => {
    const diagnostic = mapHyperFrameLintFindingToDiagnostic(
      {
        code: 'media_preload_none',
        severity: 'warning',
        message: 'preload none',
        file: 'compositions/main.html',
        selector: '#clip',
        elementId: 'clip',
        snippet: '<video id="clip">',
        fixHint: 'Remove preload="none".',
      },
      { stage: 'preview' },
    )

    expect(diagnostic).toMatchObject({
      code: 'hyperframes.lint.media_preload_none',
      source: 'lint',
      stage: 'preview',
      severity: 'warning',
      file: 'compositions/main.html',
      selector: '#clip',
      elementId: 'clip',
      snippet: '<video id="clip">',
      fixHint: 'Remove preload="none".',
    })
  })

  it('uses the same diagnostic model for import, save, preview and export stages', async () => {
    const stages: HyperFramesLintStage[] = ['import', 'studio-save', 'preview', 'export']

    for (const stage of stages) {
      const result = await adapter.lintHtml(html, {
        stage,
        file: 'compositions/main.html',
        checkedAt: 1784305000000,
      })

      expect(result.summary.checkedAt).toBe(1784305000000)
      expect(result.diagnostics).toContainEqual(
        expect.objectContaining({
          code: 'hyperframes.lint.media_preload_none',
          source: 'lint',
          stage,
          severity: 'warning',
          file: 'compositions/main.html',
          elementId: 'clip',
        }),
      )
    }
  })

  it('exposes export gate decisions from the shared lint summary', async () => {
    const scriptWithError = `<!doctype html><html><body>
      <div data-composition-id="main" data-width="1920" data-height="1080">
        <script>const offset = Math.random() * 100;</script>
      </div>
    </body></html>`

    const blocking = await adapter.lintHtml(scriptWithError, {
      stage: 'export',
      file: 'compositions/main.html',
    })
    const strictWarning = await adapter.lintHtml(html, {
      stage: 'export',
      file: 'compositions/main.html',
      strictAll: true,
    })

    expect(blocking.shouldBlockRender).toBe(true)
    expect(blocking.summary.blockingCount).toBeGreaterThan(0)
    expect(strictWarning.summary.warningCount).toBeGreaterThan(0)
    expect(strictWarning.shouldBlockRender).toBe(true)
  })

  it('lints project directories and maps missing assets to blocking diagnostics', async () => {
    const result = await adapter.lintProjectDirectory(directory, {
      stage: 'import',
      checkedAt: 1784306000000,
      activeCompositionOnly: true,
    })

    expect(result.ok).toBe(false)
    expect(result.summary.checkedAt).toBe(1784306000000)
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: 'hyperframes.lint.missing_local_asset',
        source: 'lint',
        stage: 'import',
        severity: 'blocking',
        file: 'compositions/main.html',
      }),
    )
  })
})
