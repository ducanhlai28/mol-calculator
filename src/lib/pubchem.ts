import type { PhysicalState } from './calc'
import type { PubchemRecord2D } from './structure'

const PUG = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug'
const PUG_VIEW = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug_view'
const AUTOCOMPLETE = 'https://pubchem.ncbi.nlm.nih.gov/rest/autocomplete/compound'

const CACHE_PREFIX = 'pc1:'
const memCache = new Map<string, unknown>()

export class NotFoundError extends Error {}

async function fetchJson<T>(url: string, { persist = true } = {}): Promise<T> {
  if (memCache.has(url)) return memCache.get(url) as T
  if (persist) {
    try {
      const hit = localStorage.getItem(CACHE_PREFIX + url)
      if (hit) {
        const data = JSON.parse(hit) as T
        memCache.set(url, data)
        return data
      }
    } catch {
      /* localStorage không khả dụng */
    }
  }
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 15000)
  let res: Response
  try {
    res = await fetch(url, { signal: ctrl.signal })
  } finally {
    clearTimeout(timer)
  }
  if (res.status === 404 || res.status === 400) throw new NotFoundError(url)
  if (!res.ok) throw new Error(`PubChem lỗi ${res.status}`)
  const data = (await res.json()) as T
  memCache.set(url, data)
  if (persist) {
    try {
      localStorage.setItem(CACHE_PREFIX + url, JSON.stringify(data))
    } catch {
      /* đầy bộ nhớ — bỏ qua */
    }
  }
  return data
}

const enc = encodeURIComponent

export async function autocomplete(q: string, limit = 8): Promise<string[]> {
  if (q.trim().length < 2) return []
  const data = await fetchJson<{ dictionary_terms?: { compound?: string[] } }>(
    `${AUTOCOMPLETE}/${enc(q.trim())}/json?limit=${limit}`,
    { persist: false },
  )
  return data.dictionary_terms?.compound ?? []
}

export async function cidsByName(name: string): Promise<number[]> {
  try {
    const data = await fetchJson<{ IdentifierList: { CID: number[] } }>(
      `${PUG}/compound/name/${enc(name)}/cids/JSON`,
    )
    return data.IdentifierList.CID.filter((c) => c > 0)
  } catch (e) {
    if (e instanceof NotFoundError) return []
    throw e
  }
}

export interface Candidate {
  cid: number
  title: string
  formula: string
}

