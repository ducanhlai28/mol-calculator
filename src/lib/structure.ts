import { STRUCTURES } from '../data/structures'
import { ATOMIC_MASS } from './formula'

export interface SAtom {
  id: number
  el: string
  x: number
  y: number
  c: number // điện tích
  noH?: boolean
  /** Có liên kết thơm (bậc 4 trong molfile) — tính thêm 1 vào tổng bậc khi suy ra H ẩn */
  aro?: boolean
}
export interface SBond {
  id: string
  a: number
  b: number
  o: number // bậc 1–3
  flip?: boolean
}
export interface Struct {
  atoms: SAtom[]
  bonds: SBond[]
}

export type DrawStyle = 'skeletal' | 'condensed'

const SUB = '₀₁₂₃₄₅₆₇₈₉'
const SUP: Record<string, string> = { '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' }

// Hóa trị dùng để thêm H ẩn
const VAL: Record<string, number[]> = {
  H: [1], B: [3], C: [4], N: [3, 5], O: [2], F: [1], Si: [4], P: [3, 5], S: [2, 4, 6], Cl: [1, 3, 5, 7], Br: [1], I: [1],
}

export function parseStruct(str: string): Struct {
  const [atomPart, bondPart = ''] = str.split('|')
  const atoms = atomPart
    .split(';')
    .filter(Boolean)
    .map((t, i) => {
      const p = t.trim().split(/\s+/)
      let el = p[0]
      let noH = false
      if (el.endsWith('!')) {
        noH = true
        el = el.slice(0, -1)
      }
      let c = 0
      const m = p[3]?.match(/^(\d?)([+-])$/)
      if (m) c = (m[1] ? +m[1] : 1) * (m[2] === '+' ? 1 : -1)
      return { id: i, el, x: +p[1], y: +p[2], c, noH }
    })
  const bonds = bondPart
    .split(';')
    .filter(Boolean)
    .map((t, i) => {
      const p = t.trim().split(/\s+/).map(Number)
      return { id: 'b' + i, a: p[0], b: p[1], o: p[2] }
    })
  return { atoms, bonds }
}

const BUILTIN = new Map<string, Struct>(Object.entries(STRUCTURES).map(([cas, s]) => [cas, parseStruct(s)]))

export function builtinStructure(cas?: string): Struct | undefined {
  return cas ? BUILTIN.get(cas) : undefined
}

function implicitH(el: string, c: number, bondSum: number, noH?: boolean): number {
  if (noH || el === 'H' || !VAL[el]) return 0
  const adj = el === 'N' || el === 'O' || el === 'S' || el === 'P' ? c : -Math.abs(c)
  for (const v of VAL[el].map((x) => x + adj)) if (v >= 0 && v >= bondSum) return v - bondSum
  return 0
}

function chargeTxt(c: number) {
  if (!c) return ''
  const n = Math.abs(c)
  return (n > 1 ? SUP[String(n)] : '') + (c > 0 ? '⁺' : '⁻')
}

function atomLabel(el: string, h: number, c: number, isolated: boolean) {
  const hs = h ? 'H' + (h > 1 ? SUB[h] : '') : ''
  if (isolated && h >= 2 && (el === 'O' || el === 'S')) return hs + el + chargeTxt(c)
  return el + hs + chargeTxt(c)
}

export function elColor(el: string) {
  if (el === 'O') return '#C0352B'
  if (el === 'N') return '#1F4F8F'
  if (el === 'S') return '#7A5A00'
  if (el === 'P') return '#8A4B0F'
  if (el === 'F' || el === 'Cl' || el === 'Br' || el === 'I') return '#1B6E2E'
  if (VAL[el] || el === 'He' || el === 'Ar') return '#15201C'
  return '#5B3F94'
}

/** Công thức Hill: C, H rồi các nguyên tố khác theo bảng chữ cái. */
export function hill(counts: Record<string, number>): string {
  const els = Object.keys(counts).filter((e) => counts[e] > 0)
  if (!els.length) return ''
  const order = counts.C
    ? ['C', ...(counts.H ? ['H'] : []), ...els.filter((e) => e !== 'C' && e !== 'H').sort()]
    : els.sort()
  return order.map((e) => e + (counts[e] > 1 ? counts[e] : '')).join('')
}

