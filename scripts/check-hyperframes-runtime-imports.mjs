#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

const repoRoot = process.cwd()
const sourceRoot = join(repoRoot, 'src')
const producerNodeSnapshotRoot = join(
  sourceRoot,
  'features/hyperframes-runtime/upstream/producer-node',
)
const codeExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'])

const forbiddenPatterns = [
  /(?:import|export)\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?['"](@hyperframes\/[^'"]+)['"]/g,
  /import\s*\(\s*['"](@hyperframes\/[^'"]+)['"]\s*\)/g,
  /require\s*\(\s*['"](@hyperframes\/[^'"]+)['"]\s*\)/g,
]

function extensionOf(path) {
  const dotIndex = path.lastIndexOf('.')
  return dotIndex === -1 ? '' : path.slice(dotIndex)
}

function collectCodeFiles(dir, files = []) {
  if (!existsSync(dir)) return files

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name)

    if (entry.isDirectory()) {
      collectCodeFiles(fullPath, files)
      continue
    }

    if (entry.isFile() && codeExtensions.has(extensionOf(entry.name))) {
      files.push(fullPath)
    }
  }

  return files
}

function findForbiddenImports(filePath) {
  const source = readFileSync(filePath, 'utf8')
  const findings = []

  for (const pattern of forbiddenPatterns) {
    pattern.lastIndex = 0
    let match
    while ((match = pattern.exec(source)) !== null) {
      findings.push({
        specifier: match[1],
        index: match.index,
      })
    }
  }

  return findings
}

const findings = []

for (const filePath of collectCodeFiles(sourceRoot)) {
  // This exact upstream snapshot is Node-only and audited by its own browser boundary check.
  if (filePath.startsWith(`${producerNodeSnapshotRoot}/`)) continue
  for (const finding of findForbiddenImports(filePath)) {
    findings.push({
      file: relative(repoRoot, filePath),
      specifier: finding.specifier,
    })
  }
}

if (findings.length > 0) {
  console.error('Direct @hyperframes/* imports are forbidden in FreeCut source code.')
  console.error('Use src/features/hyperframes-runtime adapters or bridges instead.')
  for (const finding of findings) {
    console.error(`- ${finding.file}: ${finding.specifier}`)
  }
  process.exit(1)
}

console.log('No direct @hyperframes/* imports found in FreeCut source code.')
