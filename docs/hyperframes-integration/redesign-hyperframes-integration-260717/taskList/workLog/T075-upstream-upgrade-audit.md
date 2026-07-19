# T075 建立源码迁移升级测试

## 完成内容

- 使用 upstream manifest、sync state、可重复 dry-run、import policy 和 Producer browser boundary 作为升级审计链。
- Producer 快照 dry-run 对比 88 个文件全部相同，无新增和变更。
- patch note 工具、import rewrite map 和 sync state 保留每次本地适配依据。

## 验证

- producer-node dry-run：88 same、0 new、0 changed。
- runtime direct import 与 Producer browser boundary 检查通过。
