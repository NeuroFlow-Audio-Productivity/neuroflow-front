<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Select from 'primevue/select'

import type { Audio } from '@/types/audio'

const props = defineProps<{
  modelValue: number | null
  audios: Audio[]
  disabled?: boolean
  inputId?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: number | null]
}>()

const { t } = useI18n()

const options = computed(() =>
  props.audios
    .filter((audio) => audio.mode?.is_system === true || audio.mode?.name === 'Session Alarm')
    .map((audio) => ({
      label: audio.name,
      value: Number(audio.id),
    })),
)

const updateValue = (value: number | null) => {
  emit('update:modelValue', value === null ? null : Number(value))
}
</script>

<template>
  <Select
    :input-id="inputId"
    :model-value="modelValue"
    :options="options"
    option-label="label"
    option-value="value"
    class="flow-builder-select"
    :disabled="disabled || options.length === 0"
    :placeholder="t('flowResource.builder.alarmPlaceholder')"
    :pt="{
      overlay: { class: 'flow-builder-select-overlay' },
      list: { class: 'flow-builder-select-list' },
      option: { class: 'flow-builder-select-option' },
    }"
    @update:model-value="updateValue"
  />
</template>

<style scoped>
.flow-builder-select {
  width: 100%;
  border-color: rgba(var(--theme-text-rgb), 0.12) !important;
  border-radius: 8px !important;
  background: rgba(var(--theme-text-rgb), 0.06) !important;
  color: rgb(var(--theme-text-rgb)) !important;
}

:deep(.p-select-label),
:deep(.p-select-dropdown) {
  color: rgb(var(--theme-text-rgb)) !important;
}

:deep(.p-select-label) {
  background: transparent !important;
}

:deep(.p-select-overlay),
:deep(.p-select-list) {
  border-color: rgba(var(--theme-text-rgb), 0.12) !important;
  background: #101a18 !important;
  color: rgb(var(--theme-text-rgb)) !important;
}

:deep(.p-select-option) {
  color: rgb(var(--theme-text-rgb)) !important;
}

:deep(.p-select-option.p-focus),
:deep(.p-select-option:hover) {
  background: rgba(var(--mode-glow-rgb), 0.12) !important;
}

.flow-builder-select:not(.p-disabled):hover {
  border-color: rgba(var(--mode-glow-rgb), 0.42) !important;
}

:global(.flow-builder-select-overlay) {
  border: 1px solid rgba(var(--theme-text-rgb), 0.12) !important;
  border-radius: 8px !important;
  background: #101a18 !important;
  color: rgb(var(--theme-text-rgb)) !important;
  box-shadow: 0 22px 70px rgba(var(--theme-shadow-rgb), 0.42) !important;
}

:global(.flow-builder-select-list) {
  background: #101a18 !important;
  color: rgb(var(--theme-text-rgb)) !important;
}

:global(.flow-builder-select-option) {
  color: rgb(var(--theme-text-rgb)) !important;
}

:global(.flow-builder-select-option.p-focus),
:global(.flow-builder-select-option:hover) {
  background: rgba(var(--mode-glow-rgb), 0.12) !important;
  color: rgb(var(--theme-text-rgb)) !important;
}
</style>
