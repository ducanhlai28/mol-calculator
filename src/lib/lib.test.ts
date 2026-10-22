import { describe, expect, it } from 'vitest'
import { COMMON_SUBSTANCES } from '../data/common-substances'
import { calculate, fmt, molarVolume, parseNumber, sci, setNumberLocale } from './calc'
import { analyze, builtinStructure, fromPubchemRecord, hill, parseMolfile, toMolfile } from './structure'
import { looksLikeFormula, molarMass, parseFormula, prettyFormula } from './formula'
import { guessState, isValidCas, ISOTOPE_TITLE, parseDensityText } from './pubchem'
import { findLocal } from './resolve'
import { looksVietnamese, translateViName } from './vietnamese'

describe('formula', () => {
  it('tính khối lượng mol', () => {
    expect(molarMass(parseFormula('H2O'))).toBeCloseTo(18.015, 2)
    expect(molarMass(parseFormula('H2SO4'))).toBeCloseTo(98.07, 1)
    expect(molarMass(parseFormula('Ca(OH)2'))).toBeCloseTo(74.09, 1)
    expect(molarMass(parseFormula('Al2(SO4)3'))).toBeCloseTo(342.15, 1)
    expect(molarMass(parseFormula('CuSO4·5H2O'))).toBeCloseTo(249.68, 1)
    expect(molarMass(parseFormula('CuSO4.5H2O'))).toBeCloseTo(249.68, 1)
    expect(molarMass(parseFormula('K4[Fe(CN)6]'))).toBeCloseTo(368.35, 1)
    expect(molarMass(parseFormula('H₂O'))).toBeCloseTo(18.015, 2)
  })
  it('nhận diện công thức', () => {
    expect(looksLikeFormula('NaCl')).toBe(true)
    expect(looksLikeFormula('C2H6O')).toBe(true)
    expect(looksLikeFormula('Ethanol')).toBe(false)
    expect(looksLikeFormula('Water')).toBe(false)
    expect(looksLikeFormula('natri clorua')).toBe(false)
    expect(() => parseFormula('Xy2')).toThrow()
  })
  it('chỉ số dưới', () => {
    expect(prettyFormula('CuSO4·5H2O')).toBe('CuSO₄·5H₂O')
    expect(prettyFormula('Al2(SO4)3')).toBe('Al₂(SO₄)₃')
  })
  it('mọi công thức trong bảng đều phân tích được, CAS hợp lệ', () => {
    for (const s of COMMON_SUBSTANCES) {
      expect(() => parseFormula(s.formula), s.formula).not.toThrow()
      expect(isValidCas(s.cas), `${s.en} ${s.cas}`).toBe(true)
    }
  })
})

describe('calc', () => {
  it('đọc số', () => {
    expect(parseNumber('0,5')).toBe(0.5)
    expect(parseNumber('1.5')).toBe(1.5)
    expect(parseNumber('2e-3')).toBe(0.002)
    expect(parseNumber('1,5×10^-3')).toBeCloseTo(0.0015)
    expect(parseNumber('abc')).toBeNaN()
    expect(parseNumber('1.234,5')).toBe(1234.5)
    expect(parseNumber('1,234.5')).toBe(1234.5)
  })
  it('kiểu số tiếng Anh', () => {
    setNumberLocale('en-US')
    try {
      expect(parseNumber('0.5')).toBe(0.5)
      expect(parseNumber('1,000')).toBe(1000)
      expect(parseNumber('0,5')).toBe(0.5)
      expect(fmt(1234.5678, 4)).toBe('1,235')
      expect(fmt(49.0395, 4)).toBe('49.04')
    } finally {
      setNumberLocale('vi-VN')
    }
  })
  it('thể tích mol', () => {
    expect(molarVolume({ kind: 'satp' })).toBe(24.79)
    expect(molarVolume({ kind: 'stp' })).toBe(22.414)
    expect(molarVolume({ kind: 'custom', tempC: 0, pressureAtm: 1 })).toBeCloseTo(22.414, 2)
    expect(molarVolume({ kind: 'custom', tempC: 100, pressureAtm: 2 })).toBeCloseTo(15.31, 2)
    expect(molarVolume({ kind: 'custom', tempC: -300, pressureAtm: 1 })).toBeNaN()
  })
  it('khối lượng & thể tích', () => {
    const gas = calculate({ moles: 2, molarMass: 44.01, state: 'gas', gas: { kind: 'satp' } })
    expect(gas.massG).toBeCloseTo(88.02)
    expect(gas.volumeL).toBeCloseTo(49.58)
    const liq = calculate({ moles: 1, molarMass: 18.015, state: 'liquid', density: 0.997, gas: { kind: 'stp' } })
    expect(liq.volumeL * 1000).toBeCloseTo(18.07, 1)
    expect(calculate({ moles: 1, molarMass: 58.44, state: 'solid', gas: { kind: 'stp' } }).volumeL).toBeNaN()
  })
  it('định dạng số', () => {
    expect(fmt(49.0395, 4)).toBe('49,04')
    expect(fmt(1234.5678, 4)).toBe('1.235')
    expect(fmt(NaN)).toBe('—')
    expect(sci(3.011e23, 4)).toBe('3,011 × 10²³')
    expect(fmt(2e-6, 4)).toBe('2 × 10⁻⁶')
  })
})

