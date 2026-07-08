import { describe, expect, it } from 'vite-plus/test'
import {
  ActionExecutor,
  ConversationHandler,
  ContextManager,
  LLMService,
  parseUserIntent,
} from './assistant-core'

describe('AI assistant core', () => {
  it('normalizes user prompts into timeline, studio, skills, and chat intents', async () => {
    await expect(parseUserIntent('move clip intro 10 frames later')).resolves.toMatchObject({
      kind: 'timeline-action',
      action: 'move-clip',
      requiresConfirmation: true,
    })
    await expect(parseUserIntent('change the headline in index.html')).resolves.toMatchObject({
      kind: 'studio-file-mutation',
      action: 'edit-file',
      requiresConfirmation: true,
    })
    await expect(parseUserIntent('run text animation skill')).resolves.toMatchObject({
      kind: 'skills-job',
      action: 'run-skill',
      requiresConfirmation: true,
    })
    await expect(parseUserIntent('what can you do?')).resolves.toMatchObject({
      kind: 'chat',
      requiresConfirmation: false,
    })
  })

  it('builds bounded project context and streams LLM responses with retry fallback', async () => {
    const context = new ContextManager({
      projectId: 'p1',
      selectedItemIds: ['clip-1'],
      activeCompositionPath: 'compositions/main.html',
      userPreferences: { language: 'en' },
    }).buildContext()

    expect(context).toContain('project:p1')
    expect(context).toContain('selection:clip-1')

    const service = new LLMService({
      provider: async () => 'assistant response',
      maxRetries: 1,
    })
    await expect(service.complete([{ id: 'm1', role: 'user', content: 'hello' }])).resolves.toBe(
      'assistant response',
    )
  })

  it('creates preview diffs for destructive actions and records rollback history after confirmation', async () => {
    const executor = new ActionExecutor()
    const preview = await executor.preview({
      kind: 'timeline-action',
      action: 'delete-clip',
      parameters: { clipId: 'clip-1' },
      requiresConfirmation: true,
    })

    expect(preview).toMatchObject({
      requiresConfirmation: true,
      diff: [{ op: 'remove', path: 'timeline.items.clip-1' }],
    })

    const result = await executor.confirm(preview.id)
    expect(result).toMatchObject({ status: 'applied', rollbackId: expect.any(String) })
    expect(executor.history()).toHaveLength(1)
    await expect(executor.rollback(result.rollbackId!)).resolves.toMatchObject({
      status: 'rolled-back',
    })
  })

  it('handles a conversation turn by appending user/assistant messages and pending action previews', async () => {
    const handler = new ConversationHandler({
      llm: new LLMService({ provider: async () => 'I prepared a safe edit plan.' }),
      executor: new ActionExecutor(),
      context: new ContextManager({ projectId: 'p1' }),
    })

    const state = await handler.send('delete clip intro')

    expect(state.messages.map((message) => message.role)).toEqual(['user', 'assistant'])
    expect(state.pendingAction?.requiresConfirmation).toBe(true)
    expect(state.messages[1]?.content).toContain('safe edit plan')
  })
})
