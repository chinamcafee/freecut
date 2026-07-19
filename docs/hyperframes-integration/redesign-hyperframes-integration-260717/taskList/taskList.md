# HyperFrames 源码级集成任务清单

## 使用规则

本清单基于 `redesign-hyperframes-integration-260717` 目录下 13 份技术方案拆解。任务按顺序递进，前序任务提供后序任务的类型、目录、适配器、测试和 UI 基础。

执行规则：

1. 每完成一个子任务，把对应复选框改为 `[x]`。
2. 每完成一个子任务，在 `taskList/workLog/` 下新增一份同编号日志。
3. 集成 HyperFrames 能力时优先源码迁移到 FreeCut 专门目录，禁止把 FreeCut 主路径写成直接依赖 `@hyperframes/*` npm 包。
4. 迁移源码时必须记录来源包、来源文件、目标路径、import 改写和本地 patch。
5. 每个阶段完成前要跑与该阶段匹配的测试；不能用窄测试证明广泛能力。

## P0 任务治理与源码镜像基线

- [x] T000 生成完整任务清单和日志规范。
  - 来源文档：全部方案文档。
  - 交付：`taskList/taskList.md`、`taskList/workLog/T000-task-list.md`。
  - 验收：清单覆盖源码迁移、数据模型、模型中心、技能、Studio、Player、Producer、主界面、安全、测试和发布门禁。

- [x] T001 建立 `src/features/hyperframes-runtime` 源码镜像总目录和 provenance 基线。
  - 来源文档：`00`、`02`、`10`、`12`。
  - 交付：运行时根导出、`provenance/upstream-manifest.json`、`import-rewrite-map.json`、patch notes、基础测试。
  - 验收：能通过测试读取源码来源、目标目录和 import 改写；没有新增 `@hyperframes/*` npm 依赖。

- [x] T002 增加依赖边界检查，禁止业务代码直接 import `@hyperframes/*`。
  - 来源文档：`00`、`02`、`09`、`12`。
  - 交付：脚本或现有边界检查扩展、违规样例测试。
  - 验收：直接 import `@hyperframes/player`、`@hyperframes/studio` 等会失败；镜像层内部改写映射允许。

- [x] T003 建立 HyperFrames 源码同步工具。
  - 来源文档：`09`、`10`、`12`。
  - 交付：从 `/Users/changzechuan/VideoAIEditProjects/hyperframes` 复制指定包源码的脚本、dry-run 模式、差异报告。
  - 验收：能同步单个包到 `upstream/*`，更新 provenance，不覆盖 adapters/bridges。

- [x] T004 建立源码迁移 patch 记录流程。
  - 来源文档：`00`、`09`、`12`。
  - 交付：`patch-notes.md` 模板、每包迁移记录规范、升级审计步骤。
  - 验收：每次源码迁移都能追踪上游路径、本地改动和测试结果。

## P1 数据模型、项目目录与存储

- [x] T005 定义 HyperFrames 项目类型与 FreeCut 项目扩展。
  - 来源文档：`03`。
  - 交付：`src/types` 或特性内类型，包含 manifest、project directory、asset ref、composition link、render cache、provenance、integration state。
  - 验收：类型覆盖文档字段；不新增独立 `hyperframes-composition` 时间线类型。

- [x] T006 扩展时间线组合项的源链接字段。
  - 来源文档：`03`、`04`、`11`。
  - 交付：`composition` 项支持 `sourceKind: "hyperframes"`、`hyperframesProjectId`、`activeCompositionPath`、manifest 路径。
  - 验收：普通组合不受影响；HyperFrames 源链接组合可定位项目目录。

- [x] T007 实现 `HyperFramesProjectRepository` 仓储接口。
  - 来源文档：`03`、`07`、`12`。
  - 交付：list/read/write/copyAsset/snapshot/restore/signature API。
  - 验收：Studio、Player、Lint、Producer 只能通过仓储读取项目目录。

- [x] T008 实现浏览器内存项目目录适配器。
  - 来源文档：`03`、`06`、`07`。
  - 交付：测试友好的 in-memory adapter。
  - 验收：读写 manifest、HTML、资产元数据、快照和恢复均有测试。

- [x] T009 实现 OPFS 或现有 workspace-fs 存储适配器。
  - 来源文档：`03`。
  - 交付：浏览器持久化项目目录。
  - 验收：项目关闭重开后目录、manifest、资产和快照仍可读取。

