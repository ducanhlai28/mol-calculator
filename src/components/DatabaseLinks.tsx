import { useState } from 'react'
import { useI18n } from '../lib/i18n'
import { buildLinks } from '../lib/links'
import type { Substance } from '../lib/resolve'

const Arrow = () => (
  <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0B6E5F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 17 17 7" />
    <path d="M8 7h9v9" />
  </svg>
)

export function DatabaseLinks({ substance, title }: { substance: Substance; title: string }) {
  const { lang, t } = useI18n()
  const [copied, setCopied] = useState<string | null>(null)
  const copy = (text: string) => {
    navigator.clipboard
      ?.writeText(text)
      .then(() => {
        setCopied(text)
        setTimeout(() => setCopied(null), 4000)
      })
      .catch(() => {})
  }

  return (
    <section aria-labelledby="db-title" className="section">
      <div className="section-head">
        <h2 id="db-title" className="h2">
          {t('lookupTitle', { name: title })}
        </h2>
        <span className="muted small">{copied ? t('copied', { v: copied }) : t('lookupHint')}</span>
      </div>
      <div className="db-grid">
        {buildLinks(substance, lang).map((l) => (
          <a
            key={l.id}
            className="dbcard"
            href={l.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={l.copy ? () => copy(l.copy!) : undefined}
          >
            <span className="dbcard-head">
              <span className="dbcard-name">{l.name}</span>
              <Arrow />
            </span>
            <span className="small ink-2">{l.desc}</span>
            <span className="mono xsmall accent-ink wrap">{l.key}</span>
          </a>
        ))}
      </div>
    </section>
  )
}
