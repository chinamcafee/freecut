import type { Project, ProjectTimeline } from '@/types/project'
import type {
  HyperFramesAssetKind,
  HyperFramesAssetRef,
  HyperFramesBinaryAsset,
  HyperFramesDiagnostic,
  HyperFramesProjectDirectory,
  HyperFramesProjectFile,
  HyperFramesProjectManifest,
} from '@/types/hyperframes'
import {
  hashHyperFramesBytes,
  hashHyperFramesText,
  reconcileHyperFramesPreviewSignature,
  stableHyperFramesHash,
} from '../../adapters/freecut-project/project-signatures'

type FreeCutTimelineItem = ProjectTimeline['items'][number]

export interface FreeCutProjectAssetRequest {
  item: FreeCutTimelineItem
  source: string
  projectPath: string
}

export interface FreeCutProjectExportOptions {
  projectId?: string
  includeAudio?: boolean
  resolveAsset?: (
    request: FreeCutProjectAssetRequest,
  ) => Promise<Uint8Array | undefined> | Uint8Array | undefined
  now?: number
}

export interface FreeCutProjectExportResult {
  directory: HyperFramesProjectDirectory
  warnings: string[]
  unsupportedFeatures: string[]
}

interface ExportContext {
  project: Project
  includeAudio: boolean
  assetPaths: Map<string, string>
  warnings: string[]
  unsupportedFeatures: string[]
}

export async function exportFreeCutProjectToHyperFramesDirectory(
  project: Project,
  options: FreeCutProjectExportOptions = {},
): Promise<FreeCutProjectExportResult> {
  if (!project.timeline) throw new Error('FreeCut project does not contain a timeline.')

  const projectId = normalizeProjectId(options.projectId ?? `freecut-${project.id}`)
  const allItems = [
    ...project.timeline.items,
    ...(project.timeline.compositions?.flatMap((composition) => composition.items) ?? []),
  ]
  const assetPaths = buildAssetPaths(allItems)
  const context: ExportContext = {
    project,
    includeAudio: options.includeAudio ?? true,
    assetPaths,
    warnings: [],
    unsupportedFeatures: [],
  }
  const activeCompositionPath = 'compositions/main.html'
  const files: HyperFramesProjectFile[] = []

  files.push(
    createTextFile(
      'index.html',
      createEntryHtml(project.name, project.metadata.width, activeCompositionPath),
    ),
    createTextFile(
      activeCompositionPath,
      createCompositionHtml(project.timeline, context, {
        id: 'main',
        title: project.name,
        width: project.metadata.width,
        height: project.metadata.height,
        fps: project.metadata.fps,
        durationInFrames: project.duration,
        backgroundColor: project.metadata.backgroundColor,
      }),
    ),
  )

  for (const composition of project.timeline.compositions ?? []) {
    files.push(
      createTextFile(
        compositionPath(composition.id),
        createCompositionHtml(
          { tracks: composition.tracks, items: composition.items },
          context,
          {
            id: composition.id,
            title: composition.name,
            width: composition.width,
            height: composition.height,
            fps: composition.fps,
            durationInFrames: composition.durationInFrames,
            backgroundColor: composition.backgroundColor,
          },
        ),
      ),
    )
  }

  if ((project.timeline.keyframes?.length ?? 0) > 0) {
    files.push(
      createTextFile(
        'metadata/freecut-keyframes.json',
        JSON.stringify(project.timeline.keyframes, null, 2),
      ),
    )
    addUnique(context.warnings, 'FreeCut keyframes were preserved as conversion metadata.')
    addUnique(context.unsupportedFeatures, 'freecut-keyframe-runtime')
  }

  const { refs, assets } = await createAssets(allItems, assetPaths, options.resolveAsset)
  const now = options.now ?? Date.now()
  const diagnostics = context.warnings.map((message, index): HyperFramesDiagnostic => ({
    id: `freecut-export-warning-${index + 1}`,
    code: 'hyperframes.conversion.freecut-export-loss',
    source: 'parser',
    stage: 'import',
    severity: 'warning',
    message,
    fixHint: 'Keep the FreeCut source project when exact round-trip editing is required.',
  }))
  const manifest: HyperFramesProjectManifest = {
    schemaVersion: 1,
    id: projectId,
    title: project.name,
    entryFile: 'index.html',
    activeCompositionPath,
    canvas: {
      width: project.metadata.width,
      height: project.metadata.height,
      fps: project.metadata.fps,
      durationInFrames: project.duration,
      backgroundColor: project.metadata.backgroundColor,
    },
    assets: refs,
    provenance: {
      source: 'freecut-export',
      createdAt: now,
      updatedAt: now,
      freecutProjectId: project.id,
      adapterVersion: 'freecut-conversion-v1',
      confirmedByUser: false,
    },
    diagnostics,
    tags: ['freecut-export'],
    adapterVersion: 'freecut-conversion-v1',
  }
  const directory: HyperFramesProjectDirectory = { manifest, files, assets }
  directory.manifest = reconcileHyperFramesPreviewSignature(directory)

  return {
    directory,
    warnings: [...context.warnings],
    unsupportedFeatures: [...context.unsupportedFeatures],
  }
}

