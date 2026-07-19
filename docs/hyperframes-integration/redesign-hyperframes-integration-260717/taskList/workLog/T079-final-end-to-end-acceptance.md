# T079 最终端到端验收

## 验收链路

- 模型 profile、隐私、素材范围、费用和生成计划。
- 生成结果预览、明确确认、项目目录写入与可回滚导入。
- FreeCut 到 HyperFrames 项目目录导出。
- source-linked composition 与可编辑近似项导入。
- Player compiler 预览、Studio 打开/保存/快捷键作用域。
- Producer runtime、任务进度、取消、失败和日志。
- alpha 叠加、render cache、export gate 和发布门禁。
- 审计、诊断、保留清理、用户文档与升级流程。

## 最终验证

- 最终核心测试：17 个测试文件、41 个测试通过。
- 单元测试矩阵复核：10 个测试文件、43 个测试通过。
- 全量静态检查：2198 个文件，0 error；仅 1 个既有 keyframe Fast Refresh warning。
- `check-hyperframes-runtime-imports` 通过。
- `check-hyperframes-producer-boundary` 通过。
- 生产构建通过，4349 个模块完成转换。
- Producer upstream dry-run：88 same、0 new、0 changed。

## 结果

- T000-T079 全部完成并勾选。
- 每个任务均有独立 workLog，共 80 份。
- 完整链路可在 FreeCut 主面板、Studio、Player 和 Producer 服务边界内运行。

## 主面板端到端复核（2026-07-19）

- 在真实 FreeCut 编辑器完成项目库、源链接片段、中央 Player、属性变量、六个时间线动作、Studio 打开/保存/关闭和模型不可用入口验收。
- Studio 冷启动控制台 0 warning、0 error；HyperFrames 源链接不再进入 FreeCut 基础子组合 renderer。
- 本轮核心回归：15 个测试文件、51 个测试全部通过。
- 全量静态检查：2208 个文件，0 error；仅 1 个既有 keyframe Fast Refresh warning。
- 生产构建通过：4271 个模块完成转换，10.22 秒；保留项目既有动态导入、chunk 大小和插件耗时提示。
- 环境未配置真实 LLM profile/凭据及 Producer 服务，因此未执行实际模型请求或真实视频渲染；两条不可用路径均在主面板显示明确状态/错误，不存在静默成功。
