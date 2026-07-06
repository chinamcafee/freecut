# FreeCut + HyperFrames 整合方案 - AI功能整合与实施路径

> **文档版本**: v1.0  
> **最后更新**: 2026-07-06

---

## 5. AI功能整合方案

### 5.1 AI能力矩阵

**FreeCut现有AI能力**:

| 功能 | 实现方式 | 状态 | 位置 |
|------|---------|------|------|
| **语音转文字** | Whisper (本地) | ✅ 已有 | features/media-library |
| **AI字幕生成** | 视觉语言模型 | ✅ 已有 | infrastructure/analysis |
| **场景检测** | 直方图+光流+模型 | ✅ 已有 | infrastructure/analysis |
| **语义搜索** | Embeddings | ✅ 已有 | features/scene-browser |
| **TTS语音** | Kokoro.js | ✅ 已有 | features/media-library |
| **音乐生成** | MusicGen | ✅ 已有 | features/media-library |

**HyperFrames AI能力**:

| 功能 | 实现方式 | 状态 | Skills数量 |
|------|---------|------|-----------|
| **产品视频** | product-launch-video | ✅ 可用 | 1个 |
| **网站转视频** | website-to-video | ✅ 可用 | 1个 |
| **讲解视频** | faceless-explainer | ✅ 可用 | 1个 |
| **PR视频** | pr-to-video | ✅ 可用 | 1个 |
| **嵌入字幕** | embedded-captions | ✅ 可用 | 1个 |
| **说话人重剪** | talking-head-recut | ✅ 可用 | 1个 |
| **动态图形** | motion-graphics | ✅ 可用 | 1个 |
| **音乐视频** | music-to-video | ✅ 可用 | 1个 |
| **幻灯片** | slideshow | ✅ 可用 | 1个 |
| **通用视频** | general-video | ✅ 可用 | 1个 |
| **核心领域** | hyperframes-core等 | ✅ 可用 | 10个 |
| **总计** | - | - | **21个skills** |

### 5.2 AI功能整合架构

**统一AI服务层**:

```
┌─────────────────────────────────────────────────────┐
│              AI服务编排层 (AI Orchestration)         │
│  ┌─────────────────────────────────────────────┐   │
│  │         统一AI接口 (Unified AI Interface)    │   │
│  └─────────────────────────────────────────────┘   │
│                      │                              │
│        ┌─────────────┴─────────────┐               │
│        ↓                           ↓               │
│  ┌──────────────┐          ┌──────────────────┐   │
│  │FreeCut AI    │          │HyperFrames AI    │   │
│  │Services      │          │Skills            │   │
│  ├──────────────┤          ├──────────────────┤   │
│  │• Whisper     │          │• 21个 skills     │   │
│  │• AI字幕      │          │• MCP集成         │   │
│  │• 场景检测    │          │• Agent工作流     │   │
│  │• TTS         │          │• CLI调用         │   │
│  │• MusicGen    │          │                  │   │
│  └──────────────┘          └──────────────────┘   │
└─────────────────────────────────────────────────────┘
```

### 5.3 HyperFrames Skills集成

**Skills调用机制**:

```typescript
// src/features/ai-services/hyperframes-skills-bridge.ts

interface SkillExecutionRequest {
  skillName: string  // e.g., 'product-launch-video'
  params: Record<string, any>
  context: {
    projectId: string
    workspaceId: string
    targetTrackId?: string
  }
}

interface SkillExecutionResult {
  success: boolean
  compositionId?: string
  composition?: HyperFramesComposition
  error?: string
  logs: string[]
}

class HyperFramesSkillsBridge {
  async executeSkill(
    request: SkillExecutionRequest
  ): Promise<SkillExecutionResult> {
    // 1. 准备执行环境
    const workdir = await prepareSkillWorkdir(request.context)
    
    // 2. 调用HyperFrames CLI (通过Node.js子进程或API)
    const result = await this.invokeSkillCLI({
      skill: request.skillName,
      params: request.params,
      workdir
    })
    
    // 3. 解析输出的composition
    if (result.success) {
      const composition = await parseCompositionFromOutput(
        result.outputPath
      )
      
      // 4. 导入到FreeCut项目
      await this.importCompositionToProject(
        composition,
        request.context.projectId,
        request.context.targetTrackId
      )
      
      return {
        success: true,
        compositionId: composition.id,
        composition,
        logs: result.logs
      }
    }
    
    return {
      success: false,
      error: result.error,
      logs: result.logs
    }
  }
  
  private async invokeSkillCLI(config: any) {
    // 通过Node.js子进程调用HyperFrames CLI
    // 或者通过HTTP API调用skills服务器
    
    // 选项1: 本地CLI (需要Node.js环境)
    return spawn('npx', [
      'hyperframes',
      config.skill,
      ...formatParams(config.params),
      '--output', config.workdir
    ])
    
    // 选项2: Skills API服务器
    // return fetch('/api/skills/execute', {
    //   method: 'POST',
    //   body: JSON.stringify(config)
    // })
  }
}
```

**Skills UI集成**:

