#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'

const repoRoot = process.cwd()
const sourceRoot = join(repoRoot, 'src')
const producerRoot = join(sourceRoot, 'features/hyperframes-runtime/upstream/producer-node')
const codeExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'])
const forbiddenSpecifier = /(?:^|\/)hyperframes-runtime\/upstream\/producer-node(?:\/|$)/

function collectCodeFiles(directory, files = []) {
  if (!existsSync(directory)) return files
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (path === producerRoot) continue
    if (entry.isDirectory()) collectCodeFiles(path, files)
    else if (entry.isFile() && codeExtensions.has(entry.name.slice(entry.name.lastIndexOf('.')))) {
      files.push(path)
    }
  }
  return files
}

function importSpecifiers(source) {
  const specifiers = []
  const patterns = [
    /(?:import|export)\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g,
    /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ]
  for (const pattern of patterns) {
    let match
    while ((match = pattern.exec(source)) !== null) specifiers.push(match[1])
  }
  return specifiers
}

if (!existsSync(producerRoot)) {
  console.error(`HyperFrames producer-node source snapshot is missing: ${producerRoot}`)
  process.exit(1)
}

const findings = []
for (const file of collectCodeFiles(sourceRoot)) {
  const source = readFileSync(file, 'utf8')
  for (const specifier of importSpecifiers(source)) {
    if (forbiddenSpecifier.test(specifier)) {
      findings.push({ file: relative(repoRoot, file), specifier })
    }
  }
}

if (findings.length > 0) {
  console.error('Browser source must not import the Node-only HyperFrames producer snapshot.')
  for (const finding of findings) console.error(`- ${finding.file}: ${finding.specifier}`)
  process.exit(1)
}

console.log('HyperFrames producer-node is isolated from the browser source graph.')
