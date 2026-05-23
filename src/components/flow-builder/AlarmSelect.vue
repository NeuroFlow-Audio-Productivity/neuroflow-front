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
    @update:model-value="updateValue"
  />
</template>

<style scoped>
.flow-builder-select {
  width: 100%;
}

:deep(.p-select) {
  border-color: rgba(255, 255, 255, 0.12) !important;
  border-radius: 8px !important;
  background: rgba(255, 255, 255, 0.06) !important;
  color: #f7fbf8 !important;
}

:deep(.p-select:not(.p-disabled):hover) {
  border-color: rgba(var(--mode-glow-rgb), 0.42) !important;
}
</style>
