import type { HyperFramesProjectDirectory, HyperFramesRenderCacheEntry } from '@/types/hyperframes'
import { computeHyperFramesRenderSignature } from '../../adapters/freecut-project/project-signatures'
import type { HyperFramesRenderRequest } from './HyperFramesRenderService'
import type { HyperFramesRenderOutput } from './renderJobStore'

export interface HyperFramesRenderCacheLookup {
  key: string
  hit: boolean
  entry?: HyperFramesRenderCacheEntry
  reason: 'hit' | 'missing' | 'output-missing'
}

export interface HyperFramesRenderCacheReport {
  generatedAt: number
  entries: HyperFramesRenderCacheEntry[]
  projectCounts: Record<string, number>
  totalEntries: number
}

export class HyperFramesRenderCache {
  private readonly entries = new Map<string, HyperFramesRenderCacheEntry>()

  constructor(
    initialEntries: HyperFramesRenderCacheEntry[] = [],
    private readonly outputExists: (path: string) => Promise<boolean> = async () => true,
    private readonly removeOutput: (path: string) => Promise<void> = async () => {},
  ) {
    for (const entry of initialEntries) this.entries.set(entry.renderSignature, { ...entry })
  }

  async lookup(
    directory: HyperFramesProjectDirectory,
    request: HyperFramesRenderRequest,
    producerVersion?: string,
  ): Promise<HyperFramesRenderCacheLookup> {
    const key = createHyperFramesRenderCacheKey(directory, request, producerVersion)
    const entry = this.entries.get(key)
    if (!entry) return { key, hit: false, reason: 'missing' }
    if (!(await this.outputExists(entry.outputPath))) {
      this.entries.delete(key)
      return { key, hit: false, reason: 'output-missing' }
    }
    return { key, hit: true, reason: 'hit', entry: { ...entry } }
  }

  put(
    directory: HyperFramesProjectDirectory,
    request: HyperFramesRenderRequest,
    output: HyperFramesRenderOutput,
    options: { producerVersion?: string; createdAt?: number } = {},
  ): HyperFramesRenderCacheEntry {
    const renderSignature = createHyperFramesRenderCacheKey(
      directory,
      request,
      options.producerVersion,
    )
    const entry: HyperFramesRenderCacheEntry = {
      id: `hf-cache-${renderSignature.slice(0, 16)}`,
      hyperframesProjectId: directory.manifest.id,
      compositionPath: request.compositionPath,
      renderSignature,
      engine: 'hyperframes-producer',
      format: output.format,
      outputPath: output.path,
      width: request.width,
      height: request.height,
      fps: request.fps,
      durationInFrames: request.durationInFrames,
      createdAt: options.createdAt ?? Date.now(),
      alpha: output.alpha,
    }
    this.entries.set(renderSignature, entry)
    return { ...entry }
  }

  async clearProject(projectId: string): Promise<number> {
    const matches = [...this.entries.entries()].filter(
      ([, entry]) => entry.hyperframesProjectId === projectId,
    )
    for (const [key, entry] of matches) {
      await this.removeOutput(entry.outputPath)
      this.entries.delete(key)
    }
    return matches.length
  }

  createReport(generatedAt = Date.now()): HyperFramesRenderCacheReport {
    const entries = [...this.entries.values()].map((entry) => ({ ...entry }))
    const projectCounts: Record<string, number> = {}
    for (const entry of entries) {
      projectCounts[entry.hyperframesProjectId] =
        (projectCounts[entry.hyperframesProjectId] ?? 0) + 1
    }
    return { generatedAt, entries, projectCounts, totalEntries: entries.length }
  }
}

export function createHyperFramesRenderCacheKey(
  directory: HyperFramesProjectDirectory,
  request: HyperFramesRenderRequest,
  producerVersion?: string,
): string {
  return computeHyperFramesRenderSignature(directory, {
    compositionPath: request.compositionPath,
    width: request.width,
    height: request.height,
    fps: request.fps,
    quality: request.quality,
    format: request.format,
    alpha: request.alpha,
    includeAudio: request.includeAudio,
    engine: 'hyperframes-producer',
    producerVersion,
    runtimeVersion: directory.manifest.sourceRuntimeVersion,
  })
}
