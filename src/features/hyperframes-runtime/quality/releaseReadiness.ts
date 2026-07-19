export type HyperFramesReleaseGate = 'security' | 'privacy' | 'cost' | 'render' | 'model' | 'documentation'

export interface HyperFramesReleaseGateState {
  gate: HyperFramesReleaseGate
  passed: boolean
  evidence?: string
  message: string
}

export interface HyperFramesReleaseReadiness {
  canRelease: boolean
  blockers: HyperFramesReleaseGateState[]
  passed: HyperFramesReleaseGateState[]
}

export function evaluateHyperFramesReleaseReadiness(
  states: HyperFramesReleaseGateState[],
): HyperFramesReleaseReadiness {
  const required: HyperFramesReleaseGate[] = ['security', 'privacy', 'cost', 'render', 'model', 'documentation']
  const normalized = required.map((gate) => states.find((state) => state.gate === gate) ?? {
    gate, passed: false, message: `Missing ${gate} release evidence.`,
  })
  const blockers = normalized.filter((state) => !state.passed)
  return { canRelease: blockers.length === 0, blockers, passed: normalized.filter((state) => state.passed) }
}
