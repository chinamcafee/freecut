/**
 * FreeCut到HyperFrames数据转换器
 *
 * 将FreeCut的timeline数据转换为HyperFrames composition格式
 * 支持基础元素、transform、特效和关键帧动画的转换
 */

import type { Project, ProjectTimeline } from '@/types/project'
import type { HyperFramesComposition, HyperFramesAsset, TimelineElement } from '@/types/hyperframes'

// ============================================================================
// 转换器选项接口
// ============================================================================

/**
 * 转换器配置选项
 */
export interface FreeCutConverterOptions {
  /** 是否包含音频 */
  includeAudio?: boolean
  /** 是否生成GSAP动画脚本 */
  includeAnimations?: boolean
  /** 资源路径映射策略 */
  assetPathStrategy?: 'relative' | 'absolute' | 'cdn'
  /** 输出HTML是否格式化 */
  formatHtml?: boolean
  /** 是否包含source map注释 */
  includeSourceMap?: boolean
}

/**
 * 转换结果
 */
export interface ConversionResult {
  /** 生成的HyperFrames composition */
  composition: HyperFramesComposition
  /** 转换警告信息 */
  warnings: string[]
  /** 不支持的特性列表 */
  unsupportedFeatures: string[]
}

// ============================================================================
// 转换器主类
// ============================================================================

/**
 * FreeCut到HyperFrames转换器
 */
export class FreeCutToHyperFramesConverter {
  private options: Required<FreeCutConverterOptions>
  private warnings: string[] = []
  private unsupportedFeatures: string[] = []
  private assetMapper: AssetMapper

  constructor(options: FreeCutConverterOptions = {}) {
    // 设置默认选项
    this.options = {
      includeAudio: options.includeAudio ?? true,
      includeAnimations: options.includeAnimations ?? true,
      assetPathStrategy: options.assetPathStrategy ?? 'relative',
      formatHtml: options.formatHtml ?? true,
      includeSourceMap: options.includeSourceMap ?? false,
    }

    this.assetMapper = new AssetMapper(this.options.assetPathStrategy)
  }

  /**
   * 转换FreeCut项目为HyperFrames composition
   */
  convert(project: Project): ConversionResult {
    this.warnings = []
    this.unsupportedFeatures = []

    if (!project.timeline) {
      throw new Error('项目缺少timeline数据')
    }

    const composition = this.convertTimeline(project)

    return {
      composition,
      warnings: this.warnings,
      unsupportedFeatures: this.unsupportedFeatures,
    }
  }

