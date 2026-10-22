import { COMMON_SUBSTANCES, type CommonSubstance } from '../data/common-substances'
import { loc } from '../lib/calc'
import { molarMass, parseFormula, prettyFormula } from '../lib/formula'
import { useI18n } from '../lib/i18n'
import { names } from '../lib/ui'

const ROWS = COMMON_SUBSTANCES.map((d) => ({ d, M: molarMass(parseFormula(d.formula)) }))

export function DataTable({ selectedCas, onPick }: { selectedCas?: string; onPick: (d: CommonSubstance) => void }) {
  const { lang, t } = useI18n()
  return (
    <section aria-labelledby="tbl-title" className="panel table-panel">
      <div className="section-head">
        <h2 id="tbl-title" className="h2">
          {t('tableTitle')}
        </h2>
        <span className="muted small">{t('tableHint', { n: ROWS.length })}</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">{t('colName')}</th>
              <th scope="col">{t('colFormula')}</th>
              <th scope="col" className="num">
                M <span className="no-case">(g/mol)</span>
              </th>
              <th scope="col">{t('colState')}</th>
              <th scope="col" className="num">
                <span className="no-case">ρ (g/cm³)</span>
              </th>
              <th scope="col">CAS</th>
              <th scope="col">
                <span className="sr-only">{t('colActions')}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map(({ d, M }) => {
              const [main, secondary] = names(lang, d.vi, d.en)
              return (
                <tr key={d.cas} className={d.cas === selectedCas ? 'selected' : undefined}>
                  <td>
                    <span className="strong">{main}</span> <span className="muted xsmall">{secondary}</span>
                  </td>
                  <td className="mono">{prettyFormula(d.formula)}</td>
                  <td className="mono num">{loc(M, { maximumFractionDigits: 3 })}</td>
                  <td>{t(d.state)}</td>
                  <td className="mono num">{d.density != null ? loc(d.density) : '—'}</td>
                  <td className="mono ink-2">{d.cas}</td>
                  <td className="num">
                    <button type="button" className="btn-outline sm" aria-label={t('useAria', { name: main })} onClick={() => onPick(d)}>
                      {t('use')}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
