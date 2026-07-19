import { beforeEach, describe, expect, it } from 'vite-plus/test'
import {
  createDefaultHyperFramesModelCenterSettings,
  createStarterModelProfile,
  normalizeCredentialScope,
  useHyperFramesModelCenterStore,
} from './modelCenterStore'

describe('HyperFrames model center store', () => {
  beforeEach(() => {
    localStorage.clear()
    useHyperFramesModelCenterStore.setState(createDefaultHyperFramesModelCenterSettings())
  })

  it('ships configurable cloud, gateway and local provider profiles', () => {
    const settings = createDefaultHyperFramesModelCenterSettings()
    const providerTypes = Object.values(settings.profiles).map((profile) => profile.providerType)

    expect(providerTypes).toEqual(
      expect.arrayContaining(['cloud', 'gateway', 'local', 'freecut-built-in']),
    )
    expect(settings.capabilityBindings['text.planning:standard']).toEqual(
      expect.objectContaining({
        capability: 'text.planning',
        quality: 'standard',
        enabled: true,
      }),
    )
  })

  it('stores credential metadata refs without secret values', () => {
    const store = useHyperFramesModelCenterStore.getState()
    store.upsertCredentialMetadata('team-secret:new-provider', {
      scope: 'team-secret',
      label: 'New provider',
    })
    store.updateModelProfile('private-gateway', {
      authRef: 'team-secret:new-provider',
    })

    const serialized = JSON.stringify(useHyperFramesModelCenterStore.getState())
    expect(serialized).toContain('team-secret:new-provider')
    expect(serialized).not.toContain('sk-test-secret')
    expect(serialized).not.toContain('"value"')
  })

  it('creates provider-specific starter profiles and normalizes credential scopes', () => {
    expect(createStarterModelProfile('cloud', 'cloud-test')).toEqual(
      expect.objectContaining({
        id: 'cloud-test',
        providerType: 'cloud',
        credentialScope: 'user-local',
      }),
    )
    expect(createStarterModelProfile('gateway', 'gateway-test')).toEqual(
      expect.objectContaining({
        id: 'gateway-test',
        providerType: 'gateway',
        credentialScope: 'team-secret',
      }),
    )
    expect(createStarterModelProfile('local', 'local-test')).toEqual(
      expect.objectContaining({
        id: 'local-test',
        providerType: 'local',
        privacyMode: 'local',
      }),
    )
    expect(normalizeCredentialScope('session-token')).toBe('session-token')
    expect(normalizeCredentialScope('unknown')).toBe('user-local')
  })
})