function createEntryHtml(title: string, width: number, activeCompositionPath: string): string {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=${width}"><title>${escapeHtml(title)}</title></head>
<body><div data-composition-src="${escapeAttribute(activeCompositionPath)}"></div></body>
</html>`
}

function createCompositionHtml(
  timeline: Pick<ProjectTimeline, 'tracks' | 'items'>,
  context: ExportContext,
  composition: {
    id: string
    title: string
    width: number
    height: number
    fps: number
    durationInFrames: number
    backgroundColor?: string
  },
): string {
  const trackOrder = new Map(
    [...timeline.tracks]
      .sort((left, right) => left.order - right.order)
      .map((track, index) => [track.id, index]),
  )
  const itemHtml = timeline.items
    .map((item) => createItemHtml(item, composition.fps, trackOrder, context))
    .filter((value): value is string => value !== null)
    .join('\n    ')

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"><meta name="viewport" content="width=${composition.width}"><title>${escapeHtml(composition.title)}</title>
  <style>html,body{margin:0;width:${composition.width}px;height:${composition.height}px;overflow:hidden;background:${escapeCssColor(composition.backgroundColor)}}[data-hf-stage]{position:relative;width:100%;height:100%;overflow:hidden}[data-hf-item]{position:absolute;box-sizing:border-box}</style>
</head>
<body>
  <main data-hf-stage data-composition-id="${escapeAttribute(composition.id)}" data-width="${composition.width}" data-height="${composition.height}" data-fps="${composition.fps}" data-duration-frames="${composition.durationInFrames}">
    ${itemHtml}
  </main>
</body>
</html>`
}