describe('tiếng Việt', () => {
  it('dịch tên', () => {
    expect(translateViName('natri clorua')).toContain('sodium chloride')
    expect(translateViName('sắt(III) clorua')).toContain('iron(III) chloride')
    expect(translateViName('sắt (III) clorua')).toContain('iron(III) chloride')
    expect(translateViName('axit sunfuric')).toEqual(['sulfuric acid'])
    expect(translateViName('cacbon đioxit')).toContain('carbon dioxide')
    expect(translateViName('đinitơ pentaoxit')).toContain('dinitrogen pentoxide')
    expect(translateViName('kali pemanganat')).toContain('potassium permanganate')
    expect(translateViName('etanol')).toContain('ethanol')
    expect(translateViName('etyl axetat')).toContain('ethyl acetate')
    expect(translateViName('glucozơ')).toContain('glucose')
  })
  it('nhận diện', () => {
    expect(looksVietnamese('nước')).toBe(true)
    expect(looksVietnamese('natri clorua')).toBe(true)
    expect(looksVietnamese('sodium chloride')).toBe(false)
  })
  it('bảng offline', () => {
    expect(findLocal('Nước')?.cas).toBe('7732-18-5')
    expect(findLocal('nuoc')?.cas).toBe('7732-18-5')
    expect(findLocal('H2SO4')?.en).toBe('sulfuric acid')
    expect(findLocal('7647-14-5')?.en).toBe('sodium chloride')
    expect(findLocal('muối ăn')?.formula).toBe('NaCl')
    expect(findLocal('C2H6O')).toBeUndefined()
    // công thức phân tử có đồng phân → không tự chọn chất trong bảng
    expect(findLocal('C6H12O6')).toBeUndefined()
    expect(findLocal('C4H8O')).toBeUndefined()
    expect(findLocal('C2H5OH')?.en).toBe('ethanol')
    expect(findLocal('CuSO4·5H2O')?.cas).toBe('7758-99-8')
  })
})

