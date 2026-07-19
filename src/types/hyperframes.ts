export type HyperFramesAssetKind =
  | 'image'
  | 'video'
  | 'audio'
  | 'font'
  | 'script'
  | 'style'
  | 'data'
  | 'other'

export type HyperFramesProjectSource =
  | 'freecut-export'
  | 'hyperframes-project'
  | 'legacy-composition'
  | 'skill-output'
  | 'studio-edit'
  | 'manual-import'
  | 'model-generation'

export type HyperFramesRenderingEngine = 'freecut' | 'hyperframes-producer' | 'hybrid-overlay'

export type HyperFramesTimelineSourceKind = 'freecut' | 'hyperframes'

export interface HyperFramesTimelineVisualState {
  diagnosticStatus: 'error' | 'ready' | 'warning'
  cacheStatus: 'fresh' | 'missing' | 'stale'
  renderStatus?: 'idle' | 'rendering'
  studioDirty?: boolean
}

export type HyperFramesDiagnosticSeverity = 'blocking' | 'warning' | 'suggestion'

export type HyperFramesDiagnosticSource = 'parser' | 'lint' | 'runtime' | 'render' | 'storage'

export type HyperFramesDiagnosticStage = 'import' | 'studio-save' | 'preview' | 'export'

export const MODEL_CAPABILITIES = [
  'text.planning',
  'text.reasoning',
  'code.hyperframes',
  'code.repair',
  'vision.understanding',
  'vision.frame-analysis',
  'audio.transcription',
  'audio.synthesis',
  'audio.music-generation',
  'audio.sound-effect-generation',
  'image.generation',
  'embedding.retrieval',
  'web.understanding',
  'tool.calling',
  'render.assist',
] as const

export type ModelCapability = (typeof MODEL_CAPABILITIES)[number]

export type ModelProviderType = 'cloud' | 'local' | 'gateway' | 'freecut-built-in'

export type ModelModality = 'text' | 'image' | 'audio' | 'video' | 'file'

export type ModelOutputModality = 'text' | 'image' | 'audio' | 'video' | 'json'

export type ModelLatencyClass = 'fast' | 'balanced' | 'slow'

export type ModelPrivacyClass = 'local' | 'private' | 'external'

export type ModelPrivacyMode = 'cloud' | 'private-gateway' | 'local' | 'no-material-upload'

export type ModelCapabilityQuality = 'draft' | 'standard' | 'high'

export type ModelCredentialScope = 'none' | 'user-local' | 'team-secret' | 'session-token'

export interface ModelUnitCost {
  currency?: string
  inputToken?: number
  outputToken?: number
  cachedInputToken?: number
  image?: number
  audioMinute?: number
  videoSecond?: number
  request?: number
}

export interface ModelContextLimits {
  inputTokens?: number
  outputTokens?: number
  files?: number
  images?: number
  audioSeconds?: number
  videoSeconds?: number
  requestBytes?: number
}

export interface ModelRateLimit {
  requestsPerMinute?: number
  tokensPerMinute?: number
  dailyBudget?: number
  projectBudget?: number
}

export interface ModelTimeoutPolicy {
  timeoutMs?: number
  retryCount?: number
  retryBackoffMs?: number
  fallbackBindingId?: string
}

export interface ModelLocalRuntimeConfig {
  serviceUrl?: string
  healthPath?: string
  modelFilePath?: string
  command?: string
  commandArgs?: string[]
  minMemoryGb?: number
  minVramGb?: number
  allowOffline?: boolean
}

export type ModelRequestHeader =
  | {
      name: string
      value: string
      sensitive?: false
    }
  | {
      name: string
      valueRef: string
      sensitive: true
    }

export interface ModelDescriptor {
  id: string
  displayName: string
  contextWindow?: number
  contextLimits?: ModelContextLimits
  inputModalities: ModelModality[]
  outputModalities: ModelOutputModality[]
  capabilities: ModelCapability[]
  cost?: ModelUnitCost
  latencyClass: ModelLatencyClass
  privacyClass: ModelPrivacyClass
  supportsStructuredOutput?: boolean
  supportsToolCalls?: boolean
}

