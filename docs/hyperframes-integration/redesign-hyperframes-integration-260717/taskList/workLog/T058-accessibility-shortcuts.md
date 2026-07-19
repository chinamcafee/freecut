# T058 实现无障碍和快捷键

## 任务

建立 HyperFrames Studio 独占快捷键作用域，处理 Studio 与 FreeCut 全局时间线在空格、删除、保存和撤销上的冲突。

## 完成内容

- 编辑器状态新增 `hyperFramesStudioShortcutScopeActive` 及更新动作。
- Studio 打开时启用快捷键作用域，关闭、项目切换或组件卸载时自动释放。
- FreeCut 时间线的空格播放、删除、波纹删除、撤销和重做在 Studio 作用域内让出事件。
- FreeCut 全局保存和导出在 Studio 作用域内让出事件。
- Studio 空白区域的空格切换 Studio 预览，删除键不会删除时间线片段。
- Studio 源码编辑区保留原生删除与撤销，`Cmd/Ctrl+S` 保存 Studio 文件而不是 FreeCut 时间线。
- 新增作用域状态、删除让出和 Studio 键盘行为测试。

## 关键决策

- 使用编辑器共享状态解决 window capture 阶段的冲突；只依赖 DOM 冒泡拦截会晚于部分全局快捷键。
- 源码编辑区的撤销由浏览器文本编辑器处理，Studio 只停止继续传播；视觉补丁继续使用 Studio 自身的撤销栈。
- 全局处理器在让出时不调用 `preventDefault`，确保事件仍能到达 Studio 和原生文本控件。

## 验证

- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run src/features/hyperframes-runtime/bridges/studio-bridge/FreeCutStudioShell.test.tsx src/features/timeline/hooks/shortcuts/use-editing-shortcuts.test.tsx src/features/editor/stores/editor-store.test.ts`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp check --no-fmt src/shared/state/editor/types.ts src/shared/state/editor/store.ts src/features/timeline/hooks/shortcuts/use-editing-shortcuts.ts src/features/timeline/hooks/shortcuts/use-playback-shortcuts.ts src/features/timeline/hooks/shortcuts/use-ui-shortcuts.ts src/features/editor/hooks/use-editor-hotkeys.ts src/features/hyperframes-runtime/bridges/studio-bridge/FreeCutStudioShell.tsx src/features/editor/components/editor.tsx`

## 结果

- T058 核心测试通过：3 个测试文件、35 个测试通过。
- 相关 8 个文件 lint 和类型检查通过，无警告。

## 浏览器验收补充（2026-07-19）

- HyperFrames 侧栏、时间线动作和 Studio dialog 的可访问名称可由角色查询稳定定位；模型设置 dialog 补齐 description，消除运行时可访问性警告。
- Studio 打开时的快捷键作用域、关闭恢复和编辑区域行为在真实浏览器与 Shell 回归测试中通过。
