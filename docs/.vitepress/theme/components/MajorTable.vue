<script setup lang="ts">
import { computed, ref } from 'vue'
import type { MajorEntry } from '../../data/majorTypes'

const props = withDefaults(
  defineProps<{
    majors: MajorEntry[]
    /** 结果区默认折叠的学院数量阈值（超出后自动折叠） */
    collapseAfter?: number
  }>(),
  { collapseAfter: 999 }
)

const keyword = ref('')
const plan = ref('全部')
const degree = ref('全部')
const disc = ref('全部')
const onlyRestricted = ref(false)
const collapsed = ref(true)

const planOptions = computed(() => ['全部', ...Array.from(new Set(props.majors.map((m) => m.plan)))])
const degreeOptions = computed(() => ['全部', ...Array.from(new Set(props.majors.map((m) => m.degree).filter(Boolean)))])
const discOptions = computed(() => ['全部', ...Array.from(new Set(props.majors.map((m) => m.disc)))])

const hasNum = computed(() => props.majors.some((m) => m.num))
const hasDirs = computed(() => props.majors.some((m) => m.dirsOk?.length))

const filtered = computed(() =>
  props.majors.filter((m) => {
    if (plan.value !== '全部' && m.plan !== plan.value) return false
    if (degree.value !== '全部' && m.degree !== degree.value) return false
    if (disc.value !== '全部' && m.disc !== disc.value) return false
    if (onlyRestricted.value && !(m.dirsNo && m.dirsNo.length)) return false
    const kw = keyword.value.trim()
    if (kw && !m.major.includes(kw) && !m.school.includes(kw)) return false
    return true
  })
)

const groups = computed(() => {
  const map = new Map<string, MajorEntry[]>()
  for (const m of filtered.value) {
    if (!map.has(m.school)) map.set(m.school, [])
    map.get(m.school)!.push(m)
  }
  return Array.from(map, ([school, items]) => ({ school, items }))
})

const visibleGroups = computed(() =>
  collapsed.value && groups.value.length > props.collapseAfter ? groups.value.slice(0, props.collapseAfter) : groups.value
)

const stats = computed(() => ({
  total: filtered.value.length,
  schools: groups.value.length,
  okDirs: filtered.value.reduce((n, m) => n + (m.dirsOk?.length ?? 0), 0),
  restricted: filtered.value.filter((m) => m.dirsNo?.length).length
}))

const isFiltering = computed(
  () => keyword.value.trim() !== '' || plan.value !== '全部' || degree.value !== '全部' || disc.value !== '全部' || onlyRestricted.value
)

function reset() {
  keyword.value = ''
  plan.value = '全部'
  degree.value = '全部'
  disc.value = '全部'
  onlyRestricted.value = false
}
</script>

