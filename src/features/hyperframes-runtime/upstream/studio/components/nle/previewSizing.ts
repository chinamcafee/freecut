export interface PreviewCompositionSize {
  width: number
  height: number
}

const PREVIEW_STAGE_INSET_PX = 16

export function getPreviewPlayerKey({
  projectId,
  directUrl,
}: {
  projectId: string
  directUrl?: string
}): string {
  return directUrl ?? projectId
}

export function resolvePreviewStageSize(
  viewportWidth: number,
  viewportHeight: number,
  compositionSize: PreviewCompositionSize | null,
  portrait: boolean | undefined,
): { width: number; height: number } {
  const availableWidth = Math.max(0, viewportWidth - PREVIEW_STAGE_INSET_PX)
  const availableHeight = Math.max(0, viewportHeight - PREVIEW_STAGE_INSET_PX)
  const aspectRatio =
    compositionSize && compositionSize.width > 0 && compositionSize.height > 0
      ? compositionSize.width / compositionSize.height
      : portrait
        ? 9 / 16
        : 16 / 9

  if (availableWidth === 0 || availableHeight === 0) {
    return { width: 0, height: 0 }
  }

  let width = availableWidth
  let height = width / aspectRatio
  if (height > availableHeight) {
    height = availableHeight
    width = height * aspectRatio
  }

  return {
    width: Math.round(width * 10000) / 10000,
    height: Math.round(height * 10000) / 10000,
  }
}
