import {
  comparisonKey,
  comparisonLimit,
  resolveComparison,
} from './majorComparison.ts'
import type { ComparisonSelection } from './majorComparison.ts'
import { defaults, searchMajors, serializeFilters } from './majorSearch.ts'
import type { SearchFilters, SearchMajor } from './majorSearch.ts'

export const comparisonParamLimit = 1024
export const shareUrlLimit = 4096
const modes: Record<string, string> = {
  a: '',
  f: '全日制',
  p: '非全日制',
  u: '待核实',
}
const validId = /^[A-Za-z0-9_-]{1,96}$/
export interface SharedComparisons {
  present: boolean
  items: ComparisonSelection[]
  ignored: number
  notice: string
}

/** 有参数即为分享预览，解析失败也不得回写或冒充本机清单。 */
export function parseSharedComparisons(
  params: URLSearchParams,
  entries: SearchMajor[] = searchMajors,
): SharedComparisons {
  const result: SharedComparisons = {
    present: params.has('compare'),
    items: [],
    ignored: 0,
    notice: '',
  }
  if (!result.present) return result
  const values = params.getAll('compare')
  const raw = values[0]
  if (
    values.length !== 1 ||
    raw.length > comparisonParamLimit ||
    (raw !== 'v1' && !raw.startsWith('v1~'))
  ) {
    result.notice = '对比链接格式无效、版本不支持或内容过长，未修改本机清单。'
    return result
  }
  const seen = new Set<string>()
  const parts = raw === 'v1' ? [] : raw.slice(3).split(',')
  for (const part of parts) {
    const fields = part.split(':')
    const [id, year, language, mode] = fields
    if (
      fields.length !== 4 ||
      !validId.test(id) ||
      !/^\d{4}$/.test(year) ||
      !['202', '203'].includes(language) ||
      !Object.hasOwn(modes, mode)
    ) {
      result.ignored++
      continue
    }
    const item: ComparisonSelection = {
      id,
      year,
      language: language as '202' | '203',
      mode: modes[mode],
    }
    const key = comparisonKey(item)
    if (
      !resolveComparison(item, entries) ||
      seen.has(key) ||
      result.items.length >= comparisonLimit
    )
      result.ignored++
    else {
      seen.add(key)
      result.items.push(item)
    }
  }
  if (result.ignored)
    result.notice = `已忽略${result.ignored}项失效、无效、重复或超过4项上限的对比记录。`
  return result
}

export function encodeSharedComparisons(items: ComparisonSelection[]): string {
  if (items.length > comparisonLimit) throw new Error('最多分享4个对比项。')
  const parts = items.map((s) => {
    const mode = Object.keys(modes).find((key) => modes[key] === s.mode)
    if (
      !validId.test(s.id) ||
      !/^\d{4}$/.test(s.year) ||
      !['202', '203'].includes(s.language) ||
      mode === undefined
    )
      throw new Error('存在无法分享的对比项。')
    return [s.id, s.year, s.language, mode].join(':')
  })
  const result = 'v1' + (parts.length ? '~' + parts.join(',') : '')
  if (result.length > comparisonParamLimit)
    throw new Error('对比内容过长，无法生成链接。')
  return result
}

/** 只替换本功能管理的参数，保留其他参数、子路径与锚点。null代表本机模式。 */
export function pageStateUrl(
  current: string,
  filters: SearchFilters,
  items: ComparisonSelection[] | null,
  onlyDiff: boolean,
) {
  const url = new URL(current)
  for (const key of Object.keys(defaults)) url.searchParams.delete(key)
  for (const [key, value] of new URLSearchParams(serializeFilters(filters)))
    url.searchParams.set(key, value)
  url.searchParams.delete('compare')
  url.searchParams.delete('diff')
  if (items !== null)
    url.searchParams.set('compare', encodeSharedComparisons(items))
  if (onlyDiff) url.searchParams.set('diff', '1')
  return url
}

export function sharePageUrl(
  current: string,
  filters: SearchFilters,
  items: ComparisonSelection[] | null,
  onlyDiff = false,
) {
  const url = pageStateUrl(current, filters, items, items !== null && onlyDiff)
  // 分享查询页无需把上一次访问详情留下的锚点一并发出。
  url.hash = ''
  if (url.href.length > shareUrlLimit)
    throw new Error('分享链接过长，请缩短搜索关键词后重试。')
  return url.href
}
