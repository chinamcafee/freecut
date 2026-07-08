export interface TimelineEditPreview {
  id: string
  command: TimelineAction
  requiresConfirmation: true
  diff: Array<{ op: 'replace' | 'remove' | 'add'; path: string; value?: unknown }>
  provenance: { source: 'natural-language'; prompt: string }
}

export type TimelineAction = 'move-clip' | 'delete-clip' | 'add-clip' | 'add-effect' | 'add-transition'

export interface TimelineApplyResult {
  status: 'applied'
  rollbackId: string
  result: string
  historyEntry: { action: TimelineAction; previewId: string; provenance: TimelineEditPreview['provenance'] }
}

export class NaturalLanguageEditEngine {
  private previews = new Map<string, TimelineEditPreview>()
  private rollbacks = new Set<string>()
  private nextId = 1

  previewTimelineEdit(prompt: string): TimelineEditPreview {
    const lower = prompt.toLowerCase()
    const clipId = lower.match(/clip\s+([a-z0-9_-]+)/)?.[1] ?? 'selected'
    const frames = lower.match(/(\d+)\s+frames?/)?.[1] ?? '0'
    const command = parseTimelineAction(lower)
    const preview: TimelineEditPreview = {
      id: `nl-edit-${this.nextId}`,
      command,
      requiresConfirmation: true,
      diff:
        command === 'delete-clip'
          ? [{ op: 'remove', path: `timeline.items.${clipId}` }]
          : command === 'add-clip'
            ? [{ op: 'add', path: 'timeline.items', value: { id: clipId, from: 0 } }]
            : command === 'add-transition'
              ? [{ op: 'add', path: `timeline.items.${clipId}.transition`, value: 'recommended' }]
          : command === 'add-effect'
            ? [{ op: 'add', path: `timeline.items.${clipId}.effects`, value: 'recommended' }]
            : [{ op: 'replace', path: `timeline.items.${clipId}.from`, value: `+${frames}` }],
      provenance: { source: 'natural-language', prompt },
    }
    this.nextId += 1
    this.previews.set(preview.id, preview)
    return preview
  }

  apply(previewId: string): TimelineApplyResult {
    const preview = this.previews.get(previewId)
    if (!preview) throw new Error(`Missing edit preview: ${previewId}`)
    const rollbackId = `nl-rollback-${previewId}`
    this.rollbacks.add(rollbackId)
    this.previews.delete(previewId)
    return {
      status: 'applied',
      rollbackId,
      result: describeTimelineResult(preview),
      historyEntry: {
        action: preview.command,
        previewId,
        provenance: preview.provenance,
      },
    }
  }

  undo(rollbackId: string): { status: 'undone' } {
    if (!this.rollbacks.delete(rollbackId)) throw new Error(`Missing rollback: ${rollbackId}`)
    return { status: 'undone' }
  }
}

function parseTimelineAction(prompt: string): TimelineAction {
  if (/\b(delete|remove)\b/.test(prompt)) return 'delete-clip'
  if (/\b(transition|crossfade|cut)\b/.test(prompt)) return 'add-transition'
  if (/\b(effect|blur|glow|color)\b/.test(prompt)) return 'add-effect'
  if (/\b(add|insert)\b/.test(prompt) && /\bclip\b/.test(prompt)) return 'add-clip'
  return 'move-clip'
}

function describeTimelineResult(preview: TimelineEditPreview): string {
  if (preview.command === 'move-clip') {
    const path = preview.diff[0]?.path ?? ''
    const clipId = path.match(/timeline\.items\.([^.]+)/)?.[1] ?? 'selected'
    return `Moved ${clipId} by ${String(preview.diff[0]?.value ?? '+0').replace('+', '')} frames`
  }
  if (preview.command === 'delete-clip') return 'Deleted clip'
  if (preview.command === 'add-clip') return 'Added clip'
  if (preview.command === 'add-transition') return 'Added transition preview'
  return 'Added effect preview'
}

export interface FileMutationPreview {
  id: string
  path: string
  requiresConfirmation: true
  diff: Array<{ op: 'replace'; search: string; replace: string }>
}

export class StudioFileMutationEngine {
  private previews = new Map<string, FileMutationPreview>()
  private snapshots = new Map<string, Record<string, string>>()
  private nextId = 1

  constructor(private files: Record<string, string>) {}

  previewMutation(prompt: string, path: string): FileMutationPreview {
    const lower = prompt.toLowerCase()
    const diff = lower.includes('red')
      ? [{ op: 'replace' as const, search: 'color:white', replace: 'color:red' }]
      : [{ op: 'replace' as const, search: '<h1>', replace: '<h1 data-ai-edited="true">' }]
    const preview = {
      id: `file-mutation-${this.nextId}`,
      path,
      requiresConfirmation: true as const,
      diff,
    }
    this.nextId += 1
    this.previews.set(preview.id, preview)
    return preview
  }

  apply(previewId: string): { status: 'applied'; rollbackId: string; files: Record<string, string> } {
    const preview = this.previews.get(previewId)
    if (!preview) throw new Error(`Missing mutation preview: ${previewId}`)
    const rollbackId = `file-rollback-${previewId}`
    this.snapshots.set(rollbackId, { ...this.files })
    let next = this.files[preview.path] ?? ''
    for (const patch of preview.diff) next = next.replaceAll(patch.search, patch.replace)
    this.files = { ...this.files, [preview.path]: next }
    this.previews.delete(previewId)
    return { status: 'applied', rollbackId, files: { ...this.files } }
  }

