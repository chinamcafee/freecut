import type { HyperFramesIntegrationState } from '@/types/hyperframes'
import type { TimelineItem } from '@/types/timeline'
import { resolveHyperFramesCompositionInfo } from './composition-links'

export type HyperFramesCompositionActionId =
  | 'open-studio'
  | 'convert-to-freecut-compound'
  | 'export-project'

export interface HyperFramesCompositionAction {
  id: HyperFramesCompositionActionId
  label: string
  shortcut?: string
  disabled: boolean
  reason?: string
}

export function getHyperFramesCompositionActions(
  item: TimelineItem,
  hyperframes?: HyperFramesIntegrationState,
): HyperFramesCompositionAction[] {
  const info = resolveHyperFramesCompositionInfo(item, hyperframes)
  const missingProject = info.isHyperFramesBacked && !info.manifest
  const disabled = !info.isHyperFramesBacked || missingProject
  const reason = !info.isHyperFramesBacked
    ? 'Not a HyperFrames-backed composition'
    : missingProject
      ? 'Missing HyperFrames project manifest'
      : undefined

  return [
    {
      id: 'open-studio',
      label: 'Open HyperFrames Studio',
      shortcut: 'Enter',
      disabled,
      reason,
    },
    {
      id: 'convert-to-freecut-compound',
      label: 'Convert to FreeCut compound clip',
      disabled,
      reason,
    },
    {
      id: 'export-project',
      label: 'Export HyperFrames project',
      shortcut: 'Mod+Shift+E',
      disabled,
      reason,
    },
  ]
}

export function getHyperFramesCompositionShortcut(actionId: HyperFramesCompositionActionId): string {
  switch (actionId) {
    case 'open-studio':
      return 'Enter'
    case 'export-project':
      return 'Mod+Shift+E'
    case 'convert-to-freecut-compound':
      return 'Mod+Shift+C'
  }
}
