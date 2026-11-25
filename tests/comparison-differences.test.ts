import assert from 'node:assert/strict'
import { test } from 'node:test'
import { defaults, searchMajors } from '../docs/.vitepress/data/majorSearch.ts'
import type { SearchMajor } from '../docs/.vitepress/data/majorSearch.ts'
import {
  comparisonsCsv,
  differingComparisonFields,
  makeComparison,
  mergeComparisonCandidates,
  resolveComparison,
} from '../docs/.vitepress/data/majorComparison.ts'
const fixture: SearchMajor = {
  ...searchMajors[0],
  id: 'fixture',
  year: '2027',
  degree: '学硕',
  college: '测试学院',
  plan: '全日制',
  countBasis: '专业计划，不是方向名额',
  directions: [
    {
      name: 'A',
      mode: '全日制',
      languages: ['202', '203'],
      foreignOriginal: '202或203',
      restricted: false,
      subjectsOriginal: '101、202、301、801',
    },
    {
      name: 'B',
      mode: '全日制',
      languages: ['202', '203'],
      foreignOriginal: '202或203',
      restricted: false,
      subjectsOriginal: '101、202、301、802',
    },
  ],
}
const selection = makeComparison(fixture, defaults)
function resolved(entry: SearchMajor) {
  return resolveComparison({ ...selection, id: entry.id, year: entry.year }, [
    entry,
  ])!
}

test('相同业务字段不因院校身份或方向排列顺序不同而误判差异', () => {
  const other = {
    ...fixture,
    id: 'other',
    university: '另一院校',
    directions: [...fixture.directions].reverse(),
  }
  assert.deepEqual(
    [...differingComparisonFields([resolved(fixture), resolved(other)])],
    [],
  )
  assert.equal(differingComparisonFields([resolved(fixture)]).size, 0)
})
test('初试科目与方向必须成对比较，交换方向专业课也应显示差异', () => {
  const other = {
    ...fixture,
    id: 'other',
    directions: fixture.directions.map((d, i) => ({
      ...d,
      subjectsOriginal: fixture.directions[1 - i].subjectsOriginal,
    })),
  }
  const fields = differingComparisonFields([resolved(fixture), resolved(other)])
  assert.ok(fields.has('subjects'))
  assert.ok(!fields.has('directions'))
})
test('仅差异保留缺失与待核验字段，年度、语种、方式及限制独立比较', () => {
  const unknown = {
    ...fixture,
    id: 'unknown',
    degree: '' as const,
    directions: fixture.directions.map((d) => ({
      ...d,
      subjectsOriginal: undefined,
    })),
  }
  const fields = differingComparisonFields([
    resolved(unknown),
    resolved({ ...unknown, id: 'same' }),
  ])
  assert.ok(fields.has('degree'))
  assert.ok(fields.has('subjects'))
  const japanese = resolveComparison(
    { ...selection, language: '203', mode: '全日制' },
    [fixture],
  )!
  const context = differingComparisonFields([resolved(fixture), japanese])
  assert.ok(context.has('language'))
  assert.ok(context.has('mode'))
  const old = { ...fixture, id: 'old', year: '2026' }
  assert.ok(
    differingComparisonFields([resolved(fixture), resolved(old)]).has('year'),
  )
})
test('合并候选按本机顺序去重保留全部，超过4项不静默截断并剔除失效项', () => {
  const entries = Array.from({ length: 6 }, (_, i) => ({
    ...fixture,
    id: 'f' + i,
  }))
  const items = entries.map((e) => makeComparison(e, defaults))
  const merged = mergeComparisonCandidates(
    items.slice(0, 4),
    [items[0], ...items.slice(4), { ...items[0], id: 'removed' }],
    entries,
  )
  assert.deepEqual(merged, items)
  assert.equal(merged.length, 6)
})
test('差异计算不修改条目、方向顺序、分享身份或CSV完整输出', () => {
  const items = [
    resolved(fixture),
    resolved({
      ...fixture,
      id: 'other',
      directions: [...fixture.directions].reverse(),
    }),
  ]
  const before = JSON.stringify(items)
  const csv = comparisonsCsv(items)
  differingComparisonFields(items)
  assert.equal(JSON.stringify(items), before)
  assert.equal(comparisonsCsv(items), csv)
  assert.ok(csv.includes('101、202、301、801'))
  assert.ok(csv.includes('101、202、301、802'))
})