- [x] T010 实现路径安全与文件类型守卫。
  - 来源文档：`03`、`09`、`12`。
  - 交付：拒绝绝对路径、`..`、符号链接逃逸、危险扩展名和非法 MIME。
  - 验收：路径逃逸和危险写入测试通过。

- [x] T011 实现 manifest 签名、preview signature 和 render signature。
  - 来源文档：`03`、`08`。
  - 交付：稳定 hash、缓存失效规则。
  - 验收：文件变化导致签名变化；无关 UI 状态不改变 render signature。

- [x] T012 实现 FreeCut 项目迁移。
  - 来源文档：`03`、`10`、`11`。
  - 交付：旧项目迁移为 `Project.hyperframes` manifest 状态。
  - 验收：旧字段迁移、缺失 manifest 诊断、版本升级测试通过。

- [x] T013 实现项目目录打包与解包。
  - 来源文档：`03`、`06`。
  - 交付：导入导出 `.zip` 或内部 bundle。
  - 验收：打包后可恢复 manifest、组合、资产、来源记录。

## P2 core、parsers、lint 源码迁移

- [x] T014 迁移 `packages/parsers/src` 到 `upstream/parsers`。
  - 来源文档：`03`、`07`、`12`。
  - 交付：HTML、GSAP、资产、hfIds 解析源码镜像。
  - 验收：HTML roundtrip、GSAP parse/write、资产提取测试通过。

- [x] T015 建立 parsers 适配入口。
  - 来源文档：`03`、`07`。
  - 交付：`adapters/freecut-project` 到 parser 的 typed wrapper。
  - 验收：解析失败返回诊断对象，不把异常直接抛给 UI。

- [x] T016 迁移 `packages/lint/src` 到 `upstream/lint`。
  - 来源文档：`06`、`08`、`09`、`12`。
  - 交付：项目 lint、规则、shouldBlockRender 源码镜像。
  - 验收：不安全脚本、缺失资产、字体和媒体规则测试通过。

- [x] T017 建立 FreeCut lint 诊断映射。
  - 来源文档：`04`、`06`、`09`。
  - 交付：阻塞、警告、建议 severity 映射和定位信息。
  - 验收：导入、保存、预览、导出前使用同一诊断模型。

- [x] T018 迁移 core runtime 浏览器子集。
  - 来源文档：`02`、`08`、`12`。
  - 交付：`packages/core/src/runtime`、必要类型和安全工具源码镜像。
  - 验收：变量、时钟、媒体和 runtime 注入测试通过。

- [x] T019 迁移 core compiler 子集。
  - 来源文档：`03`、`08`、`12`。
  - 交付：HTML bundler、子组合、资产路径和 timing compiler。
  - 验收：项目目录能生成预览 HTML；子组合路径正确。

- [x] T020 建立 runtime 注入策略。
  - 来源文档：`08`、`09`。
  - 交付：`createPreviewDocument` 和 CSP/sandbox 注入控制。
  - 验收：组合脚本不能越过预览沙箱；runtime URL 可切换。

## P3 Player 源码迁移与统一预览

- [x] T021 迁移 `packages/player/src` 到 `upstream/player`。
  - 来源文档：`04`、`08`、`12`。
  - 交付：Web Component、iframe、时钟、parent media、composition probe。
  - 验收：源码镜像可编译，内部 `@hyperframes/*` import 已改写。

- [x] T022 实现 `HyperFramesPlayerHost`。
  - 来源文档：`04`、`08`。
  - 交付：FreeCut preview bridge 封装 player。
  - 验收：能加载 srcdoc、触发 ready/error/timeupdate。

- [x] T023 实现 FreeCut 播放头到 HyperFrames 时钟同步。
  - 来源文档：`04`、`08`。
  - 交付：`useFreeCutTimelineClock`。
  - 验收：seek、play、pause、倍速、静音和音量同步测试通过。

- [x] T024 实现播放器 iframe 解析和 postMessage 协议。
  - 来源文档：`08`、`09`。
  - 交付：session nonce、origin 校验、message schema。
  - 验收：错误 origin 和错误 nonce 被拒绝。

- [x] T025 将 HyperFrames 预览接入 FreeCut 中央预览器。
  - 来源文档：`04`、`08`。
  - 交付：选中源链接组合时可预览。
  - 验收：普通 FreeCut 预览不回退；HyperFrames 片段错误显示诊断。

- [x] T026 实现预览性能与帧同步测试。
  - 来源文档：`08`、`10`。
  - 交付：第 0 帧、中间帧、尾帧一致性测试。
  - 验收：预览误差不超过 1 帧。

