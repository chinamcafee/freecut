# T065 实现渲染缓存

## 完成内容

- 新增 HyperFrames render cache、lookup、put、项目清理和导出报告。
- cache key 覆盖 manifest/文件/资产、runtime、Producer 版本、composition、尺寸、fps、质量、格式、alpha 和音频。
- 缓存输出文件不存在时自动移除失效索引。
- 项目清理同步删除输出文件并返回清理数量。
- 报告提供项目计数、总条目和完整缓存元数据。

## 验证

- 1 个测试文件、2 个测试通过。
- 相关 4 个文件 lint 和类型检查通过，无警告。
