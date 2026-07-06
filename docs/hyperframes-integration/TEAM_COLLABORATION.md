# HyperFrames 整合团队协作配置

## 1. GitHub Projects 看板配置

### 看板结构

**看板名称**: `HyperFrames Integration`

**视图配置**:

#### Board 视图（看板）
```
┌─────────────┬─────────────┬─────────────┬─────────────┬─────────────┐
│   Backlog   │   To Do     │ In Progress │  In Review  │    Done     │
├─────────────┼─────────────┼─────────────┼─────────────┼─────────────┤
│ 待规划任务    │ 本周计划     │ 进行中       │ 代码审查中    │ 已完成       │
└─────────────┴─────────────┴─────────────┴─────────────┴─────────────┘
```

#### Timeline 视图（时间线）
- 按周显示里程碑和任务
- 可视化 17 周整合路线图
- 标记关键依赖关系

#### Table 视图（表格）
| 字段 | 类型 | 用途 |
|------|------|------|
| Title | Text | 任务标题 |
| Status | Single Select | Backlog/To Do/In Progress/In Review/Done |
| Assignee | People | 负责人 |
| Priority | Single Select | P0/P1/P2/P3 |
| Week | Single Select | Week 01-17 |
| Module | Single Select | Core/UI/Skills/Renderer/Data/Export |
| Estimate | Number | 预估时间（小时）|
| Labels | Multi Select | 任务标签 |

### 自动化规则

```yaml
自动化1: PR关联
触发: 当 PR 链接到 issue 时
动作: 将 issue 移动到 "In Review" 列

自动化2: PR合并
触发: 当 PR 被合并时
动作: 
  - 将关联的 issue 移动到 "Done" 列
  - 添加 "completed" 标签
  - 记录完成时间

自动化3: Issue分配
触发: 当 issue 被分配给某人时
动作: 
  - 移动到 "To Do" 列
  - 发送通知给负责人

自动化4: 过期提醒
触发: 每天早上 9:00
动作: 
  - 检查 "In Progress" 中超过 3 天的 issue
  - 添加 "needs-attention" 标签
  - 通知负责人
```

### 里程碑配置

```
Milestone 1: 基础架构 (Week 01-04)
├─ Week 01: 环境搭建与分析
├─ Week 02: 数据模型设计
├─ Week 03: 核心架构实现
└─ Week 04: GPU集成与测试

Milestone 2: UI与交互 (Week 05-08)
├─ Week 05: UI组件开发
├─ Week 06: 时间线集成
├─ Week 07: 预览系统
└─ Week 08: 用户体验优化

Milestone 3: AI技能系统 (Week 09-12)
├─ Week 09: Skills基础架构
├─ Week 10: 核心Skills实现
├─ Week 11: Skills UI集成
└─ Week 12: AI能力增强

Milestone 4: 渲染与发布 (Week 13-17)
├─ Week 13: 渲染管道实现
├─ Week 14: 导出功能
├─ Week 15: 性能优化
├─ Week 16: 测试与修复
└─ Week 17: 文档与发布
```

## 2. GitHub Issue 标签配置

### 标签体系

#### 按模块分类

| 标签 | 颜色 | 描述 |
|------|------|------|
| `hyperframes:core` | `#FF6B6B` | 核心架构和基础设施 |
| `hyperframes:ui` | `#4ECDC4` | UI组件和界面 |
| `hyperframes:skills` | `#45B7D1` | AI技能系统 |
| `hyperframes:renderer` | `#FFA07A` | 渲染器和管道 |
| `hyperframes:data` | `#98D8C8` | 数据模型和存储 |
| `hyperframes:export` | `#FFD93D` | 导出和发布功能 |
| `hyperframes:docs` | `#A8E6CF` | 文档和示例 |
| `hyperframes:test` | `#FFB6C1` | 测试和质量保障 |

#### 按类型分类

| 标签 | 颜色 | 描述 |
|------|------|------|
| `type:feature` | `#0E8A16` | 新功能 |
| `type:bug` | `#D73A4A` | Bug修复 |
| `type:refactor` | `#FFA500` | 代码重构 |
| `type:performance` | `#1D76DB` | 性能优化 |
| `type:docs` | `#0075CA` | 文档更新 |
| `type:test` | `#BFD4F2` | 测试相关 |

#### 按优先级分类

| 标签 | 颜色 | 描述 |
|------|------|------|
| `priority:P0` | `#B60205` | 紧急 - 阻塞性问题 |
| `priority:P1` | `#D93F0B` | 高优先级 - 本周必须完成 |
| `priority:P2` | `#FBCA04` | 中优先级 - 本迭代完成 |
| `priority:P3` | `#0E8A16` | 低优先级 - 可以延后 |

#### 按状态分类

