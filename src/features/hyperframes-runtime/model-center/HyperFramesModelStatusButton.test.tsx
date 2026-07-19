import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { createDefaultHyperFramesModelCenterSettings, useHyperFramesModelCenterStore } from './modelCenterStore'
import { HyperFramesModelStatusButton } from './HyperFramesModelStatusButton'
import { getHyperFramesModelStatus } from './modelStatus'

afterEach(cleanup)

describe('HyperFramesModelStatusButton', () => {
  it('reports missing credentials and opens the model center', () => {
    const settings = createDefaultHyperFramesModelCenterSettings()
    const profile = Object.values(settings.profiles).find(
      (candidate) =>
        candidate.providerType === 'cloud' &&
        Boolean(candidate.apiKeyRef ?? candidate.authRef),
    )!
    profile.enabled = true
    settings.activeProfileId = profile.id
    const credentialRef = profile.apiKeyRef ?? profile.authRef
    if (credentialRef) delete settings.credentials[credentialRef]
    useHyperFramesModelCenterStore.setState(settings)
    const onOpen = vi.fn()
    render(<HyperFramesModelStatusButton currentTaskCost={0.12} onOpen={onOpen} />)
    fireEvent.click(screen.getByRole('button', { name: /Model key required/ }))
    expect(screen.getByText('$0.12')).toBeInTheDocument()
    expect(onOpen).toHaveBeenCalledOnce()
  })

  it('distinguishes local mode and exhausted quotas', () => {
    const settings = createDefaultHyperFramesModelCenterSettings()
    const local = Object.values(settings.profiles).find((profile) => profile.providerType === 'local')!
    settings.activeProfileId = local.id
    expect(getHyperFramesModelStatus(settings, false).kind).toBe('local')
    settings.budgetPolicy.dailyBudgetRemaining = 0
    expect(getHyperFramesModelStatus(settings, true).kind).toBe('quota-reached')
  })
})
