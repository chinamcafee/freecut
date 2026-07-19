#!/usr/bin/env node

import { appendFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const defaultPatchNotesPath =
  'src/features/hyperframes-runtime/provenance/patch-notes.md'

function parseArgs(argv) {
  const args = {
    packageId: undefined,
    summary: undefined,
    source: undefined,
    target: undefined,
    rewrite: [],
    localPatch: [],
    notMigrated: [],
    verification: [],
    patchNotesPath: defaultPatchNotesPath,
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    const next = argv[i + 1]

    if (arg === '--package' || arg === '-p') {
      args.packageId = next
      i += 1
      continue
    }
    if (arg === '--summary') {
      args.summary = next
      i += 1
      continue
    }
    if (arg === '--source') {
      args.source = next
      i += 1
      continue
    }
    if (arg === '--target') {
      args.target = next
      i += 1
      continue
    }
    if (arg === '--rewrite') {
      args.rewrite.push(next)
      i += 1
      continue
    }
    if (arg === '--local-patch') {
      args.localPatch.push(next)
      i += 1
      continue
    }
    if (arg === '--not-migrated') {
      args.notMigrated.push(next)
      i += 1
      continue
    }
    if (arg === '--verification') {
      args.verification.push(next)
      i += 1
      continue
    }
    if (arg === '--patch-notes') {
      args.patchNotesPath = next ?? defaultPatchNotesPath
      i += 1
      continue
    }
    if (arg === '--help' || arg === '-h') {
      printUsage()
      process.exit(0)
    }

    throw new Error(`Unknown argument: ${arg}`)
  }

  return args
}

function printUsage() {
  console.log(`Usage:
  node scripts/record-hyperframes-patch-note.mjs --package <id> --summary <text> --source <path> --target <path> [options]

Options:
  --rewrite <text>       Add an import or runtime rewrite bullet, repeatable
  --local-patch <text>   Add a FreeCut-specific patch bullet, repeatable
  --not-migrated <text>  Add an excluded file or feature bullet, repeatable
  --verification <text>  Add a verification command or result, repeatable
  --patch-notes <path>   Override patch notes path
`)
}

function required(value, name) {
  if (!value) {
    throw new Error(`Missing required argument: ${name}`)
  }
  return value
}

function formatList(items, fallback) {
  const values = items.length > 0 ? items : [fallback]
  return values.map((item) => `  - ${item}`).join('\n')
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  const packageId = required(args.packageId, '--package')
  const summary = required(args.summary, '--summary')
  const source = required(args.source, '--source')
  const target = required(args.target, '--target')
  const patchNotesPath = resolve(process.cwd(), args.patchNotesPath)

  if (!existsSync(patchNotesPath)) {
    throw new Error(`Patch notes file does not exist: ${patchNotesPath}`)
  }

  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date())
  const entry = `
## ${today}：${summary}

- 包：${packageId}
- 来源：${source}
- 目标：${target}
- 改写：
${formatList(args.rewrite, '无额外 import 改写')}
- 本地 patch：
${formatList(args.localPatch, '无额外本地 patch')}
- 未迁移：
${formatList(args.notMigrated, '无')}
- 验证：
${formatList(args.verification, '未记录')}
`

  appendFileSync(patchNotesPath, entry)
  console.log(`Patch note appended to ${args.patchNotesPath}`)
}

try {
  main()
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}
