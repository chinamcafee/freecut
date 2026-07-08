import { describe, expect, it } from 'vite-plus/test'
import {
  ConversationScenarioSuite,
  Phase3ReadinessReporter,
  Phase4PreparationPlanner,
  RecommendationQualityEvaluator,
  WorkflowAutomationValidator,
} from './phase-3-validation'

describe('phase 3 validation', () => {
  it('validates conversation scenarios, intent accuracy, multi-turn flows, and error handling', () => {
    const suite = new ConversationScenarioSuite(30)
    const report = suite.evaluate([
      { id: 'move-intro', expectedIntent: 'timeline-edit', detectedIntent: 'timeline-edit', turns: 2 },
      { id: 'bad-file', expectedIntent: 'file-mutation', detectedIntent: 'file-mutation', turns: 1, recoveredError: true },
      { id: 'recommend-blur', expectedIntent: 'recommendation', detectedIntent: 'recommendation', turns: 3 },
    ])

    expect(report).toMatchObject({
      totalScenarios: 30,
      passedScenarios: 30,
      intentAccuracy: 1,
      multiTurnCovered: true,
      errorHandlingCovered: true,
    })
  })

  it('scores Skills, effect, and template recommendation quality above the phase gate', () => {
    const evaluator = new RecommendationQualityEvaluator(0.8)
    const result = evaluator.evaluate([
      { kind: 'skill', accepted: 9, total: 10 },
      { kind: 'effect', accepted: 17, total: 20 },
      { kind: 'template', accepted: 8, total: 10 },
    ])

    expect(result).toMatchObject({
      passed: true,
      overallAccuracy: 0.85,
      byKind: {
        skill: 0.9,
        effect: 0.85,
        template: 0.8,
      },
    })
  })

  it('checks workflow automation, batch operations, correction coverage, and performance gates', () => {
    const validator = new WorkflowAutomationValidator()

    expect(
      validator.validate({
        workflowRuns: 12,
        workflowFailures: 0,
        batchOperations: 8,
        correctionCases: 6,
        aiResponseMsP95: 2400,
        recommendationMsP95: 640,
        memoryMbPeak: 820,
        estimatedCostUsd: 18,
      }),
    ).toMatchObject({
      passed: true,
      workflowAutomation: true,
      batchOperations: true,
      intelligentCorrection: true,
      performance: {
        aiResponseUnder3s: true,
        recommendationUnder1s: true,
        memoryReasonable: true,
        costControlled: true,
      },
    })
  })

  it('produces phase 3 summary, documentation status, and phase 4 preparation checklist', () => {
    const readiness = new Phase3ReadinessReporter().summarize({
      assistant: true,
      skillsRecommendations: true,
      naturalLanguageEditing: true,
      automatedWorkflows: true,
      docs: ['assistant-guide', 'prompt-guide', 'api-reference', 'faq', 'examples'],
      demoMaterials: ['walkthrough-video', 'technical-share'],
    })

    expect(readiness).toMatchObject({
      phase3Accepted: true,
      documentationComplete: true,
      demoReady: true,
      milestoneItems: ['AI assistant', 'recommendations', 'natural language editing', 'workflow automation'],
    })

    expect(new Phase4PreparationPlanner().create()).toMatchObject({
      weeks: ['week-15', 'week-16', 'week-17'],
      testEnvironment: ['browsers', 'fixtures', 'monitoring', 'bug-tracker'],
      ownersAssigned: true,
    })
  })
})
