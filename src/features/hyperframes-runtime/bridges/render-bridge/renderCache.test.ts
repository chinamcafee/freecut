import { describe, expect, it, vi } from 'vite-plus/test'
import type { HyperFramesProjectDirectory } from '@/types/hyperframes'
import type { HyperFramesRenderRequest } from './HyperFramesRenderService'
import { HyperFramesRenderCache } from './renderCache'

const directory: HyperFramesProjectDirectory = {
  manifest: { schemaVersion: 1, id: 'p1', title: 'P1', entryFile: 'index.html', activeCompositionPath: 'compositions/main.html', canvas: { width: 1280, height: 720, fps: 30, durationInFrames: 90 }, assets: [], provenance: { source: 'manual-import', createdAt: 1 }, sourceRuntimeVersion: '1' },
  files: [{ path: 'index.html', content: 'A', encoding: 'utf8' }, { path: 'compositions/main.html', content: 'B', encoding: 'utf8' }], assets: [],
}
const request: HyperFramesRenderRequest = { projectId: 'p1', projectDirectoryPath: '/p1', compositionPath: 'compositions/main.html', width: 1280, height: 720, fps: 30, durationInFrames: 90, quality: 'high', format: 'webm', alpha: true, includeAudio: false }

describe('HyperFramesRenderCache', () => {
  it('hits identical renders and invalidates manifest/runtime/format changes', async () => {
    const cache = new HyperFramesRenderCache()
    cache.put(directory, request, { path: 'cache/a.webm', format: 'webm', alpha: true }, { producerVersion: '1', createdAt: 10 })
    expect((await cache.lookup(directory, request, '1')).hit).toBe(true)
    expect((await cache.lookup({ ...directory, files: [{ ...directory.files[0]!, content: 'changed' }, directory.files[1]!] }, request, '1')).hit).toBe(false)
    expect((await cache.lookup(directory, request, '2')).hit).toBe(false)
    expect((await cache.lookup(directory, { ...request, format: 'mov' }, '1')).hit).toBe(false)
  })

  it('cleans project outputs and emits a cache report', async () => {
    const remove = vi.fn().mockResolvedValue(undefined)
    const cache = new HyperFramesRenderCache([], async () => true, remove)
    cache.put(directory, request, { path: 'cache/a.webm', format: 'webm', alpha: true })
    expect(cache.createReport(20)).toMatchObject({ totalEntries: 1, projectCounts: { p1: 1 } })
    await expect(cache.clearProject('p1')).resolves.toBe(1)
    expect(remove).toHaveBeenCalledWith('cache/a.webm')
  })
})
