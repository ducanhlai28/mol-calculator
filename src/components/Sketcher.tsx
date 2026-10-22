import type { Ketcher } from 'ketcher-core'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { COMMON_SUBSTANCES, type CommonSubstance } from '../data/common-substances'
import { fmt } from '../lib/calc'
import { parseFormula, prettyFormula } from '../lib/formula'
import { useI18n } from '../lib/i18n'
import { cidBySmiles, compoundProps, formulaCandidates, type Candidate } from '../lib/pubchem'
import { analyze, builtinStructure, hill, molarMassOfCounts, parseMolfile, toMolfile, type Struct } from '../lib/structure'
import { names, SIG } from '../lib/ui'
import { ErrorBoundary } from './ErrorBoundary'

const KetcherEditor = lazy(() => import('./KetcherEditor'))

const LOCAL_INFO = COMMON_SUBSTANCES.map((d) => {
  const st = builtinStructure(d.cas)
  return { d, hill: hill(parseFormula(d.formula)), sig: st ? analyze(st).sig : null }
})

interface Props {
  /** Hình vẽ lần trước (molfile hoặc SMILES) */
  initialMol: string
  onSave: (mol: string) => void
  loadable?: { struct: Struct; label: string }
  onClose: () => void
  onPickLocal: (d: CommonSubstance) => void
  onPickCid: (cid: number) => void
  onUseFormula: (formula: string, struct: Struct) => void
}

interface Drawing {
  molfile: string
  smiles: string
  struct: Struct
}

interface Remote {
  smiles: string
  loading: boolean
  exact?: Candidate
  iso: Candidate[]
  error?: boolean
}

const EMPTY: Drawing = { molfile: '', smiles: '', struct: { atoms: [], bonds: [] } }

