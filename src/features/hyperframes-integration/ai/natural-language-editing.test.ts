import { describe, expect, it } from 'vite-plus/test'
import {
  BatchActionPlanner,
  CorrectionAdvisor,
  EffectRecommender,
  NaturalLanguageActionOrchestrator,
  NaturalLanguageEditEngine,
  PersonalizationModel,
  StudioFileMutationEngine,
  TemplateRecommender,
} from './natural-language-editing'

describe('natural language editing', () => {
  it('parses timeline edit commands into confirmable diffs and provenance entries', () => {
    const engine = new NaturalLanguageEditEngine()
    const preview = engine.previewTimelineEdit('move clip intro 12 frames later')

    expect(preview).toMatchObject({
      command: 'move-clip',
      requiresConfirmation: true,
      diff: [{ op: 'replace', path: 'timeline.items.intro.from', value: '+12' }],
      provenance: { source: 'natural-language', prompt: 'move clip intro 12 frames later' },
    })
    const applied = engine.apply(preview.id)
    expect(applied).toMatchObject({
      status: 'applied',
      rollbackId: expect.any(String),
      result: 'Moved intro by 12 frames',
      historyEntry: { action: 'move-clip', previewId: preview.id },
    })
    expect(engine.undo(applied.rollbackId)).toMatchObject({ status: 'undone' })
  })

  it('creates conservative Studio file mutations with diff preview and rollback', () => {
    const engine = new StudioFileMutationEngine({
      'compositions/main.html': '<h1>Hello</h1><style>h1{color:white}</style>',
    })

    const preview = engine.previewMutation('make headline red', 'compositions/main.html')
    expect(preview).toMatchObject({
      path: 'compositions/main.html',
      requiresConfirmation: true,
      diff: [{ op: 'replace', search: 'color:white', replace: 'color:red' }],
    })

    const applied = engine.apply(preview.id)
    expect(applied.files['compositions/main.html']).toContain('color:red')
    expect(engine.rollback(applied.rollbackId).files['compositions/main.html']).toContain('color:white')
  })

  it('recommends effects, transitions, templates, export presets, and learns local preferences', () => {
    expect(new EffectRecommender().recommend('dreamy soft blur intro')[0]).toMatchObject({
      id: 'blur',
      params: { radius: 8 },
      preview: { before: 'original', after: 'soft-blur' },
    })
    expect(new EffectRecommender().recommendTransitions('fast cut into logo')[0]).toMatchObject({
      id: 'quick-cut',
      params: { durationFrames: 6 },
    })
    expect(new TemplateRecommender().recommend('short vertical social video')[0]).toMatchObject({
      id: 'vertical-social',
      preview: 'vertical-social-preview',
    })
    expect(new TemplateRecommender().recommendPreset('short vertical social video')).toMatchObject({
      id: 'reels-1080x1920',
    })

    const personalization = new PersonalizationModel()
    personalization.recordChoice('effect', 'blur')
    personalization.recordChoice('effect', 'blur')
    expect(personalization.weight('effect', 'blur')).toBe(2)
  })

  it('orchestrates Skills jobs, FreeCut AI requests, and timeline actions from one plan', () => {
    const orchestrator = new NaturalLanguageActionOrchestrator()
    const plan = orchestrator.plan('create an animated opener then add blur effect to selected clip')

    expect(plan.steps).toEqual([
      { type: 'skills-job', skillId: 'animated-opener' },
      { type: 'freecut-ai', request: 'generate-context-summary' },
      { type: 'timeline-action', action: 'add-effect' },
    ])
    expect(orchestrator.execute(plan).results).toEqual([
      'queued skill animated-opener',
      'requested FreeCut AI generate-context-summary',
      'prepared timeline add-effect preview',
    ])
  })

  it('plans batch edits and correction suggestions with local learning metadata', () => {
    expect(new BatchActionPlanner().plan('add blur to all clips and export every variant')).toMatchObject({
      operations: ['batch-add-effect', 'batch-export'],
      performanceMode: 'chunked',
    })

    expect(new CorrectionAdvisor().inspect({ missingAssets: ['logo.png'], invalidRanges: ['intro'] })).toMatchObject({
      issues: ['missing-asset:logo.png', 'invalid-range:intro'],
      suggestions: ['Relink logo.png', 'Trim or move intro into the composition duration'],
      autoFixes: [{ issue: 'invalid-range:intro', action: 'clamp-range' }],
    })
  })
})