```typescript
// src/features/ai-services/components/SkillsPanel.tsx

function SkillsPanel() {
  const [selectedSkill, setSelectedSkill] = useState<string>()
  const [executing, setExecuting] = useState(false)
  
  const skillCategories = {
    '视频生成': [
      { id: 'product-launch-video', name: '产品发布视频', icon: '🚀' },
      { id: 'website-to-video', name: '网站转视频', icon: '🌐' },
      { id: 'faceless-explainer', name: '讲解视频', icon: '📚' },
    ],
    '视频增强': [
      { id: 'embedded-captions', name: '嵌入字幕', icon: '💬' },
      { id: 'talking-head-recut', name: '说话人重剪', icon: '🎬' },
    ],
    '动画制作': [
      { id: 'motion-graphics', name: '动态图形', icon: '✨' },
      { id: 'music-to-video', name: '音乐视频', icon: '🎵' },
    ]
  }
  
  return (
    <div className="skills-panel">
      <div className="skills-categories">
        {Object.entries(skillCategories).map(([category, skills]) => (
          <div key={category} className="skill-category">
            <h3>{category}</h3>
            {skills.map(skill => (
              <SkillCard
                key={skill.id}
                skill={skill}
                onClick={() => setSelectedSkill(skill.id)}
              />
            ))}
          </div>
        ))}
      </div>
      
      {selectedSkill && (
        <SkillExecutionDialog
          skillId={selectedSkill}
          onExecute={handleExecuteSkill}
          onClose={() => setSelectedSkill(undefined)}
        />
      )}
    </div>
  )
}
```

### 5.4 自然语言编辑集成

**AI助手对话界面**:

```typescript
// src/features/ai-services/components/AIAssistant.tsx

interface Message {
  role: 'user' | 'assistant'
  content: string
  actions?: Array<{
    type: 'execute_skill' | 'edit_timeline' | 'add_effect'
    params: any
  }>
}

function AIAssistant() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  
  const handleSend = async () => {
    // 1. 添加用户消息
    const userMessage: Message = { role: 'user', content: input }
    setMessages(prev => [...prev, userMessage])
    
    // 2. 调用AI理解意图
    const intent = await parseUserIntent(input, getCurrentProjectContext())
    
    // 3. 根据意图执行操作
    if (intent.type === 'create_video') {
      // 选择合适的HyperFrames skill
      const skillResult = await executeSkill({
        skillName: intent.suggestedSkill,
        params: intent.params,
        context: { projectId: currentProject.id }
      })
      
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `我已经为您创建了${intent.suggestedSkill}视频片段`,
        actions: [{ 
          type: 'execute_skill', 
          params: skillResult 
        }]
      }])
    } else if (intent.type === 'edit_timeline') {
      // 执行时间线编辑操作
      await executeTimelineEdit(intent.edits)
      
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `已完成您的编辑请求: ${intent.description}`,
        actions: [{ 
          type: 'edit_timeline', 
          params: intent.edits 
        }]
      }])
    }
  }
  
  return (
    <div className="ai-assistant">
      <div className="messages">
        {messages.map((msg, i) => (
          <MessageBubble key={i} message={msg} />
        ))}
      </div>
      <div className="input-area">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="描述您想要做什么..."
        />
        <button onClick={handleSend}>发送</button>
      </div>
    </div>
  )
}
```

---

## 6. 实施路径与里程碑

### 6.1 整体时间规划

**总时间**: 3-4个月MVP,6-8个月完整版

```
Phase 1: 基础整合 (4-5周)
  ↓
Phase 2: HyperFrames集成 (4-5周)
  ↓
Phase 3: AI功能增强 (3-4周)
  ↓
Phase 4: 测试和优化 (2-3周)
───────────────────────────
总计: 13-17周 (3-4个月)
```

### 6.2 Phase 1: 基础整合 (4-5周)

**目标**: 建立项目基础,FreeCut核心功能可用

**Week 1-2: 项目搭建**
- [ ] Fork FreeCut项目
- [ ] 创建hyperCut品牌(名称、Logo、文档)
- [ ] 设置开发环境和构建流程
- [ ] 配置Git仓库和CI/CD
- [ ] 初步代码审查和质量评估

**Week 3-4: 数据模型扩展**
- [ ] 设计统一项目数据模型
- [ ] 扩展Project Schema支持HyperFrames
- [ ] 实现数据迁移工具
- [ ] 添加HyperFrames composition存储
- [ ] 编写数据模型单元测试

**Week 5: 集成验证**
- [ ] FreeCut核心功能回归测试
- [ ] 性能基准测试
- [ ] 修复集成引入的Bug
- [ ] 文档更新

**交付物**:
- ✅ 可运行的hyperCut基础版本
- ✅ 完整保留FreeCut所有功能
- ✅ 扩展的数据模型

**预算**: $20k-25k

### 6.3 Phase 2: HyperFrames集成 (4-5周)

**目标**: 添加HTML动画编辑能力,实现双向转换

