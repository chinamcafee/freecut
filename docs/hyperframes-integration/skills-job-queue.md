# Skills Job Queue and Safe Import

Week 12 adds production constraints around HyperFrames Skills:

- `HyperFramesSkillsJobRunner` owns job state, logs, retries, cancellation,
  timeout, and cleanup markers.
- `SafeSkillsImporter` isolates generated output, lints HTML, records asset and
  output hashes, creates provenance, and requires user confirmation before
  writing a composition link.
- `SkillRecommender` scores skills from intent text and can only enqueue jobs;
  it cannot bypass safe import.
- `WorkflowExecutor` runs dependency-ordered skill workflows and stops when a
  dependency is unmet.

All imported Skills output must be previewed, confirmed, and made rollbackable.
