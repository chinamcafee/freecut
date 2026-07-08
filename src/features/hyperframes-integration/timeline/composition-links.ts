import type {
  HyperFramesCompositionLink,
  HyperFramesIntegrationState,
  HyperFramesProjectManifest,
  HyperFramesRenderCacheEntry,
} from '@/types/hyperframes'
import type { TimelineItem } from '@/types/timeline'

export interface HyperFramesCompositionTimelineInfo {
  isHyperFramesBacked: boolean
  link?: HyperFramesCompositionLink
  manifest?: HyperFramesProjectManifest
  thumbnailPath?: string
  renderCache?: HyperFramesRenderCacheEntry
  entryFile?: string
  activeCompositionPath?: string
}

export function isHyperFramesCompositionItem(item: TimelineItem): boolean {
  return item.type === 'composition' && item.sourceKind === 'hyperframes'
}

export function resolveHyperFramesCompositionInfo(
  item: TimelineItem,
  hyperframes?: HyperFramesIntegrationState,
): HyperFramesCompositionTimelineInfo {
  if (item.type !== 'composition') {
    return { isHyperFramesBacked: false }
  }

  const link = hyperframes?.compositionLinks[item.id]
  const projectId = link?.projectId ?? item.hyperframesProjectId
  const manifest = projectId ? hyperframes?.projects[projectId] : undefined
  const renderCacheKey = link?.renderCacheKey
  const renderCache = renderCacheKey ? hyperframes?.renderCache?.[renderCacheKey] : undefined
  const isHyperFramesBacked =
    item.sourceKind === 'hyperframes' ||
    link?.sourceKind === 'hyperframes' ||
    Boolean(item.hyperframesManifestPath)
  const activeCompositionPath = isHyperFramesBacked
    ? (link?.activeCompositionPath ?? item.activeCompositionPath ?? manifest?.activeCompositionPath)
    : undefined

  return {
    isHyperFramesBacked,
    link,
    manifest,
    thumbnailPath: link?.thumbnailPath,
    renderCache,
    entryFile: manifest?.entryFile,
    activeCompositionPath,
  }
}

export function upsertHyperFramesCompositionLink(
  hyperframes: HyperFramesIntegrationState,
  link: HyperFramesCompositionLink,
): HyperFramesIntegrationState {
  return {
    ...hyperframes,
    compositionLinks: {
      ...hyperframes.compositionLinks,
      [link.timelineItemId]: link,
    },
  }
}

export function removeHyperFramesCompositionLink(
  hyperframes: HyperFramesIntegrationState,
  timelineItemId: string,
): HyperFramesIntegrationState {
  const { [timelineItemId]: _removed, ...compositionLinks } = hyperframes.compositionLinks

  return {
    ...hyperframes,
    compositionLinks,
  }
}
