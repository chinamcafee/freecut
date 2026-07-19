import { describe, expect, it, vi } from 'vite-plus/test'
import { createHyperFramesCleanupPlan, executeHyperFramesCleanupPlan } from './retentionPolicy'

describe('HyperFrames retention policy', () => {
  it('never removes a project still referenced by the timeline', async () => {
    const plan = createHyperFramesCleanupPlan({
      now: 1000, referencedProjectIds: ['referenced'],
      policy: { temporaryProjectMaxAgeMs: 100, thumbnailMaxAgeMs: 100, failedJobMaxAgeMs: 100, modelLogMaxAgeMs: 100 },
      candidates: [
        { id: 'keep', kind: 'temporary-project', projectId: 'referenced', updatedAt: 0 },
        { id: 'remove', kind: 'temporary-project', projectId: 'orphan', updatedAt: 0 },
        { id: 'recent', kind: 'failed-job', updatedAt: 950 },
      ],
    })
    expect(plan.removable.map((item) => item.id)).toEqual(['remove'])
    expect(plan.protected.map((item) => item.id)).toEqual(['keep', 'recent'])
    const remove = vi.fn().mockResolvedValue(undefined)
    await expect(executeHyperFramesCleanupPlan(plan, remove)).resolves.toEqual({ removed: ['remove'], failed: [] })
  })
})
