# Render Runtime and Phase 2 Gate

## Runtime Requirements

Producer-backed HyperFrames rendering requires a host with Node.js,
Chrome/Chromium, FFmpeg, and an available `@hyperframes/producer` build.
Browser-only mode may create dry-run render jobs, but production export must run
through a local service, desktop shell, or authenticated remote render service.

`checkRenderRuntime` reports missing dependencies with actionable guidance before
starting a render job.

## Render Job Contract

`HyperFramesRenderJobManager` tracks:

- `queued`, `rendering`, `complete`, `failed`, `cancelled`
- progress and current frame
- engine, quality, format, fps, output resolution, composition path
- output path, error details, cleanup requirements
- project signature for cache invalidation

Failed and cancelled jobs are marked for cleanup so partial Producer output does
not leak into cache state.

## Alpha Overlay

The initial alpha overlay path renders FreeCut as the base layer and
HyperFrames as an alpha-capable overlay (`webm`, `mov`, or `png-sequence`).
Final muxing uses FFmpeg overlay composition. Audio defaults to the FreeCut mix;
HyperFrames audio is only selected when the manifest explicitly enables it.

## Phase 2 Acceptance

Phase 2 is gated on these verified contracts:

- HyperFrames-backed composition remains an existing FreeCut `composition` item.
- Studio panel can edit, save, preview, and reopen project-directory files.
- Adapter can read/write files, lint, select nodes, thumbnail, waveform, install
  registry blocks, and create render jobs.
- Converter outputs project-directory HTML with manifest, warnings, hashes, and
  cache signatures.
- Preview, Producer, and final export frame checks must stay within one frame.
