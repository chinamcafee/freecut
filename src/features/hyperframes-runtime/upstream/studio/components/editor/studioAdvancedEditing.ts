import {
  patchElementInHtml,
  type PatchOperation,
  type SourceMutationTarget,
} from '../../../studio-server/helpers/sourceMutation.js'
import { parseStyleDecls } from '../../../studio-server/helpers/sourceStyleMutation.js'

export interface DomEditLayerGeometry {
  left: number
  top: number
  width: number
  height: number
}

export interface DomEditLayerItem {
  key: string
  label: string
  tagName: string
  depth: number
  childCount: number
  sourceFile: string
  target: SourceMutationTarget
  inlineStyles: Record<string, string>
  dataAttributes: Record<string, string>
  geometry: DomEditLayerGeometry | null
  zIndex: number
}

export interface DomEditPatchResult {
  html: string
  matched: boolean
  operations: PatchOperation[]
}

export interface StudioSnapGuide {
  axis: 'x' | 'y'
  value: number
  label?: string
}

export interface StudioSnapResult {
  x: number
  y: number
  guides: StudioSnapGuide[]
}

export interface StudioMotionPathPoint {
  x: number
  y: number
}

const IGNORED_TAGS = new Set(['html', 'head', 'body', 'script', 'style', 'template', 'meta'])

function parseHtmlDocument(html: string): Document {
  if (typeof DOMParser !== 'undefined') {
    return new DOMParser().parseFromString(html, 'text/html')
  }
  throw new Error('DOMParser is required for Studio advanced editing.')
}

function readInlineStyles(el: Element): Record<string, string> {
  const { props } = parseStyleDecls(el.getAttribute('style') ?? '')
  return Object.fromEntries(props.entries())
}

function readDataAttributes(el: Element): Record<string, string> {
  return Object.fromEntries(
    Array.from(el.attributes)
      .filter((attribute) => attribute.name.startsWith('data-'))
      .map((attribute) => [attribute.name, attribute.value]),
  )
}

function numberFromStyle(styles: Record<string, string>, key: string, fallback: number): number {
  const value = Number.parseFloat(styles[key] ?? '')
  return Number.isFinite(value) ? value : fallback
}

function geometryFromStyles(styles: Record<string, string>): DomEditLayerGeometry | null {
  const width = numberFromStyle(styles, 'width', 120)
  const height = numberFromStyle(styles, 'height', 72)
  const left = numberFromStyle(styles, 'left', 0)
  const top = numberFromStyle(styles, 'top', 0)
  if (width <= 0 || height <= 0) return null
  return { left, top, width, height }
}

function selectorForElement(el: Element): Pick<SourceMutationTarget, 'id' | 'hfId' | 'selector'> {
  const hfId = el.getAttribute('data-hf-id')
  if (hfId) return { hfId, selector: `[data-hf-id="${hfId.replace(/"/g, '\\"')}"]` }
  if (el.id) return { id: el.id, selector: `#${el.id.replace(/([^\w-])/g, '\\$1')}` }
  const compositionId = el.getAttribute('data-composition-id')
  if (compositionId) {
    return {
      selector: `[data-composition-id="${compositionId.replace(/"/g, '\\"')}"]`,
    }
  }
  return { selector: el.tagName.toLowerCase() }
}

function nonEmptyAttribute(el: Element, attribute: string): string | null {
  const value = el.getAttribute(attribute)?.trim()
  return value ? value : null
}

function keyForLayer(el: Element, index: number): string {
  return (
    nonEmptyAttribute(el, 'data-hf-id') ??
    (el.id.trim() || null) ??
    nonEmptyAttribute(el, 'data-composition-id') ??
    `${el.tagName.toLowerCase()}:${index}`
  )
}

function labelForLayer(el: Element, index: number): string {
  return (
    nonEmptyAttribute(el, 'aria-label') ??
    nonEmptyAttribute(el, 'data-label') ??
    (el.id.trim() || null) ??
    nonEmptyAttribute(el, 'data-hf-id') ??
    `${el.tagName.toLowerCase()} ${index + 1}`
  )
}

