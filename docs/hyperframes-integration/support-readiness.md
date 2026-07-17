# Support Readiness

## Troubleshooting

- Confirm browser support first: Chrome 113+, Edge 113+, or Brave 113+ with
  required flags.
- Collect project type, media details, HyperFrames composition path, Skills job
  id, AI provenance id, and render/export settings.
- For destructive AI actions, verify the preview diff, confirmation record, and
  rollback id before triage.

## Response Templates

- Bug accepted: acknowledge reproduction details, assign priority, and link the
  tracking issue.
- Needs information: request browser version, project fixture, logs, and exact
  steps.
- Workaround available: provide the workaround, affected versions, and planned
  fix target.

## Triage Flow

1. Classify area and severity.
2. Reproduce with a saved fixture when possible.
3. Assign owner and milestone.
4. Verify fix with regression coverage.
5. Close with release note or known-issue update.
