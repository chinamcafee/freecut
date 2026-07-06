# FreeCut to HyperFrames 转换器 API 文档

> **文档版本**: v1.0  
> **创建日期**: 2026-07-06  
> **对应代码**: Week 03 Deliverables

---

## 概述

`FreeCutToHyperFramesConverter` 是将 FreeCut timeline 数据转换为 HyperFrames composition 格式的核心转换器。

## 核心类

### FreeCutToHyperFramesConverter

主转换器类，负责将 FreeCut 项目转换为 HyperFrames 格式。

#### 构造函数

```typescript
constructor()
```

创建转换器实例，无需参数。

#### 主要方法

##### convert()

```typescript
convert(
  project: Project,
  options?: FreeCutConverterOptions
): ConversionResult
```

**参数**：
- `project`: FreeCut 项目对象
- `options`: 可选的转换配置

**返回**：
- `ConversionResult`: 包含转换后的 composition、警告和不支持特性列表

**示例**：
```typescript
const converter = new FreeCutToHyperFramesConverter()
const result = converter.convert(project, {
  includeAudio: true,
  includeAnimations: true,
  assetPathStrategy: 'relative'
})
```

---

## 配置选项

### FreeCutConverterOptions

```typescript
interface FreeCutConverterOptions {
  includeAudio?: boolean           // 是否包含音频（默认：true）
  includeAnimations?: boolean      // 是否生成GSAP动画（默认：true）
  assetPathStrategy?: 'relative' | 'absolute' | 'cdn'  // 资源路径策略（默认：'relative'）
  formatHtml?: boolean            // HTML是否格式化（默认：true）
  includeSourceMap?: boolean      // 是否包含source map（默认：false）
}
```

---

## 转换结果

### ConversionResult

```typescript
interface ConversionResult {
  composition: HyperFramesComposition  // 转换后的composition
  warnings: string[]                   // 转换警告
  unsupportedFeatures: string[]        // 不支持的特性
}
```

---

## 元素转换方法

转换器支持以下元素类型的转换：

- **Video**: `convertVideoItem()` - 视频元素
- **Audio**: `convertAudioItem()` - 音频元素
- **Image**: `convertImageItem()` - 图像元素
- **Text**: `convertTextItem()` - 文本元素

---

## Transform 转换

`convertTransform()` 方法处理：
- 位置（position）
- 缩放（scale）
- 旋转（rotation）
- 锚点（anchor）

生成对应的 CSS transform 字符串。

---

## 关键帧动画

`generateGsapAnimation()` 方法：
- 提取关键帧数据
- 转换为 GSAP timeline 代码
- 处理缓动函数（easing）

---

## 资源映射

`AssetMapper` 类处理资源路径映射：
- **relative**: 相对路径
- **absolute**: 绝对路径
- **cdn**: CDN 路径

---

## 使用示例

### 基础转换

```typescript
import { FreeCutToHyperFramesConverter } from '@/features/hyperframes-integration/converters'

const converter = new FreeCutToHyperFramesConverter()
const result = converter.convert(project)

console.log(result.composition)
console.log(result.warnings)
```

### 自定义选项

```typescript
const result = converter.convert(project, {
  includeAudio: false,
  assetPathStrategy: 'cdn',
  formatHtml: true
})
```

---

## 错误处理

转换器不会抛出异常，而是：
1. 返回 `warnings` 数组记录警告
2. 返回 `unsupportedFeatures` 数组记录不支持的特性
3. 尽可能完成转换，跳过无法处理的部分

---

## 性能考虑

- 小型项目（<10个元素）：< 100ms
- 中型项目（10-50个元素）：< 500ms
- 大型项目（>50个元素）：< 2s

---

**文档状态**: ✅ 完成  
**最后更新**: 2026-07-06
