import type {
  HyperFramesProjectManifest,
  HyperFramesRenderCacheEntry,
} from '@/types/hyperframes'
import type { TimelineItem } from '@/types/timeline'

export type HyperFramesProjectLibraryStatus = 'blocked' | 'ready' | 'warning'
export type HyperFramesProjectLibraryCacheStatus = 'cached' | 'missing' | 'stale'

export interface HyperFramesProjectLibraryEntry {
  id: string
  manifest: HyperFramesProjectManifest
  title: string
  updatedAt: number
  referenceItemIds: string[]
  referenceLabels: string[]
  referenceCount: number
  status: HyperFramesProjectLibraryStatus
  blockingCount: number
  warningCount: number
  cacheStatus: HyperFramesProjectLibraryCacheStatus
  thumbnailUrl?: string
}

export interface CreateHyperFramesProjectLibraryEntriesOptions {
  manifests: HyperFramesProjectManifest[]
  timelineItems: TimelineItem[]
  renderCache?: HyperFramesRenderCacheEntry[]
  thumbnailUrls?: Record<string, string>
}

export function createHyperFramesProjectLibraryEntries({
  manifests,
  timelineItems,
  renderCache = [],
  thumbnailUrls = {},
}: CreateHyperFramesProjectLibraryEntriesOptions): HyperFramesProjectLibraryEntry[] {
  return manifests
    .map((manifest) => {
      const references = timelineItems.filter(
        (item) =>
          item.type === 'composition' &&
          item.sourceKind === 'hyperframes' &&
          (item.hyperframesProjectId ?? item.compositionId) === manifest.id,
      )
      const diagnostics = manifest.lintSummary?.diagnostics ?? manifest.diagnostics ?? []
      const blockingCount =
        manifest.lintSummary?.blockingCount ??
        diagnostics.filter((diagnostic) => diagnostic.severity === 'blocking').length
      const warningCount =
        manifest.lintSummary?.warningCount ??
        diagnostics.filter((diagnostic) => diagnostic.severity === 'warning').length
      const cacheEntries = renderCache.filter((entry) => entry.hyperframesProjectId === manifest.id)
      const hasFreshCache = cacheEntries.some(
        (entry) => !manifest.renderSignature || entry.renderSignature === manifest.renderSignature,
      )

      return {
        id: manifest.id,
        manifest,
        title: manifest.title,
        updatedAt: manifest.provenance.updatedAt ?? manifest.provenance.createdAt,
        referenceItemIds: references.map((item) => item.id),
        referenceLabels: references.map((item) => item.label),
        referenceCount: references.length,
        status: blockingCount > 0 ? 'blocked' : warningCount > 0 ? 'warning' : 'ready',
        blockingCount,
        warningCount,
        cacheStatus:
          cacheEntries.length === 0 ? 'missing' : hasFreshCache ? 'cached' : 'stale',
        thumbnailUrl: thumbnailUrls[manifest.id],
      } satisfies HyperFramesProjectLibraryEntry
    })
    .sort((left, right) => right.updatedAt - left.updatedAt || left.title.localeCompare(right.title))
}
