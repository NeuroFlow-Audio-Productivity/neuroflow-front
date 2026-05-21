<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'

import { ApiError } from '@/services/authApi'
import { translateApiKey, translateApiMessage } from '@/services/apiMessageTranslator'
import { flowApi } from '@/services/flowApi'
import {
  flowCategories,
  flowCategoryByKey,
  flowCategoryStyle,
  type FlowCategory,
  type FlowCategoryKey,
  type FlowSuggestion,
} from '@/services/flowPresets'
import { translateValidationErrors, validationSummary } from '@/services/validationTranslator'
import { useAuthStore } from '@/stores/auth'
import type { ValidationErrors } from '@/types/auth'
import type { Flow } from '@/types/flow'

const props = withDefaults(
  defineProps<{
    compact?: boolean
  }>(),
  {
    compact: false,
  },
)

const emit = defineEmits<{
  created: [flow: Flow]
}>()

const { t } = useI18n()
const auth = useAuthStore()

const selectedCategoryKey = ref<FlowCategoryKey | null>(null)
const selectedSuggestionKey = ref<string | null>(null)
const flowName = ref('')
const fieldErrors = ref<ValidationErrors>({})
const error = ref<string | null>(null)
const isSaving = ref(false)

const selectedCategory = computed(() => flowCategoryByKey(selectedCategoryKey.value))
const guideStyle = computed(() =>
  selectedCategory.value ? flowCategoryStyle(selectedCategory.value.key) : {},
)
const selectedCategoryLabel = computed(() =>
  selectedCategory.value ? t(selectedCategory.value.labelKey) : '',
)
const submitDisabled = computed(() => isSaving.value || flowName.value.trim().length === 0)

const suggestionLabel = (suggestion: FlowSuggestion) => t(suggestion.labelKey)

const fieldError = (field: string) => fieldErrors.value[field]?.[0]

const resetFeedback = () => {
  fieldErrors.value = {}
  error.value = null
}

const selectCategory = (category: FlowCategory) => {
  selectedCategoryKey.value = category.key
  selectedSuggestionKey.value = null
  flowName.value = ''
  resetFeedback()
}

const selectSuggestion = (suggestion: FlowSuggestion) => {
  selectedSuggestionKey.value = suggestion.key
  flowName.value = suggestion.custom ? '' : suggestionLabel(suggestion)
  resetFeedback()
}

const resetGuide = () => {
  selectedCategoryKey.value = null
  selectedSuggestionKey.value = null
  flowName.value = ''
  resetFeedback()
}

const setError = (caughtError: unknown, fallbackKey: string) => {
  if (caughtError instanceof ApiError) {
    fieldErrors.value = translateValidationErrors(caughtError.errors)
    error.value = validationSummary(
      fieldErrors.value,
      translateApiMessage(caughtError.message, {
        fallbackKey,
        status: caughtError.status,
      }),
    )
    return
  }

  fieldErrors.value = {}
  error.value = translateApiKey(fallbackKey)
}

