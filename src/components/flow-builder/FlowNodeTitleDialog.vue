<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'

import ModeSelect from '@/components/flow-builder/ModeSelect.vue'
import { getNodeTitleSuggestionsForMode } from '@/services/flowNodeTitles'
import type { Flow } from '@/types/flow'
import type { Mode } from '@/types/mode'

const props = defineProps<{
  visible: boolean
  flow: Flow
  modes: Mode[]
  initialModeId?: number | string | null
  creating?: boolean
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  create: [payload: { modeId: number; title: string }]
}>()

const { t } = useI18n()

const selectedModeId = ref<number | null>(null)
const selectedSuggestion = ref('')
const customTitle = ref('')

const selectedMode = computed(
  () => props.modes.find((mode) => Number(mode.id) === Number(selectedModeId.value)) ?? null,
)
const suggestions = computed(() =>
  selectedMode.value ? getNodeTitleSuggestionsForMode(props.flow, selectedMode.value) : [],
)
const customTitleValue = computed(() => customTitle.value.trim())
const titleValue = computed(() => customTitleValue.value || selectedSuggestion.value.trim())
const canCreate = computed(() =>
  Boolean(selectedModeId.value && titleValue.value && !props.creating),
)

const selectInitialMode = () => {
  const initialMode = props.modes.find((mode) => Number(mode.id) === Number(props.initialModeId))
  const nextMode = initialMode ?? props.modes[0] ?? null

  selectedModeId.value = nextMode?.id ?? null
}

const resetDraft = () => {
  selectInitialMode()
  customTitle.value = ''
  selectedSuggestion.value = suggestions.value[0] ?? ''
}

watch(
  () => props.visible,
  (visible) => {
    if (visible) resetDraft()
  },
)

watch(selectedModeId, () => {
  selectedSuggestion.value = suggestions.value[0] ?? ''
})

const close = () => {
  if (props.creating) return

  emit('update:visible', false)
}

const confirm = () => {
  if (!canCreate.value || selectedModeId.value === null) return

  emit('create', {
    modeId: selectedModeId.value,
    title: titleValue.value,
  })
}
</script>

<template>
  <Dialog
    :visible="visible"
    modal
    :draggable="false"
    :closable="!creating"
    :close-on-escape="!creating"
    class="flow-node-title-dialog"
    :pt="{ mask: { class: 'flow-node-title-mask' } }"
    @update:visible="emit('update:visible', $event)"
  >
    <form class="flow-node-title-card" @submit.prevent="confirm">
      <header class="flow-node-title-header">
        <p>{{ t('flowResource.builder.titleDialog.eyebrow') }}</p>
        <h2>{{ t('flowResource.builder.titleDialog.title') }}</h2>
      </header>

      <label class="flow-node-title-field">
        <span>{{ t('flowResource.builder.mode') }}</span>
        <ModeSelect
          input-id="flow-node-title-mode"
          :model-value="selectedModeId"
          :modes="modes"
          :disabled="creating || modes.length === 0"
          @update:model-value="selectedModeId = $event"
        />
      </label>

      <section class="flow-node-suggestions" aria-labelledby="flow-node-title-suggestions">
        <div class="flow-node-title-section-heading">
          <span id="flow-node-title-suggestions">
            {{ t('flowResource.builder.titleDialog.suggestions') }}
          </span>
        </div>

        <div class="flow-node-suggestion-grid">
          <button
            v-for="suggestion in suggestions"
            :key="suggestion"
            class="flow-node-suggestion"
            :class="{ 'is-selected': selectedSuggestion === suggestion && !customTitleValue }"
            type="button"
            :disabled="creating"
            @click="selectedSuggestion = suggestion"
          >
            {{ suggestion }}
          </button>
        </div>
      </section>

      <label class="flow-node-title-field">
        <span>{{ t('flowResource.builder.titleDialog.custom') }}</span>
        <InputText
          v-model="customTitle"
          maxlength="255"
          class="flow-node-custom-title"
          :placeholder="t('flowResource.builder.titleDialog.customPlaceholder')"
          :disabled="creating"
          autofocus
        />
      </label>

      <footer class="flow-node-title-actions">
        <Button
          type="button"
          :label="t('auth.actions.cancel')"
          icon="pi pi-times"
          class="flow-node-title-cancel"
          :disabled="creating"
          @click="close"
        />
        <Button
          type="submit"
          :label="t('flowResource.builder.titleDialog.create')"
          icon="pi pi-plus"
          class="theme-primary-button flow-node-title-create"
          :loading="creating"
          :disabled="!canCreate"
        />
      </footer>
    </form>
  </Dialog>