| 标签 | 颜色 | 描述 |
|------|------|------|
| `status:blocked` | `#B60205` | 被阻塞 |
| `status:needs-design` | `#8B4789` | 需要设计方案 |
| `status:needs-review` | `#FFA500` | 需要代码审查 |
| `status:needs-testing` | `#FFD700` | 需要测试 |
| `status:in-progress` | `#1D76DB` | 进行中 |

#### 特殊标签

| 标签 | 颜色 | 描述 |
|------|------|------|
| `good-first-issue` | `#7057FF` | 适合新人的任务 |
| `help-wanted` | `#008672` | 需要帮助 |
| `breaking-change` | `#B60205` | 破坏性变更 |
| `dependencies` | `#0366D6` | 依赖更新 |
| `security` | `#EE0701` | 安全相关 |

### 标签使用规范

```
一个 issue 应该包含：
1. 至少 1 个模块标签（hyperframes:*）
2. 1 个类型标签（type:*）
3. 1 个优先级标签（priority:*）
4. 0-N 个状态或特殊标签

示例：
issue: "实现 HyperFrames Composition 数据模型"
标签: 
  - hyperframes:data
  - type:feature
  - priority:P1
  - status:in-progress
```

## 3. 团队沟通渠道配置

### Discord 服务器配置方案

#### 服务器结构

```
HyperFrames Integration Discord
├─ 📢 公告区
│   ├─ #announcements          # 重要公告
│   ├─ #roadmap-updates        # 路线图更新
│   └─ #releases               # 发布通知
├─ 💬 开发讨论
│   ├─ #general                # 通用讨论
│   ├─ #architecture           # 架构设计讨论
│   ├─ #code-review            # 代码审查讨论
│   └─ #troubleshooting        # 问题排查
├─ 🔧 技术频道
│   ├─ #core-dev               # 核心开发
│   ├─ #ui-frontend            # UI和前端
│   ├─ #ai-skills              # AI技能系统
│   ├─ #renderer-gpu           # 渲染器和GPU
│   └─ #testing-qa             # 测试和QA
├─ 🤖 机器人通知
│   ├─ #github-notifications   # GitHub事件通知
│   ├─ #ci-cd-status           # CI/CD状态
│   └─ #error-alerts           # 错误告警
└─ 🎯 团队协作
    ├─ #daily-standup          # 每日站会
    ├─ #sprint-planning        # 迭代规划
    ├─ #retrospective          # 回顾会议
    └─ #random                 # 闲聊
```

#### 频道权限配置

```yaml
角色配置:
  - 团队领导 (Team Lead):
      权限: 管理频道、管理消息、提及所有人
      
  - 核心开发者 (Core Developer):
      权限: 发送消息、嵌入链接、附加文件、使用外部表情
      
  - 贡献者 (Contributor):
      权限: 发送消息、嵌入链接、附加文件
      
  - 只读访客 (Read-Only):
      权限: 查看频道、查看消息历史

频道特殊配置:
  #announcements:
    - 仅团队领导可发布
    - 自动提及 @everyone
    
  #github-notifications:
    - 仅 GitHub Bot 可发布
    - 关闭 @everyone 提及权限
```

#### Discord Bot 集成

**GitHub Bot 配置**:
```yaml
监听事件:
  - Pull Request: 创建、更新、合并、关闭
  - Issue: 创建、分配、关闭
  - Commit: Push 到 dev 分支
  - Deployment: 部署成功/失败
  - CI/CD: 构建状态变更

通知格式:
  Pull Request 创建:
    频道: #github-notifications
    消息: |
      🔄 **新的 Pull Request**
      **标题**: {pr_title}
      **作者**: {author}
      **分支**: {branch} → dev
      **链接**: {pr_url}
      
  CI 失败:
    频道: #error-alerts
    提及: @{pr_author}
    消息: |
      ❌ **CI 构建失败**
      **PR**: {pr_title}
      **错误**: {error_summary}
      **链接**: {ci_url}
```

### Slack 工作区配置方案（备选）

#### 频道结构

```
#hyperframes-general          # 通用讨论
#hyperframes-dev              # 开发讨论
#hyperframes-announcements    # 公告
#hyperframes-github           # GitHub通知
#hyperframes-ci-cd            # CI/CD状态
#hyperframes-standups         # 站会记录
```

#### Slack App 集成

1. **GitHub for Slack**
   - 订阅仓库: `/github subscribe owner/repo`
   - 配置通知类型: `commits, pulls, issues, releases`

2. **Google Calendar**
   - 同步团队日历
   - 会议提醒

3. **Figma for Slack**
   - UI设计评审通知

## 4. 团队日会配置

### 每日站会 (Daily Standup)

