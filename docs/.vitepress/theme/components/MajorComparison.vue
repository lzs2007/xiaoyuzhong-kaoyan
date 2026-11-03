<script setup lang="ts">
import { withBase } from 'vitepress'
import { nextTick, ref } from 'vue'
import {
  comparisonKey,
  groupComparisonDirections,
} from '../../data/majorComparison'
import type { ResolvedComparison } from '../../data/majorComparison'
defineProps<{ items: ResolvedComparison[]; storageFailed: boolean }>()
defineEmits<{ remove: [key: string]; clear: []; export: [] }>()
const panel = ref<HTMLElement | null>(null)
const expanded = ref(false)
defineExpose({
  async show() {
    expanded.value = true
    await nextTick()
    panel.value?.focus({ preventScroll: true })
    panel.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  },
})
</script>

<template>
  <section
    v-if="items.length"
    ref="panel"
    class="comparison"
    aria-label="选校对比"
    tabindex="-1"
  >
    <div class="comparison-header">
      <strong>已选对比（{{ items.length }}/4）</strong>
      <div>
        <button type="button" @click="$emit('export')">导出对比 CSV</button>
        <button type="button" @click="$emit('clear')">清空对比</button>
      </div>
    </div>
    <p class="save-note" role="status">
      {{
        storageFailed
          ? '当前浏览器无法保存，对比仅在本次页面停留期间保留。'
          : '对比保存在当前浏览器；切换筛选不清空，恢复时按当前目录重新核验。'
      }}
      年度、语种和学习方式以加入时为准。
    </p>
    <details
      :open="expanded"
      @toggle="expanded = ($event.target as HTMLDetailsElement).open"
    >
      <summary>展开对比：初试科目、可选方向与限制</summary>
      <div class="comparison-grid">
        <article
          v-for="item in items"
          :key="comparisonKey(item.selection)"
          class="comparison-card"
        >
          <h3>{{ item.entry.university }}</h3>
          <p>
            {{ item.entry.code }} {{ item.entry.name }} ·
            {{ item.entry.degree }}
          </p>
          <dl>
            <dt>报考口径</dt>
            <dd>
              <strong
                >{{ item.entry.year }} ·
                {{
                  item.selection.language === '202' ? '202俄语' : '203日语'
                }}</strong
              ><br />{{ item.selection.mode || '全部可选学习方式' }} ·
              {{ item.entry.plan }}<br />{{ item.entry.college }}
            </dd>
            <dt>可选方向与初试科目</dt>
            <dd>
              <ul>
                <li
                  v-for="(group, i) in groupComparisonDirections(
                    item.directions,
                  )"
                  :key="i"
                >
                  <strong>{{ group.names.join('；') }}</strong> ·
                  {{ group.mode }}
                  <p>{{ group.subjects }}</p>
                  <p>外国语：{{ group.foreign }}</p>
                </li>
              </ul>
            </dd>
            <dt>方向限制与报考提醒</dt>
            <dd>
              <ul
                v-if="
                  item.entry.directions.some(
                    (d) => !d.languages.includes(item.selection.language),
                  )
                "
              >
                <li
                  v-for="(d, i) in item.entry.directions.filter(
                    (d) => !d.languages.includes(item.selection.language),
                  )"
                  :key="i"
                >
                  {{ d.name }}：{{ d.foreignOriginal }}
                </li>
              </ul>
              <p>{{ item.entry.countBasis }}</p>
              <p>
                语种可选不代表满足全部报考条件，请核对专项、校区与复试要求。
              </p>
            </dd>
            <dt>官方依据</dt>
            <dd>
              <a :href="withBase(item.entry.detailUrl)">查看对应专业 →</a><br />
              <a
                :href="item.entry.source.attachmentUrl || item.entry.source.url"
                target="_blank"
                rel="noopener noreferrer"
                >官方目录原件 ↗</a
              >
              <p>
                {{ item.entry.source.status }} ·
                {{ item.entry.source.collectedAt }}
              </p>
            </dd>
          </dl>
          <button
            type="button"
            :aria-label="`移除对比 ${item.entry.university} ${item.entry.code} ${item.entry.year} ${item.selection.language} ${item.selection.mode || '全部方式'}`"
            @click="$emit('remove', comparisonKey(item.selection))"
          >
            移除对比
          </button>
        </article>
      </div>
    </details>
  </section>
</template>

<style scoped>
.comparison {
  margin: 20px 0;
  padding: 16px;
  border: 1px solid var(--vp-c-brand-1);
  border-radius: 10px;
  background: var(--vp-c-bg-soft);
  scroll-margin-top: 112px;
}
.comparison-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
}
.comparison-header div {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.save-note {
  font-size: 13px;
  color: var(--vp-c-text-2);
}
summary {
  cursor: pointer;
  color: var(--vp-c-brand-1);
}
.comparison-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-top: 16px;
}
.comparison-card {
  padding: 16px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg);
  overflow-wrap: anywhere;
  min-width: 0;
}
h3 {
  margin: 0 0 8px;
  font-size: 17px;
}
p,
dl,
ul {
  font-size: 13px;
  margin: 8px 0;
}
dt {
  margin-top: 16px;
  font-size: 13px;
  font-weight: 600;
  color: var(--vp-c-text-2);
}
dd {
  margin: 6px 0 0;
}
ul {
  padding-left: 18px;
}
button {
  font: inherit;
  font-size: 13px;
  padding: 8px 12px;
  min-height: 42px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  background: var(--vp-c-bg);
  color: var(--vp-c-brand-1);
  cursor: pointer;
}
:is(button, summary, a):focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: 3px;
}
@media (max-width: 760px) {
  .comparison-grid {
    grid-template-columns: 1fr;
  }
}
</style>
