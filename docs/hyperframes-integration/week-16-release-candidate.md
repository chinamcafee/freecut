# Week 16 Release Candidate

Week 16 closes P0/P1 bugs, applies performance work, and prepares
`1.0.0-rc.1`.

## Bug Closure

- P0 save, crash, data-loss, and export failures require fix, verification,
  regression tests, and fix-log entries.
- P1 timeline, preview, render, AI, UI, sync, and compatibility defects require
  the same closure criteria.
- Remaining P2 issues must stay below the release threshold and be documented.

## Performance

Release targets:

- App start under 2 seconds.
- Project load under 2 seconds.
- Edit response under 100 ms.
- Preview playback above 30 fps.
- Memory under 1 GB.

The optimization report compares pre/post metrics and records improvements for
startup, project load, edit latency, playback frame rate, and memory.

## Release Candidate

The RC package includes the web build, changelog, release notes, reviewed
documentation, final end-to-end test status, stress test status, and browser
compatibility status.

## Documentation Review

User docs, developer docs, README updates, and release-blog material are part of
the RC gate. A release candidate is blocked if docs review or final validation
fails.
