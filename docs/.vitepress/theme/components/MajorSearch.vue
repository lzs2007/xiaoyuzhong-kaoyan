<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { withBase } from 'vitepress'
import {
  coverage,
  defaults,
  filterMajors,
  matchingDirections,
  parseFilters,
  searchMajors,
  serializeFilters,
} from '../../data/majorSearch'
const filters = reactive({ ...defaults })
const ready = ref(false)
const yearEntries = computed(() =>
  searchMajors.filter((e) => e.year === filters.year),
)
const options = computed(() => ({
  province: [...new Set(yearEntries.value.map((e) => e.province))],
  school: [
    ...new Map(
      yearEntries.value.map((e) => [e.schoolId, e.university]),
    ).entries(),
  ],
  degree: [...new Set(yearEntries.value.map((e) => e.degree).filter(Boolean))],
  mode: [
    ...new Set(
      yearEntries.value.flatMap((e) => e.directions.map((d) => d.mode)),
    ),
  ].filter((m) => m !== '待核实'),
}))
const results = computed(() => filterMajors(searchMajors, filters))
const schoolsCount = computed(
  () => new Set(results.value.map((e) => e.schoolId)).size,
)
function restore() {
  Object.assign(filters, parseFilters(window.location.search))
}
function clear() {
  Object.assign(filters, {
    ...defaults,
    year: filters.year,
    language: filters.language,
  })
}
function changeYear() {
  filters.province = ''
  filters.school = ''
  filters.degree = ''
  filters.mode = ''
}
function historical() {
  filters.year = '2026'
  changeYear()
}
watch(
  filters,
  () => {
    if (!ready.value) return
    const next =
      window.location.pathname +
      serializeFilters(filters) +
      window.location.hash
    if (
      next !==
      window.location.pathname + window.location.search + window.location.hash
    )
      window.history.pushState({}, '', next)
  },
  { flush: 'post' },
)
onMounted(() => {
  restore()
  ready.value = true
  window.addEventListener('popstate', restore)
})
onUnmounted(() => window.removeEventListener('popstate', restore))
</script>

<template>
  <div class="major-search">
    <form
      class="search-panel"
      role="search"
      aria-label="按专业选择院校"
      @submit.prevent
    >
      <div class="primary-filters">
        <label
          >招生年度<select
            aria-label="招生年度"
            v-model="filters.year"
            @change="changeYear"
          >
            <option value="2027">2027</option>
            <option value="2026">2026（历史）</option>
          </select></label
        >
        <label
          >初试外国语<select aria-label="初试外国语" v-model="filters.language">
            <option value="202">202 俄语</option>
            <option value="203">203 日语</option>
          </select></label
        >
        <label class="keyword"
          >目标专业<input
            v-model="filters.keyword"
            type="search"
            placeholder="专业名称或代码，如机械、0855"
        /></label>
      </div>
      <div class="secondary-filters">
        <label
          >省份<select aria-label="省份" v-model="filters.province">
            <option value="">全部省份</option>
            <option v-for="p in options.province" :key="p">{{ p }}</option>
          </select></label
        >
        <label
          >院校<select aria-label="院校" v-model="filters.school">
            <option value="">全部院校</option>
            <option v-for="[id, name] in options.school" :key="id" :value="id">
              {{ name }}
            </option>
          </select></label
        >
        <label
          >学位<select aria-label="学位" v-model="filters.degree">
            <option value="">全部学位</option>
            <option v-for="d in options.degree" :key="d">{{ d }}</option>
          </select></label
        >
        <label
          >学习方式<select aria-label="学习方式" v-model="filters.mode">
            <option value="">全部方式</option>
            <option v-for="m in options.mode" :key="m">{{ m }}</option>
          </select></label
        >
        <button type="button" @click="clear">清空筛选</button>
      </div>
    </form>
    <div v-if="filters.year === '2026'" class="notice historical" role="note">
      <strong>2026 历史数据</strong> ·
      不代表2027报考资格。专业数据沿用2026-09-12官方目录整理记录。
    </div>
    <div v-else class="notice" role="note">
      <strong>2027 数据待更新</strong> ·
      两校专业与方向尚未完成逐项核验，暂不计入匹配结果。
      <ul>
        <li v-for="school in coverage" :key="school.id">
          {{ school.name }}：{{ school.note }}
          <a :href="school.url" target="_blank" rel="noopener noreferrer"
            >官方目录入口 ↗</a
          >
        </li>
      </ul>
      <button type="button" @click="historical">切换到2026历史数据</button>
    </div>
    <p class="result-count" role="status" aria-live="polite">
      匹配 <strong>{{ schoolsCount }}</strong> 所院校 ·
      <strong>{{ results.length }}</strong> 个专业项<span
        >首批仅收录吉大、哈工程工学专业，非全国完整名单。</span
      >
    </p>
    <div v-if="!results.length" class="empty">
      <strong>当前收录范围内暂无匹配结果</strong>
      <p>
        未收录或待更新不等于不可报考。请调整专业名称、代码或筛选条件，并核对官方目录。
      </p>
    </div>
    <div v-else class="result-grid" role="table" aria-label="可选院校与专业">
      <div class="result-heading" role="row">
        <span role="columnheader">院校与专业</span
        ><span role="columnheader">可选范围与限制</span
        ><span role="columnheader">详情与依据</span>
      </div>
      <article
        v-for="entry in results"
        :key="entry.id"
        class="result-row"
        role="row"
      >
        <div role="cell">
          <h2>{{ entry.name }}</h2>
          <div class="code">{{ entry.code }} · {{ entry.degree }}</div>
          <p>
            {{ entry.university }} · {{ entry.province }}<br />{{
              entry.college
            }}
          </p>
          <p class="muted">计划：{{ entry.plan }}</p>
        </div>
        <div role="cell">
          <strong
            >可选
            {{ filters.language === '202' ? '202 俄语' : '203 日语' }}</strong
          >
          <ul>
            <li v-for="(d, i) in matchingDirections(entry, filters)" :key="i">
              {{ d.name
              }}<span class="muted">
                ·
                {{
                  d.mode === '待核实' ? '学习方式请核对原目录' : d.mode
                }}</span
              >
            </li>
          </ul>
          <p
            v-if="entry.directions.some((d) => d.restricted)"
            class="restriction"
          >
            注意：同一专业含仅英语方向，不能按整个专业报考。
          </p>
          <p v-if="entry.plan.includes('专项')" class="restriction">
            仅限符合该专项资格的考生。
          </p>
        </div>
        <div role="cell">
          <a :href="withBase(entry.detailUrl)">查看对应专业 →</a>
          <details>
            <summary>方向限制与官方依据</summary>
            <p>
              <strong>{{ entry.year }}招生年度</strong> ·
              {{ entry.source.status }}
            </p>
            <p>
              外国语原文：{{
                entry.directions.find((d) => !d.restricted)?.foreignOriginal
              }}
            </p>
            <template v-if="entry.directions.some((d) => d.restricted)"
              ><strong>仅英语方向</strong>
              <ul>
                <li
                  v-for="d in entry.directions.filter((d) => d.restricted)"
                  :key="d.name"
                >
                  {{ d.name }} · {{ d.foreignOriginal }}
                </li>
              </ul></template
            >
            <p v-if="entry.count">目录人数：{{ entry.count }}</p>
            <p>{{ entry.countBasis }}</p>
            <p>原目录定位：{{ entry.source.locator }}</p>
            <p>采集日期：{{ entry.source.collectedAt }}</p>
            <a
              :href="entry.source.url"
              target="_blank"
              rel="noopener noreferrer"
              >{{ entry.source.name }} ↗</a
            >
          </details>
        </div>
      </article>
    </div>
  </div>