describe('cấu tạo', () => {
  it('H ẩn và công thức Hill', () => {
    expect(hill(analyze(builtinStructure('64-17-5')!).counts)).toBe('C2H6O')
    expect(hill(analyze(builtinStructure('71-43-2')!).counts)).toBe('C6H6')
    expect(hill(analyze(builtinStructure('7664-93-9')!).counts)).toBe('H2O4S')
    expect(hill(analyze(builtinStructure('7697-37-2')!).counts)).toBe('HNO3')
  })
  it('mọi hình vẽ sẵn khớp công thức trong bảng', () => {
    for (const s of COMMON_SUBSTANCES) {
      const st = builtinStructure(s.cas)
      if (!st) continue
      expect(hill(analyze(st).counts), s.en).toBe(hill(parseFormula(s.formula)))
    }
  })
  it('molfile: ghi rồi đọc lại giữ nguyên chất (Ketcher)', () => {
    for (const cas of ['64-17-5', '71-43-2', '7664-93-9', '7697-37-2', '471-34-1', '7782-42-5', '7758-99-8']) {
      const st = builtinStructure(cas)!
      const back = parseMolfile(toMolfile(st))
      expect(back.atoms).toHaveLength(st.atoms.length)
      expect(analyze(back).sig, cas).toBe(analyze(st).sig)
    }
  })
  it('molfile kiểu Ketcher: liên kết thơm, điện tích', () => {
    const benzeneAromatic = [
      '', '  -INDIGO-', '',
      '  6  6  0  0  0  0  0  0  0  0999 V2000',
      ...[0, 1, 2, 3, 4, 5].map((i) => `${Math.cos(i).toFixed(4).padStart(10)}${Math.sin(i).toFixed(4).padStart(10)}    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0`),
      ...[1, 2, 3, 4, 5, 6].map((i) => `${String(i).padStart(3)}${String((i % 6) + 1).padStart(3)}  4  0  0  0  0`),
      'M  END',
    ].join('\n')
    expect(hill(analyze(parseMolfile(benzeneAromatic)).counts)).toBe('C6H6')
    const nacl = ['', '', '', '  2  0  0  0  0  0  0  0  0  0999 V2000',
      '    0.0000    0.0000    0.0000 Na  0  0  0  0  0  0  0  0  0  0  0  0',
      '    1.5000    0.0000    0.0000 Cl  0  0  0  0  0  0  0  0  0  0  0  0',
      'M  CHG  2   1   1   2  -1', 'M  END'].join('\n')
    const st = parseMolfile(nacl)
    expect(st.atoms.map((a) => a.c)).toEqual([1, -1])
    expect(analyze(st).sig).toBe(analyze(builtinStructure('7647-14-5')!).sig)
  })
  it('bản ghi 2D của PubChem (ethanol)', () => {
    const st = fromPubchemRecord({
      atoms: { aid: [1, 2, 3, 4, 5, 6, 7, 8, 9], element: [8, 6, 6, 1, 1, 1, 1, 1, 1] },
      bonds: { aid1: [1, 1, 2, 2, 2, 3, 3, 3], aid2: [2, 9, 3, 4, 5, 6, 7, 8], order: [1, 1, 1, 1, 1, 1, 1, 1] },
      coords: [{ aid: [1, 2, 3, 4, 5, 6, 7, 8, 9], conformers: [{ x: [3.7, 2.9, 2, 2.5, 3.3, 2.3, 1.5, 1.7, 4.3], y: [0, 0.5, 0, 0, 0, 0, 0, 0, 0] }] }],
    })
    expect(st.atoms).toHaveLength(3)
    expect(hill(analyze(st).counts)).toBe('C2H6O')
  })
})

describe('PubChem parsers', () => {
  it('khối lượng riêng', () => {
    expect(parseDensityText('0.7893 g/cu cm at 20 °C')?.value).toBe(0.7893)
    expect(parseDensityText('Relative density (water = 1): 1.8 (20 °C)')?.value).toBe(1.8)
    expect(parseDensityText('Density: 1.799 g/L')).toBeNull()
    expect(parseDensityText('1.53(relative gas density)')).toBeNull()
    expect(parseDensityText('Absolute density, gas at 101.325 kPa at 0 °C: 1.9770 kg/cu m')).toBeNull()
    const good = parseDensityText('0.7893 g/cu cm at 20 °C')!
    const bad = parseDensityText('0.79 at 68 °F (USCG, 1999) - Less dense than water; will float')!
    expect(good.score!).toBeGreaterThan(bad.score!)
  })
  it('trạng thái', () => {
    expect(guessState(['Carbon dioxide appears as a colorless odorless gas at atmospheric temperatures.', 'Carbon dioxide, refrigerated liquid appears as a colorless liquid.'])).toBe('gas')
    expect(guessState(['Ethanol appears as a clear colorless liquid with a characteristic vinous odor.'])).toBe('liquid')
    expect(guessState(['White crystalline powder'])).toBe('solid')
  })
  it('lọc đồng vị, ion, mã định danh khỏi danh sách đồng phân', () => {
    const bad = ['Cobalt-60', 'Cobalt(2+)', 'Cobaltic cation', 'Cobalt, isotope of mass 62', 'Cobalt-59 atom', 'GlyTouCan:G09597LJ', 'Ethanol-d6', 'Ethanol-1-13C']
    const good = ['Cobalt', 'D-Glucose', 'Methyl Ethyl Ketone', '1,2-Epoxybutane', 'Butan-2-ol', 'Dimethyl Ether']
    for (const t of bad) expect(ISOTOPE_TITLE.test(t), t).toBe(true)
    for (const t of good) expect(ISOTOPE_TITLE.test(t), t).toBe(false)
  })
  it('CAS', () => {
    expect(isValidCas('7732-18-5')).toBe(true)
    expect(isValidCas('7732-18-4')).toBe(false)
  })
})
