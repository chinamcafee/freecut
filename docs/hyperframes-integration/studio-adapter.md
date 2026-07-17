# HyperFrames Studio Adapter

## Runtime

Week 8 ships a host-neutral `StudioApiAdapter` contract. The current FreeCut
integration uses an in-process browser-safe adapter for project-directory smoke
tests, while preserving the same method shape for a Vite middleware, desktop
shell, or remote Node service.

Full Studio capabilities that require Chrome/Chromium, FFmpeg, symlink checks,
or native filesystem permissions must run in a local service, Electron/Tauri
shell, or authenticated remote service. Browser-only mode supports file tree,
source editing, preview bundling, lint diagnostics, selection state, thumbnail
metadata, waveform metadata, registry smoke installs, and dry-run render jobs.

## API Coverage

- Projects: `listProjects`, `resolveProject`
- Files: `readFile`, `writeFile`, `createFile`, `deleteFile`, `patchFile`
- Preview: `bundle`
- Safety: `safeProjectPath`, inline script and event-handler lint checks
- Selection: `getSelection`, `putSelection`
- Assets: `thumbnail`, `waveform`
- Registry: `listBlocks`, `installBlock`
- Render: `startRender` dry-run job state

## Security Constraints

All project file operations must pass `safeProjectPath`. Absolute paths,
backslash paths, repeated slash paths, and `..` escapes outside the project root
are rejected. Native hosts must add realpath and symlink escape checks before
mounting the same contract over a real filesystem.

Remote hosts must authenticate every route, bind local services to loopback by
default, and treat project IDs as opaque IDs rather than filesystem paths.