function depthOfElement(el: Element): number {
  let depth = 0
  let parent = el.parentElement
  while (parent && !['body', 'html'].includes(parent.tagName.toLowerCase())) {
    depth += 1
    parent = parent.parentElement
  }
  return depth
}

export function extractDomEditLayers(html: string, sourceFile: string): DomEditLayerItem[] {
  const document = parseHtmlDocument(html)
  const elements = Array.from(document.body.querySelectorAll('*')).filter(
    (el) => !IGNORED_TAGS.has(el.tagName.toLowerCase()),
  )
  const selectorIndexByTag = new Map<string, number>()
  return elements.map((el, index) => {
    const inlineStyles = readInlineStyles(el)
    const zIndex = Number.parseInt(inlineStyles['z-index'] ?? '0', 10)
    const selector = selectorForElement(el)
    const fallbackTag = el.tagName.toLowerCase()
    const fallbackIndex = selectorIndexByTag.get(fallbackTag) ?? 0
    selectorIndexByTag.set(fallbackTag, fallbackIndex + 1)
    return {
      key: keyForLayer(el, index),
      label: labelForLayer(el, index),
      tagName: el.tagName.toLowerCase(),
      depth: depthOfElement(el),
      childCount: el.children.length,
      sourceFile,
      target: {
        ...selector,
        selectorIndex:
          selector.id || selector.hfId || selector.selector?.startsWith('[data-')
            ? undefined
            : fallbackIndex,
      },
      inlineStyles,
      dataAttributes: readDataAttributes(el),
      geometry: geometryFromStyles(inlineStyles),
      zIndex: Number.isFinite(zIndex) ? zIndex : 0,
    }
  })
}

export function sortLayersByVisualStack(layers: readonly DomEditLayerItem[]): DomEditLayerItem[] {
  return [...layers].sort((left, right) => {
    if (left.zIndex !== right.zIndex) return right.zIndex - left.zIndex
    if (left.depth !== right.depth) return left.depth - right.depth
    return left.key.localeCompare(right.key)
  })
}

export function buildInlineStylePatch(property: string, value: string | null): PatchOperation {
  return { type: 'inline-style', property, value }
}

export function buildTextContentPatch(value: string): PatchOperation {
  return { type: 'text-content', property: 'textContent', value }
}

export function buildManualMovePatch(dx: number, dy: number): PatchOperation[] {
  return [
    buildInlineStylePatch('--hf-studio-offset-x', `${Math.round(dx * 1000) / 1000}px`),
    buildInlineStylePatch('--hf-studio-offset-y', `${Math.round(dy * 1000) / 1000}px`),
  ]
}

export function applyDomEditOperationsToHtml(
  html: string,
  target: SourceMutationTarget,
  operations: PatchOperation[],
): DomEditPatchResult {
  const result = patchElementInHtml(html, target, operations)
  return {
    html: result.html,
    matched: result.matched,
    operations,
  }
}

export function snapPointToGuides(
  point: { x: number; y: number },
  guides: readonly StudioSnapGuide[],
  threshold = 8,
): StudioSnapResult {
  let x = point.x
  let y = point.y
  const matched: StudioSnapGuide[] = []
  for (const guide of guides) {
    if (guide.axis === 'x' && Math.abs(point.x - guide.value) <= threshold) {
      x = guide.value
      matched.push(guide)
    }
    if (guide.axis === 'y' && Math.abs(point.y - guide.value) <= threshold) {
      y = guide.value
      matched.push(guide)
    }
  }
  return { x, y, guides: matched }
}

export function serializeMotionPath(points: readonly StudioMotionPathPoint[]): string {
  if (points.length === 0) return ''
  const [first, ...rest] = points
  const commands = [`M ${first!.x} ${first!.y}`, ...rest.map((point) => `L ${point.x} ${point.y}`)]
  return commands.join(' ')
}

export function buildMotionPathPatch(points: readonly StudioMotionPathPoint[]): PatchOperation[] {
  const path = serializeMotionPath(points)
  return [
    { type: 'attribute', property: 'hf-studio-motion-path', value: path },
    buildInlineStylePatch('offset-path', path ? `path("${path}")` : null),
  ]
}
