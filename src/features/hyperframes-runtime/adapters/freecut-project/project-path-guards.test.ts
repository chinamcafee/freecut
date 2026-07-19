import {
  HyperFramesProjectPathError,
  assertHyperFramesProjectId,
  assertWritableFileType,
  normalizeHyperFramesProjectPath,
} from './project-path-guards'

describe('project-path-guards', () => {
  it('normalizes safe POSIX relative project paths', () => {
    expect(normalizeHyperFramesProjectPath('compositions/main.html')).toEqual({
      path: 'compositions/main.html',
      segments: ['compositions', 'main.html'],
      extension: '.html',
    })
    expect(assertHyperFramesProjectId('hf-project')).toBe('hf-project')
  })

  it('rejects paths that can escape a HyperFrames project directory', () => {
    for (const unsafePath of [
      '',
      '/tmp/out.html',
      'C:/Users/project/index.html',
      'file:///tmp/index.html',
      'http://example.com/index.html',
      'compositions\\main.html',
      'compositions/../secret.html',
      'compositions//main.html',
      '.ssh/id_rsa',
    ]) {
      expect(() => normalizeHyperFramesProjectPath(unsafePath), unsafePath).toThrow(
        HyperFramesProjectPathError,
      )
    }
  })

  it('rejects dangerous extensions, credential files and MIME mismatches', () => {
    expect(() => assertWritableFileType('scripts/install.sh', undefined, 'text')).toThrow(
      /dangerous file extension/,
    )
    expect(() => assertWritableFileType('.env', undefined, 'text')).toThrow(
      HyperFramesProjectPathError,
    )
    expect(() => assertWritableFileType('assets/logo.png', 'application/json', 'asset')).toThrow(
      /MIME/,
    )
    expect(() =>
      assertWritableFileType('assets/archive.bin', 'application/octet-stream', 'asset'),
    ).toThrow(/unsupported file extension/)
  })

  it('allows known text, media and font writes', () => {
    expect(assertWritableFileType('index.html', 'text/html; charset=utf-8', 'text').path).toBe(
      'index.html',
    )
    expect(assertWritableFileType('assets/logo.png', 'image/png', 'asset').path).toBe(
      'assets/logo.png',
    )
    expect(assertWritableFileType('fonts/title.woff2', 'font/woff2', 'asset').path).toBe(
      'fonts/title.woff2',
    )
  })
})