interface Analysis {
  byId: Record<number, SAtom>
  bs: Record<number, number>
  hImp: Record<number, number>
  counts: Record<string, number>
  sig: string
  bonds: SBond[]
}

/** Tổng bậc liên kết, H ẩn, số nguyên tử và chữ ký nối (H tường minh gộp vào nguyên tử bên cạnh). */
export function analyze(st: Struct): Analysis {
  const byId: Record<number, SAtom> = {}
  const bs: Record<number, number> = {}
  const adj: Record<number, [number, number][]> = {}
  st.atoms.forEach((a) => {
    byId[a.id] = a
    bs[a.id] = a.aro ? 1 : 0
    adj[a.id] = []
  })
  const bonds = st.bonds.filter((b) => byId[b.a] && byId[b.b] && b.a !== b.b)
  bonds.forEach((b) => {
    bs[b.a] += b.o
    bs[b.b] += b.o
    adj[b.a].push([b.b, b.o])
    adj[b.b].push([b.a, b.o])
  })
  const hImp: Record<number, number> = {}
  const counts: Record<string, number> = {}
  st.atoms.forEach((a) => {
    const h = implicitH(a.el, a.c || 0, bs[a.id], a.noH)
    hImp[a.id] = h
    counts[a.el] = (counts[a.el] || 0) + 1
    if (h) counts.H = (counts.H || 0) + h
  })
  const fold: Record<number, boolean> = {}
  const extra: Record<number, number> = {}
  st.atoms.forEach((a) => {
    if (a.el === 'H' && adj[a.id].length === 1) {
      const n = byId[adj[a.id][0][0]]
      if (n.el !== 'H') {
        fold[a.id] = true
        extra[n.id] = (extra[n.id] || 0) + 1
      }
    }
  })
  const sig = st.atoms
    .filter((a) => !fold[a.id])
    .map(
      (a) =>
        a.el +
        ':' +
        (hImp[a.id] + (extra[a.id] || 0)) +
        ':' +
        adj[a.id]
          .filter((n) => !fold[n[0]])
          .map((n) => byId[n[0]].el + n[1])
          .sort()
          .join(','),
    )
    .sort()
    .join('|')
  return { byId, bs, hImp, counts, sig, bonds }
}

export interface ViewAtom {
  id: number
  el: string
  x: number
  y: number
  vis: boolean
  label: string
  color: string
}
export interface BondLine {
  t: number
  l: number
  r: number
}
export interface ViewBond {
  id: string
  o: number
  a: SAtom
  b: SAtom
  left: number
  top: number
  len: number
  ang: number
  lines: BondLine[]
}
export interface StructView {
  atoms: ViewAtom[]
  bonds: ViewBond[]
  counts: Record<string, number>
  sig: string
}

/** 'skeletal' (khung kiểu ChemDraw: ẩn C, liên kết đôi trong vòng lệch vào trong) hoặc 'condensed' (thu gọn). */
export function buildView(st: Struct, mode: DrawStyle): StructView {
  const an = analyze(st)
  const skeletal = mode !== 'condensed'
  const adj: Record<number, number[]> = {}
  st.atoms.forEach((a) => {
    adj[a.id] = []
  })
  an.bonds.forEach((b) => {
    adj[b.a].push(b.b)
    adj[b.b].push(b.a)
  })
  const shown = (a: SAtom) =>
    !skeletal || a.el !== 'C' || an.bs[a.id] === 0 || (a.c || 0) !== 0 || adj[a.id].some((n) => an.byId[n].el === 'H')
  const atoms = st.atoms.map((a) => {
    const vis = shown(a)
    return {
      id: a.id,
      el: a.el,
      x: a.x,
      y: a.y,
      vis,
      label: vis ? atomLabel(a.el, an.hImp[a.id], a.c || 0, an.bs[a.id] === 0) : '',
      color: elColor(a.el),
    }
  })
  const bonds = an.bonds.map((b) => {
    const p = an.byId[b.a]
    const q = an.byId[b.b]
    const dx = q.x - p.x
    const dy = q.y - p.y
    const len = Math.round(Math.hypot(dx, dy))
    let side = 0
    if (skeletal && b.o === 2) {
      let sum = 0
      adj[p.id]
        .filter((n) => n !== q.id)
        .concat(adj[q.id].filter((n) => n !== p.id))
        .forEach((n) => {
          const t = an.byId[n]
          const cr = dx * (t.y - p.y) - dy * (t.x - p.x)
          sum += cr > 1 ? 1 : cr < -1 ? -1 : 0
        })
      side = sum > 0 ? 1 : sum < 0 ? -1 : 0
      if (b.flip) side = side === 0 ? 1 : -side
    }
    const ins = Math.round(len * 0.14)
    let lines: BondLine[]
    if (b.o === 1) lines = [{ t: 7, l: 0, r: 0 }]
    else if (b.o === 3) lines = [{ t: 2, l: 0, r: 0 }, { t: 7, l: 0, r: 0 }, { t: 12, l: 0, r: 0 }]
    else if (side === 0) lines = [{ t: 4, l: 0, r: 0 }, { t: 10, l: 0, r: 0 }]
    else lines = [{ t: 7, l: 0, r: 0 }, { t: side > 0 ? 13 : 1, l: ins, r: ins }]
    return {
      id: b.id,
      o: b.o,
      a: p,
      b: q,
      left: p.x,
      top: p.y - 8,
      len,
      ang: Math.round((Math.atan2(dy, dx) * 1800) / Math.PI) / 10,
      lines,
    }
  })
  return { atoms, bonds, counts: an.counts, sig: an.sig }
}

