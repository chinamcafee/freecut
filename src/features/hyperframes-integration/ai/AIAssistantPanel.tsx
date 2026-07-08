import { useState } from 'react'
import type { ActionPreview, AssistantMessage } from './assistant-core'

interface AIAssistantPanelProps {
  messages: AssistantMessage[]
  pendingAction?: ActionPreview | null
  onSend: (message: string) => void
  onConfirm?: (previewId: string) => void
  onRollback?: (rollbackId: string) => void
}

export function AIAssistantPanel({
  messages,
  pendingAction,
  onSend,
  onConfirm,
}: AIAssistantPanelProps) {
  const [input, setInput] = useState('')

  return (
    <aside className="flex h-full min-h-0 flex-col border-l border-border bg-background">
      <div className="border-b border-border px-3 py-2 text-sm font-semibold">AI Assistant</div>
      <div className="min-h-0 flex-1 space-y-2 overflow-auto p-3" aria-label="AI messages">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`rounded px-3 py-2 text-sm ${
              message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
            }`}
          >
            {message.content}
          </div>
        ))}
        {pendingAction && (
          <div className="rounded border border-amber-500/50 bg-amber-500/10 p-2 text-xs">
            <div>Preview diff pending confirmation</div>
            <button
              type="button"
              className="mt-2 rounded border px-2 py-1"
              onClick={() => onConfirm?.(pendingAction.id)}
            >
              Confirm
            </button>
          </div>
        )}
      </div>
      <form
        className="flex gap-2 border-t border-border p-2"
        onSubmit={(event) => {
          event.preventDefault()
          if (!input.trim()) return
          onSend(input)
          setInput('')
        }}
      >
        <input
          aria-label="Ask AI"
          className="min-w-0 flex-1 rounded border bg-background px-2 py-1 text-sm"
          value={input}
          onChange={(event) => setInput(event.target.value)}
        />
        <button type="submit" className="rounded border px-3 py-1 text-sm">
          Send
        </button>
      </form>
    </aside>
  )
}
