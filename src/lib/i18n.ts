import { createContext, useContext } from 'react'
import type { PhysicalState } from './calc'
import { setNumberLocale } from './calc'

export type Lang = 'vi' | 'en'

const vi = {
  appTitle: 'MolCalc — số mol sang khối lượng và thể tích',
  brandSub: 'Số mol → khối lượng, thể tích · tra nhanh cơ sở dữ liệu hóa học',
  language: 'Ngôn ngữ',
  drawStructure: 'Vẽ cấu trúc',
  quickPick: 'Chọn nhanh:',
  searchLabel: 'Tìm chất theo tên hoặc công thức',
  searchPlaceholder: 'Tìm chất: tên tiếng Việt, tiếng Anh, công thức hoặc số CAS',
  suggestions: 'Gợi ý chất',
  networkError: 'Không kết nối được PubChem. Kiểm tra mạng rồi thử lại.',
  substance: 'chất',

  // Dữ liệu vào
  input: 'Dữ liệu vào',
  amount: 'Lượng chất (n)',
  amountPlaceholder: 'VD: 0,5',
  amountUnit: 'Đơn vị lượng chất',
  gas: 'Khí',
  liquid: 'Lỏng',
  solid: 'Rắn',
  atRoomTemp: '{state} ở 25 °C',
  stateUnknown: 'Chưa rõ trạng thái',
  customSubstance: 'Chất tự nhập từ công thức',
  undecided: 'Chưa chọn chất cụ thể',
  formulaLabel: 'Công thức: {f}',
  gasAt25: 'khí ở 25 °C',
  notAvailable: 'chưa có',
  structure: 'Công thức cấu tạo',
  structureOf: 'Công thức cấu tạo của {name} ({f})',
  drawStyle: 'Kiểu hình vẽ',
  skeletal: 'Khung',
  condensed: 'Thu gọn',
  structLoading: 'Đang tải hình cấu tạo từ PubChem…',
  structCustom: 'Chất tự nhập — hãy vẽ cấu trúc bằng nút “Vẽ cấu trúc”.',
  structUndecided: 'Chọn một chất ở khung Kết quả để xem hình cấu tạo.',
  structNone: 'Chưa có hình cấu trúc cho chất này.',
  viewOnPubchem: 'Xem trên PubChem ↗',
  customWarn: 'Không có trong dữ liệu tích hợp hay PubChem — M được tính từ công thức. Hãy chọn trạng thái và nhập ρ nếu cần.',
  offlineWarn: 'Không kết nối được PubChem — chỉ dùng dữ liệu offline.',
  phaseTitle: 'Tính thể tích theo trạng thái',
  phaseGroup: 'Trạng thái',
  phaseChoose: 'Chọn trạng thái để tính thể tích.',
  phaseChanged: 'Đã đổi từ trạng thái theo dữ liệu ({state} ở 25 °C).',
  phaseData: 'Theo dữ liệu: {state} ở 25 °C. Có thể đổi, VD: hơi nước.',
  gasCond: 'Điều kiện khí',
  condGroup: 'Điều kiện',
  stp: 'đktc',
  satp: 'đkc',
  custom: 'Tùy chỉnh',
  temperature: 'Nhiệt độ T (°C)',
  pressure: 'Áp suất P (atm)',
  density: 'Khối lượng riêng ρ (g/cm³)',
  densityPlaceholder: 'VD: 1,00',
  densityDefault: 'Mặc định: {src}. Sửa nếu bạn có số liệu khác, VD từ trang Sigma-Aldrich.',
  densitySrcTable: 'bảng dữ liệu tích hợp (CRC, 20–25 °C)',
  densityNone: 'Chưa có số liệu — nhập ρ để tính thể tích.',
  otherValues: 'Giá trị khác:',
  srcTable: 'bảng',

  // Kết quả
  results: 'Kết quả',
  invalidAmountShort: 'Nhập số mol hợp lệ',
  invalidAmount: 'Lượng chất “{v}” không hợp lệ — nhập một số ≥ 0, VD 0,5 hoặc 2,5e-3.',
  notFound: 'Không tìm thấy “{q}”',
  notFoundBody:
    'Chất này không có trong dữ liệu tích hợp, PubChem cũng không nhận ra, và không đọc được như công thức. Đã thử: {tried}. Thử công thức (VD: Fe2(SO4)3, CuSO4·5H2O), tên tiếng Anh hoặc số CAS.',
  searchOnPubchem: 'Tìm “{q}” trên PubChem ↗',
  chooseTitle: 'Công thức {f} ứng với nhiều chất — chọn một để có tên, CAS, ρ và hình cấu tạo:',
  mass: 'Khối lượng m',
  volGas: 'Thể tích khí V · {cond}',
  volSolid: 'Thể tích chất rắn V',
  volLiquid: 'Thể tích chất lỏng V',
  needDensity: 'Nhập khối lượng riêng ρ để tính thể tích',
  particles: 'Số hạt N',
  molarMass: 'Khối lượng mol M',
  moles: 'Số mol n',
  steps: 'Cách tính',
  composition: 'Thành phần nguyên tố trong mẫu',
  condStp: 'đktc: 0 °C, 1 atm',
  condSatp: 'đkc: 25 °C, 1 bar',

  // Tra cứu & bảng
  lookupTitle: 'Tra cứu {name} trên cơ sở dữ liệu',
  lookupHint: 'Mở trong tab mới · tra theo CAS khi có',
  copied: 'Đã copy “{v}” — dán vào ô tìm kiếm của GESTIS',
  keySearch: 'Tra: {v}',
  keyFormula: 'Công thức: {v}',
  tableTitle: 'Dữ liệu tích hợp',
  tableHint: '{n} chất · M theo IUPAC, ρ ở 20–25 °C (CRC) · chất khác tra trên PubChem',
  colName: 'Tên',
  colFormula: 'Công thức',
  colState: 'Trạng thái',
  colActions: 'Thao tác',
  use: 'Dùng',
  useAria: 'Dùng {name} để tính',

  // Bảng vẽ
  skTitle: 'Tìm chất bằng hình vẽ cấu trúc',
  skSub: 'Vẽ bằng Ketcher (EPAM) · so khớp với dữ liệu tích hợp và PubChem',
  close: 'Đóng',
  loadStruct: 'Lấy hình {f}',
  ketcherLoading: 'Đang tải trình vẽ Ketcher…',
  ketcherNote:
    'Ketcher (EPAM, mã nguồn mở) — giao diện của trình vẽ chỉ có tiếng Anh. Vẽ xong, kết quả so khớp hiện ở cột bên phải; hình được giữ lại khi đóng hộp thoại.',
  ketcherError: 'Ketcher báo lỗi: {m}',
  skUnknownAtom: 'Hình có nhóm thế hoặc nguyên tử đặc biệt (R, A, X…) — không tính được khối lượng mol.',
  skFormula: 'Công thức phân tử từ hình vẽ',
  fragWarn:
    'Hình gồm {n} phần rời nhau: {list}. Công thức ở trên là tổng của tất cả — có thể có phần nằm ngoài khung nhìn hoặc bị vẽ chồng.',
  fragShowAll: 'Xem toàn bộ hình',
  fragKeepLargest: 'Chỉ giữ phần lớn nhất ({f})',
  overlapWarn: 'Có {n} nguyên tử bị vẽ chồng lên nguyên tử khác (vòng hoặc liên kết bị vẽ trùng).',
  overlapMerge: 'Gộp các nguyên tử trùng',
  noAtoms: 'Chưa có nguyên tử',
  exactMatch: 'Khớp cấu tạo',
  useThis: 'Dùng chất này',
  sameFormula: 'Cùng công thức phân tử, khác cách nối',
  maybeIsomer: 'có thể là đồng phân',
  skSearching: 'Đang tra cấu trúc trên PubChem…',
  skOffline: 'Không kết nối được PubChem — chỉ so khớp với dữ liệu tích hợp.',
  skNoExact: 'Không có chất trùng đúng cấu tạo',
  skNotFound: 'Không tìm thấy chất này',
  skStillCalc: 'Vẫn tính được khối lượng, thể tích từ công thức phân tử của hình vẽ.',
  skCalcWith: 'Tính với {f}',
  skFindOn: 'Tìm {f} trên PubChem ↗',
  skDrawOne: 'Vẽ ít nhất một nguyên tử để tìm chất.',
}

