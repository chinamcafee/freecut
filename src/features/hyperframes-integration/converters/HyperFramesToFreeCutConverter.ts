/**
 * HyperFrames project directory → FreeCut importer.
 *
 * This importer intentionally treats the HyperFrames project directory as
 * canonical. It creates editable FreeCut approximations for supported clips
 * and also adds a source-linked composition item with compositionLinks.
 */

import type { Project, ProjectTimeline } from '@/types/project'
import type {
  HyperFramesCompositionLink,
  HyperFramesProjectDirectory,
  HyperFramesProjectManifest,
} from '@/types/hyperframes'

export interface HyperFramesImportResult {
  project: Project
  warnings: string[]
  unsupportedFeatures: string[]
}

type TimelineItem = ProjectTimeline['items'][number]

export class HyperFramesToFreeCutConverter {
  convert(projectDirectory: HyperFramesProjectDirectory): HyperFramesImportResult {
    const warnings = [
      'Imported HyperFrames project as a source-linked FreeCut composition; arbitrary scripts remain canonical in the project directory',
    ]
    const unsupportedFeatures = new Set<string>()
    const manifest = projectDirectory.manifest
    const compositionHtml = projectDirectory.files[manifest.activeCompositionPath]

    if (!compositionHtml) {
      throw new Error(`Missing active composition file: ${manifest.activeCompositionPath}`)
    }

    const parsed = this.parseCompositionHtml(compositionHtml, manifest, unsupportedFeatures)
    const compositionItemId = `hf-${manifest.id}`
    const compositionLink: HyperFramesCompositionLink = {
      timelineItemId: compositionItemId,
      projectId: manifest.id,
      sourceKind: 'hyperframes',
      activeCompositionPath: manifest.activeCompositionPath,
      manifestPath: `${manifest.projectDir}/manifest.json`,
    }
    const compositionItem: TimelineItem = {
      id: compositionItemId,
      type: 'composition',
      sourceKind: 'hyperframes',
      hyperframesProjectId: manifest.id,
      activeCompositionPath: manifest.activeCompositionPath,
      hyperframesManifestPath: compositionLink.manifestPath,
      compositionId: manifest.id,
      compositionWidth: manifest.width,
      compositionHeight: manifest.height,
      trackId: parsed.compositionTrackId,
      from: 0,
      durationInFrames: manifest.durationInFrames,
      label: manifest.name,
    }

    const project: Project = {
      id: `imported-${manifest.id}`,
      name: manifest.name,
      description: `Imported from HyperFrames project ${manifest.id}`,
      createdAt: manifest.createdAt,
      updatedAt: manifest.updatedAt,
      duration: manifest.durationInFrames,
      schemaVersion: 13,
      metadata: {
        width: manifest.width,
        height: manifest.height,
        fps: manifest.fps.num / manifest.fps.den,
        backgroundColor: manifest.backgroundColor,
      },
      timeline: {
        masterBusDb: 0,
        tracks: parsed.tracks,
        items: [...parsed.items, compositionItem],
        keyframes: parsed.keyframes.length > 0 ? parsed.keyframes : undefined,
      },
      hyperframes: {
        schemaVersion: 1,
        projects: {
          [manifest.id]: manifest,
        },
        compositionLinks: {
          [compositionItemId]: compositionLink,
        },
        skills: {
          enabled: [],
          history: [],
        },
        renderConfig: {
          engine: 'freecut',
          quality: 'production',
        },
      },
    }

    return {
      project,
      warnings,
      unsupportedFeatures: Array.from(unsupportedFeatures),
    }
  }

  private parseCompositionHtml(
    html: string,
    manifest: HyperFramesProjectManifest,
    unsupportedFeatures: Set<string>,
  ): {
    tracks: ProjectTimeline['tracks']
    items: TimelineItem[]
    keyframes: NonNullable<ProjectTimeline['keyframes']>
    compositionTrackId: string
  } {
    const document = new DOMParser().parseFromString(html, 'text/html')
    const nodes = Array.from(document.querySelectorAll<HTMLElement>('[data-hf-item]'))
    const fps = manifest.fps.num / manifest.fps.den
    const tracksByIndex = new Map<number, ProjectTimeline['tracks'][number]>()
    const items: TimelineItem[] = []

    for (const node of nodes) {
      const trackIndex = readIntegerAttribute(node, 'data-track-index', 0)
      const track = ensureTrack(tracksByIndex, trackIndex)
      const item = this.convertNode(node, track.id, fps, unsupportedFeatures)
      if (item) {
        items.push(item)
      }
    }

    const compositionTrack = ensureTrack(tracksByIndex, tracksByIndex.size)
    const keyframes = this.parseKeyframes(document)

    return {
      tracks: Array.from(tracksByIndex.values()).sort((left, right) => left.order - right.order),
      items: items.sort((left, right) => left.from - right.from || left.id.localeCompare(right.id)),
      keyframes,
      compositionTrackId: compositionTrack.id,
    }
  }

