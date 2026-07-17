# HyperFrames 整合开发规范

## 1. Git 分支命名规范

### 主分支
- `main` - 生产发布分支
- `dev` - **当前工作分支，所有HyperFrames整合工作基于此分支**

### HyperFrames 功能分支命名

所有HyperFrames相关分支必须以 `feature/hyperframes-` 为前缀：

```
feature/hyperframes-<功能模块>-<简短描述>
```

#### 标准功能模块前缀

| 模块前缀 | 用途 | 示例 |
|---------|------|------|
| `core` | 核心架构和基础设施 | `feature/hyperframes-core-integration` |
| `ui` | UI组件和界面集成 | `feature/hyperframes-ui-timeline-track` |
| `skills` | AI技能系统 | `feature/hyperframes-skills-text-animation` |
| `renderer` | 渲染器集成 | `feature/hyperframes-renderer-pipeline` |
| `data` | 数据模型扩展 | `feature/hyperframes-data-composition-schema` |
| `export` | 导出功能 | `feature/hyperframes-export-html-renderer` |
| `test` | 测试和质量保障 | `feature/hyperframes-test-e2e-suite` |
| `docs` | 文档和示例 | `feature/hyperframes-docs-api-reference` |

#### 分支生命周期

```
dev
 ├─ feature/hyperframes-core-integration      # 创建功能分支
 │   ├─ [开发工作]
 │   ├─ [代码审查]
 │   └─ [合并回 dev]                          # PR 合并后删除
 └─ feature/hyperframes-ui-timeline-track
     └─ ...
```

### 提交信息规范

使用中文描述，遵循约定式提交格式：

```
<类型>(<模块>): <简短描述>

[可选的详细说明]

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
```

#### 类型标签

- `feat(hyperframes)`: 新功能
- `fix(hyperframes)`: Bug修复
- `refactor(hyperframes)`: 代码重构
- `test(hyperframes)`: 测试相关
- `docs(hyperframes)`: 文档更新
- `chore(hyperframes)`: 构建或工具配置

#### 示例

```
feat(hyperframes-core): 实现GPU Effects Registry集成点

- 在effect-registry.ts中添加HyperFrames适配器注册接口
- 支持动态加载HyperFrames composition
- 添加单元测试覆盖核心功能

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
```

## 2. 代码组织策略

### 目录结构

```
src/
├── hyperframes/                    # HyperFrames整合根目录
│   ├── core/                       # 核心逻辑
│   │   ├── composition/           # Composition管理
│   │   ├── renderer/              # 渲染器适配
│   │   └── registry/              # 与FreeCut registry集成
│   ├── ui/                         # UI组件
│   │   ├── components/            # React组件
│   │   ├── panels/                # 面板组件
│   │   └── timeline/              # 时间线集成
│   ├── skills/                     # AI技能系统
│   │   ├── adapters/              # 技能适配器
│   │   ├── registry/              # 技能注册表
│   │   └── types/                 # 技能类型定义
│   ├── data/                       # 数据层
│   │   ├── models/                # 数据模型
│   │   ├── stores/                # Zustand stores
│   │   └── schemas/               # JSON Schema定义
│   ├── utils/                      # 工具函数
│   └── types/                      # TypeScript类型定义
│       ├── composition.ts         # Composition类型
│       ├── skills.ts              # Skills类型
│       └── renderer.ts            # Renderer类型
```

### 文件命名约定

- **组件文件**: PascalCase，如 `HyperFramesPanel.tsx`
- **工具函数**: kebab-case，如 `composition-parser.ts`
- **类型定义**: kebab-case，如 `composition-types.ts`
- **Store文件**: kebab-case + `store` 后缀，如 `hyperframes-store.ts`
- **测试文件**: 与源文件同名 + `.test.ts` 后缀

### 模块导入规则

使用绝对路径导入，基于 `tsconfig.json` 的 `paths` 配置：