</template>

<style scoped>
:global(.flow-node-title-mask) {
  background:
    radial-gradient(circle at 50% 24%, rgba(var(--mode-glow-rgb), 0.18), transparent 30rem),
    rgba(1, 5, 5, 0.74) !important;
  backdrop-filter: blur(12px);
}

:deep(.p-dialog) {
  border: 0 !important;
  border-radius: 8px !important;
  background: transparent !important;
  box-shadow: none !important;
}

:deep(.p-dialog-content) {
  background: transparent !important;
  padding: 0 !important;
}

.flow-node-title-card {
  width: min(calc(100vw - 2rem), 35rem);
  overflow: hidden;
  border: 1px solid rgba(var(--mode-glow-rgb), 0.32);
  border-radius: 8px;
  background:
    radial-gradient(circle at 18% 0%, rgba(var(--mode-glow-rgb), 0.2), transparent 16rem),
    linear-gradient(145deg, rgba(13, 28, 24, 0.98), rgba(4, 10, 10, 0.98));
  padding: clamp(1rem, 3vw, 1.35rem);
  color: #f7fbf8;
  box-shadow:
    0 30px 100px rgba(0, 0, 0, 0.5),
    inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

.flow-node-title-header p,
.flow-node-title-header h2 {
  margin: 0;
}

.flow-node-title-header p {
  color: var(--mode-accent);
  font-size: 0.74rem;
  font-weight: 820;
  text-transform: uppercase;
}

.flow-node-title-header h2 {
  margin-top: 0.4rem;
  color: #ffffff;
  font-size: clamp(1.55rem, 4vw, 2.15rem);
  font-weight: 790;
  line-height: 1.05;
}

.flow-node-title-field,
.flow-node-suggestions {
  display: grid;
  gap: 0.5rem;
  margin-top: 1rem;
}

.flow-node-title-field > span,
.flow-node-title-section-heading {
  color: rgba(255, 255, 255, 0.58);
  font-size: 0.74rem;
  font-weight: 780;
}

.flow-node-suggestion-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.flow-node-suggestion {
  min-height: 2.65rem;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.78);
  padding: 0.58rem 0.78rem;
  font-weight: 730;
  text-align: left;
  transition:
    border-color 160ms ease,
    background 160ms ease,
    color 160ms ease,
    transform 160ms ease;
}

.flow-node-suggestion:hover,
.flow-node-suggestion.is-selected {
  border-color: rgba(var(--mode-glow-rgb), 0.48);
  background: rgba(var(--mode-glow-rgb), 0.14);
  color: #ffffff;
}

.flow-node-suggestion:active {
  transform: scale(0.98);
}

:deep(.flow-node-custom-title) {
  width: 100%;
  min-height: 2.95rem;
  border-color: rgba(255, 255, 255, 0.12) !important;
  border-radius: 8px !important;
  background: rgba(255, 255, 255, 0.06) !important;
  color: #f7fbf8 !important;
}

:deep(.flow-node-custom-title:hover),
:deep(.flow-node-custom-title:focus) {
  border-color: rgba(var(--mode-glow-rgb), 0.42) !important;
  box-shadow: 0 0 0 1px rgba(var(--mode-glow-rgb), 0.14) !important;
}

.flow-node-title-actions {
  display: flex;
  flex-direction: column-reverse;
  gap: 0.65rem;
  margin-top: 1.25rem;
}

.flow-node-title-cancel,
.flow-node-title-create {
  justify-content: center !important;
}

.flow-node-title-cancel {
  border-color: rgba(255, 255, 255, 0.13) !important;
  background: rgba(255, 255, 255, 0.07) !important;
  color: rgba(255, 255, 255, 0.76) !important;
}

.flow-node-title-cancel:hover {
  background: rgba(255, 255, 255, 0.12) !important;
  color: #ffffff !important;
}

@media (min-width: 560px) {
  .flow-node-title-actions {
    flex-direction: row;
    justify-content: flex-end;
  }
}
</style>
