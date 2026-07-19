export type HyperFramesAuditOperation =
  | 'model-call'
  | 'file-write'
  | 'import'
  | 'render'
  | 'export'
  | 'rollback'

export interface HyperFramesAuditEvent {
  id: string
  at: number
  operation: HyperFramesAuditOperation
  projectId?: string
  jobId?: string
  actor?: string
  status: 'started' | 'succeeded' | 'failed' | 'cancelled'
  summary: string
  details: Record<string, unknown>
}

export class HyperFramesAuditLog {
  private readonly events: HyperFramesAuditEvent[] = []
  private sequence = 0

  constructor(private readonly maxEvents = 1000, private readonly now: () => number = Date.now) {}

  record(input: Omit<HyperFramesAuditEvent, 'id' | 'at' | 'details'> & { details?: Record<string, unknown> }): HyperFramesAuditEvent {
    const at = this.now()
    const event: HyperFramesAuditEvent = {
      ...input,
      id: `hf-audit-${at}-${++this.sequence}`,
      at,
      summary: redactText(input.summary),
      details: redactValue(input.details ?? {}) as Record<string, unknown>,
    }
    this.events.push(event)
    if (this.events.length > this.maxEvents) this.events.splice(0, this.events.length - this.maxEvents)
    return structuredClone(event)
  }

  list(filter: { projectId?: string; operation?: HyperFramesAuditOperation } = {}): HyperFramesAuditEvent[] {
    return this.events
      .filter((event) => !filter.projectId || event.projectId === filter.projectId)
      .filter((event) => !filter.operation || event.operation === filter.operation)
      .map((event) => structuredClone(event))
  }

  clear(): void { this.events.length = 0 }
}

const sensitiveKey = /(?:api[-_]?key|authorization|credential|password|secret|token|prompt|localPath)/i

function redactValue(value: unknown, key = ''): unknown {
  if (sensitiveKey.test(key)) return '[REDACTED]'
  if (typeof value === 'string') return redactText(value)
  if (Array.isArray(value)) return value.map((entry) => redactValue(entry))
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([entryKey, entry]) => [entryKey, redactValue(entry, entryKey)]))
  }
  return value
}

function redactText(value: string): string {
  return value
    .replace(/Bearer\s+[A-Za-z0-9._~+/-]+/gi, 'Bearer [REDACTED]')
    .replace(/\b(?:sk|hf)_[A-Za-z0-9_-]{12,}\b/g, '[REDACTED]')
}
