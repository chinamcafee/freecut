export interface HyperFramesRetentionPolicy {
  temporaryProjectMaxAgeMs: number
  thumbnailMaxAgeMs: number
  failedJobMaxAgeMs: number
  modelLogMaxAgeMs: number
}

export interface HyperFramesRetentionCandidate {
  id: string
  kind: 'temporary-project' | 'thumbnail' | 'failed-job' | 'model-log'
  projectId?: string
  updatedAt: number
}

export interface HyperFramesCleanupPlan {
  removable: HyperFramesRetentionCandidate[]
  protected: HyperFramesRetentionCandidate[]
}

export function createHyperFramesCleanupPlan(input: {
  candidates: HyperFramesRetentionCandidate[]
  referencedProjectIds: Iterable<string>
  now: number
  policy: HyperFramesRetentionPolicy
}): HyperFramesCleanupPlan {
  const referenced = new Set(input.referencedProjectIds)
  const removable: HyperFramesRetentionCandidate[] = []
  const protectedItems: HyperFramesRetentionCandidate[] = []
  for (const candidate of input.candidates) {
    if (candidate.projectId && referenced.has(candidate.projectId)) {
      protectedItems.push(candidate)
      continue
    }
    const maxAge = maxAgeFor(candidate.kind, input.policy)
    ;(input.now - candidate.updatedAt >= maxAge ? removable : protectedItems).push(candidate)
  }
  return { removable, protected: protectedItems }
}

export async function executeHyperFramesCleanupPlan(
  plan: HyperFramesCleanupPlan,
  remove: (candidate: HyperFramesRetentionCandidate) => Promise<void>,
): Promise<{ removed: string[]; failed: Array<{ id: string; error: string }> }> {
  const removed: string[] = []
  const failed: Array<{ id: string; error: string }> = []
  for (const candidate of plan.removable) {
    try { await remove(candidate); removed.push(candidate.id) }
    catch (error) { failed.push({ id: candidate.id, error: error instanceof Error ? error.message : String(error) }) }
  }
  return { removed, failed }
}

function maxAgeFor(kind: HyperFramesRetentionCandidate['kind'], policy: HyperFramesRetentionPolicy): number {
  if (kind === 'temporary-project') return policy.temporaryProjectMaxAgeMs
  if (kind === 'thumbnail') return policy.thumbnailMaxAgeMs
  if (kind === 'failed-job') return policy.failedJobMaxAgeMs
  return policy.modelLogMaxAgeMs
}