export function Sketcher(p: Props) {
  const { lang, t } = useI18n()
  const ketcherRef = useRef<Ketcher | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [drawing, setDrawing] = useState<Drawing>(EMPTY)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [remote, setRemote] = useState<Remote | null>(null)
  const dialogRef = useRef<HTMLElement>(null)
  // Hình mới nhất (molfile), để lưu lại khi đóng hộp thoại
  const molRef = useRef<string | null>(null)

  // Đọc hình hiện tại từ Ketcher: molfile (để so khớp trong bảng) + SMILES của Indigo (để tra PubChem)
  const read = async () => {
    const k = ketcherRef.current
    if (!k) return
    try {
      const molfile = await k.getMolfile('v2000')
      const struct = parseMolfile(molfile)
      const smiles = struct.atoms.length ? await k.getSmiles().catch(() => '') : ''
      molRef.current = struct.atoms.length ? molfile : ''
      setDrawing({ molfile, smiles, struct })
    } catch (e) {
      setError(String((e as Error).message ?? e))
    }
  }

  const onInit = async (k: Ketcher) => {
    ketcherRef.current = k
    try {
      if (p.initialMol) await k.setMolecule(p.initialMol)
    } catch {
      /* hình cũ không đọc được — bắt đầu trống */
    }
    k.editor.subscribe('change', () => {
      clearTimeout(timer.current)
      timer.current = setTimeout(read, 300)
    })
    await read()
    setReady(true)
  }

  // Lưu hình khi đóng hộp thoại để lần sau mở lại
  const { onSave } = p
  useEffect(() => {
    dialogRef.current?.focus()
    const pending = timer
    return () => {
      clearTimeout(pending.current)
      // Ketcher chưa tải xong thì giữ nguyên hình cũ
      if (molRef.current != null) onSave(molRef.current)
    }
  }, [onSave])

  const struct = drawing.struct
  const empty = struct.atoms.length === 0
  const an = analyze(struct)
  const formula = hill(an.counts)
  const smiles = drawing.smiles
  const unknownAtom = struct.atoms.some((a) => !/^[A-Z][a-z]?$/.test(a.el)) || Number.isNaN(molarMassOfCounts(an.counts))

  // Tra cấu trúc trên PubChem sau khi ngừng vẽ 0,6 s
  useEffect(() => {
    if (!smiles) return
    let cancelled = false
    const tm = setTimeout(async () => {
      setRemote({ smiles, loading: true, iso: [] })
      try {
        const cid = await cidBySmiles(smiles)
        const exact = cid ? await compoundProps(cid).then((c) => ({ cid, title: c.title, formula: c.formula })) : undefined
        const iso = (await formulaCandidates(formula, 6).catch(() => [])).filter((c) => c.cid !== cid).slice(0, 4)
        if (!cancelled) setRemote({ smiles, loading: false, exact, iso })
      } catch {
        if (!cancelled) setRemote({ smiles, loading: false, iso: [], error: true })
      }
    }, 600)
    return () => {
      cancelled = true
      clearTimeout(tm)
    }
  }, [smiles, formula])

  const sigExact = empty ? [] : LOCAL_INFO.filter((x) => x.sig && x.sig === an.sig)
  const rem = remote && remote.smiles === smiles ? remote : null
  // Chất trong bảng chưa có hình vẽ sẵn: coi là khớp nếu PubChem nhận ra đúng chất đó (so theo tên)
  const exactTitle = rem?.exact?.title.toLowerCase()
  const named = exactTitle
    ? LOCAL_INFO.find((x) => x.hill === formula && [x.d.en, ...(x.d.aliases ?? [])].some((n) => n.toLowerCase() === exactTitle))
    : undefined
  const localExact = named && !sigExact.includes(named) ? [...sigExact, named] : sigExact
  const localIso = empty ? [] : LOCAL_INFO.filter((x) => x.hill === formula && !localExact.includes(x)).slice(0, 6)
  const remoteExact = localExact.length ? undefined : rem?.exact
  const hasExact = localExact.length > 0 || !!remoteExact
  // Bỏ đồng phân PubChem trùng tên với chất trong bảng đã liệt kê
  const listedNames = new Set(
    [...localExact, ...localIso].flatMap((x) => [x.d.en, ...(x.d.aliases ?? [])]).map((n) => n.toLowerCase()),
  )
  const remoteIso = (rem?.iso ?? []).filter((c) => !listedNames.has(c.title.toLowerCase()))
  const isoCount = localIso.length + remoteIso.length

  const load = async () => {
    const k = ketcherRef.current
    if (!k || !p.loadable) return
    try {
      await k.setMolecule(toMolfile(p.loadable.struct))
    } catch (e) {
      setError(String((e as Error).message ?? e))
    }
  }

  const fSub = empty ? '—' : prettyFormula(formula)

  const localMatch = (d: CommonSubstance, exact: boolean) => {
    const [main, secondary] = names(lang, d.vi, d.en)
    return (
      <div key={d.cas} className={exact ? 'match exact' : 'match'}>
        <div>
          <div className="strong">{main}</div>
          <div className="xsmall muted">
            {secondary} · {prettyFormula(d.formula)}
            {!exact && ` · ${t('maybeIsomer')}`}
          </div>
        </div>
        <button type="button" className={exact ? 'btn-primary sm' : 'btn-outline sm'} onClick={() => p.onPickLocal(d)}>
          {exact ? t('useThis') : t('use')}
        </button>
      </div>
    )
  }

  return (
    <div className="overlay">
      <section
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sk-title"
        className="dialog dialog-wide"
        onKeyDown={(e) => e.key === 'Escape' && e.target === e.currentTarget && p.onClose()}
      >
        <div className="dialog-head">
          <div>
            <h2 id="sk-title" className="dialog-title">
              {t('skTitle')}
            </h2>
            <div className="muted small">{t('skSub')}</div>
          </div>
          <div className="dialog-actions">
            {p.loadable && (
              <button type="button" className="btn-outline" disabled={!ready} onClick={load}>
                {t('loadStruct', { f: p.loadable.label })}
              </button>
            )}
            <button type="button" aria-label={t('close')} className="icon-btn" onClick={p.onClose}>
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M6 6l12 12" />
                <path d="M18 6 6 18" />
              </svg>
            </button>
          </div>
        </div>

        <div className="dialog-body">
          <div className="sk-main">
            <div className="ketcher-box">
              <ErrorBoundary fallback={(e) => <div className="ketcher-loading warn-ink">{t('ketcherError', { m: e.message })}</div>}>
                <Suspense fallback={<div className="ketcher-loading">{t('ketcherLoading')}</div>}>
                  <KetcherEditor onInit={onInit} onError={(m) => setError(m)} />
                </Suspense>
                {!ready && <div className="ketcher-loading overlay-load">{t('ketcherLoading')}</div>}
              </ErrorBoundary>
            </div>
            {error && <div className="small warn-ink">{t('ketcherError', { m: error })}</div>}
            <div className="muted small">{t('ketcherNote')}</div>
          </div>

          <div className="sk-side">
            <div className="formula-box">
              <div className="small muted">{t('skFormula')}</div>
              <div className="mono sk-formula">{fSub}</div>
              <div className="mono small ink-2">
                {empty ? t('noAtoms') : `M = ${fmt(molarMassOfCounts(an.counts), SIG + 2)} g/mol`}
              </div>
              {smiles && <div className="mono xsmall muted wrap">SMILES: {smiles}</div>}
              {unknownAtom && <div className="small warn-ink">{t('skUnknownAtom')}</div>}
            </div>

            {hasExact && (
              <div className="match-group">
                <div className="strong accent-dark">{t('exactMatch')}</div>
                {localExact.map((x) => localMatch(x.d, true))}
                {remoteExact && (
                  <div className="match exact">
                    <div>
                      <div className="strong">{remoteExact.title}</div>
                      <div className="xsmall muted">
                        PubChem CID {remoteExact.cid} · {prettyFormula(remoteExact.formula)}
                      </div>
                    </div>
                    <button type="button" className="btn-primary sm" onClick={() => p.onPickCid(remoteExact.cid)}>
                      {t('useThis')}
                    </button>
                  </div>
                )}
              </div>
            )}

            {isoCount > 0 && (
              <div className="match-group">
                <div className="strong">{t('sameFormula')}</div>
                {localIso.map((x) => localMatch(x.d, false))}
                {remoteIso.map((c) => (
                  <div key={c.cid} className="match">
                    <div>
                      <div className="strong">{c.title}</div>
                      <div className="xsmall muted">
                        PubChem CID {c.cid} · {t('maybeIsomer')}
                      </div>
                    </div>
                    <button type="button" className="btn-outline sm" onClick={() => p.onPickCid(c.cid)}>
                      {t('use')}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {!empty && rem?.loading && <div className="small muted">{t('skSearching')}</div>}
            {!empty && rem?.error && <div className="small warn-ink">{t('skOffline')}</div>}

            {!empty && !hasExact && rem && !rem.loading && (
              <div className="dashed">
                <div className="strong">{isoCount ? t('skNoExact') : t('skNotFound')}</div>
                <div className="small ink-2">{t('skStillCalc')}</div>
                <button type="button" className="btn-primary sm" disabled={unknownAtom} onClick={() => p.onUseFormula(formula, struct)}>
                  {t('skCalcWith', { f: fSub })}
                </button>
                <a href={`https://pubchem.ncbi.nlm.nih.gov/#query=${encodeURIComponent(formula)}`} target="_blank" rel="noopener noreferrer" className="strong small">
                  {t('skFindOn', { f: fSub })}
                </a>
              </div>
            )}

            {empty && ready && <div className="small muted">{t('skDrawOne')}</div>}
          </div>
        </div>
      </section>
    </div>
  )
}
