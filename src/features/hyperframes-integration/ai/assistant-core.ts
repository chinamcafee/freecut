export type AssistantIntentKind = 'timeline-action' | 'studio-file-mutation' | 'skills-job' | 'chat'

export interface AssistantIntent {
  kind: AssistantIntentKind
  action: string
  parameters: Record<string, unknown>
  requiresConfirmation: boolean
}

export interface AssistantMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface ActionPreview {
  id: string
  intent: AssistantIntent
  requiresConfirmation: boolean
  diff: Array<{ op: 'add' | 'remove' | 'replace'; path: string; value?: unknown }>
}

export interface ActionResult {
  status: 'applied' | 'rolled-back'
  rollbackId?: string
}

export async function parseUserIntent(input: string): Promise<AssistantIntent> {
  const text = input.toLowerCase()
  if (/(move|trim|delete|remove|split|add clip|timeline|effect|transition)/.test(text)) {
    return {
      kind: 'timeline-action',
      action: text.includes('delete') || text.includes('remove') ? 'delete-clip' : 'move-clip',
      parameters: extractParameters(text),
      requiresConfirmation: true,
    }
  }
  if (/(index\.html|composition|headline|style|css|file|studio)/.test(text)) {
    return {
      kind: 'studio-file-mutation',
      action: 'edit-file',
      parameters: extractParameters(text),
      requiresConfirmation: true,
    }
  }
  if (/(skill|animate|generate|workflow)/.test(text)) {
    return {
      kind: 'skills-job',
      action: 'run-skill',
      parameters: extractParameters(text),
      requiresConfirmation: true,
    }
  }
  return {
    kind: 'chat',
    action: 'answer',
    parameters: {},
    requiresConfirmation: false,
  }
}

export class ContextManager {
  constructor(
    private readonly params: {
      projectId: string
      selectedItemIds?: string[]
      activeCompositionPath?: string
      userPreferences?: Record<string, unknown>
    },
  ) {}

  buildContext(): string {
    return [
      `project:${this.params.projectId}`,
      `selection:${this.params.selectedItemIds?.join(',') ?? ''}`,
      `activeComposition:${this.params.activeCompositionPath ?? ''}`,
      `preferences:${JSON.stringify(this.params.userPreferences ?? {})}`,
    ].join('\n')
  }
}

export class LLMService {
  constructor(
    private readonly params: {
      provider: (messages: AssistantMessage[]) => Promise<string>
      maxRetries?: number
    },
  ) {}

  async complete(messages: AssistantMessage[]): Promise<string> {
    const attempts = (this.params.maxRetries ?? 0) + 1
    let lastError: unknown
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        return await this.params.provider(messages)
      } catch (error) {
        lastError = error
      }
    }
    throw lastError
  }
}

export class ActionExecutor {
  private previews = new Map<string, ActionPreview>()
  private rollbackHistory: Array<{ rollbackId: string; preview: ActionPreview }> = []
  private nextId = 1

  async preview(intent: AssistantIntent): Promise<ActionPreview> {
    const preview: ActionPreview = {
      id: `preview-${this.nextId}`,
      intent,
      requiresConfirmation: intent.requiresConfirmation,
      diff: buildDiff(intent),
    }
    this.nextId += 1
    this.previews.set(preview.id, preview)
    return preview
  }

  async confirm(previewId: string): Promise<ActionResult> {
    const preview = this.previews.get(previewId)
    if (!preview) throw new Error(`Missing action preview: ${previewId}`)
    const rollbackId = `rollback-${this.rollbackHistory.length + 1}`
    this.rollbackHistory.push({ rollbackId, preview })
    this.previews.delete(previewId)
    return { status: 'applied', rollbackId }
  }

  async rollback(rollbackId: string): Promise<ActionResult> {
    const index = this.rollbackHistory.findIndex((entry) => entry.rollbackId === rollbackId)
    if (index < 0) throw new Error(`Missing rollback entry: ${rollbackId}`)
    this.rollbackHistory.splice(index, 1)
    return { status: 'rolled-back' }
  }

  history(): Array<{ rollbackId: string; preview: ActionPreview }> {
    return [...this.rollbackHistory]
  }
}

export class ConversationHandler {
  private messages: AssistantMessage[] = []
  private pendingAction: ActionPreview | null = null

  constructor(
    private readonly params: {
      llm: LLMService
      executor: ActionExecutor
      context: ContextManager
    },
  ) {}

  async send(content: string): Promise<{ messages: AssistantMessage[]; pendingAction: ActionPreview | null }> {
    const userMessage = createMessage('user', content)
    this.messages.push(userMessage)
    const intent = await parseUserIntent(content)
    this.pendingAction = intent.requiresConfirmation ? await this.params.executor.preview(intent) : null
    const assistantContent = await this.params.llm.complete([
      createMessage('system', this.params.context.buildContext()),
      ...this.messages,
    ])
    this.messages.push(createMessage('assistant', assistantContent))
    return { messages: [...this.messages], pendingAction: this.pendingAction }
  }
}

function buildDiff(intent: AssistantIntent): ActionPreview['diff'] {
  if (intent.kind === 'timeline-action' && intent.action === 'delete-clip') {
    return [{ op: 'remove', path: `timeline.items.${intent.parameters.clipId ?? 'clip-1'}` }]
  }
  if (intent.kind === 'studio-file-mutation') {
    return [{ op: 'replace', path: 'hyperframes.files.active', value: intent.parameters }]
  }
  if (intent.kind === 'skills-job') {
    return [{ op: 'add', path: 'skills.jobs.pending', value: intent.parameters }]
  }
  return []
}

function extractParameters(text: string): Record<string, unknown> {
  const clipMatch = text.match(/clip\s+([a-z0-9_-]+)/)
  return clipMatch ? { clipId: clipMatch[1] } : {}
}

function createMessage(role: AssistantMessage['role'], content: string): AssistantMessage {
  return {
    id: `${role}-${Math.random().toString(36).slice(2)}`,
    role,
    content,
  }
}
