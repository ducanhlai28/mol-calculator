/** Chữ thường, bỏ dấu tiếng Việt, gộp khoảng trắng: "Sắt(III) Clorua" → "sat(iii) clorua". */
export function normalizeVi(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ')
    .trim()
}

const VI_CHARS = /[ăâđêôơưàáạảãằắặẳẵầấậẩẫèéẹẻẽềếệểễìíịỉĩòóọỏõồốộổỗờớợởỡùúụủũừứựửữỳýỵỷỹ]/i

// Từ khóa thường gặp trong tên chất tiếng Việt (đã bỏ dấu) — dùng để nhận ra tên không dấu
const VI_HINT_WORDS = new Set([
  'axit', 'natri', 'kali', 'canxi', 'magie', 'nhom', 'sat', 'dong', 'kem', 'bac', 'chi',
  'amoni', 'clorua', 'sunfat', 'oxit', 'hidroxit', 'cacbonat', 'nuoc', 'khi', 'muoi',
])

export function looksVietnamese(s: string): boolean {
  if (VI_CHARS.test(s)) return true
  return normalizeVi(s)
    .split(/[\s()]+/)
    .some((w) => VI_HINT_WORDS.has(w))
}

// Cation / nguyên tố
const ELEMENTS: Record<string, string> = {
  hidro: 'hydrogen', heli: 'helium', liti: 'lithium', beri: 'beryllium', bo: 'boron',
  cacbon: 'carbon', nito: 'nitrogen', oxi: 'oxygen', flo: 'fluorine', neon: 'neon',
  natri: 'sodium', magie: 'magnesium', nhom: 'aluminum', silic: 'silicon', photpho: 'phosphorus',
  luuhuynh: 'sulfur', 'luu huynh': 'sulfur', clo: 'chlorine', agon: 'argon', kali: 'potassium',
  canxi: 'calcium', titan: 'titanium', crom: 'chromium', mangan: 'manganese', sat: 'iron',
  coban: 'cobalt', niken: 'nickel', dong: 'copper', kem: 'zinc', asen: 'arsenic',
  selen: 'selenium', brom: 'bromine', rubidi: 'rubidium', stronti: 'strontium', bac: 'silver',
  cadimi: 'cadmium', thiec: 'tin', iot: 'iodine', xesi: 'cesium', bari: 'barium',
  vonfram: 'tungsten', platin: 'platinum', vang: 'gold', 'thuy ngan': 'mercury', chi: 'lead',
  bitmut: 'bismuth', urani: 'uranium', amoni: 'ammonium',
}

// Anion / phần sau của tên muối, oxit
const ANIONS: Record<string, string> = {
  clorua: 'chloride', bromua: 'bromide', iotua: 'iodide', florua: 'fluoride', sunfua: 'sulfide',
  nitrua: 'nitride', cacbua: 'carbide', hidrua: 'hydride', xianua: 'cyanide', photphua: 'phosphide',
  oxit: 'oxide', peoxit: 'peroxide', supeoxit: 'superoxide', hidroxit: 'hydroxide',
  sunfat: 'sulfate', sunfit: 'sulfite', hidrosunfat: 'hydrogen sulfate', hidrosunfit: 'hydrogen sulfite',
  nitrat: 'nitrate', nitrit: 'nitrite', cacbonat: 'carbonate', hidrocacbonat: 'hydrogen carbonate',
  bicacbonat: 'bicarbonate', photphat: 'phosphate', hidrophotphat: 'hydrogen phosphate',
  dihidrophotphat: 'dihydrogen phosphate', clorat: 'chlorate', peclorat: 'perchlorate',
  hipoclorit: 'hypochlorite', clorit: 'chlorite', bromat: 'bromate', iotat: 'iodate',
  pemanganat: 'permanganate', manganat: 'manganate', cromat: 'chromate', dicromat: 'dichromate',
  axetat: 'acetate', fomat: 'formate', oxalat: 'oxalate', xitrat: 'citrate', silicat: 'silicate',
  aluminat: 'aluminate', thiosunfat: 'thiosulfate', tiosunfat: 'thiosulfate', borat: 'borate',
  xianat: 'cyanate', thioxianat: 'thiocyanate', tetraborat: 'tetraborate',
}

