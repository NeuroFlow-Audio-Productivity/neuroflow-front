<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import { useSortable } from '@dnd-kit/vue/sortable'

import AlarmSelect from '@/components/flow-builder/AlarmSelect.vue'
import ModeSelect from '@/components/flow-builder/ModeSelect.vue'
import { modeRgbString, modeSemanticKey } from '@/services/modeVisuals'
import type { Audio } from '@/types/audio'
import type { FlowNode } from '@/types/flow'
import type { Mode } from '@/types/mode'

const props = defineProps<{
  node: FlowNode
  index: number
  isLast?: boolean
  modes: Mode[]
  alarms: Audio[]
  saving?: boolean
  deleting?: boolean
  saved?: boolean
  disabled?: boolean
}>()

const emit = defineEmits<{
  update: [
    node: FlowNode,
    patch: Partial<Pick<FlowNode, 'title' | 'mode_id' | 'time' | 'end_audio_id'>>,
  ]
  delete: [node: FlowNode]
}>()

const { t } = useI18n()
const elementRef = ref<HTMLElement | null>(null)
const handleRef = ref<HTMLElement | null>(null)
const titleDraft = ref(props.node.title ?? '')

const isInteractionDisabled = computed(() => Boolean(props.disabled || props.deleting))

const { isDragSource } = useSortable({
  id: computed(() => String(props.node.id)),
  index: computed(() => props.index),
  group: 'flow-nodes',
  element: elementRef,
  handle: handleRef,
  disabled: isInteractionDisabled,
  transition: { duration: 220, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)', idle: true },
})

const selectedMode = computed(
  () => props.node.mode ?? props.modes.find((mode) => mode.id === props.node.mode_id),
)
const selectedAlarm = computed(
  () =>
    props.node.end_audio ??
    props.alarms.find((audio) => Number(audio.id) === Number(props.node.end_audio_id)) ??
    null,
)
const modeKey = computed(() => modeSemanticKey(selectedMode.value))
const fallbackTitle = computed(
  () =>
    selectedMode.value?.name ?? t('flowResource.builder.sectionTitle', { number: props.index + 1 }),
)
const cardTitle = computed(() => props.node.title?.trim() || fallbackTitle.value)
const cardSubtitle = computed(() => {
  if (modeKey.value === 'sleep') return t('flowResource.builder.cardSubtitles.sleep')
  if (modeKey.value === 'relax') return t('flowResource.builder.cardSubtitles.relax')

  return t('flowResource.builder.cardSubtitles.focus')
})
const nodeStyle = computed(() => {
  const color = selectedMode.value?.color ?? '#6ee7d8'

  return {
    '--node-rgb': modeRgbString(color),
  }
})

watch(
  () => props.node.title,
  (title) => {
    titleDraft.value = title ?? ''
  },
)

const commitTitle = () => {
  const title = titleDraft.value.trim().slice(0, 255) || fallbackTitle.value

  if (titleDraft.value !== title) titleDraft.value = title
  if (title === props.node.title) return

  emit('update', props.node, { title })
}

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
    class="flow-node-row"
    :class="{
      'is-dragging': isDragSource,
      'is-busy': saving || deleting,
      'is-saved': saved,
      'is-last': isLast,
    }"
    :style="nodeStyle"
    :data-flow-node-id="node.id"
    role="listitem"
  >
    <div class="flow-node-rail" aria-hidden="true">
      <span class="flow-node-dot">{{ String(index + 1).padStart(2, '0') }}</span>
      <span class="flow-node-line" />
    </div>

    <section class="flow-node-card">
      <div class="flow-node-card-top">
        <button
          ref="handleRef"
          class="flow-node-handle"
          type="button"
          :aria-label="t('flowResource.builder.dragHandle')"
          :disabled="isInteractionDisabled"
        >
          <i class="pi pi-align-justify" aria-hidden="true" />
        </button>

        <div class="flow-node-title-group">
          <div class="flow-node-kicker">
            <span>{{ String(index + 1).padStart(2, '0') }}</span>
            <span v-if="saving">{{ t('flowResource.builder.saving') }}</span>
            <span v-else-if="saved">{{ t('flowResource.builder.saved') }}</span>
          </div>
          <h2>{{ cardTitle }}</h2>
          <p>{{ cardSubtitle }}</p>
        </div>

        <div class="flow-node-duration-pill">
          <strong>{{ node.time }}</strong>
          <span>{{ t('flowResource.builder.minuteShort') }}</span>
        </div>
      </div>

      <div class="flow-node-fields">
        <label class="flow-node-field flow-node-field--title" :for="'flow-node-title-' + node.id">
          <span>{{ t('flowResource.builder.nodeTitle') }}</span>
          <InputText
            :id="'flow-node-title-' + node.id"
            v-model="titleDraft"
            maxlength="255"
            :placeholder="t('flowResource.builder.nodeTitlePlaceholder')"
            :disabled="isInteractionDisabled"
            class="flow-title-input"
            @blur="commitTitle"
            @keydown.enter.prevent="commitTitle"
          />
        </label>

        <label class="flow-node-field flow-node-field--mode" :for="'flow-node-mode-' + node.id">
          <span>{{ t('flowResource.builder.mode') }}</span>
          <ModeSelect
            :input-id="'flow-node-mode-' + node.id"
            :model-value="node.mode_id"
            :modes="modes"
            :disabled="isInteractionDisabled || modes.length === 0"
            @update:model-value="updateMode"
          />
        </label>

        <label class="flow-node-field flow-node-field--time" :for="'flow-node-time-' + node.id">
          <span>{{ t('flowResource.builder.duration') }}</span>
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
        </label>

        <label class="flow-node-field flow-node-field--alarm" :for="'flow-node-alarm-' + node.id">
          <span>{{ t('flowResource.builder.endAlarm') }}</span>
          <AlarmSelect
            :input-id="'flow-node-alarm-' + node.id"
            :model-value="node.end_audio_id"
            :audios="alarms"
            :disabled="isInteractionDisabled"
            @update:model-value="updateAlarm"
          />
        </label>
      </div>

      <div class="flow-node-footer">
        <span>
          {{ t('flowResource.builder.endsWith') }}
          <strong>{{ selectedAlarm?.name ?? t('flowResource.builder.alarmPlaceholder') }}</strong>
        </span>
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
      </div>
    </section>
  </article>