const submit = async () => {
  if (!auth.token) return

  const name = flowName.value.trim()
  resetFeedback()

  if (!name) {
    fieldErrors.value = {
      name: [t('flowResource.validation.nameRequired')],
    }
    error.value = fieldError('name') ?? t('flowResource.errors.save')
    return
  }

  isSaving.value = true

  try {
    const flow = await flowApi.createFlow(auth.token, { name })

    emit('created', flow)
    resetGuide()
  } catch (caughtError) {
    setError(caughtError, 'flowResource.errors.save')
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <section class="flow-guide" :class="{ 'flow-guide--compact': props.compact }" :style="guideStyle">
    <div class="flow-guide-rail" aria-hidden="true">
      <span :class="{ 'is-active': !selectedCategory }">1</span>
      <i />
      <span :class="{ 'is-active': selectedCategory }">2</span>
    </div>

    <div
      v-if="error"
      class="rounded-[8px] border border-red-300/30 bg-red-500/10 px-4 py-3 text-sm leading-6 text-red-100"
    >
      {{ error }}
    </div>

    <div class="flow-guide-step">
      <div>
        <p class="flow-step-kicker">{{ t('flowResource.create.stepOne') }}</p>
        <h2>{{ t('flowResource.create.chooseCategory') }}</h2>
      </div>

      <div class="flow-category-grid">
        <button
          v-for="category in flowCategories"
          :key="category.key"
          class="flow-category-card"
          :class="{ 'is-selected': selectedCategoryKey === category.key }"
          :style="flowCategoryStyle(category.key)"
          type="button"
          @click="selectCategory(category)"
        >
          <span class="flow-category-icon" aria-hidden="true">{{ category.emoji }}</span>
          <span class="flow-category-copy">
            <strong>{{ t(category.labelKey) }}</strong>
            <small>{{ t(category.descriptionKey) }}</small>
          </span>
          <i :class="category.icon" aria-hidden="true" />
        </button>
      </div>
    </div>

    <Transition name="flow-guide-panel">
      <form
        v-if="selectedCategory"
        class="flow-guide-step flow-guide-suggestions"
        @submit.prevent="submit"
      >
        <div>
          <p class="flow-step-kicker">{{ t('flowResource.create.stepTwo') }}</p>
          <h2>
            {{ t('flowResource.create.chooseSuggestion', { category: selectedCategoryLabel }) }}
          </h2>
        </div>

        <div class="flow-suggestion-grid">
          <button
            v-for="suggestion in selectedCategory.suggestions"
            :key="suggestion.key"
            class="flow-suggestion-chip"
            :class="{ 'is-selected': selectedSuggestionKey === suggestion.key }"
            type="button"
            @click="selectSuggestion(suggestion)"
          >
            <span aria-hidden="true">{{ suggestion.emoji }}</span>
            <strong>{{ suggestionLabel(suggestion) }}</strong>
          </button>
        </div>

        <div class="auth-field">
          <label class="auth-field-label" for="flow-name">
            {{ t('flowResource.fields.name') }}
          </label>
          <InputText
            id="flow-name"
            v-model="flowName"
            class="!w-full"
            autocomplete="off"
            maxlength="255"
            :placeholder="t('flowResource.create.customPlaceholder')"
            :invalid="Boolean(fieldError('name'))"
          />
          <span v-if="fieldError('name')" class="auth-field-error">
            {{ fieldError('name') }}
          </span>
        </div>

        <div class="flow-guide-actions">
          <Button
            type="button"
            :label="t('flowResource.actions.changeCategory')"
            icon="pi pi-arrow-left"
            severity="secondary"
            text
            class="!justify-center !text-white/70 hover:!bg-white/10"
            @click="selectedCategoryKey = null"
          />
          <Button
            type="submit"
            :label="t('flowResource.actions.create')"
            icon="pi pi-check"
            :disabled="submitDisabled"
            :loading="isSaving"
            class="theme-primary-button !justify-center"
          />
        </div>
      </form>
    </Transition>
  </section>
</template>

<style scoped>
.flow-guide {
  --flow-accent: var(--mode-accent);
  --flow-accent-rgb: var(--mode-glow-rgb);
  position: relative;
  display: grid;
  gap: 1rem;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  background:
    linear-gradient(118deg, rgba(var(--flow-accent-rgb), 0.15), transparent 40%),
    rgba(7, 16, 14, 0.84);
  padding: 1rem;
  box-shadow: 0 24px 90px rgba(0, 0, 0, 0.28);
  backdrop-filter: blur(22px);
}

.flow-guide--compact {
  box-shadow: none;
}

.flow-guide-rail {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.flow-guide-rail span {
  display: grid;
  width: 1.8rem;
  height: 1.8rem;
  place-items: center;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.52);
  font-size: 0.75rem;
  font-weight: 800;
}

.flow-guide-rail span.is-active {
  border-color: color-mix(in srgb, var(--flow-accent), transparent 34%);
  background: color-mix(in srgb, var(--flow-accent), transparent 84%);
  color: var(--mode-soft);
}

.flow-guide-rail i {
  display: block;
  width: 3.2rem;
  height: 1px;
  background: linear-gradient(90deg, rgba(255, 255, 255, 0.14), rgba(var(--flow-accent-rgb), 0.62));
}

.flow-guide-step {
  display: grid;
  gap: 1rem;
}

.flow-step-kicker {
  margin: 0;
  color: var(--flow-accent);
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0;
  line-height: 1.2;
  text-transform: uppercase;
}

.flow-guide-step h2 {
  margin: 0.35rem 0 0;
  color: #ffffff;
  font-size: 1.35rem;
  font-weight: 750;
  letter-spacing: 0;
  line-height: 1.18;
}

.flow-category-grid {
  display: grid;
  gap: 0.75rem;
}

.flow-category-card {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.8rem;
  min-height: 5.8rem;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  background:
    linear-gradient(135deg, rgba(var(--flow-accent-rgb), 0.15), transparent 62%),
    rgba(255, 255, 255, 0.055);
  padding: 0.9rem;
  color: inherit;
  text-align: left;
  transition:
    border-color 160ms ease,
    background 160ms ease,
    transform 180ms ease;
}

.flow-category-card:hover,
.flow-category-card.is-selected {
  border-color: color-mix(in srgb, var(--flow-accent), transparent 38%);
  background:
    linear-gradient(135deg, rgba(var(--flow-accent-rgb), 0.24), transparent 62%),
    rgba(255, 255, 255, 0.075);
  transform: translateY(-1px);
}

.flow-category-icon {
  display: grid;
  width: 2.75rem;
  height: 2.75rem;
  place-items: center;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 8px;
  background: rgba(4, 8, 8, 0.44);
  font-size: 1.35rem;
}

.flow-category-copy {
  display: grid;
  min-width: 0;
  gap: 0.25rem;
}

.flow-category-copy strong,
.flow-suggestion-chip strong {
  min-width: 0;
  overflow-wrap: anywhere;
}

.flow-category-copy strong {
  color: #ffffff;
  font-size: 1rem;
  font-weight: 750;
  line-height: 1.15;
}

.flow-category-copy small {
  color: rgba(255, 255, 255, 0.58);
  font-size: 0.8rem;
  line-height: 1.35;
}

.flow-category-card > i {
  color: color-mix(in srgb, var(--flow-accent), #ffffff 18%);
}

.flow-suggestion-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
}

.flow-suggestion-chip {
  display: inline-flex;
  min-height: 2.55rem;
  max-width: 100%;
  align-items: center;
  gap: 0.45rem;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  padding: 0.45rem 0.7rem;
  color: rgba(255, 255, 255, 0.74);
  font-size: 0.86rem;
  line-height: 1.15;
  transition:
    border-color 160ms ease,
    background 160ms ease,
    color 160ms ease,
    transform 180ms ease;
}

.flow-suggestion-chip:hover,
.flow-suggestion-chip.is-selected {
  border-color: color-mix(in srgb, var(--flow-accent), transparent 42%);
  background: color-mix(in srgb, var(--flow-accent), transparent 88%);
  color: #ffffff;
  transform: translateY(-1px);
}

.flow-guide-actions {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.flow-guide-panel-enter-active,
.flow-guide-panel-leave-active {
  transition:
    opacity 180ms ease,
    transform 180ms ease;
}

.flow-guide-panel-enter-from,
.flow-guide-panel-leave-to {
  opacity: 0;
  transform: translateY(0.35rem);
}

@media (min-width: 700px) {
  .flow-guide {
    padding: 1.2rem;
  }

  .flow-category-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .flow-category-card {
    grid-template-columns: minmax(0, 1fr);
    align-content: space-between;
  }

  .flow-guide-actions {
    flex-direction: row;
    justify-content: flex-end;
  }
}

@media (prefers-reduced-motion: reduce) {
  .flow-category-card,
  .flow-suggestion-chip,
  .flow-guide-panel-enter-active,
  .flow-guide-panel-leave-active {
    transition: none;
  }

  .flow-category-card:hover,
  .flow-category-card.is-selected,
  .flow-suggestion-chip:hover,
  .flow-suggestion-chip.is-selected {
    transform: none;
  }
}
</style>
