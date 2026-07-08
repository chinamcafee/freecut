# Natural Language Editing

Week 13 adds the natural-language editing layer on top of the Week 11 assistant
and Week 12 Skills queue:

- `NaturalLanguageEditEngine` parses add, delete, move, effect, and transition
  requests into preview diffs. Applying a preview records provenance, action
  history, user-facing feedback, and an undo handle.
- `StudioFileMutationEngine` maps conservative natural-language file edits to
  whitelisted patches with diff preview, confirmation, and rollback snapshots.
- `NaturalLanguageActionOrchestrator` coordinates Skills jobs, FreeCut AI
  context requests, and timeline action previews in a single ordered plan.
- `EffectRecommender` and `TemplateRecommender` provide explainable effect,
  transition, template, export preset, and preview suggestions.
- `BatchActionPlanner` groups broad operations into chunked execution plans for
  batch effects, parameter edits, and exports.
- `CorrectionAdvisor` detects common missing-asset and invalid-range problems,
  provides repair suggestions, and marks simple auto-fix candidates.
- `PersonalizationModel` keeps local preference weights so recommendations can
  be adjusted without sending preference history to a remote service.

All destructive edits remain preview-first. No natural-language request writes a
timeline action or Studio file mutation without an explicit confirmation path
and rollback record.