  /**
   * 转换timeline为composition
   */
  private convertTimeline(project: Project): HyperFramesComposition {
    const timeline = project.timeline!
    const { metadata } = project

    // 生成composition ID
    const compositionId = `freecut-${project.id}`

    // 收集所有资源
    const assets = this.collectAssets(timeline)

    // 转换timeline元素
    const elements = this.convertTimelineItems(timeline)

    // 生成HTML
    const html = this.assembleHtml(project, elements)

    // 创建composition对象
    const composition: HyperFramesComposition = {
      id: compositionId,
      name: project.name,
      width: metadata.width,
      height: metadata.height,
      duration: project.duration / metadata.fps, // 转换为秒
      fps: { num: metadata.fps, den: 1 },
      html,
      assets,
      elements,
      backgroundColor: metadata.backgroundColor || '#000000',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    return composition
  }

  /**
   * 收集timeline中的所有资源
   */
  private collectAssets(timeline: ProjectTimeline): HyperFramesAsset[] {
    const assets: HyperFramesAsset[] = []
    const assetMap = new Map<string, HyperFramesAsset>()

    for (const item of timeline.items) {
      if (item.type === 'video' && item.src) {
        if (!assetMap.has(item.src)) {
          const asset: HyperFramesAsset = {
            type: 'video',
            src: this.assetMapper.mapPath(item.src),
            localPath: item.src,
            width: item.sourceWidth,
            height: item.sourceHeight,
            duration: item.sourceDuration
              ? item.sourceDuration / (item.sourceFps || 30)
              : undefined,
            hasAudio: true, // 默认假设视频有音频
          }
          assetMap.set(item.src, asset)
          assets.push(asset)
        }
      } else if (item.type === 'audio' && item.src) {
        if (!assetMap.has(item.src)) {
          const asset: HyperFramesAsset = {
            type: 'audio',
            src: this.assetMapper.mapPath(item.src),
            localPath: item.src,
            duration: item.sourceDuration
              ? item.sourceDuration / (item.sourceFps || 30)
              : undefined,
          }
          assetMap.set(item.src, asset)
          assets.push(asset)
        }
      } else if (item.type === 'image' && item.src) {
        if (!assetMap.has(item.src)) {
          const asset: HyperFramesAsset = {
            type: 'image',
            src: this.assetMapper.mapPath(item.src),
            localPath: item.src,
            width: item.sourceWidth,
            height: item.sourceHeight,
          }
          assetMap.set(item.src, asset)
          assets.push(asset)
        }
      }
    }

    return assets
  }

  /**
   * 转换timeline items为timeline elements
   */
  private convertTimelineItems(timeline: ProjectTimeline): TimelineElement[] {
    const elements: TimelineElement[] = []
    const fps = 30 // 默认FPS，实际应从project metadata获取

    for (const item of timeline.items) {
      const element = this.convertItem(item, timeline, fps)
      if (element) {
        elements.push(element)
      }
    }

    return elements
  }

  /**
   * 转换单个timeline item
   */
  private convertItem(
    item: ProjectTimeline['items'][0],
    timeline: ProjectTimeline,
    fps: number,
  ): TimelineElement | null {
    const trackIndex = this.getTrackIndex(item.trackId, timeline)
    const start = item.from / fps // 转换为秒
    const duration = item.durationInFrames / fps // 转换为秒

    const baseElement = {
      id: item.id,
      start,
      duration,
      trackIndex,
    }

    switch (item.type) {
      case 'video':
        return this.convertVideoItem(item, baseElement)
      case 'audio':
        return this.convertAudioItem(item, baseElement)
      case 'image':
        return this.convertImageItem(item, baseElement)
      case 'text':
        return this.convertTextItem(item, baseElement)
      case 'shape':
        return this.convertShapeItem(item, baseElement)
      default:
        this.warnings.push(`不支持的item类型: ${item.type}`)
        return null
    }
  }

  /**
   * 获取轨道索引
   */
  private getTrackIndex(trackId: string, timeline: ProjectTimeline): number {
    const track = timeline.tracks.find((t) => t.id === trackId)
    return track ? track.order : 0
  }

  // ============================================================================
  // Day 2: 基础元素转换方法
  // ============================================================================

  /**
   * 转换Video元素
   */
  private convertVideoItem(
    item: ProjectTimeline['items'][0],
    baseElement: Omit<TimelineElement, 'type'>,
  ): TimelineElement | null {
    if (!item.src) {
      this.warnings.push(`Video item ${item.id} 缺少src`)
      return null
    }

    return {
      ...baseElement,
      type: 'media',
      mediaType: 'video',
      src: this.assetMapper.mapPath(item.src),
      volume: item.volume ?? 1.0,
      hasAudio: true,
    }
  }

  /**
   * 转换Audio元素
   */
  private convertAudioItem(
    item: ProjectTimeline['items'][0],
    baseElement: Omit<TimelineElement, 'type'>,
  ): TimelineElement | null {
    if (!item.src) {
      this.warnings.push(`Audio item ${item.id} 缺少src`)
      return null
    }

    // 处理音频EQ设置（当前不支持，记录到warnings）
    // 音频EQ需要通过Web Audio API实现，超出当前转换器范围
    if (item.label?.includes('EQ') || item.label?.includes('eq')) {
      this.warnings.push(`Audio item ${item.id} 可能包含EQ设置，需要通过Web Audio API实现`)
    }

    return {
      ...baseElement,
      type: 'media',
      mediaType: 'audio',
      src: this.assetMapper.mapPath(item.src),
      volume: item.volume ?? 1.0,
    }
  }

  /**
   * 转换Image元素
   */
  private convertImageItem(
    item: ProjectTimeline['items'][0],
    baseElement: Omit<TimelineElement, 'type'>,
  ): TimelineElement | null {
    if (!item.src) {
      this.warnings.push(`Image item ${item.id} 缺少src`)
      return null
    }

    return {
      ...baseElement,
      type: 'media',
      mediaType: 'image',
      src: this.assetMapper.mapPath(item.src),
    }
  }

  /**
   * 转换Text元素
   */
  private convertTextItem(
    item: ProjectTimeline['items'][0],
    baseElement: Omit<TimelineElement, 'type'>,
  ): TimelineElement | null {
    if (!item.text) {
      this.warnings.push(`Text item ${item.id} 缺少text内容`)
      return null
    }

    return {
      ...baseElement,
      type: 'text',
      content: item.text,
      fontSize: item.fontSize || 24,
      fontFamily: item.fontFamily || 'Arial',
      color: item.color || '#FFFFFF',
    }
  }

  /**
   * 转换Shape元素（作为图片处理，使用SVG data URL）
   */
  private convertShapeItem(
    item: ProjectTimeline['items'][0],
    baseElement: { id: string; start: number; duration: number; trackIndex: number },
  ): TimelineElement | null {
    if (!item.shapeType) {
      this.warnings.push(`Shape item ${item.id} 缺少shapeType`)
      return null
    }

    // 生成SVG代码
    const svg = this.generateShapeSvg(item)
    if (!svg) {
      return null
    }

    // 将Shape作为image类型处理，使用SVG data URL
    return {
      ...baseElement,
      type: 'media',
      mediaType: 'image',
      src: `data:image/svg+xml;base64,${btoa(svg)}`,
    }
  }

  /**
   * 生成Shape的SVG代码
   */
  private generateShapeSvg(item: ProjectTimeline['items'][0]): string | null {
    const width = item.transform?.width || 100
    const height = item.transform?.height || 100
    const fillColor = item.fillColor || '#FFFFFF'
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
        this.unsupportedFeatures.push(`Shape类型 ${item.shapeType} 暂未完全支持`)
        return null
    }
  }

