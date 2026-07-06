# HyperFrames 整合文档总览

## 整合目标

将 HyperFrames (HTML-native视频渲染框架) 整合到 FreeCut (浏览器NLE编辑器) 中,实现:

1. **双模式架构**: NLE编辑 (FreeCut) + HTML动画 (HyperFrames)
2. **21个AI技能集成**: 文本动画、场景生成、智能剪辑等
3. **智能渲染管道**: 自动选择 WebCodecs、HyperFrames Producer 或混合渲染
4. **零破坏性集成**: 通过 GPU Effects Registry 扩展点实现

## 项目信息

- **工作目录**: `/Users/changzechuan/VideoAIEditProjects/freecut`
- **开发分支**: `dev`
- **整合周期**: 17周 (4个阶段)
- **预算**: $180k

## 文档结构

### 架构设计文档

1. **[architecture-overview.md](./architecture-overview.md)** - 架构文档导航和执行摘要
2. **[01-方案概述与可行性评估.md](./01-方案概述与可行性评估.md)** - FreeCut vs opencut-classic 评估 (91/100 vs 77/100)
3. **[02-detailed-technical-design.md](./02-detailed-technical-design.md)** - 详细技术设计 (UI集成、数据模型、渲染管道)
4. **[03-ai-integration-and-roadmap.md](./03-ai-integration-and-roadmap.md)** - AI技能集成和4阶段路线图
5. **[04-comparison-and-final-recommendation.md](./04-comparison-and-final-recommendation.md)** - 技术方案对比和5年TCO分析

### 实施报告

1. **[day01-analysis-report.md](./day01-analysis-report.md)** - Week 01 Day 1: 环境验证和项目结构分析
2. **[day02-code-analysis-report.md](./day02-code-analysis-report.md)** - Week 01 Day 2: 核心代码流程分析 (3737行)
3. **[day03-dependencies-toolchain-report.md](./day03-dependencies-toolchain-report.md)** - Week 01 Day 3: 依赖和工具链分析

## 关键技术决策

### 最佳集成点

**GPU Effects Registry** (`src/infrastructure/gpu-effects/effect-registry.ts`)
- 零破坏性变更
- 清晰的扩展接口
- 与现有架构完美对齐

### 技术栈对齐

| 技术领域 | FreeCut | HyperFrames | 兼容性 |
|---------|---------|-------------|--------|
| 前端框架 | React 19 | HTML/CSS/JS | ✅ 完全兼容 |
| 渲染引擎 | WebGPU + WebCodecs | Puppeteer + FFmpeg | ✅ 互补 |
| 状态管理 | Zustand | - | ✅ 可扩展 |
| AI/ML | @huggingface/transformers | OpenAI API | ✅ 已有基础 |
| 存储 | OPFS + IndexedDB | 文件系统 | ✅ 适配简单 |

### 架构边界保护

通过 oxlint `no-restricted-imports` 规则强制执行特性边界:

```typescript
// 示例: infrastructure/ 不能依赖 features/
{
  "patterns": [{
    "target": "src/infrastructure/**/*",
    "from": ["src/features/**"],
    "message": "Infrastructure cannot depend on features"
  }]
}
```

## 现有 FreeCut 文档位置

### 项目根目录文档
- `/Users/changzechuan/VideoAIEditProjects/freecut/README.md` - 项目主文档
- `/Users/changzechuan/VideoAIEditProjects/freecut/CONTRIBUTING.md` - 贡献指南 (如存在)
- `/Users/changzechuan/VideoAIEditProjects/freecut/CHANGELOG.md` - 变更日志 (如存在)

### docs/ 目录文档
- `docs/render-frame-decomposition-plan.md` - 渲染帧分解计划
- `docs/timeline-cursor-icons.html` - 时间线光标图标示例

### 代码内文档
- 各特性模块 README: `src/features/*/README.md`
- API 文档: 通过 TypeScript 类型和 JSDoc 注释
- 架构决策记录 (ADR): 如存在于 `docs/adr/` 或 `docs/decisions/`

## 开发规范

### 分支命名
- `feature/hyperframes-core` - 核心集成
- `feature/hyperframes-ui` - UI组件
- `feature/hyperframes-skills` - AI技能系统
- `feature/hyperframes-renderer` - 渲染器集成
- `feature/hyperframes-data-model` - 数据模型扩展
- `feature/hyperframes-export` - 导出功能

### 代码组织
```
src/
├── hyperframes/           # HyperFrames 整合代码
│   ├── core/             # 核心逻辑
│   ├── ui/               # UI 组件
│   ├── skills/           # AI 技能适配器
│   ├── renderer/         # 渲染器集成
│   └── types/            # TypeScript 类型定义
```

## 参考资源

### HyperFrames 项目
- **源码路径**: `/Users/changzechuan/VideoAIEditProjects/hyperframes`
- **CLI 工具**: `npx hyperframes`
- **文档**: HyperFrames README 和示例项目

### 技术路线图
- **详细周计划**: `/Users/changzechuan/VideoAIEditProjects/hyperCut/docs/architecture-v2/roadmap/`
- **当前周**: Week 01 (环境搭建与分析)
- **下一周**: Week 02 (数据模型设计)

## 团队协作

### 角色分工
- **全栈工程师** (1名): 核心架构和后端集成
- **前端工程师** (2名): UI组件和React集成
- **AI工程师** (1名): AI技能系统集成

### 沟通渠道
- GitHub Projects 看板
- 每日站会
- 代码审查 (PR review)

## 更新日志

- **2026-07-06**: 创建整合文档结构,复制architecture-v2技术文档
- **2026-07-06**: 完成 Week 01 Day 1-3 分析报告
