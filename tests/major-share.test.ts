import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  defaults,
  parseFilters,
  searchMajors,
} from '../docs/.vitepress/data/majorSearch.ts'
import type { SearchMajor } from '../docs/.vitepress/data/majorSearch.ts'
import { comparisonKey } from '../docs/.vitepress/data/majorComparison.ts'
import type { ComparisonSelection } from '../docs/.vitepress/data/majorComparison.ts'
import {
  comparisonParamLimit,
  encodeSharedComparisons,
  pageStateUrl,
  parseSharedComparisons,
  sharePageUrl,
  shareUrlLimit,
} from '../docs/.vitepress/data/majorShare.ts'

const fixture: SearchMajor = {
  ...searchMajors[0],
  id: 'fixture',
  year: '2027',
  directions: [
    {
      name: 'F',
      mode: '全日制',
      languages: ['202', '203'],
      foreignOriginal: '202或203',
      restricted: false,
    },
    {
      name: 'P',
      mode: '非全日制',
      languages: ['202', '203'],
      foreignOriginal: '202或203',
      restricted: false,
    },
    {
      name: 'U',
      mode: '待核实',
      languages: ['202', '203'],
      foreignOriginal: '202或203',
      restricted: false,
    },
  ],
}
const entries = [fixture, { ...fixture, id: 'old', year: '2026' }]
const item: ComparisonSelection = {
  id: 'fixture',
  year: '2027',
  language: '202',
  mode: '',
}
const parse = (value: string) =>
  parseSharedComparisons(new URLSearchParams({ compare: value }), entries)

test('分享协议往返保留顺序、四种学习方式、年度及语种，稳定身份不取数组序号', () => {
  const items: ComparisonSelection[] = [
    item,
    { ...item, language: '203', mode: '全日制' },
    { ...item, mode: '非全日制' },
    { id: 'old', year: '2026', language: '203', mode: '待核实' },
  ]
  const parsed = parse(encodeSharedComparisons(items))
  assert.deepEqual(parsed.items, items)
  assert.equal(parsed.ignored, 0)
  assert.deepEqual(
    parseSharedComparisons(
      new URLSearchParams({ compare: encodeSharedComparisons(items) }),
      [...entries].reverse(),
    ).items,
    items,
  )
  assert.equal(new Set(items.map(comparisonKey)).size, 4)
})
test('区分无分享参数与显式空预览，空预览不会被解析成本机模式', () => {
  assert.equal(parseSharedComparisons(new URLSearchParams()).present, false)
  assert.deepEqual(parse('v1').items, [])
  assert.equal(parse('v1').present, true)
  assert.equal(encodeSharedComparisons([]), 'v1')
})
test('畸形、未知版本、重复参数及超长输入安全返回空分享预览和提示', () => {
  for (const value of [
    '',
    'v2~fixture:2027:202:a',
    '%GG',
    '<script>',
    'v1~' + 'x'.repeat(comparisonParamLimit),
  ]) {
    const parsed = parse(value)
    assert.equal(parsed.present, true)
    assert.deepEqual(parsed.items, [])
    assert.ok(parsed.notice)
  }
  const repeated = parseSharedComparisons(
    new URLSearchParams('compare=v1&compare=v1'),
    entries,
  )
  assert.deepEqual(repeated.items, [])
  assert.ok(repeated.notice)
})
test('部分失效、重复、无效字段静默过滤；原型字段、错误年度及失去资格不回退旧记录', () => {
  const valid = 'fixture:2027:202:a'
  const invalid = [
    'removed:2027:202:a',
    'fixture:2026:202:a',
    'fixture:2027:245:a',
    'fixture:2027:202:constructor',
    'fixture:2027:202:__proto__',
    'fixture:2027:202:a:extra',
    'bad!:2027:202:a',
    'fixture:27:202:a',
  ]
  const parsed = parse('v1~' + [valid, valid, ...invalid].join(','))
  assert.deepEqual(parsed.items, [item])
  assert.equal(parsed.ignored, invalid.length + 1)
  assert.ok(parsed.notice.includes(String(invalid.length + 1)))
  assert.equal(
    parseSharedComparisons(
      new URLSearchParams({ compare: encodeSharedComparisons([item]) }),
      [{ ...fixture, verification: 'pending' }],
    ).items.length,
    0,
  )
  assert.equal(
    parseSharedComparisons(
      new URLSearchParams({ compare: encodeSharedComparisons([item]) }),
      [{ ...fixture, directions: [] }],
    ).items.length,
    0,
  )
})
test('五个有效项只解析前四个，编码器不静默丢弃超限项', () => {
  const more = Array.from({ length: 5 }, (_, i) => ({
    ...fixture,
    id: 'f' + i,
  }))
  const value = 'v1~' + more.map((e) => e.id + ':2027:202:a').join(',')
  const parsed = parseSharedComparisons(
    new URLSearchParams({ compare: value }),
    more,
  )
  assert.equal(parsed.items.length, 4)
  assert.equal(parsed.ignored, 1)
  assert.throws(
    () => encodeSharedComparisons(more.map((e) => ({ ...item, id: e.id }))),
    /最多/,
  )
  assert.throws(
    () => encodeSharedComparisons([{ ...item, id: '<bad>' }]),
    /无法分享/,
  )
})
test('筛选和分享状态组合保留子路径、其他参数、锚点，并清除重复受管参数', () => {
  const f = {
    ...defaults,
    region: 'northeast',
    province: '黑龙江',
    school: 'heu',
    keyword: '仪器 测控',
  }
  const url = pageStateUrl(
    'https://example.org/xiaoyuzhong-kaoyan/schools/find?compare=bad&compare=bad&diff=0&utm=x&school=bit#row',
    f,
    [item],
    true,
  )
  assert.equal(url.pathname, '/xiaoyuzhong-kaoyan/schools/find')
  assert.equal(url.hash, '#row')
  assert.equal(url.searchParams.get('utm'), 'x')
  assert.equal(url.searchParams.getAll('compare').length, 1)
  assert.equal(url.searchParams.get('diff'), '1')
  assert.deepEqual(parseFilters(url.search), f)
  assert.deepEqual(parseSharedComparisons(url.searchParams, entries).items, [
    item,
  ])
  const updated = pageStateUrl(
    url.href,
    { ...f, keyword: '机械' },
    [item],
    true,
  )
  assert.equal(
    updated.searchParams.get('compare'),
    url.searchParams.get('compare'),
  )
})
test('复制筛选链接移除对比与差异状态；复制对比链接保留条件但不携带旧锚点', () => {
  const base =
    'https://example.org/xiaoyuzhong-kaoyan/schools/find?compare=v1&diff=1#old'
  const filter = new URL(
    sharePageUrl(base, { ...defaults, topic: 'instrument' }, null, true),
  )
  assert.equal(filter.searchParams.has('compare'), false)
  assert.equal(filter.searchParams.has('diff'), false)
  assert.equal(filter.hash, '')
  assert.equal(filter.searchParams.get('topic'), 'instrument')
  const compare = new URL(sharePageUrl(base, defaults, [item], true))
  assert.equal(compare.searchParams.get('diff'), '1')
  assert.deepEqual(
    parseSharedComparisons(compare.searchParams, entries).items,
    [item],
  )
  assert.throws(
    () =>
      sharePageUrl(base, { ...defaults, keyword: '测'.repeat(shareUrlLimit) }, [
        item,
      ]),
    /链接过长/,
  )
})
