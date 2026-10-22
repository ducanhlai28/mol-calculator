import type { AmountUnit, PhysicalState } from '../lib/calc'
import { fmt, loc, parseNumber } from '../lib/calc'
import { prettyFormula } from '../lib/formula'
import { useI18n, type Key } from '../lib/i18n'
import type { Substance } from '../lib/resolve'
import type { DrawStyle, Struct } from '../lib/structure'
import { names, SIG, STATE_STYLE } from '../lib/ui'
import { StructureView } from './StructureView'

export type CondKind = 'stp' | 'satp' | 'custom'

interface Props {
  amountStr: string
  onAmount: (v: string) => void
  unit: AmountUnit
  onUnit: (u: AmountUnit) => void
  substance: Substance | null
  isCustom: boolean
  struct?: Struct
  structLoading: boolean
  drawStyle: DrawStyle
  onDrawStyle: (s: DrawStyle) => void
  phase: PhysicalState
  onPhase: (p: PhysicalState) => void
  cond: CondKind
  onCond: (c: CondKind) => void
  tStr: string
  onT: (v: string) => void
  pStr: string
  onP: (v: string) => void
  dStr: string
  onD: (v: string) => void
}

const UNITS: AmountUnit[] = ['mol', 'mmol', 'kmol']
const PHASES: PhysicalState[] = ['gas', 'liquid', 'solid']
const CONDS: { key: CondKind; sub: string }[] = [
  { key: 'stp', sub: '0 °C · 1 atm' },
  { key: 'satp', sub: '25 °C · 1 bar' },
  { key: 'custom', sub: 'T, P' },
]
const STYLES: DrawStyle[] = ['skeletal', 'condensed']

export function StyleToggle({ value, onChange, small }: { value: DrawStyle; onChange: (s: DrawStyle) => void; small?: boolean }) {
  const { t } = useI18n()
  return (
    <div role="group" aria-label={t('drawStyle')} className={`seg${small ? ' seg-sm' : ''}`}>
      {STYLES.map((k) => (
        <button key={k} type="button" aria-pressed={value === k} onClick={() => onChange(k)}>
          {t(k)}
        </button>
      ))}
    </div>
  )
}

