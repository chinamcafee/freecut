import { create } from 'zustand'

export type HyperFramesRenderJobStatus =
  | 'queued'
  | 'rendering'
  | 'completed'
  | 'failed'
  | 'cancelled'

export interface HyperFramesRenderJobLog {
  at: number
  level: 'info' | 'warning' | 'error'
  message: string
}

export interface HyperFramesRenderOutput {
  path: string
  format: 'mp4' | 'webm' | 'mov' | 'png-sequence'
  bytes?: number
  mimeType?: string
  alpha: boolean
}

export interface HyperFramesRenderJobState {
  id: string
  projectId: string
  compositionPath: string
  status: HyperFramesRenderJobStatus
  progress: number
  phase: string
  renderedFrames: number
  totalFrames: number
  createdAt: number
  startedAt?: number
  finishedAt?: number
  error?: string
  output?: HyperFramesRenderOutput
  logs: HyperFramesRenderJobLog[]
}

interface HyperFramesRenderQueueState {
  jobs: Record<string, HyperFramesRenderJobState>
  upsertJob: (job: HyperFramesRenderJobState) => void
  clearProject: (projectId: string) => void
  reset: () => void
}

export const useHyperFramesRenderJobStore = create<HyperFramesRenderQueueState>((set) => ({
  jobs: {},
  upsertJob: (job) =>
    set((state) => ({ jobs: { ...state.jobs, [job.id]: structuredClone(job) } })),
  clearProject: (projectId) =>
    set((state) => ({
      jobs: Object.fromEntries(
        Object.entries(state.jobs).filter(([, job]) => job.projectId !== projectId),
      ),
    })),
  reset: () => set({ jobs: {} }),
}))
