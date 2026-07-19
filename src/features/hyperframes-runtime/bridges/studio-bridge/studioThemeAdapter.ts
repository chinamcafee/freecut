import type { CSSProperties } from 'react'

export const FREECUT_STUDIO_ROOT_CLASS = 'freecut-hyperframes-studio'
export const FREECUT_STUDIO_ICON_LIBRARY = 'lucide-react'

export const FREECUT_STUDIO_THEME_VARIABLES = {
  '--hf-studio-bg': 'var(--background)',
  '--hf-studio-surface': 'var(--card)',
  '--hf-studio-surface-muted': 'var(--muted)',
  '--hf-studio-panel': 'var(--panel-bg)',
  '--hf-studio-panel-header': 'var(--panel-header)',
  '--hf-studio-border': 'var(--border)',
  '--hf-studio-fg': 'var(--foreground)',
  '--hf-studio-muted-fg': 'var(--muted-foreground)',
  '--hf-studio-accent': 'var(--primary)',
  '--hf-studio-accent-fg': 'var(--primary-foreground)',
  '--hf-studio-danger': 'var(--destructive)',
  '--hf-studio-radius': 'var(--radius)',
  '--hf-studio-font-sans': 'var(--font-sans, ui-sans-serif, system-ui, sans-serif)',
  '--hf-studio-font-mono': 'var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)',
} as const

export type FreeCutStudioThemeStyle = CSSProperties & Record<`--${string}`, string>

export interface FreeCutStudioThemeTokens {
  rootClassName: string
  surfaceClassName: string
  rootStyle: FreeCutStudioThemeStyle
  iconLibrary: typeof FREECUT_STUDIO_ICON_LIBRARY
}

export function createFreeCutStudioThemeTokens(): FreeCutStudioThemeTokens {
  return {
    rootClassName: FREECUT_STUDIO_ROOT_CLASS,
    surfaceClassName:
      'bg-[var(--hf-studio-bg)] text-[var(--hf-studio-fg)] [font-family:var(--hf-studio-font-sans)]',
    rootStyle: { ...FREECUT_STUDIO_THEME_VARIABLES },
    iconLibrary: FREECUT_STUDIO_ICON_LIBRARY,
  }
}
