import { lazy } from 'react'

export const LazyHyperFramesStudioPanel = lazy(() =>
  import('./HyperFramesStudioPanel').then((module) => ({
    default: module.HyperFramesStudioPanel,
  })),
)
