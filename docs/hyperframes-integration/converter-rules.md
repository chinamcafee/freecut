# HyperFrames Converter Rules

> **Version**: v2.0
> **Last updated**: 2026-07-07
> **Code scope**: Phase 1 / Weeks 03-05

## Canonical Artifact

Phase 1 treats a HyperFrames project directory as the canonical exchange format.

Generated directory shape:

```text
hyperframes/<project-id>/
  manifest.json
  index.html
  compositions/main.html
  assets/<media files referenced by manifest>
```

`manifest.json` records the entry file, active composition path, timing,
dimensions, asset references, provenance hashes, warnings, and unsupported
features.

`index.html` is only the entry wrapper. `compositions/main.html` carries the
timeline-derived HTML and controlled keyframe payload.

## FreeCut To HyperFrames

### Project Metadata

| FreeCut field | HyperFrames field | Rule |
| --- | --- | --- |
| `project.id` | `manifest.id` | Prefixed as `freecut-<id>` |
| `project.name` | `manifest.name` | Direct mapping |
| `metadata.width` | `manifest.width` | Direct mapping |
| `metadata.height` | `manifest.height` | Direct mapping |
| `metadata.fps` | `manifest.fps` | Stored as `{ num, den }` |
| `duration` | `manifest.durationInFrames` | Stored in frames |
| `metadata.backgroundColor` | `manifest.backgroundColor` | Direct mapping |

### Timeline Items

Each supported FreeCut item becomes a DOM node with `data-hf-item`.

| FreeCut item | HyperFrames node | Required attributes |
| --- | --- | --- |
| `text` | `<div>` | `data-hf-type="text"` |
| `video` | `<video>` | `data-hf-type="video"`, `src` |
| `audio` | `<audio>` | `data-hf-type="audio"`, `src` |
| `image` | `<img>` | `data-hf-type="image"`, `src` |
| `shape` | `<div>` | `data-hf-type="shape"` |
| `composition` | `<div>` | `data-hf-type="composition"`, `data-composition-src` |

Common attributes:

- `id`
- `data-start`: `item.from / fps`
- `data-duration`: `item.durationInFrames / fps`
- `data-track-index`: timeline track order index

### Styling

The exporter writes directly supported transform fields as inline CSS:

- `transform.x` and `transform.y` → `translate(<x>px, <y>px)`
- `transform.opacity` → `opacity`
- text `fontSize`, `fontFamily`, and `color` → CSS text styles

Unsupported styling stays in the canonical source and must be recorded as a
warning if it is known to be lossy.

### Keyframes

FreeCut keyframes are serialized into a controlled script tag:

```html
<script id="hf-keyframes" type="application/json">[...]</script>
```

Only this JSON payload is considered reversible in Phase 1. Arbitrary scripts
are not parsed back into FreeCut keyframes.

### Assets

Asset references are listed in the manifest and directory asset index.

Default mapping:

```text
/media/launch.mp4 -> assets/launch.mp4
```

Every asset ref includes a stable hash so storage and future cache layers can
detect changed files.

## HyperFrames To FreeCut

### Import Strategy

The importer reads the manifest active composition path and parses supported
`[data-hf-item]` nodes into editable FreeCut approximations.

It also creates a source-linked composition item:

```ts
{
  type: 'composition',
  sourceKind: 'hyperframes',
  hyperframesProjectId: manifest.id,
  activeCompositionPath: manifest.activeCompositionPath,
  hyperframesManifestPath: `${manifest.projectDir}/manifest.json`
}
```

The project stores the source link in:

- `project.hyperframes.projects[manifest.id]`
- `project.hyperframes.compositionLinks[timelineItemId]`

This preserves the HyperFrames source even when reverse mapping is incomplete.

### Reverse Mapping

| HyperFrames node | FreeCut item | Notes |
| --- | --- | --- |
| `data-hf-type="text"` | `text` | Restores text, font size, family, color, transform |
| `data-hf-type="video"` | `video` | Restores `src`, timing, transform |
| `data-hf-type="audio"` | `audio` | Restores `src`, timing, transform |
| `data-hf-type="image"` | `image` | Restores `src`, timing, transform |
| `data-hf-type="shape"` | `shape` | Coarse rectangle fallback; records `shape-reverse-mapping` |
| `data-hf-type="composition"` | `composition` | Restores nested source path if present |

Unknown node types are skipped and recorded as `unknown-node:<type>`.

### Track Reconstruction

`data-track-index` groups imported items into FreeCut tracks. The importer adds
one extra track for the source-linked HyperFrames composition item.

### Time Conversion

Import uses `manifest.fps.num / manifest.fps.den`.

```text
data-start seconds * fps -> item.from frames
data-duration seconds * fps -> item.durationInFrames frames
```

## Non-Goals For Phase 1

- Parsing arbitrary JavaScript into FreeCut keyframes
- Full semantic reconstruction of CSS, SVG, or canvas effects
- WebGPU/Producer render integration
- Studio UI integration
- Lossless round-trip for every FreeCut feature
