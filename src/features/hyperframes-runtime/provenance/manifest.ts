import importRewriteMapJson from './import-rewrite-map.json'
import upstreamManifestJson from './upstream-manifest.json'
import type {
  DirectHyperFramesImportPolicy,
  ImportRewriteMap,
  UpstreamManifest,
  UpstreamPackageEntry,
} from './types'

export const upstreamManifest = upstreamManifestJson as UpstreamManifest
export const importRewriteMap = importRewriteMapJson as ImportRewriteMap

export function listUpstreamPackages(): UpstreamPackageEntry[] {
  return Object.values(upstreamManifest.packages)
}

export function findUpstreamPackage(id: string): UpstreamPackageEntry | undefined {
  return upstreamManifest.packages[id]
}

export function getImportRewriteTarget(specifier: string): string | undefined {
  return importRewriteMap.rules.find((rule) => rule.from === specifier)?.to
}

export function getDirectHyperFramesImportPolicy(): DirectHyperFramesImportPolicy {
  return importRewriteMap.policy
}
