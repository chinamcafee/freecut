import { describe, expect, it } from 'vite-plus/test'
import type { HyperFramesIntegrationState, ModelProfile } from '@/types/hyperframes'
import { estimateModelCost, evaluateBudgetGate } from './costEstimator'
import { createCredentialResolver, InMemoryCredentialStore } from './credentialStore'

const profile: ModelProfile = {
  id: 'paid-cloud',
  name: 'Paid Cloud',
  providerType: 'cloud',
  baseUrl: 'https://models.example.test/v1',
  apiKeyRef: 'user-local:paid-cloud',
  credentialScope: 'user-local',
  defaultModel: 'paid-model',
  privacyMode: 'cloud',
  enabled: true,
  models: [
    {
      id: 'paid-model',
      displayName: 'Paid Model',
      inputModalities: ['text', 'image', 'audio'],
      outputModalities: ['text', 'json'],
      capabilities: ['text.planning', 'vision.understanding', 'audio.transcription'],
      cost: {
        currency: 'USD',
        inputToken: 0.001,
        outputToken: 0.002,
        image: 0.01,
        audioMinute: 0.03,
        request: 0.001,
      },
      latencyClass: 'fast',
      privacyClass: 'external',
    },
  ],
}

describe('credential store, cost estimator and budget gate', () => {
  it('resolves credential refs without serializing secret values into project state', async () => {
    const store = new InMemoryCredentialStore()
    await store.put(
      'user-local:paid-cloud',
      { value: 'sk-test-secret' },
      { scope: 'user-local', label: 'Paid Cloud', createdAt: 1784304000000 },
    )

    await expect(createCredentialResolver(store)('user-local:paid-cloud')).resolves.toBe(
      'sk-test-secret',
    )
    await expect(store.list()).resolves.toEqual([
      {
        ref: 'user-local:paid-cloud',
        scope: 'user-local',
        label: 'Paid Cloud',
        createdAt: 1784304000000,
        updatedAt: undefined,
        expiresAt: undefined,
      },
    ])

    const state: HyperFramesIntegrationState = {
      schemaVersion: 1,
      projects: {},
      compositionLinks: {},
      renderCache: {},
      skills: {},
      modelProfiles: { [profile.id]: profile },
      modelCapabilityBindings: {},
      toolPolicies: {},
      renderConfig: {
        defaultEngine: 'hybrid-overlay',
        preferAlphaOverlay: true,
        cacheEnabled: true,
      },
    }
    const serializedProjectState = JSON.stringify(state)
    expect(serializedProjectState).toContain('user-local:paid-cloud')
    expect(serializedProjectState).not.toContain('sk-test-secret')
    expect(JSON.stringify(store)).not.toContain('sk-test-secret')
  })

  it('estimates token, image, audio and request cost', () => {
    const estimate = estimateModelCost(profile, 'paid-model', {
      inputTokens: 100,
      outputTokens: 20,
      images: 2,
      audioMinutes: 3,
      requests: 1,
    })

    expect(estimate).toEqual(
      expect.objectContaining({
        profileId: 'paid-cloud',
        modelId: 'paid-model',
        currency: 'USD',
        unknownPricing: [],
      }),
    )
    expect(estimate.estimatedCost).toBeCloseTo(0.251)
    expect(estimate.lineItems.map((item) => item.unit)).toEqual([
      'inputToken',
      'outputToken',
      'image',
      'audioMinute',
      'request',
    ])
  })

  it('requires confirmation when cost exceeds a configured budget', () => {
    const estimate = estimateModelCost(profile, 'paid-model', {
      inputTokens: 100,
      outputTokens: 20,
    })

    const blocked = evaluateBudgetGate(estimate, { maxCostPerTask: 0.05 })
    expect(blocked).toEqual(
      expect.objectContaining({
        status: 'requires-confirmation',
        reason: 'Estimated model cost exceeds the per-task budget.',
      }),
    )
    expect(blocked.projectedCost).toBeCloseTo(0.14)

    const allowed = evaluateBudgetGate(estimate, { maxCostPerTask: 1 })
    expect(allowed).toEqual(
      expect.objectContaining({
        status: 'allow',
      }),
    )
    expect(allowed.projectedCost).toBeCloseTo(0.14)
  })

  it('accounts for running spend, retry cost and user or team quota', () => {
    const estimate = estimateModelCost(profile, 'paid-model', {
      inputTokens: 100,
      requests: 1,
    })

    const blocked = evaluateBudgetGate(estimate, {
      currentTaskSpent: 0.05,
      retryCost: 0.02,
      maxCostPerTask: 0.15,
    })
    expect(blocked).toEqual(
      expect.objectContaining({
        status: 'requires-confirmation',
        reason: 'Estimated model cost exceeds the per-task budget.',
      }),
    )
    expect(blocked.projectedCost).toBeCloseTo(0.171)

    const allowed = evaluateBudgetGate(estimate, {
      currentTaskSpent: 0.05,
      retryCost: 0.02,
      retryCostCounts: false,
      userBudgetRemaining: 0.2,
      teamBudgetRemaining: 0.2,
    })
    expect(allowed).toEqual(
      expect.objectContaining({
        status: 'allow',
      }),
    )
    expect(allowed.projectedCost).toBeCloseTo(0.151)
    expect(evaluateBudgetGate(estimate, { teamBudgetRemaining: 0.05 })).toEqual(
      expect.objectContaining({
        status: 'requires-confirmation',
        reason: 'Estimated model cost exceeds the remaining team budget.',
      }),
    )
  })

  it('requires confirmation when pricing is incomplete', () => {
    const estimate = estimateModelCost(
      {
        ...profile,
        models: [{ ...profile.models[0]!, cost: { currency: 'USD' } }],
      },
      'paid-model',
      { inputTokens: 100 },
    )

    expect(evaluateBudgetGate(estimate, { maxCostPerTask: 1 })).toEqual(
      expect.objectContaining({
        status: 'requires-confirmation',
        reason: 'Model pricing is incomplete; user confirmation is required before a paid call.',
      }),
    )
  })
})
