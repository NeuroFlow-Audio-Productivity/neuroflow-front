<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import InputNumber from 'primevue/inputnumber'
import { useSortable } from '@dnd-kit/vue/sortable'

import AlarmSelect from '@/components/flow-builder/AlarmSelect.vue'
import ModeSelect from '@/components/flow-builder/ModeSelect.vue'
import type { Audio } from '@/types/audio'
import type { FlowNode } from '@/types/flow'
import type { Mode } from '@/types/mode'

const props = defineProps<{
  node: FlowNode
  index: number
  modes: Mode[]
  alarms: Audio[]
  saving?: boolean
  deleting?: boolean
  disabled?: boolean
}>()

const emit = defineEmits<{
  update: [node: FlowNode, patch: Partial<Pick<FlowNode, 'mode_id' | 'time' | 'end_audio_id'>>]
  delete: [node: FlowNode]
}>()

const { t } = useI18n()
const elementRef = ref<HTMLElement | null>(null)
const handleRef = ref<HTMLElement | null>(null)

const isInteractionDisabled = computed(() => Boolean(props.disabled || props.deleting))

const { isDragSource } = useSortable({
  id: computed(() => String(props.node.id)),
  index: computed(() => props.index),
  group: 'flow-nodes',
  element: elementRef,
  handle: handleRef,
  disabled: isInteractionDisabled,
})

const selectedMode = computed(
  () => props.node.mode ?? props.modes.find((mode) => mode.id === props.node.mode_id),
)

const cardTitle = computed(
  () =>
    selectedMode.value?.name ?? t('flowResource.builder.sectionTitle', { number: props.index + 1 }),
)

const updateMode = (modeId: number | null) => {
  if (modeId === null || modeId === props.node.mode_id) return

  emit('update', props.node, { mode_id: modeId })
}

const updateTime = (value: number | null) => {
  const time = Math.max(1, Math.round(Number(value) || 1))

  if (time === props.node.time) return

  emit('update', props.node, { time })
}

const updateAlarm = (audioId: number | null) => {
  if (audioId === props.node.end_audio_id) return

  emit('update', props.node, { end_audio_id: audioId })
}
</script>

<template>
  <article
    ref="elementRef"
    class="flow-node-card"
    :class="{ 'is-dragging': isDragSource, 'is-busy': saving || deleting }"
    :data-flow-node-id="node.id"
  >
    <button
      ref="handleRef"
      class="flow-node-handle"
      type="button"
      :aria-label="t('flowResource.builder.dragHandle')"
      :disabled="isInteractionDisabled"
    >
      <i class="pi pi-align-justify" aria-hidden="true" />
    </button>

    <div class="flow-node-main">
      <div class="flow-node-heading">
        <span class="flow-node-order">{{ String(index + 1).padStart(2, '0') }}</span>
        <h2>{{ cardTitle }}</h2>
        <span v-if="saving" class="flow-node-status">{{ t('flowResource.builder.saving') }}</span>
      </div>

      <div class="flow-node-fields">
        <div class="flow-node-field flow-node-field--mode">
          <label :for="'flow-node-mode-' + node.id">{{ t('flowResource.builder.mode') }}</label>
          <ModeSelect
            :input-id="'flow-node-mode-' + node.id"
            :model-value="node.mode_id"
            :modes="modes"
            :disabled="isInteractionDisabled || modes.length === 0"
            @update:model-value="updateMode"
          />
        </div>

        <div class="flow-node-field flow-node-field--time">
          <label :for="'flow-node-time-' + node.id">{{ t('flowResource.builder.duration') }}</label>
          <InputNumber
            :input-id="'flow-node-time-' + node.id"
            :model-value="node.time"
            :min="1"
            :max="1440"
            suffix=" min"
            :disabled="isInteractionDisabled"
            class="flow-time-input"
            @update:model-value="updateTime"
          />
        </div>

        <div class="flow-node-field flow-node-field--alarm">
          <label :for="'flow-node-alarm-' + node.id">{{
            t('flowResource.builder.endAlarm')
          }}</label>
          <AlarmSelect
            :input-id="'flow-node-alarm-' + node.id"
            :model-value="node.end_audio_id"
            :audios="alarms"
            :disabled="isInteractionDisabled"
            @update:model-value="updateAlarm"
          />
        </div>
      </div>
    </div>

    <Button
      icon="pi pi-trash"
      severity="danger"
      text
      rounded
      :loading="deleting"
      :disabled="isInteractionDisabled"
      :aria-label="t('flowResource.builder.deleteSection')"
      class="flow-node-delete hover:!bg-red-500/10"
      @click="emit('delete', node)"
    />
  </article>
