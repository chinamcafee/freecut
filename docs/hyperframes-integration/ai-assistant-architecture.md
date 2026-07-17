# AI Assistant Architecture

Week 11 introduces the assistant foundation:

- `AIAssistantPanel` renders the conversation, input, confirmation prompt, and rollback entry points.
- `parseUserIntent` normalizes user requests into timeline actions, Studio file mutations, Skills jobs, or chat.
- `LLMService` wraps provider calls and retry behavior.
- `ContextManager` builds bounded project context for prompts.
- `ConversationHandler` coordinates messages, intent parsing, LLM responses, and action previews.
- `ActionExecutor` requires destructive actions to create a preview diff before confirmation and records rollback history.

The assistant never writes project state directly from a model response. It must
produce a planned action, preview diff, explicit confirmation, and rollback
record.
