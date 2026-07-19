import { describe, expect, it } from 'vite-plus/test'
import { evaluateHyperFramesReleaseReadiness, type HyperFramesReleaseGateState } from './releaseReadiness'

const passing: HyperFramesReleaseGateState[] = ['security', 'privacy', 'cost', 'render', 'model', 'documentation'].map((gate) => ({ gate: gate as HyperFramesReleaseGateState['gate'], passed: true, evidence: `${gate}.report`, message: `${gate} passed` }))

describe('HyperFrames release readiness', () => {
  it('allows release only when every required gate has evidence', () => {
    expect(evaluateHyperFramesReleaseReadiness(passing)).toMatchObject({ canRelease: true, blockers: [] })
  })

  it('blocks missing and failed gates', () => {
    const result = evaluateHyperFramesReleaseReadiness(passing.filter((state) => state.gate !== 'documentation').map((state) => state.gate === 'render' ? { ...state, passed: false } : state))
    expect(result.canRelease).toBe(false)
    expect(result.blockers.map((state) => state.gate)).toEqual(['render', 'documentation'])
  })
})
