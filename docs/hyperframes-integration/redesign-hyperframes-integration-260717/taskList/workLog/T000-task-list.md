# T000 生成完整任务清单和日志规范

## 任务

基于 `redesign-hyperframes-integration-260717` 下的完整技术方案，拆解一份可按顺序推进、可逐项勾选、可对应工作日志的任务清单。

## 完成内容

- 建立 `taskList/taskList.md`。
- 明确每个子任务完成后需要勾选。
- 明确每个已完成子任务都需要在 `taskList/workLog/` 下保留一份同编号日志。
- 按 P0 到 P10 拆解任务，覆盖源码迁移、数据模型、存储、parsers、lint、core、player、studio、studio-server、模型中心、技能、主界面、producer、导出、安全、质量和发布验收。

## 关键原则

- HyperFrames 能力优先以源码形式迁移到 FreeCut 专门目录。
- FreeCut 主业务路径禁止直接依赖 `@hyperframes/*` npm 包。
- 每个迁移任务都要记录源码来源、目标路径、import 改写和本地 patch。

## 验证

- 清单包含递进任务编号。
- 清单中每个任务都有来源文档、交付物和验收条件。