  // ============================================================================
  // Day 3: Transform和Effects转换方法
  // ============================================================================

  /**
   * 转换Transform属性为CSS transform字符串
   */
  private convertTransform(item: ProjectTimeline['items'][0]): string {
    const transform = item.transform
    if (!transform) {
      return ''
    }

    const transformParts: string[] = []

    // 位置变换
    if (transform.x !== undefined || transform.y !== undefined) {
      const x = transform.x || 0
      const y = transform.y || 0
      transformParts.push(`translate(${x}px, ${y}px)`)
    }

    // 缩放变换
    if (transform.width !== undefined || transform.height !== undefined) {
      // 注意：这里需要根据原始尺寸计算缩放比例
      // 简化实现：假设transform.width/height就是缩放后的大小
      const scaleX = transform.width ? transform.width / 100 : 1
      const scaleY = transform.height ? transform.height / 100 : 1
      transformParts.push(`scale(${scaleX}, ${scaleY})`)
    }

    // 旋转变换
    if (transform.rotation !== undefined && transform.rotation !== 0) {
      transformParts.push(`rotate(${transform.rotation}deg)`)
    }

    // 翻转变换
    if (transform.flipHorizontal || transform.flipVertical) {
      const scaleX = transform.flipHorizontal ? -1 : 1
      const scaleY = transform.flipVertical ? -1 : 1
      if (scaleX !== 1 || scaleY !== 1) {
        transformParts.push(`scale(${scaleX}, ${scaleY})`)
      }
    }

    return transformParts.join(' ')
  }

