import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { HyperFramesGenerationImportStrategy } from '../bridges/skills-bridge'
import {
  subscribeHyperFramesGenerationPreview,
  type HyperFramesGenerationPreviewRequest,
} from '../events/generationPreviewEvents'
import { HyperFramesGenerationPreviewDrawer } from './HyperFramesGenerationPreviewDrawer'

export function HyperFramesGenerationPreviewController() {
  const [request, setRequest] = useState<HyperFramesGenerationPreviewRequest>()
  const [confirming, setConfirming] = useState(false)

  useEffect(
    () =>
      subscribeHyperFramesGenerationPreview((nextRequest) => {
        setConfirming(false)
        setRequest(nextRequest)
      }),
    [],
  )

  const discard = useCallback(async () => {
    if (!request) return
    setRequest(undefined)
    try {
      await request.onDiscard?.(request.preview)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to discard generated output')
    }
  }, [request])

  const changeStrategy = useCallback(
    (strategy: HyperFramesGenerationImportStrategy) => {
      if (!request) return
      const nextPreview = { ...request.preview, selectedImportStrategy: strategy }
      setRequest({ ...request, preview: nextPreview })
      void request.onStrategyChange?.(strategy, nextPreview)
    },
    [request],
  )

  const confirm = useCallback(async () => {
    if (!request || confirming) return
    setConfirming(true)
    try {
      await request.onConfirm(request.preview)
      setRequest(undefined)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to import generated output')
    } finally {
      setConfirming(false)
    }
  }, [confirming, request])

  if (!request) return null

  return (
    <HyperFramesGenerationPreviewDrawer
      open
      preview={request.preview}
      confirming={confirming}
      onOpenChange={(open) => {
        if (!open) void discard()
      }}
      onStrategyChange={changeStrategy}
      onConfirm={() => void confirm()}
      onDiscard={() => void discard()}
    />
  )
}
