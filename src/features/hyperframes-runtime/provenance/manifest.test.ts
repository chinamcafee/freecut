import {
  findUpstreamPackage,
  getDirectHyperFramesImportPolicy,
  getImportRewriteTarget,
  importRewriteMap,
  listUpstreamPackages,
  upstreamManifest,
} from './manifest'

describe('hyperframes runtime provenance', () => {
  it('tracks every planned upstream source package inside the FreeCut runtime root', () => {
    expect(upstreamManifest.noRuntimeNpmDependency).toBe(true)
    expect(upstreamManifest.targetRoot).toBe('src/features/hyperframes-runtime')

    const packageIds = listUpstreamPackages().map((entry) => entry.id)

    expect(packageIds).toEqual([
      'core',
      'parsers',
      'lint',
      'player',
      'studio',
      'studio-server',
      'producer-node',
      'cli-tools',
      'skills',
    ])

    for (const entry of listUpstreamPackages()) {
      expect(entry.source).not.toContain('node_modules')
      expect(entry.target).toMatch(/^src\/features\/hyperframes-runtime\/upstream\//)
      expect(entry.strategy).toMatch(/^source-/)
    }
  })

  it('maps HyperFrames package specifiers to local source mirror targets', () => {
    expect(getImportRewriteTarget('@hyperframes/player')).toBe(
      '@/features/hyperframes-runtime/upstream/player',
    )
    expect(getImportRewriteTarget('@hyperframes/studio')).toBe(
      '@/features/hyperframes-runtime/upstream/studio',
    )
    expect(getImportRewriteTarget('@hyperframes/producer')).toBe(
      '@/features/hyperframes-runtime/upstream/producer-node',
    )

    for (const rule of importRewriteMap.rules) {
      expect(rule.from).toMatch(/^@hyperframes\//)
      expect(rule.to).not.toMatch(/^@hyperframes\//)
    }
  })

  it('keeps direct HyperFrames npm imports forbidden for business code', () => {
    const policy = getDirectHyperFramesImportPolicy()

    expect(policy.forbiddenInFreeCutBusinessCode).toBe(true)
    expect(policy.allowedOnlyDuringMigrationRewrite).toBe(true)
    expect(policy.message).toContain('src/features/hyperframes-runtime')
  })

  it('marks Node-only runtime packages so they can stay out of the browser bundle', () => {
    expect(findUpstreamPackage('producer-node')?.environment).toBe('local-service')
    expect(findUpstreamPackage('cli-tools')?.environment).toBe('local-service')
    expect(findUpstreamPackage('player')?.environment).toBe('browser')
    expect(findUpstreamPackage('studio')?.environment).toBe('browser')
  })
})
