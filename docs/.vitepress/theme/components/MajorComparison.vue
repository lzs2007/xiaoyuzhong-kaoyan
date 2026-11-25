<script setup lang="ts">
import { withBase } from 'vitepress'
import { computed, nextTick, ref, watch } from 'vue'
import {
  comparisonKey,
  comparisonRows,
  differingComparisonFields,
} from '../../data/majorComparison'
import type { ResolvedComparison } from '../../data/majorComparison'
const props = defineProps<{
  items: ResolvedComparison[]
  storageFailed: boolean
  shared: boolean
  onlyDiff: boolean
  notice: string
}>()
const emit = defineEmits<{
  remove: [key: string]
  clear: []
  export: []
  copy: []
  save: []
  local: []
  'update:onlyDiff': [value: boolean]
}>()
const panel = ref<HTMLElement | null>(null)
const expanded = ref(false)
const different = computed(() => differingComparisonFields(props.items))
const effectiveDiff = computed(() => props.onlyDiff && props.items.length >= 2)
const cards = computed(() =>
  props.items.map((item) => ({
    item,
    rows: comparisonRows(item).filter(
      (row) => !effectiveDiff.value || different.value.has(row.key),
    ),
  })),
)
watch(
  () => props.shared,
  (value) => {
    if (value) expanded.value = true
  },
)
function changeDiff(event: Event) {
  emit('update:onlyDiff', (event.target as HTMLInputElement).checked)
  expanded.value = true
}
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
    v-if="items.length || shared"
    ref="panel"
    class="comparison"
    aria-label="选校对比"
    tabindex="-1"
  >
    <div class="comparison-header">
      <strong
        >{{ shared ? '分享预览' : '已选对比' }}（{{ items.length }}/4）</strong
      >
      <div>
        <button type="button" :disabled="!items.length" @click="$emit('copy')">
          复制对比链接
        </button>
        <button
          v-if="shared"
          type="button"
          :disabled="!items.length"
          @click="$emit('save')"
        >
          保存到本机
        </button>
        <button v-if="shared" type="button" @click="$emit('local')">
          返回本机清单
        </button>
        <button
          type="button"
          :disabled="!items.length"
          @click="$emit('export')"
        >
          导出对比 CSV
        </button>
        <button type="button" :disabled="!items.length" @click="$emit('clear')">
          清空对比
        </button>
      </div>
    </div>
    <p class="save-note" role="status">
      <template v-if="shared"
        >正在查看链接分享的清单；修改预览不会自动覆盖本机清单，需点击“保存到本机”。</template
      >
      <template v-else>{{
        storageFailed
          ? '当前浏览器无法保存，对比仅在本次页面停留期间保留。'
          : '对比保存在当前浏览器；切换筛选不清空，恢复时按当前目录重新核验。'
      }}</template>
      年度、语种和学习方式以加入时为准；链接按当前数据核验，不是历史科目快照。
    </p>
    <p v-if="notice" class="share-notice" role="status">{{ notice }}</p>
    <slot name="save-options" />
    <p v-if="!items.length" role="status">
      链接中没有可显示的有效对比项。本机清单仍保留，可返回查看，或从查询结果重新选择。
    </p>
    <div class="diff-tools">
      <label
        ><input
          type="checkbox"
          role="switch"
          :checked="onlyDiff"
          :disabled="items.length < 2"
          aria-describedby="comparison-diff-help"
          @change="changeDiff"
        />仅看差异项</label
      >
      <span id="comparison-diff-help">{{
        items.length < 2
          ? '至少选择2项后可用。'
          : '相同字段折叠；缺失信息、院校身份、来源及报考提醒保留。CSV始终完整导出。'
      }}</span>
    </div>
    <details
      v-if="items.length"
      :open="expanded"
      @toggle="expanded = ($event.target as HTMLDetailsElement).open"
    >
      <summary>展开对比：初试科目、可选方向与限制</summary>
      <p v-if="effectiveDiff && !different.size" role="status">
        所比较字段一致，已保留院校身份、官方依据和报考提醒。
      </p>
      <div class="comparison-grid">
        <article
          v-for="{ item, rows } in cards"
          :key="comparisonKey(item.selection)"
          class="comparison-card"
        >
          <h3>{{ item.entry.university }}</h3>
          <p>{{ item.entry.code }} {{ item.entry.name }}</p>
          <dl>
            <template v-for="row in rows" :key="row.key">
              <dt :data-field="row.key">{{ row.label }}</dt>
              <dd :data-field="row.key">
                <ul>
                  <li v-for="(value, i) in row.values" :key="i">{{ value }}</li>
                </ul>
              </dd>
            </template>
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
          <p class="comparison-reminder">
            语种可选不代表满足全部报考条件，请核对专项、校区与复试要求。
          </p>
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
.diff-tools {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  margin: 16px 0;
}
.diff-tools label {
  display: flex;
  gap: 8px;
  align-items: center;
  min-height: 44px;
  font-size: 14px;
  cursor: pointer;
}
.diff-tools input {
  width: 18px;
  height: 18px;
}
.diff-tools span,
.share-notice {
  font-size: 13px;
  overflow-wrap: anywhere;
}
.diff-tools span {
  color: var(--vp-c-text-2);
}
button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
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
