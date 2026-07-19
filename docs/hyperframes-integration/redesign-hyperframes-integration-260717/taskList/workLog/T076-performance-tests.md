# T076 建立性能测试

## 完成内容

- 新增 500 层复杂 FreeCut 导出加 HyperFrames compiler 预览性能测试。
- 新增 1000 次 render cache 命中性能测试。
- Player 帧同步、seek 和尾帧继续由 T026 既有性能/一致性测试覆盖；真实 Producer 小样受本机 Chrome/FFmpeg 环境约束，作为本地服务发布检查执行。

## 验证

- 2 项性能测试通过；测试文件静态检查零告警。
