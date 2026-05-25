<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Select from 'primevue/select'

import { isUserMode, modeSemanticKey } from '@/services/modeVisuals'
import type { Mode } from '@/types/mode'

const props = defineProps<{
  modelValue: number | null
  modes: Mode[]
  disabled?: boolean
  inputId?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: number | null]
}>()

const { t } = useI18n()

const modeLabel = (mode: Mode) => {
  const key = modeSemanticKey(mode)

  return key ? t('modes.' + key + '.label') : mode.name
}

const options = computed(() =>
  props.modes.filter(isUserMode).map((mode) => ({
    label: modeLabel(mode),
    value: mode.id,
    color: mode.color,
  })),
)

const selectedOption = computed(
  () => options.value.find((option) => option.value === props.modelValue) ?? null,
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
    :placeholder="t('flowResource.builder.modePlaceholder')"
    :pt="{
      overlay: { class: 'flow-builder-select-overlay' },
      list: { class: 'flow-builder-select-list' },
      option: { class: 'flow-builder-select-option' },
    }"
    @update:model-value="updateValue"
  >
    <template #value="slotProps">
      <span v-if="selectedOption" class="flow-select-value">
        <span
          class="flow-select-dot"
          :style="{ backgroundColor: selectedOption.color }"
          aria-hidden="true"
        />
        {{ selectedOption.label }}
      </span>
      <span v-else>{{ slotProps.placeholder }}</span>
    </template>

    <template #option="slotProps">
      <span class="flow-select-value">
        <span
          class="flow-select-dot"
          :style="{ backgroundColor: slotProps.option.color }"
          aria-hidden="true"
        />
        {{ slotProps.option.label }}
      </span>
    </template>
  </Select>
</template>

<style scoped>
.flow-builder-select {
  width: 100%;
  border-color: rgba(255, 255, 255, 0.12) !important;
  border-radius: 8px !important;
  background: rgba(255, 255, 255, 0.06) !important;
  color: #f7fbf8 !important;
}

:deep(.p-select-label),
:deep(.p-select-dropdown) {
  color: #f7fbf8 !important;
}

:deep(.p-select-label) {
  background: transparent !important;
}

:deep(.p-select-overlay),
:deep(.p-select-list) {
  border-color: rgba(255, 255, 255, 0.12) !important;
  background: #101a18 !important;
  color: #f7fbf8 !important;
}

:deep(.p-select-option) {
  color: #f7fbf8 !important;
}

:deep(.p-select-option.p-focus),
:deep(.p-select-option:hover) {
  background: rgba(var(--mode-glow-rgb), 0.12) !important;
}

.flow-builder-select:not(.p-disabled):hover {
  border-color: rgba(var(--mode-glow-rgb), 0.42) !important;
}

.flow-select-value {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 0.5rem;
}

.flow-select-dot {
  width: 0.65rem;
  height: 0.65rem;
  flex: 0 0 auto;
  border-radius: 999px;
  box-shadow: 0 0 1rem currentColor;
}

:global(.flow-builder-select-overlay) {
  border: 1px solid rgba(255, 255, 255, 0.12) !important;
  border-radius: 8px !important;
  background: #101a18 !important;
  color: #f7fbf8 !important;
  box-shadow: 0 22px 70px rgba(0, 0, 0, 0.42) !important;
}

:global(.flow-builder-select-list) {
  background: #101a18 !important;
  color: #f7fbf8 !important;
}

:global(.flow-builder-select-option) {
  color: #f7fbf8 !important;
}

:global(.flow-builder-select-option.p-focus),
:global(.flow-builder-select-option:hover) {
  background: rgba(var(--mode-glow-rgb), 0.12) !important;
  color: #ffffff !important;
}
</style>