```typescript
// ✅ 正确 - 绝对路径
import { HyperFramesPanel } from '@/hyperframes/ui/panels/HyperFramesPanel'
import { useHyperFramesStore } from '@/hyperframes/data/stores/hyperframes-store'

// ❌ 错误 - 相对路径
import { HyperFramesPanel } from '../../../ui/panels/HyperFramesPanel'
```

### 架构边界保护

通过 oxlint 规则强制执行特性边界，**禁止跨边界依赖**：

```typescript
// ✅ 允许: hyperframes → infrastructure (基础设施)
import { GPUEffectRegistry } from '@/infrastructure/gpu-effects/effect-registry'

// ✅ 允许: hyperframes → features (通过适配器)
import type { TimelineClip } from '@/features/timeline/types'

// ❌ 禁止: infrastructure → hyperframes
// infrastructure/ 不能依赖 hyperframes/

// ❌ 禁止: hyperframes 内部直接调用 features 实现
// 必须通过 deps/* 适配器模式
```

## 3. 组件开发模板

### React 组件模板

```typescript
/**
 * HyperFrames [组件名称]
 * 
 * 功能描述：[一句话描述组件用途]
 * 
 * @example
 * ```tsx
 * <HyperFramesPanel onClose={handleClose} />
 * ```
 */

import { memo } from 'react'
import type { FC } from 'react'

interface HyperFramesPanelProps {
  /** 面板关闭回调 */
  onClose?: () => void
  /** 自定义类名 */
  className?: string
}

export const HyperFramesPanel: FC<HyperFramesPanelProps> = memo(({
  onClose,
  className
}) => {
  // 组件逻辑
  
  return (
    <div className={className}>
      {/* 组件UI */}
    </div>
  )
})

HyperFramesPanel.displayName = 'HyperFramesPanel'
```

### 自定义 Hook 模板

```typescript
/**
 * 使用 HyperFrames [功能名称]
 * 
 * 功能描述：[一句话描述Hook用途]
 * 
 * @example
 * ```tsx
 * const { composition, updateComposition } = useHyperFramesComposition(clipId)
 * ```
 */

import { useCallback } from 'react'
import { useHyperFramesStore } from '@/hyperframes/data/stores/hyperframes-store'

interface UseHyperFramesCompositionOptions {
  /** Clip ID */
  clipId: string
  /** 自动保存 */
  autoSave?: boolean
}

export function useHyperFramesComposition(options: UseHyperFramesCompositionOptions) {
  const { clipId, autoSave = true } = options
  
  // Hook逻辑
  const composition = useHyperFramesStore(state => state.compositions[clipId])
  
  const updateComposition = useCallback((updates: Partial<Composition>) => {
    // 更新逻辑
  }, [clipId, autoSave])
  
  return {
    composition,
    updateComposition
  }
}
```

### Store 模板 (Zustand)

```typescript
/**
 * HyperFrames Store
 * 
 * 管理HyperFrames相关状态：compositions、skills、渲染状态等
 */

import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import type { Composition, Skill } from '@/hyperframes/types'

interface HyperFramesState {
  // 状态
  compositions: Record<string, Composition>
  activeCompositionId: string | null
  
  // 操作
  addComposition: (composition: Composition) => void
  updateComposition: (id: string, updates: Partial<Composition>) => void
  removeComposition: (id: string) => void
}

export const useHyperFramesStore = create<HyperFramesState>()(
  devtools(
    persist(
      (set, get) => ({
        // 初始状态
        compositions: {},
        activeCompositionId: null,
        
        // 操作实现
        addComposition: (composition) => {
          set(state => ({
            compositions: {
              ...state.compositions,
              [composition.id]: composition
            }
          }))
        },
        
        updateComposition: (id, updates) => {
          set(state => ({
            compositions: {
              ...state.compositions,
              [id]: { ...state.compositions[id], ...updates }
            }
          }))
        },
        
        removeComposition: (id) => {
          set(state => {
            const { [id]: removed, ...rest } = state.compositions
            return { compositions: rest }
          })
        }
      }),
      {
        name: 'hyperframes-storage',
        partialize: (state) => ({
          compositions: state.compositions
        })
      }
    ),
    { name: 'HyperFramesStore' }
  )
)
```