## P4 Studio 和 studio-server 源码迁移

- [x] T027 迁移 Studio 第一批源码。
  - 来源文档：`04`、`07`、`12`。
  - 交付：NLELayout、NLEPreview、FileTree、SourceEditor、PropertyPanel、player hooks、sourcePatcher。
  - 验收：源码镜像可编译，样式不污染主界面。

- [x] T028 实现 `FreeCutStudioShell`。
  - 来源文档：`04`、`07`。
  - 交付：打开、关闭、保存、dirty 状态、快捷键作用域。
  - 验收：双击 HyperFrames 片段打开工作室；有未保存修改时阻止误关闭。

- [x] T029 实现 `FreeCutStudioAdapter`。
  - 来源文档：`07`、`12`。
  - 交付：文件树、read/write、previewUrl、lint、selection、thumbnail、renderPreview。
  - 验收：Studio 不能直接读写 FreeCut store 或磁盘。

- [x] T030 迁移 `packages/studio-server/src/helpers`。
  - 来源文档：`07`、`09`、`12`。
  - 交付：safePath、sourceMutation、finiteMutation、backupJournal、previewAdapter、screenshotClip、waveform。
  - 验收：路径安全、有限源码修改和备份 journal 测试通过。

- [x] T031 接入 studio-server routes 到本地服务适配。
  - 来源文档：`02`、`07`、`12`。
  - 交付：projects/files/preview/lint/thumbnail/selection/render/waveform/registry 路由或等价 adapter API。
  - 验收：route 不绕过 FreeCut 项目权限。

- [x] T032 迁移 Studio 第二批高级编辑能力。
  - 来源文档：`07`、`12`。
  - 交付：DomEditOverlay、LayersPanel、manual edits、studio motion、motion path、snap。
  - 验收：点击元素、修改属性、生成 patch、可撤销。

- [x] T033 接入 Studio 主题和样式隔离。
  - 来源文档：`04`、`07`。
  - 交付：`.freecut-hyperframes-studio` 根类、CSS variables 映射、图标策略。
  - 验收：打开工作室不改变 FreeCut 主界面样式。

- [x] T034 实现 Studio 自然语言 patch 流程。
  - 来源文档：`05`、`07`、`09`。
  - 交付：selection snapshot、patch proposal、diff、lint、确认、undo journal。
  - 验收：确认前不写文件；确认后可回滚。

## P5 模型与能力中心

- [x] T035 定义模型配置、能力和权限类型。
  - 来源文档：`05`、`09`。
  - 交付：ModelProfile、ModelCapabilityBinding、ToolPolicy、MaterialScope。
  - 验收：覆盖文本、视觉、音频、代码、工具调用、成本、隐私。

- [x] T036 实现模型注册表和能力路由。
  - 来源文档：`05`、`06`。
  - 交付：按任务需求选择模型组合。
  - 验收：不同能力可以绑定不同 provider。

- [x] T037 实现云端 OpenAI-compatible provider。
  - 来源文档：`05`。
  - 交付：baseUrl、modelId、apiKeyRef、结构化输出、错误映射。
  - 验收：连接测试、超时、401、限流测试通过。

- [x] T038 实现私有网关 provider。
  - 来源文档：`05`、`09`。
  - 交付：自定义 headers、代理、团队策略。
  - 验收：私有网关不支持工具调用时计划能降级。

- [x] T039 实现本地模型 provider。
  - 来源文档：`05`。
  - 交付：本地 HTTP、本地命令或 FreeCut 内置能力注册。
  - 验收：本地服务未启动时 UI 有明确状态。

- [x] T040 实现凭据、成本和配额。
  - 来源文档：`05`、`09`。
  - 交付：credential-store、cost-estimator、budget gate。
  - 验收：密钥不进入项目文件；费用超限需确认。

- [x] T041 实现模型配置 UI。
  - 来源文档：`01`、`04`、`05`。
  - 交付：供应商、能力映射、凭据、成本、隐私权限页签。
  - 验收：可配置云端、私有网关、本地模型。

## P6 技能资源迁移与生成工作流

- [x] T042 迁移 `skills/*` 资源。
  - 来源文档：`06`、`12`。
  - 交付：SKILL、CATALOG、references、themes、examples、scripts 资源镜像。
  - 验收：不运行外部仓库；provenance 记录来源路径。

- [x] T043 实现技能目录解析器。
  - 来源文档：`06`、`12`。
  - 交付：HyperFramesSkillDefinition。
  - 验收：能解析 title、categories、inputRequirements、modelRequirements、toolRequirements、sourcePaths。

