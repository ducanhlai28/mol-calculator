import { useEffect, useRef, useState } from 'react'
import { fmt } from '../lib/calc'
import { molarMass, parseFormula, prettyFormula } from '../lib/formula'
import { useI18n } from '../lib/i18n'
import { autocomplete } from '../lib/pubchem'
import { searchLocal } from '../lib/resolve'

interface Suggestion {
  value: string
  vi: string
  en?: string
  right: string
  source: 'local' | 'pubchem'
}

interface Props {
  value: string
  busy: boolean
  onChange: (v: string) => void
  onSubmit: (v: string) => void
}

const SearchIcon = () => (
  <svg aria-hidden="true" className="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
)

export function SearchBox({ value, busy, onChange, onSubmit }: Props) {
  const { lang, t } = useI18n()
  const [remote, setRemote] = useState<string[]>([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const reqId = useRef(0)

  useEffect(() => {
    const q = value.trim()
    const id = ++reqId.current
    if (q.length < 2) return
    const t = setTimeout(() => {
      autocomplete(q)
        .then((terms) => id === reqId.current && setRemote(terms))
        .catch(() => id === reqId.current && setRemote([]))
    }, 250)
    return () => clearTimeout(t)
  }, [value])

  const local: Suggestion[] = searchLocal(value, 7).map((s) => ({
    value: lang === 'en' ? s.en : s.vi,
    vi: lang === 'en' ? s.en : s.vi,
    en: lang === 'en' ? s.vi : s.en,
    right: `${prettyFormula(s.formula)} · ${fmt(molarMass(parseFormula(s.formula)), 5)} g/mol`,
    source: 'local',
  }))
  const seen = new Set(local.flatMap((s) => [s.vi.toLowerCase(), s.en?.toLowerCase()]))
  const suggestions: Suggestion[] = [
    ...local,
    ...(value.trim().length < 2 ? [] : remote)
      .filter((t) => !seen.has(t.toLowerCase()))
      .slice(0, 9 - Math.min(local.length, 5))
      .map((t) => ({ value: t, vi: t, right: 'PubChem', source: 'pubchem' as const })),
  ].slice(0, 10)

  const pick = (s: Suggestion) => {
    onChange(s.value)
    setOpen(false)
    setActive(-1)
    onSubmit(s.value)
  }
  const show = open && suggestions.length > 0

  return (
    <div className="search">
      <label htmlFor="sub" className="sr-only">
        {t('searchLabel')}
      </label>
      <SearchIcon />
      <input
        id="sub"
        className="search-input"
        type="text"
        role="combobox"
        aria-expanded={show}
        aria-controls="sub-list"
        aria-autocomplete="list"
        aria-busy={busy}
        placeholder={t('searchPlaceholder')}
        value={value}
        autoComplete="off"
        spellCheck={false}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
          setActive(-1)
        }}
        onFocus={() => value.trim() && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setOpen(true)
            setActive((a) => Math.min(a + 1, suggestions.length - 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActive((a) => Math.max(a - 1, -1))
          } else if (e.key === 'Enter') {
            e.preventDefault()
            if (show && active >= 0 && suggestions[active]) pick(suggestions[active])
            else {
              setOpen(false)
              onSubmit(value)
            }
          } else if (e.key === 'Escape') setOpen(false)
        }}
      />
      {busy && <span className="search-busy" aria-hidden="true" />}
      {show && (
        <ul className="sugg-list" id="sub-list" role="listbox" aria-label={t('suggestions')}>
          {suggestions.map((s, i) => (
            <li
              key={`${s.source}:${s.value}`}
              role="option"
              aria-selected={i === active}
              className={`sugg${i === active ? ' active' : ''}`}
              onMouseDown={(e) => {
                e.preventDefault()
                pick(s)
              }}
              onMouseEnter={() => setActive(i)}
            >
              <span className="sugg-names">
                <span className="sugg-vi">{s.vi}</span>
                {s.en && <span className="sugg-en">{s.en}</span>}
              </span>
              <span className={`sugg-right${s.source === 'pubchem' ? ' remote' : ''}`}>{s.right}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
