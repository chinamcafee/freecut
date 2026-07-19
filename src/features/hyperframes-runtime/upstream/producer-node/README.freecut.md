# FreeCut producer-node source snapshot

This directory is synchronized from `hyperframes/packages/producer/src` for the FreeCut local
render service. It is Node-only source and is intentionally excluded from the FreeCut browser
TypeScript, lint, formatting and Vite module graphs.

Browser code must communicate with Producer through `HyperFramesRenderService`; it must never
import files in this directory. Run `npm run check:hyperframes-producer-boundary` to enforce the
boundary. Refresh the snapshot with:

```sh
npm run hyperframes:sync-upstream -- --package producer-node --runtime-only --write
```