  private convertNode(
    node: HTMLElement,
    trackId: string,
    fps: number,
    unsupportedFeatures: Set<string>,
  ): TimelineItem | null {
    const type = node.dataset.hfType
    const base = {
      id: node.id,
      trackId,
      from: Math.round(readNumberAttribute(node, 'data-start', 0) * fps),
      durationInFrames: Math.round(readNumberAttribute(node, 'data-duration', 0) * fps),
      label: node.id,
      transform: parseTransform(node.getAttribute('style') || ''),
    }

    switch (type) {
      case 'text':
        return {
          ...base,
          type: 'text',
          text: node.textContent || '',
          fontSize: readPixelStyle(node, 'font-size'),
          fontFamily: readStyle(node, 'font-family'),
          color: readStyle(node, 'color'),
        }
      case 'video':
        return {
          ...base,
          type: 'video',
          src: node.getAttribute('src') || undefined,
        }
      case 'audio':
        return {
          ...base,
          type: 'audio',
          src: node.getAttribute('src') || undefined,
        }
      case 'image':
        return {
          ...base,
          type: 'image',
          src: node.getAttribute('src') || undefined,
        }
      case 'shape':
        unsupportedFeatures.add('shape-reverse-mapping')
        return {
          ...base,
          type: 'shape',
          shapeType: 'rectangle',
        }
      case 'composition':
        return {
          ...base,
          type: 'composition',
          compositionId: node.dataset.compositionId || node.id,
          activeCompositionPath: node.dataset.compositionSrc,
        }
      default:
        unsupportedFeatures.add(`unknown-node:${type || node.tagName.toLowerCase()}`)
        return null
    }
  }

  private parseKeyframes(document: Document): NonNullable<ProjectTimeline['keyframes']> {
    const script = document.querySelector<HTMLScriptElement>('#hf-keyframes')
    if (!script?.textContent) {
      return []
    }

    try {
      const entries = JSON.parse(script.textContent) as Array<{
        itemId: string
        property: string
        keyframes: Array<{ frame: number; value: number; easing: string }>
      }>
      return entries.map((entry) => ({
        itemId: entry.itemId,
        properties: [
          {
            property: entry.property as NonNullable<ProjectTimeline['keyframes']>[number]['properties'][number]['property'],
            keyframes: entry.keyframes.map((keyframe, index) => ({
              id: `${entry.itemId}-${entry.property}-${index}`,
              frame: keyframe.frame,
              value: keyframe.value,
              easing: keyframe.easing as NonNullable<ProjectTimeline['keyframes']>[number]['properties'][number]['keyframes'][number]['easing'],
            })),
          },
        ],
      }))
    } catch {
      return []
    }
  }
}

function ensureTrack(
  tracksByIndex: Map<number, ProjectTimeline['tracks'][number]>,
  trackIndex: number,
): ProjectTimeline['tracks'][number] {
  const existing = tracksByIndex.get(trackIndex)
  if (existing) {
    return existing
  }

  const track: ProjectTimeline['tracks'][number] = {
    id: `hf-track-${trackIndex}`,
    name: `HyperFrames ${trackIndex + 1}`,
    kind: 'video',
    height: 80,
    locked: false,
    visible: true,
    muted: false,
    solo: false,
    order: trackIndex,
  }
  tracksByIndex.set(trackIndex, track)
  return track
}

function readNumberAttribute(node: Element, name: string, fallback: number): number {
  const value = Number(node.getAttribute(name))
  return Number.isFinite(value) ? value : fallback
}

function readIntegerAttribute(node: Element, name: string, fallback: number): number {
  return Math.trunc(readNumberAttribute(node, name, fallback))
}

function readStyle(node: HTMLElement, property: string): string | undefined {
  return node.style.getPropertyValue(property) || undefined
}

function readPixelStyle(node: HTMLElement, property: string): number | undefined {
  const value = readStyle(node, property)
  if (!value) return undefined
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function parseTransform(style: string): TimelineItem['transform'] | undefined {
  const xMatch = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/.exec(style)
  const opacityMatch = /opacity:\s*([.\d]+)/.exec(style)
  const transform: TimelineItem['transform'] = {}

  if (xMatch?.[1] !== undefined && xMatch[2] !== undefined) {
    transform.x = Number(xMatch[1])
    transform.y = Number(xMatch[2])
  }
  if (opacityMatch?.[1] !== undefined) {
    transform.opacity = Number(opacityMatch[1])
  }

  return Object.keys(transform).length > 0 ? transform : undefined
}
