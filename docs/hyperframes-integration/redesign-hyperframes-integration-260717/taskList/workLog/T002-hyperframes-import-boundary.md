# T002 增加依赖边界检查

## 任务

增加依赖边界检查，禁止 FreeCut 源码直接 import `@hyperframes/*`，确保 HyperFrames 能力通过 `src/features/hyperframes-runtime` 源码镜像、adapter 或 bridge 使用。

## 完成内容

- 新增 `scripts/check-hyperframes-runtime-imports.mjs`。
- 新增 `package.json` 脚本 `check:hyperframes-runtime-imports`。
- 将新检查加入 `verify` 链路。
- 检查范围覆盖 `src/**/*.{ts,tsx,js,jsx,mjs,cjs}`。
- 支持识别静态 import/export、动态 import 和 require。

## 关键决策

- 该检查只扫描源码代码文件，不扫描 provenance JSON 和文档，因为那些位置需要记录 `@hyperframes/*` 的改写规则。
- 后续迁移源码时必须先改写 import，再让代码进入可检查范围。

## 验证

- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node scripts/check-hyperframes-runtime-imports.mjs`
