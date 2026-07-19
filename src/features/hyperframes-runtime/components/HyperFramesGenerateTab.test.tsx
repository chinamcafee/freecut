import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { HyperFramesGenerateTab } from './HyperFramesGenerateTab'

afterEach(cleanup)

describe('HyperFramesGenerateTab', () => {
  it('creates and confirms a source-linked generation plan from a quick template', () => {
    const onPlanReady = vi.fn()
    const onPlanConfirmed = vi.fn()
    render(
      <HyperFramesGenerateTab
        onPlanReady={onPlanReady}
        onPlanConfirmed={onPlanConfirmed}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Website' }))

    expect(screen.getByDisplayValue(/example\.com/)).toBeInTheDocument()
    expect(screen.getByText('Product Launch Video')).toBeInTheDocument()
    expect(screen.getByText('Source-linked composition')).toBeInTheDocument()
    expect(screen.getByText('Native approximations')).toBeInTheDocument()
    expect(screen.getByText(/USD/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Create plan' }))
    expect(onPlanReady).toHaveBeenCalledOnce()
    expect(onPlanReady.mock.calls[0]?.[0]).toMatchObject({
      skillId: 'product-launch-video',
      status: 'draft',
      canExecute: false,
      importStrategy: 'source-link-with-approximations',
    })

    fireEvent.click(screen.getByRole('button', { name: 'Confirm plan' }))
    expect(onPlanConfirmed).toHaveBeenCalledOnce()
    expect(onPlanConfirmed.mock.calls[0]?.[0]).toMatchObject({
      status: 'confirmed',
      canExecute: true,
    })
    expect(screen.getByRole('button', { name: 'Plan confirmed' })).toBeDisabled()
  })

  it('updates skill recommendations from natural language without mutating a project', () => {
    render(<HyperFramesGenerateTab />)

    fireEvent.change(screen.getByLabelText('Describe the result'), {
      target: { value: '做一个 8 秒动态图形标题动画，带 stat count-up 和 callout' },
    })

    expect(screen.getByText('Motion Graphics')).toBeInTheDocument()
    expect(screen.getByText('Transparent background')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create plan' })).toBeEnabled()
  })

  it('keeps a plan retryable when the runtime rejects confirmation', () => {
    const onPlanConfirmed = vi.fn(() => false)
    render(<HyperFramesGenerateTab onPlanConfirmed={onPlanConfirmed} />)

    fireEvent.click(screen.getByRole('button', { name: 'Intro' }))
    fireEvent.click(screen.getByRole('button', { name: 'Create plan' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm plan' }))

    expect(onPlanConfirmed).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: 'Confirm plan' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Update plan' })).toBeEnabled()
  })
})