## 4. 代码审查 Checklist

### 通用检查项

#### 架构与设计
- [ ] 代码放置在正确的 `src/hyperframes/` 子目录中
- [ ] 遵循架构边界，没有违反 oxlint 规则
- [ ] 通过适配器模式与 FreeCut 特性交互
- [ ] 没有循环依赖
- [ ] 单一职责原则，组件/函数职责明确

#### 代码质量
- [ ] TypeScript 类型完整，没有 `any` (除非必要并注释说明)
- [ ] 函数和组件有清晰的中文注释
- [ ] 复杂逻辑有解释性注释
- [ ] 变量和函数命名语义清晰
- [ ] 没有魔法数字，使用常量定义

#### 性能
- [ ] React 组件适当使用 `memo`
- [ ] 回调函数使用 `useCallback` 优化
- [ ] 计算密集型逻辑使用 `useMemo`
- [ ] 避免不必要的重新渲染
- [ ] 大型数据结构使用懒加载

#### 测试
- [ ] 核心逻辑有单元测试覆盖
- [ ] 测试用例覆盖边界情况
- [ ] UI 组件有快照测试或交互测试
- [ ] 测试可读性强，描述清晰

#### 文档
- [ ] 公共 API 有 JSDoc 注释
- [ ] 复杂组件有使用示例
- [ ] 重要决策有 inline 注释说明
- [ ] 如有breaking change，更新相关文档

### HyperFrames 特定检查项

#### Composition 数据流
- [ ] Composition 变更通过 store 统一管理
- [ ] 数据不可变更新（immutable updates）
- [ ] 与 FreeCut Project Schema 兼容
- [ ] Composition JSON 符合 HyperFrames 规范

#### GPU Effects 集成
- [ ] 通过 GPUEffectRegistry 注册效果
- [ ] 正确实现 `apply()` 方法
- [ ] 处理 WebGPU 上下文丢失情况
- [ ] 资源清理（dispose）正确实现

#### AI Skills 集成
- [ ] Skills API 调用有错误处理
- [ ] 显示加载状态和进度
- [ ] 处理 API 限流和超时
- [ ] 用户输入验证和清理

#### 渲染管道
- [ ] 正确选择渲染模式（WebCodecs/HyperFrames/Hybrid）
- [ ] 帧率和分辨率处理正确
- [ ] 内存管理，避免泄漏
- [ ] 支持渲染取消操作

### 代码审查流程

```
1. 开发者自检 → 运行 npm run lint && npm test
2. 创建 PR → 填写 PR 模板，附上测试截图/视频
3. 自动 CI 检查 → GitHub Actions 运行质量检查
4. 代码审查 → 至少1名审查者批准
5. 合并 → Squash merge 到 dev 分支
6. 删除功能分支
```

## 5. 命名规范

### TypeScript 类型命名

```typescript
// Interface - PascalCase + 描述性名词
interface HyperFramesComposition { }
interface SkillExecutionContext { }

// Type Alias - PascalCase
type CompositionId = string
type SkillResult = Success | Failure

// Enum - PascalCase，成员 UPPER_SNAKE_CASE
enum RenderMode {
  WEBCODECS = 'webcodecs',
  HYPERFRAMES = 'hyperframes',
  HYBRID = 'hybrid'
}

// Generic 类型参数 - 单字母大写或 T 开头的 PascalCase
function transform<T>(input: T): T { }
function map<TInput, TOutput>(fn: (item: TInput) => TOutput) { }
```

### 变量和函数命名