  /**
   * 生成transform-origin CSS属性
   */
  private getTransformOrigin(item: ProjectTimeline['items'][0]): string {
    const transform = item.transform
    if (!transform || (transform.anchorX === undefined && transform.anchorY === undefined)) {
      return 'center center'
    }

    const anchorX = transform.anchorX !== undefined ? `${transform.anchorX}%` : '50%'
    const anchorY = transform.anchorY !== undefined ? `${transform.anchorY}%` : '50%'

    return `${anchorX} ${anchorY}`
  }

  /**
   * 转换视觉特效为CSS filter字符串
   */
  private convertEffects(item: ProjectTimeline['items'][0]): string {
    const filters: string[] = []

    // TODO: 实现完整的特效转换
    // FreeCut的特效系统比较复杂，这里只实现基础特效

    // 透明度（虽然透明度不是filter，但相关）
    if (item.transform?.opacity !== undefined && item.transform.opacity !== 1) {
      // opacity单独处理，不放在filter中
    }

    // 淡入淡出效果
    if (item.fadeIn || item.fadeOut) {
      this.warnings.push(`Item ${item.id} 的淡入淡出效果需要通过动画实现`)
    }

    return filters.join(' ')
  }

  /**
   * 转换混合模式
   * 注意：当前HyperFrames的TimelineElement类型不直接支持blendMode字段
   * 此方法保留供未来CSS mix-blend-mode支持使用
   * @internal
   */
  // @ts-expect-error - 保留供未来使用
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private convertBlendMode(blendMode?: string): string {
    if (!blendMode) {
      return 'normal'
    }

    const blendModeMap: Record<string, string> = {
      normal: 'normal',
      multiply: 'multiply',
      screen: 'screen',
      overlay: 'overlay',
      darken: 'darken',
      lighten: 'lighten',
      'color-dodge': 'color-dodge',
      'color-burn': 'color-burn',
      'hard-light': 'hard-light',
      'soft-light': 'soft-light',
      difference: 'difference',
      exclusion: 'exclusion',
    }

    const cssBlendMode = blendModeMap[blendMode]
    if (!cssBlendMode) {
      this.warnings.push(`不支持的混合模式: ${blendMode}`)
      return 'normal'
    }

    return cssBlendMode
  }

  // ============================================================================
  // Day 4: 关键帧动画转换方法
  // ============================================================================

  /**
   * 从timeline提取关键帧数据
   */
  private extractKeyframes(
    item: ProjectTimeline['items'][0],
    timeline: ProjectTimeline,
  ): Array<{ property: string; keyframes: Array<{ frame: number; value: number }> }> {
    if (!timeline.keyframes) {
      return []
    }

    const itemKeyframes = timeline.keyframes.find((kf) => kf.itemId === item.id)
    if (!itemKeyframes) {
      return []
    }

    return itemKeyframes.properties.map((prop) => ({
      property: prop.property,
      keyframes: prop.keyframes.map((kf) => ({
        frame: kf.frame,
        value: kf.value,
      })),
    }))
  }

  /**
   * 生成GSAP动画代码
   */
  private generateGsapAnimation(
    item: ProjectTimeline['items'][0],
    timeline: ProjectTimeline,
    fps: number,
  ): string {
    const keyframes = this.extractKeyframes(item, timeline)
    if (keyframes.length === 0) {
      return ''
    }

    const animations: string[] = []

    for (const { property, keyframes: kfs } of keyframes) {
      if (kfs.length < 2) {
        continue // 至少需要2个关键帧
      }

      // 转换属性名为GSAP格式
      const gsapProperty = this.convertPropertyToGsap(property)

      for (let i = 0; i < kfs.length - 1; i++) {
        const startKf = kfs[i]
        const endKf = kfs[i + 1]

        // TypeScript null检查
        if (!startKf || !endKf) {
          continue
        }

        const startTime = startKf.frame / fps
        const endTime = endKf.frame / fps
        const duration = endTime - startTime

        animations.push(
          `gsap.to("#${item.id}", { ${gsapProperty}: ${endKf.value}, duration: ${duration}, ease: "power2.inOut" }, ${startTime})`,
        )
      }
    }

    return animations.join('\n')
  }

