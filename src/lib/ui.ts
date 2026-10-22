import type { PhysicalState } from './calc'
import type { Lang } from './i18n'

/** Viết hoa chữ cái đầu: "axit sunfuric" → "Axit sunfuric". */
export const cap = (s: string) => (s ? s[0].toLocaleUpperCase('vi') + s.slice(1) : s)

export const STATE_STYLE: Record<PhysicalState, { bg: string; fg: string }> = {
  gas: { bg: '#E6EEF8', fg: '#1F4F8F' },
  liquid: { bg: '#E2F0EC', fg: '#0B4F45' },
  solid: { bg: '#F6EADB', fg: '#7A420D' },
}

export const SIG = 4

/** Tên chính và tên phụ theo ngôn ngữ: tiếng Việt ưu tiên tên Việt, tiếng Anh ưu tiên tên Anh. */
export function names(lang: Lang, vi: string | undefined, en: string): [string, string | undefined] {
  if (lang === 'en') return [cap(en), vi ? cap(vi) : undefined]
  return vi ? [cap(vi), en] : [cap(en), undefined]
}
