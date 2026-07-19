# HyperFrames FreeCut Adapters

Adapters translate FreeCut project, storage, preview, render, model, and security services into the interfaces needed by migrated HyperFrames source.

Rules:

- Adapters may depend on FreeCut services.
- Migrated upstream source must call adapters instead of mutating FreeCut state directly.
- File writes must go through project repository and safety guards.