```typescript
// 常量 - UPPER_SNAKE_CASE
const MAX_COMPOSITION_SIZE = 1024 * 1024
const DEFAULT_FRAME_RATE = 30

// 变量 - camelCase
const compositionId = 'comp-123'
let isRendering = false

// 函数 - camelCase，动词开头
function parseComposition(json: string): Composition { }
function validateSkillInput(input: unknown): boolean { }

// React 组件 - PascalCase
const HyperFramesPanel = () => { }
const SkillButton = () => { }

// Hooks - camelCase，use 开头
function useComposition(id: string) { }
function useSkillExecution() { }

// 事件处理器 - handle 前缀
const handleSkillExecute = () => { }
const handleCompositionUpdate = () => { }

// 布尔变量 - is/has/should 前缀
const isLoading = false
const hasError = true
const shouldRender = true
```

### 文件和目录命名

```
// 组件文件 - PascalCase.tsx
HyperFramesPanel.tsx
SkillSelector.tsx

// 非组件 TypeScript 文件 - kebab-case.ts
composition-parser.ts
skill-executor.ts
hyperframes-store.ts

// 测试文件 - 源文件名 + .test.ts
HyperFramesPanel.test.tsx
composition-parser.test.ts

// 类型定义文件 - kebab-case.ts
composition-types.ts
skill-types.ts

// 目录 - kebab-case
src/hyperframes/ui/components/
src/hyperframes/data/stores/
```

### CSS 类名命名 (BEM 风格)

```css
/* Block */
.hyperframes-panel { }

/* Element */
.hyperframes-panel__header { }
.hyperframes-panel__content { }

/* Modifier */
.hyperframes-panel--collapsed { }
.hyperframes-panel__header--sticky { }
```

### Store 操作命名

```typescript
// Zustand actions - 动词 + 名词
addComposition()
updateComposition()
removeComposition()
setActiveComposition()
clearCompositions()

// Getters - get 前缀
getCompositionById()
getActiveSkills()
```

## 6. 错误处理规范

### 错误类型定义

```typescript
// 自定义错误类
export class HyperFramesError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown
  ) {
    super(message)
    this.name = 'HyperFramesError'
  }
}

export class CompositionParseError extends HyperFramesError {
  constructor(message: string, details?: unknown) {
    super(message, 'COMPOSITION_PARSE_ERROR', details)
    this.name = 'CompositionParseError'
  }
}

export class SkillExecutionError extends HyperFramesError {
  constructor(message: string, details?: unknown) {
    super(message, 'SKILL_EXECUTION_ERROR', details)
    this.name = 'SkillExecutionError'
  }
}
```

### 错误处理最佳实践

```typescript
// ✅ 正确 - 具体的错误处理
try {
  const composition = parseComposition(json)
} catch (error) {
  if (error instanceof CompositionParseError) {
    // 处理解析错误
    showNotification('Composition格式错误', 'error')
  } else {
    // 未知错误上报
    reportError(error)
    showNotification('未知错误', 'error')
  }
}

// ❌ 错误 - 吞掉错误
try {
  const composition = parseComposition(json)
} catch (error) {
  // 什么都不做
}

// ❌ 错误 - 过于宽泛
try {
  const composition = parseComposition(json)
} catch (error) {
  console.log(error) // 不够，需要用户反馈
}
```

## 7. 性能优化指南

### React 性能优化

```typescript
// 1. 组件 memo 化
export const HyperFramesPanel = memo(({ id, onClose }) => {
  // 组件逻辑
})

// 2. 回调优化
const handleUpdate = useCallback((updates: Partial<Composition>) => {
  updateComposition(id, updates)
}, [id, updateComposition])

// 3. 选择器优化 - 避免每次创建新对象
const composition = useHyperFramesStore(
  useCallback(state => state.compositions[id], [id])
)

// 4. 计算优化
const processedData = useMemo(() => {
  return heavyComputation(rawData)
}, [rawData])
```

### WebGPU 资源管理

```typescript
// ✅ 正确 - 显式清理资源
class HyperFramesEffect {
  private buffer?: GPUBuffer
  
  dispose() {
    this.buffer?.destroy()
    this.buffer = undefined
  }
}

// 在组件中使用
useEffect(() => {
  const effect = new HyperFramesEffect()
  return () => effect.dispose() // 清理
}, [])
```

