import { COMMON_SUBSTANCES, type CommonSubstance } from '../data/common-substances'
import type { PhysicalState } from './calc'
import { canonicalFormulaKey, looksLikeFormula, molarMass, parseFormula, tryParseFormula } from './formula'
import {
  CAS_RE,
  cidsByName,
  compoundProps,
  densities,
  formulaCandidates,
  physicalState,
  structure2d,
  synonymIds,
  type Candidate,
  type DensityValue,
} from './pubchem'
import { builtinStructure, fromPubchemRecord, hill, type Struct } from './structure'
import { looksVietnamese, normalizeVi, translateViName } from './vietnamese'

export interface Substance {
  name: string
  nameVi?: string
  formula: string
  molarMass: number
  cid?: number
  cas?: string
  chebi?: string
  inchikey?: string
  iupac?: string
  state?: PhysicalState
  stateSource?: 'table' | 'pubchem'
  densities: DensityValue[]
  /** Không lấy được dữ liệu online — chỉ tính từ công thức */
  offline?: boolean
}

export type Resolution =
  | { kind: 'found'; substance: Substance }
  | { kind: 'choose'; formula: string; candidates: Candidate[]; fallback: Substance }
  | { kind: 'notfound'; tried: string[] }

// ——— Bảng offline ———

const localIndex = new Map<string, CommonSubstance>()
for (const s of COMMON_SUBSTANCES) {
  const keys = [s.vi, s.en, ...(s.aliases ?? [])].map(normalizeVi)
  keys.push(`f:${canonicalFormulaKey(s.formula)}`, `cas:${s.cas}`)
  for (const k of keys) if (!localIndex.has(k)) localIndex.set(k, s)
}

/**
 * Công thức hữu cơ viết dạng phân tử (Hill, vd C6H12O6, C4H8O) thường ứng với nhiều đồng phân —
 * không tự chọn chất trong bảng mà để người dùng chọn từ danh sách PubChem.
 * Dạng thu gọn (C2H5OH, CH3COOH) thì đã xác định được chất.
 */
export function isMolecularFormula(query: string): boolean {
  const comp = tryParseFormula(query)
  return !!comp && !!comp.C && !!comp.H && canonicalFormulaKey(query) === hill(comp)
}

function findLocalByFormula(query: string): CommonSubstance | undefined {
  return localIndex.get(`f:${canonicalFormulaKey(query)}`)
}

export function findLocal(query: string): CommonSubstance | undefined {
  const q = query.trim()
  if (CAS_RE.test(q)) return localIndex.get(`cas:${q}`)
  return (isMolecularFormula(q) ? undefined : findLocalByFormula(q)) ?? localIndex.get(normalizeVi(q))
}

export function searchLocal(query: string, limit = 6): CommonSubstance[] {
  const q = normalizeVi(query)
  if (q.length < 1) return []
  const fq = query.trim().toLowerCase()
  const hits: [number, CommonSubstance][] = []
  for (const s of COMMON_SUBSTANCES) {
    const names = [s.vi, s.en, ...(s.aliases ?? [])].map(normalizeVi)
    let rank = Infinity
    for (const n of names) {
      if (n === q) rank = Math.min(rank, 0)
      else if (n.startsWith(q)) rank = Math.min(rank, 1)
      else if (n.includes(q)) rank = Math.min(rank, 3)
    }
    if (s.formula.toLowerCase().startsWith(fq)) rank = Math.min(rank, 2)
    if (s.cas.startsWith(fq)) rank = Math.min(rank, 2)
    if (rank < Infinity) hits.push([rank, s])
  }
  return hits.sort((a, b) => a[0] - b[0]).slice(0, limit).map(([, s]) => s)
}

/** Ghép giá trị bảng với PubChem, bỏ giá trị PubChem trùng với bảng. */
function mergeDensities(table: DensityValue[], pubchem: DensityValue[]): DensityValue[] {
  const seen = new Set(table.map((d) => d.value.toFixed(3)))
  return [...table, ...pubchem.filter((d) => !seen.has(d.value.toFixed(3)))]
}

function massFromFormula(formula: string): number | undefined {
  const comp = tryParseFormula(formula)
  return comp ? molarMass(comp) : undefined
}

export function fromLocal(s: CommonSubstance): Substance {
  return {
    name: s.en,
    nameVi: s.vi,
    formula: s.formula,
    molarMass: massFromFormula(s.formula)!,
    cas: s.cas,
    state: s.state,
    stateSource: 'table',
    densities: s.density ? [{ value: s.density, label: 'Bảng chất phổ biến (CRC, 20–25 °C)', source: 'table' }] : [],
  }
}