export interface ModelProfile {
  id: string
  name: string
  providerType: ModelProviderType
  baseUrl?: string
  endpoint?: string
  authRef?: string
  apiKeyRef?: string
  credentialScope?: ModelCredentialScope
  defaultModel: string
  models: ModelDescriptor[]
  rateLimit?: ModelRateLimit
  timeoutPolicy?: ModelTimeoutPolicy
  localRuntime?: ModelLocalRuntimeConfig
  customHeaders?: ModelRequestHeader[]
  proxyRef?: string
  auditTag?: string
  privacyMode: ModelPrivacyMode
  enabled: boolean
}

export type MaterialAccessLevel =
  | 'none'
  | 'summary'
  | 'metadata'
  | 'selection'
  | 'snippets'
  | 'selected-files'
  | 'selected-frames'
  | 'transcript'
  | 'full-after-confirmation'

export interface MaterialScope {
  projectContext: MaterialAccessLevel
  timeline: MaterialAccessLevel
  assetNames: boolean
  sourceFiles: MaterialAccessLevel
  screenshots: MaterialAccessLevel
  audio: MaterialAccessLevel
  videoFrames: MaterialAccessLevel
  localPaths: 'redacted' | 'project-relative' | 'allowed-after-confirmation'
  uploadMode: 'none' | 'local-only' | 'confirmed-external'
  redactLogs: boolean
}

export const TOOL_PERMISSIONS = [
  'project-context.read',
  'source-files.read',
  'source-files.propose-write',
  'timeline.propose-write',
  'skills.run',
  'network.access',
  'local-files.access',
  'render.run',
  'cache.access',
] as const

export type ToolPermission = (typeof TOOL_PERMISSIONS)[number]

export type ToolPermissionState = 'denied' | 'allowed' | 'requires-confirmation'

export interface ToolPermissionRule {
  state: ToolPermissionState
  reason?: string
  maxCostWithoutConfirmation?: number
}

export interface ToolPolicy {
  id: string
  name: string
  permissions: Partial<Record<ToolPermission, ToolPermissionRule>>
  materialScope: MaterialScope
  writeMode: 'disabled' | 'proposal-requires-confirmation'
  networkMode: 'disabled' | 'confirm-before-access' | 'allowlisted'
  allowedNetworkHosts?: string[]
  requiresConfirmationAboveCost?: number
  enabled: boolean
}

export interface ModelCapabilityBinding {
  id: string
  capability: ModelCapability
  profileId: string
  modelId: string
  fallback?: Array<{ profileId: string; modelId: string }>
  quality: ModelCapabilityQuality
  maxCostPerTask?: number
  requiresConfirmationAboveCost?: number
  toolPolicyId?: string
  materialScope?: MaterialScope
  enabled: boolean
}

export const DEFAULT_MATERIAL_SCOPE: MaterialScope = {
  projectContext: 'summary',
  timeline: 'metadata',
  assetNames: true,
  sourceFiles: 'none',
  screenshots: 'none',
  audio: 'none',
  videoFrames: 'none',
  localPaths: 'redacted',
  uploadMode: 'none',
  redactLogs: true,
}

export const DEFAULT_TOOL_POLICY: ToolPolicy = {
  id: 'default-conservative',
  name: 'Default conservative model policy',
  permissions: {
    'project-context.read': { state: 'allowed' },
    'source-files.read': { state: 'requires-confirmation' },
    'source-files.propose-write': { state: 'requires-confirmation' },
    'timeline.propose-write': { state: 'requires-confirmation' },
    'skills.run': { state: 'requires-confirmation' },
    'network.access': { state: 'denied' },
    'local-files.access': { state: 'requires-confirmation' },
    'render.run': { state: 'requires-confirmation' },
    'cache.access': { state: 'allowed' },
  },
  materialScope: DEFAULT_MATERIAL_SCOPE,
  writeMode: 'proposal-requires-confirmation',
  networkMode: 'confirm-before-access',
  enabled: true,
}

export interface HyperFramesAssetRef {
  id: string
  path: string
  kind: HyperFramesAssetKind
  mimeType?: string
  hash?: string
  bytes?: number
  width?: number
  height?: number
  durationInFrames?: number
  originalUrl?: string
  originalMediaId?: string
}

export interface HyperFramesProjectCanvas {
  width: number
  height: number
  fps: number
  durationInFrames: number
  backgroundColor?: string
}

