export interface TreeNode {
  name: string
  fullPath: string
  children: Map<string, TreeNode>
  isFile: boolean
}

export interface ContextMenuState {
  x: number
  y: number
  targetPath: string
  targetIsFolder: boolean
}

export interface InlineInputState {
  /** Parent folder path (empty string for root) */
  parentPath: string
  /** "file" or "folder" creation, or "rename" */
  mode: 'new-file' | 'new-folder' | 'rename'
  /** For rename mode, the original full path */
  originalPath?: string
  /** For rename mode, the original name */
  originalName?: string
  onCommit?: (name: string) => void
  onCancel?: () => void
}

export function buildTree(files: string[]): TreeNode {
  const root: TreeNode = { name: '', fullPath: '', children: new Map(), isFile: false }
  for (const file of files) {
    const parts = file.split('/')
    let current = root
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      if (!part) continue
      const isLast = i === parts.length - 1
      const fullPath = parts.slice(0, i + 1).join('/')
      if (!current.children.has(part)) {
        current.children.set(part, {
          name: part,
          fullPath,
          children: new Map(),
          isFile: isLast,
        })
      }
      current = current.children.get(part)!
      if (isLast) current.isFile = true
    }
  }
  return root
}

export function sortChildren(children: Map<string, TreeNode>): TreeNode[] {
  return Array.from(children.values()).sort((a, b) => {
    if (a.name === 'index.html') return -1
    if (b.name === 'index.html') return 1
    if (!a.isFile && b.isFile) return -1
    if (a.isFile && !b.isFile) return 1
    return a.name.localeCompare(b.name)
  })
}

export function isActiveInSubtree(node: TreeNode, activeFile: string | null): boolean {
  if (!activeFile) return false
  if (node.fullPath === activeFile) return true
  for (const child of node.children.values()) {
    if (isActiveInSubtree(child, activeFile)) return true
  }
  return false
}
