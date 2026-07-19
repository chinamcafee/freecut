import type { ModelProfile, ModelUnitCost } from '@/types/hyperframes'

export interface ModelUsageEstimate {
  inputTokens?: number
  outputTokens?: number
  cachedInputTokens?: number
  images?: number
  audioMinutes?: number
  videoSeconds?: number
  requests?: number
}

export interface ModelCostLineItem {
  unit: keyof ModelUnitCost
  quantity: number
  unitCost: number
  cost: number
}

export interface ModelCostEstimate {
  profileId: string
  modelId: string
  currency?: string
  estimatedCost?: number
  lineItems: ModelCostLineItem[]
  unknownPricing: Array<keyof ModelUnitCost>
}

function addLineItem(
  lineItems: ModelCostLineItem[],
  unknownPricing: Array<keyof ModelUnitCost>,
  unit: keyof ModelUnitCost,
  quantity: number | undefined,
  unitCost: number | undefined,
) {
  if (!quantity || quantity <= 0) return
  if (unitCost === undefined) {
    unknownPricing.push(unit)
    return
  }
  lineItems.push({
    unit,
    quantity,
    unitCost,
    cost: quantity * unitCost,
  })
}

export function estimateModelCost(
  profile: ModelProfile,
  modelId: string,
  usage: ModelUsageEstimate,
): ModelCostEstimate {
  const model = profile.models.find((item) => item.id === modelId)
  const cost = model?.cost
  const lineItems: ModelCostLineItem[] = []
  const unknownPricing: Array<keyof ModelUnitCost> = []

  addLineItem(lineItems, unknownPricing, 'inputToken', usage.inputTokens, cost?.inputToken)
  addLineItem(
    lineItems,
    unknownPricing,
    'cachedInputToken',
    usage.cachedInputTokens,
    cost?.cachedInputToken,
  )
  addLineItem(lineItems, unknownPricing, 'outputToken', usage.outputTokens, cost?.outputToken)
  addLineItem(lineItems, unknownPricing, 'image', usage.images, cost?.image)
  addLineItem(lineItems, unknownPricing, 'audioMinute', usage.audioMinutes, cost?.audioMinute)
  addLineItem(lineItems, unknownPricing, 'videoSecond', usage.videoSeconds, cost?.videoSecond)
  addLineItem(lineItems, unknownPricing, 'request', usage.requests, cost?.request)

  return {
    profileId: profile.id,
    modelId,
    currency: cost?.currency,
    estimatedCost: lineItems.length
      ? lineItems.reduce((sum, item) => sum + item.cost, 0)
      : undefined,
    lineItems,
    unknownPricing,
  }
}

export interface BudgetPolicy {
  currency?: string
  maxCostPerTask?: number
  projectBudgetRemaining?: number
  userBudgetRemaining?: number
  teamBudgetRemaining?: number
  dailyBudgetRemaining?: number
  confirmationThreshold?: number
  currentTaskSpent?: number
  retryCost?: number
  retryCostCounts?: boolean
}

export interface BudgetGateDecision {
  status: 'allow' | 'requires-confirmation'
  reason: string
  estimate: ModelCostEstimate
  policy: BudgetPolicy
  projectedCost?: number
}

export function evaluateBudgetGate(
  estimate: ModelCostEstimate,
  policy: BudgetPolicy,
): BudgetGateDecision {
  if (estimate.unknownPricing.length > 0 || estimate.estimatedCost === undefined) {
    return {
      status: 'requires-confirmation',
      reason: 'Model pricing is incomplete; user confirmation is required before a paid call.',
      estimate,
      policy,
    }
  }

  const projectedCost =
    estimate.estimatedCost +
    (policy.currentTaskSpent ?? 0) +
    (policy.retryCostCounts === false ? 0 : (policy.retryCost ?? 0))

  if (policy.maxCostPerTask !== undefined && projectedCost > policy.maxCostPerTask) {
    return {
      status: 'requires-confirmation',
      reason: 'Estimated model cost exceeds the per-task budget.',
      estimate,
      policy,
      projectedCost,
    }
  }
  if (
    policy.projectBudgetRemaining !== undefined &&
    projectedCost > policy.projectBudgetRemaining
  ) {
    return {
      status: 'requires-confirmation',
      reason: 'Estimated model cost exceeds the remaining project budget.',
      estimate,
      policy,
      projectedCost,
    }
  }
  if (policy.userBudgetRemaining !== undefined && projectedCost > policy.userBudgetRemaining) {
    return {
      status: 'requires-confirmation',
      reason: 'Estimated model cost exceeds the remaining user budget.',
      estimate,
      policy,
      projectedCost,
    }
  }
  if (policy.teamBudgetRemaining !== undefined && projectedCost > policy.teamBudgetRemaining) {
    return {
      status: 'requires-confirmation',
      reason: 'Estimated model cost exceeds the remaining team budget.',
      estimate,
      policy,
      projectedCost,
    }
  }
  if (policy.dailyBudgetRemaining !== undefined && projectedCost > policy.dailyBudgetRemaining) {
    return {
      status: 'requires-confirmation',
      reason: 'Estimated model cost exceeds the remaining daily budget.',
      estimate,
      policy,
      projectedCost,
    }
  }
  if (policy.confirmationThreshold !== undefined && projectedCost > policy.confirmationThreshold) {
    return {
      status: 'requires-confirmation',
      reason: 'Estimated model cost exceeds the confirmation threshold.',
      estimate,
      policy,
      projectedCost,
    }
  }

  return {
    status: 'allow',
    reason: 'Estimated model cost is within configured budgets.',
    estimate,
    policy,
    projectedCost,
  }
}
