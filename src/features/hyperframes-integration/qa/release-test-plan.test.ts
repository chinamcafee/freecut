import { describe, expect, it } from 'vite-plus/test'
import {
  BrowserCompatibilityMatrix,
  BugTriagePlanner,
  FunctionalRegressionPlan,
  PerformanceBaselinePlan,
  TestEnvironmentReadiness,
} from './release-test-plan'

describe('week 15 release test plan', () => {
  it('builds a full functional regression plan for FreeCut, HyperFrames, AI, render, and import/export', () => {
    const plan = new FunctionalRegressionPlan().create()

    expect(plan.sections.map((section) => section.id)).toEqual([
      'timeline-editing',
      'effects-transitions',
      'keyframes-animation',
      'hyperframes-compositions',
      'hyperframes-studio',
      'skills-system',
      'ai-assistant',
      'render-pipeline',
      'import-export',
    ])
    expect(plan.coverage).toMatchObject({
      freecutCore: 1,
      hyperframesIntegration: 1,
      aiFeatures: 0.95,
      boundaryCasesIncluded: true,
    })
  })

  it('captures supported browser matrix and compatibility issue tracking', () => {
    const matrix = new BrowserCompatibilityMatrix().create()

    expect(matrix.browsers).toEqual([
      { name: 'Chrome', minimumVersion: 113, status: 'full' },
      { name: 'Edge', minimumVersion: 113, status: 'full' },
      { name: 'Brave', minimumVersion: 113, status: 'with-flags' },
    ])
    expect(matrix.issueWorkflow).toEqual(['record', 'classify', 'assign', 'verify'])
  })

  it('defines performance baselines, fixtures, tools, and test data sets', () => {
    const baselines = new PerformanceBaselinePlan().create()
    const environment = new TestEnvironmentReadiness().create()

    expect(baselines.targets).toMatchObject({
      projectLoadMs: 2000,
      editResponseMs: 100,
      previewFps: 30,
      memoryMb: 1024,
    })
    expect(environment).toMatchObject({
      browsersReady: true,
      tools: ['automated-test-runner', 'performance-profiler', 'bug-tracker'],
      dataSets: ['small-nle-project', 'mixed-hyperframes-project', 'ai-workflow-project'],
    })
  })

  it('triages bugs into priorities and prepares the week 16 fix plan', () => {
    const triage = new BugTriagePlanner().create([
      { id: 'save-crash', area: 'save', severity: 'P0' },
      { id: 'edge-preview-flicker', area: 'compatibility', severity: 'P1' },
      { id: 'copy-text-overflow', area: 'ui', severity: 'P2' },
    ])

    expect(triage).toMatchObject({
      p0: ['save-crash'],
      p1: ['edge-preview-flicker'],
      p2: ['copy-text-overflow'],
      week16Focus: ['save-crash', 'edge-preview-flicker'],
      reports: ['functional-test-report', 'compatibility-test-report', 'performance-test-report'],
    })
  })
})