export function InputPanel(p: Props) {
  const { lang, t } = useI18n()
  const s = p.substance
  const st = s?.state
  const amountNum = parseNumber(p.amountStr)
  const amountValid = Number.isFinite(amountNum) && amountNum >= 0
  const pubchemUrl = s?.cid
    ? `https://pubchem.ncbi.nlm.nih.gov/compound/${s.cid}`
    : `https://pubchem.ncbi.nlm.nih.gov/#query=${encodeURIComponent(s?.formula ?? '')}`
  const stLower = st ? t(st).toLowerCase() : ''

  let phaseNote = t('phaseChoose')
  if (st && p.phase !== st) phaseNote = t('phaseChanged', { state: stLower })
  else if (st) phaseNote = t('phaseData', { state: stLower })

  const dens = s?.densities ?? []
  // Công thức có nhiều đồng phân, chưa chọn chất cụ thể
  const undecided = !!s && !p.isCustom && !s.cid && !s.cas && s.name === s.formula
  const densTxt = dens.length ? `${fmt(dens[0].value, SIG)} g/cm³` : st === 'gas' ? t('gasAt25') : t('notAvailable')
  const [main, secondary] = s ? names(lang, s.nameVi, s.name) : ['', undefined]

  return (
    <section className="panel input-panel" aria-labelledby="in-title">
      <h2 id="in-title" className="eyebrow">
        {t('input')}
      </h2>

      <div className="field">
        <label htmlFor="amt" className="field-title">
          {t('amount')}
        </label>
        <div className="amount-row">
          <input
            id="amt"
            className={`input mono amount${amountValid ? '' : ' invalid'}`}
            aria-invalid={!amountValid}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder={t('amountPlaceholder')}
            value={p.amountStr}
            onChange={(e) => p.onAmount(e.target.value)}
          />
          <div role="group" aria-label={t('amountUnit')} className="seg seg-unit">
            {UNITS.map((u) => (
              <button key={u} type="button" aria-pressed={p.unit === u} onClick={() => p.onUnit(u)}>
                {u}
              </button>
            ))}
          </div>
        </div>
      </div>

      {s && (
        <div className="sub-card">
          <div className="sub-card-head">
            <div>
              <div className="sub-formula mono">{prettyFormula(s.formula)}</div>
              <div className="sub-vi">{p.isCustom ? t('customSubstance') : undecided ? t('undecided') : main}</div>
              <div className="muted small">
                {p.isCustom || undecided ? t('formulaLabel', { f: s.formula }) : (secondary ?? s.iupac)}
              </div>
            </div>
            <span className="chip-state" style={st ? { background: STATE_STYLE[st].bg, color: STATE_STYLE[st].fg } : undefined}>
              {st ? t('atRoomTemp', { state: t(st) }) : t('stateUnknown')}
            </span>
          </div>
          <div className="sub-facts">
            <span>
              M = <span className="mono">{fmt(s.molarMass, SIG + 2)} g/mol</span>
            </span>
            <span>
              ρ = <span className="mono">{densTxt}</span>
            </span>
            <span>
              CAS <span className="mono">{s.cas ?? '—'}</span>
            </span>
            {s.cid && (
              <span>
                CID <span className="mono">{s.cid}</span>
              </span>
            )}
          </div>
          <div className="struct-block">
            <div className="struct-head">
              <div className="small strong ink-2">{t('structure')}</div>
              {p.struct && <StyleToggle value={p.drawStyle} onChange={p.onDrawStyle} small />}
            </div>
            {p.struct ? (
              <StructureView struct={p.struct} mode={p.drawStyle} label={t('structureOf', { name: main, f: s.formula })} />
            ) : (
              <div className="dashed small ink-2">
                {p.structLoading
                  ? t('structLoading')
                  : p.isCustom
                    ? t('structCustom')
                    : undecided
                      ? t('structUndecided')
                      : t('structNone')}{' '}
                {!p.structLoading && !undecided && (
                  <a href={pubchemUrl} target="_blank" rel="noopener noreferrer" className="strong">
                    {t('viewOnPubchem')}
                  </a>
                )}
              </div>
            )}
          </div>
          {p.isCustom && <div className="small warn-ink">{t('customWarn')}</div>}
          {s.offline && <div className="small warn-ink">{t('offlineWarn')}</div>}
        </div>
      )}

      <div className="field">
        <div className="field-title">{t('phaseTitle')}</div>
        <div role="group" aria-label={t('phaseGroup')} className="btn-row">
          {PHASES.map((ph) => (
            <button key={ph} type="button" className="toggle" aria-pressed={p.phase === ph} onClick={() => p.onPhase(ph)}>
              {t(ph)}
            </button>
          ))}
        </div>
        <div className="muted small">{phaseNote}</div>
      </div>

      {p.phase === 'gas' ? (
        <div className="field">
          <div className="field-title">{t('gasCond')}</div>
          <div role="group" aria-label={t('condGroup')} className="btn-row">
            {CONDS.map((c) => (
              <button key={c.key} type="button" className="toggle tall" aria-pressed={p.cond === c.key} onClick={() => p.onCond(c.key)}>
                <span className="strong">{t(c.key as Key)}</span>
                <span className="mono xsmall">{c.sub}</span>
              </button>
            ))}
          </div>
          {p.cond === 'custom' && (
            <div className="tp-row">
              <div className="field-sm">
                <label htmlFor="tc" className="small ink-2">
                  {t('temperature')}
                </label>
                <input id="tc" className="input mono" inputMode="decimal" autoComplete="off" value={p.tStr} onChange={(e) => p.onT(e.target.value)} />
              </div>
              <div className="field-sm">
                <label htmlFor="pa" className="small ink-2">
                  {t('pressure')}
                </label>
                <input id="pa" className="input mono" inputMode="decimal" autoComplete="off" value={p.pStr} onChange={(e) => p.onP(e.target.value)} />
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="field">
          <label htmlFor="rho" className="field-title">
            {t('density')}
          </label>
          <input
            id="rho"
            className="input mono"
            inputMode="decimal"
            autoComplete="off"
            placeholder={t('densityPlaceholder')}
            value={p.dStr}
            onChange={(e) => p.onD(e.target.value)}
          />
          <div className="muted small">
            {dens.length
              ? t('densityDefault', { src: dens[0].source === 'table' ? t('densitySrcTable') : 'PubChem' })
              : t('densityNone')}
          </div>
          {dens.length > 1 && (
            <div className="alt-row">
              <span className="muted small">{t('otherValues')}</span>
              {dens.slice(0, 6).map((d, i) => (
                <button
                  key={i}
                  type="button"
                  className="chip mono"
                  title={d.source === 'table' ? t('densitySrcTable') : d.label}
                  onClick={() => p.onD(loc(d.value))}
                >
                  {loc(d.value)}
                  <span className="chip-src">{d.source === 'table' ? t('srcTable') : 'PubChem'}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