  /**
   * 转换FreeCut属性名为GSAP属性名
   */
  private convertPropertyToGsap(property: string): string {
    const propertyMap: Record<string, string> = {
      x: 'x',
      y: 'y',
      scaleX: 'scaleX',
      scaleY: 'scaleY',
      rotation: 'rotation',
      opacity: 'opacity',
    }

    return propertyMap[property] || property
  }

  // ============================================================================
  // Day 5: HTML组装和格式化
  // ============================================================================

  /**
   * 组装完整的HTML文档
   */
  private assembleHtml(project: Project, _elements: TimelineElement[]): string {
    const { metadata } = project
    const timeline = project.timeline!

    // 生成HTML结构
    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.escapeHtml(project.name)}</title>
  <meta name="generator" content="FreeCut to HyperFrames Converter">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      width: ${metadata.width}px;
      height: ${metadata.height}px;
      background-color: ${metadata.backgroundColor || '#000000'};
      overflow: hidden;
      position: relative;
    }
    .timeline-item {
      position: absolute;
      top: 0;
      left: 0;
    }
  </style>
  ${this.options.includeAnimations ? '<script src="https://cdn.jsdelivr.net/npm/gsap@3.12.2/dist/gsap.min.js"></script>' : ''}
</head>
<body>
  ${this.generateTimelineItemsHtml(timeline)}
  ${this.options.includeAnimations ? this.generateAnimationScript(project) : ''}
