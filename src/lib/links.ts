import type { Lang } from './i18n'
import type { Substance } from './resolve'

export interface DbLink {
  id: string
  name: string
  desc: string
  url: string
  /** Khóa dùng để tra, hiển thị dưới thẻ */
  key: string
  /** Trang không nhận từ khóa qua URL — copy sẵn chuỗi này để người dùng dán vào ô tìm kiếm */
  copy?: string
}

const enc = encodeURIComponent

const DESC: Record<string, [vi: string, en: string]> = {
  pubchem: ['Cấu trúc, tính chất, độc tính, phổ — NIH (Mỹ)', 'Structure, properties, toxicity, spectra — NIH (US)'],
  chemspider: ['Hơn 100 triệu cấu trúc — Royal Society of Chemistry', '100+ million structures — Royal Society of Chemistry'],
  nist: ['Nhiệt động học, phổ IR/MS, dữ liệu pha', 'Thermochemistry, IR/MS spectra, phase data'],
  cas: ['Số CAS RN, tên gọi, tính chất cơ bản', 'CAS RN, names, basic properties'],
  chebi: ['Phân loại hóa học, vai trò sinh học — EMBL-EBI', 'Chemical classification, biological roles — EMBL-EBI'],
  'wiki-vi': ['Tổng quan, điều chế, ứng dụng', 'Overview in Vietnamese'],
  'wiki-en': ['Hộp thông tin đầy đủ: M, ρ, điểm sôi, an toàn', 'Full infobox: M, ρ, boiling point, safety'],
  sigma: ['Merck — sản phẩm, độ tinh khiết, SDS', 'Merck — products, purity grades, SDS'],
  fisher: ['Thermo Fisher — hóa chất phòng thí nghiệm', 'Thermo Fisher — laboratory chemicals'],
  tci: ['Tokyo Chemical Industry — thuốc thử hữu cơ', 'Tokyo Chemical Industry — organic reagents'],
  alfa: ['Nay là Thermo Scientific Chemicals', 'Now Thermo Scientific Chemicals'],
  echa: ['Cơ quan Hóa chất châu Âu — phân loại nguy hại, REACH', 'European Chemicals Agency — hazard classification, REACH'],
  gestis: ['DGUV — dữ liệu an toàn; bấm để copy CAS rồi dán vào ô tìm', 'DGUV — safety data; click to copy the CAS, then paste it into the search'],
}

/** Link tới chất trên các database / nhà cung cấp. Ưu tiên CID/CAS/ChEBI ID/InChIKey (chính xác), sau đó tên. */
export function buildLinks(s: Substance, lang: Lang = 'vi'): DbLink[] {
  const { cid, cas, inchikey, chebi } = s
  const en = s.name
  const vi = s.nameVi ?? en
  const key = cas ?? en
  const L = lang === 'en' ? 1 : 0
  const search = (v: string) => (lang === 'en' ? `Search: ${v}` : `Tra: ${v}`)
  const casKey = cas ? `CAS ${cas}` : search(en)
  const links: Omit<DbLink, 'desc'>[] = [
    {
      id: 'pubchem', name: 'PubChem',
      url: cid ? `https://pubchem.ncbi.nlm.nih.gov/compound/${cid}` : `https://pubchem.ncbi.nlm.nih.gov/#query=${enc(key)}`,
      key: cid ? `CID ${cid}` : casKey,
    },
    {
      id: 'chemspider', name: 'ChemSpider',
      url: `https://www.chemspider.com/search?params=${enc(inchikey ?? key)}`,
      key: inchikey ? `InChIKey ${inchikey}` : casKey,
    },
    {
      id: 'nist', name: 'NIST Chemistry WebBook',
      url: cas
        ? `https://webbook.nist.gov/cgi/cbook.cgi?ID=${enc(cas)}&Units=SI`
        : inchikey
          ? `https://webbook.nist.gov/cgi/cbook.cgi?InChI=${enc(inchikey)}&Units=SI`
          : `https://webbook.nist.gov/cgi/cbook.cgi?Formula=${enc(s.formula.replace(/[·.]/g, ''))}&NoIon=on&Units=SI`,
      key: cas ? `CAS ${cas}` : (lang === 'en' ? 'Formula: ' : 'Công thức: ') + s.formula,
    },
    {
      id: 'cas', name: 'CAS Common Chemistry',
      url: cas ? `https://commonchemistry.cas.org/detail?cas_rn=${enc(cas)}` : `https://commonchemistry.cas.org/results?q=${enc(en)}`,
      key: casKey,
    },
    {
      id: 'chebi', name: 'ChEBI',
      url: chebi ? `https://www.ebi.ac.uk/chebi/${chebi}` : `https://www.ebi.ac.uk/chebi/search?query=${enc(en)}`,
      key: chebi ?? search(en),
    },
    {
      id: 'wiki-en', name: 'Wikipedia (English)',
      url: `https://en.wikipedia.org/w/index.php?search=${enc(en)}`,
      key: search(en),
    },
    {
      id: 'wiki-vi', name: lang === 'en' ? 'Wikipedia (Vietnamese)' : 'Wikipedia tiếng Việt',
      url: `https://vi.wikipedia.org/w/index.php?search=${enc(vi)}`,
      key: search(vi),
    },
    {
      id: 'sigma', name: 'Sigma-Aldrich',
      url: cas
        ? `https://www.sigmaaldrich.com/VN/en/search/${enc(cas)}?focus=products&page=1&perpage=30&sort=relevance&term=${enc(cas)}&type=cas_number`
        : `https://www.sigmaaldrich.com/VN/en/search/${enc(en)}?focus=products&page=1&perpage=30&sort=relevance&term=${enc(en)}&type=product`,
      key: casKey,
    },
    { id: 'fisher', name: 'Fisher Scientific', url: `https://www.fishersci.com/us/en/catalog/search/products?keyword=${enc(key)}`, key: casKey },
    { id: 'tci', name: 'TCI Chemicals', url: `https://www.tcichemicals.com/VN/en/search?text=${enc(key)}`, key: casKey },
    { id: 'alfa', name: 'Alfa Aesar', url: `https://www.thermofisher.com/search/results?query=${enc(key)}&focusarea=Search%20All`, key: casKey },
    { id: 'echa', name: 'ECHA CHEM', url: `https://chem.echa.europa.eu/substance-search?searchText=${enc(key)}`, key: casKey },
    { id: 'gestis', name: 'GESTIS', url: 'https://gestis-database.dguv.de/search', key: `Copy: ${key}`, copy: key },
  ]
  // Bản tiếng Việt: Wikipedia tiếng Việt đứng trước
  if (lang === 'vi') {
    const i = links.findIndex((l) => l.id === 'wiki-vi')
    links.splice(i - 1, 0, links.splice(i, 1)[0])
  }
  return links.map((l) => ({ ...l, desc: DESC[l.id][L] }))
}
