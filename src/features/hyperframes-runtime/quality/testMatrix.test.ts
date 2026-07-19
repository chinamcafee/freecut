import { describe, expect, it } from 'vite-plus/test'
import { HYPERFRAMES_UNIT_TEST_MATRIX, validateHyperFramesUnitTestMatrix } from './testMatrix'

describe('HyperFrames unit test matrix', () => {
  it('covers normal, failure and boundary behavior for every required module', () => {
    expect(validateHyperFramesUnitTestMatrix()).toEqual([])
    expect(HYPERFRAMES_UNIT_TEST_MATRIX).toHaveLength(9)
  })

  it('reports incomplete module evidence', () => {
    expect(validateHyperFramesUnitTestMatrix(HYPERFRAMES_UNIT_TEST_MATRIX.filter((row) => row.module !== 'security'))).toContain('Missing module: security')
  })
})