/** Co giãn và căn giữa cấu trúc vào khung W×H (px). */
export function fitStruct(st: Struct, W: number, H: number, pad: number, maxScale: number): Struct {
  const xs = st.atoms.map((a) => a.x)
  const ys = st.atoms.map((a) => a.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const w = maxX - minX
  const h = maxY - minY
  const sc = Math.min(maxScale, w > 0 ? (W - 2 * pad) / w : maxScale, h > 0 ? (H - 2 * pad) / h : maxScale)
  const ox = (W - w * sc) / 2
  const oy = (H - h * sc) / 2
  return {
    atoms: st.atoms.map((a) => ({ ...a, x: Math.round(ox + (a.x - minX) * sc), y: Math.round(oy + (a.y - minY) * sc) })),
    bonds: st.bonds,
  }
}

export function molarMassOfCounts(counts: Record<string, number>): number {
  return Object.entries(counts).reduce((s, [el, n]) => s + (ATOMIC_MASS[el] ?? NaN) * n, 0)
}

// ——— PubChem 2D record → Struct ———

const SYMBOLS =
  'H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr'.split(' ')

export interface PubchemRecord2D {
  atoms: { aid: number[]; element: number[]; charge?: { aid: number; value: number }[] }
  bonds?: { aid1: number[]; aid2: number[]; order: number[] }
  coords: { aid: number[]; conformers: { x: number[]; y: number[] }[] }[]
}

/** Chuyển bản ghi 2D của PubChem thành Struct; bỏ H gắn vào C/N/O… (vẽ lại bằng H ẩn). */
export function fromPubchemRecord(rec: PubchemRecord2D): Struct {
  const idx = new Map<number, number>()
  rec.atoms.aid.forEach((aid, i) => idx.set(aid, i))
  const charge = new Map((rec.atoms.charge ?? []).map((c) => [c.aid, c.value]))
  const coordAids = rec.coords[0].aid
  const conf = rec.coords[0].conformers[0]
  const pos = new Map<number, [number, number]>()
  coordAids.forEach((aid, i) => pos.set(aid, [conf.x[i], -conf.y[i]]))

  const b = rec.bonds ?? { aid1: [], aid2: [], order: [] }
  const neighbors = new Map<number, number[]>()
  rec.atoms.aid.forEach((aid) => neighbors.set(aid, []))
  b.aid1.forEach((a1, i) => {
    neighbors.get(a1)!.push(b.aid2[i])
    neighbors.get(b.aid2[i])!.push(a1)
  })
  const el = (aid: number) => SYMBOLS[rec.atoms.element[idx.get(aid)!] - 1] ?? 'C'
  const dropped = new Set<number>()
  for (const aid of rec.atoms.aid) {
    if (el(aid) !== 'H' || charge.get(aid)) continue
    const nb = neighbors.get(aid)!
    if (nb.length === 1 && el(nb[0]) !== 'H' && VAL[el(nb[0])]) dropped.add(aid)
  }
  const atoms: SAtom[] = rec.atoms.aid
    .filter((aid) => !dropped.has(aid))
    .map((aid) => ({ id: aid, el: el(aid), x: pos.get(aid)?.[0] ?? 0, y: pos.get(aid)?.[1] ?? 0, c: charge.get(aid) ?? 0 }))
  const bonds: SBond[] = []
  b.aid1.forEach((a1, i) => {
    const a2 = b.aid2[i]
    if (dropped.has(a1) || dropped.has(a2)) return
    bonds.push({ id: 'b' + i, a: a1, b: a2, o: b.order[i] >= 1 && b.order[i] <= 3 ? b.order[i] : 1 })
  })
  return { atoms, bonds }
}

// ——— Molfile V2000 (trao đổi với Ketcher) ———

const CHARGE_CODE: Record<number, number> = { 1: 3, 2: 2, 3: 1, 5: -1, 6: -2, 7: -3 }

/** Đọc molfile V2000 → Struct (toạ độ y đổi chiều cho khớp màn hình). */
export function parseMolfile(text: string): Struct {
  const lines = text.replace(/\r/g, '').split('\n')
  const counts = lines[3] ?? ''
  if (/V3000/.test(counts)) throw new Error('Molfile V3000 chưa được hỗ trợ')
  const na = parseInt(counts.slice(0, 3), 10) || 0
  const nb = parseInt(counts.slice(3, 6), 10) || 0
  const atoms: SAtom[] = []
  for (let i = 0; i < na; i++) {
    const l = lines[4 + i] ?? ''
    atoms.push({
      id: i + 1,
      el: l.slice(31, 34).trim(),
      x: parseFloat(l.slice(0, 10)),
      y: -parseFloat(l.slice(10, 20)),
      c: CHARGE_CODE[parseInt(l.slice(36, 39), 10)] ?? 0,
      noH: parseInt(l.slice(48, 51), 10) === 15 || undefined,
    })
  }
  const byId = new Map(atoms.map((a) => [a.id, a]))
  const bonds: SBond[] = []
  for (let i = 0; i < nb; i++) {
    const l = lines[4 + na + i] ?? ''
    const a = parseInt(l.slice(0, 3), 10)
    const b = parseInt(l.slice(3, 6), 10)
    const t = parseInt(l.slice(6, 9), 10)
    if (t === 4) {
      // liên kết thơm: coi như đơn + đánh dấu nguyên tử thơm (mỗi nguyên tử thơm có thêm 1 liên kết π)
      byId.get(a)!.aro = true
      byId.get(b)!.aro = true
    }
    bonds.push({ id: 'b' + i, a, b, o: t >= 1 && t <= 3 ? t : 1 })
  }
  for (const l of lines.slice(4 + na + nb)) {
    if (!l.startsWith('M  CHG')) continue
    const nums = l.slice(6).trim().split(/\s+/).map(Number)
    for (let k = 1; k + 1 < nums.length; k += 2) {
      const at = byId.get(nums[k])
      if (at) at.c = nums[k + 1]
    }
  }
  return { atoms, bonds }
}

const f4 = (v: number) => v.toFixed(4).padStart(10)
const i3 = (v: number) => String(v).padStart(3)

/** Struct → molfile V2000 (để nạp hình vào Ketcher). */
export function toMolfile(st: Struct): string {
  const idx = new Map(st.atoms.map((a, i) => [a.id, i + 1]))
  const bonds = st.bonds.filter((b) => idx.has(b.a) && idx.has(b.b))
  const out = ['', '  MolCalc', '', `${i3(st.atoms.length)}${i3(bonds.length)}  0  0  0  0  0  0  0  0999 V2000`]
  for (const a of st.atoms)
    out.push(`${f4(a.x)}${f4(-a.y)}${f4(0)} ${a.el.padEnd(3)} 0  0  0  0  0${i3(a.noH ? 15 : 0)}  0  0  0  0  0  0`)
  for (const b of bonds) out.push(`${i3(idx.get(b.a)!)}${i3(idx.get(b.b)!)}${i3(b.o)}  0  0  0  0`)
  const charged = st.atoms.filter((a) => a.c)
  for (let k = 0; k < charged.length; k += 8) {
    const chunk = charged.slice(k, k + 8)
    out.push(`M  CHG${i3(chunk.length)}${chunk.map((a) => ` ${i3(idx.get(a.id)!)} ${i3(a.c)}`).join('')}`)
  }
  out.push('M  END')
  return out.join('\n')
}
