import { describe, expect, it } from 'vite-plus/test'
import { HyperFramesAuditLog } from './auditLog'

describe('HyperFramesAuditLog', () => {
  it('records operational events while redacting secrets, prompts and local paths', () => {
    const log = new HyperFramesAuditLog(10, () => 100)
    log.record({ operation: 'model-call', projectId: 'p1', status: 'succeeded', summary: 'Used Bearer secret_token_123456', details: { apiKey: 'sk_abcdefghijklmnop', prompt: 'private prompt', localPath: '/Users/name/file.mp4', model: 'local' } })
    expect(JSON.stringify(log.list())).not.toContain('private prompt')
    expect(JSON.stringify(log.list())).not.toContain('/Users/name')
    expect(log.list()[0]).toMatchObject({ operation: 'model-call', details: { apiKey: '[REDACTED]', prompt: '[REDACTED]', localPath: '[REDACTED]', model: 'local' } })
  })

  it('bounds retained events and filters by project and operation', () => {
    const log = new HyperFramesAuditLog(2, () => 100)
    log.record({ operation: 'import', projectId: 'p1', status: 'succeeded', summary: 'one' })
    log.record({ operation: 'render', projectId: 'p2', status: 'failed', summary: 'two' })
    log.record({ operation: 'render', projectId: 'p1', status: 'succeeded', summary: 'three' })
    expect(log.list()).toHaveLength(2)
    expect(log.list({ projectId: 'p1', operation: 'render' })).toHaveLength(1)
  })
})
