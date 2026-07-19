import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { AlertTriangle, Download, ExternalLink, RefreshCw, Save, WandSparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import type { HyperFramesProjectManifest } from '@/types/hyperframes'
import type { CompositionItem } from '@/types/timeline'
import {
  emitHyperFramesProjectUpdated,
  subscribeHyperFramesProjectUpdated,
} from '../events/projectEvents'
import { createWorkspaceHyperFramesProjectRepository } from '../adapters/freecut-project/file-system-project-repository'
import type { HyperFramesProjectRepository } from '../adapters/freecut-project/project-repository'
import { emitFreeCutStudioOpenRequest } from '../bridges/studio-bridge/studioEvents'
import {
  emitHyperFramesTimelineAction,
  type HyperFramesTimelineAction,
} from '../bridges/studio-bridge/timelineActions'

export interface HyperFramesPropertiesPanelProps {
  item: CompositionItem & { sourceKind: 'hyperframes' }
  repository?: HyperFramesProjectRepository
  freecutProjectId?: string
  onAction?: (action: HyperFramesTimelineAction | 'open-studio') => void
}

export function HyperFramesPropertiesPanel({
  item,
  repository,
  freecutProjectId,
  onAction,
}: HyperFramesPropertiesPanelProps) {
  const { t } = useTranslation()
  const [manifest, setManifest] = useState<HyperFramesProjectManifest>()
  const [variableDraft, setVariableDraft] = useState<Record<string, unknown>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string>()
  const [projectRevision, setProjectRevision] = useState(0)
  const resolvedRepository = useMemo(() => {
    if (repository) return repository
    try {
      return createWorkspaceHyperFramesProjectRepository({ freecutProjectId })
    } catch {
      return undefined
    }
  }, [freecutProjectId, repository])
  const projectId = item.hyperframesProjectId ?? item.compositionId

  useEffect(
    () =>
      subscribeHyperFramesProjectUpdated((updatedProjectId) => {
        if (updatedProjectId === projectId) setProjectRevision((revision) => revision + 1)
      }),
    [projectId],
  )

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(undefined)
    if (!resolvedRepository) {
      setLoading(false)
      setError(t('hyperframes.properties.repositoryUnavailable'))
      return
    }
    void resolvedRepository
      .readManifest(projectId)
      .then((nextManifest) => {
        if (cancelled) return
        if (!nextManifest) throw new Error(t('hyperframes.properties.manifestNotFound'))
        setManifest(nextManifest)
        setVariableDraft(structuredClone(nextManifest.variables ?? {}))
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(
            loadError instanceof Error ? loadError.message : t('hyperframes.properties.loadFailed'),
          )
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [projectId, projectRevision, resolvedRepository, t])

  const saveVariables = async () => {
    if (!manifest || !resolvedRepository) return
    setSaving(true)
    try {
      const nextManifest = { ...manifest, variables: structuredClone(variableDraft) }
      await resolvedRepository.writeManifest(projectId, nextManifest, {
        reason: 'Save HyperFrames variables from FreeCut properties panel',
      })
      setManifest(nextManifest)
      emitHyperFramesProjectUpdated(projectId)
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : t('hyperframes.properties.saveFailed'),
      )
    } finally {
      setSaving(false)
    }
  }

  const runAction = (action: HyperFramesTimelineAction | 'open-studio') => {
    onAction?.(action)
    if (onAction) return
    if (action === 'open-studio') {
      emitFreeCutStudioOpenRequest({ item })
    } else {
      emitHyperFramesTimelineAction(action, item)
    }
  }

  if (loading) {
    return (
      <div className="text-xs text-muted-foreground">{t('hyperframes.properties.loading')}</div>
    )
  }
  if (error && !manifest) return <div className="text-xs text-destructive">{error}</div>
  if (!manifest) return null

  const diagnostics = manifest.lintSummary?.diagnostics ?? manifest.diagnostics ?? []
  const modelUsage = manifest.provenance.modelUsage

  return (
    <div className="space-y-4" data-testid="hyperframes-properties-panel">
      {error && <div className="text-xs text-destructive">{error}</div>}

      <PropertyGroup title={t('hyperframes.properties.sourceClip')}>
        <PropertyValue label={t('hyperframes.properties.clip')} value={item.label} />
        <PropertyValue label={t('hyperframes.properties.project')} value={manifest.title} />
        <PropertyValue
          label={t('hyperframes.properties.composition')}
          value={manifest.activeCompositionPath}
        />
        <PropertyValue
          label={t('hyperframes.properties.canvas')}
          value={`${manifest.canvas.width}x${manifest.canvas.height} · ${manifest.canvas.fps} fps`}
        />
        <PropertyValue
          label={t('hyperframes.properties.sourceDuration')}
          value={t('hyperframes.common.frames', {
            count: manifest.canvas.durationInFrames,
          })}
        />
        <PropertyValue
          label={t('hyperframes.properties.timeline')}
          value={t('hyperframes.properties.timelineValue', {
            from: item.from,
            duration: item.durationInFrames,
          })}
        />
      </PropertyGroup>

      <PropertyGroup title={t('hyperframes.properties.variables')}>
        {Object.keys(variableDraft).length === 0 ? (
          <div className="text-[11px] text-muted-foreground">
            {t('hyperframes.properties.noVariables')}
          </div>
        ) : (
          Object.entries(variableDraft).map(([name, value]) => (
            <VariableControl
              key={name}
              name={name}
              value={value}
              onChange={(nextValue) =>
                setVariableDraft((current) => ({ ...current, [name]: nextValue }))
              }
            />
          ))
        )}
        <Button
          type="button"
          size="sm"
          className="w-full"
          disabled={saving}
          onClick={() => void saveVariables()}
        >
          <Save className="h-3.5 w-3.5" />
          {saving ? t('hyperframes.properties.saving') : t('hyperframes.properties.saveVariables')}
        </Button>
      </PropertyGroup>

      <PropertyGroup title={t('hyperframes.properties.generationSource')}>
        <PropertyValue
          label={t('hyperframes.properties.source')}
          value={translateEnum(t, manifest.provenance.source)}
        />
        <PropertyValue
          label={t('hyperframes.properties.skill')}
          value={manifest.provenance.skillId ?? t('hyperframes.properties.notRecorded')}
        />
        <PropertyValue
          label={t('hyperframes.properties.prompt')}
          value={manifest.provenance.promptSummary ?? t('hyperframes.properties.notRecorded')}
        />
        <PropertyValue
          label={t('hyperframes.properties.model')}
          value={modelUsage?.modelId ?? t('hyperframes.properties.notRecorded')}
        />
        <PropertyValue
          label={t('hyperframes.common.estimatedCost')}
          value={
            modelUsage?.estimatedCost === undefined
              ? t('hyperframes.properties.notRecorded')
              : `${modelUsage.estimatedCost.toFixed(4)} ${modelUsage.currency ?? 'USD'}`
          }
        />
      </PropertyGroup>

      <PropertyGroup title={t('hyperframes.common.diagnostics', { count: diagnostics.length })}>
        {diagnostics.length === 0 ? (
          <div className="text-[11px] text-emerald-500">
            {t('hyperframes.properties.noReportedDiagnostics')}
          </div>
        ) : (
          diagnostics.slice(0, 6).map((diagnostic) => (
            <div key={diagnostic.id} className="flex gap-2 text-[11px]">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" />
              <span>{diagnostic.message}</span>
            </div>
          ))
        )}
      </PropertyGroup>

      <PropertyGroup title={t('hyperframes.properties.render')}>
        <PropertyValue
          label={t('hyperframes.properties.cache')}
          value={translateEnum(t, item.hyperframesVisualState?.cacheStatus ?? 'missing')}
        />
        <PropertyValue
          label={t('hyperframes.properties.status')}
          value={translateEnum(t, item.hyperframesVisualState?.renderStatus ?? 'idle')}
        />
        <PropertyValue
          label={t('hyperframes.properties.engine')}
          value={
            manifest.renderSignature
              ? t('hyperframes.properties.cachedProducerOutput')
              : t('hyperframes.properties.liveSourcePreview')
          }
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="w-full"
          onClick={() => runAction('rerender')}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          {t('hyperframes.properties.rerenderCache')}
        </Button>
      </PropertyGroup>

      <PropertyGroup title={t('hyperframes.properties.actions')}>
        <div className="grid grid-cols-2 gap-2">
          <ActionButton
            icon={ExternalLink}
            label={t('hyperframes.properties.openStudio')}
            onClick={() => runAction('open-studio')}
          />
          <ActionButton
            icon={Download}
            label={t('hyperframes.properties.exportSource')}
            onClick={() => runAction('export-project')}
          />
          <ActionButton
            icon={WandSparkles}
            label={t('hyperframes.properties.regenerate')}
            onClick={() => runAction('rerender')}
          />
          <ActionButton
            icon={RefreshCw}
            label={t('hyperframes.properties.toNative')}
            onClick={() => runAction('convert-to-native')}
          />
        </div>
      </PropertyGroup>
    </div>
  )
}

function PropertyGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2 border-b border-border pb-4 last:border-b-0">
      <h3 className="text-[11px] font-semibold uppercase text-muted-foreground">{title}</h3>
      {children}
    </section>
  )
}

function PropertyValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-2 text-[11px]">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0 break-words text-right">{value}</span>
    </div>
  )
}

function VariableControl({
  name,
  value,
  onChange,
}: {
  name: string
  value: unknown
  onChange: (value: unknown) => void
}) {
  if (typeof value === 'boolean') {
    return (
      <label className="flex items-center justify-between gap-2 text-[11px]">
        <span>{name}</span>
        <Switch checked={value} onCheckedChange={onChange} aria-label={name} />
      </label>
    )
  }
  const inputType = typeof value === 'number' ? 'number' : isColor(value) ? 'color' : 'text'
  return (
    <label className="space-y-1 text-[11px]">
      <span>{name}</span>
      <Input
        aria-label={name}
        type={inputType}
        value={serializeVariable(value)}
        className="h-8 text-xs"
        onChange={(event) =>
          onChange(inputType === 'number' ? Number(event.target.value) : event.target.value)
        }
      />
    </label>
  )
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Save
  label: string
  onClick: () => void
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="min-w-0 px-2 text-[10px]"
      onClick={onClick}
    >
      <Icon className="h-3.5 w-3.5" />
      <span className="truncate">{label}</span>
    </Button>
  )
}

function isColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)
}

function serializeVariable(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  return JSON.stringify(value)
}

function translateEnum(t: TFunction, value: string): string {
  return t(`hyperframes.enums.${value.replaceAll(/[.-]/g, '_')}`, { defaultValue: value })
}
