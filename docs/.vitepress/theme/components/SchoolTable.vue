<script setup lang="ts">
import { computed, ref } from 'vue'
import { schools, type School } from '../../data/schools'

const keyword = ref('')
const province = ref('全部')
const langFilter = ref('全部') // 全部 | 202俄语可选 | 203日语可选 | 仅普遍可选
const verifiedOnly = ref(false)

const provinces = ['全部', '黑龙江', '吉林', '辽宁', '北京', '天津']
const langOptions = ['全部', '202俄语可选', '203日语可选', '仅看普遍可选']

function selectable(s: School, key: 'russian202' | 'japanese203') {
  return s[key] === '普遍可选' || s[key] === '部分专业可选'
}

const filtered = computed(() =>
  schools.filter((s) => {
    if (province.value !== '全部' && s.province !== province.value) return false
    if (keyword.value && !s.school.includes(keyword.value.trim())) return false
    if (langFilter.value === '202俄语可选' && !selectable(s, 'russian202')) return false
    if (langFilter.value === '203日语可选' && !selectable(s, 'japanese203')) return false
    if (langFilter.value === '仅看普遍可选' && s.russian202 !== '普遍可选' && s.japanese203 !== '普遍可选') return false
    if (verifiedOnly.value && s.verified !== '已核实') return false
    return true
  })
)

function badgeClass(status: string) {
  switch (status) {
    case '普遍可选': return 'badge green'
    case '部分专业可选': return 'badge yellow'
    case '不可选': return 'badge red'
    default: return 'badge gray'
  }
}
</script>

<template>
  <div class="school-table">
    <div class="filters">
      <input v-model="keyword" type="search" placeholder="搜索院校名称…" class="search" />
      <select v-model="province">
        <option v-for="p in provinces" :key="p" :value="p">{{ p === '全部' ? '全部省份' : p }}</option>
      </select>
      <select v-model="langFilter">
        <option v-for="l in langOptions" :key="l" :value="l">{{ l }}</option>
      </select>
      <label class="check">
        <input v-model="verifiedOnly" type="checkbox" />
        只看已核实
      </label>
    </div>

    <p class="count">共 {{ filtered.length }} 所（数据收录中，首批覆盖东北三省工科专业）</p>

    <div class="scroll">
      <table>
        <thead>
          <tr>
            <th>院校</th>
            <th>省份/城市</th>
            <th>层次</th>
            <th>202俄语（工科）</th>
            <th>203日语（工科）</th>
            <th>适用年份</th>
            <th>核实状态</th>
            <th>来源与详情</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="s in filtered" :key="s.school">
            <td><strong>{{ s.school }}</strong></td>
            <td>{{ s.province }}·{{ s.city }}</td>
            <td>{{ s.level }}</td>
            <td><span :class="badgeClass(s.russian202)">{{ s.russian202 }}</span></td>
            <td><span :class="badgeClass(s.japanese203)">{{ s.japanese203 }}</span></td>
            <td>{{ s.catalogYear }}</td>
            <td>{{ s.verified }}</td>
            <td>
              <details>
                <summary>展开</summary>
                <p><strong>可选范围：</strong>{{ s.scope }}</p>
                <p><strong>官方目录原文摘录：</strong>{{ s.evidence }}</p>
                <p v-if="s.note"><strong>备注：</strong>{{ s.note }}</p>
                <p>
                  <strong>来源：</strong>{{ s.sourceName }}
                  <a :href="s.sourceUrl" target="_blank" rel="noopener noreferrer">原文链接</a>
                </p>
              </details>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
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
.filters .search { min-width: 180px; }
.check { font-size: 14px; display: flex; align-items: center; gap: 4px; }
.count { font-size: 13px; color: var(--vp-c-text-2); }
.scroll { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-size: 14px; }
th, td { padding: 8px 10px; border-bottom: 1px solid var(--vp-c-divider); text-align: left; vertical-align: top; }
th { white-space: nowrap; }
.badge { padding: 2px 8px; border-radius: 10px; font-size: 12px; white-space: nowrap; }
.badge.green { background: var(--vp-c-green-soft); color: var(--vp-c-green-darker); }
.badge.yellow { background: var(--vp-c-yellow-soft); color: var(--vp-c-yellow-darker); }
.badge.red { background: var(--vp-c-red-soft); color: var(--vp-c-red-darker); }
.badge.gray { background: var(--vp-c-gray-soft); color: var(--vp-c-text-2); }
details summary { cursor: pointer; color: var(--vp-c-brand-1); font-size: 13px; }
details p { margin: 6px 0; font-size: 13px; }
</style>
