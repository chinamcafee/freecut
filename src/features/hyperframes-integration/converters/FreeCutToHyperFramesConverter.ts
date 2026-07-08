/**
 * FreeCut → HyperFrames project directory converter.
 *
 * The converter keeps HyperFrames source as a manifest-backed project
 * directory. The legacy `composition` result is retained only as a downgrade
 * preview bridge for older call sites.
 */

import type { Project, ProjectTimeline } from '@/types/project'
import type {
  HyperFramesAsset,
  HyperFramesAssetRef,
  HyperFramesComposition,
  HyperFramesProjectDirectory,
  HyperFramesProjectFile,
  HyperFramesProjectManifest,
  TimelineElement,
} from '@/types/hyperframes'
import { classifyUnsupportedFeatures } from './core-compat'

export interface FreeCutConverterOptions {
  includeAudio?: boolean
  includeAnimations?: boolean
  assetPathStrategy?: 'relative' | 'absolute' | 'cdn'
  formatHtml?: boolean
  includeSourceMap?: boolean
}

export interface ConversionResult {
  composition: HyperFramesComposition
  projectDirectory: HyperFramesProjectDirectory
  warnings: string[]
  unsupportedFeatures: string[]
}

type TimelineItem = ProjectTimeline['items'][number]

export class FreeCutToHyperFramesConverter {
  private options: Required<FreeCutConverterOptions>
  private warnings: string[] = []
  private unsupportedFeatures: string[] = []
  private assetMapper: AssetMapper

  constructor(options: FreeCutConverterOptions = {}) {
    this.options = {
      includeAudio: options.includeAudio ?? true,
      includeAnimations: options.includeAnimations ?? true,
      assetPathStrategy: options.assetPathStrategy ?? 'relative',
      formatHtml: options.formatHtml ?? true,
      includeSourceMap: options.includeSourceMap ?? false,
    }
    this.assetMapper = new AssetMapper(this.options.assetPathStrategy)
  }

  convert(project: Project): ConversionResult {
    this.warnings = []
    this.unsupportedFeatures = []
    this.assetMapper = new AssetMapper(this.options.assetPathStrategy)

    if (!project.timeline) {
      throw new Error('项目缺少 timeline 数据')
    }

    const composition = this.convertTimeline(project)
    for (const warning of classifyUnsupportedFeatures(project.timeline.items)) {
      this.addUnsupportedFeature(warning.feature)
      this.addWarning(warning.message)
    }
    const projectDirectory = this.assembleHyperFramesProject(project, composition)

    return {
      composition,
      projectDirectory,
      warnings: [...this.warnings],
      unsupportedFeatures: [...this.unsupportedFeatures],
    }
  }

  private convertTimeline(project: Project): HyperFramesComposition {
    const timeline = project.timeline!
    const fps = project.metadata.fps
    const compositionId = `freecut-${project.id}`
    const assets = this.collectAssets(timeline)
    const elements = this.convertTimelineItems(timeline, fps)
    const html = this.assembleCompositionHtml(project, timeline)

    return {
      id: compositionId,
      name: project.name,
      width: project.metadata.width,
      height: project.metadata.height,
      duration: project.duration / fps,
      fps: { num: fps, den: 1 },
      html,
      assets,
      elements,
      backgroundColor: project.metadata.backgroundColor || '#000000',
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    }
  }

