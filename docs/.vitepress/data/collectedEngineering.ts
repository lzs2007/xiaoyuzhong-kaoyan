import sources from './catalogSources.json' with { type: 'json' }
import { reviewedExpansionPrograms } from './reviewedExpansionPrograms.ts'
import { reviewedPrograms } from './reviewedPrograms.ts'
import type { SearchMajor, StudyMode, Language } from './majorSearch'

export interface CollectedProgram {
  id: string
  sourceId: string
  college: string
  code: string
  name: string
  mode: string
  note: string
  directions: {
    name: string
    foreignOriginal: string
    subjectsOriginal: string
    locator: string
    countOriginal: string
  }[]
}
export const catalogSources = sources
function codes(text: string): Language[] {
  return (['202', '203'] as const).filter((code) =>
    new RegExp(`(?<![0-9])${code}(?![0-9])`).test(text),
  )
}
export const collectedEngineering: SearchMajor[] = [
  ...reviewedPrograms,
  ...reviewedExpansionPrograms,
].map((program) => {
  const source = sources.find((s) => s.id === program.sourceId)
  if (!source) throw new Error(`缺少来源：${program.sourceId}`)
  return {
    id: program.id,
    verification: 'verified',
    detailUrl: `/schools/collected#${program.id}`,
    year: source.year,
    schoolId: source.schoolId,
    university: source.university,
    province: source.province,
    college: program.college,
    code: program.code,
    name: program.name,
    degree: /^08[56]/.test(program.code) ? '专硕' : '学硕',
    plan: program.mode,
    original: program.code + program.name,
    directions: program.directions.map((d) => ({
      name: d.name,
      mode: program.mode as StudyMode,
      languages: codes(d.foreignOriginal),
      foreignOriginal: d.foreignOriginal,
      restricted: codes(d.foreignOriginal).length === 0,
      subjectsOriginal: d.subjectsOriginal,
      locator: d.locator,
      countOriginal: d.countOriginal,
    })),
    countBasis:
      program.note ||
      '目录人数可能含推免或为专业合并计划，不按方向重复求和，请核对官方原件。',
    source: {
      name: `${source.university}${source.year}硕士招生专业目录`,
      url: source.url,
      collectedAt: source.collectedAt,
      locator: `${program.college} → ${program.code}${program.name} → ${program.directions[0].locator}`,
      status: '已核实（官方目录原件）',
      attachmentUrl: source.assetUrl,
    },
  }
})
