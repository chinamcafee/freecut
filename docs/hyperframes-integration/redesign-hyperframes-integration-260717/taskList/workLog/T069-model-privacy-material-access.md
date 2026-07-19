# T069 实现模型隐私和素材访问清单

## 完成内容

- 复核 model profile privacy mode、MaterialScope、ToolPolicy、上传模式、费用估算和确认门禁。
- 生成计划明确列出素材、所需权限、网络、付费模型、费用和执行目标。
- 本地 profile 只路由 local privacy class，不可用时不会自动降级到云 profile。
- 默认策略隐藏本地路径并禁止未确认外部上传。

## 验证

- generation plan 与 credential/cost/budget 核心测试通过。
- 本轮 P9 复核合计 4 个测试文件、16 个测试通过。
