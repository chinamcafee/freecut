import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test'
import { ModelCapabilityCenter } from './ModelCapabilityCenter'
import {
  createDefaultHyperFramesModelCenterSettings,
  useHyperFramesModelCenterStore,
} from './modelCenterStore'

describe('ModelCapabilityCenter', () => {
  beforeEach(() => {
    localStorage.clear()
    useHyperFramesModelCenterStore.setState(createDefaultHyperFramesModelCenterSettings())
  })

  afterEach(() => {
    cleanup()
  })

  it('renders the model configuration tabs and provider types', () => {
    render(<ModelCapabilityCenter />)

    expect(screen.getByRole('tab', { name: /providers/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /bindings/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /credentials/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /budget/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /privacy/i })).toBeInTheDocument()
    expect(screen.getByText('OpenAI-compatible cloud')).toBeInTheDocument()
    expect(screen.getAllByText('Private gateway').length).toBeGreaterThan(0)
    expect(screen.getByText('Local HTTP model')).toBeInTheDocument()
  })

  it('saves credential refs as metadata without rendering a secret field', () => {
    render(<ModelCapabilityCenter defaultTab="credentials" />)
    fireEvent.change(screen.getByLabelText('Credential ref'), {
      target: { value: 'team-secret:render-gateway' },
    })
    fireEvent.change(screen.getByLabelText('Label'), {
      target: { value: 'Render gateway' },
    })
    fireEvent.change(screen.getByLabelText('Credential scope'), {
      target: { value: 'team-secret' },
    })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))

    expect(screen.getByText('Render gateway')).toBeInTheDocument()
    expect(screen.getByText('team-secret:render-gateway')).toBeInTheDocument()
    expect(screen.queryByLabelText(/secret value/i)).not.toBeInTheDocument()
    expect(JSON.stringify(useHyperFramesModelCenterStore.getState())).not.toContain(
      'sk-test-secret',
    )
  })

  it('shows budget confirmation when the active estimate exceeds configured limits', () => {
    render(<ModelCapabilityCenter defaultTab="budget" />)

    expect(screen.getByText('Requires confirmation')).toBeInTheDocument()
    expect(screen.getByText(/USD/)).toBeInTheDocument()
  })
})
