# T067 实现 HTML 安全和 iframe sandbox 策略

## 完成内容

- 复核并闭环现有 `createPreviewDocument`：srcdoc 注入 CSP、runtime allowlist、网络资源策略和最小 sandbox token。
- 默认不授予 iframe 主窗口访问能力；调试扩展必须显式传入策略。
- lint 与预览共同阻止不安全脚本、事件属性和越界资产。

## 验证

- `preview-document.test.ts` 中 CSP、runtime 白名单、sandbox 和资源策略核心测试通过。
