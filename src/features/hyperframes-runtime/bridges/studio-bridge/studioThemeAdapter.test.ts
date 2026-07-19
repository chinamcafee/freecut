import { describe, expect, it } from 'vite-plus/test'
import {
  createFreeCutStudioThemeTokens,
  FREECUT_STUDIO_ICON_LIBRARY,
  FREECUT_STUDIO_ROOT_CLASS,
  FREECUT_STUDIO_THEME_VARIABLES,
} from './studioThemeAdapter'

describe('studioThemeAdapter', () => {
  it('maps migrated Studio tokens to scoped FreeCut CSS variables', () => {
    const theme = createFreeCutStudioThemeTokens()

    expect(theme.rootClassName).toBe(FREECUT_STUDIO_ROOT_CLASS)
    expect(theme.iconLibrary).toBe(FREECUT_STUDIO_ICON_LIBRARY)
    expect(theme.surfaceClassName).toContain('var(--hf-studio-bg)')
    expect(theme.rootStyle).toEqual(
      expect.objectContaining({
        '--hf-studio-bg': 'var(--background)',
        '--hf-studio-border': 'var(--border)',
        '--hf-studio-accent': 'var(--primary)',
        '--hf-studio-font-sans': expect.stringContaining('var(--font-sans'),
      }),
    )
    expect(Object.keys(theme.rootStyle).sort()).toEqual(
      Object.keys(FREECUT_STUDIO_THEME_VARIABLES).sort(),
    )
  })
})