**Week 6-7: UI整合**
- [ ] 添加HTML动画轨道类型
- [ ] 实现HyperFrames编辑器嵌入
- [ ] 设计Skills面板UI
- [ ] 添加模式切换功能
- [ ] 预览窗口整合

**Week 8-9: 数据转换器**
- [ ] 实现FreeCut → HyperFrames转换
- [ ] 实现HyperFrames → FreeCut转换
- [ ] 处理边界情况和数据验证
- [ ] 转换器单元测试
- [ ] 性能优化

**Week 10: 渲染管道集成**
- [ ] 实现HyperFrames导出调用
- [ ] 渲染引擎选择逻辑
- [ ] 混合渲染管道(初版)
- [ ] 导出进度UI

**交付物**:
- ✅ 可编辑HTML动画片段
- ✅ 双向数据转换
- ✅ HyperFrames导出功能

**预算**: $30k-35k

### 6.4 Phase 3: AI功能增强 (3-4周)

**目标**: 整合HyperFrames Skills,实现AI辅助编辑

**Week 11-12: Skills集成**
- [ ] HyperFrames Skills Bridge实现
- [ ] Skills面板功能完善
- [ ] 10个核心skills测试集成
- [ ] Skills执行日志和错误处理
- [ ] Skills结果导入到项目

**Week 13: AI助手原型**
- [ ] AI对话界面实现
- [ ] 意图理解和分类
- [ ] 基础NLP处理
- [ ] 5个常见场景测试

**Week 14: 整合优化**
- [ ] FreeCut AI + HyperFrames Skills联动
- [ ] 统一AI服务接口
- [ ] AI功能文档和示例

**交付物**:
- ✅ 21个HyperFrames Skills可用
- ✅ AI助手对话界面
- ✅ 智能视频生成工作流

**预算**: $25k-30k

### 6.5 Phase 4: 测试和优化 (2-3周)

**目标**: 完善功能,修复Bug,性能优化

**Week 15: 测试**
- [ ] 功能完整性测试
- [ ] 跨浏览器兼容性测试
- [ ] 性能压力测试
- [ ] 用户体验测试
- [ ] Bug修复

**Week 16: 优化**
- [ ] 渲染性能优化
- [ ] UI响应速度优化
- [ ] 内存使用优化
- [ ] 代码质量提升

**Week 17: 发布准备**
- [ ] 完整文档编写
- [ ] 示例项目制作
- [ ] 营销材料准备
- [ ] 社区准备(Discord/GitHub)

**交付物**:
- ✅ hyperCut MVP 1.0
- ✅ 完整文档
- ✅ 示例项目

**预算**: $20k-25k

### 6.6 总预算估算

**人力成本**:
- 前端工程师(Senior): 2人 × 4个月 × $15k/月 = $120k
- 全栈工程师(Mid): 1人 × 3个月 × $10k/月 = $30k

**基础设施成本**:
- 云服务(测试/CI/CD): $2k
- 工具和许可证: $3k

**总计**: $155k ± $15k = **$140k-170k**

*(比现有architecture方案的$90k-110k高约$50k,但消除了技术债务风险)*

---

## 7. 风险评估与缓解

### 7.1 技术风险

**风险1: FreeCut和HyperFrames架构差异**
- **级别**: 🟡 中
- **影响**: 整合复杂度高于预期
- **缓解措施**:
  - 通过适配器层隔离差异
  - 充分的POC验证
  - 保持两者核心代码独立

**风险2: 渲染管道整合复杂**
- **级别**: 🟡 中
- **影响**: 混合渲染可能不稳定
- **缓解措施**:
  - 优先使用单一渲染引擎
  - 混合渲染作为可选高级功能
  - 充分测试各种场景

**风险3: HyperFrames依赖Node.js运行时**
- **级别**: 🟡 中
- **影响**: 浏览器中无法直接运行Skills
- **缓解措施**:
  - 提供Electron/Tauri桌面版本
  - 或通过远程API调用Skills服务
  - 预渲染常用templates

### 7.2 项目风险

**风险4: 开发时间超预期**
- **级别**: 🟡 中
- **影响**: 延期上市
- **缓解措施**:
  - 采用敏捷开发,快速迭代
  - MVP先行,功能渐进添加
  - 预留20%缓冲时间

**风险5: FreeCut未来变动**
- **级别**: 🟢 低
- **影响**: 需要跟进上游更新
- **缓解措施**:
  - 定期合并FreeCut更新
  - 保持最小化修改
  - 贡献代码回FreeCut社区

### 7.3 用户体验风险

**风险6: 功能复杂度过高**
- **级别**: 🟡 中
- **影响**: 用户学习曲线陡峭
- **缓解措施**:
  - 提供引导教程
  - 默认隐藏高级功能
  - 丰富的示例和模板

### 7.4 商业风险

**风险7: 市场竞争**
- **级别**: 🟡 中
- **影响**: 用户增长缓慢
- **缓解措施**:
  - 强调AI-native差异化
  - 开源社区建设
  - 与FreeCut/HyperFrames社区合作

---

**文档状态**: 第3部分 - AI功能整合与实施路径完成  
**下一部分**: 与现有architecture方案的详细对比分析