- [x] T044 实现技能推荐器。
  - 来源文档：`01`、`06`。
  - 交付：根据用户意图、素材、时间线位置、模型能力推荐技能。
  - 验收：动态图形、字幕、网站视频、解释视频等场景命中正确技能。

- [x] T045 实现生成计划 `GenerationPlan`。
  - 来源文档：`01`、`05`、`06`。
  - 交付：步骤、工具权限、模型调用预算、输出目录、预计时长。
  - 验收：计划先展示并确认，不能直接执行写入。

- [x] T046 实现技能任务队列。
  - 来源文档：`06`。
  - 交付：pending/running/waiting-confirmation/complete/failed/canceled 状态、取消、重试。
  - 验收：失败保留临时项目目录和日志。

- [x] T047 实现浏览器轻量执行器。
  - 来源文档：`06`。
  - 交付：无文件系统需求的模型生成和内存项目目录输出。
  - 验收：输出归一化为 `SkillOutputBundle`。

- [x] T048 实现本地服务执行器。
  - 来源文档：`06`、`09`、`12`。
  - 交付：文件系统、Chrome、FFmpeg、转写、截图能力。
  - 验收：脚本权限声明、运行时间限制、可取消。

- [x] T049 实现技能输出归一化和导入预览。
  - 来源文档：`06`。
  - 交付：projectDirectory、manifest、diagnostics、modelUsage、suggestedImportStrategy。
  - 验收：导入前可预览、lint、估算成本、选择导入策略。

- [x] T050 实现确认、回滚和失败修复。
  - 来源文档：`06`、`07`、`09`。
  - 交付：同模型修复、切换模型修复、打开工作室修复。
  - 验收：确认前不污染项目；确认后可撤销。

## P7 主界面集成

- [x] T051 实现 AI 生成页签。
  - 来源文档：`01`、`04`、`06`。
  - 交付：自然语言输入、模板、技能推荐、计划、成本预估。
  - 验收：用户在 FreeCut 主界面完成生成入口操作。

- [x] T052 实现 HyperFrames 项目库。
  - 来源文档：`04`。
  - 交付：项目缩略图、状态、引用次数、打开、导出、删除。
  - 验收：项目目录与时间线引用一致。

- [x] T053 实现时间线源链接组合视觉。
  - 来源文档：`03`、`04`。
  - 交付：HF badge、缓存状态、诊断状态、未保存修改状态。
  - 验收：普通组合和 HyperFrames 源链接组合可清楚区分。

- [x] T054 实现时间线右键动作。
  - 来源文档：`04`。
  - 交付：打开工作室、重新渲染、重新链接、导出项目目录、转原生项、查看来源。
  - 验收：动作遵守源目录不被外层修剪直接修改原则。

- [x] T055 实现右侧 HyperFrames 属性面板。
  - 来源文档：`04`、`07`、`08`。
  - 交付：来源、变量、诊断、渲染缓存、模型来源和动作。
  - 验收：片段级属性和 Studio DOM 属性边界清晰。

- [x] T056 实现生成结果预览抽屉。
  - 来源文档：`04`、`06`。
  - 交付：缩略图、文件列表、manifest、诊断、模型费用、导入策略。
  - 验收：未确认不写时间线。

- [x] T057 实现模型状态入口。
  - 来源文档：`04`、`05`。
  - 交付：顶部栏或 AI 面板状态、缺模型提示、成本状态。
  - 验收：模型不可用时可直接进入配置中心。

- [x] T058 实现无障碍和快捷键。
  - 来源文档：`04`、`07`。
  - 交付：工作室快捷键作用域、时间线与工作室冲突处理。
  - 验收：空格、删除、保存、撤销行为符合文档。

## P8 导入导出、反向转换与渲染

- [x] T059 实现 FreeCut 到 HyperFrames 项目目录导出。
  - 来源文档：`03`、`06`。
  - 交付：manifest、index、compositions、assets。
  - 验收：导出目录可被 Player 预览。

- [x] T060 实现 HyperFrames 项目目录导入。
  - 来源文档：`03`、`06`。
  - 交付：源链接组合、compositionLinks、项目仓储写入。
  - 验收：导入后可打开工作室和预览。

- [x] T061 实现可编辑近似项转换。
  - 来源文档：`03`、`06`。
  - 交付：文本、视频、音频、图片、形状和组合近似项。
  - 验收：近似项不取代源目录，损失记录可查看。