  private assembleHyperFramesProject(
    project: Project,
    composition: HyperFramesComposition,
  ): HyperFramesProjectDirectory {
    const projectId = composition.id
    const rootPath = `hyperframes/${projectId}`
    const entryFile = 'index.html'
    const activeCompositionPath = 'compositions/main.html'
    const assets = this.createAssetRefs(composition.assets)
    const indexHtml = this.assembleIndexHtml(project, projectId, activeCompositionPath)
    const compositionHtml = composition.html
    const now = project.updatedAt || Date.now()

    const manifest: HyperFramesProjectManifest = {
      id: projectId,
      name: project.name,
      schemaVersion: 1,
      projectDir: rootPath,
      entryFile,
      activeCompositionPath,
      width: project.metadata.width,
      height: project.metadata.height,
      fps: composition.fps,
      durationInFrames: project.duration,
      backgroundColor: project.metadata.backgroundColor,
      assets,
      compositions: [
        {
          id: 'main',
          path: activeCompositionPath,
          name: project.name,
          durationInFrames: project.duration,
        },
      ],
      source: 'freecut-export',
      provenance: {
        source: 'freecut-export',
        inputHash: stableHash(JSON.stringify({ id: project.id, updatedAt: project.updatedAt })),
        outputHash: stableHash(indexHtml + compositionHtml),
        createdAt: now,
        confirmedByUser: false,
      },
      warnings: [...this.warnings],
      unsupportedFeatures: [...this.unsupportedFeatures],
      createdAt: project.createdAt || now,
      updatedAt: now,
    }

    const files: Record<string, string> = {
      [entryFile]: indexHtml,
      [activeCompositionPath]: compositionHtml,
      'manifest.json': JSON.stringify(manifest, null, 2),
    }
    const fileIndex = Object.entries(files).map(([path, contents]): HyperFramesProjectFile => {
      const kind =
        path === 'manifest.json' ? 'manifest' : path === entryFile ? 'entry' : 'composition'
      return {
        path,
        contents,
        kind,
        hash: stableHash(contents),
      }
    })

    return {
      projectId,
      rootPath,
      manifest,
      entryFile,
      activeCompositionPath,
      files,
      fileIndex,
      assets,
      warnings: [...this.warnings],
      unsupportedFeatures: [...this.unsupportedFeatures],
    }
  }

  private collectAssets(timeline: ProjectTimeline): HyperFramesAsset[] {
    const assets: HyperFramesAsset[] = []
    const assetMap = new Map<string, HyperFramesAsset>()

    for (const item of timeline.items) {
      if (hasAudioEq(item)) {
        this.addWarning(
          `Item ${item.id} 的音频 EQ 不能无损转换为 HyperFrames，已保留为 warning`,
        )
        this.addUnsupportedFeature('audio-eq')
      }

      if (!isMediaItemWithSrc(item)) continue
      if (assetMap.has(item.src)) continue

      const asset: HyperFramesAsset = {
        type: item.type,
        src: this.assetMapper.mapPath(item.src),
        localPath: item.src,
        duration: item.sourceDuration ? item.sourceDuration / (item.sourceFps || 30) : undefined,
        width: item.sourceWidth,
        height: item.sourceHeight,
        hasAudio: item.type === 'video' ? true : undefined,
      }
      assetMap.set(item.src, asset)
      assets.push(asset)
    }

    return assets
  }

  private createAssetRefs(assets: HyperFramesAsset[]): HyperFramesAssetRef[] {
    return assets.map((asset, index) => {
      const sourcePath = asset.localPath || asset.src
      const projectPath = this.assetMapper.mapPath(sourcePath)
      return {
        id: `asset-${index + 1}`,
        type: asset.type,
        sourcePath,
        projectPath,
        hash: stableHash(`${sourcePath}:${projectPath}`),
        duration: asset.duration,
        width: asset.width,
        height: asset.height,
        hasAudio: asset.hasAudio,
      }
    })
  }

  private convertTimelineItems(timeline: ProjectTimeline, fps: number): TimelineElement[] {
    return timeline.items
      .map((item) => this.convertItem(item, timeline, fps))
      .filter((item): item is TimelineElement => item !== null)
  }

