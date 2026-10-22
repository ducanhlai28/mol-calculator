import { useEffect, useRef, useState } from 'react'
import type { CommonSubstance } from './data/common-substances'
import { DataTable } from './components/DataTable'
import { DatabaseLinks } from './components/DatabaseLinks'
import { InputPanel, type CondKind } from './components/InputPanel'
import { OutputPanel, type OutputMode } from './components/OutputPanel'
import { SearchBox } from './components/SearchBox'
import { Sketcher } from './components/Sketcher'
import { loc, parseNumber, UNIT_FACTOR, type AmountUnit, type PhysicalState } from './lib/calc'
import { applyLang, LangContext, loadLang, translate, type Lang, type T } from './lib/i18n'
import { prettyFormula } from './lib/formula'
import { structure2d, type Candidate } from './lib/pubchem'
import { buildFromCid, enrichLocal, findLocal, fromFormulaOnly, fromLocal, resolveQuery, type Substance } from './lib/resolve'
import { builtinStructure, fromPubchemRecord, type DrawStyle, type Struct } from './lib/structure'
import { names } from './lib/ui'

interface Shown {
  substance: Substance
  key: string
  candidates?: Candidate[]
  custom?: boolean
  sketchStruct?: Struct
}

const QUICK = ['H2O', 'CO2', 'O2', 'NaCl', 'H2SO4', 'C2H5OH', 'CaCO3', 'Fe']
const INITIAL = findLocal('axit sunfuric')!
/** Hình mở đầu trong trình vẽ: etanol */
const INITIAL_SKETCH = 'CCO'

const Flask = () => (
  <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 3h6" />
    <path d="M10 3v6L4.5 18.5A1.7 1.7 0 0 0 6 21h12a1.7 1.7 0 0 0 1.5-2.5L14 9V3" />
    <path d="M7 15h10" />
  </svg>
)

