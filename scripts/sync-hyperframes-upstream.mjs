#!/usr/bin/env node

import { createHash } from 'node:crypto'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'

const repoRoot = process.cwd()
const manifestPath = join(
  repoRoot,
  'src/features/hyperframes-runtime/provenance/upstream-manifest.json',
)
const statePath = join(
  repoRoot,
  'src/features/hyperframes-runtime/provenance/upstream-sync-state.json',
)

function parseArgs(argv) {
  const args = {
    packageId: undefined,
    dryRun: true,
    write: false,
    runtimeOnly: false,
    includePaths: [],
    sourceRoot: undefined,
    targetRoot: undefined,
    statePath,
    json: false,
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    const next = argv[i + 1]

    if (arg === '--package' || arg === '-p') {
      args.packageId = next
      i += 1
      continue
    }
    if (arg === '--source-root') {
      args.sourceRoot = next
      i += 1
      continue
    }
    if (arg === '--target-root') {
      args.targetRoot = next
      i += 1
      continue
    }
    if (arg === '--state-path') {
      args.statePath = next ? resolve(repoRoot, next) : statePath
      i += 1
      continue
    }
    if (arg === '--write') {
      args.write = true
      args.dryRun = false
      continue
    }
    if (arg === '--dry-run') {
      args.dryRun = true
      args.write = false
      continue
    }
    if (arg === '--json') {
      args.json = true
      continue
    }
    if (arg === '--runtime-only') {
      args.runtimeOnly = true
      continue
    }
    if (arg === '--include') {
      args.includePaths.push(next)
      i += 1
      continue
    }
    if (arg === '--help' || arg === '-h') {
      printUsage()
      process.exit(0)
    }
    if (!arg.startsWith('-') && !args.packageId) {
      args.packageId = arg
      continue
    }

    throw new Error(`Unknown argument: ${arg}`)
  }

  return args
}

function printUsage() {
  console.log(`Usage:
  node scripts/sync-hyperframes-upstream.mjs --package <id> [--dry-run]
  node scripts/sync-hyperframes-upstream.mjs --package <id> --write

Options:
  --package, -p    Package id from upstream-manifest.json
  --dry-run        Print planned copy operations without writing, default
  --write          Copy files and update provenance/upstream-sync-state.json
  --runtime-only   Skip upstream tests, fixtures, goldens and test helpers
  --include        Include a source-relative file or directory prefix; repeatable
  --source-root    Override HyperFrames source root for validation or local testing
  --target-root    Override FreeCut runtime target root for validation or local testing
  --state-path     Override sync-state output path
  --json           Print JSON report
`)
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function safeRelative(from, to) {
  const rel = relative(from, to)
  return rel === '' || (!rel.startsWith('..') && !rel.startsWith(`${sep}`))
}

function assertSafeDefaultTarget(target) {
  const upstreamRoot = resolve(repoRoot, 'src/features/hyperframes-runtime/upstream')
  if (!safeRelative(upstreamRoot, target)) {
    throw new Error(`Refusing to sync outside HyperFrames upstream mirror: ${target}`)
  }
}

function isRuntimeOnlyExcluded(relativePath, entryName, isDirectory) {
  if (isDirectory) {
    return entryName === '__goldens__' || entryName === '__fixtures__'
  }

  return (
    entryName.endsWith('.test.ts') ||
    entryName.endsWith('.test.tsx') ||
    entryName.endsWith('.spec.ts') ||
    entryName.endsWith('.spec.tsx') ||
    entryName.endsWith('.test-helpers.ts') ||
    entryName === 'test-setup.ts' ||
    relativePath === 'test-utils.ts'
  )
}

function normalizeIncludePath(value) {
  if (!value || typeof value !== 'string') {
    throw new Error('--include requires a non-empty source-relative path')
  }

  const normalized = value.replaceAll('\\', '/').replace(/^\/+/, '').replace(/\/+$/, '')
  if (!normalized || normalized === '.' || normalized.includes('../') || normalized === '..') {
    throw new Error(`Unsafe include path: ${value}`)
  }
  return normalized
}

function isIncluded(relativePath, includePaths) {
  if (includePaths.length === 0) return true
  return includePaths.some(
    (includePath) => relativePath === includePath || relativePath.startsWith(`${includePath}/`),
  )
}

function collectFiles(dir, base = dir, files = [], options = {}) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue

    const fullPath = join(dir, entry.name)
    const relativePath = relative(base, fullPath).split(sep).join('/')

    if (options.runtimeOnly && isRuntimeOnlyExcluded(relativePath, entry.name, entry.isDirectory())) {
      continue
    }

    if (!entry.isDirectory() && !isIncluded(relativePath, options.includePaths ?? [])) {
      continue
    }

    if (entry.isDirectory()) {
      collectFiles(fullPath, base, files, options)
      continue
    }
    if (entry.isFile()) {
      files.push({
        absolutePath: fullPath,
        relativePath,
      })
    }
  }
  return files
}

