import { DOMParser as LinkedomDOMParser } from 'linkedom'
import type { HyperFramesAssetRef, HyperFramesProjectDirectory } from '@/types/hyperframes'
import type { ProjectTimeline } from '@/types/project'
import type { TransformProperties } from '@/types/transform'
import type {
  HyperFramesProjectImportOptions,
  HyperFramesProjectImportResult,
} from './hyperFramesProjectImport'

export type HyperFramesApproximationKind =
  | 'audio'
  | 'composition'
  | 'image'
  | 'shape'
  | 'text'
  | 'video'

export type HyperFramesEditableApproximationItem = ProjectTimeline['items'][number]

export interface HyperFramesApproximationLossRecord {
  id: string
  sourceFile: string
  elementId?: string
  kind: HyperFramesApproximationKind | 'project'
  severity: 'info' | 'warning'
  fields: string[]
  message: string
}

export interface HyperFramesEditableApproximationOptions {
  directory: HyperFramesProjectDirectory
  targetTrackId: string
  startFrame?: number
  parentTimelineItemId: string
  resolveAssetSource?: (assetPath: string, asset?: HyperFramesAssetRef) => string | undefined
}

export interface HyperFramesEditableApproximationResult {
  items: HyperFramesEditableApproximationItem[]
  lossRecords: HyperFramesApproximationLossRecord[]
  canonicalSourcePreserved: true
}

export interface HyperFramesProjectImportWithApproximationsOptions
  extends HyperFramesProjectImportOptions {
  resolveAssetSource?: HyperFramesEditableApproximationOptions['resolveAssetSource']
}

export interface HyperFramesProjectImportWithApproximationsResult
  extends HyperFramesProjectImportResult {
  approximationItems: HyperFramesEditableApproximationItem[]
  lossRecords: HyperFramesApproximationLossRecord[]
  canonicalSourcePreserved: true
}

export function createEditableFreeCutApproximations(
  options: HyperFramesEditableApproximationOptions,
): HyperFramesEditableApproximationResult {
  const manifest = options.directory.manifest
  const sourceFile = manifest.activeCompositionPath
  const html = options.directory.files.find((file) => file.path === sourceFile)?.content
  if (!html) throw new Error(`HyperFrames active composition is missing: ${sourceFile}`)

  const document = new LinkedomDOMParser().parseFromString(html, 'text/html')
  const elements = [...document.querySelectorAll('[data-hf-item]')]
  const items: HyperFramesEditableApproximationItem[] = []
  const lossRecords: HyperFramesApproximationLossRecord[] = []

  if (document.querySelector('script')) {
    lossRecords.push(
      createLoss({
        sourceFile,
        kind: 'project',
        fields: ['script'],
        severity: 'warning',
        message: 'Scripts remain canonical in the HyperFrames source and are not copied to native items.',
      }),
    )
  }

  elements.forEach((element, index) => {
    const kind = resolveElementKind(element)
    if (!kind) {
      lossRecords.push(
        createLoss({
          sourceFile,
          elementId: element.id || undefined,
          kind: 'project',
          fields: ['element'],
          severity: 'warning',
          message: `Element ${element.id || index + 1} has no supported FreeCut approximation.`,
        }),
      )
      return
    }
    const result = createItem({ element, index, kind, options })
    if (result.item) items.push(result.item)
    lossRecords.push(...result.lossRecords)
  })

  return { items, lossRecords, canonicalSourcePreserved: true }
}

export async function importHyperFramesProjectDirectoryWithApproximations(
  options: HyperFramesProjectImportWithApproximationsOptions,
): Promise<HyperFramesProjectImportWithApproximationsResult> {
  const { importHyperFramesProjectDirectory } = await import('./hyperFramesProjectImport')
  const imported = await importHyperFramesProjectDirectory(options)
  const approximation = createEditableFreeCutApproximations({
    directory: options.directory,
    targetTrackId: imported.timelineItem.trackId,
    startFrame: imported.timelineItem.from,
    parentTimelineItemId: imported.timelineItem.id,
    resolveAssetSource: options.resolveAssetSource,
  })
  imported.project.timeline!.items.push(...approximation.items)
  const compositionLink = {
    ...imported.compositionLink,
    importStrategy: 'source-linked-with-approximations' as const,
  }
  imported.project.hyperframes!.compositionLinks[imported.timelineItem.id] = compositionLink

  return {
    ...imported,
    compositionLink,
    approximationItems: approximation.items,
    lossRecords: approximation.lossRecords,
    canonicalSourcePreserved: true,
  }
}

