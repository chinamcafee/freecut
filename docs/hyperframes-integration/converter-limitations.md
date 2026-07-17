# HyperFrames Converter Limitations

> **Version**: v2.0
> **Last updated**: 2026-07-07
> **Code scope**: Phase 1 / Weeks 03-05

## Summary

Phase 1 proves the data model, storage, export, import, and validation path for
manifest-backed HyperFrames project directories. It does not claim lossless
interoperability between arbitrary HyperFrames HTML and editable FreeCut
timeline data.

The source-linked `composition` item and `compositionLinks` map are the safety
mechanism: unsupported reverse mappings keep the HyperFrames project directory
canonical.

## Current Limitations

### Arbitrary Scripts

Only the controlled `#hf-keyframes` JSON script is parsed. Other scripts remain
part of the HyperFrames source directory and are not converted into FreeCut
timeline behavior.

If the controlled keyframe payload is malformed, the importer records:

- `unsupportedFeatures`: `keyframes-parse-error`
- warning: `Unable to parse controlled HyperFrames keyframes; source project directory remains canonical`

### CSS And Layout Semantics

The importer supports a narrow CSS subset:

- `translate(x, y)`
- `opacity`
- text font size, family, and color

Complex transforms, CSS animations, filters, masks, layout-dependent sizing, and
custom CSS rules remain canonical in the HyperFrames directory.

### Shape Mapping

Shape import uses a rectangle fallback and records `shape-reverse-mapping`.
Exact SVG paths, rounded corners, gradients, and shape-specific controls are not
reconstructed in Phase 1.

### Audio Processing

Basic media references and volume are exported. Advanced FreeCut audio EQ is
recorded as `audio-eq` because HyperFrames Phase 1 has no equivalent editable
audio processing model.

### Parser Depth

The importer currently uses browser `DOMParser` and controlled `data-*`
attributes. Full `@hyperframes/core` parser/linter integration is deferred until
Phase 2 when Studio and Producer integration are wired in.

### Asset Availability

The manifest records asset refs and hashes, but Phase 1 does not copy binary
files or verify codec compatibility. Browser playback compatibility remains the
responsibility of the later Studio/Producer integration layer.

## Performance Budgets

Week 05 establishes repeatable converter budgets in
`phase-1-validation.test.ts`:

| Scenario | Budget |
| --- | --- |
| Simple project round-trip | `< 1s` |
| 180-item complex project round-trip | `< 5s` |

These budgets cover conversion only. They do not include media decoding, binary
asset copy, preview rendering, or export rendering.

## Data Integrity Model

Phase 1 import creates two representations:

1. Editable approximations for supported items
2. A source-linked HyperFrames composition that points back to the canonical
   manifest and active composition path

When the two disagree, the HyperFrames project directory is authoritative for
HyperFrames rendering.

## Phase 2 Follow-Up

- Replace DOM-only parsing with HyperFrames parser/linter where available
- Add Studio UI entry points for HyperFrames-backed composition items
- Add Producer render path and alpha overlay integration
- Add binary asset copy/validation and cache invalidation
- Expand reverse mapping for CSS transforms, SVG, filters, and nested
  compositions
- Convert warnings into user-visible diagnostics