function hashFile(path) {
  const hash = createHash('sha256')
  hash.update(readFileSync(path))
  return hash.digest('hex')
}

function planSync(sourceDir, targetDir, options) {
  const sourceFiles = collectFiles(sourceDir, sourceDir, [], options)
  const actions = []

  for (const file of sourceFiles) {
    const targetPath = join(targetDir, file.relativePath)
    const sourceStat = statSync(file.absolutePath)
    let kind = 'new'

    if (existsSync(targetPath)) {
      const targetStat = statSync(targetPath)
      if (sourceStat.size === targetStat.size && hashFile(file.absolutePath) === hashFile(targetPath)) {
        kind = 'same'
      } else {
        kind = 'changed'
      }
    }

    actions.push({
      kind,
      relativePath: file.relativePath,
      sourcePath: file.absolutePath,
      targetPath,
      bytes: sourceStat.size,
    })
  }

  return actions
}

function applySync(actions) {
  for (const action of actions) {
    if (action.kind === 'same') continue
    mkdirSync(dirname(action.targetPath), { recursive: true })
    copyFileSync(action.sourcePath, action.targetPath)
  }
}

function readSyncState(path) {
  if (!existsSync(path)) {
    return {
      schemaVersion: 1,
      packages: {},
    }
  }
  return readJson(path)
}

function writeSyncState(path, state) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(`${path}.tmp`, `${JSON.stringify(state, null, 2)}\n`)
  renameSync(`${path}.tmp`, path)
}

function summarize(packageId, entry, sourceDir, targetDir, actions, dryRun, runtimeOnly, includePaths) {
  const counts = actions.reduce(
    (acc, action) => {
      acc[action.kind] += 1
      acc.bytes += action.bytes
      return acc
    },
    { new: 0, changed: 0, same: 0, bytes: 0 },
  )

  return {
    packageId,
    displayName: entry.displayName,
    dryRun,
    runtimeOnly,
    includePaths,
    sourceDir,
    targetDir,
    fileCount: actions.length,
    counts,
    changedFiles: actions
      .filter((action) => action.kind !== 'same')
      .map((action) => action.relativePath),
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  args.includePaths = args.includePaths.map(normalizeIncludePath)
  const manifest = readJson(manifestPath)

  if (!args.packageId) {
    const ids = Object.keys(manifest.packages)
    console.log(`Available packages: ${ids.join(', ')}`)
    printUsage()
    return
  }

  const entry = manifest.packages[args.packageId]
  if (!entry) {
    throw new Error(`Unknown package id: ${args.packageId}`)
  }

  const sourceRoot = resolve(args.sourceRoot ?? manifest.hyperframesRoot)
  const targetRoot = resolve(args.targetRoot ?? join(repoRoot, manifest.targetRoot))
  const sourceDir = resolve(sourceRoot, entry.source)
  const targetDir = resolve(targetRoot, relative(manifest.targetRoot, entry.target))

  if (!existsSync(sourceDir)) {
    throw new Error(`Source path does not exist: ${sourceDir}`)
  }

  if (!args.targetRoot) {
    assertSafeDefaultTarget(targetDir)
  }

  const actions = planSync(sourceDir, targetDir, {
    runtimeOnly: args.runtimeOnly,
    includePaths: args.includePaths,
  })
  const report = summarize(
    args.packageId,
    entry,
    sourceDir,
    targetDir,
    actions,
    args.dryRun,
    args.runtimeOnly,
    args.includePaths,
  )

  if (args.write) {
    applySync(actions)
    const state = readSyncState(args.statePath)
    state.updatedAt = new Date().toISOString()
    state.packages[args.packageId] = {
      source: entry.source,
      target: entry.target,
      strategy: entry.strategy,
      syncedAt: state.updatedAt,
      runtimeOnly: args.runtimeOnly,
      includePaths: args.includePaths,
      fileCount: report.fileCount,
      changedFileCount: report.counts.new + report.counts.changed,
      bytes: report.counts.bytes,
    }
    writeSyncState(args.statePath, state)
  }

  if (args.json) {
    console.log(JSON.stringify(report, null, 2))
    return
  }

  console.log(`${args.dryRun ? 'Dry run' : 'Synced'} ${entry.id}`)
  console.log(`Source: ${sourceDir}`)
  console.log(`Target: ${targetDir}`)
  console.log(
    `Files: ${report.fileCount}; new: ${report.counts.new}; changed: ${report.counts.changed}; same: ${report.counts.same}`,
  )
  if (args.dryRun) {
    console.log('No files were written. Re-run with --write to copy files and update sync state.')
  }
}

try {
  main()
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}