// Đồng vị đánh dấu (ethanol-d6, sodium chloride-37Cl, (~35~Cl)…) — ẩn khỏi danh sách chọn
// Đồng vị đánh dấu (Cobalt-60), ion (Cobalt(2+)) và hỗn hợp ("formaldehyde;methane") cũng bị ẩn
export const ISOTOPE_TITLE =
  /(-d\d*\b|\bd\d+\b|\(~|~\d|\[\d+\]|\b\d{1,3}[A-Z][a-z]?\b|-\d{1,3}[A-Z]|\b[A-Z][a-z]?-\d{1,3}\b|[a-z]-\d{1,3}(\s+atom)?$|\(\d*[+-]\)|\bcation\b|\banion\b|isotope|\batom$|^[A-Za-z]+:[A-Z0-9]+$| na \d|deuter|tritio|tritium|;)/i

export async function formulaCandidates(formula: string, max = 12): Promise<Candidate[]> {
  try {
    const data = await fetchJson<{ PropertyTable: { Properties: { CID: number; Title?: string; MolecularFormula: string }[] } }>(
      `${PUG}/compound/fastformula/${enc(formula)}/property/Title,MolecularFormula/JSON?MaxRecords=40`,
    )
    return data.PropertyTable.Properties.filter((p) => p.Title && !ISOTOPE_TITLE.test(p.Title))
      .sort((a, b) => a.CID - b.CID)
      .slice(0, max)
      .map((p) => ({ cid: p.CID, title: p.Title!, formula: p.MolecularFormula }))
  } catch (e) {
    if (e instanceof NotFoundError) return []
    throw e
  }
}

export interface CompoundProps {
  cid: number
  formula: string
  molecularWeight: number
  title: string
  iupac?: string
  inchikey?: string
}

export async function compoundProps(cid: number): Promise<CompoundProps> {
  const data = await fetchJson<{
    PropertyTable: { Properties: { CID: number; MolecularFormula: string; MolecularWeight: string; Title?: string; IUPACName?: string; InChIKey?: string }[] }
  }>(`${PUG}/compound/cid/${cid}/property/MolecularFormula,MolecularWeight,IUPACName,Title,InChIKey/JSON`)
  const p = data.PropertyTable.Properties[0]
  return {
    cid: p.CID,
    formula: p.MolecularFormula,
    molecularWeight: Number(p.MolecularWeight),
    title: p.Title ?? p.IUPACName ?? `CID ${cid}`,
    iupac: p.IUPACName,
    inchikey: p.InChIKey,
  }
}

export const CAS_RE = /^\d{2,7}-\d{2}-\d$/

/** Kiểm tra chữ số kiểm tra của số CAS. */
export function isValidCas(cas: string): boolean {
  if (!CAS_RE.test(cas)) return false
  const digits = cas.replace(/-/g, '')
  const check = Number(digits.at(-1))
  const body = digits.slice(0, -1)
  let sum = 0
  for (let i = 0; i < body.length; i++) sum += Number(body[body.length - 1 - i]) * (i + 1)
  return sum % 10 === check
}

export interface SynonymIds {
  cas?: string
  chebi?: string // "CHEBI:16236"
}

/** Lấy số CAS và mã ChEBI nằm trong danh sách tên đồng nghĩa của PubChem. */
export async function synonymIds(cid: number): Promise<SynonymIds> {
  try {
    const data = await fetchJson<{ InformationList: { Information: { Synonym?: string[] }[] } }>(
      `${PUG}/compound/cid/${cid}/synonyms/JSON`,
    )
    const syns = data.InformationList.Information[0]?.Synonym ?? []
    return {
      cas: syns.find(isValidCas),
      chebi: syns.find((s) => /^CHEBI:\d+$/.test(s)),
    }
  } catch (e) {
    if (e instanceof NotFoundError) return {}
    throw e
  }
}

/** Toạ độ 2D của chất (để vẽ công thức cấu tạo). */
export async function structure2d(cid: number): Promise<PubchemRecord2D | undefined> {
  try {
    const data = await fetchJson<{ PC_Compounds: PubchemRecord2D[] }>(`${PUG}/compound/cid/${cid}/record/JSON?record_type=2d`)
    return data.PC_Compounds[0]
  } catch (e) {
    if (e instanceof NotFoundError) return undefined
    throw e
  }
}

/** Tra chất theo SMILES (trùng khớp cấu trúc). Trả về CID hoặc undefined. */
export async function cidBySmiles(smiles: string): Promise<number | undefined> {
  const key = `smiles:${smiles}`
  if (memCache.has(key)) return memCache.get(key) as number | undefined
  const res = await fetch(`${PUG}/compound/smiles/cids/JSON`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ smiles }),
  })
  if (res.status === 404 || res.status === 400) return undefined
  if (!res.ok) throw new Error(`PubChem lỗi ${res.status}`)
  const data = (await res.json()) as { IdentifierList?: { CID: number[] } }
  const cid = data.IdentifierList?.CID.find((c) => c > 0)
  memCache.set(key, cid)
  return cid
}

// ——— PUG View: khối lượng riêng & trạng thái ———

interface ViewInfo {
  Value?: { StringWithMarkup?: { String: string }[]; Number?: number[]; Unit?: string }
}
interface ViewSection {
  Section?: ViewSection[]
  Information?: ViewInfo[]
}

function collectStrings(sec: ViewSection, out: string[] = []): string[] {
  for (const info of sec.Information ?? []) {
    const v = info.Value
    if (!v) continue
    if (v.StringWithMarkup) out.push(v.StringWithMarkup.map((s) => s.String).join(''))
    else if (v.Number) out.push(`${v.Number[0]}${v.Unit ? ' ' + v.Unit : ''}`)
  }
  for (const s of sec.Section ?? []) collectStrings(s, out)
  return out
}

async function viewHeading(cid: number, heading: string): Promise<string[]> {
  try {
    const data = await fetchJson<{ Record: ViewSection }>(
      `${PUG_VIEW}/data/compound/${cid}/JSON?heading=${enc(heading)}`,
    )
    return collectStrings(data.Record)
  } catch (e) {
    if (e instanceof NotFoundError) return []
    throw e
  }
}