</template>

<style scoped>
.flow-node-row {
  --node-rgb: 110, 231, 216;
  position: relative;
  display: grid;
  grid-template-columns: 3.7rem minmax(0, 1fr);
  min-height: 10rem;
  transition:
    transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1),
    opacity 180ms ease;
}

.flow-node-row.is-dragging {
  z-index: 8;
  transform: scale(1.018);
}

.flow-node-row.is-busy {
  opacity: 0.82;
}

.flow-node-rail {
  position: relative;
  display: grid;
  justify-items: center;
  padding-top: 1.25rem;
}

.flow-node-dot {
  z-index: 1;
  display: grid;
  width: 2.35rem;
  height: 2.35rem;
  place-items: center;
  border: 1px solid rgba(var(--node-rgb), 0.38);
  border-radius: 999px;
  background: rgba(var(--node-rgb), 0.16);
  box-shadow:
    0 0 0 0.35rem rgba(var(--node-rgb), 0.055),
    0 0 1.4rem rgba(var(--node-rgb), 0.18);
  color: #ffffff;
  font-size: 0.7rem;
  font-weight: 860;
  transition:
    transform 180ms ease,
    box-shadow 180ms ease,
    background 180ms ease;
}

.flow-node-line {
  position: absolute;
  top: 3.4rem;
  bottom: 0;
  width: 1px;
  background: linear-gradient(180deg, rgba(var(--node-rgb), 0.42), rgba(255, 255, 255, 0.07));
}

.flow-node-row.is-last .flow-node-line {
  display: none;
}

.flow-node-card {
  position: relative;
  overflow: hidden;
  margin-bottom: 0.9rem;
  border: 1px solid rgba(var(--node-rgb), 0.18);
  border-radius: 8px;
  background:
    linear-gradient(135deg, rgba(var(--node-rgb), 0.14), transparent 54%),
    rgba(255, 255, 255, 0.052);
  padding: clamp(1rem, 2.2vw, 1.2rem);
  box-shadow: 0 18px 60px rgba(0, 0, 0, 0.18);
  backdrop-filter: blur(18px);
  transition:
    border-color 180ms ease,
    background 180ms ease,
    box-shadow 200ms ease,
    transform 200ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.flow-node-card::before {
  position: absolute;
  inset: 0 auto 0 0;
  width: 3px;
  background: linear-gradient(180deg, rgba(var(--node-rgb), 0.92), rgba(var(--node-rgb), 0.28));
  content: '';
}

.flow-node-row:hover .flow-node-card,
.flow-node-row.is-dragging .flow-node-card {
  border-color: rgba(var(--node-rgb), 0.42);
  background:
    linear-gradient(135deg, rgba(var(--node-rgb), 0.2), transparent 58%), rgba(255, 255, 255, 0.07);
  box-shadow:
    0 28px 90px rgba(0, 0, 0, 0.28),
    0 0 42px rgba(var(--node-rgb), 0.09);
}

.flow-node-row:hover .flow-node-dot,
.flow-node-row.is-dragging .flow-node-dot {
  transform: scale(1.04);
  box-shadow:
    0 0 0 0.42rem rgba(var(--node-rgb), 0.075),
    0 0 1.8rem rgba(var(--node-rgb), 0.25);
}

.flow-node-row.is-saved .flow-node-card {
  animation: node-saved 700ms ease;
}

.flow-node-card-top {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 0.9rem;
  align-items: start;
}

.flow-node-handle {
  display: grid;
  width: 2.55rem;
  height: 2.55rem;
  place-items: center;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.64);
  cursor: grab;
  transition:
    transform 160ms ease,
    border-color 160ms ease,
    background 160ms ease,
    color 160ms ease;
}