  private convertItem(
    item: TimelineItem,
    timeline: ProjectTimeline,
    fps: number,
  ): TimelineElement | null {
    const baseElement = {
      id: item.id,
      start: item.from / fps,
      duration: item.durationInFrames / fps,
      trackIndex: this.getTrackIndex(item.trackId, timeline),
    }

    switch (item.type) {
      case 'video':
      case 'audio':
      case 'image':
        if (!item.src) {
          this.addWarning(`Item ${item.id} 缺少 src，已跳过`)
          return null
        }
        return {
          ...baseElement,
          type: 'media',
          mediaType: item.type,
          src: this.assetMapper.mapPath(item.src),
          volume: item.volume ?? 1,
          hasAudio: item.type === 'video' ? true : undefined,
        }
      case 'text':
        return {
          ...baseElement,
          type: 'text',
          content: item.text || '',
          fontSize: item.fontSize || 24,
          fontFamily: item.fontFamily || 'Arial',
          color: item.color || '#ffffff',
        }
      case 'shape': {
        const svg = this.generateShapeSvg(item)
        if (!svg) return null
        return {
          ...baseElement,
          type: 'media',
          mediaType: 'image',
          src: `data:image/svg+xml;base64,${toBase64(svg)}`,
        }
      }
      case 'composition':
        return {
          ...baseElement,
          type: 'composition',
          compositionId: item.compositionId || item.id,
          compositionSrc: item.activeCompositionPath,
        }
      default:
        this.addUnsupportedFeature(item.type)
        this.addWarning(`不支持的 item 类型: ${item.type}`)
        return null
    }
  }

  private getTrackIndex(trackId: string, timeline: ProjectTimeline): number {
    const orderedTracks = [...timeline.tracks].sort((left, right) => left.order - right.order)
    return Math.max(
      0,
      orderedTracks.findIndex((track) => track.id === trackId),
    )
  }