#### 会议时间
- **时间**: 每工作日上午 10:00 - 10:15 (15分钟)
- **时区**: UTC+8 (北京时间)
- **平台**: Discord 语音频道 #daily-standup
- **形式**: 异步文字 + 可选语音

#### 站会模板

**Discord 每日站会模板** (使用 bot 自动发布):

```
📅 **Daily Standup - {date}**

请大家在 **10:00 前** 回复以下三个问题：

1️⃣ **昨天完成了什么？**
   - 完成的任务或 PR
   - 遇到的问题

2️⃣ **今天计划做什么？**
   - 今日任务列表
   - 预计完成时间

3️⃣ **有什么阻塞或需要帮助的？**
   - 技术问题
   - 依赖等待
   - 需要讨论的设计决策

---
💡 **快速更新提示**：
- 使用 Thread 回复保持频道整洁
- 标注阻塞问题用 🚨
- 标注需要帮助用 🙋
```

#### 站会记录

**自动化记录** (使用 bot):
- 每日站会结束后自动生成摘要
- 提取所有阻塞问题
- 同步到 GitHub Project 看板

**记录格式**:
```markdown
## Daily Standup - 2026-07-06

### 参与人员
- @developer-a ✅
- @developer-b ✅
- @developer-c ⏰ (迟到)

### 进度摘要
#### 已完成
- [x] 完成 HyperFrames 数据模型设计 (@developer-a)
- [x] 实现 GPU Effects Registry 集成点 (@developer-b)

#### 进行中
- [ ] UI 组件开发 (@developer-c)
- [ ] Skills API 适配器 (@developer-a)

### 🚨 阻塞问题
1. **WebGPU 上下文丢失处理** (@developer-b)
   - 需要架构评审
   - 计划今日下午讨论

### 🙋 需要帮助
1. **HyperFrames CLI 调试** (@developer-c)
   - @developer-a 将协助

### 下次站会
- 时间: 2026-07-07 10:00
- 重点关注: Week 01 收尾工作
```

### 周会 (Weekly Sync)

#### 会议安排
- **时间**: 每周一下午 14:00 - 15:00 (1小时)
- **形式**: 视频会议 (Google Meet / Zoom)
- **参与者**: 全体团队成员

#### 会议议程

```markdown
## Weekly Sync Agenda

### 1. 上周回顾 (15min)
- 完成的功能和任务
- 未完成任务分析
- 数据指标回顾 (PR数量、测试覆盖率等)

### 2. 本周规划 (15min)
- Week N 任务分解
- 任务分配和优先级
- 依赖关系识别

### 3. 技术讨论 (20min)
- 架构设计评审
- 技术难题攻坚
- 最佳实践分享

### 4. 风险识别 (5min)
- 进度风险
- 技术风险
- 资源风险

### 5. AOB (Any Other Business) (5min)
- 自由讨论
- 团队建议
```

### 迭代规划会 (Sprint Planning)

#### 会议安排
- **时间**: 每4周一次，周五下午 14:00 - 16:00 (2小时)
- **形式**: 视频会议 + 白板协作
- **参与者**: 全体团队成员

#### 规划流程

```
1. 回顾上个迭代 (30min)
   - 完成情况分析
   - 速度(Velocity)计算
   - Retrospective (回顾会)

2. 需求评审 (30min)
   - Roadmap 对齐
   - 新需求讨论
   - 优先级排序

3. 任务拆解 (40min)
   - User Story 拆分
   - 技术任务识别
   - 工作量估算 (Planning Poker)

4. 迭代承诺 (20min)
   - 确定迭代目标
   - 任务分配
   - 风险评估
```

## 5. 沟通最佳实践

### 消息响应时间

| 紧急程度 | 响应时间 | 使用场景 | 通知方式 |
|---------|---------|---------|---------|
| 🔴 P0 紧急 | 15分钟内 | 生产故障、阻塞性问题 | @mention + DM |
| 🟠 P1 高 | 2小时内 | 重要决策、代码审查 | @mention |
| 🟡 P2 中 | 当日内 | 一般讨论、问题咨询 | 频道消息 |
| 🟢 P3 低 | 2天内 | 文档更新、非紧急建议 | 异步消息 |

### 有效沟通原则

#### 1. 异步优先 (Async First)
```
✅ 优先使用异步沟通:
- 文字消息 (Discord/Slack)
- 代码注释和 PR 描述
- 文档和 Issue

❌ 避免不必要的同步会议:
- 可以通过文字解决的问题
- 不需要实时讨论的决策
```

#### 2. 上下文完整 (Context is King)
```
❌ 不好的提问:
"这个 bug 怎么修？"

✅ 好的提问:
"在 HyperFrames 渲染器集成时遇到 WebGPU 上下文丢失问题：
- 复现步骤: 切换到其他应用再回来
- 错误信息: [附加截图]
- 尝试过的方案: [列出已尝试的方法]
- 相关代码: src/hyperframes/renderer/gpu-context.ts:125
需要建议如何处理上下文丢失和恢复"
```

