export interface FreeCutStudioSelection {
  elementId?: string
  selector?: string
  sourceFile?: string
  startOffset?: number
  endOffset?: number
}

export interface RuntimeStudioSelectionMessage {
  elementId?: unknown
  selector?: unknown
  file?: unknown
  range?: {
    start?: unknown
    end?: unknown
  }
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined
}

function asFiniteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

export function mapRuntimeSelectionToStudioSelection(
  message: RuntimeStudioSelectionMessage,
): FreeCutStudioSelection {
  return {
    elementId: asString(message.elementId),
    selector: asString(message.selector),
    sourceFile: asString(message.file),
    startOffset: asFiniteNumber(message.range?.start),
    endOffset: asFiniteNumber(message.range?.end),
  }
}

export function normalizeStudioSelection(
  selection: FreeCutStudioSelection | null,
): FreeCutStudioSelection | null {
  if (!selection) return null
  const normalized = {
    elementId: asString(selection.elementId),
    selector: asString(selection.selector),
    sourceFile: asString(selection.sourceFile),
    startOffset: asFiniteNumber(selection.startOffset),
    endOffset: asFiniteNumber(selection.endOffset),
  }
  return Object.values(normalized).some((value) => value !== undefined) ? normalized : null
}
