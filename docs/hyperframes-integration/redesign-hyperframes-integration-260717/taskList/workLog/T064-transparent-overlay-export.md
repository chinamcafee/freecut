# T064 实现透明叠加导出

## 完成内容

- 新增透明叠加渲染请求构造器，仅允许 WebM、MOV 和 PNG 序列 alpha 中间格式。
- 请求强制启用 alpha，并保留质量与音频策略。
- 新增 FreeCut 合成描述，包含时间线位置、帧长、画布、fps、源 composition 和 straight alpha 模式。
- 透明合成入口拒绝 opaque Producer 输出，避免静默生成黑底或错误叠加。
- 提供直接通过 `HyperFramesRenderService` 启动透明任务的入口。

## 验证

- `vp test run src/features/hyperframes-runtime/bridges/render-bridge/transparentOverlay.test.ts`
- `vp check --no-fmt` 检查透明叠加实现、测试与公开入口。

## 结果

- 1 个测试文件、2 个测试通过。
- 相关 4 个文件 lint 和类型检查通过，无警告。