export interface DensityValue {
  value: number // g/mL
  label: string // chuỗi gốc, hiển thị cho người dùng
  source: 'table' | 'pubchem' | 'user'
  score?: number
}

const NUM = String.raw`(\d+(?:[.,]\d+)?)`

/** Đọc một dòng "Density" của PubChem → g/mL cho chất lỏng/rắn; null nếu là khí hoặc không đọc được. */
export function parseDensityText(text: string): DensityValue | null {
  if (/air\s*=\s*1|vapou?r density|relative gas density|critical density|\(gas|gas at/i.test(text) && !/liq|solid/i.test(text))
    return null
  const cleaned = text
    .replace(/\(?\s*water\s*=\s*1\s*\)?/gi, ' ')
    .replace(/\d+\/\d+\s*°?\s*C/g, ' ') // "20/4 °C"
  const m = cleaned.match(new RegExp(`${NUM}(?:\\s*-\\s*${NUM})?\\s*(g\\s*/\\s*cu\\s*cm|g\\s*/\\s*cm\\s*(?:3|³|\\^3)|g\\s*/\\s*ml|kg\\s*/\\s*(?:cu\\s*m|m3|m³)|g\\s*/\\s*l\\b|lb\\s*/\\s*cu\\s*ft)?`, 'i'))
  if (!m) return null
  const unit = (m[3] ?? '').toLowerCase().replace(/\s/g, '')
  if (/kg\/|g\/l$|lb\//.test(unit)) return null // mật độ khí
  const value = Number(m[1].replace(',', '.'))
  if (!(value > 0.05 && value < 25)) return null

  let score = 0
  if (unit) score += 2
  const t = cleaned.match(/(?:at|@|\()\s*(-?\d+(?:\.\d+)?)\s*°?\s*(C|F)\b/i)
  if (t) {
    const tc = t[2].toUpperCase() === 'F' ? ((Number(t[1]) - 32) * 5) / 9 : Number(t[1])
    score += Math.abs(tc - 22.5) <= 10 ? 2 : -3
  }
  if (/%|solution|commercial|aq/i.test(text)) score -= 3
  if (/USCG|EPA/.test(text)) score -= 1
  if (/^</.test(text.trim())) score -= 2
  return { value, label: text.trim(), source: 'pubchem', score }
}

export async function densities(cid: number): Promise<DensityValue[]> {
  const lines = await viewHeading(cid, 'Density')
  return rankDensities(lines.map(parseDensityText).filter((d): d is DensityValue => d !== null))
}

/** Sắp xếp theo điểm; giá trị lệch >10% so với trung vị bị trừ điểm (thường là dung dịch / sai đơn vị). */
export function rankDensities(values: DensityValue[]): DensityValue[] {
  const sorted = values.map((d) => d.value).sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)]
  const seen = new Set<string>()
  return values
    .map((d) => (Math.abs(d.value - median) / median > 0.1 ? { ...d, score: (d.score ?? 0) - 4 } : d))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .filter((d) => {
      const k = d.value.toFixed(3)
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
}

/** Đoán trạng thái ở điều kiện thường từ "Physical Description". */
export function guessState(descriptions: string[]): PhysicalState | undefined {
  const score: Record<PhysicalState, number> = { gas: 0, liquid: 0, solid: 0 }
  descriptions.slice(0, 6).forEach((d, i) => {
    const w = 1 / (i + 1)
    const s = d.toLowerCase()
    if (/\bgas\b|gaseous/.test(s) && !/liquefied|compressed gas|gas vapor/.test(s)) score.gas += w
    if (/\bliquid\b/.test(s) && !/refrigerated liquid|liquefied/.test(s)) score.liquid += w
    if (/\bsolid\b|crystal|powder|granul|flakes|needles|prisms|pellets|lumps/.test(s)) score.solid += w
  })
  const best = (Object.keys(score) as PhysicalState[]).sort((a, b) => score[b] - score[a])[0]
  return score[best] > 0 ? best : undefined
}

export async function physicalState(cid: number): Promise<PhysicalState | undefined> {
  return guessState(await viewHeading(cid, 'Physical Description'))
}
