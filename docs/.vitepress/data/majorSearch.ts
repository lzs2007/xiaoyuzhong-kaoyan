import { jluMajors, jluMeta } from './jluRussian202.ts'
import { heuMajors, heuMeta } from './heuRussian202.ts'
import { anchorFor } from './majorTypes.ts'
import type { MajorEntry, SchoolMeta, Degree } from './majorTypes'
export { anchorFor }

export type Language = '202' | '203'
export type StudyMode = '全日制' | '非全日制' | '待核实'
export interface Direction {
  name: string
  mode: StudyMode
  languages: Language[]
  foreignOriginal: string
  restricted: boolean
}
export interface SearchMajor {
  id: string
  verification: 'verified' | 'pending'
  detailUrl: string
  year: string
  schoolId: string
  university: string
  province: string
  college: string
  code: string
  name: string
  degree: Degree
  plan: string
  original: string
  directions: Direction[]
  count?: string
  countBasis: string
  source: {
    name: string
    url: string
    collectedAt: string
    locator: string
    status: string
  }
}
export interface SearchFilters {
  year: string
  language: Language
  keyword: string
  province: string
  school: string
  degree: string
  mode: string
}
export const defaults: SearchFilters = {
  year: '2027',
  language: '202',
  keyword: '',
  province: '',
  school: '',
  degree: '',
  mode: '',
}
export const coverage = [
  {
    id: 'jlu',
    name: '吉林大学',
    province: '吉林',
    year: '2027',
    status: '待更新',
    url: 'https://gongkai.jlu.edu.cn/info/1040/14566.htm',
    note: '已找到2027招生章程及目录公告，专业与方向尚未逐项核验。',
  },
  {
    id: 'heu',
    name: '哈尔滨工程大学',
    province: '黑龙江',
    year: '2027',
    status: '待更新',
    url: 'https://yzb.hrbeu.edu.cn/3277/list.htm',
    note: '2027专业及方向尚未完成核验，请查看官方目录栏目。',
  },
]
function studyMode(text: string): StudyMode {
  if (text.includes('非全日制')) return '非全日制'
  if (text.includes('全日制')) return '全日制'
  return '待核实'
}
/** 仅按明确的科目代码提取，不从文件名、院校概览或语种专业名称推断。 */
export function languagesFromOriginal(text: string): Language[] {
  return (['202', '203'] as const).filter((code) =>
    new RegExp(`(?:^|[^0-9])${code}(?![0-9])`).test(text),
  )
}
function adapt(
  entries: MajorEntry[],
  meta: SchoolMeta,
  province: string,
): SearchMajor[] {
  return entries.flatMap((entry) => {
    if (entry.disc !== '工学') return []
    const match = entry.major.match(/^([0-9A-Z]{6})(.*)$/)
    if (!match) throw new Error(`无法拆分专业代码：${entry.major}`)
    // 老数据中部分吉大方向嵌在专业名内，拆分同时保留完整原文。
    const [, code, rest] = match
    const start = rest.search(/[｜|]|(?=\d{2}[^0-9])/)
    const name = (start < 0 ? rest : rest.slice(0, start)).trim()
    const embedded = start < 0 ? '' : rest.slice(start).replace(/^[｜|]/, '')
    const allowed = entry.dirsOk?.length
      ? entry.dirsOk
      : embedded
        ? embedded.match(/\d{2}[^0-9]+/g) || [embedded]
        : ['目录未细分方向（仅限本条所列计划）']
    const languages = languagesFromOriginal(entry.opt)
    const directions: Direction[] = allowed.map((name) => ({
      name,
      mode: studyMode(entry.dirsOk?.length ? name : entry.plan),
      languages,
      foreignOriginal: entry.opt,
      restricted: false,
    }))
    for (const name of entry.dirsNo || [])
      directions.push({
        name,
        mode: studyMode(name),
        languages: [],
        foreignOriginal: '仅英语（旧整理未保留具体英语科目代码，请核对原目录）',
        restricted: true,
      })
    return [
      {
        id: anchorFor(meta.slug, entry),
        verification: 'verified',
        detailUrl: `/schools/${meta.slug}#${anchorFor(meta.slug, entry)}`,
        year: '2026',
        schoolId: meta.slug,
        university: meta.name,
        province,
        college: entry.school,
        code,
        name,
        degree: entry.degree,
        plan: entry.plan,
        original: entry.major,
        directions,
        count: entry.num,
        countBasis:
          meta.slug === 'jlu'
            ? '专业计划人数，含推免等，非统考名额、非方向人数。'
            : '方向文字中的人数为推免拟接收人数＋统考预计人数／非全日制人数；不重复求和。',
        source: {
          name: meta.sourceName,
          url: meta.sourceUrl,
          collectedAt: meta.collectedAt,
          locator: `${entry.plan} → ${entry.school} → ${entry.major} → ②外国语`,
          status: meta.verified,
        },
      },
    ]
  })
}
export const searchMajors = [
  ...adapt(jluMajors, jluMeta, '吉林'),
  ...adapt(heuMajors, heuMeta, '黑龙江'),
]
export function matchingDirections(entry: SearchMajor, filters: SearchFilters) {
  return entry.directions.filter(
    (d) =>
      d.languages.includes(filters.language) &&
      (!filters.mode || d.mode === filters.mode),
  )
}
export function filterMajors(entries: SearchMajor[], filters: SearchFilters) {
  const keyword = filters.keyword.trim().toUpperCase()
  return entries.filter(
    (entry) =>
      entry.verification === 'verified' &&
      entry.year === filters.year &&
      (!filters.province || entry.province === filters.province) &&
      (!filters.school || entry.schoolId === filters.school) &&
      (!filters.degree || entry.degree === filters.degree) &&
      (!keyword ||
        entry.code.startsWith(keyword) ||
        entry.name.toUpperCase().includes(keyword)) &&
      matchingDirections(entry, filters).length > 0,
  )
}
export function parseFilters(search: string): SearchFilters {
  const params = new URLSearchParams(search)
  const f = { ...defaults }
  if (['2026', '2027'].includes(params.get('year') || ''))
    f.year = params.get('year')!
  if (params.get('language') === '203') f.language = '203'
  f.keyword = (params.get('keyword') || '').trim()
  const entries = searchMajors.filter((e) => e.year === f.year)
  for (const key of ['province', 'school', 'degree', 'mode'] as const) {
    const value = params.get(key) || ''
    const valid =
      key === 'mode'
        ? entries.some((e) => e.directions.some((d) => d.mode === value))
        : entries.some(
            (e) => (key === 'school' ? e.schoolId : e[key]) === value,
          )
    if (valid) f[key] = value
  }
  return f
}
export function serializeFilters(filters: SearchFilters): string {
  const params = new URLSearchParams()
  for (const key of Object.keys(defaults) as (keyof SearchFilters)[]) {
    const value = filters[key].trim()
    if (value && value !== defaults[key]) params.set(key, value)
  }
  const query = params.toString()
  return query ? `?${query}` : ''
}
