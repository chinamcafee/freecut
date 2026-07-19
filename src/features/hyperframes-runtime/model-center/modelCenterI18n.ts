import type { TFunction } from 'i18next'

const BUILT_IN_VALUE_KEYS: Record<string, string> = {
  Model: 'model',
  'Default credential': 'defaultCredential',
  'Private gateway': 'privateGateway',
  'Team multimodal model': 'teamMultimodalModel',
  'Local HTTP model': 'localHttpModel',
  'Local HyperFrames model': 'localHyperFramesModel',
  'FreeCut built-in local models': 'freecutBuiltInLocalModels',
  'FreeCut transcription': 'freecutTranscription',
  'OpenAI-compatible cloud': 'openAiCompatibleCloud',
  'Cloud HyperFrames model': 'cloudHyperFramesModel',
  'Default conservative model policy': 'defaultConservativePolicy',
  'Private gateway policy': 'privateGatewayPolicy',
  'OpenAI-compatible API key': 'openAiCompatibleApiKey',
  'Private gateway key': 'privateGatewayKey',
  'Local model': 'localModel',
  'OpenAI-compatible': 'openAiCompatible',
  'FreeCut local transcription': 'freecutLocalTranscription',
  'FreeCut local embeddings': 'freecutLocalEmbeddings',
  'FreeCut local voice': 'freecutLocalVoice',
  'FreeCut local music': 'freecutLocalMusic',
}

export function translateBuiltInModelCenterValue(t: TFunction, value: string): string {
  const key = BUILT_IN_VALUE_KEYS[value]
  return key ? t(`hyperframes.modelCenter.defaultValues.${key}`) : value
}
