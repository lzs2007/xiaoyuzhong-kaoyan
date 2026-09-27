<script setup lang="ts">
import { computed, ref } from 'vue'
import { jluMajors } from '../../data/jluRussian202'

const keyword = ref('')
const kind = ref('全部')
const degree = ref('全部')
const disc = ref('全部')

const kindOptions = ['全部', '全日制', '非全日制', '退役士兵专项']
const degreeOptions = ['全部', '学硕', '专硕']
const discOptions = ['全部', ...Array.from(new Set(jluMajors.map((m) => m.disc)))]

const filtered = computed(() =>
  jluMajors.filter((m) => {
    if (kind.value !== '全部' && m.kind !== kind.value) return false
    if (degree.value !== '全部' && m.degree !== degree.value) return false
    if (disc.value !== '全部' && m.disc !== disc.value) return false
    const kw = keyword.value.trim()
    if (kw && !m.major.includes(kw) && !m.school.includes(kw)) return false
    return true
  })
)

// 按「招生学院」分组，保持专业目录原始顺序
const groups = computed(() => {
  const map = new Map<string, typeof jluMajors>()
  for (const m of filtered.value) {
    if (!map.has(m.school)) map.set(m.school, [])
    map.get(m.school)!.push(m)
  }
  return Array.from(map, ([school, items]) => ({ school, items }))
})

const stats = computed(() => ({
  total: filtered.value.length,
  schools: groups.value.length,
  ft: filtered.value.filter((m) => m.kind === '全日制').length,
  pt: filtered.value.filter((m) => m.kind === '非全日制').length,
  vet: filtered.value.filter((m) => m.kind === '退役士兵专项').length
}))
</script>

<template>
  <div class="jlu-table">
    <div class="filters">
      <input v-model="keyword" type="search" placeholder="搜索专业代码 / 专业名称 / 学院…" class="search" />
      <select v-model="kind">
        <option v-for="k in kindOptions" :key="k" :value="k">{{ k === '全部' ? '全部招生计划' : k }}</option>
      </select>
      <select v-model="degree">
        <option v-for="d in degreeOptions" :key="d" :value="d">{{ d === '全部' ? '全部学位类型' : d }}</option>
      </select>
      <select v-model="disc">
        <option v-for="d in discOptions" :key="d" :value="d">{{ d === '全部' ? '全部门类' : d }}</option>
      </select>
    </div>

    <p class="count">
      命中 <strong>{{ stats.total }}</strong> 个专业，覆盖 <strong>{{ stats.schools }}</strong> 个招生单位
      （全日制 {{ stats.ft }} · 非全日制 {{ stats.pt }} · 退役士兵专项 {{ stats.vet }}）
    </p>

    <section v-for="g in groups" :key="g.school" class="group">
      <h3 class="group-title">
        {{ g.school }}
        <span class="group-count">{{ g.items.length }} 个专业</span>
      </h3>
      <div class="scroll">
        <table>
          <thead>
            <tr>
              <th>专业代码及名称</th>
              <th>招生人数</th>
              <th>外国语②可选科目</th>
              <th>学位</th>
              <th>计划</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="m in g.items" :key="m.major + m.kind">
              <td>{{ m.major }}</td>
              <td class="num">{{ m.num || '—' }}</td>
              <td>
                <span :class="m.opt.includes('202俄语') ? 'badge green' : 'badge gray'">{{ m.opt }}</span>
              </td>
              <td>{{ m.degree }}</td>
              <td class="kind">{{ m.kind === '全日制' ? '全日制' : m.kind }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <p v-if="!groups.length" class="empty">没有符合条件的专业，请调整筛选条件。</p>
  </div>
</template>

<style scoped>
.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin: 12px 0;
}
.filters input[type='search'],
.filters select {
  padding: 6px 10px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  font-size: 14px;
}
.filters .search { min-width: 220px; }
.count { font-size: 13px; color: var(--vp-c-text-2); }
.group { margin-top: 20px; }
.group-title {
  font-size: 15px;
  margin: 0 0 8px;
  padding-left: 8px;
  border-left: 3px solid var(--vp-c-brand-1);
}
.group-count { font-size: 12px; color: var(--vp-c-text-2); font-weight: normal; margin-left: 6px; }
.scroll { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-size: 14px; }
th, td { padding: 7px 10px; border-bottom: 1px solid var(--vp-c-divider); text-align: left; vertical-align: top; }
th { white-space: nowrap; color: var(--vp-c-text-2); font-weight: 600; font-size: 13px; }
.num, .kind { white-space: nowrap; }
.badge { padding: 2px 8px; border-radius: 10px; font-size: 12px; white-space: nowrap; }
.badge.green { background: var(--vp-c-green-soft); color: var(--vp-c-green-darker); }
.badge.gray { background: var(--vp-c-gray-soft); color: var(--vp-c-text-2); }
.empty { color: var(--vp-c-text-2); font-size: 14px; }
</style>
