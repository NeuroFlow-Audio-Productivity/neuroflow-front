<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'

import type { PaginationMeta } from '@/types/pagination'

const props = defineProps<{
  meta: PaginationMeta | null
  loading?: boolean
}>()

const emit = defineEmits<{
  pageChange: [page: number]
}>()

const { t } = useI18n()

const isVisible = computed(() => Boolean(props.meta && props.meta.total > 0))
const showPageButtons = computed(() => Boolean(props.meta && props.meta.lastPage > 1))

const pageNumbers = computed(() => {
  if (!props.meta) return []

  const maxPages = 5
  const start = Math.max(
    1,
    Math.min(props.meta.currentPage - Math.floor(maxPages / 2), props.meta.lastPage - maxPages + 1),
  )
  const end = Math.min(props.meta.lastPage, start + maxPages - 1)

  return Array.from({ length: end - start + 1 }, (_, index) => start + index)
})

const firstVisiblePage = computed(() => pageNumbers.value[0] ?? null)
const lastVisiblePage = computed(() => pageNumbers.value[pageNumbers.value.length - 1] ?? null)

const pageSummary = computed(() => {
  if (!props.meta) return ''

  return t('pagination.summary', {
    from: props.meta.from ?? 0,
    to: props.meta.to ?? 0,
    total: props.meta.total,
  })
})

const goToPage = (page: number) => {
  if (!props.meta || props.loading) return

  const nextPage = Math.min(props.meta.lastPage, Math.max(1, page))

  if (nextPage === props.meta.currentPage) return

  emit('pageChange', nextPage)
}
</script>

<template>
  <nav v-if="isVisible && meta" class="pagination-panel" :aria-label="t('pagination.label')">
    <p class="pagination-summary">{{ pageSummary }}</p>

    <div v-if="showPageButtons" class="pagination-actions">
      <Button
        icon="pi pi-chevron-left"
        text
        rounded
        class="pagination-icon-button"
        :disabled="loading || meta.currentPage <= 1"
        :aria-label="t('pagination.previous')"
        @click="goToPage(meta.currentPage - 1)"
      />

      <Button
        v-if="firstVisiblePage && firstVisiblePage > 1"
        label="1"
        text
        rounded
        class="pagination-page-button"
        :disabled="loading"
        :aria-label="t('pagination.page', { page: 1 })"
        @click="goToPage(1)"
      />
      <span v-if="firstVisiblePage && firstVisiblePage > 2" class="pagination-gap">...</span>

      <Button
        v-for="page in pageNumbers"
        :key="page"
        :label="String(page)"
        text
        rounded
        class="pagination-page-button"
        :class="{ 'pagination-page-button--active': page === meta.currentPage }"
        :disabled="loading"
        :aria-current="page === meta.currentPage ? 'page' : undefined"
        :aria-label="t('pagination.page', { page })"
        @click="goToPage(page)"
      />

      <span v-if="lastVisiblePage && lastVisiblePage < meta.lastPage - 1" class="pagination-gap">
        ...
      </span>
      <Button
        v-if="lastVisiblePage && lastVisiblePage < meta.lastPage"
        :label="String(meta.lastPage)"
        text
        rounded
        class="pagination-page-button"
        :disabled="loading"
        :aria-label="t('pagination.page', { page: meta.lastPage })"
        @click="goToPage(meta.lastPage)"
      />

      <Button
        icon="pi pi-chevron-right"
        text
        rounded
        class="pagination-icon-button"
        :disabled="loading || meta.currentPage >= meta.lastPage"
        :aria-label="t('pagination.next')"
        @click="goToPage(meta.currentPage + 1)"
      />
    </div>
  </nav>
</template>

<style scoped>
.pagination-panel {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  border: 1px solid rgba(var(--theme-text-rgb), 0.12);
  border-radius: 8px;
  background:
    linear-gradient(110deg, rgba(var(--mode-glow-rgb), 0.12), transparent 38%),
    rgba(var(--theme-surface-rgb), 0.82);
  padding: 0.75rem;
  box-shadow: 0 18px 58px rgba(var(--theme-shadow-rgb), 0.22);
  backdrop-filter: blur(18px);
}

.pagination-summary {
  margin: 0;
  color: rgba(var(--theme-text-rgb), 0.62);
  font-size: 0.875rem;
  font-weight: 700;
  line-height: 1.3;
}

.pagination-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 0.35rem;
}

.pagination-page-button,
.pagination-icon-button {
  width: 2.35rem;
  height: 2.35rem;
  flex: 0 0 auto;
  border: 1px solid rgba(var(--theme-text-rgb), 0.12) !important;
  background: rgba(var(--theme-text-rgb), 0.055) !important;
  color: rgba(var(--theme-text-rgb), 0.74) !important;
  font-weight: 800 !important;
}

.pagination-page-button:hover,
.pagination-icon-button:hover {
  border-color: color-mix(in srgb, var(--mode-accent), transparent 54%) !important;
  background: color-mix(in srgb, var(--mode-accent), transparent 88%) !important;
  color: var(--mode-soft) !important;
}

.pagination-page-button--active,
.pagination-page-button--active:hover {
  border-color: transparent !important;
  background: var(--mode-accent) !important;
  color: var(--mode-ink) !important;
}

.pagination-gap {
  display: inline-flex;
  min-width: 1.4rem;
  justify-content: center;
  color: rgba(var(--theme-text-rgb), 0.42);
  font-size: 0.9rem;
  font-weight: 800;
}

@media (max-width: 640px) {
  .pagination-panel {
    align-items: stretch;
    flex-direction: column;
  }

  .pagination-actions {
    justify-content: flex-start;
  }
}
</style>