// Axit: "axit X" → "X' acid"
const ACIDS: Record<string, string> = {
  sunfuric: 'sulfuric', sunfuro: 'sulfurous', clohidric: 'hydrochloric', flohidric: 'hydrofluoric',
  bromhidric: 'hydrobromic', iothidric: 'hydroiodic', nitric: 'nitric', nitro: 'nitrous',
  photphoric: 'phosphoric', cacbonic: 'carbonic', axetic: 'acetic', fomic: 'formic',
  oxalic: 'oxalic', xitric: 'citric', lactic: 'lactic', benzoic: 'benzoic', boric: 'boric',
  silixic: 'silicic', cloric: 'chloric', pecloric: 'perchloric', hipocloro: 'hypochlorous',
  xianhidric: 'hydrocyanic', propionic: 'propionic', butiric: 'butyric', stearic: 'stearic',
  panmitic: 'palmitic', oleic: 'oleic', salixylic: 'salicylic', tactric: 'tartaric',
  malic: 'malic', ascobic: 'ascorbic', acrylic: 'acrylic', metacrylic: 'methacrylic',
  glutamic: 'glutamic', aspactic: 'aspartic', sunfuhidric: 'hydrosulfuric',
}

const PREFIXES: [string, string][] = [
  ['mono', 'mono'], ['di', 'di'], ['tri', 'tri'], ['tetra', 'tetra'], ['penta', 'penta'],
  ['hexa', 'hexa'], ['hepta', 'hepta'], ['octa', 'octa'],
]

function withPrefix(word: string, table: Record<string, string>): string | null {
  if (table[word]) return table[word]
  for (const [vi, en] of PREFIXES) {
    if (word.startsWith(vi) && table[word.slice(vi.length)]) {
      const rest = table[word.slice(vi.length)]
      // penta + oxide → pentoxide, mono + oxide → monoxide
      if (/[ao]$/.test(en) && rest.startsWith('o')) return en.slice(0, -1) + rest
      return en + rest
    }
  }
  return null
}

/** Phiên âm từ hữu cơ tiếng Việt sang tiếng Anh, trả về vài phương án để thử. */
export function transliterateWord(word: string): string[] {
  let w = word
  w = w.replace(/^met(?=[aeiy])/, 'meth').replace(/^et(?=[aeiy])/, 'eth')
  w = w.replace(/x(?=[eiy])/g, 'c') // axeton → aceton, xiclo → ciclo
  w = w.replace(/^ciclo/, 'cyclo').replace(/^ci/, 'cy')
  w = w.replace(/anđehit|andehit/g, 'aldehyde').replace(/phenyl|phenil/g, 'phenyl')
  w = w.replace(/yl$|il$/, 'yl')
  const out = new Set<string>()
  if (/ozo$/.test(w)) out.add(w.replace(/ozo$/, 'ose'))
  if (/an$/.test(w)) out.add(w + 'e')
  if (/en$/.test(w)) out.add(w + 'e')
  if (/in$/.test(w)) {
    out.add(w + 'e')
    out.add(w.replace(/in$/, 'yne'))
  }
  if (/on$/.test(w)) out.add(w + 'e')
  if (/at$/.test(w)) out.add(w + 'e')
  if (/it$/.test(w)) out.add(w + 'e')
  if (/ua$/.test(w)) out.add(w.replace(/ua$/, 'ide'))
  out.add(w)
  return [...out]
}

function translateWord(w: string): string[] {
  const roman = w.match(/^(.+?)\(([ivx]+)\)$/)
  if (roman) {
    const base = translateWord(roman[1])
    return base.map((b) => `${b}(${roman[2].toUpperCase()})`)
  }
  const el = ELEMENTS[w]
  if (el) return [el]
  const an = withPrefix(w, ANIONS)
  if (an) return [an]
  const elp = withPrefix(w, ELEMENTS)
  if (elp) return [elp]
  return transliterateWord(w)
}

function cartesian(parts: string[][], limit = 6): string[] {
  let acc = ['']
  for (const opts of parts) {
    const next: string[] = []
    for (const a of acc) for (const o of opts) next.push(a ? `${a} ${o}` : o)
    acc = next.slice(0, limit)
  }
  return acc
}

/**
 * Dịch tên tiếng Việt sang các tên tiếng Anh có thể dùng để tra PubChem.
 * VD: "sắt(III) clorua" → ["iron(III) chloride"], "axit sunfuric" → ["sulfuric acid"].
 */
export function translateViName(input: string): string[] {
  let s = normalizeVi(input)
  // "sắt (III)" → "sat(iii)"
  s = s.replace(/\s+\(([ivx]+)\)/g, '($1)')
  // Ghép các cụm hai từ
  s = s.replace(/\bluu huynh\b/g, 'luuhuynh').replace(/\bthuy ngan\b/g, 'thuy_ngan')
  const words = s.split(' ').map((w) => (w === 'thuy_ngan' ? 'thuy ngan' : w))

  if (words[0] === 'axit' && words.length >= 2) {
    const rest = words.slice(1).join('')
    const acid = ACIDS[rest]
    if (acid) return [`${acid} acid`]
    return transliterateWord(rest).map((w) => `${w} acid`)
  }

  const parts = words.map((w) => (ELEMENTS[w] ? [ELEMENTS[w]] : translateWord(w)))
  return cartesian(parts)
}
