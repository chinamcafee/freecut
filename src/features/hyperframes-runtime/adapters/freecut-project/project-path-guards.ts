import type { HyperFramesProjectManifest } from '@/types/hyperframes'

export type HyperFramesWritableFileKind = 'text' | 'asset'

export interface NormalizedHyperFramesProjectPath {
  path: string
  segments: string[]
  extension: string
}

export class HyperFramesProjectPathError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'HyperFramesProjectPathError'
  }
}

const WINDOWS_DRIVE_PREFIX = /^[a-zA-Z]:/
const URL_SCHEME_PREFIX = /^[a-zA-Z][a-zA-Z\d+.-]*:/
// eslint-disable-next-line no-control-regex -- project paths must reject null/control bytes.
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/
const WINDOWS_RESERVED_NAMES = new Set([
  'con',
  'prn',
  'aux',
  'nul',
  'com1',
  'com2',
  'com3',
  'com4',
  'com5',
  'com6',
  'com7',
  'com8',
  'com9',
  'lpt1',
  'lpt2',
  'lpt3',
  'lpt4',
  'lpt5',
  'lpt6',
  'lpt7',
  'lpt8',
  'lpt9',
])

const DANGEROUS_EXTENSIONS = new Set([
  '.app',
  '.bat',
  '.cmd',
  '.com',
  '.crt',
  '.der',
  '.dll',
  '.dmg',
  '.exe',
  '.jar',
  '.jks',
  '.key',
  '.keystore',
  '.msi',
  '.node',
  '.p12',
  '.pem',
  '.pfx',
  '.pkg',
  '.ps1',
  '.sh',
  '.so',
  '.zsh',
])

const DANGEROUS_BASENAMES = new Set([
  '.npmrc',
  '.pnpmrc',
  '.yarnrc',
  '.netrc',
  'authorized_keys',
  'credentials',
  'credentials.json',
  'id_dsa',
  'id_ecdsa',
  'id_ed25519',
  'id_rsa',
  'known_hosts',
  'service-account.json',
])

const TEXT_MIME_BY_EXTENSION = new Map<string, readonly string[]>([
  ['.css', ['text/css']],
  ['.csv', ['text/csv', 'text/plain']],
  ['.cube', ['text/plain']],
  ['.frag', ['text/plain']],
  ['.glsl', ['text/plain']],
  ['.html', ['text/html']],
  ['.htm', ['text/html']],
  ['.js', ['text/javascript', 'application/javascript']],
  ['.json', ['application/json']],
  ['.md', ['text/markdown', 'text/plain']],
  ['.mjs', ['text/javascript', 'application/javascript']],
  ['.srt', ['application/x-subrip', 'text/plain']],
  ['.svg', ['image/svg+xml']],
  ['.txt', ['text/plain']],
  ['.vert', ['text/plain']],
  ['.vtt', ['text/vtt', 'text/plain']],
  ['.wgsl', ['text/plain']],
  ['.xml', ['application/xml', 'text/xml']],
])

const ASSET_MIME_BY_EXTENSION = new Map<string, readonly string[]>([
  ...TEXT_MIME_BY_EXTENSION,
  ['.aac', ['audio/aac']],
  ['.flac', ['audio/flac']],
  ['.gif', ['image/gif']],
  ['.ico', ['image/x-icon', 'image/vnd.microsoft.icon']],
  ['.jpeg', ['image/jpeg']],
  ['.jpg', ['image/jpeg']],
  ['.m4a', ['audio/mp4']],
  ['.m4v', ['video/mp4']],
  ['.mov', ['video/quicktime']],
  ['.mp3', ['audio/mpeg']],
  ['.mp4', ['video/mp4']],
  ['.ogg', ['audio/ogg', 'video/ogg']],
  ['.opus', ['audio/ogg']],
  ['.otf', ['font/otf', 'application/vnd.ms-opentype']],
  ['.png', ['image/png']],
  ['.ttf', ['font/ttf']],
  ['.wav', ['audio/wav', 'audio/wave', 'audio/x-wav']],
  ['.webm', ['video/webm', 'audio/webm']],
  ['.webp', ['image/webp']],
  ['.woff', ['font/woff']],
  ['.woff2', ['font/woff2']],
])

export function assertHyperFramesProjectId(projectId: string): string {
  const normalized = normalizeHyperFramesProjectPath(projectId)
  if (normalized.segments.length !== 1) {
    throw new HyperFramesProjectPathError(
      `Unsafe HyperFrames project id "${projectId}": expected a single safe path segment`,
    )
  }
  return normalized.path
}