  rollback(rollbackId: string): { status: 'rolled-back'; files: Record<string, string> } {
    const snapshot = this.snapshots.get(rollbackId)
    if (!snapshot) throw new Error(`Missing rollback: ${rollbackId}`)
    this.files = { ...snapshot }
    this.snapshots.delete(rollbackId)
    return { status: 'rolled-back', files: { ...this.files } }
  }
}

export class EffectRecommender {
  recommend(prompt: string): Array<{
    id: string
    params: Record<string, unknown>
    reason: string
    preview: { before: string; after: string }
  }> {
    const lower = prompt.toLowerCase()
    if (lower.includes('blur') || lower.includes('dreamy') || lower.includes('soft')) {
      return [
        {
          id: 'blur',
          params: { radius: 8 },
          reason: 'Matched soft/dreamy language',
          preview: { before: 'original', after: 'soft-blur' },
        },
      ]
    }
    return [
      {
        id: 'brightness',
        params: { amount: 1.1 },
        reason: 'Default clarity enhancement',
        preview: { before: 'original', after: 'brighter' },
      },
    ]
  }

  recommendTransitions(prompt: string): Array<{ id: string; params: Record<string, unknown>; reason: string }> {
    const lower = prompt.toLowerCase()
    if (lower.includes('fast') || lower.includes('cut')) {
      return [{ id: 'quick-cut', params: { durationFrames: 6 }, reason: 'Matched fast pacing' }]
    }
    return [{ id: 'crossfade', params: { durationFrames: 18 }, reason: 'Default smooth transition' }]
  }
}

export class TemplateRecommender {
  recommend(prompt: string): Array<{ id: string; exportPreset: string; reason: string; preview: string }> {
    const lower = prompt.toLowerCase()
    if (lower.includes('vertical') || lower.includes('social')) {
      return [
        {
          id: 'vertical-social',
          exportPreset: '1080x1920-h264',
          reason: 'Matched social vertical format',
          preview: 'vertical-social-preview',
        },
      ]
    }
    return [
      {
        id: 'landscape-standard',
        exportPreset: '1920x1080-h264',
        reason: 'Default landscape format',
        preview: 'landscape-standard-preview',
      },
    ]
  }

  recommendPreset(prompt: string): { id: string; codec: string; dimensions: [number, number] } {
    const lower = prompt.toLowerCase()
    if (lower.includes('vertical') || lower.includes('social')) {
      return { id: 'reels-1080x1920', codec: 'h264', dimensions: [1080, 1920] }
    }
    return { id: 'web-1920x1080', codec: 'h264', dimensions: [1920, 1080] }
  }
}

export class PersonalizationModel {
  private counts = new Map<string, number>()

  recordChoice(kind: string, id: string): void {
    const key = `${kind}:${id}`
    this.counts.set(key, (this.counts.get(key) ?? 0) + 1)
  }

  weight(kind: string, id: string): number {
    return this.counts.get(`${kind}:${id}`) ?? 0
  }
}

export interface NaturalLanguageActionPlan {
  steps: Array<
    | { type: 'skills-job'; skillId: string }
    | { type: 'freecut-ai'; request: string }
    | { type: 'timeline-action'; action: TimelineAction }
  >
}

export class NaturalLanguageActionOrchestrator {
  plan(prompt: string): NaturalLanguageActionPlan {
    const lower = prompt.toLowerCase()
    const steps: NaturalLanguageActionPlan['steps'] = []
    if (lower.includes('animated') || lower.includes('opener') || lower.includes('template')) {
      steps.push({ type: 'skills-job', skillId: 'animated-opener' })
    }
    steps.push({ type: 'freecut-ai', request: 'generate-context-summary' })
    steps.push({ type: 'timeline-action', action: parseTimelineAction(lower) })
    return { steps }
  }

  execute(plan: NaturalLanguageActionPlan): { status: 'complete'; results: string[] } {
    return {
      status: 'complete',
      results: plan.steps.map((step) => {
        if (step.type === 'skills-job') return `queued skill ${step.skillId}`
        if (step.type === 'freecut-ai') return `requested FreeCut AI ${step.request}`
        return `prepared timeline ${step.action} preview`
      }),
    }
  }
}

export class BatchActionPlanner {
  plan(prompt: string): { operations: string[]; performanceMode: 'chunked' | 'single-pass' } {
    const lower = prompt.toLowerCase()
    const operations: string[] = []
    if (lower.includes('all') && (lower.includes('effect') || lower.includes('blur'))) operations.push('batch-add-effect')
    if (lower.includes('adjust') || lower.includes('parameter')) operations.push('batch-adjust-params')
    if (lower.includes('export')) operations.push('batch-export')
    return { operations, performanceMode: operations.length > 1 ? 'chunked' : 'single-pass' }
  }
}

export class CorrectionAdvisor {
  inspect(input: {
    missingAssets?: string[]
    invalidRanges?: string[]
  }): { issues: string[]; suggestions: string[]; autoFixes: Array<{ issue: string; action: string }> } {
    const missingAssets = input.missingAssets ?? []
    const invalidRanges = input.invalidRanges ?? []
    return {
      issues: [
        ...missingAssets.map((asset) => `missing-asset:${asset}`),
        ...invalidRanges.map((range) => `invalid-range:${range}`),
      ],
      suggestions: [
        ...missingAssets.map((asset) => `Relink ${asset}`),
        ...invalidRanges.map((range) => `Trim or move ${range} into the composition duration`),
      ],
      autoFixes: invalidRanges.map((range) => ({ issue: `invalid-range:${range}`, action: 'clamp-range' })),
    }
  }
}
