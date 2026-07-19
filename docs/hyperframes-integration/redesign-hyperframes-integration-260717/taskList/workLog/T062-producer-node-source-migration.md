# T062 迁移 producer-node 源码

## 任务

迁移 HyperFrames Producer 的 Node 渲染源码，并建立强制边界，确保 Chrome、FFmpeg 和 Node 服务代码不进入 FreeCut 浏览器 bundle。

## 完成内容

- 使用统一 upstream sync 工具从 `hyperframes/packages/producer/src` 迁移 88 个非测试源码文件。
- 覆盖 server、browserManager、htmlCompiler、compilationRunner、frameCapture、audioExtractor、audioMixer、chunkEncoder 和 renderOrchestrator。
- 同步 render stages、distributed 渲染、HDR、文件服务、字体、观测、性能和 runtime snapshot 依赖源码。
- 更新 upstream sync state，记录来源、目标、同步时间、文件数和字节数。
- 将 producer-node 标记为 Node-only 本地服务源码快照，排除在浏览器 TypeScript、lint 和 format 图之外。
- 新增 `check-hyperframes-producer-boundary.mjs`，扫描静态 import、动态 import 和 require，禁止浏览器源码依赖 producer-node。
- 将 producer 边界检查加入项目 `verify` 链路。
- 保留 Node upstream 内部依赖图；浏览器侧只能通过后续 `HyperFramesRenderService` 调用。

## 关键决策

- Producer 源码保持本地服务边界，不通过 FreeCut browser package 安装其 Hono、Puppeteer、Chrome 或 FFmpeg 依赖。
- 上游 Node 源码快照不参与浏览器类型检查；边界扫描和生产构建共同验证它没有被打包。
- 同步使用可审计脚本而非人工复制，后续升级可以复现并比较来源。

## 验证

- `node scripts/check-hyperframes-runtime-imports.mjs`
- `node scripts/check-hyperframes-producer-boundary.mjs`
- 检查七个任务指定核心源码文件存在。
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp build`

## 结果

- 88 个 Producer Node 非测试源码文件完成同步，共 2,053,096 字节。
- runtime import 与 producer browser boundary 检查通过。
- FreeCut 生产构建通过；构建仅保留既有 Node parser external、动态导入和 chunk size 警告，未包含 producer-node 模块。
