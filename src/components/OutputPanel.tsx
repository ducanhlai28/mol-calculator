import { AVOGADRO, calculate, fmt, loc, parseNumber, R_L_ATM, sci, type AmountUnit, type GasCondition, type PhysicalState } from '../lib/calc'
import { ATOMIC_MASS, prettyFormula, tryParseFormula } from '../lib/formula'
import { useI18n } from '../lib/i18n'
import type { Candidate } from '../lib/pubchem'
import type { Substance } from '../lib/resolve'
import { SIG, STATE_STYLE } from '../lib/ui'
import type { CondKind } from './InputPanel'

export type OutputMode =
  | { kind: 'idle' }
  | { kind: 'result' }
  | { kind: 'notfound'; query: string; tried: string[] }
  | { kind: 'error'; message: string }

interface Props {
  mode: OutputMode
  substance: Substance | null
  candidates?: Candidate[]
  onChoose: (c: Candidate) => void
  amountStr: string
  unit: AmountUnit
  moles: number
  phase: PhysicalState
  cond: CondKind
  tStr: string
  pStr: string
  density: number
}

export function OutputPanel(p: Props) {
  const { t } = useI18n()
  const s = p.substance
  const nRaw = parseNumber(p.amountStr)
  const nValid = Number.isFinite(p.moles) && p.moles >= 0
  const isGas = p.phase === 'gas'

  const gas: GasCondition =
    p.cond === 'custom' ? { kind: 'custom', tempC: parseNumber(p.tStr), pressureAtm: parseNumber(p.pStr) } : { kind: p.cond }
  const condTxt = p.cond === 'stp' ? t('condStp') : p.cond === 'satp' ? t('condSatp') : `${p.tStr || '?'} °C, ${p.pStr || '?'} atm`

  const r = s ? calculate({ moles: p.moles, molarMass: s.molarMass, state: p.phase, density: p.density, gas }) : null
  const mass = r?.massG ?? NaN
  const VL = r?.volumeL ?? NaN
  const nTxt = fmt(p.moles, SIG)
  const fSub = s ? prettyFormula(s.formula) : ''

  let volMain = '—'
  let volUnit = isGas ? 'L' : p.phase === 'solid' ? 'cm³' : 'mL'
  let volAlt = ' '
  if (Number.isFinite(VL)) {
    if (isGas) {
      if (VL >= 1 || VL === 0) {
        volMain = fmt(VL, SIG)
        volUnit = 'L'
        volAlt = `= ${fmt(VL * 1000, SIG)} mL · ${fmt(VL / 1000, SIG)} m³`
      } else {
        volMain = fmt(VL * 1000, SIG)
        volUnit = 'mL'
        volAlt = `= ${fmt(VL, SIG)} L`
      }
    } else {
      const cm3 = VL * 1000
      if (cm3 >= 1000) {
        volMain = fmt(VL, SIG)
        volUnit = 'L'
        volAlt = `= ${fmt(cm3, SIG)}${p.phase === 'solid' ? ' cm³' : ' mL'}`
      } else {
        volMain = fmt(cm3, SIG)
        volAlt = `= ${fmt(VL, SIG)} L`
      }
    }
  } else if (!isGas && s) volAlt = t('needDensity')

  const massAlt = Number.isFinite(mass) ? (mass >= 1000 ? `= ${fmt(mass / 1000, SIG)} kg` : `= ${fmt(mass * 1000, SIG)} mg`) : ' '
  const NA = sci(AVOGADRO, SIG)

  const steps: string[] = []
  if (s && nValid) {
    const M = fmt(s.molarMass, SIG + 2)
    steps.push(`M(${fSub}) = ${M} g/mol`)
    if (p.unit !== 'mol') steps.push(`n = ${fmt(nRaw, SIG)} ${p.unit} = ${nTxt} mol`)
    steps.push(`m = n × M = ${nTxt} × ${M} = ${fmt(mass, SIG)} g`)
    if (isGas) {
      if (p.cond === 'custom')
        steps.push(`V = nRT / P = ${nTxt} × ${loc(R_L_ATM)} × ${fmt(parseNumber(p.tStr) + 273.15, 5)} / ${p.pStr || '?'} = ${fmt(VL, SIG)} L`)
      else steps.push(`V = n × Vm = ${nTxt} × ${loc(r!.molarVolume!)} = ${fmt(VL, SIG)} L  (${condTxt})`)
    } else {
      steps.push(`V = m / ρ = ${fmt(mass, SIG)} / ${Number.isFinite(p.density) ? loc(p.density) : '?'} = ${fmt(VL * 1000, SIG)} cm³`)
    }
    steps.push(`N = n × Nᴀ = ${nTxt} × ${NA} = ${sci(p.moles * AVOGADRO, SIG)}`)
  }

  const comp: { label: string; pct: number; pctTxt: string; massTxt: string }[] = []
  const atoms = s ? tryParseFormula(s.formula) : null
  if (atoms) {
    const Mf = Object.entries(atoms).reduce((a, [el, k]) => a + ATOMIC_MASS[el] * k, 0)
    for (const [el, k] of Object.entries(atoms)) {
      const share = (ATOMIC_MASS[el] * k) / Mf
      comp.push({
        label: prettyFormula(el + (k > 1 ? k : '')),
        pct: share * 100,
        pctTxt: loc(share * 100, { maximumFractionDigits: 2 }),
        massTxt: fmt(mass * share, SIG),
      })
    }
  }

  const headline = s ? (nValid ? `${fmt(nRaw, SIG)} ${p.unit} ${fSub}` : t('invalidAmountShort')) : ''
  const volLabel = isGas ? t('volGas', { cond: condTxt }) : p.phase === 'solid' ? t('volSolid') : t('volLiquid')

  return (
    <section className="panel output-panel" aria-labelledby="out-title" aria-live="polite">
      <div className="panel-head">
        <h2 id="out-title" className="eyebrow">
          {t('results')}
        </h2>
        <div className="mono ink-2">{headline}</div>
      </div>

      {p.mode.kind === 'notfound' && (
        <div className="dashed big-pad">
          <div className="strong lg">{t('notFound', { q: p.mode.query })}</div>
          <div className="ink-2">{t('notFoundBody', { tried: p.mode.tried.join(' · ') })}</div>
          <a
            href={`https://pubchem.ncbi.nlm.nih.gov/#query=${encodeURIComponent(p.mode.query)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="strong"
          >
            {t('searchOnPubchem', { q: p.mode.query })}
          </a>
        </div>
      )}

      {p.mode.kind === 'error' && <div className="dashed big-pad warn-ink">{p.mode.message}</div>}

      {p.candidates && p.candidates.length > 0 && (
        <div className="choose">
          <div className="strong">{t('chooseTitle', { f: fSub })}</div>
          <div className="cand-list">
            {p.candidates.map((c) => (
              <button key={c.cid} type="button" className="cand" onClick={() => p.onChoose(c)}>
                <span className="strong">{c.title}</span>
                <span className="muted xsmall mono">CID {c.cid}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {s && p.mode.kind === 'result' && !nValid && <div className="dashed big-pad warn-ink">{t('invalidAmount', { v: p.amountStr })}</div>}

      {s && p.mode.kind === 'result' && nValid && (
        <div className="results">
          <div className="big-cards">
            <div className="big-card" style={{ background: '#EAF3F0' }}>
              <div className="big-label" style={{ color: '#0B4F45' }}>
                {t('mass')}
              </div>
              <div className="big-value">
                <span className="mono big-num">{fmt(mass, SIG)}</span>
                <span className="big-unit" style={{ color: '#0B4F45' }}>
                  g
                </span>
              </div>
              <div className="mono small ink-2">{massAlt}</div>
            </div>
            <div className="big-card" style={{ background: STATE_STYLE[p.phase].bg }}>
              <div className="big-label" style={{ color: STATE_STYLE[p.phase].fg }}>
                {volLabel}
              </div>
              <div className="big-value">
                <span className="mono big-num">{volMain}</span>
                <span className="big-unit" style={{ color: STATE_STYLE[p.phase].fg }}>
                  {volUnit}
                </span>
              </div>
              <div className="mono small ink-2">{volAlt}</div>
            </div>
          </div>

          <div className="stats">
            <div className="stat">
              <div className="xsmall muted">{t('particles')}</div>
              <div className="mono stat-val">{sci(p.moles * AVOGADRO, SIG)}</div>
            </div>
            <div className="stat">
              <div className="xsmall muted">{t('molarMass')}</div>
              <div className="mono stat-val">{fmt(s.molarMass, SIG + 2)} g/mol</div>
            </div>
            <div className="stat">
              <div className="xsmall muted">{t('moles')}</div>
              <div className="mono stat-val">{nTxt} mol</div>
            </div>
          </div>

          <div className="block">
            <h3 className="h3">{t('steps')}</h3>
            <ol className="steps mono">
              {steps.map((st, i) => (
                <li key={i}>{st}</li>
              ))}
            </ol>
          </div>

          {comp.length > 0 && (
            <div className="block">
              <h3 className="h3">{t('composition')}</h3>
              {comp.map((e) => (
                <div key={e.label} className="comp-row">
                  <div className="mono strong comp-el">{e.label}</div>
                  <div className="comp-bar">
                    <div style={{ width: `${e.pct.toFixed(1)}%` }} />
                  </div>
                  <div className="mono small ink-2 comp-txt">
                    {e.pctTxt} % · {e.massTxt} g
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
