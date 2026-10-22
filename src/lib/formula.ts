// Nguyên tử khối chuẩn (IUPAC, giá trị quy ước) — g/mol
export const ATOMIC_MASS: Record<string, number> = {
  H: 1.008, He: 4.0026, Li: 6.94, Be: 9.0122, B: 10.81, C: 12.011, N: 14.007, O: 15.999,
  F: 18.998, Ne: 20.180, Na: 22.990, Mg: 24.305, Al: 26.982, Si: 28.085, P: 30.974,
  S: 32.06, Cl: 35.45, Ar: 39.95, K: 39.098, Ca: 40.078, Sc: 44.956, Ti: 47.867,
  V: 50.942, Cr: 51.996, Mn: 54.938, Fe: 55.845, Co: 58.933, Ni: 58.693, Cu: 63.546,
  Zn: 65.38, Ga: 69.723, Ge: 72.630, As: 74.922, Se: 78.971, Br: 79.904, Kr: 83.798,
  Rb: 85.468, Sr: 87.62, Y: 88.906, Zr: 91.224, Nb: 92.906, Mo: 95.95, Tc: 98,
  Ru: 101.07, Rh: 102.91, Pd: 106.42, Ag: 107.87, Cd: 112.41, In: 114.82, Sn: 118.71,
  Sb: 121.76, Te: 127.60, I: 126.90, Xe: 131.29, Cs: 132.91, Ba: 137.33, La: 138.91,
  Ce: 140.12, Pr: 140.91, Nd: 144.24, Pm: 145, Sm: 150.36, Eu: 151.96, Gd: 157.25,
  Tb: 158.93, Dy: 162.50, Ho: 164.93, Er: 167.26, Tm: 168.93, Yb: 173.05, Lu: 174.97,
  Hf: 178.49, Ta: 180.95, W: 183.84, Re: 186.21, Os: 190.23, Ir: 192.22, Pt: 195.08,
  Au: 196.97, Hg: 200.59, Tl: 204.38, Pb: 207.2, Bi: 208.98, Po: 209, At: 210, Rn: 222,
  Fr: 223, Ra: 226, Ac: 227, Th: 232.04, Pa: 231.04, U: 238.03, Np: 237, Pu: 244,
  Am: 243, Cm: 247, Bk: 247, Cf: 251, Es: 252, Fm: 257, Md: 258, No: 259, Lr: 262,
  D: 2.0141, T: 3.0160,
}

export type Composition = Record<string, number>

const SUBSCRIPT_DIGITS = '₀₁₂₃₄₅₆₇₈₉'
const HYDRATE_SEP = /[·•∙⋅*.]/

function normalizeFormulaInput(raw: string): string {
  let s = raw.trim().replace(/\s+/g, '')
  s = s.replace(/[₀-₉]/g, (c) => String(SUBSCRIPT_DIGITS.indexOf(c)))
  // Bỏ điện tích ở cuối: SO4^2-, NH4+, Fe3+
  s = s.replace(/\^?\d*[+-]+$/, '')
  return s
}

function parseGroup(s: string): Composition {
  const stack: Composition[] = [{}]
  let i = 0
  const addTo = (target: Composition, el: string, n: number) => {
    target[el] = (target[el] ?? 0) + n
  }
  const readCount = () => {
    let num = ''
    while (i < s.length && /\d/.test(s[i])) num += s[i++]
    return num ? parseInt(num, 10) : 1
  }
  while (i < s.length) {
    const ch = s[i]
    if (ch === '(' || ch === '[' || ch === '{') {
      stack.push({})
      i++
    } else if (ch === ')' || ch === ']' || ch === '}') {
      i++
      const group = stack.pop()
      if (!group || stack.length === 0) throw new Error('Ngoặc không khớp')
      const mult = readCount()
      for (const [el, n] of Object.entries(group)) addTo(stack[stack.length - 1], el, n * mult)
    } else if (/[A-Z]/.test(ch)) {
      let el = ch
      i++
      if (i < s.length && /[a-z]/.test(s[i])) el += s[i++]
      if (!(el in ATOMIC_MASS)) throw new Error(`Không có nguyên tố "${el}"`)
      addTo(stack[stack.length - 1], el, readCount())
    } else {
      throw new Error(`Ký tự không hợp lệ "${ch}"`)
    }
  }
  if (stack.length !== 1) throw new Error('Ngoặc không khớp')
  return stack[0]
}

/** Phân tích công thức hóa học, hỗ trợ ngoặc và tinh thể ngậm nước (CuSO4·5H2O). */
export function parseFormula(raw: string): Composition {
  const s = normalizeFormulaInput(raw)
  if (!s) throw new Error('Công thức rỗng')
  const total: Composition = {}
  for (const part of s.split(HYDRATE_SEP)) {
    if (!part) throw new Error('Công thức không hợp lệ')
    const m = part.match(/^(\d+)(.*)$/)
    const coef = m ? parseInt(m[1], 10) : 1
    const comp = parseGroup(m ? m[2] : part)
    for (const [el, n] of Object.entries(comp)) total[el] = (total[el] ?? 0) + n * coef
  }
  if (Object.keys(total).length === 0) throw new Error('Công thức không hợp lệ')
  return total
}

export function tryParseFormula(raw: string): Composition | null {
  try {
    return parseFormula(raw)
  } catch {
    return null
  }
}

export function molarMass(comp: Composition): number {
  return Object.entries(comp).reduce((sum, [el, n]) => sum + ATOMIC_MASS[el] * n, 0)
}

/** Trông giống công thức (bắt đầu bằng chữ in hoa / ngoặc, không dấu cách, không chữ tiếng Việt) và phân tích được. */
export function looksLikeFormula(raw: string): boolean {
  const s = raw.trim()
  if (!/^[A-Z([{][A-Za-z0-9()[\]{}·•∙⋅*.₀-₉^+-]*$/.test(s)) return false
  return tryParseFormula(s) !== null
}

/** Chuyển công thức sang dạng có chỉ số dưới Unicode: H2SO4 → H₂SO₄ (giữ hệ số đầu phần ngậm nước). */
export function prettyFormula(raw: string): string {
  return raw
    .replace(/\*/g, '·')
    .replace(/(?<=[A-Za-z)\]}])(\d+)/g, (d) => [...d].map((c) => SUBSCRIPT_DIGITS[+c]).join(''))
}

/** Công thức có thể so sánh: bỏ khoảng trắng, chỉ số Unicode → số thường, dấu ngậm nước thống nhất. */
export function canonicalFormulaKey(raw: string): string {
  return normalizeFormulaInput(raw).replace(/[•∙⋅*.]/g, '·')
}