#### 3. 公开透明 (Transparent Communication)
```
✅ 在公开频道讨论技术问题
- 让其他人了解进展
- 避免重复提问
- 知识沉淀

⚠️ 只在私聊时:
- 敏感个人问题
- HR 相关事宜
```

### 代码审查沟通规范

#### PR 描述模板
```markdown
## 变更说明
[一句话概述这个 PR 的目的]

## 变更内容
- [ ] 添加了 XXX 功能
- [ ] 修复了 XXX bug
- [ ] 重构了 XXX 模块

## 测试
- [ ] 单元测试已通过
- [ ] 手动测试场景: [描述]
- [ ] 测试截图/视频: [附加]

## 依赖
- 依赖 PR #123
- 阻塞 Issue #456

## 审查重点
请重点关注:
1. [具体文件或逻辑]
2. [性能考虑]
3. [安全考虑]

## Checklist
- [ ] 代码符合开发规范
- [ ] 添加了必要的测试
- [ ] 更新了相关文档
- [ ] 通过了所有 CI 检查
```

#### 审查反馈规范
```
使用建设性语言:

❌ "这代码写得太烂了"
✅ "这里可以使用 useMemo 优化性能，避免不必要的重新计算"

❌ "你不懂异步编程吗？"
✅ "这里的 Promise 没有正确处理错误，建议添加 .catch() 或使用 try-catch"

使用标签:
- 🔴 [必须修改]: 阻塞性问题，必须修复才能合并
- 🟡 [建议]: 可选的改进建议
- 💡 [讨论]: 需要讨论的设计决策
- ✨ [赞]: 好的实践，值得学习
```

## 6. 文档和知识管理

### 文档位置
- **技术文档**: `freecut/docs/hyperframes-integration/`
- **会议记录**: Discord #sprint-planning 频道 pinned messages
- **决策记录**: GitHub Discussions
- **API 文档**: 代码内 JSDoc + 自动生成

### 知识分享机制

#### 每周技术分享 (可选)
- **时间**: 每周五下午 16:00 - 16:30
- **形式**: 15分钟演讲 + 15分钟讨论
- **主题**: 技术难题攻坚、最佳实践、工具推荐

#### 文档更新责任
```
任务完成后必须更新:
- 相关 API 文档
- 架构决策记录 (ADR)
- 使用指南或教程

文档审查:
- PR 包含文档变更时，需要技术写作审查
- 每月文档健康度检查
```

---

## 附录：快速配置脚本

### GitHub Labels 批量创建脚本

```bash
#!/bin/bash
# create-hyperframes-labels.sh

REPO="owner/freecut"

# 模块标签
gh label create "hyperframes:core" -c FF6B6B -d "核心架构和基础设施" -R $REPO
gh label create "hyperframes:ui" -c 4ECDC4 -d "UI组件和界面" -R $REPO
gh label create "hyperframes:skills" -c 45B7D1 -d "AI技能系统" -R $REPO
gh label create "hyperframes:renderer" -c FFA07A -d "渲染器和管道" -R $REPO
gh label create "hyperframes:data" -c 98D8C8 -d "数据模型和存储" -R $REPO
gh label create "hyperframes:export" -c FFD93D -d "导出和发布功能" -R $REPO

# 类型标签
gh label create "type:feature" -c 0E8A16 -d "新功能" -R $REPO
gh label create "type:bug" -c D73A4A -d "Bug修复" -R $REPO
gh label create "type:refactor" -c FFA500 -d "代码重构" -R $REPO

# 优先级标签
gh label create "priority:P0" -c B60205 -d "紧急 - 阻塞性问题" -R $REPO
gh label create "priority:P1" -c D93F0B -d "高优先级 - 本周必须完成" -R $REPO
gh label create "priority:P2" -c FBCA04 -d "中优先级 - 本迭代完成" -R $REPO
gh label create "priority:P3" -c 0E8A16 -d "低优先级 - 可以延后" -R $REPO

echo "✅ GitHub labels 创建完成"
```

### Discord Bot 配置模板

```javascript
// discord-bot-config.js
module.exports = {
  guild_id: 'YOUR_GUILD_ID',
  channels: {
    announcements: 'CHANNEL_ID',
    github_notifications: 'CHANNEL_ID',
    daily_standup: 'CHANNEL_ID'
  },
  standup_schedule: '0 10 * * 1-5', // Cron: 每工作日 10:00
  github_webhook: {
    events: ['pull_request', 'issues', 'push', 'deployment_status']
  }
}
```

---

**文档版本**: v1.0  
**最后更新**: 2026-07-06  
**维护者**: HyperFrames 整合团队