  private assembleIndexHtml(
    project: Project,
    projectId: string,
    activeCompositionPath: string,
  ): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=${project.metadata.width}, initial-scale=1.0">
  <title>${this.escapeHtml(project.name)}</title>
</head>
<body>
  <div id="hyperframes-root" data-composition-id="${projectId}" data-composition-src="${activeCompositionPath}"></div>
</body>
</html>`
  }

  private assembleCompositionHtml(project: Project, timeline: ProjectTimeline): string {
    const keyframes = this.serializeSupportedKeyframes(project)
    const keyframeScript =
      this.options.includeAnimations && keyframes.length > 0
        ? `\n  <script type="application/json" id="hf-keyframes">${this.escapeHtml(JSON.stringify(keyframes))}</script>`
        : ''

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=${project.metadata.width}, initial-scale=1.0">
  <title>${this.escapeHtml(project.name)} / Main</title>
  <style>
    html, body {
      margin: 0;
      width: ${project.metadata.width}px;
      height: ${project.metadata.height}px;
      overflow: hidden;
      background: ${project.metadata.backgroundColor || '#000000'};
    }
    [data-hf-stage] {
      position: relative;
      width: ${project.metadata.width}px;
      height: ${project.metadata.height}px;
      overflow: hidden;
    }
    [data-hf-item] {
      position: absolute;
      top: 0;
      left: 0;
    }
  </style>
</head>
<body>
  <main data-hf-stage data-composition-id="main" data-width="${project.metadata.width}" data-height="${project.metadata.height}" data-fps="${project.metadata.fps}" data-duration-frames="${project.duration}">
    ${this.generateTimelineItemsHtml(timeline, project.metadata.fps)}
  </main>${keyframeScript}
</body>
</html>`
  }

  private generateTimelineItemsHtml(timeline: ProjectTimeline, fps: number): string {
    return timeline.items
      .map((item) => this.generateItemHtml(item, timeline, fps))
      .filter((html): html is string => html !== null)
      .join('\n    ')
  }

  private generateItemHtml(item: TimelineItem, timeline: ProjectTimeline, fps: number): string | null {
    const attrs = this.generateItemDataAttributes(item, timeline, fps)
    const styleAttr = this.generateItemStyles(item, timeline)
    const style = styleAttr ? ` style="${styleAttr}"` : ''

    switch (item.type) {
      case 'video':
        return `<video ${attrs}${style} src="${this.escapeAttribute(this.assetMapper.mapPath(item.src || ''))}"></video>`
      case 'audio':
        if (!this.options.includeAudio) return null
        return `<audio ${attrs}${style} src="${this.escapeAttribute(this.assetMapper.mapPath(item.src || ''))}"></audio>`
      case 'image':
        return `<img ${attrs}${style} src="${this.escapeAttribute(this.assetMapper.mapPath(item.src || ''))}" alt="${this.escapeAttribute(item.label)}">`
      case 'text':
        return `<div ${attrs}${style}>${this.escapeHtml(item.text || '')}</div>`
      case 'shape': {
        const svg = this.generateShapeSvg(item)
        if (!svg) return null
        return `<svg ${attrs}${style} viewBox="0 0 ${item.transform?.width || 100} ${item.transform?.height || 100}">${svg}</svg>`
      }
      case 'composition':
        return `<div ${attrs}${style} data-composition-src="${this.escapeAttribute(item.activeCompositionPath || '')}"></div>`
      default:
        return null
    }
  }

  private generateItemDataAttributes(item: TimelineItem, timeline: ProjectTimeline, fps: number): string {
    return [
      `id="${this.escapeAttribute(item.id)}"`,
      'data-hf-item',
      `data-hf-type="${this.escapeAttribute(item.type)}"`,
      `data-start="${trimNumber(item.from / fps)}"`,
      `data-duration="${trimNumber(item.durationInFrames / fps)}"`,
      `data-media-start="${trimNumber(getSourceStartFrames(item) / fps)}"`,
      `data-track-index="${this.getTrackIndex(item.trackId, timeline)}"`,
      `data-freecut-track-id="${this.escapeAttribute(item.trackId)}"`,
    ].join(' ')
  }

  private generateItemStyles(item: TimelineItem, timeline: ProjectTimeline): string {
    const styles: string[] = []
    const transform = this.convertTransform(item)
    if (transform) {
      styles.push(`transform: ${transform}`)
      styles.push(`transform-origin: ${this.getTransformOrigin(item)}`)
    }
    if (item.transform?.opacity !== undefined) {
      styles.push(`opacity: ${item.transform.opacity}`)
    }
    if (item.transform?.cornerRadius !== undefined) {
      styles.push(`border-radius: ${item.transform.cornerRadius}px`)
    }
    if (item.type === 'text') {
      if (item.fontSize) styles.push(`font-size: ${item.fontSize}px`)
      if (item.fontFamily) styles.push(`font-family: ${item.fontFamily}`)
      if (item.color) styles.push(`color: ${item.color}`)
    }
    styles.push(`z-index: ${this.getTrackIndex(item.trackId, timeline)}`)
    return styles.join('; ')
  }

  private convertTransform(item: TimelineItem): string {
    const transform = item.transform
    if (!transform) return ''

    const parts: string[] = []
    if (transform.x !== undefined || transform.y !== undefined) {
      parts.push(`translate(${transform.x || 0}px, ${transform.y || 0}px)`)
    }
    if (transform.rotation) {
      parts.push(`rotate(${transform.rotation}deg)`)
    }
    if (transform.flipHorizontal || transform.flipVertical) {
      parts.push(`scale(${transform.flipHorizontal ? -1 : 1}, ${transform.flipVertical ? -1 : 1})`)
    }
    return parts.join(' ')
  }

  private getTransformOrigin(item: TimelineItem): string {
    const anchorX = item.transform?.anchorX !== undefined ? `${item.transform.anchorX}%` : '50%'
    const anchorY = item.transform?.anchorY !== undefined ? `${item.transform.anchorY}%` : '50%'
    return `${anchorX} ${anchorY}`
  }

  private serializeSupportedKeyframes(project: Project): Array<{
    itemId: string
    property: string
    keyframes: Array<{ frame: number; value: number; easing: string }>
  }> {
    return (
      project.timeline?.keyframes?.flatMap((entry) =>
        entry.properties.map((property) => ({
          itemId: entry.itemId,
          property: property.property,
          keyframes: property.keyframes.map((keyframe) => ({
            frame: keyframe.frame,
            value: keyframe.value,
            easing: keyframe.easing,
          })),
        })),
      ) ?? []
    )
  }

  private generateShapeSvg(item: TimelineItem): string | null {
    const width = item.transform?.width || 100
    const height = item.transform?.height || 100
    const fillColor = item.fillColor || '#ffffff'
    const strokeColor = item.strokeColor || 'none'
    const strokeWidth = item.strokeWidth || 0

    switch (item.shapeType) {
      case 'rectangle':
        return `<rect width="${width}" height="${height}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/>`
      case 'circle':
        return `<circle cx="${width / 2}" cy="${height / 2}" r="${Math.min(width, height) / 2}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/>`
      case 'ellipse':
        return `<ellipse cx="${width / 2}" cy="${height / 2}" rx="${width / 2}" ry="${height / 2}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/>`
      case 'triangle':
        return `<polygon points="${width / 2},0 ${width},${height} 0,${height}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/>`
      default:
        this.addUnsupportedFeature(`shape:${item.shapeType || 'unknown'}`)
        this.addWarning(`Shape item ${item.id} 的类型 ${item.shapeType || 'unknown'} 暂不支持`)
        return null
    }
  }

  private addWarning(warning: string): void {
    if (!this.warnings.includes(warning)) {
      this.warnings.push(warning)
    }
  }

  private addUnsupportedFeature(feature: string): void {
    if (!this.unsupportedFeatures.includes(feature)) {
      this.unsupportedFeatures.push(feature)
    }
  }

  private escapeHtml(text: string): string {
    return text.replace(/[&<>"']/g, (match) => HTML_ESCAPE[match] || match)
  }

  private escapeAttribute(text: string): string {
    return this.escapeHtml(text)
  }
}

class AssetMapper {
  private pathMap = new Map<string, string>()

  constructor(private strategy: 'relative' | 'absolute' | 'cdn' = 'relative') {}

  mapPath(localPath: string): string {
    if (!localPath) return ''
    const existing = this.pathMap.get(localPath)
    if (existing) return existing

    const fileName = localPath.split('/').pop() || localPath
    const mappedPath =
      this.strategy === 'absolute'
        ? localPath
        : this.strategy === 'cdn'
          ? `https://cdn.example.com/assets/${fileName}`
          : `assets/${fileName}`

    this.pathMap.set(localPath, mappedPath)
    return mappedPath
  }
}

const HTML_ESCAPE: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#039;',
}

function isMediaItemWithSrc(
  item: TimelineItem,
): item is TimelineItem & { type: 'video' | 'audio' | 'image'; src: string } {
  return (
    (item.type === 'video' || item.type === 'audio' || item.type === 'image') &&
    typeof item.src === 'string' &&
    item.src.length > 0
  )
}

function hasAudioEq(item: TimelineItem): boolean {
  return Object.entries(item).some(
    ([key, value]) => key.startsWith('audioEq') && value !== undefined && value !== false,
  )
}

function stableHash(input: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`
}

function trimNumber(value: number): string {
  return Number.isInteger(value) ? value.toString() : value.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')
}

function getSourceStartFrames(item: TimelineItem): number {
  const record = item as Record<string, unknown>
  const sourceStart = record.sourceStart
  if (typeof sourceStart === 'number') return sourceStart
  const trimStart = record.trimStart
  return typeof trimStart === 'number' ? trimStart : 0
}

function toBase64(input: string): string {
  if (typeof btoa === 'function') {
    return btoa(input)
  }
  return Buffer.from(input).toString('base64')
}
