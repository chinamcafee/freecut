export type HyperFramesQualityScenario = 'normal' | 'failure' | 'boundary'

export interface HyperFramesQualityMatrixRow {
  module: 'data-model' | 'repository' | 'parser' | 'lint' | 'player' | 'studio' | 'skills' | 'render' | 'security'
  testFile: string
  scenarios: HyperFramesQualityScenario[]
}

export const HYPERFRAMES_UNIT_TEST_MATRIX: HyperFramesQualityMatrixRow[] = [
  { module: 'data-model', testFile: 'src/types/hyperframes.test.ts', scenarios: ['normal', 'failure', 'boundary'] },
  { module: 'repository', testFile: 'src/features/hyperframes-runtime/adapters/freecut-project/file-system-project-repository.test.ts', scenarios: ['normal', 'failure', 'boundary'] },
  { module: 'parser', testFile: 'src/features/hyperframes-runtime/adapters/freecut-project/parser-adapter.test.ts', scenarios: ['normal', 'failure', 'boundary'] },
  { module: 'lint', testFile: 'src/features/hyperframes-runtime/adapters/freecut-project/lint-adapter.test.ts', scenarios: ['normal', 'failure', 'boundary'] },
  { module: 'player', testFile: 'src/features/hyperframes-runtime/bridges/player-bridge/HyperFramesPlayerHost.test.tsx', scenarios: ['normal', 'failure', 'boundary'] },
  { module: 'studio', testFile: 'src/features/hyperframes-runtime/bridges/studio-bridge/FreeCutStudioShell.test.tsx', scenarios: ['normal', 'failure', 'boundary'] },
  { module: 'skills', testFile: 'src/features/hyperframes-runtime/bridges/skills-bridge/skillJobQueue.test.ts', scenarios: ['normal', 'failure', 'boundary'] },
  { module: 'render', testFile: 'src/features/hyperframes-runtime/bridges/render-bridge/HyperFramesRenderService.test.ts', scenarios: ['normal', 'failure', 'boundary'] },
  { module: 'security', testFile: 'src/features/hyperframes-runtime/adapters/freecut-preview/preview-document.test.ts', scenarios: ['normal', 'failure', 'boundary'] },
]

export function validateHyperFramesUnitTestMatrix(
  rows: HyperFramesQualityMatrixRow[] = HYPERFRAMES_UNIT_TEST_MATRIX,
): string[] {
  const issues: string[] = []
  for (const module of ['data-model', 'repository', 'parser', 'lint', 'player', 'studio', 'skills', 'render', 'security'] as const) {
    const row = rows.find((entry) => entry.module === module)
    if (!row) { issues.push(`Missing module: ${module}`); continue }
    for (const scenario of ['normal', 'failure', 'boundary'] as const) {
      if (!row.scenarios.includes(scenario)) issues.push(`${module} missing ${scenario}`)
    }
  }
  return issues
}
