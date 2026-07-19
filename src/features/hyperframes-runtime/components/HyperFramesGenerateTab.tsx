import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Check,
  ChevronRight,
  Clock3,
  DollarSign,
  Layers3,
  Sparkles,
  WandSparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/shared/ui/cn'
import type { ModelRoutingPlan } from '../model-center'
import {
  confirmHyperFramesGenerationPlan,
  createHyperFramesGenerationPlan,
  type HyperFramesGenerationPlan,
} from '../bridges/skills-bridge/generationPlan'
import type { HyperFramesSkillDefinition } from '../bridges/skills-bridge/skillDirectoryParser'
import {
  recommendHyperFramesSkills,
  type HyperFramesGenerationIntentKind,
  type HyperFramesSkillRecommendationContext,
} from '../bridges/skills-bridge/skillRecommender'
import { hyperFramesUiSkillCatalog } from './uiSkillCatalog'

interface GenerateTemplate {
  id: string
  labelKey: string
  promptKey: string
  intentKind: HyperFramesGenerationIntentKind
  durationSeconds: number
  aspectRatio: string
  transparent: boolean
}

const GENERATE_TEMPLATES: GenerateTemplate[] = [
  {
    id: 'intro',
    labelKey: 'hyperframes.generate.templates.intro.label',
    promptKey: 'hyperframes.generate.templates.intro.prompt',
    intentKind: 'overlay',
    durationSeconds: 6,
    aspectRatio: '16:9',
    transparent: true,
  },
  {
    id: 'captions',
    labelKey: 'hyperframes.generate.templates.captions.label',
    promptKey: 'hyperframes.generate.templates.captions.prompt',
    intentKind: 'caption-package',
    durationSeconds: 30,
    aspectRatio: '16:9',
    transparent: true,
  },
  {
    id: 'product',
    labelKey: 'hyperframes.generate.templates.product.label',
    promptKey: 'hyperframes.generate.templates.product.prompt',
    intentKind: 'new-video',
    durationSeconds: 30,
    aspectRatio: '16:9',
    transparent: false,
  },
  {
    id: 'website',
    labelKey: 'hyperframes.generate.templates.website.label',
    promptKey: 'hyperframes.generate.templates.website.prompt',
    intentKind: 'new-video',
    durationSeconds: 30,
    aspectRatio: '16:9',
    transparent: false,
  },
  {
    id: 'motion',
    labelKey: 'hyperframes.generate.templates.motion.label',
    promptKey: 'hyperframes.generate.templates.motion.prompt',
    intentKind: 'overlay',
    durationSeconds: 8,
    aspectRatio: '16:9',
    transparent: true,
  },
  {
    id: 'music',
    labelKey: 'hyperframes.generate.templates.music.label',
    promptKey: 'hyperframes.generate.templates.music.prompt',
    intentKind: 'new-video',
    durationSeconds: 30,
    aspectRatio: '9:16',
    transparent: false,
  },
  {
    id: 'explainer',
    labelKey: 'hyperframes.generate.templates.explainer.label',
    promptKey: 'hyperframes.generate.templates.explainer.prompt',
    intentKind: 'new-video',
    durationSeconds: 60,
    aspectRatio: '16:9',
    transparent: false,
  },
]

const AVAILABLE_MODEL_CAPABILITIES = [
  'audio-generation',
  'image-generation',
  'text-planning',
  'transcription',
  'tts',
  'vision',
]

export interface HyperFramesGenerateTabProps {
  className?: string
  skillCatalog?: HyperFramesSkillDefinition[]
  onPlanReady?: (plan: HyperFramesGenerationPlan) => void
  onPlanConfirmed?: (plan: HyperFramesGenerationPlan) => boolean | void
}

