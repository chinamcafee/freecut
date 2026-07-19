export type HyperFramesRuntimeEnvironment =
  | 'browser'
  | 'browser-and-local-service'
  | 'local-service'
  | 'task-sandbox'

export type HyperFramesRuntimeMigrationStrategy =
  | 'source-copy-with-import-rewrite'
  | 'source-subset-with-import-rewrite'
  | 'source-resource-copy'

export interface UpstreamPackageEntry {
  readonly id: string
  readonly displayName: string
  readonly source: string
  readonly target: string
  readonly environment: HyperFramesRuntimeEnvironment
  readonly strategy: HyperFramesRuntimeMigrationStrategy
  readonly notes: readonly string[]
}

export interface UpstreamManifest {
  readonly schemaVersion: 1
  readonly snapshotAt: string
  readonly hyperframesRoot: string
  readonly targetRoot: string
  readonly noRuntimeNpmDependency: true
  readonly packages: Readonly<Record<string, UpstreamPackageEntry>>
}

export interface ImportRewriteRule {
  readonly from: string
  readonly to: string
  readonly ownerPackage: string
  readonly nodeOnly: boolean
}

export interface DirectHyperFramesImportPolicy {
  readonly forbiddenInFreeCutBusinessCode: true
  readonly allowedOnlyDuringMigrationRewrite: true
  readonly message: string
}

export interface ImportRewriteMap {
  readonly schemaVersion: 1
  readonly policy: DirectHyperFramesImportPolicy
  readonly rules: readonly ImportRewriteRule[]
}