/** Bổ sung CID, InChIKey, ChEBI, giá trị khối lượng riêng từ PubChem cho chất trong bảng offline. */
export async function enrichLocal(s: CommonSubstance): Promise<Substance> {
  const base = fromLocal(s)
  try {
    let cids = await cidsByName(s.cas)
    if (!cids.length) cids = await cidsByName(s.en)
    if (!cids.length) return base
    const cid = cids[0]
    const [props, ids, dens] = await Promise.all([
      compoundProps(cid),
      synonymIds(cid).catch(() => ({ chebi: undefined })),
      s.state === 'gas' ? Promise.resolve([]) : densities(cid).catch(() => [] as DensityValue[]),
    ])
    return {
      ...base,
      cid,
      chebi: ids.chebi,
      inchikey: props.inchikey,
      iupac: props.iupac,
      densities: mergeDensities(base.densities, dens),
    }
  } catch {
    return { ...base, offline: true }
  }
}

export async function buildFromCid(cid: number): Promise<Substance> {
  const [props, ids, dens, state] = await Promise.all([
    compoundProps(cid),
    synonymIds(cid).catch(() => ({ cas: undefined, chebi: undefined })),
    densities(cid).catch(() => [] as DensityValue[]),
    physicalState(cid).catch(() => undefined),
  ])
  const local = ids.cas ? findLocal(ids.cas) : undefined
  if (local) {
    const base = fromLocal(local)
    return {
      ...base,
      name: props.title,
      cid,
      chebi: ids.chebi,
      inchikey: props.inchikey,
      iupac: props.iupac,
      densities: mergeDensities(base.densities, dens),
    }
  }
  return {
    name: props.title,
    formula: props.formula,
    molarMass: massFromFormula(props.formula) ?? props.molecularWeight,
    cid,
    cas: ids.cas,
    chebi: ids.chebi,
    inchikey: props.inchikey,
    iupac: props.iupac,
    state,
    stateSource: state ? 'pubchem' : undefined,
    densities: dens,
  }
}

/** Công thức cấu tạo: hình vẽ sẵn theo CAS, không có thì lấy toạ độ 2D từ PubChem. */
export async function structureFor(s: Substance): Promise<Struct | undefined> {
  const builtin = builtinStructure(s.cas)
  if (builtin) return builtin
  if (!s.cid) return undefined
  const rec = await structure2d(s.cid)
  return rec ? fromPubchemRecord(rec) : undefined
}

export function fromFormulaOnly(formula: string, offline: boolean): Substance {
  return { name: formula, formula, molarMass: massFromFormula(formula)!, densities: [], offline }
}

/** Tìm chất từ chuỗi người dùng nhập: tên VN/EN, công thức hoặc số CAS. */
export async function resolveQuery(raw: string): Promise<Resolution> {
  const q = raw.trim()
  const local = findLocal(q)
  if (local) return { kind: 'found', substance: await enrichLocal(local) }

  if (CAS_RE.test(q)) {
    const cids = await cidsByName(q)
    return cids.length ? { kind: 'found', substance: await buildFromCid(cids[0]) } : { kind: 'notfound', tried: [q] }
  }

  if (looksLikeFormula(q)) {
    let candidates: Candidate[]
    try {
      // PubChem chỉ nhận công thức phân tử phẳng: Fe2(SO4)3 → Fe2O12S3, CuSO4·5H2O → CuH10O9S
      candidates = await formulaCandidates(hill(parseFormula(q)))
    } catch {
      const offlineLocal = findLocalByFormula(q)
      if (offlineLocal) return { kind: 'found', substance: { ...fromLocal(offlineLocal), offline: true } }
      return { kind: 'found', substance: fromFormulaOnly(q, true) }
    }
    if (candidates.length === 0) return { kind: 'found', substance: fromFormulaOnly(q, false) }
    if (candidates.length === 1) return { kind: 'found', substance: await buildFromCid(candidates[0].cid) }
    return { kind: 'choose', formula: q, candidates, fallback: fromFormulaOnly(q, false) }
  }

  const names = looksVietnamese(q) ? [...translateViName(q), q] : [q, ...translateViName(q)]
  const tried: string[] = []
  for (const name of [...new Set(names)].slice(0, 6)) {
    tried.push(name)
    const localHit = findLocal(name)
    if (localHit) return { kind: 'found', substance: await enrichLocal(localHit) }
    const cids = await cidsByName(name)
    if (cids.length) return { kind: 'found', substance: await buildFromCid(cids[0]) }
  }
  return { kind: 'notfound', tried }
}
