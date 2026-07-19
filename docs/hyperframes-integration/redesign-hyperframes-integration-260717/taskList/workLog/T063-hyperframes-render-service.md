# T063 实现 HyperFramesRenderService

## 任务

建立 FreeCut 到 Producer 本地服务的稳定渲染契约，统一 runtime 检查、估算、任务执行、取消、订阅、输出和缓存清理。

## 完成内容

- 新增 `HyperFramesRenderService` 和可注入 `HyperFramesRenderTransport`。
- 实现 `checkRuntime`、`estimate`、`start`、`cancel`、`subscribe`、`getOutput`、`getJob` 和 `clearCache`。
- runtime 缺 Chrome、FFmpeg 或整体不可用时，在入队前失败。
- 新增 FreeCut 自有 `useHyperFramesRenderJobStore`，保存队列状态、阶段、帧进度、日志、失败、取消和输出。
- transport 只暴露稳定数据对象，不把 Producer、Puppeteer 或 FFmpeg 内部对象泄漏到浏览器。
- 使用 AbortController 与 Producer cancel 双通道取消运行任务。
- 新增正常进度与输出、取消、runtime 不可用三类核心测试。

## 验证

- `vp test run src/features/hyperframes-runtime/bridges/render-bridge/HyperFramesRenderService.test.ts`
- `vp check --no-fmt` 检查 render service、job store、测试和导出入口。

## 结果

- 1 个测试文件、3 个测试通过。
- 相关 5 个文件 lint 和类型检查通过，无警告。
