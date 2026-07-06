# FreeCut to HyperFrames 转换规则说明

> **文档版本**: v1.0  
> **创建日期**: 2026-07-06  
> **对应代码**: Week 03 Deliverables

---

## 概述

本文档详细说明 FreeCut timeline 到 HyperFrames composition 的转换规则。

---

## 元素类型映射

### Video 元素

**FreeCut → HyperFrames**

| FreeCut 属性 | HyperFrames 属性 | 转换规则 |
|-------------|-----------------|---------|
| `resourceId` | `src` | 通过 AssetMapper 映射资源路径 |
| `start` | `from` | 帧转时间：`start / fps` |
| `duration` | `duration` | 帧转时间：`duration / fps` |
| `volume` | `volume` | 直接映射（0-1） |
| `from` | 视频起始点 | 通过 `clipStart` 属性 |

### Audio 元素

| FreeCut 属性 | HyperFrames 属性 | 转换规则 |
|-------------|-----------------|---------|
| `resourceId` | `src` | 资源路径映射 |
| `volume` | `volume` | 直接映射 |
| `fadeIn` | CSS transition | 淡入效果 |
| `fadeOut` | CSS transition | 淡出效果 |

### Image 元素

| FreeCut 属性 | HyperFrames 属性 | 转换规则 |
|-------------|-----------------|---------|
| `resourceId` | `src` | 资源路径映射 |
| `transform` | CSS transform | 见 Transform 转换规则 |

### Text 元素

| FreeCut 属性 | HyperFrames 属性 | 转换规则 |
|-------------|-----------------|---------|
| `text` | `textContent` | 直接映射 |
| `fontFamily` | `font-family` | CSS 样式 |
| `fontSize` | `font-size` | 转换为 px 单位 |
| `color` | `color` | RGBA 转换 |
| `textAlign` | `text-align` | 直接映射 |

---

## Transform 转换规则

### 坐标系转换

FreeCut 使用画布坐标系，HyperFrames 使用 HTML 坐标系：

```
FreeCut (0,0) 在左上角
HyperFrames (0,0) 在元素左上角
```

### Position

```typescript
// FreeCut
position: { x: 100, y: 200 }

// HyperFrames CSS
transform: translate(100px, 200px)
```

### Scale

```typescript
// FreeCut
scale: { x: 1.5, y: 1.2 }

// HyperFrames CSS
transform: scale(1.5, 1.2)
```

### Rotation

```typescript
// FreeCut
rotation: 45  // 度数

// HyperFrames CSS
transform: rotate(45deg)
```

### 组合 Transform

```typescript
// FreeCut
{
  position: { x: 100, y: 200 },
  scale: { x: 1.5, y: 1.5 },
  rotation: 45
}

// HyperFrames CSS
transform: translate(100px, 200px) scale(1.5, 1.5) rotate(45deg)
```

---

## 关键帧动画转换

### 关键帧数据结构

**FreeCut 关键帧**：
```typescript
{
  frame: 0,
  value: { x: 0, y: 0 },
  easing: 'ease-in-out'
}
```

**转换为 GSAP**：
```javascript
gsap.timeline()
  .to(element, {
    x: 0,
    y: 0,
    duration: frameDuration,
    ease: 'power2.inOut'
  })
```

### Easing 映射

| FreeCut Easing | GSAP Easing |
|---------------|-------------|
| `linear` | `none` |
| `ease-in` | `power2.in` |
| `ease-out` | `power2.out` |
| `ease-in-out` | `power2.inOut` |
| `cubic-bezier(...)` | 自定义贝塞尔 |

---

## 资源路径映射

### Relative 策略

```
FreeCut: /Users/.../video.mp4
HyperFrames: ./assets/video.mp4
```

### Absolute 策略

```
FreeCut: video-id-123
HyperFrames: file:///Users/.../video.mp4
```

### CDN 策略

```
FreeCut: video-id-123
HyperFrames: https://cdn.example.com/video-id-123.mp4
```

---

## 时间轴转换

### FPS 处理

```typescript
// FreeCut 使用帧数
frame: 90, fps: 30
// 转换为秒
time: 90 / 30 = 3.0s
```

### Duration 计算

```typescript
// FreeCut
start: 30, duration: 60, fps: 30
// HyperFrames
from: 1.0s, duration: 2.0s
```

---

## 特效映射

### 支持的特效

| FreeCut 特效 | CSS Filter |
|-------------|-----------|
| `blur` | `blur(5px)` |
| `brightness` | `brightness(1.2)` |
| `contrast` | `contrast(1.5)` |
| `saturate` | `saturate(2.0)` |
| `grayscale` | `grayscale(1.0)` |

---

## HTML 生成规则

### 文档结构

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>HyperFrames Composition</title>
  <script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js"></script>
</head>
<body>
  <!-- Timeline Elements -->
  <script>
    // GSAP Animations
  </script>
</body>
</html>
```

---

**文档状态**: ✅ 完成  
**最后更新**: 2026-07-06
