import { AlertTriangle, FileCode2, Image, PackageCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type {
  HyperFramesGenerationImportStrategy,
  HyperFramesSkillImportPreview,
} from '../bridges/skills-bridge'

export interface HyperFramesGenerationPreviewDrawerProps {
  open: boolean
  preview: HyperFramesSkillImportPreview
  confirming?: boolean
  onOpenChange: (open: boolean) => void
  onStrategyChange: (strategy: HyperFramesGenerationImportStrategy) => void
  onConfirm: () => void
  onDiscard: () => void
}

export function HyperFramesGenerationPreviewDrawer({
  open,
  preview,
  confirming = false,
  onOpenChange,
  onStrategyChange,
  onConfirm,
  onDiscard,
}: HyperFramesGenerationPreviewDrawerProps) {
  const { t } = useTranslation()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[88vh] max-w-5xl overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle className="text-base">{preview.title}</DialogTitle>
          <DialogDescription>{t('hyperframes.generationPreview.description')}</DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1.5fr)_minmax(280px,1fr)] overflow-hidden">
          <div className="min-h-0 border-r border-border bg-black p-3">
            {preview.previewDocument ? (
              <iframe
                title={t('hyperframes.generationPreview.iframeTitle')}
                srcDoc={preview.previewDocument.srcdoc}
                sandbox={preview.previewDocument.sandbox}
                className="h-full w-full border-0 bg-white"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-zinc-400">
                {t('hyperframes.generationPreview.unavailable')}
              </div>
            )}
          </div>

          <div className="min-h-0 space-y-4 overflow-y-auto p-4">
            <PreviewSection
              title={t('hyperframes.generationPreview.files', {
                count: preview.fileTree.length,
              })}
            >
              {preview.fileTree.slice(0, 12).map((file) => (
                <div
                  key={`${file.kind}:${file.path}`}
                  className="flex items-center gap-2 text-[11px]"
                >
                  {file.kind === 'asset' ? (
                    <Image className="h-3 w-3" />
                  ) : (
                    <FileCode2 className="h-3 w-3" />
                  )}
                  <span className="min-w-0 flex-1 truncate">{file.path}</span>
                  <span className="text-muted-foreground">{file.sizeBytes} B</span>
                </div>
              ))}
            </PreviewSection>

            <PreviewSection
              title={t('hyperframes.generationPreview.assets', {
                count: preview.assets.length,
              })}
            >
              {preview.assets.length === 0 ? (
                <span className="text-[11px] text-muted-foreground">
                  {t('hyperframes.generationPreview.noExternalAssets')}
                </span>
              ) : (
                preview.assets.slice(0, 8).map((asset) => (
                  <div key={asset.path} className="truncate text-[11px]">
                    {asset.path}
                  </div>
                ))
              )}
            </PreviewSection>

            <PreviewSection
              title={t('hyperframes.common.diagnostics', {
                count: preview.diagnostics.length,
              })}
            >
              {preview.diagnostics.length === 0 ? (
                <span className="text-[11px] text-emerald-500">
                  {t('hyperframes.common.noDiagnostics')}
                </span>
              ) : (
                preview.diagnostics.slice(0, 8).map((diagnostic) => (
                  <div key={diagnostic.id} className="flex gap-2 text-[11px]">
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" />
                    <span>{diagnostic.message}</span>
                  </div>
                ))
              )}
            </PreviewSection>

            <PreviewSection title={t('hyperframes.generationPreview.manifest')}>
              <pre className="max-h-36 overflow-auto rounded bg-secondary/50 p-2 text-[10px]">
                {JSON.stringify(preview.manifest ?? {}, null, 2)}
              </pre>
            </PreviewSection>

            <PreviewSection title={t('hyperframes.generationPreview.modelUsage')}>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <span className="text-muted-foreground">{t('hyperframes.common.models')}</span>
                <span className="text-right">{preview.modelUsage.length}</span>
                <span className="text-muted-foreground">{t('hyperframes.common.inputTokens')}</span>
                <span className="text-right">{preview.costSummary.inputTokens}</span>
                <span className="text-muted-foreground">
                  {t('hyperframes.common.outputTokens')}
                </span>
                <span className="text-right">{preview.costSummary.outputTokens}</span>
                <span className="text-muted-foreground">
                  {t('hyperframes.common.estimatedCost')}
                </span>
                <span className="text-right">
                  ${preview.costSummary.estimatedCost.toFixed(4)}{' '}
                  {preview.costSummary.currency ?? 'USD'}
                </span>
              </div>
            </PreviewSection>

            <PreviewSection title={t('hyperframes.generationPreview.importStrategy')}>
              <Select
                value={preview.selectedImportStrategy}
                onValueChange={(value) =>
                  onStrategyChange(value as HyperFramesGenerationImportStrategy)
                }
              >
                <SelectTrigger
                  aria-label={t('hyperframes.generationPreview.importStrategy')}
                  className="h-8 text-xs"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {preview.importStrategyOptions.map((option) => (
                    <SelectItem
                      key={option.strategy}
                      value={option.strategy}
                      disabled={!option.enabled}
                    >
                      {formatStrategy(option.strategy, t)}
                      {option.recommended ? ` (${t('hyperframes.common.recommended')})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </PreviewSection>
          </div>
        </div>

        <DialogFooter className="border-t border-border px-5 py-3">
          <Button type="button" variant="ghost" onClick={onDiscard}>
            {t('hyperframes.generationPreview.discard')}
          </Button>
          <Button
            type="button"
            disabled={!preview.canConfirmImport || confirming}
            onClick={onConfirm}
          >
            <PackageCheck className="h-4 w-4" />
            {confirming
              ? t('hyperframes.generationPreview.importing')
              : t('hyperframes.generationPreview.confirmImport')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function PreviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2 border-b border-border pb-4 last:border-b-0">
      <h3 className="text-[11px] font-semibold uppercase text-muted-foreground">{title}</h3>
      {children}
    </section>
  )
}

function formatStrategy(strategy: HyperFramesGenerationImportStrategy, t: TFunction): string {
  if (strategy === 'source-link') return t('hyperframes.generationPreview.strategies.sourceLink')
  if (strategy === 'source-link-with-approximations') {
    return t('hyperframes.generationPreview.strategies.sourceLinkWithApproximations')
  }
  return t('hyperframes.generationPreview.strategies.renderedMedia')
}