export type Key = keyof typeof vi

const en: Record<Key, string> = {
  appTitle: 'MolCalc — moles to mass and volume',
  brandSub: 'Moles → mass, volume · quick links to chemical databases',
  language: 'Language',
  drawStructure: 'Draw structure',
  quickPick: 'Quick pick:',
  searchLabel: 'Search a substance by name or formula',
  searchPlaceholder: 'Search: English or Vietnamese name, formula or CAS number',
  suggestions: 'Substance suggestions',
  networkError: 'Could not reach PubChem. Check your connection and try again.',
  substance: 'substance',

  input: 'Input',
  amount: 'Amount of substance (n)',
  amountPlaceholder: 'e.g. 0.5',
  amountUnit: 'Amount unit',
  gas: 'Gas',
  liquid: 'Liquid',
  solid: 'Solid',
  atRoomTemp: '{state} at 25 °C',
  stateUnknown: 'State unknown',
  customSubstance: 'Custom substance from formula',
  undecided: 'No specific compound chosen',
  formulaLabel: 'Formula: {f}',
  gasAt25: 'gas at 25 °C',
  notAvailable: 'n/a',
  structure: 'Structural formula',
  structureOf: 'Structural formula of {name} ({f})',
  drawStyle: 'Drawing style',
  skeletal: 'Skeletal',
  condensed: 'Condensed',
  structLoading: 'Loading structure from PubChem…',
  structCustom: 'Custom substance — draw it with “Draw structure”.',
  structUndecided: 'Pick a compound in the Results panel to see its structure.',
  structNone: 'No structure available for this substance.',
  viewOnPubchem: 'View on PubChem ↗',
  customWarn: 'Not in the built-in data or PubChem — M is computed from the formula. Choose a state and enter ρ if needed.',
  offlineWarn: 'Could not reach PubChem — using offline data only.',
  phaseTitle: 'Volume by physical state',
  phaseGroup: 'Physical state',
  phaseChoose: 'Choose a state to compute the volume.',
  phaseChanged: 'Changed from the state in the data ({state} at 25 °C).',
  phaseData: 'From data: {state} at 25 °C. You can change it, e.g. for steam.',
  gasCond: 'Gas conditions',
  condGroup: 'Conditions',
  stp: 'STP',
  satp: 'SATP',
  custom: 'Custom',
  temperature: 'Temperature T (°C)',
  pressure: 'Pressure P (atm)',
  density: 'Density ρ (g/cm³)',
  densityPlaceholder: 'e.g. 1.00',
  densityDefault: 'Default: {src}. Edit it if you have another value, e.g. from Sigma-Aldrich.',
  densitySrcTable: 'built-in table (CRC, 20–25 °C)',
  densityNone: 'No data — enter ρ to compute the volume.',
  otherValues: 'Other values:',
  srcTable: 'table',

  results: 'Results',
  invalidAmountShort: 'Enter a valid amount',
  invalidAmount: 'Amount “{v}” is not valid — enter a number ≥ 0, e.g. 0.5 or 2.5e-3.',
  notFound: 'No match for “{q}”',
  notFoundBody:
    'This substance is not in the built-in data, PubChem does not recognise it, and it cannot be read as a formula. Tried: {tried}. Try a formula (e.g. Fe2(SO4)3, CuSO4·5H2O), an English name or a CAS number.',
  searchOnPubchem: 'Search “{q}” on PubChem ↗',
  chooseTitle: 'Formula {f} matches several compounds — pick one to get its name, CAS, ρ and structure:',
  mass: 'Mass m',
  volGas: 'Gas volume V · {cond}',
  volSolid: 'Solid volume V',
  volLiquid: 'Liquid volume V',
  needDensity: 'Enter density ρ to compute the volume',
  particles: 'Particles N',
  molarMass: 'Molar mass M',
  moles: 'Moles n',
  steps: 'Working',
  composition: 'Elemental composition of the sample',
  condStp: 'STP: 0 °C, 1 atm',
  condSatp: 'SATP: 25 °C, 1 bar',

  lookupTitle: 'Look up {name} in chemical databases',
  lookupHint: 'Opens in a new tab · by CAS number when available',
  copied: 'Copied “{v}” — paste it into the GESTIS search box',
  keySearch: 'Search: {v}',
  keyFormula: 'Formula: {v}',
  tableTitle: 'Built-in data',
  tableHint: '{n} substances · M per IUPAC, ρ at 20–25 °C (CRC) · others are looked up on PubChem',
  colName: 'Name',
  colFormula: 'Formula',
  colState: 'State',
  colActions: 'Actions',
  use: 'Use',
  useAria: 'Use {name} for the calculation',

  skTitle: 'Find a substance by drawing its structure',
  skSub: 'Draw with Ketcher (EPAM) · matched against built-in data and PubChem',
  close: 'Close',
  loadStruct: 'Load {f}',
  ketcherLoading: 'Loading the Ketcher editor…',
  ketcherNote:
    'Ketcher (EPAM, open source). Matches appear in the right-hand column as you draw; the drawing is kept when you close the dialog.',
  ketcherError: 'Ketcher error: {m}',
  skUnknownAtom: 'The drawing has R-groups or special atoms (R, A, X…) — the molar mass cannot be computed.',
  skFormula: 'Molecular formula of the drawing',
  fragWarn:
    'The drawing has {n} disconnected parts: {list}. The formula above is their total — a part may be off-screen or drawn on top of another.',
  fragShowAll: 'Show the whole drawing',
  fragKeepLargest: 'Keep only the largest part ({f})',
  overlapWarn: '{n} atom(s) are drawn on top of other atoms (a ring or bond was drawn twice).',
  overlapMerge: 'Merge overlapping atoms',
  noAtoms: 'No atoms yet',
  exactMatch: 'Exact structure match',
  useThis: 'Use this substance',
  sameFormula: 'Same molecular formula, different connectivity',
  maybeIsomer: 'possible isomer',
  skSearching: 'Searching PubChem for this structure…',
  skOffline: 'Could not reach PubChem — matching against built-in data only.',
  skNoExact: 'No compound with exactly this structure',
  skNotFound: 'Substance not found',
  skStillCalc: 'You can still compute mass and volume from the molecular formula of the drawing.',
  skCalcWith: 'Calculate with {f}',
  skFindOn: 'Search {f} on PubChem ↗',
  skDrawOne: 'Draw at least one atom to search.',
}

const DICT: Record<Lang, Record<Key, string>> = { vi, en }

export type T = (key: Key, vars?: Record<string, string | number>) => string

export function translate(lang: Lang, key: Key, vars?: Record<string, string | number>): string {
  let s = DICT[lang][key]
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v))
  return s
}

export const LangContext = createContext<Lang>('vi')

export function useI18n(): { lang: Lang; t: T } {
  const lang = useContext(LangContext)
  return { lang, t: (key, vars) => translate(lang, key, vars) }
}

export const stateLabel = (t: T, s: PhysicalState) => t(s)

const LANG_KEY = 'molcalc-lang'

export function loadLang(): Lang {
  try {
    const v = localStorage.getItem(LANG_KEY)
    if (v === 'vi' || v === 'en') return v
  } catch {
    /* localStorage không khả dụng */
  }
  return 'vi'
}

export function applyLang(lang: Lang) {
  setNumberLocale(lang === 'en' ? 'en-US' : 'vi-VN')
  try {
    localStorage.setItem(LANG_KEY, lang)
  } catch {
    /* bỏ qua */
  }
}