function createItem(input: {
  element: Element
  index: number
  kind: HyperFramesApproximationKind
  options: HyperFramesEditableApproximationOptions
}): {
  item: HyperFramesEditableApproximationItem | null
  lossRecords: HyperFramesApproximationLossRecord[]
} {
  const { element, kind, options } = input
  const manifest = options.directory.manifest
  const fps = manifest.canvas.fps
  const id = `${options.parentTimelineItemId}-native-${input.index + 1}`
  const from = (options.startFrame ?? 0) + secondsToFrames(element.getAttribute('data-start'), fps)
  const durationInFrames =
    secondsToFrames(element.getAttribute('data-duration'), fps) || manifest.canvas.durationInFrames
  const label =
    element.getAttribute('aria-label') ?? element.textContent?.trim().slice(0, 80) ?? kind
  const base = {
    id,
    trackId: options.targetTrackId,
    from,
    durationInFrames,
    label: label || `HyperFrames ${kind}`,
    linkedGroupId: options.parentTimelineItemId,
    originId: options.parentTimelineItemId,
    transform: readTransform(element),
  }
  const lossRecords = styleLosses(element, kind, manifest.activeCompositionPath)

  switch (kind) {
    case 'text':
      return {
        item: {
          ...base,
          type: 'text',
          text: element.textContent?.trim() ?? '',
          color: styleValue(element, 'color') || element.getAttribute('data-color') || '#ffffff',
          fontSize: numberStyleValue(element, 'font-size'),
          fontFamily: styleValue(element, 'font-family') || undefined,
        },
        lossRecords,
      }
    case 'video':
    case 'audio':
    case 'image': {
      const rawSource = element.getAttribute('src') ?? element.querySelector('source')?.getAttribute('src')
      const source = rawSource ? resolveAssetSource(rawSource, options) : undefined
      if (!source) {
        lossRecords.push(
          createLoss({
            sourceFile: manifest.activeCompositionPath,
            elementId: element.id || undefined,
            kind,
            fields: ['src'],
            severity: 'warning',
            message: `The ${kind} source could not be resolved to a FreeCut-editable asset.`,
          }),
        )
        return { item: null, lossRecords }
      }
      return { item: { ...base, type: kind, src: source }, lossRecords }
    }
    case 'shape':
      return {
        item: {
          ...base,
          type: 'shape',
          shapeType: shapeType(element),
          fillColor:
            element.getAttribute('data-fill') ??
            element.querySelector('[fill]')?.getAttribute('fill') ??
            styleValue(element, 'background-color') ??
            '#ffffff',
          strokeColor: element.querySelector('[stroke]')?.getAttribute('stroke') ?? undefined,
          strokeWidth: numberAttribute(element.querySelector('[stroke-width]'), 'stroke-width'),
        },
        lossRecords,
      }
    case 'composition': {
      const source = element.getAttribute('data-composition-src')
      const compositionPath = source
        ? resolveProjectRelativePath(manifest.activeCompositionPath, source)
        : undefined
      if (!compositionPath) return { item: null, lossRecords }
      lossRecords.push(
        createLoss({
          sourceFile: manifest.activeCompositionPath,
          elementId: element.id || undefined,
          kind,
          fields: ['nested-composition-runtime'],
          severity: 'info',
          message: 'Nested composition remains source-linked to the canonical HyperFrames project.',
        }),
      )
      return {
        item: {
          ...base,
          type: 'composition',
          compositionId: manifest.id,
          sourceKind: 'hyperframes',
          hyperframesProjectId: manifest.id,
          activeCompositionPath: compositionPath,
          hyperframesManifestPath: `hyperframes/${manifest.id}/manifest.json`,
          compositionWidth: manifest.canvas.width,
          compositionHeight: manifest.canvas.height,
        },
        lossRecords,
      }
    }
  }
}