function createItemHtml(
  item: FreeCutTimelineItem,
  fps: number,
  trackOrder: Map<string, number>,
  context: ExportContext,
): string | null {
  if (hasAudioEq(item)) {
    addUnique(context.warnings, `Audio EQ on item "${item.label}" cannot be represented exactly.`)
    addUnique(context.unsupportedFeatures, 'audio-eq')
  }

  const attributes = [
    `id="${escapeAttribute(item.id)}"`,
    'data-hf-item',
    `data-hf-type="${escapeAttribute(item.type)}"`,
    `data-start="${formatNumber(item.from / fps)}"`,
    `data-duration="${formatNumber(item.durationInFrames / fps)}"`,
    `data-freecut-track-id="${escapeAttribute(item.trackId)}"`,
    `data-track-index="${trackOrder.get(item.trackId) ?? 0}"`,
  ]
  const style = itemStyle(item, trackOrder.get(item.trackId) ?? 0)
  attributes.push(`style="${escapeAttribute(style)}"`)
  const attrs = attributes.join(' ')

  switch (item.type) {
    case 'video':
      return item.src
        ? `<video ${attrs} src="${escapeAttribute(assetReference(item.src, context.assetPaths))}"></video>`
        : missingSource(item, context)
    case 'audio':
      if (!context.includeAudio) return null
      return item.src
        ? `<audio ${attrs} src="${escapeAttribute(assetReference(item.src, context.assetPaths))}"></audio>`
        : missingSource(item, context)
    case 'image':
      return item.src
        ? `<img ${attrs} src="${escapeAttribute(assetReference(item.src, context.assetPaths))}" alt="${escapeAttribute(item.label)}">`
        : missingSource(item, context)
    case 'text':
      return `<div ${attrs}>${escapeHtml(item.text ?? '')}</div>`
    case 'shape':
      return `<svg ${attrs} viewBox="0 0 ${item.transform?.width ?? 100} ${item.transform?.height ?? 100}" aria-label="${escapeAttribute(item.label)}">${shapeMarkup(item, context)}</svg>`
    case 'composition':
      if (item.sourceKind === 'hyperframes') {
        addUnique(
          context.warnings,
          `Source-linked HyperFrames composition "${item.label}" remains an external project reference.`,
        )
        addUnique(context.unsupportedFeatures, 'external-hyperframes-composition')
        return `<div ${attrs} data-hf-external-project-id="${escapeAttribute(item.hyperframesProjectId ?? item.compositionId ?? item.id)}"></div>`
      }
      return `<div ${attrs} data-composition-src="${escapeAttribute(compositionPath(item.compositionId ?? item.id).replace('compositions/', ''))}"></div>`
    default:
      addUnique(context.warnings, `FreeCut item type "${item.type}" was omitted from the HTML composition.`)
      addUnique(context.unsupportedFeatures, item.type)
      return null
  }
}

function itemStyle(item: FreeCutTimelineItem, zIndex: number): string {
  const transform = item.transform
  const styles = [
    `left:${formatNumber(transform?.x ?? 0)}px`,
    `top:${formatNumber(transform?.y ?? 0)}px`,
    `z-index:${zIndex}`,
  ]
  if (transform?.width !== undefined) styles.push(`width:${formatNumber(transform.width)}px`)
  if (transform?.height !== undefined) styles.push(`height:${formatNumber(transform.height)}px`)
  if (transform?.rotation) styles.push(`transform:rotate(${formatNumber(transform.rotation)}deg)`)
  if (transform?.opacity !== undefined) styles.push(`opacity:${formatNumber(transform.opacity)}`)
  if (transform?.cornerRadius !== undefined) {
    styles.push(`border-radius:${formatNumber(transform.cornerRadius)}px`)
  }
  if (item.type === 'text') {
    styles.push(`font-size:${formatNumber(item.fontSize ?? 24)}px`)
    styles.push(`font-family:${cssFontFamily(item.fontFamily ?? 'Arial')}`)
    styles.push(`color:${escapeCssColor(item.color)}`)
  }
  return styles.join(';')
}

function shapeMarkup(item: FreeCutTimelineItem, context: ExportContext): string {
  const width = item.transform?.width ?? 100
  const height = item.transform?.height ?? 100
  const fill = escapeCssColor(item.fillColor)
  const stroke = item.strokeColor ? escapeCssColor(item.strokeColor) : 'none'
  const common = `fill="${fill}" stroke="${stroke}" stroke-width="${item.strokeWidth ?? 0}"`
  switch (item.shapeType) {
    case 'circle':
      return `<circle cx="${width / 2}" cy="${height / 2}" r="${Math.min(width, height) / 2}" ${common}/>`
    case 'ellipse':
      return `<ellipse cx="${width / 2}" cy="${height / 2}" rx="${width / 2}" ry="${height / 2}" ${common}/>`
    case 'triangle':
      return `<polygon points="${width / 2},0 ${width},${height} 0,${height}" ${common}/>`
    case 'rectangle':
    case undefined:
      return `<rect width="${width}" height="${height}" rx="${item.transform?.cornerRadius ?? 0}" ${common}/>`
    default:
      addUnique(context.warnings, `Shape "${item.label}" was approximated as a rectangle.`)
      addUnique(context.unsupportedFeatures, `shape:${item.shapeType}`)
      return `<rect width="${width}" height="${height}" ${common}/>`
  }
}