export function normalizeHyperFramesProjectPath(
  relativePath: string,
): NormalizedHyperFramesProjectPath {
  if (typeof relativePath !== 'string') {
    throw new HyperFramesProjectPathError('HyperFrames project path must be a string')
  }

  const trimmed = relativePath.trim()
  if (trimmed.length === 0) {
    throw new HyperFramesProjectPathError('HyperFrames project path must not be empty')
  }
  if (trimmed !== relativePath) {
    throw new HyperFramesProjectPathError(
      `Unsafe HyperFrames project path "${relativePath}": leading or trailing whitespace`,
    )
  }
  if (CONTROL_CHARS.test(relativePath)) {
    throw new HyperFramesProjectPathError(
      `Unsafe HyperFrames project path "${relativePath}": control character`,
    )
  }
  if (relativePath.includes('\\')) {
    throw new HyperFramesProjectPathError(
      `Unsafe HyperFrames project path "${relativePath}": backslashes are not allowed`,
    )
  }
  if (relativePath.startsWith('/') || relativePath.startsWith('//')) {
    throw new HyperFramesProjectPathError(
      `Unsafe HyperFrames project path "${relativePath}": absolute paths are not allowed`,
    )
  }
  if (WINDOWS_DRIVE_PREFIX.test(relativePath)) {
    throw new HyperFramesProjectPathError(
      `Unsafe HyperFrames project path "${relativePath}": Windows drive paths are not allowed`,
    )
  }
  if (URL_SCHEME_PREFIX.test(relativePath)) {
    throw new HyperFramesProjectPathError(
      `Unsafe HyperFrames project path "${relativePath}": URL paths are not allowed`,
    )
  }

  const segments = relativePath.split('/')
  for (const segment of segments) {
    assertSafeSegment(relativePath, segment)
  }

  return {
    path: segments.join('/'),
    segments,
    extension: extensionOf(segments[segments.length - 1]!),
  }
}

export function assertHyperFramesProjectPath(
  projectId: string,
  relativePath: string,
): NormalizedHyperFramesProjectPath {
  assertHyperFramesProjectId(projectId)
  return normalizeHyperFramesProjectPath(relativePath)
}

export function assertWritableFileType(
  relativePath: string,
  mimeType: string | undefined,
  kind: HyperFramesWritableFileKind,
): NormalizedHyperFramesProjectPath {
  const normalized = normalizeHyperFramesProjectPath(relativePath)
  const fileName = normalized.segments[normalized.segments.length - 1]!
  assertSafeFileName(relativePath, fileName, normalized.extension)

  const allowedMimes =
    kind === 'text'
      ? TEXT_MIME_BY_EXTENSION.get(normalized.extension)
      : ASSET_MIME_BY_EXTENSION.get(normalized.extension)

  if (!allowedMimes) {
    throw new HyperFramesProjectPathError(
      `Unsafe HyperFrames project path "${relativePath}": unsupported file extension`,
    )
  }

  const normalizedMime = normalizeMimeType(mimeType)
  if (normalizedMime && !allowedMimes.includes(normalizedMime)) {
    throw new HyperFramesProjectPathError(
      `Unsafe HyperFrames project path "${relativePath}": MIME ${normalizedMime} does not match ${normalized.extension}`,
    )
  }

  return normalized
}

export function assertHyperFramesManifestPaths(manifest: HyperFramesProjectManifest): void {
  assertHyperFramesProjectId(manifest.id)
  assertWritableFileType(manifest.entryFile, 'text/html', 'text')
  assertWritableFileType(manifest.activeCompositionPath, 'text/html', 'text')
  for (const asset of manifest.assets) {
    assertWritableFileType(asset.path, asset.mimeType, 'asset')
  }
}

function assertSafeSegment(fullPath: string, segment: string): void {
  if (segment.length === 0 || segment === '.' || segment === '..') {
    throw new HyperFramesProjectPathError(
      `Unsafe HyperFrames project path "${fullPath}": empty, "." and ".." segments are not allowed`,
    )
  }
  if (segment.startsWith('.')) {
    throw new HyperFramesProjectPathError(
      `Unsafe HyperFrames project path "${fullPath}": hidden path segments are not allowed`,
    )
  }
  if (segment.endsWith(' ') || segment.endsWith('.')) {
    throw new HyperFramesProjectPathError(
      `Unsafe HyperFrames project path "${fullPath}": trailing space or dot`,
    )
  }

  const stem = segment.split('.')[0]?.toLowerCase() ?? segment.toLowerCase()
  if (WINDOWS_RESERVED_NAMES.has(stem)) {
    throw new HyperFramesProjectPathError(
      `Unsafe HyperFrames project path "${fullPath}": reserved Windows device name`,
    )
  }
}

function assertSafeFileName(fullPath: string, fileName: string, extension: string): void {
  const lowerFileName = fileName.toLowerCase()
  if (lowerFileName === '.env' || lowerFileName.startsWith('.env.')) {
    throw new HyperFramesProjectPathError(
      `Unsafe HyperFrames project path "${fullPath}": environment files are not writable`,
    )
  }
  if (DANGEROUS_BASENAMES.has(lowerFileName)) {
    throw new HyperFramesProjectPathError(
      `Unsafe HyperFrames project path "${fullPath}": credential-like files are not writable`,
    )
  }
  if (DANGEROUS_EXTENSIONS.has(extension)) {
    throw new HyperFramesProjectPathError(
      `Unsafe HyperFrames project path "${fullPath}": dangerous file extension`,
    )
  }
}

function extensionOf(fileName: string): string {
  const dotIndex = fileName.lastIndexOf('.')
  if (dotIndex <= 0 || dotIndex === fileName.length - 1) return ''
  return fileName.slice(dotIndex).toLowerCase()
}

function normalizeMimeType(mimeType: string | undefined): string | undefined {
  const normalized = mimeType?.split(';')[0]?.trim().toLowerCase()
  return normalized ? normalized : undefined
}
