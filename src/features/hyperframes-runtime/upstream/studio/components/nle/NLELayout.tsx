import type { ReactNode } from 'react'

export interface NLELayoutProps {
  fileTree?: ReactNode
  preview?: ReactNode
  timeline?: ReactNode
  sourceEditor?: ReactNode
  propertyPanel?: ReactNode
  toolbar?: ReactNode
}

export function NLELayout({
  fileTree,
  preview,
  timeline,
  sourceEditor,
  propertyPanel,
  toolbar,
}: NLELayoutProps) {
  return (
    <section
      className="grid h-full min-h-0 grid-cols-[220px_minmax(0,1fr)_280px] grid-rows-[auto_minmax(0,1fr)_180px] bg-[var(--hf-studio-bg)] text-[var(--hf-studio-fg)]"
      data-hf-studio-surface="true"
    >
      <header className="col-span-3 border-b border-[color:var(--hf-studio-border)] bg-[var(--hf-studio-panel-header)]">
        {toolbar}
      </header>
      <aside className="row-span-2 min-h-0 border-r border-[color:var(--hf-studio-border)] bg-[var(--hf-studio-panel)]">
        {fileTree}
      </aside>
      <main className="min-h-0 bg-[var(--hf-studio-bg)]">{preview}</main>
      <aside className="row-span-2 min-h-0 border-l border-[color:var(--hf-studio-border)] bg-[var(--hf-studio-panel)]">
        {propertyPanel}
      </aside>
      <section className="min-h-0 border-t border-[color:var(--hf-studio-border)] bg-[var(--hf-studio-panel)]">
        {sourceEditor}
      </section>
      <footer className="col-start-2 min-h-0 border-t border-[color:var(--hf-studio-border)] bg-[var(--hf-studio-panel)]">
        {timeline}
      </footer>
    </section>
  )
}