.flow-node-handle:hover {
  border-color: rgba(var(--node-rgb), 0.42);
  background: rgba(var(--node-rgb), 0.12);
  color: #ffffff;
  transform: translateY(-1px);
}

.flow-node-handle:active {
  cursor: grabbing;
  transform: scale(0.98);
}

.flow-node-title-group {
  min-width: 0;
}

.flow-node-kicker {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  color: rgb(var(--node-rgb));
  font-size: 0.72rem;
  font-weight: 840;
  line-height: 1;
  text-transform: uppercase;
}

.flow-node-title-group h2 {
  margin: 0.36rem 0 0;
  color: #ffffff;
  font-size: clamp(1.12rem, 2vw, 1.35rem);
  font-weight: 800;
  line-height: 1.12;
  overflow-wrap: anywhere;
}

.flow-node-title-group p {
  margin: 0.32rem 0 0;
  color: rgba(255, 255, 255, 0.54);
  font-size: 0.86rem;
  line-height: 1.5;
}

.flow-node-duration-pill {
  display: grid;
  min-width: 4.2rem;
  justify-items: center;
  border: 1px solid rgba(var(--node-rgb), 0.22);
  border-radius: 8px;
  background: rgba(var(--node-rgb), 0.09);
  padding: 0.5rem 0.65rem;
}

.flow-node-duration-pill strong {
  color: #ffffff;
  font-size: 1.25rem;
  font-weight: 820;
  line-height: 1;
}

.flow-node-duration-pill span {
  color: rgba(255, 255, 255, 0.55);
  font-size: 0.72rem;
  font-weight: 760;
}

.flow-node-fields {
  display: grid;
  gap: 0.75rem;
  margin-top: 1.15rem;
}

.flow-node-field {
  display: grid;
  gap: 0.42rem;
  min-width: 0;
}

.flow-node-field > span {
  color: rgba(255, 255, 255, 0.54);
  font-size: 0.74rem;
  font-weight: 780;
  letter-spacing: 0;
}

.flow-node-footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-top: 0.9rem;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  padding-top: 0.75rem;
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.82rem;
}

.flow-node-footer strong {
  color: rgba(255, 255, 255, 0.78);
  font-weight: 760;
}

.flow-node-delete {
  color: rgba(255, 255, 255, 0.62) !important;
}

:deep(.flow-title-input),
:deep(.flow-time-input),
:deep(.flow-time-input .p-inputnumber-input) {
  width: 100%;
}

:deep(.flow-title-input),
:deep(.flow-time-input .p-inputnumber-input) {
  min-height: 2.95rem;
  border-color: rgba(255, 255, 255, 0.12) !important;
  border-radius: 8px !important;
  background: rgba(255, 255, 255, 0.06) !important;
  color: #f7fbf8 !important;
  transition:
    border-color 160ms ease,
    box-shadow 160ms ease,
    background 160ms ease;
}

:deep(.flow-title-input:hover),
:deep(.flow-title-input:focus),
:deep(.flow-time-input .p-inputnumber-input:hover),
:deep(.flow-time-input .p-inputnumber-input:focus) {
  border-color: rgba(var(--node-rgb), 0.42) !important;
  box-shadow: 0 0 0 1px rgba(var(--node-rgb), 0.14) !important;
}

@keyframes node-saved {
  0% {
    box-shadow:
      0 18px 60px rgba(0, 0, 0, 0.18),
      0 0 0 rgba(var(--node-rgb), 0);
  }
  38% {
    box-shadow:
      0 22px 72px rgba(0, 0, 0, 0.22),
      0 0 0 4px rgba(var(--node-rgb), 0.13);
  }
  100% {
    box-shadow:
      0 18px 60px rgba(0, 0, 0, 0.18),
      0 0 0 rgba(var(--node-rgb), 0);
  }
}

@media (min-width: 920px) {
  .flow-node-fields {
    grid-template-columns: minmax(12rem, 1.2fr) minmax(8rem, 0.5fr) minmax(12rem, 1fr);
    align-items: end;
  }

  .flow-node-field--title {
    grid-column: 1 / -1;
  }
}

@media (max-width: 640px) {
  .flow-node-row {
    grid-template-columns: 2.6rem minmax(0, 1fr);
  }

  .flow-node-dot {
    width: 1.9rem;
    height: 1.9rem;
    font-size: 0.62rem;
  }

  .flow-node-line {
    top: 3rem;
  }

  .flow-node-card-top {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .flow-node-handle {
    grid-column: 1 / -1;
    width: 100%;
  }
}
</style>
