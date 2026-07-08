import type { HyperFramesProjectDirectory } from '@/types/hyperframes'

export interface StudioProjectSummary {
  id: string
  name: string
  activeCompositionPath: string
  signature: string
}

export interface StudioSelectionState {
  activeCompositionPath: string
  selectedNodeId?: string
}

export interface StudioLintDiagnostic {
  code: 'unsafe-script' | 'unsafe-attribute' | 'missing-composition'
  message: string
  severity: 'error' | 'warning'
}

export interface StudioRenderJobState {
  id: string
  projectId: string
  status: 'queued' | 'rendering' | 'complete' | 'failed' | 'cancelled'
  engine: 'dry-run' | 'producer'
  progress: number
}

export interface StudioApiAdapter {
  listProjects(): Promise<StudioProjectSummary[]>
  resolveProject(projectId: string): Promise<{
    projectDirectory: HyperFramesProjectDirectory
    manifest: HyperFramesProjectDirectory['manifest']
    signature: string
  }>
  readFile(projectId: string, path: string): Promise<string>
  writeFile(projectId: string, path: string, contents: string): Promise<{ hash: string }>
  createFile(projectId: string, path: string, contents: string): Promise<{ hash: string }>
  deleteFile(projectId: string, path: string): Promise<void>
  patchFile(
    projectId: string,
    path: string,
    patches: Array<{ search: string; replace: string }>,
  ): Promise<{ hash: string }>
  bundle(projectId: string, activeCompositionPath: string): Promise<{ html: string; signature: string }>
  lint(projectId: string, html?: string): Promise<{ diagnostics: StudioLintDiagnostic[] }>
  getSelection(projectId: string): Promise<StudioSelectionState | null>
  putSelection(projectId: string, selection: StudioSelectionState): Promise<void>
  thumbnail(
    projectId: string,
    activeCompositionPath: string,
  ): Promise<{ path: string; svg: string; signature: string }>
  waveform(projectId: string, assetId: string): Promise<{ assetId: string; peaks: number[] }>
  registry: {
    listBlocks(): Promise<Array<{ id: string; name: string }>>
    installBlock(projectId: string, blockId: string): Promise<{ path: string }>
  }
  startRender(projectId: string, options?: { dryRun?: boolean }): Promise<StudioRenderJobState>
}