async function createAssets(
  items: FreeCutTimelineItem[],
  paths: Map<string, string>,
  resolver: FreeCutProjectExportOptions['resolveAsset'],
): Promise<{ refs: HyperFramesAssetRef[]; assets: HyperFramesBinaryAsset[] }> {
  const refs: HyperFramesAssetRef[] = []
  const assets: HyperFramesBinaryAsset[] = []
  const seen = new Set<string>()
  for (const item of items) {
    if (!isMediaItem(item) || !item.src || seen.has(item.src)) continue
    seen.add(item.src)
    const path = paths.get(item.src)!
    const bytes = await resolver?.({ item, source: item.src, projectPath: path })
    const hash = bytes ? hashHyperFramesBytes(bytes) : stableHyperFramesHash(item.src)
    const mimeType = inferMimeType(path, item.type)
    refs.push({
      id: `asset-${refs.length + 1}`,
      path,
      kind: item.type,
      mimeType,
      hash,
      bytes: bytes?.byteLength,
      width: item.sourceWidth,
      height: item.sourceHeight,
      durationInFrames: item.sourceDuration,
      originalUrl: item.src,
      originalMediaId: item.mediaId,
    })
    if (bytes) assets.push({ path, bytes, mimeType, hash })
  }
  return { refs, assets }
}

function buildAssetPaths(items: FreeCutTimelineItem[]): Map<string, string> {
  const result = new Map<string, string>()
  for (const item of items) {
    if (!isMediaItem(item) || !item.src || result.has(item.src)) continue
    const sourceName = item.src.split(/[\\/]/).pop()?.split(/[?#]/, 1)[0] || `${item.type}.bin`
    const safeName = sourceName.replace(/[^a-zA-Z0-9._-]+/g, '-')
    result.set(item.src, `assets/${result.size + 1}-${safeName}`)
  }
  return result
}

function assetReference(source: string, paths: Map<string, string>): string {
  return `../${paths.get(source) ?? source}`
}

function createTextFile(path: string, content: string): HyperFramesProjectFile {
  return { path, content, encoding: 'utf8', hash: hashHyperFramesText(content) }
}

function missingSource(item: FreeCutTimelineItem, context: ExportContext): null {
  addUnique(context.warnings, `Media item "${item.label}" has no source and was omitted.`)
  return null
}

function isMediaItem(
  item: FreeCutTimelineItem,
): item is FreeCutTimelineItem & { type: 'video' | 'audio' | 'image' } {
  return item.type === 'video' || item.type === 'audio' || item.type === 'image'
}

function hasAudioEq(item: FreeCutTimelineItem): boolean {
  return Object.entries(item).some(
    ([key, value]) => key.startsWith('audioEq') && value !== undefined && value !== false,
  )
}

function compositionPath(id: string): string {
  return `compositions/${normalizeProjectId(id)}.html`
}

function normalizeProjectId(value: string): string {
  const normalized = value.trim().replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '')
  return normalized || 'freecut-project'
}

function inferMimeType(path: string, kind: HyperFramesAssetKind): string | undefined {
  const extension = path.split('.').pop()?.toLowerCase()
  const byExtension: Record<string, string> = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif',
    mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime',
    mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4',
  }
  return (extension && byExtension[extension]) || (kind === 'image' ? 'image/*' : kind === 'video' ? 'video/*' : kind === 'audio' ? 'audio/*' : undefined)
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => HTML_ESCAPES[character] ?? character)
}

function escapeAttribute(value: string): string {
  return escapeHtml(value)
}

function escapeCssColor(value: string | undefined): string {
  return value && /^(#[0-9a-f]{3,8}|rgba?\([0-9.,% ]+\)|[a-z]+)$/i.test(value)
    ? value
    : '#000000'
}

function cssFontFamily(value: string): string {
  return /^[a-zA-Z0-9 ,-]+$/.test(value) ? value : 'Arial'
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')
}

function addUnique(values: string[], value: string): void {
  if (!values.includes(value)) values.push(value)
}

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}
