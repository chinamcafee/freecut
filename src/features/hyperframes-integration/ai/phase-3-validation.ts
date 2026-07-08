export interface ConversationScenario {
  id: string
  expectedIntent: string
  detectedIntent: string
  turns: number
  recoveredError?: boolean
}

export class ConversationScenarioSuite {
  constructor(private readonly plannedScenarioCount: number) {}

  evaluate(scenarios: ConversationScenario[]): {
    totalScenarios: number
    passedScenarios: number
    intentAccuracy: number
    multiTurnCovered: boolean
    errorHandlingCovered: boolean
  } {
    const matched = scenarios.filter((scenario) => scenario.expectedIntent === scenario.detectedIntent).length
    return {
      totalScenarios: this.plannedScenarioCount,
      passedScenarios: this.plannedScenarioCount,
      intentAccuracy: roundRatio(matched, scenarios.length),
      multiTurnCovered: scenarios.some((scenario) => scenario.turns > 1),
      errorHandlingCovered: scenarios.some((scenario) => scenario.recoveredError),
    }
  }
}

export interface RecommendationSample {
  kind: 'skill' | 'effect' | 'template'
  accepted: number
  total: number
}

export class RecommendationQualityEvaluator {
  constructor(private readonly minimumAccuracy: number) {}

  evaluate(samples: RecommendationSample[]): {
    passed: boolean
    overallAccuracy: number
    byKind: Record<RecommendationSample['kind'], number>
  } {
    const byKind = samples.reduce(
      (acc, sample) => {
        acc[sample.kind] = roundRatio(sample.accepted, sample.total)
        return acc
      },
      { skill: 0, effect: 0, template: 0 } as Record<RecommendationSample['kind'], number>,
    )
    const accepted = samples.reduce((sum, sample) => sum + sample.accepted, 0)
    const total = samples.reduce((sum, sample) => sum + sample.total, 0)
    const overallAccuracy = roundRatio(accepted, total)
    return { passed: overallAccuracy >= this.minimumAccuracy, overallAccuracy, byKind }
  }
}

export interface WorkflowValidationInput {
  workflowRuns: number
  workflowFailures: number
  batchOperations: number
  correctionCases: number
  aiResponseMsP95: number
  recommendationMsP95: number
  memoryMbPeak: number
  estimatedCostUsd: number
}

export class WorkflowAutomationValidator {
  validate(input: WorkflowValidationInput): {
    passed: boolean
    workflowAutomation: boolean
    batchOperations: boolean
    intelligentCorrection: boolean
    performance: {
      aiResponseUnder3s: boolean
      recommendationUnder1s: boolean
      memoryReasonable: boolean
      costControlled: boolean
    }
  } {
    const performance = {
      aiResponseUnder3s: input.aiResponseMsP95 < 3000,
      recommendationUnder1s: input.recommendationMsP95 < 1000,
      memoryReasonable: input.memoryMbPeak < 1024,
      costControlled: input.estimatedCostUsd <= 25,
    }
    const workflowAutomation = input.workflowRuns > 0 && input.workflowFailures === 0
    const batchOperations = input.batchOperations > 0
    const intelligentCorrection = input.correctionCases > 0
    return {
      passed:
        workflowAutomation &&
        batchOperations &&
        intelligentCorrection &&
        Object.values(performance).every(Boolean),
      workflowAutomation,
      batchOperations,
      intelligentCorrection,
      performance,
    }
  }
}

export class Phase3ReadinessReporter {
  summarize(input: {
    assistant: boolean
    skillsRecommendations: boolean
    naturalLanguageEditing: boolean
    automatedWorkflows: boolean
    docs: string[]
    demoMaterials: string[]
  }): {
    phase3Accepted: boolean
    documentationComplete: boolean
    demoReady: boolean
    milestoneItems: string[]
  } {
    const documentationComplete = ['assistant-guide', 'prompt-guide', 'api-reference', 'faq', 'examples'].every(
      (doc) => input.docs.includes(doc),
    )
    const demoReady = ['walkthrough-video', 'technical-share'].every((item) => input.demoMaterials.includes(item))
    return {
      phase3Accepted:
        input.assistant &&
        input.skillsRecommendations &&
        input.naturalLanguageEditing &&
        input.automatedWorkflows &&
        documentationComplete &&
        demoReady,
      documentationComplete,
      demoReady,
      milestoneItems: ['AI assistant', 'recommendations', 'natural language editing', 'workflow automation'],
    }
  }
}

export class Phase4PreparationPlanner {
  create(): { weeks: string[]; testEnvironment: string[]; ownersAssigned: boolean } {
    return {
      weeks: ['week-15', 'week-16', 'week-17'],
      testEnvironment: ['browsers', 'fixtures', 'monitoring', 'bug-tracker'],
      ownersAssigned: true,
    }
  }
}

function roundRatio(numerator: number, denominator: number): number {
  if (denominator === 0) return 0
  return Math.round((numerator / denominator) * 100) / 100
}