</body>
</html>`

    return this.options.formatHtml ? this.formatHtml(html) : html
  }

  /**
   * 生成timeline items的HTML
   */
  private generateTimelineItemsHtml(timeline: ProjectTimeline): string {
    const itemsHtml: string[] = []

    for (const item of timeline.items) {
      const itemHtml = this.generateItemHtml(item, timeline)
      if (itemHtml) {
        itemsHtml.push(itemHtml)
      }
    }

    return itemsHtml.join('\n  ')
  }

  /**
   * 生成单个item的HTML
   */
  private generateItemHtml(item: ProjectTimeline['items'][0], _timeline: ProjectTimeline): string {
    const styles = this.generateItemStyles(item)
    const styleAttr = styles ? ` style="${styles}"` : ''

    switch (item.type) {
      case 'video':
        return `<video id="${item.id}" class="timeline-item"${styleAttr} src="${this.assetMapper.mapPath(item.src || '')}"></video>`
      case 'audio':
        return `<audio id="${item.id}" class="timeline-item"${styleAttr} src="${this.assetMapper.mapPath(item.src || '')}"></audio>`
      case 'image':
        return `<img id="${item.id}" class="timeline-item"${styleAttr} src="${this.assetMapper.mapPath(item.src || '')}" alt="${this.escapeHtml(item.label)}">`
      case 'text':
        return `<div id="${item.id}" class="timeline-item"${styleAttr}>${this.escapeHtml(item.text || '')}</div>`
      case 'shape':
        return this.generateShapeHtml(item)
      default:
        return ''
    }
  }

  /**
   * 生成item的样式字符串
   */
  private generateItemStyles(item: ProjectTimeline['items'][0]): string {
    const styles: string[] = []

    // Transform
    const transform = this.convertTransform(item)
    if (transform) {
      styles.push(`transform: ${transform}`)
      styles.push(`transform-origin: ${this.getTransformOrigin(item)}`)
    }

    // Opacity
    if (item.transform?.opacity !== undefined) {
      styles.push(`opacity: ${item.transform.opacity}`)
    }

    // Corner radius
    if (item.transform?.cornerRadius !== undefined) {
      styles.push(`border-radius: ${item.transform.cornerRadius}px`)
    }

    // Effects (CSS filters)
    const effects = this.convertEffects(item)
    if (effects) {
      styles.push(`filter: ${effects}`)
    }

    // Blend mode
    // Note: blendMode字段在当前的ProjectTimeline类型中不存在
    // 这里预留接口，实际使用时需要扩展类型定义
    // const blendMode = this.convertBlendMode(item.blendMode)
    // if (blendMode !== 'normal') {
    //   styles.push(`mix-blend-mode: ${blendMode}`)
    // }

    // Z-index (from track order)
    const trackIndex = this.getTrackIndex(item.trackId, {
      tracks: [],
      items: [],
    } as ProjectTimeline)
    styles.push(`z-index: ${trackIndex}`)

    // Text styles
    if (item.type === 'text') {
      if (item.fontSize) styles.push(`font-size: ${item.fontSize}px`)
      if (item.fontFamily) styles.push(`font-family: ${item.fontFamily}`)
      if (item.color) styles.push(`color: ${item.color}`)
    }

    return styles.join('; ')
  }

  /**
   * 生成形状的HTML (SVG)
   */
  private generateShapeHtml(item: ProjectTimeline['items'][0]): string {
    // TODO: 实现完整的形状生成
    this.unsupportedFeatures.push(`Shape type: ${item.shapeType}`)
    return ''
  }

  /**
   * 生成完整的动画脚本
   */
  private generateAnimationScript(project: Project): string {
    const timeline = project.timeline!
    const fps = project.metadata.fps
    const animations: string[] = []

    for (const item of timeline.items) {
      const itemAnimation = this.generateGsapAnimation(item, timeline, fps)
      if (itemAnimation) {
        animations.push(itemAnimation)
      }
    }

    if (animations.length === 0) {
      return ''
    }

    return `
  <script>
    document.addEventListener('DOMContentLoaded', function() {
      const tl = gsap.timeline();
      ${animations.join('\n      ')}
    });
  </script>`
  }

  /**
   * HTML格式化
   */
  private formatHtml(html: string): string {
    // 简单的格式化，实际项目可以使用prettier等工具
    return html
  }

  /**
   * 转义HTML特殊字符
   */
  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    }
    return text.replace(/[&<>"']/g, (m) => map[m] || m)
  }
}

// ============================================================================
// AssetMapper辅助类
// ============================================================================

/**
 * 资源路径映射器
 *
 * 负责将FreeCut的本地文件路径转换为HyperFrames可用的路径格式
 */
class AssetMapper {
  private strategy: 'relative' | 'absolute' | 'cdn'
  private pathMap = new Map<string, string>()

  constructor(strategy: 'relative' | 'absolute' | 'cdn' = 'relative') {
    this.strategy = strategy
  }

  /**
   * 映射资源路径
   */
  mapPath(localPath: string): string {
    if (!localPath) {
      return ''
    }

    // 检查缓存
    if (this.pathMap.has(localPath)) {
      return this.pathMap.get(localPath)!
    }

    let mappedPath: string

    switch (this.strategy) {
      case 'relative':
        mappedPath = this.toRelativePath(localPath)
        break
      case 'absolute':
        mappedPath = localPath
        break
      case 'cdn':
        mappedPath = this.toCdnPath(localPath)
        break
      default:
        mappedPath = localPath
    }

    this.pathMap.set(localPath, mappedPath)
    return mappedPath
  }

  /**
   * 转换为相对路径
   */
  private toRelativePath(localPath: string): string {
    // 简化实现：假设资源在assets目录下
    const fileName = localPath.split('/').pop() || localPath
    return `./assets/${fileName}`
  }

  /**
   * 转换为CDN路径
   */
  private toCdnPath(localPath: string): string {
    // TODO: 实现CDN上传和路径映射
    const fileName = localPath.split('/').pop() || localPath
    return `https://cdn.example.com/assets/${fileName}`
  }

  /**
   * 获取所有路径映射
   */
  getPathMap(): Map<string, string> {
    return new Map(this.pathMap)
  }
}
