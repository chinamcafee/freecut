# T068 实现 postMessage schema 校验

## 完成内容

- 复核并闭环 preview message schema：校验 message type、source、projectId、compositionPath、frame、payload、origin 和 session nonce。
- 错误来源、错误项目、错误组合、错误 nonce 和未知消息类型全部拒绝。

## 验证

- `preview-document.test.ts` postMessage schema 核心测试通过。