export interface HyperFramesDiagnostic {
  id: string
  code?: string
  source?: HyperFramesDiagnosticSource
  stage?: HyperFramesDiagnosticStage
  severity: HyperFramesDiagnosticSeverity
  message: string
  file?: string
  line?: number
  column?: number
  selector?: string
  elementId?: string
  snippet?: string
  fixHint?: string
}

export interface HyperFramesModelUsageSummary {
  modelProfileId?: string
  providerId?: string
  modelId?: string
  capability?: ModelCapability
  inputTokens?: number
  outputTokens?: number
  estimatedCost?: number
  currency?: string
  taskId?: string
  inputHash?: string
  outputHash?: string
}

export interface HyperFramesProvenance {
  source: HyperFramesProjectSource
  createdAt: number
  updatedAt?: number
  freecutProjectId?: string
  timelineItemId?: string
  modelUsage?: HyperFramesModelUsageSummary
  promptSummary?: string
  skillId?: string
  upstreamRuntimeVersion?: string
  adapterVersion?: string
  confirmedByUser?: boolean
}

export interface HyperFramesLintSummary {
  checkedAt: number
  blockingCount: number
  warningCount: number
  suggestionCount: number
  diagnostics: HyperFramesDiagnostic[]
}

export interface HyperFramesProjectManifest {
  schemaVersion: 1
  id: string
  title: string
  entryFile: string
  activeCompositionPath: string
  canvas: HyperFramesProjectCanvas
  assets: HyperFramesAssetRef[]
  provenance: HyperFramesProvenance
  diagnostics?: HyperFramesDiagnostic[]
  variables?: Record<string, unknown>
  tags?: string[]
  sourceRuntimeVersion?: string
  upstreamSource?: string
  adapterVersion?: string
  lastStudioSave?: {
    savedAt: number
    userId?: string
    files: string[]
    snapshotId?: string
  }
  lastModelMutation?: {
    mutatedAt: number
    modelProfileId?: string
    promptSummary?: string
    confirmedByUser: boolean
  }
  lintSummary?: HyperFramesLintSummary
  previewSignature?: string
  renderSignature?: string
}

export interface HyperFramesProjectFile {
  path: string
  content: string
  encoding: 'utf8'
  hash?: string
}

export interface HyperFramesBinaryAsset {
  path: string
  bytes: Uint8Array
  mimeType?: string
  hash?: string
}

export interface HyperFramesProjectDirectory {
  manifest: HyperFramesProjectManifest
  files: HyperFramesProjectFile[]
  assets: HyperFramesBinaryAsset[]
}

export interface HyperFramesCompositionLink {
  id: string
  timelineItemId: string
  hyperframesProjectId: string
  manifestPath: string
  activeCompositionPath: string
  createdAt: number
  updatedAt?: number
  importStrategy: 'source-linked' | 'source-linked-with-approximations' | 'rendered-media'
}

export interface HyperFramesRenderCacheEntry {
  id: string
  hyperframesProjectId: string
  compositionPath: string
  renderSignature: string
  engine: HyperFramesRenderingEngine
  format: 'mp4' | 'webm' | 'mov' | 'png-sequence'
  outputPath: string
  width: number
  height: number
  fps: number
  durationInFrames: number
  createdAt: number
  alpha: boolean
}

export interface HyperFramesSkillDefinitionRef {
  id: string
  title: string
  sourcePath: string
  categories: string[]
  enabled: boolean
}

export interface HyperFramesModelProfileRef {
  id: string
  displayName: string
  providerId: string
  capabilities: ModelCapability[]
  privacyMode: 'cloud' | 'private-gateway' | 'local'
}

export interface HyperFramesRenderConfig {
  defaultEngine: HyperFramesRenderingEngine
  preferAlphaOverlay: boolean
  cacheEnabled: boolean
  remoteRenderingEnabled?: boolean
}

export interface HyperFramesIntegrationState {
  schemaVersion: 1
  projects: Record<string, HyperFramesProjectManifest>
  compositionLinks: Record<string, HyperFramesCompositionLink>
  renderCache: Record<string, HyperFramesRenderCacheEntry>
  skills: Record<string, HyperFramesSkillDefinitionRef>
  modelProfiles: Record<string, ModelProfile>
  modelCapabilityBindings: Record<string, ModelCapabilityBinding>
  toolPolicies: Record<string, ToolPolicy>
  renderConfig: HyperFramesRenderConfig
}
