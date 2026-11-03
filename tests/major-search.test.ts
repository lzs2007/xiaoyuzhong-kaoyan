import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import {
  defaults,
  searchMajors,
  filterMajors,
  matchingDirections,
  languagesFromOriginal,
  parseFilters,
  serializeFilters,
  anchorFor,
} from '../docs/.vitepress/data/majorSearch.ts'
import type { SearchMajor } from '../docs/.vitepress/data/majorSearch.ts'
import { jluMajors } from '../docs/.vitepress/data/jluRussian202.ts'
import { heuMajors } from '../docs/.vitepress/data/heuRussian202.ts'
import {
  collectedEngineering,
  catalogSources,
} from '../docs/.vitepress/data/collectedEngineering.ts'
const historical = { ...defaults, year: '2026' }

test('年度隔离：默认2027不能回退使用2026', () => {
  assert.equal(filterMajors(searchMajors, defaults).length, 124)
  assert.ok(
    filterMajors(searchMajors, defaults).every((e) => e.year === '2027'),
  )
  assert.equal(filterMajors(searchMajors, historical).length, 70)
  assert.equal(
    searchMajors.filter((e) => e.schoolId === 'jlu' && e.year === '2026')
      .length,
    26,
  )
  assert.equal(searchMajors.filter((e) => e.schoolId === 'heu').length, 44)
})
test('待核实条目不能计入可选结果，即使含语种代码', () => {
  assert.equal(
    filterMajors([{ ...searchMajors[0], verification: 'pending' }], historical)
      .length,
    0,
  )
})
test('专业名称去空格、代码前缀和自设专业代码', () => {
  const a = filterMajors(searchMajors, { ...historical, keyword: ' 机械 ' })
  assert.ok(a.length > 0)
  assert.ok(a.every((e) => e.name.includes('机械')))
  assert.ok(
    filterMajors(searchMajors, { ...historical, keyword: '0855' }).every((e) =>
      e.code.startsWith('0855'),
    ),
  )
  assert.ok(
    filterMajors(searchMajors, { ...historical, keyword: '0802z2' }).some(
      (e) => e.code === '0802Z2',
    ),
  )
  assert.equal(
    filterMajors(searchMajors, { ...historical, keyword: '量子不存在' }).length,
    0,
  )
})
test('俄日独立：仅接受202的方向不能匹配203，自命题俄语不推断为202', () => {
  const entry: SearchMajor = {
    ...searchMajors[0],
    directions: [
      {
        name: '01',
        mode: '全日制',
        foreignOriginal: '201或202',
        languages: ['202'],
        restricted: false,
      },
    ],
  }
  assert.equal(filterMajors([entry], historical).length, 1)
  assert.equal(
    filterMajors([entry], { ...historical, language: '203' }).length,
    0,
  )
  assert.deepEqual(languagesFromOriginal('245俄语、246日语、120203'), [])
  assert.deepEqual(languagesFromOriginal('201英语（一）或202俄语或203日语'), [
    '202',
    '203',
  ])
})
test('组合筛选只返回指定院校、省份、学位及学习方式', () => {
  const filters = {
    ...historical,
    province: '黑龙江',
    school: 'heu',
    degree: '专硕',
    mode: '非全日制',
  }
  const entries = filterMajors(searchMajors, filters)
  assert.ok(entries.length > 0)
  assert.ok(
    entries.every(
      (e) =>
        e.province === '黑龙江' && e.schoolId === 'heu' && e.degree === '专硕',
    ),
  )
  assert.ok(
    entries.every((e) =>
      matchingDirections(e, filters).every((d) => d.mode === '非全日制'),
    ),
  )
  assert.equal(
    filterMajors(searchMajors, { ...filters, province: '吉林' }).length,
    0,
  )
})
test('同一专业的仅英语方向保留限制，但不进入可选方向', () => {
  const entry = searchMajors.find(
    (e) => e.schoolId === 'heu' && e.code === '082401',
  )!
  assert.ok(
    entry.directions.some((d) => d.restricted && d.name.includes('青岛')),
  )
  assert.ok(matchingDirections(entry, historical).every((d) => !d.restricted))
  assert.ok(
    !matchingDirections(entry, historical).some((d) => d.name.includes('青岛')),
  )
})
test('专项资格不伪装成普通全日制，院系及人数口径不合并', () => {
  const special = searchMajors.filter((e) => e.plan === '退役士兵专项')
  assert.equal(special.length, 2)
  assert.ok(
    special.every(
      (e) => !filterMajors([e], { ...historical, mode: '全日制' }).length,
    ),
  )
  const machinery = filterMajors(searchMajors, {
    ...historical,
    school: 'jlu',
    keyword: '085500',
  })
  assert.ok(new Set(machinery.map((e) => e.college)).size > 1)
  assert.ok(machinery.every((e) => e.countBasis.includes('非统考名额')))
})
test('分享链接往返、非法参数、默认值与历史恢复', () => {
  const f = {
    ...historical,
    language: '203' as const,
    keyword: '机械',
    province: '黑龙江',
    school: 'heu',
    degree: '专硕',
    mode: '非全日制',
  }
  assert.deepEqual(parseFilters(serializeFilters(f)), f)
  assert.equal(serializeFilters(defaults), '')
  assert.deepEqual(
    parseFilters(
      '?year=2099&language=245&school=no&province=no&degree=no&mode=no',
    ),
    defaults,
  )
  assert.deepEqual(parseFilters('?year=2026'), historical)
  assert.deepEqual(parseFilters(''), defaults)
})
test('每条历史结果均有来源、定位、唯一锚点且可定位到旧专业表', () => {
  assert.equal(new Set(searchMajors.map((e) => e.id)).size, searchMajors.length)
  for (const entry of searchMajors.filter((e) => e.year === '2026')) {
    assert.ok(entry.source.url.startsWith('https://'))
    assert.ok(entry.source.locator.includes(entry.code))
    assert.equal(entry.source.collectedAt, '2026-09-12')
    const old = entry.schoolId === 'jlu' ? jluMajors : heuMajors
    const index = old.findIndex(
      (e) =>
        e.school === entry.college &&
        e.major === entry.original &&
        e.plan === entry.plan,
    )
    assert.equal(entry.id, anchorFor(entry.schoolId, old[index]))
    assert.ok(
      entry.directions.every((d) => !d.restricted || d.languages.length === 0),
    )
  }
})
test('生产构建保留GitHub Pages子路径和默认年度提示', () => {
  const html = readFileSync(
    new URL('../docs/.vitepress/dist/schools/find.html', import.meta.url),
    'utf8',
  )
  assert.ok(html.includes('/xiaoyuzhong-kaoyan/'))
  assert.ok(html.includes('2027 已收录官方目录核验结果'))
  assert.ok(html.includes('未收录或待更新不等于不可报考'))
  for (const entry of searchMajors.filter((e) => e.year === '2026')) {
    const detail = readFileSync(
      new URL(
        `../docs/.vitepress/dist/schools/${entry.schoolId}.html`,
        import.meta.url,
      ),
      'utf8',
    )
    assert.ok(detail.includes(`id="${entry.id}"`))
  }
})