function resolveElementKind(element: Element): HyperFramesApproximationKind | null {
  if (element.hasAttribute('data-composition-src')) return 'composition'
  const explicit = element.getAttribute('data-hf-type') || element.getAttribute('data-hf-item')
  if (
    explicit === 'text' || explicit === 'video' || explicit === 'audio' ||
    explicit === 'image' || explicit === 'shape' || explicit === 'composition'
  ) return explicit
  const tag = element.tagName.toLowerCase()
  if (tag === 'video' || tag === 'audio') return tag
  if (tag === 'img') return 'image'
  if (tag === 'svg') return 'shape'
  return null
}

function resolveAssetSource(
  rawSource: string,
  options: HyperFramesEditableApproximationOptions,
): string | undefined {
  if (/^(blob:|data:|https?:)/i.test(rawSource)) return rawSource
  const path = resolveProjectRelativePath(options.directory.manifest.activeCompositionPath, rawSource)
  if (!path) return undefined
  const asset = options.directory.manifest.assets.find((entry) => entry.path === path)
  return (
    options.resolveAssetSource?.(path, asset) ??
    asset?.originalUrl ??
    `hyperframes/${options.directory.manifest.id}/${path}`
  )
}

function resolveProjectRelativePath(fromFile: string, reference: string): string | undefined {
  try {
    const url = new URL(reference, `https://hyperframes.invalid/${fromFile}`)
    if (url.origin !== 'https://hyperframes.invalid') return undefined
    return decodeURIComponent(url.pathname.slice(1))
  } catch {
    return undefined
  }
}

function readTransform(element: Element): TransformProperties | undefined {
  const transform: TransformProperties = {}
  assignNumber(transform, 'x', numberStyleValue(element, 'left'))
  assignNumber(transform, 'y', numberStyleValue(element, 'top'))
  assignNumber(transform, 'width', numberStyleValue(element, 'width'))
  assignNumber(transform, 'height', numberStyleValue(element, 'height'))
  assignNumber(transform, 'opacity', numberStyleValue(element, 'opacity'))
  assignNumber(transform, 'cornerRadius', numberStyleValue(element, 'border-radius'))
  return Object.keys(transform).length > 0 ? transform : undefined
}

function styleLosses(
  element: Element,
  kind: HyperFramesApproximationKind,
  sourceFile: string,
): HyperFramesApproximationLossRecord[] {
  const style = (element as HTMLElement).style
  if (!style) return []
  const mapped = new Set([
    'left', 'top', 'width', 'height', 'opacity', 'border-radius',
    'color', 'font-size', 'font-family', 'background-color', 'z-index',
  ])
  const unsupported: string[] = []
  for (const property of Array.from(style as unknown as Iterable<string>)) {
    if (property && !mapped.has(property)) unsupported.push(property)
  }
  return unsupported.length === 0
    ? []
    : [
        createLoss({
          sourceFile,
          elementId: element.id || undefined,
          kind,
          fields: unsupported,
          severity: 'warning',
          message: `CSS properties ${unsupported.join(', ')} remain only in the HyperFrames source.`,
        }),
      ]
}

function styleValue(element: Element, property: string): string {
  return (element as HTMLElement).style?.getPropertyValue(property).trim() ?? ''
}

function numberStyleValue(element: Element, property: string): number | undefined {
  const value = Number.parseFloat(styleValue(element, property))
  return Number.isFinite(value) ? value : undefined
}

function numberAttribute(element: Element | null, attribute: string): number | undefined {
  const value = Number.parseFloat(element?.getAttribute(attribute) ?? '')
  return Number.isFinite(value) ? value : undefined
}

function assignNumber<K extends keyof TransformProperties>(
  target: TransformProperties,
  key: K,
  value: TransformProperties[K] | undefined,
): void {
  if (value !== undefined) target[key] = value
}

function shapeType(element: Element): 'circle' | 'ellipse' | 'triangle' | 'rectangle' {
  if (element.querySelector('circle')) return 'circle'
  if (element.querySelector('ellipse')) return 'ellipse'
  if (element.querySelector('polygon')) return 'triangle'
  return 'rectangle'
}

function secondsToFrames(value: string | null, fps: number): number {
  const seconds = Number(value)
  return Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds * fps) : 0
}

function createLoss(input: Omit<HyperFramesApproximationLossRecord, 'id'>): HyperFramesApproximationLossRecord {
  return {
    id: `hf-loss-${input.elementId ?? 'project'}-${input.fields.join('-')}`,
    ...input,
  }
}
