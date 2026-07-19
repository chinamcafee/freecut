# HyperFrames FreeCut Bridges

Bridges expose migrated HyperFrames capabilities to FreeCut UI and orchestration code.

Planned bridge areas:

- `player-bridge`: wraps the mirrored `hyperframes-player` Web Component behind
  FreeCut-owned props, events, diagnostics, iframe resolution and preview
  document helpers.
- `studio-bridge`
- `skills-bridge`
- `render-bridge`
- `model-bridge`

FreeCut UI code should import bridge APIs instead of importing mirrored upstream source directly.