test('仪器专题覆盖三校并包含仪器学院电子信息，俄日保持独立', () => {
  const rows = filterMajors(searchMajors, { ...defaults, topic: 'instrument' })
  assert.equal(rows.length, 5)
  assert.deepEqual(
    new Set(rows.map((e) => e.schoolId)),
    new Set(['hit', 'hrbust', 'bit']),
  )
  assert.ok(rows.some((e) => e.schoolId === 'hit' && e.code === '085400'))
  const japanese = filterMajors(searchMajors, {
    ...defaults,
    language: '203',
    topic: 'instrument',
  })
  assert.ok(japanese.length > 0)
  assert.ok(!japanese.some((e) => e.schoolId === 'hrbust'))
  assert.deepEqual(parseFilters('?topic=instrument'), {
    ...defaults,
    topic: 'instrument',
  })
  assert.equal(parseFilters('?topic=unknown').topic, '')
})
test('机械不外推：哈理工仅05设计方向、北理工机械203可选而202不可选', () => {
  const rows = filterMajors(searchMajors, { ...defaults, topic: 'mechanical' })
  const hrbust = rows.find((e) => e.schoolId === 'hrbust')!
  assert.equal(matchingDirections(hrbust, defaults).length, 1)
  assert.ok(matchingDirections(hrbust, defaults)[0].name.startsWith('05'))
  assert.ok(
    hrbust.directions.filter((d) => !d.languages.includes('202')).length >= 5,
  )
  assert.ok(!rows.some((e) => e.schoolId === 'bit' && e.code === '080200'))
  assert.ok(
    filterMajors(searchMajors, {
      ...defaults,
      language: '203',
      keyword: '080200',
      school: 'bit',
    }).length > 0,
  )
})
test('哈工大同专业校区限制保持独立，不把威海机械方向推断为可选俄语', () => {
  const entry = filterMajors(searchMajors, {
    ...defaults,
    school: 'hit',
    keyword: '085500',
  }).find((e) => e.college.startsWith('002'))!
  assert.ok(entry)
  assert.ok(
    matchingDirections(entry, defaults).every(
      (d) => !d.name.includes('威海') && !d.name.includes('深圳'),
    ),
  )
  assert.ok(
    entry.directions.some(
      (d) => d.name.includes('威海') && !d.languages.includes('202'),
    ),
  )
})
test('明确不接受202的专业保留核验记录但不进入俄语结果', () => {
  for (const [school, code] of [
    ['cust', '080400'],
    ['lnut', '081200'],
    ['jlu', '080900'],
  ]) {
    const entry = collectedEngineering.find(
      (e) => e.schoolId === school && e.code === code,
    )!
    assert.ok(entry)
    assert.equal(filterMajors([entry], defaults).length, 0)
  }
})
test('新增来源有官方原件指纹、初试原文、行页定位及可用详情锚点', () => {
  assert.equal(new Set(catalogSources.map((s) => s.schoolId)).size, 7)
  const html = readFileSync(
    new URL('../docs/.vitepress/dist/schools/collected.html', import.meta.url),
    'utf8',
  )
  for (const source of catalogSources) {
    assert.match(source.sha256, /^[a-f0-9]{64}$/)
    assert.equal(source.year, '2027')
    assert.ok(source.assetUrl.startsWith('https://'))
  }
  for (const entry of collectedEngineering) {
    assert.equal(entry.year, '2027')
    assert.equal(entry.source.collectedAt, '2026-11-03')
    assert.ok(html.includes(`id="${entry.id}"`))
    assert.ok(entry.detailUrl.startsWith('/schools/collected#'))
    assert.ok(
      entry.directions.every(
        (d) => d.locator && d.subjectsOriginal && d.foreignOriginal,
      ),
    )
    for (const d of entry.directions)
      assert.deepEqual(d.languages, languagesFromOriginal(d.foreignOriginal))
  }
})
