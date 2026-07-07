# HyperFrames Converter API

> **Version**: v2.0
> **Last updated**: 2026-07-07
> **Code scope**: Phase 1 / Weeks 03-05

## Overview

The Phase 1 converter API moves FreeCut data into a manifest-backed HyperFrames
project directory and imports that directory back into a FreeCut project.

The project directory is the canonical HyperFrames artifact. The legacy
`composition` value returned by the exporter is kept only as a compatibility
preview bridge for older call sites.

## Export API

```ts
import { FreeCutToHyperFramesConverter } from '@/features/hyperframes-integration/converters'

const result = new FreeCutToHyperFramesConverter({
  includeAudio: true,
  includeAnimations: true,
  assetPathStrategy: 'relative',
}).convert(project)
```

### FreeCutToHyperFramesConverter

```ts
class FreeCutToHyperFramesConverter {
  constructor(options?: FreeCutConverterOptions)
  convert(project: Project): ConversionResult
}
```

### FreeCutConverterOptions

```ts
interface FreeCutConverterOptions {
  includeAudio?: boolean
  includeAnimations?: boolean
  assetPathStrategy?: 'relative' | 'absolute' | 'cdn'
  formatHtml?: boolean
  includeSourceMap?: boolean
}
```

### ConversionResult

```ts
interface ConversionResult {
  composition: HyperFramesComposition
  projectDirectory: HyperFramesProjectDirectory
  warnings: string[]
  unsupportedFeatures: string[]
}
```

`projectDirectory` contains:

- `manifest`: `HyperFramesProjectManifest`
- `files['manifest.json']`
- `files['index.html']`
- `files['compositions/main.html']`
- `fileIndex`: hash-indexed generated files
- `assets`: asset references with project paths and hashes

## Import API

```ts
import { HyperFramesToFreeCutConverter } from '@/features/hyperframes-integration/converters'

const imported = new HyperFramesToFreeCutConverter().convert(projectDirectory)
```

### HyperFramesToFreeCutConverter

```ts
class HyperFramesToFreeCutConverter {
  convert(projectDirectory: HyperFramesProjectDirectory): HyperFramesImportResult
}
```

### HyperFramesImportResult

```ts
interface HyperFramesImportResult {
  project: Project
  warnings: string[]
  unsupportedFeatures: string[]
}
```

The importer creates editable FreeCut approximations for supported
`[data-hf-item]` nodes and always adds one source-linked `composition` item. The
source-linked item points to `project.hyperframes.projects` and
`project.hyperframes.compositionLinks`, so the HyperFrames project directory
remains canonical even when only part of the HTML can be mapped back.

## Storage API

Phase 1 stores HyperFrames directories through `HyperFramesProjectStorage` in
`src/features/hyperframes-integration/storage/composition-storage.ts`.

Available adapters:

- `InMemoryHyperFramesFileSystemAdapter` for tests
- `OpfsHyperFramesFileSystemAdapter` for browser OPFS persistence
- `DirectoryHandleHyperFramesFileSystemAdapter` for directory handles

The exported `compositionStorage` name is retained as a compatibility alias for
the new project-directory storage.

## Errors And Warnings

The exporter throws when the FreeCut project has no timeline. It records
lossy-but-recoverable cases, such as audio EQ, in `warnings` and
`unsupportedFeatures`.

The importer throws when the active composition file declared by the manifest is
missing. It records unsupported or unsafe reverse mappings while preserving the
source-linked composition.

Current warning examples:

- `audio-eq`
- `shape-reverse-mapping`
- `keyframes-parse-error`
- `unknown-node:<type>`

## Validation

Relevant tests:

- `src/shared/projects/migrations/index.test.ts`
- `src/features/hyperframes-integration/storage/composition-storage.test.ts`
- `src/features/hyperframes-integration/converters/__tests__/project-directory-export.test.ts`
- `src/features/hyperframes-integration/converters/__tests__/project-directory-import.test.ts`
- `src/features/hyperframes-integration/converters/__tests__/phase-1-validation.test.ts`

Run:

```bash
npm run test:run -- src/shared/projects/migrations/index.test.ts src/features/hyperframes-integration/storage/composition-storage.test.ts src/features/hyperframes-integration/converters/__tests__/project-directory-export.test.ts src/features/hyperframes-integration/converters/__tests__/project-directory-import.test.ts src/features/hyperframes-integration/converters/__tests__/phase-1-validation.test.ts
npm run check
npm run build
```
