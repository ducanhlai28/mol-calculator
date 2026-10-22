export const R_L_ATM = 0.082057 // L·atm/(mol·K)
export const AVOGADRO = 6.02214076e23

export type PhysicalState = 'gas' | 'liquid' | 'solid'
export type AmountUnit = 'mol' | 'mmol' | 'kmol'
export const UNIT_FACTOR: Record<AmountUnit, number> = { mol: 1, mmol: 1e-3, kmol: 1e3 }

export type GasCondition =
  | { kind: 'stp' } // đktc: 0 °C, 1 atm
  | { kind: 'satp' } // đkc: 25 °C, 1 bar
  | { kind: 'custom'; tempC: number; pressureAtm: number }

export function molarVolume(cond: GasCondition): number {
  if (cond.kind === 'stp') return 22.414
  if (cond.kind === 'satp') return 24.79
  const T = cond.tempC + 273.15
  const P = cond.pressureAtm
  return T > 0 && P > 0 ? (R_L_ATM * T) / P : NaN
}

let LOCALE = 'vi-VN'

/** Đổi kiểu hiển thị/đọc số: 'vi-VN' (0,5 · 1.234) hoặc 'en-US' (0.5 · 1,234). */
export function setNumberLocale(locale: string) {
  LOCALE = locale
}

/** x.toLocaleString theo ngôn ngữ đang chọn. */
export const loc = (x: number, opts?: Intl.NumberFormatOptions) => x.toLocaleString(LOCALE, opts)

/** Đọc số kiểu Việt Nam lẫn quốc tế: "0,5", "1.5", "2e-3", "1,5×10^-3", "1.234,5", "1,234.5". */
export function parseNumber(raw: string): number {
  let s = raw.trim().replace(/\s+/g, '')
  if (!s) return NaN
  const sci = s.match(/^(.+?)[x×*]10\^?([+\-−]?\d+)$/i)
  if (sci) s = `${sci[1]}e${sci[2].replace('−', '-')}`
  if (s.includes(',') && s.includes('.')) {
    // Dấu nào đứng sau cùng là dấu thập phân: "1.234,5" → 1234.5 ; "1,234.5" → 1234.5
    s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '')
  } else if (LOCALE.startsWith('en') && /^[+-]?\d{1,3}(,\d{3})+$/.test(s)) {
    s = s.replace(/,/g, '') // "1,000" kiểu tiếng Anh
  } else s = s.replace(',', '.')
  if (!/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(s)) return NaN
  return Number(s)
}

export interface CalcInput {
  moles: number
  molarMass: number // g/mol
  state: PhysicalState
  density?: number // g/cm³, cho lỏng/rắn
  gas: GasCondition
}

export interface CalcResult {
  massG: number
  volumeL: number // NaN khi thiếu khối lượng riêng
  particles: number
  molarVolume?: number
}

export function calculate(input: CalcInput): CalcResult {
  const massG = input.moles * input.molarMass
  const particles = input.moles * AVOGADRO
  if (input.state === 'gas') {
    const vm = molarVolume(input.gas)
    return { massG, particles, volumeL: input.moles * vm, molarVolume: vm }
  }
  const volumeL = input.density && input.density > 0 ? massG / input.density / 1000 : NaN
  return { massG, particles, volumeL }
}

const SUP: Record<string, string> = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻' }

/** Dạng khoa học a × 10ⁿ. */
export function sci(x: number, sig = 4): string {
  if (!Number.isFinite(x)) return '—'
  if (x === 0) return '0'
  let e = Math.floor(Math.log10(Math.abs(x)))
  let m = x / 10 ** e
  if (Math.abs(m) >= 9.9999999) {
    m /= 10
    e += 1
  }
  const sup = [...String(e)].map((c) => SUP[c]).join('')
  return `${loc(m, { maximumSignificantDigits: sig })} × 10${sup}`
}

/** Số với `sig` chữ số có nghĩa (không làm tròn phần nguyên); quá lớn/nhỏ thì dạng khoa học. */
export function fmt(x: number, sig = 4): string {
  if (x == null || !Number.isFinite(x)) return '—'
  if (x === 0) return '0'
  const a = Math.abs(x)
  if (a >= 1e7 || a < 1e-4) return sci(x, sig)
  return loc(x, { maximumSignificantDigits: Math.min(21, Math.max(sig, Math.floor(Math.log10(a)) + 1)) })
}
