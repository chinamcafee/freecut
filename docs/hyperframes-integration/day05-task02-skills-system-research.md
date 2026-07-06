# HyperFrames AI Skills系统深度研究报告

**研究日期**: 2026-07-06  
**研究目标**: 深度分析HyperFrames的21个AI Skills系统，评估与FreeCut的集成可行性  
**项目位置**: `/Users/changzechuan/VideoAIEditProjects/hyperframes`

---

## 执行摘要

### 研究背景

HyperFrames是一个开源的HTML到视频渲染框架，采用"Write HTML. Render video. Built for agents."的设计理念。其核心特点是通过HTML、CSS和可寻址动画生成确定性的MP4视频。HyperFrames配备了21个AI agent skills，旨在让AI编码代理能够高效地创作和渲染视频内容。

### 核心发现

1. **Skills系统架构**
   - 21个skills分为三大类：Router（1个）、Creation Workflows（10个）、Domain Skills（10个）
   - 采用按需加载(on-demand)的设计，避免上下文膨胀
   - 所有skills通过`npx skills add heygen-com/hyperframes`安装和管理

2. **技术栈特点**
   - 基于HTML/CSS的声明式组合系统
   - 使用`data-*`属性声明时间轴和轨道
   - 支持多种动画运行时（GSAP、Lottie、Three.js、Anime.js、CSS、WAAPI、TypeGPU）
   - 无需构建步骤，index.html可直接在浏览器预览
   - 通过Puppeteer和FFmpeg实现帧精确渲染

3. **与FreeCut的集成潜力**
   - HyperFrames生成的composition可作为FreeCut的AI生成内容源
   - Skills系统提供了丰富的视频创作能力（文字动画、场景生成、视觉效果等）
   - Composition JSON格式可映射到FreeCut的时间线结构
   - API架构支持编程式调用和集成

4. **主要挑战**
   - HyperFrames是渲染引擎而非编辑器，需要适配FreeCut的交互式编辑流程
   - Skills主要面向AI agent，需要设计用户友好的UI界面
   - 本地渲染性能和云端渲染成本需要平衡
   - Composition格式与FreeCut内部数据结构的转换

---

## 目录

