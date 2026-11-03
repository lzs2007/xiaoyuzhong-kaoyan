import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  defaults,
  filterMajors,
  parseFilters,
  searchMajors,
} from '../docs/.vitepress/data/majorSearch.ts'
import type { SearchMajor } from '../docs/.vitepress/data/majorSearch.ts'
import {
  comparisonKey,
  comparisonsCsv,
  makeComparison,
  resolveComparison,
  restoreComparisons,
  groupComparisonDirections,
} from '../docs/.vitepress/data/majorComparison.ts'

const fixture: SearchMajor = {
  ...searchMajors[0],
  id: 'fixture',
  year: '2027',
  college: '测试学院',
  name: '仪器科学',
  directions: [
    {
      name: '俄语方向A',
      mode: '全日制',
      languages: ['202'],
      restricted: false,
      foreignOriginal: '201或202',
      subjectsOriginal: '101政治、202俄语、301数学、801仪器',
      locator: '第1页',
    },
    {
      name: '俄语方向B',
      mode: '非全日制',
      languages: ['202'],
      restricted: false,
      foreignOriginal: '202或204',
    },
    {
      name: '日语方向C',
      mode: '全日制',
      languages: ['203'],
      restricted: false,
      foreignOriginal: '201或203',
    },
    {
      name: '英语方向D',
      mode: '全日制',
      languages: [],
      restricted: true,
      foreignOriginal: '201英语一',
    },
  ],
}
const selection = makeComparison(fixture, defaults)
const saved = (items: unknown[]) => JSON.stringify({ version: 1, items })

test('对比只合并科目、外国语、学习方式完全一致的方向，保留方向对应关系', () => {
  const first = fixture.directions[0]
  const groups = groupComparisonDirections([
    first,
    { ...first, name: '相同科目第二方向' },
    {
      ...first,
      name: '不同专业课方向',
      subjectsOriginal: '101、202、301、802',
    },
    { ...first, name: '不同方式方向', mode: '非全日制' },
  ])
  assert.equal(groups.length, 3)
  assert.deepEqual(groups[0].names, ['俄语方向A', '相同科目第二方向'])
  assert.deepEqual(groups[1].names, ['不同专业课方向'])
  assert.equal(groups[2].mode, '非全日制')
})