export default function App() {
  const [lang, setLang] = useState<Lang>(() => {
    const l = loadLang()
    applyLang(l)
    return l
  })
  const t: T = (key, vars) => translate(lang, key, vars)
  const nameOf = (vi: string | undefined, en: string) => names(lang, vi, en)[0]
  const [query, setQuery] = useState(() => nameOf(INITIAL.vi, INITIAL.en))
  const [shown, setShown] = useState<Shown | null>({ substance: fromLocal(INITIAL), key: `cas:${INITIAL.cas}` })
  const [mode, setMode] = useState<OutputMode>({ kind: 'result' })
  const [busy, setBusy] = useState(false)
  const [amountStr, setAmountStr] = useState(() => loc(0.5))
  const [unit, setUnit] = useState<AmountUnit>('mol')
  const [phaseOverride, setPhaseOverride] = useState<PhysicalState | null>(null)
  const [dOverride, setDOverride] = useState<string | null>(null)
  const [cond, setCond] = useState<CondKind>('stp')
  const [tStr, setTStr] = useState('25')
  const [pStr, setPStr] = useState('1')
  const [drawStyle, setDrawStyle] = useState<DrawStyle>('skeletal')
  const [fetched, setFetched] = useState<Record<number, Struct | null>>({})
  const [sketchOpen, setSketchOpen] = useState(false)
  const [sketchMol, setSketchMol] = useState(INITIAL_SKETCH)
  const reqId = useRef(0)

  const s = shown?.substance ?? null
  const isCustom = !!shown?.custom

  useEffect(() => {
    document.documentElement.lang = lang
    document.title = translate(lang, 'appTitle')
  }, [lang])

  /** Đổi ngôn ngữ; viết lại các số đã nhập theo kiểu số của ngôn ngữ mới (0,5 ↔ 0.5). */
  const changeLang = (next: Lang) => {
    if (next === lang) return
    const plain = { useGrouping: false, maximumFractionDigits: 20 }
    const values = [amountStr, tStr, pStr, dOverride].map((v) => (v == null ? null : parseNumber(v)))
    applyLang(next)
    const re = (v: number | null, raw: string | null) => (v != null && Number.isFinite(v) ? loc(v, plain) : raw)
    setAmountStr(re(values[0], amountStr)!)
    setTStr(re(values[1], tStr)!)
    setPStr(re(values[2], pStr)!)
    setDOverride(re(values[3], dOverride))
    if (s && query === nameOf(s.nameVi, s.name)) setQuery(names(next, s.nameVi, s.name)[0])
    setLang(next)
  }

  // Dữ liệu offline của chất ban đầu → bổ sung CID, ChEBI, ρ từ PubChem
  useEffect(() => {
    const id = reqId.current
    enrichLocal(INITIAL).then((sub) => id === reqId.current && setShown((cur) => (cur ? { ...cur, substance: sub } : cur)))
  }, [])

  // Hình cấu tạo: vẽ sẵn theo CAS, hoặc toạ độ 2D từ PubChem
  const builtin = shown ? (shown.sketchStruct ?? builtinStructure(s?.cas)) : undefined
  const cid = s?.cid
  useEffect(() => {
    if (builtin || !cid || cid in fetched) return
    structure2d(cid)
      .then((rec) => setFetched((f) => ({ ...f, [cid]: rec ? fromPubchemRecord(rec) : null })))
      .catch(() => setFetched((f) => ({ ...f, [cid]: null })))
  }, [builtin, cid, fetched])
  const struct = builtin ?? (cid ? (fetched[cid] ?? undefined) : undefined)
  const structLoading = !builtin && !!cid && !(cid in fetched)

  const show = (next: Shown) => {
    setShown(next)
    setMode({ kind: 'result' })
    setPhaseOverride(null)
    setDOverride(null)
  }

  const search = async (raw: string) => {
    const q = raw.trim()
    if (!q) return
    setQuery(q)
    const id = ++reqId.current
    const local = findLocal(q)
    if (local) {
      setBusy(false)
      show({ substance: fromLocal(local), key: `cas:${local.cas}` })
      enrichLocal(local).then((sub) => id === reqId.current && setShown((cur) => (cur ? { ...cur, substance: sub } : cur)))
      return
    }
    setBusy(true)
    try {
      const r = await resolveQuery(q)
      if (id !== reqId.current) return
      if (r.kind === 'found') {
        const sub = r.substance
        show({ substance: sub, key: sub.cid ? `cid:${sub.cid}` : `f:${sub.formula}`, custom: !sub.cid && !sub.cas })
      } else if (r.kind === 'choose') {
        show({ substance: r.fallback, key: `f:${r.formula}`, candidates: r.candidates })
      } else {
        setShown(null)
        setMode({ kind: 'notfound', query: q, tried: r.tried })
      }
    } catch (e) {
      if (id !== reqId.current) return
      setMode({
        kind: 'error',
        message: e instanceof TypeError ? t('networkError') : String((e as Error).message ?? e),
      })
    } finally {
      if (id === reqId.current) setBusy(false)
    }
  }

  const pickCid = async (cidToUse: number) => {
    const id = ++reqId.current
    setBusy(true)
    try {
      const sub = await buildFromCid(cidToUse)
      if (id !== reqId.current) return
      setQuery(nameOf(sub.nameVi, sub.name))
      show({ substance: sub, key: `cid:${cidToUse}` })
    } catch (e) {
      if (id === reqId.current) setMode({ kind: 'error', message: String((e as Error).message ?? e) })
    } finally {
      if (id === reqId.current) setBusy(false)
    }
  }

  const pickLocal = (d: CommonSubstance) => {
    setSketchOpen(false)
    search(nameOf(d.vi, d.en))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const applySketchFormula = (formula: string, sketchStruct: Struct) => {
    reqId.current++
    setBusy(false)
    setQuery(formula)
    setSketchOpen(false)
    show({ substance: fromFormulaOnly(formula, false), key: `sk:${formula}:${Date.now()}`, custom: true, sketchStruct })
  }

  const phase: PhysicalState = phaseOverride ?? s?.state ?? 'solid'
  const dStr = dOverride ?? (s?.densities[0] ? loc(s.densities[0].value) : '')
  const moles = parseNumber(amountStr) * UNIT_FACTOR[unit]

  const linkSubject: Substance | null =
    s ?? (mode.kind === 'notfound' ? { name: mode.query, formula: mode.query, molarMass: NaN, densities: [] } : null)
  const lookupName = s ? prettyFormula(s.formula) : mode.kind === 'notfound' ? `“${mode.query}”` : t('substance')

  return (
    <LangContext.Provider value={lang}>
    <div className="app">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <div className="logo">
              <Flask />
            </div>
            <div className="brand-text">
              <div className="brand-name">MolCalc</div>
              <div className="brand-sub">{t('brandSub')}</div>
            </div>
            <div role="group" aria-label={t('language')} className="seg seg-sm lang-switch">
              {(['vi', 'en'] as Lang[]).map((l) => (
                <button key={l} type="button" lang={l} aria-pressed={lang === l} onClick={() => changeLang(l)}>
                  {l === 'vi' ? 'VI' : 'EN'}
                </button>
              ))}
            </div>
          </div>
          <div role="search" className="search-area">
            <div className="search-row">
              <SearchBox value={query} busy={busy} onChange={setQuery} onSubmit={search} />
              <button type="button" className="btn-primary tall" onClick={() => setSketchOpen(true)}>
                <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round">
                  <path d="M12 3 19 7v8l-7 4-7-4V7Z" />
                  <path d="M19 7l3-2" />
                </svg>
                {t('drawStructure')}
              </button>
            </div>
            <div className="quick">
              <span className="muted small">{t('quickPick')}</span>
              {QUICK.map((f) => (
                <button key={f} type="button" className="chip mono" onClick={() => search(f)}>
                  {prettyFormula(f)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="main">
        <div className={`io-row${busy ? ' is-busy' : ''}`}>
          <InputPanel
            amountStr={amountStr}
            onAmount={setAmountStr}
            unit={unit}
            onUnit={setUnit}
            substance={mode.kind === 'result' ? s : null}
            isCustom={isCustom}
            struct={struct}
            structLoading={structLoading}
            drawStyle={drawStyle}
            onDrawStyle={setDrawStyle}
            phase={phase}
            onPhase={setPhaseOverride}
            cond={cond}
            onCond={setCond}
            tStr={tStr}
            onT={setTStr}
            pStr={pStr}
            onP={setPStr}
            dStr={dStr}
            onD={setDOverride}
          />
          <OutputPanel
            mode={mode}
            substance={mode.kind === 'result' ? s : null}
            candidates={mode.kind === 'result' ? shown?.candidates : undefined}
            onChoose={(c) => pickCid(c.cid)}
            amountStr={amountStr}
            unit={unit}
            moles={moles}
            phase={phase}
            cond={cond}
            tStr={tStr}
            pStr={pStr}
            density={parseNumber(dStr)}
          />
        </div>

        {linkSubject && <DatabaseLinks substance={linkSubject} title={lookupName} />}

        <DataTable selectedCas={s?.cas} onPick={pickLocal} />

        {lang === 'en' ? (
          <p className="muted small constants">
            Constants: N<sub>A</sub> = 6.02214 × 10²³ mol⁻¹ · R = 0.082057 L·atm/(mol·K) · STP: V<sub>m</sub> = 22.414 L/mol (0 °C, 1 atm) ·
            SATP: V<sub>m</sub> = 24.79 L/mol (25 °C, 1 bar). Gas volumes assume an ideal gas. Data: PubChem (NIH), CRC Handbook — reference values;
            check the supplier’s SDS for real work.
          </p>
        ) : (
          <p className="muted small constants">
            Hằng số: N<sub>A</sub> = 6,02214 × 10²³ mol⁻¹ · R = 0,082057 L·atm/(mol·K) · đktc: V<sub>m</sub> = 22,414 L/mol (0 °C, 1 atm) · đkc:
            V<sub>m</sub> = 24,79 L/mol (25 °C, 1 bar). Thể tích khí tính theo khí lý tưởng. Dữ liệu: PubChem (NIH), CRC Handbook — giá trị tham khảo,
            kiểm tra lại với SDS khi dùng thực tế.
          </p>
        )}
      </main>

      {sketchOpen && (
        <Sketcher
          initialMol={sketchMol}
          onSave={setSketchMol}
          loadable={s && struct && !shown?.sketchStruct ? { struct, label: prettyFormula(s.formula) } : undefined}
          onClose={() => setSketchOpen(false)}
          onPickLocal={pickLocal}
          onPickCid={(c) => {
            setSketchOpen(false)
            pickCid(c)
          }}
          onUseFormula={applySketchFormula}
        />
      )}
    </div>
    </LangContext.Provider>
  )
}