export function createHyperCutStudioAdapter(params: {
  projects: HyperFramesProjectDirectory[]
}): StudioApiAdapter {
  const projects = new Map(
    params.projects.map((project) => [
      project.projectId,
      {
        ...project,
        files: { ...project.files },
      },
    ]),
  )
  const selections = new Map<string, StudioSelectionState>()
  const renderJobs = new Map<string, StudioRenderJobState>()

  const getProject = (projectId: string): HyperFramesProjectDirectory => {
    const project = projects.get(projectId)
    if (!project) throw new Error(`Missing HyperFrames project: ${projectId}`)
    return project
  }

  const readFileSync = (projectId: string, path: string): string => {
    const safePath = safeProjectPath(path)
    const project = getProject(projectId)
    const contents = project.files[safePath]
    if (contents === undefined) throw new Error(`Missing file: ${safePath}`)
    return contents
  }

  const writeFileSync = (projectId: string, path: string, contents: string): { hash: string } => {
    const safePath = safeProjectPath(path)
    const project = getProject(projectId)
    project.files[safePath] = contents
    project.fileIndex = Object.entries(project.files).map(([filePath, fileContents]) => ({
      path: filePath,
      contents: fileContents,
      kind:
        filePath === 'manifest.json'
          ? 'manifest'
          : filePath === project.entryFile
            ? 'entry'
            : filePath.startsWith('compositions/')
              ? 'composition'
              : 'metadata',
      hash: stableHash(fileContents),
    }))
    project.manifest.updatedAt += 1
    return { hash: stableHash(contents) }
  }

  return {
    async listProjects() {
      return Array.from(projects.values()).map((project) => ({
        id: project.projectId,
        name: project.manifest.name,
        activeCompositionPath: project.manifest.activeCompositionPath,
        signature: projectSignature(project),
      }))
    },
    async resolveProject(projectId) {
      const projectDirectory = getProject(projectId)
      return {
        projectDirectory,
        manifest: projectDirectory.manifest,
        signature: projectSignature(projectDirectory),
      }
    },
    async readFile(projectId, path) {
      return readFileSync(projectId, path)
    },
    async writeFile(projectId, path, contents) {
      readFileSync(projectId, path)
      return writeFileSync(projectId, path, contents)
    },
    async createFile(projectId, path, contents) {
      const safePath = safeProjectPath(path)
      const project = getProject(projectId)
      if (project.files[safePath] !== undefined) throw new Error(`File already exists: ${safePath}`)
      return writeFileSync(projectId, safePath, contents)
    },
    async deleteFile(projectId, path) {
      const safePath = safeProjectPath(path)
      const project = getProject(projectId)
      if (project.files[safePath] === undefined) throw new Error(`Missing file: ${safePath}`)
      delete project.files[safePath]
      project.fileIndex = project.fileIndex.filter((file) => file.path !== safePath)
      project.manifest.updatedAt += 1
    },
    async patchFile(projectId, path, patches) {
      let next = readFileSync(projectId, path)
      for (const patch of patches) {
        next = next.replaceAll(patch.search, patch.replace)
      }
      return writeFileSync(projectId, path, next)
    },
    async bundle(projectId, activeCompositionPath) {
      const project = getProject(projectId)
      const html = readFileSync(projectId, activeCompositionPath)
      return {
        html: `<!doctype html><html><body data-project-id="${projectId}">${html}</body></html>`,
        signature: projectSignature(project),
      }
    },
    async lint(projectId, html) {
      const project = getProject(projectId)
      const source = html ?? project.files[project.manifest.activeCompositionPath] ?? ''
      return { diagnostics: lintHyperframeHtml(source, project) }
    },
    async getSelection(projectId) {
      getProject(projectId)
      return selections.get(projectId) ?? null
    },
    async putSelection(projectId, selection) {
      getProject(projectId)
      safeProjectPath(selection.activeCompositionPath)
      selections.set(projectId, selection)
    },
    async thumbnail(projectId, activeCompositionPath) {
      const project = getProject(projectId)
      const safePath = safeProjectPath(activeCompositionPath)
      const signature = projectSignature(project)
      const fileSlug = safePath.replaceAll('/', '-').replaceAll('.', '-')
      return {
        path: `${project.rootPath}/thumbnails/${fileSlug}.svg`,
        svg: `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><text x="16" y="90">${safePath}</text></svg>`,
        signature,
      }
    },
    async waveform(projectId, assetId) {
      const project = getProject(projectId)
      if (!project.assets.some((asset) => asset.id === assetId)) {
        throw new Error(`Missing asset: ${assetId}`)
      }
      return {
        assetId,
        peaks: [0, 0.25, 0.5, 0.25, 0],
      }
    },
    registry: {
      async listBlocks() {
        return [{ id: 'headline-basic', name: 'Headline Basic' }]
      },
      async installBlock(projectId, blockId) {
        if (blockId !== 'headline-basic') throw new Error(`Unknown block: ${blockId}`)
        const path = 'blocks/headline-basic.html'
        writeFileSync(
          projectId,
          path,
          '<section data-hf-block="headline-basic"><h1>Headline</h1></section>',
        )
        return { path }
      },
    },
    async startRender(projectId, options) {
      getProject(projectId)
      const job: StudioRenderJobState = {
        id: `render-${renderJobs.size + 1}`,
        projectId,
        status: 'queued',
        engine: options?.dryRun === false ? 'producer' : 'dry-run',
        progress: 0,
      }
      renderJobs.set(job.id, job)
      return job
    },
  }
}

export function safeProjectPath(input: string): string {
  if (input.startsWith('/') || input.includes('\\') || input.includes('//')) {
    throw new Error(`Unsafe project path: ${input}`)
  }

  const parts: string[] = []
  for (const part of input.split('/')) {
    if (!part || part === '.') continue
    if (part === '..') {
      if (parts.length === 0) throw new Error(`Unsafe project path: ${input}`)
      parts.pop()
      continue
    }
    parts.push(part)
  }

  const normalized = parts.join('/')
  if (!normalized) throw new Error(`Unsafe project path: ${input}`)
  return normalized
}

export function projectSignature(project: HyperFramesProjectDirectory): string {
  const fileHashes = Object.keys(project.files)
    .sort()
    .map((path) => `${path}:${stableHash(project.files[path] ?? '')}`)
    .join('|')
  return stableHash(`${project.manifest.updatedAt}:${fileHashes}`)
}

function lintHyperframeHtml(
  html: string,
  project: HyperFramesProjectDirectory,
): StudioLintDiagnostic[] {
  const diagnostics: StudioLintDiagnostic[] = []
  if (/<script[\s>]/i.test(html)) {
    diagnostics.push({
      code: 'unsafe-script',
      message: 'Inline script tags are not allowed in Studio preview',
      severity: 'error',
    })
  }
  if (/\son[a-z]+\s*=/i.test(html)) {
    diagnostics.push({
      code: 'unsafe-attribute',
      message: 'Inline event handler attributes are not allowed',
      severity: 'error',
    })
  }
  for (const match of html.matchAll(/data-composition-src=["']([^"']+)["']/gi)) {
    const path = safeProjectPath(match[1] ?? '')
    if (project.files[path] === undefined) {
      diagnostics.push({
        code: 'missing-composition',
        message: `Missing composition file: ${path}`,
        severity: 'warning',
      })
    }
  }
  return diagnostics
}

function stableHash(input: string): string {
  let hash = 5381
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 33) ^ input.charCodeAt(index)
  }
  return (hash >>> 0).toString(16)
}
