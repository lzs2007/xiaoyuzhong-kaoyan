import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import {
  comparisonKey,
  comparisonLimit,
  comparisonStorageKey,
  makeComparison,
  mergeComparisonCandidates,
  resolveComparison,
  restoreComparisons,
} from '../../data/majorComparison'
import type { ComparisonSelection } from '../../data/majorComparison'
import { parseFilters, serializeFilters } from '../../data/majorSearch'
import type { SearchFilters, SearchMajor } from '../../data/majorSearch'
import {
  pageStateUrl,
  parseSharedComparisons,
  sharePageUrl,
} from '../../data/majorShare'

/** URL回放不写本机；只有本机编辑和明确确认保存可以触发持久化。 */
export function useComparisonSharing(filters: SearchFilters) {
  const localSelections = ref<ComparisonSelection[]>([])
  const preview = ref<ComparisonSelection[] | null>(null)
  const shared = computed(() => preview.value !== null)
  const selections = computed(() => preview.value ?? localSelections.value)
  const selectedItems = computed(() =>
    selections.value.flatMap((s) => {
      const item = resolveComparison(s)
      return item ? [item] : []
    }),
  )
  const onlyDiff = ref(false)
  const storageFailed = ref(false)
  const notice = ref('')
  const copyStatus = ref('')
  const fallbackLink = ref('')
  function clearCopyFeedback() {
    copyStatus.value = ''
    fallbackLink.value = ''
  }
  const mergeState = ref<{
    candidates: ComparisonSelection[]
    signature: string
  } | null>(null)
  const mergeKeys = ref<string[]>([])
  const mergeOptions = computed(() =>
    (mergeState.value?.candidates ?? []).flatMap((s) => {
      const item = resolveComparison(s)
      return item ? [item] : []
    }),
  )
  let ready = false
  let lastFilters = serializeFilters(filters)
  const signature = (items: ComparisonSelection[]) =>
    JSON.stringify(items.map(comparisonKey))

  function readLocal() {
    try {
      const items = restoreComparisons(
        window.localStorage.getItem(comparisonStorageKey),
      )
      storageFailed.value = false
      return items
    } catch {
      storageFailed.value = true
      return null
    }
  }
  function persist(items: ComparisonSelection[]) {
    try {
      window.localStorage.setItem(
        comparisonStorageKey,
        JSON.stringify({ version: 1, items }),
      )
      storageFailed.value = false
      return true
    } catch {
      storageFailed.value = true
      return false
    }
  }
  function updateUrl(method: 'pushState' | 'replaceState') {
    if (!ready) return
    const next = pageStateUrl(
      window.location.href,
      filters,
      preview.value,
      onlyDiff.value,
    )
    if (next.href !== window.location.href)
      window.history[method]({}, '', next.href)
  }
  function cancelMerge() {
    mergeState.value = null
    mergeKeys.value = []
  }
  function setSelections(items: ComparisonSelection[]) {
    cancelMerge()
    copyStatus.value = ''
    fallbackLink.value = ''
    if (shared.value) preview.value = items
    else {
      localSelections.value = items
      persist(items)
    }
    updateUrl('replaceState')
  }
  function clearComparisons() {
    setSelections([])
  }
  function removeSelection(key: string) {
    setSelections(selections.value.filter((s) => comparisonKey(s) !== key))
  }
  function isSelected(entry: SearchMajor) {
    const key = comparisonKey(makeComparison(entry, filters))
    return selections.value.some((s) => comparisonKey(s) === key)
  }
  function toggleComparison(entry: SearchMajor) {
    if (isSelected(entry))
      removeSelection(comparisonKey(makeComparison(entry, filters)))
    else if (selections.value.length < comparisonLimit)
      setSelections([...selections.value, makeComparison(entry, filters)])
  }
  function restore() {
    ready = false
    const local = readLocal()
    if (local) localSelections.value = local
    Object.assign(filters, parseFilters(window.location.search))
    lastFilters = serializeFilters(filters)
    const params = new URLSearchParams(window.location.search)
    const parsed = parseSharedComparisons(params)
    preview.value = parsed.present ? parsed.items : null
    onlyDiff.value =
      params.getAll('diff').length === 1 && params.get('diff') === '1'
    notice.value = parsed.notice
    copyStatus.value = ''
    fallbackLink.value = ''
    cancelMerge()
    ready = true
  }
  function returnToLocal() {
    const latest = readLocal()
    if (latest) localSelections.value = latest
    preview.value = null
    notice.value = ''
    copyStatus.value = ''
    fallbackLink.value = ''
    cancelMerge()
    updateUrl('pushState')
  }
  async function copyLink(compare: boolean) {
    fallbackLink.value = ''
    copyStatus.value = ''
    let link: string
    try {
      link = sharePageUrl(
        window.location.href,
        filters,
        compare ? selections.value : null,
        onlyDiff.value,
      )
    } catch (error) {
      copyStatus.value =
        error instanceof Error ? error.message : '无法生成分享链接。'
      return
    }
    try {
      if (!navigator.clipboard?.writeText)
        throw new Error('clipboard unavailable')
      await navigator.clipboard.writeText(link)
      copyStatus.value = compare ? '对比链接已复制。' : '筛选链接已复制。'
    } catch {
      fallbackLink.value = link
      copyStatus.value = '暂时无法自动复制，请选中下方链接手动复制。'
    }
  }
  function saveItems(items: ComparisonSelection[]) {
    if (!persist(items)) {
      notice.value = '无法保存到本机，分享预览仍然保留，请检查浏览器存储设置。'
      return
    }
    localSelections.value = items
    cancelMerge()
    notice.value = '已保存到本机；后续修改分享预览仍需再次保存。'
  }
  function saveToLocal() {
    if (!shared.value || !selections.value.length) return
    const local = readLocal()
    if (!local) {
      notice.value = '无法读取本机清单，未执行合并。分享预览仍然保留。'
      return
    }
    localSelections.value = local
    const candidates = mergeComparisonCandidates(local, selections.value)
    if (candidates.length <= comparisonLimit) saveItems(candidates)
    else {
      mergeState.value = { candidates, signature: signature(local) }
      mergeKeys.value = local.map(comparisonKey)
      notice.value = '合并后超过4项，请明确选择要保留到本机的项目，再确认保存。'
    }
  }
  function confirmMerge() {
    const state = mergeState.value
    if (
      !state ||
      !mergeKeys.value.length ||
      mergeKeys.value.length > comparisonLimit
    )
      return
    const local = readLocal()
    if (!local) {
      notice.value = '无法读取本机清单，未执行保存。'
      return
    }
    if (signature(local) !== state.signature) {
      localSelections.value = local
      cancelMerge()
      notice.value = '本机清单已变化，请重新点击保存到本机。'
      return
    }
    const items = state.candidates.filter((s) =>
      mergeKeys.value.includes(comparisonKey(s)),
    )
    if (items.length && items.length <= comparisonLimit) saveItems(items)
  }
  function storageChanged(event: StorageEvent) {
    if (event.key !== null && event.key !== comparisonStorageKey) return
    const local = readLocal()
    if (local) localSelections.value = local
    if (mergeState.value) {
      cancelMerge()
      notice.value = '本机清单已在其他页面变化，请重新点击保存到本机。'
    }
  }
  watch(
    filters,
    () => {
      const next = serializeFilters(filters)
      if (!ready || next === lastFilters) return
      lastFilters = next
      updateUrl('pushState')
    },
    { flush: 'post' },
  )
  watch(onlyDiff, () => updateUrl('replaceState'), { flush: 'sync' })
  onMounted(() => {
    restore()
    window.addEventListener('popstate', restore)
    window.addEventListener('storage', storageChanged)
  })
  onUnmounted(() => {
    window.removeEventListener('popstate', restore)
    window.removeEventListener('storage', storageChanged)
  })
  return {
    selections,
    selectedItems,
    shared,
    onlyDiff,
    storageFailed,
    notice,
    copyStatus,
    fallbackLink,
    mergeState,
    mergeKeys,
    mergeOptions,
    cancelMerge,
    confirmMerge,
    saveToLocal,
    returnToLocal,
    copyLink,
    clearCopyFeedback,
    isSelected,
    toggleComparison,
    removeSelection,
    clearComparisons,
  }
}