test('搜索支持院校、学院与空格组合；方向搜索只覆盖当前语种可选范围', () => {
  const hits = filterMajors(searchMajors, {
    ...defaults,
    keyword: '哈尔滨工程大学 仪器',
  })
  assert.ok(hits.length > 0)
  assert.ok(hits.every((e) => e.schoolId === 'heu'))
  assert.equal(
    filterMajors([fixture], { ...defaults, keyword: '测试学院 俄语方向A' })
      .length,
    1,
  )
  assert.equal(
    filterMajors([fixture], { ...defaults, keyword: '日语方向C' }).length,
    0,
  )
  assert.equal(
    filterMajors([fixture], { ...defaults, keyword: '英语方向D' }).length,
    0,
  )
  assert.equal(
    filterMajors([fixture], {
      ...defaults,
      mode: '全日制',
      keyword: '俄语方向B',
    }).length,
    0,
  )
  assert.equal(
    filterMajors([fixture], { ...defaults, keyword: '不存在 仪器' }).length,
    0,
  )
  assert.deepEqual(
    filterMajors(searchMajors, { ...defaults, keyword: '０８０４００' }),
    filterMajors(searchMajors, { ...defaults, keyword: '080400' }),
  )
})
test('分享链接恢复时清除与省份冲突的院校，保留合法的同省院校', () => {
  const invalid = parseFilters('?province=辽宁&school=heu')
  assert.equal(invalid.province, '辽宁')
  assert.equal(invalid.school, '')
  assert.equal(parseFilters('?province=黑龙江&school=heu').school, 'heu')
})
test('对比固定加入时的年度、语种和方式，并独立解析相应方向', () => {
  const russian = resolveComparison(selection, [fixture])!
  const japanese = resolveComparison({ ...selection, language: '203' }, [
    fixture,
  ])!
  const full = resolveComparison({ ...selection, mode: '全日制' }, [fixture])!
  assert.deepEqual(
    russian.directions.map((d) => d.name),
    ['俄语方向A', '俄语方向B'],
  )
  assert.deepEqual(
    japanese.directions.map((d) => d.name),
    ['日语方向C'],
  )
  assert.deepEqual(
    full.directions.map((d) => d.name),
    ['俄语方向A'],
  )
  assert.notEqual(comparisonKey(selection), comparisonKey(japanese.selection))
  assert.notEqual(comparisonKey(selection), comparisonKey(full.selection))
  assert.equal(
    resolveComparison({ ...selection, year: '2026' }, [fixture]),
    null,
  )
  assert.equal(
    resolveComparison(selection, [{ ...fixture, verification: 'pending' }]),
    null,
  )
})
test('恢复时拒绝损坏、过期、越界及重复项，不采用存储中的科目快照', () => {
  for (const raw of [
    null,
    '{bad',
    'null',
    '{}',
    '[]',
    saved([null, 42, 'bad']),
    '{"version":2,"items":[]}',
  ])
    assert.deepEqual(restoreComparisons(raw, [fixture]), [])
  const records = [
    selection,
    selection,
    { ...selection, language: '245' },
    { ...selection, mode: '奇怪方式' },
    { ...selection, year: '2026' },
    { ...selection, id: 'removed' },
    { ...selection, subjectsOriginal: '245俄语' },
  ]
  assert.deepEqual(restoreComparisons(saved(records), [fixture]), [selection])
  assert.deepEqual(
    restoreComparisons(saved([selection]), [{ ...fixture, directions: [] }]),
    [],
  )
  const entries = Array.from({ length: 6 }, (_, i) => ({
    ...fixture,
    id: 'fixture-' + i,
  }))
  assert.equal(
    restoreComparisons(
      saved(entries.map((e) => makeComparison(e, defaults))),
      entries,
    ).length,
    4,
  )
})
test('CSV逐可选方向导出并保留原文、限制、定位和官方依据', () => {
  const full = resolveComparison({ ...selection, mode: '全日制' }, [fixture])!
  const csv = comparisonsCsv([full])
  assert.ok(csv.startsWith('\uFEFF"招生年度","初试外国语"'))
  assert.ok(
    csv.includes(
      '"全日制","俄语方向A","201或202","101政治、202俄语、301数学、801仪器"',
    ),
  )
  assert.ok(!csv.includes('"非全日制","俄语方向B"'))
  assert.ok(!csv.includes('"全日制","日语方向C"'))
  assert.ok(csv.includes('日语方向C：201或203'))
  assert.ok(csv.includes('英语方向D：201英语一'))
  assert.ok(csv.includes('"第1页"'))
  assert.ok(csv.includes(fixture.source.url))
  assert.ok(csv.includes('不代表满足全部报考条件'))
  const mixed = comparisonsCsv([
    full,
    resolveComparison({ ...selection, language: '203' }, [fixture])!,
  ])
  assert.ok(mixed.includes('"2027","202俄语"'))
  assert.ok(mixed.includes('"2027","203日语"'))
})
test('CSV转义引号、逗号和换行，并将公式前缀作为普通文本输出', () => {
  const entry = {
    ...fixture,
    university: '=HYPERLINK("x","y")',
    college: '学院,甲\n乙',
    name: '  +SUM(1,2)',
  }
  const csv = comparisonsCsv([resolveComparison(selection, [entry])!])
  assert.ok(csv.includes('"\'=HYPERLINK(""x"",""y"")"'))
  assert.ok(csv.includes('"学院,甲\n乙"'))
  assert.ok(csv.includes('"\'  +SUM(1,2)"'))
})