- [x] T062 迁移 producer-node 源码。
  - 来源文档：`08`、`12`。
  - 交付：server、browserManager、htmlCompiler、frameCapture、audioMixer、chunkEncoder、renderOrchestrator。
  - 验收：Node-only 代码不进入浏览器 bundle。

- [x] T063 实现 `HyperFramesRenderService`。
  - 来源文档：`08`。
  - 交付：checkRuntime、estimate、start、cancel、subscribe、getOutput、clearCache。
  - 验收：渲染进度、取消、失败和日志进入 FreeCut render job store。

- [x] T064 实现透明叠加导出。
  - 来源文档：`08`。
  - 交付：WebM、PNG 序列或 alpha 中间格式与 FreeCut 合成。
  - 验收：透明背景预览和导出一致。

- [x] T065 实现渲染缓存。
  - 来源文档：`03`、`08`。
  - 交付：cache key、命中、失效、清理、导出报告。
  - 验收：runtime、manifest、输出格式变化会失效。

- [x] T066 实现导出门禁。
  - 来源文档：`08`、`09`。
  - 交付：manifest 缺失、安全失败、producer 缺失、渲染失败、透明叠加失败阻塞。
  - 验收：门禁失败不破坏项目。

## P9 安全、隐私、审计与运维

- [x] T067 实现 HTML 安全和 iframe sandbox 策略。
  - 来源文档：`09`。
  - 交付：脚本白名单、CSP、网络策略、sandbox token。
  - 验收：任意脚本不能进入主窗口。

- [x] T068 实现 postMessage schema 校验。
  - 来源文档：`08`、`09`。
  - 交付：message type、projectId、compositionPath、frame、payload、nonce。
  - 验收：错误 origin、nonce、projectId、payload 被拒绝。

- [x] T069 实现模型隐私和素材访问清单。
  - 来源文档：`05`、`09`。
  - 交付：调用前展示上传素材、隐私模式、费用和目标服务。
  - 验收：本地隐私模式不会自动降级到云端。

- [x] T070 实现审计日志。
  - 来源文档：`03`、`05`、`09`。
  - 交付：模型调用、文件写入、导入、渲染、导出、回滚记录。
  - 验收：日志脱敏，不保存明文密钥和敏感 prompt。

- [x] T071 实现故障诊断和支持信息。
  - 来源文档：`09`。
  - 交付：模型不可用、校验失败、渲染失败、资产缺失、费用超限用户文案。
  - 验收：用户能看到下一步动作。

- [x] T072 实现数据保留和清理策略。
  - 来源文档：`09`。
  - 交付：临时项目、缩略图缓存、失败任务、模型日志、未引用项目清理。
  - 验收：清理不会删除仍被时间线引用的项目。

## P10 质量门禁、发布和文档闭环

- [x] T073 建立单元测试矩阵。
  - 来源文档：`10`、`12`。
  - 交付：数据模型、仓储、parser、lint、player、studio、skills、render、security 测试。
  - 验收：每个模块至少覆盖正常、失败和边界场景。

- [x] T074 建立集成测试矩阵。
  - 来源文档：`10`。
  - 交付：生成、导入、预览、工作室保存、渲染、导出、回滚。
  - 验收：主流程 E2E 通过。

- [x] T075 建立源码迁移升级测试。
  - 来源文档：`09`、`12`。
  - 交付：对比 upstream manifest、import rewrite、patch notes、迁移后测试。
  - 验收：更新 HyperFrames 本地源码快照有审计结果。

- [x] T076 建立性能测试。
  - 来源文档：`08`、`10`。
  - 交付：预览首帧、seek、复杂解析、渲染小样、缓存命中。
  - 验收：满足文档性能目标或记录明确风险。

- [x] T077 建立发布阻塞检查。
  - 来源文档：`09`、`10`。
  - 交付：安全、隐私、成本、渲染、模型、文档门禁。
  - 验收：阻塞项未解决时不能发布。

- [x] T078 更新用户文档和开发文档。
  - 来源文档：全部方案文档。
  - 交付：用户说明、开发者迁移说明、故障排查、源码升级流程。
  - 验收：文档不再传播旧的单 HTML、独立时间线类型、npm 依赖主路径。

- [x] T079 最终端到端验收。
  - 来源文档：`10` 完成定义。
  - 交付：配置模型、生成视频、预览、导入、打开工作室、修改、渲染、导出、回滚。
  - 验收：完整链路可运行；所有任务日志齐全；`taskList.md` 全部勾选。
