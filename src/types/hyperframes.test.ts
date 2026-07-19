import {
  DEFAULT_TOOL_POLICY,
  MODEL_CAPABILITIES,
  TOOL_PERMISSIONS,
  type HyperFramesIntegrationState,
  type HyperFramesProjectDirectory,
  type ModelCapabilityBinding,
  type ModelProfile,
  type ToolPolicy,
} from './hyperframes'
import type { Project } from './project'

describe('HyperFrames project types', () => {
  it('models a manifest-backed HyperFrames project directory', () => {
    const directory: HyperFramesProjectDirectory = {
      manifest: {
        schemaVersion: 1,
        id: 'hf-project-1',
        title: 'Intro',
        entryFile: 'index.html',
        activeCompositionPath: 'compositions/main.html',
        canvas: {
          width: 1920,
          height: 1080,
          fps: 30,
          durationInFrames: 150,
        },
        assets: [
          {
            id: 'asset-logo',
            path: 'assets/logo.png',
            kind: 'image',
            mimeType: 'image/png',
            hash: 'sha256:logo',
          },
        ],
        provenance: {
          source: 'model-generation',
          createdAt: 1784304000000,
          modelUsage: {
            providerId: 'private-gateway',
            modelId: 'video-agent',
            estimatedCost: 0.25,
            currency: 'USD',
          },
          confirmedByUser: true,
        },
      },
      files: [
        {
          path: 'index.html',
          content: '<!doctype html><html></html>',
          encoding: 'utf8',
        },
      ],
      assets: [],
    }

    expect(directory.manifest.activeCompositionPath).toBe('compositions/main.html')
    expect(directory.manifest.assets[0]?.kind).toBe('image')
  })

  it('extends FreeCut projects with HyperFrames integration state', () => {
    const hyperframes: HyperFramesIntegrationState = {
      schemaVersion: 1,
      projects: {},
      compositionLinks: {},
      renderCache: {},
      skills: {},
      modelProfiles: {},
      modelCapabilityBindings: {},
      toolPolicies: {},
      renderConfig: {
        defaultEngine: 'hybrid-overlay',
        preferAlphaOverlay: true,
        cacheEnabled: true,
      },
    }

    const project: Project = {
      id: 'project-1',
      name: 'Project',
      description: '',
      createdAt: 1784304000000,
      updatedAt: 1784304000000,
      duration: 0,
      metadata: {
        width: 1920,
        height: 1080,
        fps: 30,
      },
      hyperframes,
    }

    expect(project.hyperframes?.schemaVersion).toBe(1)
    expect(project.hyperframes?.renderConfig.defaultEngine).toBe('hybrid-overlay')
  })

  it('models provider profiles, capability bindings, tool policy and material scope safely', () => {
    const profile: ModelProfile = {
      id: 'profile-openai-compatible',
      name: 'OpenAI-compatible gateway',
      providerType: 'gateway',
      baseUrl: 'https://models.example.test/v1',
      apiKeyRef: 'team-secret:model-gateway',
      credentialScope: 'team-secret',
      defaultModel: 'agent-code-high',
      privacyMode: 'private-gateway',
      enabled: true,
      models: [
        {
          id: 'agent-code-high',
          displayName: 'Agent Code High',
          contextWindow: 128000,
          contextLimits: {
            inputTokens: 120000,
            outputTokens: 8000,
            images: 16,
            audioSeconds: 600,
          },
          inputModalities: ['text', 'image', 'audio', 'file'],
          outputModalities: ['text', 'json'],
          capabilities: [
            'text.planning',
            'vision.understanding',
            'audio.transcription',
            'code.hyperframes',
            'tool.calling',
          ],
          cost: {
            currency: 'USD',
            inputToken: 0.000002,
            outputToken: 0.00001,
            audioMinute: 0.006,
          },
          latencyClass: 'balanced',
          privacyClass: 'private',
          supportsStructuredOutput: true,
          supportsToolCalls: true,
        },
      ],
    }

    const toolPolicy: ToolPolicy = {
      ...DEFAULT_TOOL_POLICY,
      id: 'studio-ai-confirmed',
      name: 'Studio AI confirmed writes',
      permissions: {
        ...DEFAULT_TOOL_POLICY.permissions,
        'source-files.read': { state: 'allowed' },
        'source-files.propose-write': { state: 'requires-confirmation' },
      },
      materialScope: {
        ...DEFAULT_TOOL_POLICY.materialScope,
        sourceFiles: 'snippets',
        screenshots: 'selected-frames',
        uploadMode: 'confirmed-external',
      },
      requiresConfirmationAboveCost: 0.5,
    }

    const binding: ModelCapabilityBinding = {
      id: 'binding-code-hf',
      capability: 'code.hyperframes',
      profileId: profile.id,
      modelId: profile.defaultModel,
      quality: 'high',
      maxCostPerTask: 2,
      requiresConfirmationAboveCost: 0.5,
      toolPolicyId: toolPolicy.id,
      materialScope: toolPolicy.materialScope,
      enabled: true,
    }

    const state: HyperFramesIntegrationState = {
      schemaVersion: 1,
      projects: {},
      compositionLinks: {},
      renderCache: {},
      skills: {},
      modelProfiles: {
        [profile.id]: profile,
      },
      modelCapabilityBindings: {
        [binding.id]: binding,
      },
      toolPolicies: {
        [toolPolicy.id]: toolPolicy,
      },
      renderConfig: {
        defaultEngine: 'hybrid-overlay',
        preferAlphaOverlay: true,
        cacheEnabled: true,
      },
    }

    expect(MODEL_CAPABILITIES).toEqual(
      expect.arrayContaining([
        'text.planning',
        'vision.understanding',
        'audio.transcription',
        'code.hyperframes',
        'tool.calling',
      ]),
    )
    expect(TOOL_PERMISSIONS).toEqual(
      expect.arrayContaining([
        'project-context.read',
        'source-files.propose-write',
        'timeline.propose-write',
        'network.access',
        'render.run',
      ]),
    )
    expect(state.modelProfiles[profile.id]?.apiKeyRef).toBe('team-secret:model-gateway')
    expect(state.toolPolicies[toolPolicy.id]?.materialScope.localPaths).toBe('redacted')
    expect(state.modelCapabilityBindings[binding.id]?.requiresConfirmationAboveCost).toBe(0.5)

    const serializedProjectState = JSON.stringify(state)
    expect(serializedProjectState).toContain('team-secret:model-gateway')
    expect(serializedProjectState).not.toContain('sk-')
    expect(serializedProjectState).not.toContain('Authorization')
    expect(serializedProjectState).not.toContain('Bearer ')
  })
})
