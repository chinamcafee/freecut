# Converter Core Compatibility

Week 9 aligns the FreeCut bridge around a HyperFrames project directory:
`index.html`, `compositions/*.html`, manifest metadata, assets, warnings, and a
stable project signature. The converter is still a bridge, not the source of
truth for arbitrary HyperFrames-authored motion.

## Export Contract

- Timing uses the FreeCut project fps instead of a hard-coded frame rate.
- Clips include `data-start`, `data-duration`, `data-media-start`,
  `data-track-index`, and `data-composition-src` where applicable.
- Project output must include `manifest.json`, `index.html`, and the active
  composition file.
- `validateHyperFramesProjectDirectory` checks required files, unsafe inline
  script/event attributes, and returns a signature for cache invalidation.

## Unsupported Feature Warnings

The bridge records irreversible features instead of silently dropping them:
WebGPU effects, masks, corner pin, audio EQ, text motion, and custom JS. Import
flows must surface these warnings before replacing editable FreeCut state.

## Migration Notes

Legacy embedded HTML compositions are represented as manifest-backed project
directories. Existing `composition` timeline items remain the item type; the
HyperFrames source is linked through `Project.hyperframes.compositionLinks`.