## 8. 测试规范

### 测试文件结构

```typescript
/**
 * composition-parser.test.ts
 * 测试 Composition 解析器
 */

import { describe, it, expect } from 'vitest'
import { parseComposition } from './composition-parser'

describe('parseComposition', () => {
  it('应该正确解析有效的composition JSON', () => {
    const json = '{"id":"comp-1","layers":[]}'
    const result = parseComposition(json)
    
    expect(result.id).toBe('comp-1')
    expect(result.layers).toEqual([])
  })
  
  it('应该在JSON无效时抛出CompositionParseError', () => {
    const invalidJson = '{invalid}'
    
    expect(() => parseComposition(invalidJson))
      .toThrow(CompositionParseError)
  })
  
  it('应该处理包含特殊字符的composition', () => {
    // 边界情况测试
  })
})
```

### 测试覆盖率要求

- **核心逻辑**: ≥ 90% 覆盖率
- **UI 组件**: ≥ 70% 覆盖率
- **工具函数**: ≥ 85% 覆盖率
- **整体目标**: ≥ 80% 覆盖率

## 9. 文档要求

### JSDoc 注释模板

```typescript
/**
 * 解析 HyperFrames composition JSON
 * 
 * @param json - Composition JSON 字符串
 * @param options - 解析选项
 * @param options.strict - 是否启用严格模式验证
 * @returns 解析后的 Composition 对象
 * @throws {CompositionParseError} JSON 格式无效时抛出
 * 
 * @example
 * ```typescript
 * const composition = parseComposition('{"id":"comp-1"}', { strict: true })
 * console.log(composition.id) // 'comp-1'
 * ```
 */
export function parseComposition(
  json: string,
  options?: { strict?: boolean }
): Composition {
  // 实现
}
```

## 10. 安全规范

### 输入验证

```typescript
// ✅ 正确 - 验证用户输入
function executeSkill(skillId: string, params: unknown) {
  // 1. 验证 skillId
  if (!isValidSkillId(skillId)) {
    throw new Error('无效的 Skill ID')
  }
  
  // 2. 验证和清理 params
  const validatedParams = validateSkillParams(params)
  
  // 3. 执行
  return skillRegistry.execute(skillId, validatedParams)
}

// ❌ 错误 - 直接使用用户输入
function executeSkill(skillId: string, params: any) {
  return eval(`skillRegistry.${skillId}(${JSON.stringify(params)})`)
}
```

### XSS 防护

```typescript
// ✅ 正确 - 使用 React 的自动转义
<div>{userInput}</div>

// ⚠️ 注意 - dangerouslySetInnerHTML 必须清理
import DOMPurify from 'dompurify'

<div dangerouslySetInnerHTML={{
  __html: DOMPurify.sanitize(htmlContent)
}} />
```

---

## 附录：快速参考

### 常用命令

```bash
# 开发
npm run dev

# 构建
npm run build

# 测试
npm test                    # 运行所有测试
npm test -- composition     # 运行特定测试

# 代码质量
npm run lint                # ESLint + oxlint
npm run format              # Prettier 格式化
npm run type-check          # TypeScript 类型检查

# Git
git checkout -b feature/hyperframes-core-integration
git commit -m "feat(hyperframes-core): 实现核心集成"
git push -u origin feature/hyperframes-core-integration
```

### 重要链接

- **HyperFrames 源码**: `/Users/changzechuan/VideoAIEditProjects/hyperframes`
- **技术文档**: `docs/hyperframes-integration/`
- **Roadmap**: `/Users/changzechuan/VideoAIEditProjects/hyperCut/docs/architecture-v2/roadmap/`
- **FreeCut 主仓库**: `/Users/changzechuan/VideoAIEditProjects/freecut`

---

**文档版本**: v1.0  
**最后更新**: 2026-07-06  
**维护者**: HyperFrames 整合团队
