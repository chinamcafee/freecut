export interface StudioUndoEntry {
  label: string
  undo: () => void
}

export interface StudioUndoBridge {
  canUndo: () => boolean
  push: (entry: StudioUndoEntry) => void
  undo: () => boolean
  clear: () => void
}

export function createStudioUndoBridge(): StudioUndoBridge {
  const stack: StudioUndoEntry[] = []

  return {
    canUndo: () => stack.length > 0,
    push: (entry) => {
      stack.push(entry)
    },
    undo: () => {
      const entry = stack.pop()
      if (!entry) return false
      entry.undo()
      return true
    },
    clear: () => {
      stack.length = 0
    },
  }
}