<template>
  <div class="major-table">
    <div class="filters">
      <div class="search-wrap">
        <input v-model="keyword" type="search" placeholder="搜索专业代码 / 专业名称 / 学院…" class="search" />
      </div>
      <select v-if="planOptions.length > 2" v-model="plan">
        <option v-for="p in planOptions" :key="p" :value="p">{{ p === '全部' ? '全部计划' : p }}</option>
      </select>
      <select v-if="degreeOptions.length > 2" v-model="degree">
        <option v-for="d in degreeOptions" :key="d" :value="d">{{ d === '全部' ? '全部学位' : d }}</option>
      </select>
      <select v-if="discOptions.length > 2" v-model="disc">
        <option v-for="d in discOptions" :key="d" :value="d">{{ d === '全部' ? '全部门类' : d }}</option>
      </select>
      <label v-if="hasDirs" class="check">
        <input v-model="onlyRestricted" type="checkbox" />
        只看含"仅英语方向"的专业
      </label>
      <button v-if="isFiltering" class="reset" type="button" @click="reset">清空筛选</button>
    </div>

    <div class="stats">
      <span class="stat"><b>{{ stats.total }}</b> 个专业</span>
      <span class="stat"><b>{{ stats.schools }}</b> 个招生单位</span>
      <span v-if="hasDirs" class="stat ok"><b>{{ stats.okDirs }}</b> 个可考方向</span>
      <span v-if="hasDirs && stats.restricted" class="stat warn"><b>{{ stats.restricted }}</b> 个专业含仅英语方向</span>
    </div>

    <section v-for="g in visibleGroups" :key="g.school" class="group">
      <h3 class="group-title">
        <span class="dot" />
        {{ g.school }}
        <span class="group-count">{{ g.items.length }}</span>
      </h3>
      <div class="scroll">
        <table>
          <thead>
            <tr>
              <th>专业代码及名称</th>
              <th v-if="hasNum">招生人数</th>
              <th v-if="hasDirs">研究方向</th>
              <th>外国语②可选科目</th>
              <th>学位</th>
              <th>门类</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="m in g.items" :key="m.major + m.plan">
              <td class="major">{{ m.major }}</td>
              <td v-if="hasNum" class="nowrap">{{ m.num || '—' }}</td>
              <td v-if="hasDirs" class="dirs">
                <span v-if="!m.dirsNo || !m.dirsNo.length" class="dir-all">全部方向可选</span>
                <details v-else>
                  <summary>
                    <span class="pill ok">可选 {{ m.dirsOk?.length ?? 0 }}</span>
                    <span class="pill no">仅英语 {{ m.dirsNo.length }}</span>
                  </summary>
                  <div class="dir-list">
                    <p class="dir-label ok-label">可选 202 俄语的方向</p>
                    <ul>
                      <li v-for="d in m.dirsOk" :key="d" class="ok">{{ d }}</li>
                    </ul>
                    <p class="dir-label no-label">仅英语（不可选 202 俄语）的方向</p>
                    <ul>
                      <li v-for="d in m.dirsNo" :key="d" class="no">{{ d }}</li>
                    </ul>
                  </div>
                </details>
              </td>
              <td class="opt"><span class="tag">{{ m.opt }}</span></td>
              <td class="nowrap">{{ m.degree || '—' }}</td>
              <td class="nowrap">{{ m.disc }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <p v-if="!groups.length" class="empty">没有符合条件的专业，试试调整筛选条件。</p>

    <div v-if="!isFiltering && groups.length > collapseAfter" class="more">
      <button type="button" @click="collapsed = !collapsed">
        {{ collapsed ? `展开其余 ${groups.length - collapseAfter} 个招生单位` : '收起' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.major-table {
  margin: 16px 0;
}
.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
.search-wrap { position: relative; }
.filters input[type='search'],
.filters select {
  padding: 7px 11px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  font-size: 14px;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.filters input[type='search']:focus,
.filters select:focus {
  outline: none;
  border-color: var(--vp-c-brand-1);
  box-shadow: 0 0 0 3px var(--vp-c-brand-soft);
}
.filters .search { min-width: 240px; }
.check {
  font-size: 13px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--vp-c-text-2);
  cursor: pointer;
  user-select: none;
}
.reset {
  font-size: 13px;
  padding: 6px 12px;
  border-radius: 8px;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
  cursor: pointer;
  transition: background 0.2s;
}
.reset:hover { background: var(--vp-c-bg-alt); }

.stats {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 12px 0 4px;
}
.stat {
  font-size: 12.5px;
  color: var(--vp-c-text-2);
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  border-radius: 999px;
  padding: 4px 12px;
}
.stat b { color: var(--vp-c-text-1); font-size: 13.5px; }
.stat.ok b { color: var(--vp-c-green-darker); }
.stat.warn b { color: var(--vp-c-yellow-darker); }

.group { margin-top: 22px; }
.group-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  margin: 0 0 10px;
  padding: 6px 0 6px 10px;
  border-left: 3px solid var(--vp-c-brand-1);
  background: linear-gradient(90deg, var(--vp-c-brand-soft), transparent);
  border-radius: 0 8px 8px 0;
}
.dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--vp-c-brand-1); flex: none;
}
.group-count {
  font-size: 12px; font-weight: 500; color: var(--vp-c-text-2);
  background: var(--vp-c-bg-soft); border-radius: 999px; padding: 1px 8px;
}
.scroll { overflow-x: auto; border: 1px solid var(--vp-c-divider); border-radius: 10px; }
table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
th, td { padding: 9px 12px; border-bottom: 1px solid var(--vp-c-divider); text-align: left; vertical-align: top; }
tbody tr:last-child td { border-bottom: none; }
tbody tr:hover { background: var(--vp-c-bg-soft); }
th {
  position: sticky; top: 0; z-index: 1;
  background: var(--vp-c-bg-alt);
  font-size: 12.5px; font-weight: 600; color: var(--vp-c-text-2);
  white-space: nowrap;
}
.major { font-weight: 500; }
.nowrap { white-space: nowrap; }
.opt .tag {
  display: inline-block;
  font-size: 12.5px;
  color: var(--vp-c-green-darker);
  background: var(--vp-c-green-soft);
  border-radius: 6px;
  padding: 2px 8px;
  white-space: nowrap;
}
.dir-all { font-size: 12.5px; color: var(--vp-c-green-darker); }
.pill {
  display: inline-block; font-size: 12px; border-radius: 999px;
  padding: 1px 8px; margin-right: 4px;
}
.pill.ok { background: var(--vp-c-green-soft); color: var(--vp-c-green-darker); }
.pill.no { background: var(--vp-c-gray-soft); color: var(--vp-c-text-2); }
details summary { cursor: pointer; list-style: none; }
details summary::-webkit-details-marker { display: none; }
details[open] summary { margin-bottom: 6px; }
.dir-list { max-width: 420px; }
.dir-label { font-size: 12px; font-weight: 600; margin: 6px 0 2px; }
.ok-label { color: var(--vp-c-green-darker); }
.no-label { color: var(--vp-c-text-2); }
.dir-list ul { margin: 0; padding-left: 18px; }
.dir-list li { font-size: 12.5px; line-height: 1.7; }
.dir-list li.ok { color: var(--vp-c-text-1); }
.dir-list li.no { color: var(--vp-c-text-2); }
.empty { color: var(--vp-c-text-2); font-size: 14px; padding: 24px 0; text-align: center; }
.more { text-align: center; margin-top: 18px; }
.more button {
  padding: 8px 18px; border-radius: 999px; font-size: 13.5px;
  border: 1px solid var(--vp-c-divider); background: var(--vp-c-bg-soft);
  color: var(--vp-c-brand-1); cursor: pointer; transition: background 0.2s;
}
.more button:hover { background: var(--vp-c-bg-alt); }
</style>