</template>

<style scoped>
.flow-node-card {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 1rem;
  align-items: start;
  border: 1px solid rgba(255, 255, 255, 0.11);
  border-radius: 8px;
  background:
    linear-gradient(135deg, rgba(var(--mode-glow-rgb), 0.1), transparent 58%),
    rgba(255, 255, 255, 0.055);
  padding: clamp(0.9rem, 2vw, 1.1rem);
  box-shadow: 0 18px 60px rgba(0, 0, 0, 0.2);
  transition:
    border-color 160ms ease,
    background 160ms ease,
    box-shadow 180ms ease,
    opacity 160ms ease,
    transform 180ms ease;
  backdrop-filter: blur(18px);
}

.flow-node-card:hover,
.flow-node-card.is-dragging {
  border-color: rgba(var(--mode-glow-rgb), 0.34);
  background:
    linear-gradient(135deg, rgba(var(--mode-glow-rgb), 0.16), transparent 58%),
    rgba(255, 255, 255, 0.075);
}

.flow-node-card.is-dragging {
  opacity: 0.72;
  box-shadow: 0 28px 90px rgba(0, 0, 0, 0.34);
}

.flow-node-card.is-busy {
  opacity: 0.78;
}

.flow-node-handle {
  display: grid;
  width: 2.5rem;
  height: 2.5rem;
  place-items: center;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.64);
  cursor: grab;
  transition:
    border-color 160ms ease,
    background 160ms ease,
    color 160ms ease;
}

.flow-node-handle:hover {
  border-color: rgba(var(--mode-glow-rgb), 0.42);
  background: rgba(var(--mode-glow-rgb), 0.12);
  color: #ffffff;
}

.flow-node-handle:active {
  cursor: grabbing;
}

.flow-node-main {
  min-width: 0;
}

.flow-node-heading {
  display: flex;
  min-height: 2.5rem;
  align-items: center;
  gap: 0.7rem;
}

.flow-node-heading h2 {
  min-width: 0;
  margin: 0;
  color: #ffffff;
  font-size: 1rem;
  font-weight: 760;
  line-height: 1.2;
  overflow-wrap: anywhere;
}

.flow-node-order {
  flex: 0 0 auto;
  color: var(--mode-accent);
  font-size: 0.75rem;
  font-weight: 800;
  line-height: 1;
}

.flow-node-status {
  margin-left: auto;
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.75rem;
  font-weight: 700;
}

.flow-node-fields {
  display: grid;
  gap: 0.75rem;
  margin-top: 0.85rem;
}

.flow-node-field {
  display: grid;
  gap: 0.38rem;
}

.flow-node-field label {
  color: rgba(255, 255, 255, 0.54);
  font-size: 0.76rem;
  font-weight: 760;
  letter-spacing: 0;
}

.flow-node-delete {
  color: rgba(255, 255, 255, 0.62) !important;
}

:deep(.flow-time-input),
:deep(.flow-time-input .p-inputnumber-input) {
  width: 100%;
}

:deep(.flow-time-input .p-inputnumber-input) {
  min-height: 2.95rem;
  border-color: rgba(255, 255, 255, 0.12) !important;
  border-radius: 8px !important;
  background: rgba(255, 255, 255, 0.06) !important;
  color: #f7fbf8 !important;
}

:deep(.flow-time-input .p-inputnumber-input:hover) {
  border-color: rgba(var(--mode-glow-rgb), 0.42) !important;
}

@media (min-width: 860px) {
  .flow-node-fields {
    grid-template-columns: minmax(12rem, 1.2fr) minmax(8rem, 0.5fr) minmax(12rem, 1fr);
    align-items: end;
  }
}

@media (max-width: 640px) {
  .flow-node-card {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .flow-node-handle {
    grid-column: 1 / -1;
    width: 100%;
  }
}
</style>
