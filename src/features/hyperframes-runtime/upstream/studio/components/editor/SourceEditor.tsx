import { memo, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

interface SourceEditorProps {
  content: string
  filePath?: string
  language?: string
  onChange?: (content: string) => void
  readOnly?: boolean
  revealOffset?: number | null
}

function detectLanguage(filePath: string | undefined, language: string | undefined): string {
  if (language) return language
  const ext = filePath?.split('.').pop()?.toLowerCase()
  if (!ext) return 'html'
  if (ext === 'md' || ext === 'markdown') return 'markdown'
  if (ext === 'js' || ext === 'jsx') return 'javascript'
  if (ext === 'ts' || ext === 'tsx') return 'typescript'
  return ext
}

export const SourceEditor = memo(function SourceEditor({
  content,
  filePath,
  language,
  onChange,
  readOnly = false,
  revealOffset,
}: SourceEditorProps) {
  const { t } = useTranslation()
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null)
  const resolvedLanguage = detectLanguage(filePath, language)

  useEffect(() => {
    const textarea = textAreaRef.current
    if (!textarea || revealOffset == null || revealOffset < 0) return
    const pos = Math.min(revealOffset, textarea.value.length)
    textarea.setSelectionRange(pos, pos)
    textarea.focus()
  }, [revealOffset])

  return (
    <textarea
      ref={textAreaRef}
      aria-label={
        filePath
          ? t('hyperframes.studio.sourceEditorFile', { file: filePath })
          : t('hyperframes.studio.sourceEditor')
      }
      data-hf-source-editor-language={resolvedLanguage}
      className="h-full w-full resize-none border-0 bg-neutral-950 p-3 font-mono text-xs leading-5 text-neutral-100 outline-none"
      value={content}
      onChange={(event) => onChange?.(event.target.value)}
      readOnly={readOnly}
      spellCheck={false}
    />
  )
})