</template>

<style scoped>
.search-panel {
  padding: 20px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  background: var(--vp-c-bg-soft);
}
.primary-filters,
.secondary-filters {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
  align-items: end;
}
.secondary-filters {
  margin-top: 16px;
}
label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
}
.keyword {
  flex: 1;
  min-width: 220px;
}
select,
input,
button {
  font: inherit;
  color: var(--vp-c-text-1);
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg);
  border-radius: 6px;
  padding: 9px 12px;
  min-height: 42px;
}
input {
  width: 100%;
}
button {
  cursor: pointer;
  color: var(--vp-c-brand-1);
}
button:hover {
  border-color: var(--vp-c-brand-1);
}
:is(input, select, button, summary, a):focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: 3px;
}
.notice {
  padding: 16px;
  margin: 20px 0;
  background: var(--vp-c-bg-soft);
  border-left: 4px solid var(--vp-c-brand-1);
  border-radius: 4px;
}
.historical {
  border-left-color: var(--vp-c-warning-1);
}
.result-count span {
  display: block;
  font-size: 13px;
  color: var(--vp-c-text-2);
}
.result-grid {
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  overflow: hidden;
}
.result-heading,
.result-row {
  display: grid;
  grid-template-columns: 1fr 1.4fr 1fr;
  gap: 20px;
  padding: 20px;
}
.result-heading {
  background: var(--vp-c-bg-soft);
  font-weight: 600;
  font-size: 14px;
}
.result-row + .result-row {
  border-top: 1px solid var(--vp-c-divider);
}
.result-row h2 {
  font-size: 18px;
  border: 0;
  margin: 0;
  padding: 0;
}
.result-row p {
  font-size: 13px;
  margin: 8px 0;
}
.result-row ul {
  font-size: 13px;
  padding-left: 18px;
  margin: 8px 0;
}
.code,
.muted {
  font-size: 13px;
  color: var(--vp-c-text-2);
}
.restriction {
  color: var(--vp-c-warning-1);
  font-weight: 600;
}
summary {
  cursor: pointer;
  color: var(--vp-c-brand-1);
  margin-top: 12px;
}
details {
  font-size: 13px;
  overflow-wrap: anywhere;
}
.empty {
  padding: 28px;
  text-align: center;
  background: var(--vp-c-bg-soft);
  border-radius: 10px;
}
.empty p {
  font-size: 14px;
}
article {
  scroll-margin-top: 90px;
}
@media (max-width: 760px) {
  .result-heading {
    display: none;
  }
  .result-row {
    grid-template-columns: 1fr;
    gap: 8px;
  }
  .keyword {
    min-width: 100%;
  }
  .secondary-filters label {
    flex: 1;
    min-width: 130px;
  }
  .search-panel {
    padding: 14px;
  }
  .result-row {
    padding: 16px;
  }
}
</style>