export function HyperFramesGenerateTab({
  className,
  skillCatalog = hyperFramesUiSkillCatalog,
  onPlanReady,
  onPlanConfirmed,
}: HyperFramesGenerateTabProps) {
  const { t } = useTranslation()
  const [prompt, setPrompt] = useState('')
  const [intentKind, setIntentKind] = useState<HyperFramesGenerationIntentKind>('new-video')
  const [durationSeconds, setDurationSeconds] = useState(30)
  const [aspectRatio, setAspectRatio] = useState('16:9')
  const [transparent, setTransparent] = useState(false)
  const [activeTemplateId, setActiveTemplateId] = useState<string>()
  const [selectedSkillId, setSelectedSkillId] = useState<string>()
  const [plan, setPlan] = useState<HyperFramesGenerationPlan>()

  const context = useMemo(
    () => createRecommendationContext(prompt, intentKind, durationSeconds),
    [durationSeconds, intentKind, prompt],
  )
  const recommendations = useMemo(
    () => recommendHyperFramesSkills(skillCatalog, context).slice(0, 3),
    [context, skillCatalog],
  )
  const selectedRecommendation =
    recommendations.find((recommendation) => recommendation.skill.id === selectedSkillId) ??
    recommendations[0]

  const applyTemplate = (template: GenerateTemplate) => {
    setActiveTemplateId(template.id)
    setPrompt(t(template.promptKey))
    setIntentKind(template.intentKind)
    setDurationSeconds(template.durationSeconds)
    setAspectRatio(template.aspectRatio)
    setTransparent(template.transparent)
    setSelectedSkillId(undefined)
    setPlan(undefined)
  }

  const createPlan = () => {
    if (!selectedRecommendation || !prompt.trim()) return
    const nextPlan = createHyperFramesGenerationPlan({
      recommendation: selectedRecommendation,
      context,
      modelRoutingPlan: createUiRoutingPlan(selectedRecommendation.skill),
      projectSlug: `${selectedRecommendation.skill.id}-draft`,
    })
    setPlan(nextPlan)
    onPlanReady?.(nextPlan)
  }

  const confirmPlan = () => {
    if (!plan) return
    const confirmedPlan = confirmHyperFramesGenerationPlan(plan, { confirmedBy: 'freecut-user' })
    if (onPlanConfirmed?.(confirmedPlan) === false) return
    setPlan(confirmedPlan)
  }

  const updatePrompt = (value: string) => {
    setPrompt(value)
    setIntentKind(inferIntentKind(value))
    setActiveTemplateId(undefined)
    setSelectedSkillId(undefined)
    setPlan(undefined)
  }

  return (
    <section className={cn('space-y-3 border-b border-border pb-3', className)}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <WandSparkles className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-medium">{t('hyperframes.generate.title')}</h2>
        </div>
        <span className="text-[10px] text-muted-foreground">
          {t('hyperframes.generate.sourceLinked')}
        </span>
      </div>

      <div
        className="grid grid-cols-4 gap-1.5"
        aria-label={t('hyperframes.generate.quickTemplates')}
      >
        {GENERATE_TEMPLATES.map((template) => (
          <Button
            key={template.id}
            type="button"
            size="sm"
            variant={activeTemplateId === template.id ? 'secondary' : 'outline'}
            className="h-7 min-w-0 px-1.5 text-[10px]"
            onClick={() => applyTemplate(template)}
          >
            {t(template.labelKey)}
          </Button>
        ))}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="hyperframes-generate-prompt" className="text-xs">
          {t('hyperframes.generate.describeResult')}
        </Label>
        <Textarea
          id="hyperframes-generate-prompt"
          value={prompt}
          onChange={(event) => updatePrompt(event.target.value)}
          placeholder={t('hyperframes.generate.promptPlaceholder')}
          className="min-h-20 resize-y bg-secondary/30 text-xs"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label htmlFor="hyperframes-duration" className="text-[11px] text-muted-foreground">
            {t('hyperframes.generate.duration')}
          </Label>
          <Select
            value={String(durationSeconds)}
            onValueChange={(value) => {
              setDurationSeconds(Number(value))
              setPlan(undefined)
            }}
          >
            <SelectTrigger id="hyperframes-duration" className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[6, 8, 15, 30, 60].map((seconds) => (
                <SelectItem key={seconds} value={String(seconds)}>
                  {t('hyperframes.common.seconds', { count: seconds })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="hyperframes-aspect" className="text-[11px] text-muted-foreground">
            {t('hyperframes.generate.frame')}
          </Label>
          <Select
            value={aspectRatio}
            onValueChange={(value) => {
              setAspectRatio(value)
              setPlan(undefined)
            }}
          >
            <SelectTrigger id="hyperframes-aspect" className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="16:9">{t('hyperframes.generate.landscape')}</SelectItem>
              <SelectItem value="9:16">{t('hyperframes.generate.portrait')}</SelectItem>
              <SelectItem value="1:1">{t('hyperframes.generate.square')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {selectedRecommendation && prompt.trim() && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium">
              {t('hyperframes.generate.recommendedSkills')}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {t('hyperframes.generate.matches', { count: recommendations.length })}
            </span>
          </div>
          <div className="space-y-1">
            {recommendations.map((recommendation) => {
              const selected = recommendation.skill.id === selectedRecommendation.skill.id
              return (
                <button
                  key={recommendation.skill.id}
                  type="button"
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left',
                    selected ? 'border-primary/50 bg-primary/10' : 'border-border hover:bg-accent',
                  )}
                  onClick={() => {
                    setSelectedSkillId(recommendation.skill.id)
                    setPlan(undefined)
                  }}
                >
                  <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />
                  <span className="min-w-0 flex-1 truncate text-xs">
                    {t(`hyperframes.skills.${recommendation.skill.id}`, {
                      defaultValue: formatSkillTitle(recommendation.skill.id),
                    })}
                  </span>
                  <span className="text-[10px] tabular-nums text-muted-foreground">
                    {recommendation.score}
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              )
            })}
          </div>
        </div>
      )}

      {selectedRecommendation && prompt.trim() && (
        <OutputSummary
          aspectRatio={aspectRatio}
          durationSeconds={durationSeconds}
          plan={plan}
          skill={selectedRecommendation.skill}
          transparent={
            transparent ||
            ['embedded-captions', 'motion-graphics', 'talking-head-recut'].includes(
              selectedRecommendation.skill.id,
            )
          }
        />
      )}

      <div className="flex justify-end gap-2">
        {plan && plan.status === 'draft' && (
          <Button type="button" size="sm" variant="outline" onClick={confirmPlan}>
            <Check className="h-3.5 w-3.5" />
            {t('hyperframes.generate.confirmPlan')}
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          onClick={createPlan}
          disabled={!prompt.trim() || !selectedRecommendation || plan?.status === 'confirmed'}
        >
          <WandSparkles className="h-3.5 w-3.5" />
          {plan?.status === 'confirmed'
            ? t('hyperframes.generate.planConfirmed')
            : plan
              ? t('hyperframes.generate.updatePlan')
              : t('hyperframes.generate.createPlan')}
        </Button>
      </div>
    </section>
  )
}

function OutputSummary({
  aspectRatio,
  durationSeconds,
  plan,
  skill,
  transparent,
}: {
  aspectRatio: string
  durationSeconds: number
  plan?: HyperFramesGenerationPlan
  skill: HyperFramesSkillDefinition
  transparent: boolean
}) {
  const { t } = useTranslation()
  const capabilities = skill.modelRequirements.map((requirement) => requirement.kind)
  const importStrategy = plan?.importStrategy ?? inferUiImportStrategy(skill.id)
  const estimatedCost = plan?.modelBudget.estimatedMaxCost ?? estimateSkillCost(skill)

  return (
    <div
      className="space-y-2 rounded-md border border-border bg-secondary/20 p-2.5"
      aria-label={t('hyperframes.generate.summaryLabel')}
    >
      <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-[11px]">
        <SummaryValue
          icon={Layers3}
          label={t('hyperframes.generate.output')}
          value={t('hyperframes.generate.projectDirectory')}
        />
        <SummaryValue
          icon={Clock3}
          label={t('hyperframes.generate.estimate')}
          value={t('hyperframes.generate.estimateValue', {
            seconds: durationSeconds,
            minutes: Math.max(1, Math.ceil(durationSeconds / 6)),
          })}
        />
        <SummaryValue
          icon={DollarSign}
          label={t('hyperframes.generate.maxCost')}
          value={`$${estimatedCost.toFixed(2)} USD`}
        />
        <SummaryValue icon={Sparkles} label={t('hyperframes.generate.frame')} value={aspectRatio} />
      </div>
      <div className="flex flex-wrap gap-1">
        {(capabilities.length > 0 ? capabilities : ['text-planning']).map((capability) => (
          <span
            key={capability}
            className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground"
          >
            {t(`hyperframes.enums.${capability.replaceAll('-', '_')}`, {
              defaultValue: capability,
            })}
          </span>
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
        <span>
          {transparent
            ? t('hyperframes.generate.transparentBackground')
            : t('hyperframes.generate.opaqueBackground')}
        </span>
        <span>
          {importStrategy === 'rendered-media'
            ? t('hyperframes.generate.renderedMedia')
            : t('hyperframes.generate.sourceLinkedComposition')}
        </span>
        <span>
          {importStrategy === 'source-link-with-approximations'
            ? t('hyperframes.generate.nativeApproximations')
            : t('hyperframes.generate.noNativeApproximations')}
        </span>
      </div>
      {plan && (
        <div className="border-t border-border pt-2 text-[10px] text-muted-foreground">
          {t('hyperframes.generate.stepsAndDirectory', {
            count: plan.steps.length,
            directory: plan.output.directory,
          })}
        </div>
      )}
    </div>
  )
}

function SummaryValue({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Clock3
  label: string
  value: string
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="truncate font-medium text-foreground">{value}</div>
    </div>
  )
}

function createRecommendationContext(
  prompt: string,
  intentKind: HyperFramesGenerationIntentKind,
  durationSeconds: number,
): HyperFramesSkillRecommendationContext {
  const url = prompt.match(/https?:\/\/[^\s]+/i)?.[0]
  return {
    userText: prompt,
    intentKind,
    modelCapabilities: AVAILABLE_MODEL_CAPABILITIES,
    materials: [
      ...(url ? [{ id: 'prompt-url', type: 'url' as const, uri: url }] : []),
      { id: 'target-duration', type: 'text' as const, durationFrames: durationSeconds * 30 },
    ],
  }
}

function inferIntentKind(prompt: string): HyperFramesGenerationIntentKind {
  if (/caption|subtitle|字幕/i.test(prompt)) return 'caption-package'
  if (/motion graphics?|overlay|lower[- ]third|callout|动态图形|动效|标题动画/i.test(prompt)) {
    return 'overlay'
  }
  if (/recut|重剪|图文包装|访谈包装/i.test(prompt)) return 'recut'
  return 'new-video'
}

function createUiRoutingPlan(skill: HyperFramesSkillDefinition): ModelRoutingPlan {
  return {
    routes: [],
    missing: [],
    estimatedMaxCost: estimateSkillCost(skill),
    requiresNetwork: true,
    requiresConfirmation: true,
    canProceed: true,
  }
}

function estimateSkillCost(skill: HyperFramesSkillDefinition): number {
  return Math.max(0.02, skill.modelRequirements.length * 0.025)
}

function inferUiImportStrategy(skillId: string) {
  if (skillId === 'embedded-captions' || skillId === 'music-to-video') return 'rendered-media'
  if (['product-launch-video', 'faceless-explainer', 'pr-to-video'].includes(skillId)) {
    return 'source-link-with-approximations'
  }
  return 'source-link'
}

function formatSkillTitle(skillId: string): string {
  return skillId
    .split('-')
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(' ')
}
