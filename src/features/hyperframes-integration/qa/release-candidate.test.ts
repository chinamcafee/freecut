import { describe, expect, it } from 'vite-plus/test'
import {
  BugClosureTracker,
  ChangelogBuilder,
  PerformanceOptimizationReport,
  ReleaseCandidatePackager,
  UserExperiencePolishChecklist,
} from './release-candidate'

describe('week 16 release candidate', () => {
  it('requires every P0/P1 bug to be fixed, verified, regressed, and logged', () => {
    const tracker = new BugClosureTracker()
    const closure = tracker.close([
      { id: 'save-failure', priority: 'P0', fixed: true, verified: true, regressionTest: true },
      { id: 'preview-stall', priority: 'P0', fixed: true, verified: true, regressionTest: true },
      { id: 'ai-timeout', priority: 'P1', fixed: true, verified: true, regressionTest: true },
      { id: 'edge-layout', priority: 'P1', fixed: true, verified: true, regressionTest: true },
      { id: 'minor-copy', priority: 'P2', fixed: false, verified: false, regressionTest: false },
    ])

    expect(closure).toMatchObject({
      p0Remaining: 0,
      p1Remaining: 0,
      p2Remaining: 1,
      releaseBlocking: false,
      fixLog: ['save-failure', 'preview-stall', 'ai-timeout', 'edge-layout'],
    })
  })

  it('compares performance before and after optimization against release targets', () => {
    const report = new PerformanceOptimizationReport().compare({
      before: { appStartMs: 2500, projectLoadMs: 3000, editResponseMs: 150, previewFps: 25, memoryMb: 1229 },
      after: { appStartMs: 1800, projectLoadMs: 1700, editResponseMs: 82, previewFps: 34, memoryMb: 880 },
    })

    expect(report).toMatchObject({
      passed: true,
      improvements: {
        appStartMs: 700,
        projectLoadMs: 1300,
        editResponseMs: 68,
        previewFps: 9,
        memoryMb: 349,
      },
    })
  })

  it('tracks loading, error, shortcut, interaction, caching, and lazy-load polish', () => {
    expect(new UserExperiencePolishChecklist().complete()).toMatchObject({
      loadingAnimations: true,
      errorMessages: true,
      shortcuts: true,
      interactionSmoothness: true,
      smartCache: true,
      lazyLoading: true,
    })
  })

  it('packages release candidate metadata, changelog, release notes, docs review, and build artifacts', () => {
    const changelog = new ChangelogBuilder().build([
      'P0 save/export fixes',
      'P1 preview/AI/compatibility fixes',
      'startup and project-load optimization',
    ])
    const candidate = new ReleaseCandidatePackager().package({
      version: '1.0.0-rc.1',
      changelog,
      docsReviewed: true,
      e2ePassed: true,
      compatibilityPassed: true,
      stressPassed: true,
    })

    expect(candidate).toMatchObject({
      version: '1.0.0-rc.1',
      status: 'ready',
      artifacts: ['web-build', 'release-notes', 'changelog', 'documentation'],
      releaseNotes: expect.stringContaining('1.0.0-rc.1'),
    })
  })
})
