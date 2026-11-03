<script setup lang="ts">
import { onMounted, onUnmounted, ref, nextTick } from 'vue'
import { withBase } from 'vitepress'
import {
  collectedEngineering,
  catalogSources,
} from '../../data/collectedEngineering'
const targetId = ref('')
async function reveal() {
  targetId.value = window.location.hash.slice(1)
  await nextTick()
  const target = document.getElementById(targetId.value)
  const detail = target?.querySelector('details')
  if (detail) detail.open = true
  target?.scrollIntoView({ block: 'start' })
  target?.focus({ preventScroll: true })
}
onMounted(() => {
  reveal()
  window.addEventListener('hashchange', reveal)
})
onUnmounted(() => window.removeEventListener('hashchange', reveal))
</script>

<template>
  <div class="catalog-ledger">
    <p>
      本批核验
      {{ new Set(catalogSources.map((s) => s.schoolId)).size }} 所院校、{{
        collectedEngineering.length
      }}
      个专业项。既记录可选语种，也记录已核验的仅英语或仅日语限制；无可选202方向的项目不会进入俄语查询结果。
    </p>
    <p><a :href="withBase('/schools/find')">← 返回按专业找院校</a></p>
    <details class="source-list">
      <summary>官方来源与采集范围（2026-11-03）</summary>
      <ul>
        <li v-for="source in catalogSources" :key="source.id">
          <a :href="source.url" target="_blank" rel="noopener noreferrer"
            >{{ source.university }} · {{ source.year }}</a
          >：{{ source.scope }}
        </li>
      </ul>
    </details>
    <section
      v-for="entry in collectedEngineering"
      :id="entry.id"
      :key="entry.id"
      :class="{ targeted: targetId === entry.id }"
      tabindex="-1"
    >
      <h2>{{ entry.university }} · {{ entry.code }} {{ entry.name }}</h2>
      <p>
        {{ entry.year }}招生年度 · {{ entry.college }} · {{ entry.degree }} ·
        {{ entry.plan }}
      </p>
      <p class="conclusion">
        <strong>{{
          entry.directions.some((d) => d.languages.includes('202'))
            ? '部分或全部所列方向可选202俄语'
            : '本条所列方向未接受202俄语'
        }}</strong>
      </p>
      <details>
        <summary>展开逐方向科目、限制和原文定位</summary>
        <ul>
          <li v-for="(d, i) in entry.directions" :key="i">
            <strong>{{ d.name }}</strong>
            <p>学习方式：{{ d.mode }}；外国语：{{ d.foreignOriginal }}</p>
            <p>初试科目：{{ d.subjectsOriginal }}</p>
            <p v-if="d.countOriginal">
              目录人数原文：{{ d.countOriginal }}（合并计划不按方向重复求和）
            </p>
            <p>原件定位：{{ d.locator }}</p>
          </li>
        </ul>
        <p>{{ entry.countBasis }}</p>
        <p>
          采集日期：{{ entry.source.collectedAt }} · {{ entry.source.status }}
        </p>
        <p>
          <a :href="entry.source.url" target="_blank" rel="noopener noreferrer"
            >官方发布页 ↗</a
          >
          ·
          <a
            :href="entry.source.attachmentUrl"
            target="_blank"
            rel="noopener noreferrer"
            >官方目录原件 ↗</a
          >
        </p>
        <a
          :href="
            withBase(
              `/schools/find?year=${entry.year}&school=${entry.schoolId}&keyword=${entry.code}`,
            )
          "
          >查询本校此专业 →</a
        >
      </details>
    </section>
  </div>
</template>
<style scoped>
section {
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  padding: 18px;
  margin: 18px 0;
  scroll-margin-top: 90px;
}
section.targeted {
  border-color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
}
h2 {
  margin: 0;
  padding: 0;
  border: 0;
  font-size: 18px;
}
p,
li {
  font-size: 14px;
  overflow-wrap: anywhere;
}
summary {
  cursor: pointer;
  color: var(--vp-c-brand-1);
}
.conclusion {
  color: var(--vp-c-text-1);
}
section:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: 3px;
}
</style>