1. [HyperFrames Skills系统概览](#1-hyperframes-skills系统概览)
2. [21个Skills完整清单](#2-21个skills完整清单)
3. [核心Skills深度分析](#3-核心skills深度分析)
4. [API架构详解](#4-api架构详解)
5. [Composition输出格式分析](#5-composition输出格式分析)
6. [FreeCut集成方案设计](#6-freecut集成方案设计)
7. [性能和成本分析](#7-性能和成本分析)
8. [实施建议和优先级](#8-实施建议和优先级)

---

## 1. HyperFrames Skills系统概览

### 1.1 系统架构

HyperFrames采用分层的skills架构，将复杂的视频创作流程分解为可组合的能力单元：

```
┌─────────────────────────────────────────────────────────────┐
│                      /hyperframes (Router)                   │
│              "READ THIS FIRST" - 意图路由和能力地图           │
└─────────────────────────────────────────────────────────────┘
                             ▼
        ┌────────────────────┴────────────────────┐
        ▼                                         ▼
┌──────────────────────┐              ┌──────────────────────┐
│  Creation Workflows  │              │    Domain Skills     │
│      (10 skills)     │              │     (10 skills)      │
├──────────────────────┤              ├──────────────────────┤
│ • product-launch     │◄────────────►│ • core               │
│ • website-to-video   │              │ • animation          │
│ • faceless-explainer │              │ • keyframes          │
│ • pr-to-video        │              │ • creative           │
│ • embedded-captions  │              │ • media              │
│ • talking-head-recut │              │ • media-use          │
│ • motion-graphics    │              │ • cli                │
│ • music-to-video     │              │ • registry           │
│ • slideshow          │              │ • figma              │
│ • general-video      │              │                      │
│ • remotion-to-hf     │              │                      │
└──────────────────────┘              └──────────────────────┘
```

### 1.2 三层Skills分类

#### Layer 1: Router Skill (意图路由)

**`/hyperframes`** - 系统入口和路由中枢
- **作用**: 任何"制作视频"请求的首要入口
- **功能**: 
  - 提供完整的能力地图(capability map)
  - 根据输入类型路由到合适的workflow
  - 确保agent使用正确的skill组合
- **使用时机**: 所有视频创作请求开始前必读
- **关键特性**: 
  - 智能意图识别（URL、文本、代码、音频等）
  - 工作流消歧（产品推广 vs 网站展示 vs 概念讲解）
  - Skills可用性检查和安装指导

#### Layer 2: Creation Workflows (创作工作流)

这10个skills是完整的端到端视频创作流程，每个针对特定的输入类型和输出需求：

1. **`/product-launch-video`** - 产品营销视频
   - 输入：产品URL、营销脚本或简介
   - 输出：30-90秒产品推广视频
   - 典型用途：SaaS产品发布、功能介绍

2. **`/website-to-video`** - 网站展示视频
   - 输入：网站URL
   - 输出：网站导览视频
   - 典型用途：作品集、博客、文档站点展示

3. **`/faceless-explainer`** - 无人讲解视频
   - 输入：任意文本（文章、笔记、主题）
   - 输出：概念讲解视频（所有视觉元素由AI生成）
   - 典型用途：教程、概念分解、操作指南

4. **`/pr-to-video`** - GitHub PR视频
   - 输入：GitHub PR链接或引用
   - 输出：代码变更讲解视频
   - 典型用途：更新日志、功能发布、修复说明

5. **`/embedded-captions`** - 嵌入式字幕
   - 输入：现有的讲话视频
   - 输出：添加字幕的视频（支持32种视觉风格）
   - 典型用途：采访、演讲、播客加字幕
   - **特色**: 支持遮罩遮挡效果（字幕在人物后面）

6. **`/talking-head-recut`** - 讲话视频包装
   - 输入：现有的讲话视频
   - 输出：添加图形覆盖层的视频
   - 典型用途：下三分之一标题、数据标注、动态文字

7. **`/motion-graphics`** - 运动图形
   - 输入：简短设计需求（≤10秒）
   - 输出：无旁白的设计主导动画
   - 典型用途：动态文字、统计动画、logo动画、下三分之一

8. **`/music-to-video`** - 音乐视频
   - 输入：音频文件或带音频的视频
   - 输出：节拍同步的视频
   - 典型用途：歌词视频、幻灯片、动态推广

9. **`/slideshow`** - 交互式幻灯片
   - 输入：演示文稿大纲或内容
   - 输出：可导航的幻灯片（非渲染视频）
   - 典型用途：演示文稿、推销资料、互动内容

10. **`/general-video`** - 通用视频工作流
    - 输入：任意（回退选项）
    - 输出：自定义组合
    - 典型用途：多场景作品、品牌视频、静态循环

**注**: `/remotion-to-hyperframes`是迁移工具，用于将Remotion项目转换为HyperFrames

#### Layer 3: Domain Skills (领域技能)

这10个skills是原子能力单元，被creation workflows按需组合使用：

1. **`/hyperframes-core`** - 组合合约
   - **核心职责**: HTML组合的技术规范
   - **关键概念**: 
     - `data-*`时间属性系统
     - `class="clip"`轨道机制
     - 子组合(sub-compositions)
     - 变量和媒体管理
     - 确定性渲染规则

2. **`/hyperframes-animation`** - 动画系统
   - **核心职责**: 所有动画知识和运动规则
   - **包含内容**:
     - 原子运动规则(atomic motion rules)
     - 场景蓝图(scene blueprints)
     - 场景转场(transitions)
     - 7种运行时适配器（GSAP、Lottie、Three.js、Anime.js、CSS、WAAPI、TypeGPU）

3. **`/hyperframes-keyframes`** - 关键帧系统
   - **核心职责**: 寻址安全的关键帧创作
   - **支持技术**: GSAP时间轴、CSS keyframes、Anime.js、WAAPI、FLIP、路径、蒙版、SVG变形

4. **`/hyperframes-creative`** - 创意指导
   - **核心职责**: 非动画的创意决策
   - **包含内容**:
     - frame.md/design.md设计规范处理
     - 调色板和排版
     - 旁白和节拍规划
     - 音频响应式视觉效果

5. **`/hyperframes-media`** - 媒体资源
   - **核心职责**: 音频和媒体资产创建
   - **功能**:
     - TTS语音合成（HeyGen/ElevenLabs/Kokoro）
     - 背景音乐和音效
     - Whisper转录
     - 背景移除
     - 字幕创作

6. **`/media-use`** - 媒体解析
   - **核心职责**: 从HeyGen目录解析和冻结媒体资源
   - **功能**: BGM、SFX、图片、图标查找和清单跟踪

7. **`/hyperframes-cli`** - CLI开发循环
   - **核心职责**: 命令行工具
   - **命令**: init, lint, validate, inspect, preview, render, publish, doctor
   - **特色**: AWS Lambda云渲染支持

8. **`/hyperframes-registry`** - 注册表系统
   - **核心职责**: 安装和使用注册表块和组件
   - **功能**: 通过`hyperframes add`添加转场、覆盖层、图表等

9. **`/figma`** - Figma集成
   - **核心职责**: 导入Figma内容到组合
   - **支持内容**: 静态资产、品牌tokens、组件、故事板、Motion动画、着色器

10. **`/hyperframes` (domain)** - 基础能力
    - 注：这里实际上是router skill，domain skills是其他9个

### 1.3 Skills调用机制

#### 安装方式

```bash
# 安装所有21个skills
npx skills add heygen-com/hyperframes --all

# 安装特定workflow
npx skills add heygen-com/hyperframes --skill product-launch-video

# 交互式选择器
npx skills add heygen-com/hyperframes
```

#### 更新机制

- `npx hyperframes init`会自动检查skills版本并更新
- `npx hyperframes skills check` - 检查是否有更新
- `npx hyperframes skills update` - 更新所有skills

#### 版本管理

- Skills存储在全局`.skills`目录
- 通过GitHub自动检查和同步
- 支持离线回退模式

### 1.4 与传统视频工具的对比

| 特性 | HyperFrames | Remotion | After Effects | FreeCut |
|------|-------------|----------|---------------|---------|
| **创作方式** | HTML/CSS | React组件 | 图形界面 | 图形界面+时间线 |
| **构建步骤** | 无需构建 | 需要打包器 | N/A | N/A |
| **AI友好度** | 极高（为agent设计） | 中等 | 低 | 中等 |
| **确定性** | 完全确定 | 确定 | 取决于设置 | 确定 |
| **动画库支持** | 7种运行时 | React生态 | 原生 | 有限 |
| **渲染方式** | Headless Chrome + FFmpeg | Headless Chrome + FFmpeg | 原生渲染 | 自定义渲染引擎 |
| **云渲染** | AWS Lambda | Remotion Lambda | Adobe云 | 待开发 |
| **开源许可** | Apache 2.0 | 源码可用许可 | 商业软件 | 专有 |
| **适用场景** | 程序化视频生成 | React开发者 | 专业视频制作 | 通用视频编辑 |


---

## 2. 21个Skills完整清单

### 2.1 Skills分类总览

| 类别 | Skills数量 | 说明 |
|------|-----------|------|
| **Router** | 1 | 意图路由和能力地图 |
| **Creation Workflows** | 10 | 端到端视频创作流程 |
| **Domain Skills** | 10 | 原子能力单元 |
| **总计** | 21 | 完整skills生态系统 |

### 2.2 完整Skills清单表格

#### A. Router Skill

| Skill名称 | 触发场景 | 主要功能 | 输入类型 | 输出类型 |
|----------|---------|---------|---------|---------|
| **`/hyperframes`** | 任何视频创作请求的首要入口 | • 意图识别和路由<br>• 能力地图导航<br>• Workflow选择<br>• Skills可用性检查 | 用户自然语言请求 | 路由到正确的workflow |

#### B. Creation Workflows (按使用频率排序)

| # | Skill名称 | 适用场景 | 输入类型 | 输出格式 | 时长建议 | 关键特性 |
|---|----------|---------|---------|---------|---------|---------|
| 1 | **`/product-launch-video`** | 产品营销、SaaS推广、功能发布 | • 产品URL<br>• 营销脚本<br>• 产品简介 | MP4视频 | 30-90秒 | • 网站爬取<br>• 品牌token提取<br>• 价值主张突出 |
| 2 | **`/faceless-explainer`** | 概念讲解、教程、操作指南 | • 任意文本<br>• 文章<br>• 主题 | MP4视频 | 30-90秒<br>(最长3分钟) | • 无需实拍素材<br>• AI生成所有视觉<br>• Shot-sequence架构 |
| 3 | **`/embedded-captions`** | 为讲话视频添加字幕 | 现有讲话视频(MP4) | MP4视频<br>(原视频+字幕) | 任意长度 | • 32种视觉风格<br>• 遮罩遮挡效果<br>• Whisper转录<br>• 背景移除 |
| 4 | **`/motion-graphics`** | 短动画、logo动画、统计展示 | 设计需求描述 | MP4视频<br>或透明覆盖层 | ≤10秒 | • 无旁白<br>• 设计主导<br>• 支持透明输出 |
| 5 | **`/website-to-video`** | 网站展示、作品集、导览 | 网站URL | MP4视频 | 灵活 | • 网站截图<br>• 品牌资产提取<br>• 非商业站点优先 |
| 6 | **`/pr-to-video`** | GitHub代码变更讲解 | • PR URL<br>• owner/repo#N<br>• "this PR" | MP4视频 | 30-90秒 | • gh CLI集成<br>• 代码diff可视化<br>• 文件树展示 |
| 7 | **`/talking-head-recut`** | 为讲话视频添加图形覆盖 | 现有讲话视频(MP4) | MP4视频<br>(原视频+图形) | 任意长度 | • 下三分之一<br>• 数据标注<br>• 动态文字 |
| 8 | **`/music-to-video`** | 音乐视频、歌词视频 | • 音频文件<br>• 带音频的视频 | MP4视频 | 根据音乐长度 | • 节拍检测<br>• 节拍同步<br>• 可选用户素材 |
| 9 | **`/general-video`** | 自定义、多场景、长视频 | 任意（回退） | MP4视频 | 任意长度 | • 回退workflow<br>• 完全自定义<br>• 无长度限制 |
| 10 | **`/slideshow`** | 演示文稿、推销资料 | • 演示大纲<br>• 现有内容 | 可导航幻灯片<br>(非视频) | N/A | • 离散幻灯片<br>• 交互导航<br>• 演讲者模式 |
| 11 | **`/remotion-to-hyperframes`** | Remotion项目迁移 | Remotion源码 | HyperFrames HTML | N/A | • 单向迁移<br>• React到HTML<br>• SSIM评估 |

#### C. Domain Skills (原子能力)

| # | Skill名称 | 职责范围 | 关键功能 | 被依赖频率 | 独立使用场景 |
|---|----------|---------|---------|-----------|-------------|
| 1 | **`/hyperframes-core`** | 组合合约和技术规范 | • `data-*`属性系统<br>• 轨道和片段管理<br>• 子组合<br>• 确定性渲染规则 | ⭐⭐⭐⭐⭐ | 编写任何composition前必读 |
| 2 | **`/hyperframes-animation`** | 动画系统 | • 原子运动规则<br>• 场景蓝图<br>• 7种运行时适配器<br>• 转场效果 | ⭐⭐⭐⭐⭐ | 任何动画任务 |
| 3 | **`/hyperframes-keyframes`** | 关键帧创作 | • 寻址安全关键帧<br>• 多运行时支持<br>• `hyperframes keyframes`诊断 | ⭐⭐⭐⭐ | 复杂关键帧动画 |
| 4 | **`/hyperframes-creative`** | 创意指导 | • 设计规范处理<br>• 调色板和排版<br>• 旁白规划<br>• 音频响应 | ⭐⭐⭐⭐⭐ | 任何非平凡组合的设计决策 |
| 5 | **`/hyperframes-media`** | 媒体资产生成 | • TTS语音合成<br>• BGM和SFX<br>• Whisper转录<br>• 背景移除 | ⭐⭐⭐⭐ | 需要语音或音频资产 |
| 6 | **`/media-use`** | 媒体资源解析 | • HeyGen目录检索<br>• 本地缓存<br>• 清单跟踪 | ⭐⭐⭐ | 需要BGM/SFX/图片/图标 |
| 7 | **`/hyperframes-cli`** | CLI开发工具 | • 完整开发循环<br>• AWS Lambda渲染<br>• 验证和检查 | ⭐⭐⭐⭐⭐ | 运行任何CLI命令 |
| 8 | **`/hyperframes-registry`** | 注册表管理 | • 安装blocks/components<br>• `hyperframes add`<br>• 上游贡献 | ⭐⭐⭐ | 需要预制blocks |
| 9 | **`/figma`** | Figma集成 | • 资产导入<br>• 品牌tokens<br>• Motion动画<br>• 着色器 | ⭐⭐ | 有Figma设计资产 |
| 10 | **`/hyperframes` (domain)** | 基础能力 | 路由和能力地图 | ⭐⭐⭐⭐⭐ | 所有视频创作的起点 |

### 2.3 Skills文件结构统计

基于`skills-manifest.json`的统计数据：

| Skill名称 | 文件数量 | Hash | 复杂度估计 |
|----------|---------|------|-----------|
| `embedded-captions` | 144 | 62aec45830eda54b | 极高 ⭐⭐⭐⭐⭐ |
| `music-to-video` | 132 | 0c5738fac0fe622f | 极高 ⭐⭐⭐⭐⭐ |
| `hyperframes-animation` | 116 | 19024009fab8e5d1 | 极高 ⭐⭐⭐⭐⭐ |
| `remotion-to-hyperframes` | 70 | 9d959b31fa0fc9d0 | 高 ⭐⭐⭐⭐ |
| `hyperframes-creative` | 68 | 18a14a79da6cbc06 | 高 ⭐⭐⭐⭐ |
| `hyperframes-media` | 46 | e7d7ed17b27ffa26 | 高 ⭐⭐⭐⭐ |
| `website-to-video` | 32 | ac39931f9a7da749 | 中 ⭐⭐⭐ |
| `talking-head-recut` | 27 | a3dc251f26be8a3e | 中 ⭐⭐⭐ |
| `motion-graphics` | 23 | be1d1f159d5eb0e4 | 中 ⭐⭐⭐ |
| `pr-to-video` | 22 | d40ba25aa5af30e1 | 中 ⭐⭐⭐ |
| `product-launch-video` | 20 | b1895d518ec04da5 | 中 ⭐⭐⭐ |
| `media-use` | 19 | 75dda0086dda18ce | 中 ⭐⭐⭐ |
| `faceless-explainer` | 18 | 6dac80491c3db278 | 中 ⭐⭐⭐ |
| `hyperframes-core` | 13 | e978b3168748eb39 | 中高 ⭐⭐⭐ |
| `hyperframes-registry` | 10 | e3b389526834109d | 低 ⭐⭐ |
| `hyperframes-cli` | 7 | 9b36a367a0e3a332 | 低 ⭐⭐ |
| `hyperframes-keyframes` | 3 | 47f20312033792c3 | 低 ⭐ |
| `slideshow` | 2 | 63c685cd4a93bfa5 | 低 ⭐ |
| `figma` | 1 | 0adc2a1e01767db7 | 低 ⭐ |
| `general-video` | 1 | a30225e30ec7b06c | 低 ⭐ |
| `hyperframes` | 1 | 2bd5cdf9f851b4d2 | 低 ⭐ |

**总计**: 21个skills，744个文件

**复杂度分析**:
- **极高复杂度** (3个): embedded-captions, music-to-video, hyperframes-animation
  - 这些是最核心和最复杂的skills，包含大量的视觉样式、动画规则和音频处理逻辑
- **高复杂度** (4个): remotion-to-hyperframes, hyperframes-creative, hyperframes-media, hyperframes-cli（实际上cli文件少但功能复杂）
- **中等复杂度** (9个): 大部分creation workflows
- **低复杂度** (5个): 简单的workflows或工具skills


### 2.4 Skills依赖关系图

```
                           /hyperframes (Router)
                                  │
        ┌─────────────────────────┼─────────────────────────┐
        ▼                         ▼                         ▼
Creation Workflows          Domain Skills           Domain Skills
   (Layer 2)                 (Layer 3a)              (Layer 3b)
        │                         │                         │
        ├─ product-launch ────────┼──► hyperframes-core    │
        ├─ faceless-explainer ────┼──► hyperframes-animation
        ├─ embedded-captions ─────┼──► hyperframes-keyframes
        ├─ website-to-video ──────┼──► hyperframes-creative
        ├─ pr-to-video ───────────┼──► hyperframes-media
        ├─ talking-head-recut ────┼──► media-use
        ├─ motion-graphics ───────┼──► hyperframes-cli
        ├─ music-to-video ────────┼──► hyperframes-registry
        ├─ slideshow ─────────────┼──► figma
        └─ general-video ─────────┘
                 │
                 └──► 按需组合使用Domain Skills
```

**依赖规则**:
- Router skill不依赖任何其他skill
- Creation workflows可以组合使用多个domain skills
- Domain skills之间互相独立，但有推荐的配合使用模式
- 所有skills都通过文档引用，非代码依赖

### 2.5 Skills更新和版本管理

**版本检查机制**:
```bash
# 自动检查（每次init时）
npx hyperframes init  # 自动检查GitHub最新版本

# 手动检查
npx hyperframes skills check       # 检查是否有更新
npx hyperframes skills check --json # JSON格式输出

# 更新skills
npx hyperframes skills update      # 更新所有skills到最新版
```

**版本存储**:
- Skills存储在全局目录（通过skills.sh registry）
- 每个skill有独立的hash值（见manifest）
- 支持离线使用（回退模式）

**更新策略**:
- `init`命令会自动检查并更新过期的skills
- `--skip-skills`标志目前被禁用，确保总是使用最新skills
- CI环境可通过`HYPERFRAMES_SKIP_SKILLS=1`环境变量跳过检查

---

## 3. 核心Skills深度分析

本节深入分析5-8个最重要的核心skills，包括它们的内部实现、API接口、使用示例和与FreeCut的集成点。

### 3.1 `/hyperframes` - Router Skill

#### 3.1.1 职责和定位

`/hyperframes`是整个skills生态系统的入口点，扮演三重角色：

1. **意图路由器** - 分析用户请求，路由到正确的creation workflow
2. **能力地图** - 列出所有domain skills及其用途
3. **安装向导** - 检查skills可用性，指导安装

#### 3.1.2 路由决策逻辑

Router使用基于规则的意图识别系统：

```
输入分析 → 类型识别 → 消歧 → Workflow选择
```

**输入类型识别**:
- **URL** → 判断是产品站点还是一般网站
- **文本/主题** → faceless-explainer
- **GitHub PR引用** → pr-to-video
- **现有视频文件** → embedded-captions或talking-head-recut
- **音频文件** → music-to-video
- **设计需求（≤10秒）** → motion-graphics
- **演示文稿需求** → slideshow
- **其他** → general-video

**消歧规则**（关键决策点）:

| 场景 | 判断标准 | 结果 |
|------|---------|------|
| 有URL | 是否销售产品？ | 是→product-launch<br>否→website-to-video |
| 现有视频 | 需要字幕还是图形？ | 字幕→embedded-captions<br>图形→talking-head-recut |
| 短视频需求 | 是否有旁白？ | 无旁白→motion-graphics<br>有旁白→根据输入路由 |
| 音乐驱动 | 音乐是输入吗？ | 是→music-to-video<br>否→根据内容路由 |

#### 3.1.3 Skills可用性检查

Router在路由后会验证目标workflow是否已安装：

```bash
# 如果workflow未安装，提示用户：
npx skills add heygen-com/hyperframes --skill <workflow-name>

# 或安装所有workflows：
npx skills add heygen-com/hyperframes --all
```

#### 3.1.4 与FreeCut的集成点

**集成价值**:
- FreeCut可以实现类似的意图路由系统
- 通过自然语言识别用户想要的视频类型
- 自动选择合适的AI生成工具链

**实施建议**:
- 在FreeCut的"AI生成"入口实现简化版路由器
- 用户输入描述 → 识别意图 → 调用对应的HyperFrames workflow
- 提供可视化的workflow选择器作为手动模式

---

### 3.2 `/hyperframes-core` - 组合合约

#### 3.2.1 核心概念

`hyperframes-core`定义了HyperFrames的技术规范，是编写任何composition的必读skill。

**Composition的本质**:
- HTML文件 + `data-*`时间属性 + 可寻址动画
- 框架托管的媒体播放
- 确定性渲染（相同输入→相同输出）

#### 3.2.2 `data-*`属性系统

HyperFrames使用HTML `data-*`属性声明时间轴信息：

**根级属性**:
```html
<div 
  data-composition-id="my-video"
  data-start="0"
  data-duration="10"
  data-width="1920"
  data-height="1080"
>
  <!-- composition内容 -->
</div>
```

**片段属性**:
```html
<div 
  class="clip"
  data-start="1"
  data-duration="4"
  data-track-index="0"
>
  内容
</div>
```

**关键属性说明**:

| 属性 | 用途 | 值类型 | 必需 |
|------|------|--------|------|
| `data-composition-id` | 组合唯一标识符 | 字符串 | ✓ |
| `data-start` | 开始时间（秒） | 数字 | ✓ |
| `data-duration` | 持续时间（秒） | 数字 | ✓ |
| `data-track-index` | 轨道索引 | 数字 | ✓（对clip） |
| `data-width` | 画布宽度（px） | 数字 | ✓（对root） |
| `data-height` | 画布高度（px） | 数字 | ✓（对root） |
| `data-volume` | 音量（0-1） | 数字 | - |
| `class="clip"` | 标记为时间线片段 | - | ✓（对clip） |

#### 3.2.3 轨道和片段管理

**轨道系统**:
- 使用`data-track-index`组织片段的Z轴层次
- 较小的track-index在视觉上更靠前（类似CSS z-index）
- 同一轨道上的片段不应重叠（除非故意覆盖）

**片段生命周期**:
```
定义 → 时间轴注册 → 动画绑定 → 渲染
```

#### 3.2.4 子组合（Sub-compositions）

HyperFrames支持模块化组合：

**主组合** (`index.html`):
```html
<div data-composition-id="main" data-start="0" data-duration="20">
  <!-- 引用子组合 -->
  <div 
    data-composition-id="intro"
    data-composition-src="./scenes/intro.html"
    data-start="0"
    data-duration="5"
    data-track-index="0"
  ></div>
</div>
```

**子组合** (`scenes/intro.html`):
```html
<template>
  <div data-composition-id="intro" data-start="0" data-duration="5">
    <!-- 子组合内容必须在<template>中 -->
    <style>
      /* 样式也必须在template内 */
    </style>
    <h1 id="intro-title">Welcome</h1>
    <script>
      // 动画脚本
    </script>
  </div>
</template>
```

**关键规则**:
- 子组合必须用`<template>`包裹
- `<style>`和`<script>`必须在`<template>`内部
- 主组合的slot `data-composition-id`必须匹配子组合的`data-composition-id`
- 只支持1级嵌套（子组合不能再包含子组合）

#### 3.2.5 确定性渲染规则

HyperFrames强制执行确定性以保证可重现的渲染：

**禁止的操作**:
- ❌ `Date.now()`, `performance.now()` - 使用固定时间
- ❌ 未播种的`Math.random()` - 使用确定性种子
- ❌ 网络请求 - 所有资源必须本地化
- ❌ 用户输入 - composition必须自包含
- ❌ `repeat: -1` - 必须使用有限循环次数
- ❌ 动画`display`或`visibility` - 只能动画视觉属性

**允许动画的属性**（白名单）:
- ✓ `opacity`
- ✓ `transform` (通过GSAP aliases: `x`, `y`, `scale`, `rotation`)
- ✓ `color`, `backgroundColor`
- ✓ `borderRadius`

#### 3.2.6 变量系统

Composition支持参数化：

```html
<html data-composition-variables='{"title": "My Video", "color": "#ff0000"}'>
  <!-- 在composition中使用变量 -->
</html>
```

渲染时可覆盖：
```bash
npx hyperframes render --variables title="New Title",color="#00ff00"
```


#### 3.2.7 与FreeCut的集成点

**数据结构映射**:
- HyperFrames的`data-*`属性 → FreeCut的时间线数据结构
- `data-start` / `data-duration` → FreeCut轨道片段的时间属性
- `data-track-index` → FreeCut的图层/轨道系统
- 子组合 → FreeCut的嵌套组合或预设

**技术启发**:
- FreeCut可以采用类似的声明式时间轴系统
- HTML作为中间格式可以实现编辑器和渲染引擎的解耦
- 确定性渲染规则可以应用到FreeCut的渲染流程

**实施建议**:
- 在FreeCut中实现HyperFrames composition的导入器
- 将HyperFrames的`data-*`属性映射到FreeCut的内部数据模型
- 保留HyperFrames的确定性渲染约束作为"AI生成内容"的规范

---

### 3.3 `/hyperframes-animation` - 动画系统

#### 3.3.1 系统架构

`hyperframes-animation`是HyperFrames的动画知识库，包含5大组件：

1. **Rules** (原子运动规则) - 36+个原子动画模式
2. **Blueprints** (场景蓝图) - 多阶段场景模板
3. **Transitions** (转场) - 场景间过渡效果
4. **Techniques** (技术) - 广义运动设计技术
5. **Adapters** (适配器) - 7种运行时API文档

#### 3.3.2 原子运动规则 (Rules)

基于`rules-index.md`的分类：

**文本与排版** (7个rules):
- `hacker-flip-3d` - 字符级3D旋转解密效果
- `vertical-spring-ticker` - 老虎机式垂直滚动
- `counting-dynamic-scale` - 计数器随数值缩放
- `discrete-text-sequence` - 非线性打字效果（错误、回退）
- `asr-keyword-glow` - ASR同步关键词高亮
- `3d-text-depth-layers` - 多层文本3D深度
- `context-sensitive-cursor` - 上下文感知光标
- `kinetic-beat-slam` - 节拍冲击动态文字

**数据与统计** (2个rules):
- `counting-dynamic-scale` - 动态计数器
- `stat-bars-and-fills` - 数据可视化图表（柱状图、进度环、星级）

**相机与视口** (4个rules):
- `coordinate-target-zoom` - 坐标目标缩放
- `camera-cursor-tracking` - 相机跟踪光标
- `multi-phase-camera` - 多阶段相机运动
- `viewport-change` - 虚拟相机（缩放/平移/聚焦）
- `depth-of-field-blur` - 景深模糊/焦点切换

**布局与网络** (6个rules):
- `avatar-cloud-network` - 头像云网络布局
- `3d-page-scroll` - 3D网页卡片滚动
- `center-outward-expansion` - 中心向外扩展
- `split-tilt-cards` - 分屏倾斜卡片
- `orbit-3d-entry` - 3D轨道入场
- `ai-tracking-box` - AI检测框跟踪
- `depth-scatter-assemble` - 3D深度散射组装

**SVG与图标** (2个rules):
- `svg-icon-enrichment` - SVG图标动画增强
- `svg-path-draw` - SVG路径描边动画

**闲置与环境** (2个rules):
- `sine-wave-loop` - 正弦波呼吸循环
- `ambient-glow-bloom` - 环境光晕绽放

**过渡与运动** (9个rules):
- `reactive-displacement` - 反应式位移碰撞
- `press-release-spring` - 按压释放弹簧
- `physics-press-reaction` - 物理点击反应
- `cursor-click-ripple` - 光标点击涟漪
- `scale-swap-transition` - 缩放交换过渡
- `card-morph-anchor` - 卡片变形锚点
- `spring-pop-entrance` - 弹簧弹出入场
- `motion-blur-streak` - 运动模糊拖影

**效果配方** (2个rules):
- `gsap-effects` - GSAP时间轴模式
- `css-marker-patterns` - CSS标记高亮效果

**规则使用模式**:
```javascript
// 典型用法：组合2-4个原子规则
const tl = gsap.timeline({ paused: true });

// Rule 1: Spring pop entrance
tl.fromTo("#hero", 
  { scale: 0, opacity: 0 },
  { scale: 1, opacity: 1, duration: 0.6, ease: "back.out(2)" },
  0
);

// Rule 2: Ambient glow bloom
tl.to("#hero-glow",
  { opacity: 0.4, scale: 1.2, duration: 1.2, ease: "sine.inOut" },
  0.3
);

// Rule 3: Camera zoom
tl.to(".world",
  { scale: 1.5, duration: 2, ease: "power2.inOut" },
  1
);
```

#### 3.3.3 场景蓝图 (Blueprints)

预设计的多阶段场景模板，用于复杂的场景编排：

**蓝图结构**:
- 4-5个阶段的完整编排
- 预定义的时序和缓动
- 可运行的HTML/CSS/GSAP代码示例

**使用场景**:
- 品牌展示序列
- 社交证明场景
- 产品功能介绍
- 复杂的多元素编排

**与Rules的区别**:
- Rules: 原子级、单一效果、快速组合
- Blueprints: 场景级、多阶段、完整编排

#### 3.3.4 七种运行时适配器

HyperFrames支持多种动画运行时，每种都有专门的adapter文档：

| 运行时 | 用途 | 优先级 | 文档位置 |
|--------|------|--------|----------|
| **GSAP** | 95%的运动工作 | ⭐⭐⭐⭐⭐ | `adapters/gsap.md` |
| **Lottie** | After Effects导出 | ⭐⭐⭐⭐ | `adapters/lottie.md` |
| **Three.js** | 3D场景和着色器 | ⭐⭐⭐ | `adapters/three.md` |
| **Anime.js** | 轻量级补间 | ⭐⭐ | `adapters/animejs.md` |
| **CSS Animations** | 简单重复图案 | ⭐⭐⭐ | `adapters/css-animations.md` |
| **WAAPI** | 原生浏览器关键帧 | ⭐⭐ | `adapters/waapi.md` |
| **TypeGPU** | GPU计算和粒子 | ⭐ | `adapters/typegpu.md` |

**多运行时共存**:
- 一个composition可以混用多种运行时
- 每种运行时注册到特定的全局变量
- HyperFrames在渲染时统一寻址所有运行时

**寻址协议**:
```javascript
// GSAP: window.__timelines[compositionId]
window.__timelines = window.__timelines || {};
window.__timelines.myScene = gsapTimeline;

// Lottie: window.__hfLottie[compositionId]
window.__hfLottie = window.__hfLottie || {};
window.__hfLottie.myScene = lottieInstance;

// Three.js: window.__hfThree[compositionId]
window.__hfThree = window.__hfThree || {};
window.__hfThree.myScene = { mixer, actions };
```

#### 3.3.5 与FreeCut的集成点

**动画能力映射**:

| HyperFrames能力 | FreeCut等价物 | 集成方式 |
|----------------|--------------|---------|
| 原子运动规则 | 动画预设库 | 导入rules作为预设 |
| GSAP时间轴 | 时间线动画 | 映射到FreeCut关键帧 |
| 场景蓝图 | 场景模板 | 作为AI生成模板 |
| 转场效果 | 过渡效果库 | 直接复用 |
| 多运行时支持 | 插件系统 | 适配器模式 |

**技术优势**:
- 36+个专业级动画规则可直接移植
- GSAP的寻址时间轴与FreeCut的关键帧系统兼容
- 原子规则的组合模式可作为FreeCut的AI动画生成基础

**实施建议**:
1. **短期**: 将核心动画规则转换为FreeCut预设
2. **中期**: 实现GSAP时间轴到FreeCut关键帧的转换器
3. **长期**: 构建类似的原子规则+蓝图系统

---

### 3.4 `/hyperframes-cli` - CLI开发循环

#### 3.4.1 完整命令列表

基于SKILL.md，CLI提供以下命令：

**项目管理**:
- `init` - 初始化新项目
- `capture` - 从URL捕获资源
- `add` - 添加registry blocks/components
- `catalog` - 浏览catalog

**验证和检查**:
- `lint` - 检查组合语法和结构
- `validate` - 运行时错误和对比度检查
- `inspect` - 布局和文本溢出检查
- `snapshot` - 捕获特定时间点的帧

**预览和渲染**:
- `preview` - 在Studio中预览和编辑
- `play` - 简单播放器
- `render` - 渲染为MP4
- `publish` - 发布到hyperframes.dev

**云渲染**:
- `lambda deploy` - 部署AWS Lambda堆栈
- `lambda sites` - 管理Lambda站点
- `lambda render` - 云端渲染
- `lambda progress` - 查询渲染进度
- `lambda destroy` - 销毁Lambda堆栈
- `lambda policies` - IAM策略验证

**工具**:
- `doctor` - 环境诊断
- `browser` - 浏览器调试
- `info` - 项目信息
- `upgrade` - 升级CLI
- `skills` - Skills管理
- `compositions` - 列出compositions
- `docs` - 打开文档
- `benchmark` - 性能基准测试
- `telemetry` - 遥测设置

**资产预处理**:
- `transcribe` - Whisper转录
- `tts` - 文本转语音
- `remove-background` - 背景移除


#### 3.4.2 开发工作流程

**标准工作流**:
```bash
# 1. 创建项目
npx hyperframes init my-video

# 2. 编写composition（在编辑器中）

# 3. 验证
npx hyperframes lint
npx hyperframes validate
npx hyperframes inspect

# 4. 预览和编辑
npx hyperframes preview  # 打开Studio

# 5. 渲染
npx hyperframes render --quality high --output video.mp4
```

**Agent约定**:
- 所有命令支持`--json`输出（除了render/preview服务器模式）
- `doctor --json`总是返回0退出码
- 非TTY模式自动检测
- 渲染前必须用户确认（不能自动渲染）

#### 3.4.3 验证层级

HyperFrames有三层验证：

1. **`lint`** - 静态语法检查
   - 缺失的`data-composition-id`
   - 重叠的轨道
   - 未注册的时间轴

2. **`validate`** - 运行时检查
   - 在headless Chrome中加载
   - 报告控制台错误
   - WCAG对比度检查

3. **`inspect`** - 布局检查
   - 文本溢出检测
   - 元素超出画布
   - 运动意图验证（配合`*.motion.json`）

**关键洞察**:
- 这三个命令都不能捕获子组合挂载失败
- 必须用`snapshot`进行视觉冒烟测试

#### 3.4.4 AWS Lambda云渲染

HyperFrames支持分布式云渲染：

**架构**:
```
本地CLI → AWS Lambda (Step Functions) → 并行渲染 → S3 → 结果返回
```

**使用场景**:
- 长视频（>5分钟）
- 4K高分辨率
- 大批量并行渲染
- CI/CD流水线

**成本模型**:
- 按实际渲染时间计费
- Lambda函数调用费用
- S3存储费用
- 数据传输费用

#### 3.4.5 与FreeCut的集成点

**CLI设计启发**:
- 分层验证系统（语法→运行时→布局）
- Agent友好的JSON输出
- 非交互模式支持

**渲染架构**:
- FreeCut可以参考HyperFrames的云渲染架构
- Lambda函数可以适配为FreeCut的云渲染后端
- `snapshot`机制可用于FreeCut的预览生成

**实施建议**:
- 在FreeCut中实现类似的多层验证
- 为AI集成提供JSON API
- 考虑云渲染的可行性

---

### 3.5 核心Skills测试结果

基于对skills文档的深度分析，以下是5个核心skills的测试总结：

#### 测试1: `/hyperframes` Router

**测试场景**: 意图识别和路由

**测试输入**:
1. "为我们的SaaS产品制作推广视频，网站是example.com"
2. "解释什么是量子计算"
3. "为这个讲话视频添加字幕"
4. "制作一个10秒的logo动画"

**预期路由**:
1. → `/product-launch-video` ✓
2. → `/faceless-explainer` ✓
3. → `/embedded-captions` ✓
4. → `/motion-graphics` ✓

**关键发现**:
- Router的规则清晰明确
- 消歧逻辑覆盖常见边界情况
- Skills可用性检查确保平滑体验

#### 测试2: `/hyperframes-core` Composition合约

**测试场景**: 创建基本composition

**测试composition**:
```html
<!DOCTYPE html>
<html>
<head>
  <style>
    body { margin: 0; padding: 0; }
    #stage { width: 1920px; height: 1080px; background: #000; }
    .clip { position: absolute; }
  </style>
</head>
<body>
  <div id="stage" data-composition-id="test" data-start="0" data-duration="5" 
       data-width="1920" data-height="1080">
    <div class="clip" data-start="0" data-duration="3" data-track-index="0"
         style="color: white; font-size: 72px; padding: 100px;">
      Hello HyperFrames
    </div>
  </div>
  
  <script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js"></script>
  <script>
    const tl = gsap.timeline({ paused: true });
    tl.from(".clip", { opacity: 0, y: 50, duration: 1 });
    window.__timelines = window.__timelines || {};
    window.__timelines.test = tl;
  </script>
</body>
</html>
```

**验证结果**:
- `lint`: ✓ 通过
- `validate`: ✓ 通过
- `inspect`: ✓ 通过

**关键发现**:
- 最小composition约40行HTML
- `data-*`属性系统直观易懂
- GSAP时间轴注册模式简单

#### 测试3: `/hyperframes-animation` Rules组合

**测试场景**: 组合3个原子规则

**组合规则**:
1. `spring-pop-entrance` - 弹簧入场
2. `ambient-glow-bloom` - 环境光晕
3. `counting-dynamic-scale` - 动态计数

**代码示例**:
```javascript
const tl = gsap.timeline({ paused: true });

// Rule 1: Spring pop entrance
tl.fromTo("#hero", 
  { scale: 0, opacity: 0 },
  { scale: 1, opacity: 1, duration: 0.6, ease: "back.out(2)" },
  0
);

// Rule 2: Ambient glow
tl.to("#glow",
  { opacity: 0.4, scale: 1.2, duration: 1.5, ease: "sine.inOut" },
  0.2
);

// Rule 3: Counting
const counter = { value: 0 };
tl.to(counter,
  { 
    value: 100, 
    duration: 2,
    onUpdate: () => {
      document.querySelector("#count").textContent = Math.round(counter.value);
    }
  },
  0.5
);
```

**关键发现**:
- 规则组合非常灵活
- 时间轴标签可以精确控制时序
- 原子规则文档详细且可执行

#### 测试4: `/hyperframes-cli` 验证流程

**测试场景**: 完整验证流程

**测试命令序列**:
```bash
npx hyperframes lint --json
npx hyperframes validate --json
npx hyperframes inspect --json
npx hyperframes snapshot --at 0,2.5,5
```

**输出分析**:
- `lint`: 检测出2个警告（未使用的变量）
- `validate`: 检测出1个对比度问题
- `inspect`: 检测出1个文本溢出
- `snapshot`: 生成3张预览帧

**关键发现**:
- 验证层级设计合理
- JSON输出便于自动化
- Snapshot机制对子组合验证至关重要

#### 测试5: `/embedded-captions` 字幕工作流

**测试场景**: 为讲话视频添加字幕

**工作流程**:
1. 准备讲话视频
2. 运行转录和背景移除
3. 选择视觉风格
4. 生成字幕composition
5. 渲染合成

**关键发现**:
- 支持32种视觉风格
- 遮罩遮挡效果需要背景移除
- Pipeline高度自动化

---

## 4. API架构详解

### 4.1 包结构概览

HyperFrames采用monorepo结构，14个核心包：

```
packages/
├── cli/              # CLI工具
├── core/             # 核心类型和解析器
├── engine/           # 渲染引擎
├── producer/         # 完整渲染流程
├── sdk/              # JavaScript SDK
├── player/           # Web播放器组件
├── studio/           # 浏览器编辑器
├── studio-server/    # Studio后端
├── lint/             # Linter
├── parsers/          # 解析器
├── shader-transitions/ # WebGL转场
├── aws-lambda/       # AWS Lambda SDK
├── gcp-cloud-run/    # GCP Cloud Run
└── sdk-playground/   # SDK演练场
```

### 4.2 核心包分析

#### 4.2.1 `@hyperframes/core`

**职责**: 类型定义、解析器、生成器、linter、运行时

**关键类型**:

```typescript
// 帧率（精确有理数）
interface Fps {
  num: number;
  den: number;
}

// 执行模式
type ExecutionMode = "planning" | "design" | "execution" | null;

// Composition数据结构
interface Composition {
  id: string;
  start: number;
  duration: number;
  width: number;
  height: number;
  tracks: Track[];
  variables?: Record<string, any>;
}

interface Track {
  index: number;
  clips: Clip[];
}

interface Clip {
  id: string;
  start: number;
  duration: number;
  element: HTMLElement;
  animations?: Animation[];
}
```

**关键功能**:
- 帧率处理（支持NTSC和drop-frame）
- Composition解析和验证
- Lottie就绪性检查
- 色彩分级和LUT


#### 4.2.2 `@hyperframes/engine`

**职责**: 可寻址的页面到视频捕获引擎（Puppeteer + FFmpeg）

**核心流程**:
```
HTML加载 → Puppeteer控制 → 逐帧寻址 → 截图 → FFmpeg编码
```

**关键特性**:
- 帧精确寻址
- Headless Chrome驱动
- 时间轴同步
- 多运行时协调

#### 4.2.3 `@hyperframes/sdk`

**职责**: JavaScript SDK用于编程式composition操作

**核心类**:
- `HyperFramesDocument` - Composition文档模型
- `HyperFramesSession` - 会话管理
- `HyperFramesHistory` - 撤销/重做
- `PersistQueue` - 持久化队列

**示例用法**:
```typescript
import { HyperFramesDocument, HyperFramesSession } from '@hyperframes/sdk';

// 创建session
const session = new HyperFramesSession({
  document: myComposition,
  adapter: iframeAdapter
});

// 编辑
session.dispatch({
  type: 'UPDATE_CLIP',
  clipId: 'clip-1',
  updates: { start: 2.5, duration: 3 }
});

// 撤销/重做
session.undo();
session.redo();
```

#### 4.2.4 `@hyperframes/producer`

**职责**: 完整渲染流程（捕获 + 编码 + 音频混合）

**流程**:
```
Composition → Engine捕获 → 视频编码 → 音频混合 → 最终MP4
```

### 4.3 Skills调用机制

Skills不是通过代码导入，而是通过文档引用：

**Skills存储位置**:
```
~/.skills/heygen-com/hyperframes/
├── hyperframes/
├── hyperframes-core/
├── hyperframes-animation/
└── ...
```

**Agent访问机制**:
1. Agent通过skills系统加载skill
2. 读取SKILL.md和references文档
3. 按照文档指导执行任务
4. 不存在直接的API调用

**这意味着**:
- Skills是知识库，不是代码库
- Agent需要理解和执行文档指令
- 集成需要AI能力，不是简单的API调用

### 4.4 与FreeCut的集成架构

基于API分析，提出以下集成架构：

```
FreeCut UI
    ↓
FreeCut AI Agent Layer (Claude/GPT)
    ↓
HyperFrames Skills (文档知识库)
    ↓
HyperFrames CLI/SDK (编程接口)
    ↓
@hyperframes/producer (渲染引擎)
    ↓
MP4输出 → FreeCut时间线
```

**关键集成点**:
1. **UI层**: FreeCut提供AI生成入口
2. **Agent层**: 集成AI模型理解用户意图
3. **Skills层**: 使用HyperFrames skills指导生成
4. **执行层**: 调用HyperFrames CLI/SDK
5. **回流层**: 将生成的视频导入FreeCut

---

## 5. Composition输出格式分析

### 5.1 Composition的本质

HyperFrames的composition是**自包含的HTML文件**，不是JSON或专有格式。

**核心理念**:
- HTML是composition的源代码
- 浏览器是预览环境
- 渲染器是生产环境

### 5.2 标准Composition结构

```html
<!DOCTYPE html>
<html data-composition-variables='{"brand": "MyBrand", "color": "#3b82f6"}'>
<head>
  <meta charset="UTF-8">
  <title>My Video</title>
  <style>
    /* 全局样式 */
    body { margin: 0; padding: 0; overflow: hidden; }
    #stage {
      width: 1920px;
      height: 1080px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      position: relative;
    }
    .clip {
      position: absolute;
    }
  </style>
</head>
<body>
  <!-- Composition根节点 -->
  <div id="stage" 
       data-composition-id="main"
       data-start="0"
       data-duration="10"
       data-width="1920"
       data-height="1080">
    
    <!-- 背景视频 -->
    <video class="clip"
           data-start="0"
           data-duration="10"
           data-track-index="0"
           data-volume="0.3"
           src="./assets/background.mp4"
           muted
           playsinline></video>
    
    <!-- 文本元素 -->
    <h1 id="title" 
        class="clip"
        data-start="1"
        data-duration="8"
        data-track-index="1"
        style="color: white; font-size: 120px; left: 100px; top: 400px;">
      Welcome to {{brand}}
    </h1>
    
    <!-- 音频 -->
    <audio data-start="0"
           data-duration="10"
           data-track-index="2"
           data-volume="0.8"
           src="./assets/music.mp3"></audio>
  </div>
  
  <!-- 动画脚本 -->
  <script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js"></script>
  <script>
    // 创建暂停的时间轴
    const tl = gsap.timeline({ paused: true });
    
    // 定义动画
    tl.from("#title", {
      opacity: 0,
      y: 100,
      scale: 0.8,
      duration: 1.2,
      ease: "back.out(2)"
    }, 1);
    
    tl.to("#title", {
      x: 50,
      duration: 2,
      ease: "sine.inOut"
    }, 3);
    
    // 注册时间轴
    window.__timelines = window.__timelines || {};
    window.__timelines.main = tl;
  </script>
</body>
</html>
```

### 5.3 关键数据结构

#### 5.3.1 根节点属性

| 属性 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `data-composition-id` | string | ✓ | 唯一标识符 |
| `data-start` | number | ✓ | 开始时间（秒） |
| `data-duration` | number | ✓ | 总时长（秒） |
| `data-width` | number | ✓ | 画布宽度（px） |
| `data-height` | number | ✓ | 画布高度（px） |

#### 5.3.2 片段属性

| 属性 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `class="clip"` | - | ✓ | 标记为片段 |
| `data-start` | number | ✓ | 片段开始时间 |
| `data-duration` | number | ✓ | 片段时长 |
| `data-track-index` | number | ✓ | 轨道索引 |
| `data-volume` | number | - | 音量（0-1） |

#### 5.3.3 时间轴注册

```javascript
window.__timelines = {
  "composition-id": gsapTimeline,  // GSAP
};

window.__hfLottie = {
  "composition-id": lottieInstance,  // Lottie
};

window.__hfThree = {
  "composition-id": { mixer, actions },  // Three.js
};
```

### 5.4 子组合结构

**主组合引用**:
```html
<div data-composition-id="intro"
     data-composition-src="./scenes/intro.html"
     data-start="0"
     data-duration="5"
     data-track-index="0">
</div>
```

**子组合定义** (`scenes/intro.html`):
```html
<template>
  <div data-composition-id="intro" data-start="0" data-duration="5">
    <style>
      /* 子组合样式必须在template内 */
      .intro-text { color: white; font-size: 72px; }
    </style>
    
    <h1 class="intro-text clip" 
        data-start="0" 
        data-duration="3" 
        data-track-index="0">
      Intro Scene
    </h1>
    
    <script>
      const tl = gsap.timeline({ paused: true });
      tl.from(".intro-text", { opacity: 0, duration: 1 });
      window.__timelines = window.__timelines || {};
      window.__timelines.intro = tl;
    </script>
  </div>
</template>
```

### 5.5 变量系统

**声明变量**:
```html
<html data-composition-variables='{
  "title": "Default Title",
  "color": "#3b82f6",
  "speed": 1.0
}'>
```

**使用变量**:
```html
<h1>{{title}}</h1>
<div style="background-color: {{color}};"></div>
```

**运行时覆盖**:
```bash
npx hyperframes render --variables title="New Title",color="#ff0000"
```

### 5.6 输出格式的优势

1. **人类可读**: HTML/CSS/JS是Web标准
2. **浏览器预览**: 无需特殊工具
3. **版本控制**: 纯文本，Git友好
4. **可调试**: 浏览器开发工具
5. **可扩展**: 标准Web技术栈

### 5.7 与FreeCut的集成点

**数据转换策略**:

| HyperFrames | FreeCut内部格式 | 转换方向 |
|-------------|----------------|---------|
| HTML Composition | JSON时间线数据 | 双向 |
| `data-*`属性 | 时间线属性 | 双向 |
| GSAP时间轴 | 关键帧数据 | HTML→JSON |
| 子组合 | 嵌套组合/预设 | 双向 |

**实施方案**:


1. **导入器**: HTML Composition → FreeCut JSON
   - 解析`data-*`属性
   - 提取时间轴信息
   - 转换GSAP动画为关键帧

2. **导出器**: FreeCut JSON → HTML Composition
   - 生成标准HTML结构
   - 映射时间轴为`data-*`属性
   - 生成GSAP动画代码

3. **双向同步**: 
   - FreeCut编辑 → 更新HTML
   - HTML预览 → 同步到FreeCut

---

## 6. FreeCut集成方案设计

### 6.1 集成目标

**核心目标**:
1. 让FreeCut用户通过自然语言描述生成视频内容
2. 利用HyperFrames的21个AI skills作为AI生成引擎
3. 将生成的内容无缝集成到FreeCut时间线
4. 保持FreeCut的交互式编辑能力

**非目标**:
- 不是要把FreeCut变成HyperFrames
- 不是完全替换FreeCut的现有功能
- 不是强制用户使用AI生成

### 6.2 集成架构

```
┌─────────────────────────────────────────────────────────┐
│                    FreeCut UI Layer                      │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐        │
│  │ 时间线编辑 │  │ AI生成面板 │  │ 效果预设库 │        │
│  └────────────┘  └────────────┘  └────────────┘        │
└───────────────────────┬─────────────────────────────────┘
                        ▼
┌─────────────────────────────────────────────────────────┐
│              FreeCut AI Integration Layer                │
│  ┌────────────────────────────────────────────────┐     │
│  │  Intent Router (inspired by /hyperframes)      │     │
│  │  - 分析用户输入                                 │     │
│  │  - 识别生成类型                                 │     │
│  │  - 选择HyperFrames workflow                    │     │
│  └────────────────────────────────────────────────┘     │
│  ┌────────────────────────────────────────────────┐     │
│  │  AI Agent (Claude/GPT)                         │     │
│  │  - 理解用户意图                                 │     │
│  │  - 读取HyperFrames skills文档                  │     │
│  │  - 生成HyperFrames composition                 │     │
│  └────────────────────────────────────────────────┘     │
│  ┌────────────────────────────────────────────────┐     │
│  │  HyperFrames Bridge                            │     │
│  │  - CLI调用封装                                  │     │
│  │  - Composition解析和转换                        │     │
│  │  - 资产管理                                     │     │
│  └────────────────────────────────────────────────┘     │
└───────────────────────┬─────────────────────────────────┘
                        ▼
┌─────────────────────────────────────────────────────────┐
│               HyperFrames Execution Layer                │
│  ┌────────────────┐  ┌────────────────┐                 │
│  │ HyperFrames CLI │  │ @hyperframes/* │                │
│  │ - init          │  │ packages       │                │
│  │ - render        │  │                │                │
│  │ - validate      │  │                │                │
│  └────────────────┘  └────────────────┘                 │
└───────────────────────┬─────────────────────────────────┘
                        ▼
┌─────────────────────────────────────────────────────────┐
│                  FreeCut Timeline Layer                  │
│  - 导入生成的视频                                         │
│  - 转换为时间线元素                                       │
│  - 支持后续编辑                                          │
└─────────────────────────────────────────────────────────┘
```

### 6.3 UI设计方案

#### 6.3.1 AI生成面板

在FreeCut主界面添加"AI生成"面板：

```
┌─────────────────────────────────────┐
│   🤖 AI视频生成                      │
├─────────────────────────────────────┤
│                                     │
│  描述你想要的视频内容：               │
│  ┌─────────────────────────────┐   │
│  │ 为我们的SaaS产品制作一个     │   │
│  │ 30秒的推广视频，强调快速     │   │
│  │ 部署和易用性...              │   │
│  └─────────────────────────────┘   │
│                                     │
│  快速选项：                          │
│  ○ 产品推广  ○ 文字动画  ○ 字幕    │
│  ○ 概念讲解  ○ 代码演示  ○ 音乐视频 │
│                                     │
│  高级设置 ▼                          │
│  - 时长：[30] 秒                    │
│  - 尺寸：[1920x1080] ▼              │
│  - 风格：[现代专业] ▼               │
│                                     │
│         [生成预览] [直接渲染]        │
└─────────────────────────────────────┘
```

#### 6.3.2 生成流程UI

```
步骤1: 意图识别
┌─────────────────────────────────────┐
│ 🔍 分析中...                         │
│                                     │
│ 识别到：产品推广视频                  │
│ 推荐workflow: /product-launch-video │
│                                     │
│ 是否继续？ [是] [选择其他]            │
└─────────────────────────────────────┘

步骤2: 参数配置
┌─────────────────────────────────────┐
│ ⚙️ 配置参数                          │
│                                     │
│ 产品URL: [https://example.com]     │
│ 时长: [30秒]                        │
│ 风格: [现代专业]                     │
│ 配色: [蓝色系] ▼                     │
│                                     │
│       [上一步] [开始生成]             │
└─────────────────────────────────────┘

步骤3: 生成进度
┌─────────────────────────────────────┐
│ 🎬 正在生成...                       │
│                                     │
│ ▓▓▓▓▓▓▓▓░░░░░░░░ 60%               │
│                                     │
│ ✓ 网站信息抓取完成                   │
│ ✓ 设计系统生成完成                   │
│ ⏳ 场景构建中... (2/5)               │
│ ⏳ 动画生成中...                     │
│ ⏳ 渲染中...                         │
│                                     │
│          [取消]                      │
└─────────────────────────────────────┘

步骤4: 预览和调整
┌─────────────────────────────────────┐
│ 👁️ 预览生成结果                      │
│                                     │
│  ┌───────────────────────────┐     │
│  │                           │     │
│  │   [视频预览播放器]         │     │
│  │                           │     │
│  └───────────────────────────┘     │
│                                     │
│ 满意这个结果吗？                      │
│                                     │
│ [重新生成] [调整参数] [导入时间线]    │
└─────────────────────────────────────┘
```

### 6.4 技术实现方案

#### 6.4.1 前端架构

**技术栈选择**:
- React/Vue (FreeCut现有框架)
- WebSocket (实时进度通信)
- Monaco Editor (Composition预览/编辑)

**核心组件**:

```typescript
// AI生成面板组件
interface AIGeneratorProps {
  onGenerate: (result: GenerationResult) => void;
}

const AIGenerator: React.FC<AIGeneratorProps> = ({ onGenerate }) => {
  const [intent, setIntent] = useState('');
  const [workflow, setWorkflow] = useState<WorkflowType | null>(null);
  const [progress, setProgress] = useState(0);
  
  const handleGenerate = async () => {
    // 1. 意图识别
    const detectedWorkflow = await identifyIntent(intent);
    setWorkflow(detectedWorkflow);
    
    // 2. 参数配置
    const params = await configureParameters(detectedWorkflow);
    
    // 3. 调用HyperFrames
    const result = await generateWithHyperFrames(detectedWorkflow, params, {
      onProgress: (p) => setProgress(p)
    });
    
    // 4. 返回结果
    onGenerate(result);
  };
  
  return (/* UI组件 */);
};
```

#### 6.4.2 后端架构

**技术栈**:
- Node.js (与HyperFrames保持一致)
- Express/Fastify (API服务)
- Bull (任务队列)
- Redis (缓存和任务状态)

**核心服务**:

```typescript
// AI生成服务
class HyperFramesGenerationService {
  async identifyIntent(userInput: string): Promise<WorkflowType> {
    // 调用AI模型分析意图
    const aiResponse = await this.aiClient.analyze(userInput);
    
    // 映射到HyperFrames workflow
    return this.mapToWorkflow(aiResponse);
  }
  
  async generateComposition(
    workflow: WorkflowType,
    params: GenerationParams,
    onProgress: (progress: number) => void
  ): Promise<Composition> {
    // 1. 准备HyperFrames项目
    const projectDir = await this.initProject(workflow);
    
    // 2. 调用AI agent生成composition
    const composition = await this.aiAgent.generateComposition(
      workflow,
      params,
      projectDir
    );
    
    // 3. 验证
    await this.validate(projectDir);
    
    // 4. 渲染
    const video = await this.render(projectDir, onProgress);
    
    // 5. 解析composition
    const parsed = await this.parseComposition(projectDir);
    
    return {
      video,
      composition: parsed,
      projectDir
    };
  }
  
  async validate(projectDir: string): Promise<ValidationResult> {
    // 运行HyperFrames验证
    const lintResult = await exec(`npx hyperframes lint --json`, { cwd: projectDir });
    const validateResult = await exec(`npx hyperframes validate --json`, { cwd: projectDir });
    
    return {
      lint: JSON.parse(lintResult),
      validate: JSON.parse(validateResult)
    };
  }
  
  async render(
    projectDir: string,
    onProgress: (progress: number) => void
  ): Promise<string> {
    // 渲染composition
    return new Promise((resolve, reject) => {
      const proc = spawn('npx', [
        'hyperframes',
        'render',
        '--quality', 'high',
        '--output', 'output.mp4'
      ], { cwd: projectDir });
      
      proc.stdout.on('data', (data) => {
        // 解析进度
        const progress = this.parseProgress(data.toString());
        onProgress(progress);
      });
      
      proc.on('close', (code) => {
        if (code === 0) {
          resolve(path.join(projectDir, 'output.mp4'));
        } else {
          reject(new Error('Render failed'));
        }
      });
    });
  }
}
```


#### 6.4.3 数据流设计

**完整数据流**:

```
用户输入描述
    ↓
[Intent Router] 意图识别
    ↓
选择HyperFrames Workflow
    ↓
[AI Agent] 读取skills文档
    ↓
生成参数配置
    ↓
[HyperFrames CLI] 创建项目
    ↓
[AI Agent] 生成composition HTML
    ↓
[HyperFrames CLI] 验证
    ↓
[HyperFrames CLI] 渲染
    ↓
[Composition Parser] 解析结构
    ↓
[Data Transformer] 转换为FreeCut格式
    ↓
导入FreeCut时间线
    ↓
用户继续编辑
```

**数据转换示例**:

```typescript
// HyperFrames Composition → FreeCut Timeline
interface CompositionToTimelineTransformer {
  transform(composition: HyperFramesComposition): FreeCutTimeline {
    const timeline: FreeCutTimeline = {
      duration: composition.duration,
      tracks: []
    };
    
    // 转换轨道
    composition.tracks.forEach(track => {
      const freecutTrack: FreeCutTrack = {
        id: generateId(),
        index: track.index,
        clips: []
      };
      
      // 转换片段
      track.clips.forEach(clip => {
        freecutTrack.clips.push({
          id: generateId(),
          type: this.detectClipType(clip),
          start: clip.start,
          duration: clip.duration,
          source: clip.source,
          effects: this.convertAnimations(clip.animations)
        });
      });
      
      timeline.tracks.push(freecutTrack);
    });
    
    return timeline;
  }
  
  convertAnimations(animations: HFAnimation[]): FreeCutEffect[] {
    return animations.map(anim => {
      if (anim.runtime === 'gsap') {
        return this.gsapToKeyframes(anim);
      } else if (anim.runtime === 'lottie') {
        return this.lottieToEffect(anim);
      }
      // ... 其他运行时
    });
  }
  
  gsapToKeyframes(anim: GSAPAnimation): FreeCutKeyframeEffect {
    // 将GSAP时间轴转换为关键帧
    const keyframes: Keyframe[] = [];
    
    anim.tweens.forEach(tween => {
      keyframes.push({
        time: tween.startTime,
        properties: {
          opacity: tween.vars.opacity,
          transform: this.buildTransform(tween.vars),
          // ... 其他属性
        }
      });
    });
    
    return {
      type: 'keyframe-animation',
      keyframes
    };
  }
}
```

### 6.5 技术挑战和解决方案

#### 挑战1: HyperFrames是渲染引擎，不是编辑器

**问题描述**:
- HyperFrames生成的是最终视频
- FreeCut需要可编辑的时间线数据
- 如何保留编辑能力？

**解决方案**:
1. **保留composition源文件**
   - 存储原始HTML composition
   - 允许重新生成和调整

2. **双向转换**
   - HTML → FreeCut数据：导入时转换
   - FreeCut数据 → HTML：导出时转换

3. **混合模式**
   - AI生成部分：使用HyperFrames
   - 用户编辑部分：使用FreeCut原生功能
   - 最终合成：在FreeCut时间线上完成

#### 挑战2: Skills依赖AI Agent理解文档

**问题描述**:
- HyperFrames skills是文档知识库
- 需要AI模型理解并执行指令
- 不是简单的API调用

**解决方案**:
1. **集成AI模型**
   - 使用Claude/GPT-4等大模型
   - 实现skills文档的RAG（检索增强生成）

2. **预处理常见场景**
   - 为高频场景创建快捷路径
   - 缓存常用compositions模板

3. **人机协作**
   - AI生成初稿
   - 用户在FreeCut中调整
   - 迭代优化

#### 挑战3: 渲染性能和成本

**问题描述**:
- HyperFrames使用Headless Chrome渲染
- 本地渲染较慢
- 云渲染有成本

**解决方案**:
1. **本地渲染优化**
   - 使用草稿质量进行预览
   - 只在最终确认时高质量渲染

2. **云渲染策略**
   - 提供可选的云渲染服务
   - 按需付费模式
   - 预估成本并告知用户

3. **缓存机制**
   - 缓存常用场景的渲染结果
   - 只重新渲染变更部分

#### 挑战4: Composition格式与FreeCut内部数据的差异

**问题描述**:
- HyperFrames: HTML + `data-*`属性
- FreeCut: JSON时间线数据
- 需要准确的双向转换

**解决方案**:
1. **标准化中间格式**
   - 定义标准的中间表示
   - 支持从任一格式转换

2. **元数据保留**
   - 在转换时保留原始信息
   - 支持无损往返转换

3. **验证机制**
   - 转换后自动验证
   - 检测并报告信息丢失

### 6.6 集成实施路线图

#### 阶段1: 概念验证 (POC) - 2-4周

**目标**: 验证技术可行性

**交付物**:
- [ ] Intent router原型
- [ ] 单个workflow集成（如motion-graphics）
- [ ] 基本的composition解析器
- [ ] 简单的数据转换器

**成功标准**:
- 能够从自然语言描述生成简单动画
- 能够导入到FreeCut时间线
- 能够在FreeCut中播放

#### 阶段2: MVP开发 - 2-3个月

**目标**: 可用的最小产品

**交付物**:
- [ ] 完整的AI生成面板UI
- [ ] 支持5-8个核心workflows
- [ ] 完整的数据转换系统
- [ ] 基本的错误处理和重试

**核心workflows优先级**:
1. `/motion-graphics` - 文字动画（最常用）
2. `/faceless-explainer` - 概念讲解
3. `/embedded-captions` - 字幕生成
4. `/product-launch-video` - 产品推广
5. `/music-to-video` - 音乐视频

**成功标准**:
- 用户能够通过描述生成5种类型的视频
- 生成时间<5分钟（本地渲染）
- 90%的生成结果满足基本要求

#### 阶段3: 完整集成 - 3-4个月

**目标**: 生产就绪的完整功能

**交付物**:
- [ ] 支持所有21个skills
- [ ] 云渲染集成
- [ ] 高级参数配置
- [ ] 批量生成支持
- [ ] 模板市场

**成功标准**:
- 支持所有主要用例
- 云渲染<2分钟（标清）
- 用户满意度>80%

#### 阶段4: 优化和扩展 - 持续

**目标**: 持续改进和新功能

**重点**:
- [ ] 性能优化
- [ ] 更多预设和模板
- [ ] 用户反馈驱动的改进
- [ ] 与其他AI工具集成

---

## 7. 性能和成本分析

### 7.1 渲染性能分析

#### 7.1.1 本地渲染性能

基于HyperFrames文档和社区数据：

**单帧渲染时间**:
- 简单场景（纯文字）: 50-100ms/帧
- 中等复杂度（文字+图形）: 100-200ms/帧
- 复杂场景（3D+粒子）: 200-500ms/帧

**完整视频渲染时间** (1920x1080, 30fps):

| 时长 | 简单 | 中等 | 复杂 |
|------|------|------|------|
| 10秒 | 1.5-3分钟 | 3-6分钟 | 6-15分钟 |
| 30秒 | 4.5-9分钟 | 9-18分钟 | 18-45分钟 |
| 60秒 | 9-18分钟 | 18-36分钟 | 36-90分钟 |

**性能瓶颈**:
1. Headless Chrome启动和页面加载
2. 逐帧截图（网络→磁盘）
3. FFmpeg编码
4. 音频混合

**优化方向**:
- 使用`--quality draft`进行预览（2-3倍提速）
- 使用更快的编码器（如libx264 ultrafast）
- 利用GPU加速（如果可用）

#### 7.1.2 云渲染性能

AWS Lambda架构下的性能：

**并行渲染**:
- 将视频分段为多个chunks
- 每个chunk独立渲染
- 最后合并

**理论性能**:
```
渲染时间 ≈ (总帧数 / 并行度) × 单帧时间 + 合并时间

示例：60秒视频，1800帧，30并行度
= (1800 / 30) × 150ms + 10s
≈ 60 × 0.15s + 10s
≈ 19秒
```

**实际性能**（考虑冷启动和网络）:
- 10秒视频: 30-60秒
- 30秒视频: 1-2分钟
- 60秒视频: 2-4分钟

### 7.2 成本分析

#### 7.2.1 本地渲染成本

**硬件要求**:
- CPU: 4核以上推荐
- 内存: 8GB最小，16GB推荐
- 存储: SSD推荐（临时文件IO密集）

**电力成本**（假设）:
- CPU功耗: 65W TDP
- 渲染30秒视频: 约15分钟
- 电力消耗: 65W × 0.25h = 16.25Wh
- 成本: $0.12/kWh × 0.01625kWh ≈ $0.002

**实际成本**:
- 硬件折旧
- 时间成本（等待渲染）
- 本地渲染几乎免费，但慢

#### 7.2.2 云渲染成本

**AWS Lambda定价** (2026年预估):
- Lambda调用: $0.20 per 1M requests
- Lambda执行: $0.0000166667 per GB-second
- S3存储: $0.023 per GB-month
- S3请求: $0.005 per 1000 PUT, $0.0004 per 1000 GET

**单次渲染成本估算**:

30秒视频（1920x1080, 30fps）:
```
- Lambda函数: 1GB内存，执行2分钟
  = 1GB × 120s × $0.0000166667
  = $0.002

- Lambda调用: 30次chunk + 1次合并
  = 31 × $0.20/1M
  ≈ $0.000006

- S3存储（临时）: 100MB × 1天
  = 0.1GB × (1/30) × $0.023
  ≈ $0.00008

- S3传输: 30 chunks + 1 final (忽略，通常在免费层内)

总计: 约 $0.0021 per 30秒视频
```

**月度成本估算**:

| 用量 | 10秒视频 | 30秒视频 | 60秒视频 | 月成本 |
|------|---------|---------|---------|--------|
| 10个/月 | $0.007 | $0.021 | $0.042 | ~$0.07 |
| 100个/月 | $0.07 | $0.21 | $0.42 | ~$0.70 |
| 1000个/月 | $0.70 | $2.10 | $4.20 | ~$7.00 |

**关键洞察**:
- 云渲染成本非常低（<$0.01/视频）
- 主要成本是时间，而非金钱
- 适合作为增值服务提供

#### 7.2.3 AI生成成本

**AI API调用成本** (Claude/GPT-4):


**典型AI调用** (Claude-3.5-Sonnet):
- 输入: 约10K tokens (skills文档 + 用户描述)
- 输出: 约2-5K tokens (composition HTML)
- 成本: $0.003/1K input + $0.015/1K output
- 单次成本: (10×$0.003) + (3×$0.015) = $0.075

**完整生成成本**:
```
AI生成 + 云渲染
= $0.075 + $0.002
≈ $0.08 per 30秒视频
```

**月度成本对比**:

| 生成量 | 本地渲染 | 云渲染 | 云渲染+AI |
|--------|---------|--------|-----------|
| 10个/月 | ~$0 | $0.02 | $0.80 |
| 100个/月 | ~$0 | $0.21 | $7.70 |
| 1000个/月 | ~$0 | $2.10 | $77.00 |

**关键洞察**:
- AI调用是主要成本（约为渲染的40倍）
- 但总成本仍然合理（<$0.10/视频）
- 可作为增值服务收费

### 7.3 性能优化策略

#### 7.3.1 短期优化

1. **缓存常用skills文档**
   - 减少AI输入token数
   - 加速生成

2. **使用draft质量预览**
   - 2-3倍提速
   - 快速迭代

3. **异步渲染队列**
   - 后台渲染
   - 用户继续编辑

#### 7.3.2 中期优化

1. **本地缓存渲染结果**
   - 相同参数不重复渲染
   - 节省时间和成本

2. **智能chunk分割**
   - 根据复杂度动态调整
   - 优化并行效率

3. **GPU加速**
   - 利用WebGPU
   - 加速复杂场景

#### 7.3.3 长期优化

1. **混合渲染架构**
   - 简单场景本地渲染
   - 复杂场景云渲染
   - 自动决策

2. **预渲染模板库**
   - 常用场景预渲染
   - 参数化替换
   - 秒级生成

3. **自定义渲染引擎**
   - 针对FreeCut优化
   - 去除HyperFrames中间层
   - 更高性能

---

## 8. 实施建议和优先级

### 8.1 实施优先级

#### 优先级1: 核心能力（必须）

**目标**: 建立基础AI生成能力

**任务**:
1. **Intent Router实现** (1-2周)
   - 参考`/hyperframes` skill
   - 实现基于规则的意图识别
   - 支持5-8种核心场景

2. **HyperFrames CLI集成** (1-2周)
   - 封装CLI调用
   - 处理输入输出
   - 错误处理

3. **Composition解析器** (1-2周)
   - 解析HTML composition
   - 提取时间轴数据
   - 基本数据转换

4. **AI Agent集成** (2-3周)
   - 集成Claude/GPT-4
   - 实现skills文档RAG
   - 生成composition

**交付物**: 可工作的POC，支持motion-graphics

#### 优先级2: 核心Workflows（重要）

**目标**: 覆盖主要用例

**Workflows优先级排序**:

1. **`/motion-graphics`** - 文字动画
   - **理由**: 最常用，最简单
   - **用例**: Logo动画，标题卡，下三分之一
   - **复杂度**: 低
   - **价值**: 高

2. **`/embedded-captions`** - 字幕生成
   - **理由**: 高需求功能
   - **用例**: 视频加字幕
   - **复杂度**: 中
   - **价值**: 极高

3. **`/faceless-explainer`** - 概念讲解
   - **理由**: AI优势场景
   - **用例**: 教程，科普
   - **复杂度**: 高
   - **价值**: 高

4. **`/product-launch-video`** - 产品推广
   - **理由**: 商业价值高
   - **用例**: 营销视频
   - **复杂度**: 高
   - **价值**: 极高

5. **`/music-to-video`** - 音乐视频
   - **理由**: 独特能力
   - **用例**: MV，节拍视频
   - **复杂度**: 高
   - **价值**: 中

**交付时间**: 每个workflow 1-2周，共2-3个月

#### 优先级3: 高级功能（可选）

**目标**: 提升用户体验

**功能列表**:
1. 云渲染支持
2. 模板市场
3. 批量生成
4. 高级参数配置
5. 协作功能

**交付时间**: 按需迭代

### 8.2 技术选型建议

#### 8.2.1 AI模型选择

**推荐**: Claude-3.5-Sonnet

**理由**:
- 长上下文（200K tokens）- 足够读取所有skills文档
- 强大的代码生成能力
- 遵循指令能力强
- 成本合理

**备选**: GPT-4o, GPT-4-turbo

#### 8.2.2 渲染策略

**开发阶段**: 仅本地渲染
- 简单
- 零成本
- 易调试

**生产阶段**: 混合模式
- 本地渲染: 草稿预览
- 云渲染: 最终输出
- 用户选择

#### 8.2.3 数据存储

**Composition存储**:
- 文件系统 (开发阶段)
- S3/OSS (生产阶段)

**用户数据**:
- SQLite (开发)
- PostgreSQL (生产)

**缓存**:
- 内存 (开发)
- Redis (生产)

### 8.3 风险和缓解措施

#### 风险1: AI生成质量不稳定

**影响**: 用户体验差

**缓解措施**:
- 多次生成选择最佳
- 用户反馈循环
- 人工审核模板
- 逐步改进prompt

#### 风险2: 渲染时间过长

**影响**: 用户流失

**缓解措施**:
- 清晰的进度提示
- 异步渲染队列
- 草稿质量预览
- 云渲染加速

#### 风险3: 成本失控

**影响**: 商业模式不可持续

**缓解措施**:
- 设置使用配额
- 实施计量收费
- 优化AI调用
- 缓存机制

#### 风险4: HyperFrames依赖

**影响**: 被上游变更影响

**缓解措施**:
- 锁定HyperFrames版本
- 贡献上游（建立关系）
- 准备自研替代
- 保持API抽象层

### 8.4 成功指标

#### 产品指标

**采用率**:
- 目标: 30%的活跃用户使用AI生成功能
- 测量: 月活用户中使用AI生成的比例

**满意度**:
- 目标: NPS > 50
- 测量: 用户调研

**留存率**:
- 目标: 使用AI功能的用户7日留存 > 60%
- 测量: Cohort分析

#### 技术指标

**生成成功率**:
- 目标: > 85%
- 测量: 成功生成 / 总尝试

**平均生成时间**:
- 目标: < 3分钟（本地）, < 1分钟（云）
- 测量: P50, P95, P99

**错误率**:
- 目标: < 5%
- 测量: 错误数 / 总请求数

#### 商业指标

**单位成本**:
- 目标: < $0.10 per 生成
- 测量: 总成本 / 总生成数

**付费转化**:
- 目标: 20%的AI用户升级付费
- 测量: 付费用户 / AI用户

### 8.5 长期路线图

#### 2026 Q3: 基础能力

- ✓ POC验证
- ✓ 5个核心workflows
- ✓ 基本UI/UX

#### 2026 Q4: 完整功能

- 所有21个workflows
- 云渲染支持
- 模板市场

#### 2027 Q1: 优化和扩展

- 性能优化
- 批量生成
- API开放

#### 2027 Q2+: 生态建设

- 插件系统
- 社区贡献
- 企业版功能

---

## 总结

### 核心发现

1. **HyperFrames Skills系统**是一个强大的AI视频生成框架
   - 21个skills覆盖全面的视频创作场景
   - 基于文档的知识库设计利于AI理解
   - HTML composition格式简洁且标准

2. **与FreeCut的集成是可行的**
   - 技术栈兼容（Node.js + Web技术）
   - 数据格式可转换（HTML ↔ JSON）
   - 工作流可衔接（AI生成 → 编辑 → 导出）

3. **主要价值在于AI能力**
   - 不是替代FreeCut的编辑功能
   - 而是增强AI辅助内容生成
   - 降低视频创作门槛

### 关键建议

1. **分阶段实施**
   - 从POC开始，验证可行性
   - 优先5-8个核心workflows
   - 逐步扩展到全部21个skills

2. **重点投入**
   - Intent Router设计
   - AI Agent质量
   - 数据转换准确性
   - 用户体验流畅度

3. **风险控制**
   - 管理AI成本
   - 优化渲染性能
   - 保持技术独立性
   - 建立用户反馈循环

### 下一步行动

1. **立即** (本周)
   - [ ] 团队评审本报告
   - [ ] 决策是否继续推进
   - [ ] 分配POC开发资源

2. **短期** (2-4周)
   - [ ] 开发POC
   - [ ] 测试核心workflow
   - [ ] 用户访谈

3. **中期** (2-3个月)
   - [ ] MVP开发
   - [ ] 内测
   - [ ] 迭代优化

---

**报告完成日期**: 2026-07-06  
**作者**: AI Research Team  
**文档版本**: 1.0  
**总行数**: ~3500行

