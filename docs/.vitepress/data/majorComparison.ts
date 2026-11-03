import { matchingDirections, searchMajors } from './majorSearch.ts'
import type {
  Direction,
  Language,
  SearchFilters,
  SearchMajor,
} from './majorSearch.ts'

export const comparisonLimit = 4
export const comparisonStorageKey = 'major-comparison-v1'
export interface ComparisonSelection {
  id: string
  year: string
  language: Language
  mode: string
}
export function makeComparison(
  entry: SearchMajor,
  filters: Pick<SearchFilters, 'language' | 'mode'>,
): ComparisonSelection {
  return {
    id: entry.id,
    year: entry.year,
    language: filters.language,
    mode: filters.mode,
  }
}
export function comparisonKey(selection: ComparisonSelection) {
  return JSON.stringify([
    selection.id,
    selection.year,
    selection.language,
    selection.mode,
  ])
}
export function resolveComparison(
  selection: ComparisonSelection,
  entries: SearchMajor[] = searchMajors,
) {
  const entry = entries.find(
    (e) =>
      e.id === selection.id &&
      e.year === selection.year &&
      e.verification === 'verified',
  )
  if (!entry) return null
  const directions = matchingDirections(entry, selection)
  return directions.length ? { selection, entry, directions } : null
}
export type ResolvedComparison = NonNullable<
  ReturnType<typeof resolveComparison>
>

/** 仅将科目原文、外国语及学习方式完全一致的方向合并展示。 */
export function groupComparisonDirections(directions: Direction[]) {
  const groups = new Map<
    string,
    { names: string[]; mode: string; subjects: string; foreign: string }
  >()
  for (const d of directions) {
    const key = JSON.stringify([
      d.subjectsOriginal || '',
      d.foreignOriginal,
      d.mode,
    ])
    const group = groups.get(key)
    if (group) group.names.push(d.name)
    else
      groups.set(key, {
        names: [d.name],
        mode: d.mode,
        subjects:
          d.subjectsOriginal || '旧整理未保留完整初试科目，请核对官方原件。',
        foreign: d.foreignOriginal,
      })
  }
  return [...groups.values()]
}

/** 只保存身份和筛选口径；恢复时重新读取当前核验数据，不复用过期的科目快照。 */
export function restoreComparisons(
  raw: string | null,
  entries: SearchMajor[] = searchMajors,
): ComparisonSelection[] {
  try {
    const saved: unknown = JSON.parse(raw || 'null')
    if (
      !saved ||
      typeof saved !== 'object' ||
      !('version' in saved) ||
      saved.version !== 1 ||
      !('items' in saved) ||
      !Array.isArray(saved.items)
    )
      return []
    const seen = new Set<string>()
    const valid: ComparisonSelection[] = []
    for (const candidate of saved.items) {
      if (!candidate || typeof candidate !== 'object') continue
      const { id, year, language, mode } = candidate
      if (
        typeof id !== 'string' ||
        typeof year !== 'string' ||
        !['202', '203'].includes(language) ||
        !['', '全日制', '非全日制', '待核实'].includes(mode)
      )
        continue
      const selection: ComparisonSelection = { id, year, language, mode }
      const key = comparisonKey(selection)
      if (!seen.has(key) && resolveComparison(selection, entries)) {
        valid.push(selection)
        seen.add(key)
      }
      if (valid.length === comparisonLimit) break
    }
    return valid
  } catch {
    return []
  }
}

function csvCell(value: string) {
  // 外部目录文本按普通单元格输出，防止表格软件将其当作公式执行。
  const safe =
    /^[\s\uFEFF]*[=+@\-]/.test(value) || /^[\t\r\n]/.test(value)
      ? "'" + value
      : value
  return '"' + safe.replaceAll('"', '""') + '"'
}

/** 一行对应一个可选方向，不将不接受当前语种的方向伪装成可报方向。 */
export function comparisonsCsv(items: ResolvedComparison[]) {
  const rows: string[][] = [
    [
      '招生年度',
      '初试外国语',
      '院校',
      '省份',
      '学院',
      '专业代码',
      '专业名称',
      '学位',
      '计划或专项',
      '学习方式',
      '可选方向',
      '外国语原文',
      '初试科目原文',
      '不接受当前语种的方向',
      '人数口径与报考提醒',
      '核验状态',
      '目录定位',
      '采集日期',
      '官方发布页',
      '官方原件',
    ],
  ]
  for (const { entry, selection, directions } of items) {
    const excluded = entry.directions
      .filter((d) => !d.languages.includes(selection.language))
      .map((d) => `${d.name}：${d.foreignOriginal}`)
      .join('\n')
    for (const d of directions)
      rows.push([
        entry.year,
        selection.language === '202' ? '202俄语' : '203日语',
        entry.university,
        entry.province,
        entry.college,
        entry.code,
        entry.name,
        entry.degree,
        entry.plan,
        d.mode,
        d.name,
        d.foreignOriginal,
        d.subjectsOriginal || '旧整理未保留完整初试科目，请核对官方原件',
        excluded,
        `${entry.countBasis}；语种可选不代表满足全部报考条件，请核对专项、校区与复试要求。`,
        entry.source.status,
        d.locator || entry.source.locator,
        entry.source.collectedAt,
        entry.source.url,
        entry.source.attachmentUrl || entry.source.url,
      ])
  }
  return (
    '\uFEFF' +
    rows.map((row) => row.map(csvCell).join(',')).join('\r\n') +
    '\r\n'
  )
}
