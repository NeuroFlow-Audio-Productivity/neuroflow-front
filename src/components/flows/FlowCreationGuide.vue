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
const selectedCategoryEmoji = computed(() => selectedCategory.value?.emoji ?? '🧠')
const visibleSuggestions = computed(
  () => selectedCategory.value?.suggestions.filter((suggestion) => !suggestion.custom) ?? [],
)
const customPlaceholder = computed(() =>
  selectedCategory.value
    ? t(`flowResource.create.placeholders.${selectedCategory.value.key}`)
    : t('flowResource.create.customPlaceholder'),
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
  flowName.value = suggestionLabel(suggestion)
  resetFeedback()
}

const resetGuide = () => {
  selectedCategoryKey.value = null
  selectedSuggestionKey.value = null
  flowName.value = ''
  resetFeedback()
}

const changeCategory = () => {
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
    <div
      v-if="error"
      class="flow-guide-error rounded-[8px] border border-red-300/30 bg-red-500/10 px-4 py-3 text-sm leading-6 text-red-100"
    >
      {{ error }}
    </div>

    <Transition name="flow-guide-scene" mode="out-in">
      <div v-if="!selectedCategory" key="category" class="flow-scene flow-scene--initial">
        <h2>{{ t('flowResource.create.initialQuestion') }}</h2>

        <div class="flow-category-grid" :aria-label="t('flowResource.create.initialQuestion')">
          <button
            v-for="category in flowCategories"
            :key="category.key"
            class="flow-category-card"
            :style="flowCategoryStyle(category.key)"
            type="button"
            @click="selectCategory(category)"
          >
            <span class="flow-category-icon" aria-hidden="true">{{ category.emoji }}</span>
            <strong>{{ t(category.labelKey) }}</strong>
          </button>
        </div>
      </div>

      <form
        v-else
        key="suggestions"
        class="flow-scene flow-scene--suggestions"
        @submit.prevent="submit"
      >
        <button class="flow-selected-category" type="button" @click="changeCategory">
          <span aria-hidden="true">{{ selectedCategoryEmoji }}</span>
          <strong>{{ selectedCategoryLabel }}</strong>
          <i class="pi pi-arrow-left" aria-hidden="true" />
        </button>

        <h2>{{ t('flowResource.create.suggestionQuestion') }}</h2>

        <div class="flow-suggestion-grid">
          <button
            v-for="suggestion in visibleSuggestions"
            :key="suggestion.key"
            class="flow-suggestion-card"
            :class="{ 'is-selected': selectedSuggestionKey === suggestion.key }"
            type="button"
            @click="selectSuggestion(suggestion)"
          >
            <span aria-hidden="true">{{ suggestion.emoji }}</span>
            <strong>{{ suggestionLabel(suggestion) }}</strong>
          </button>
        </div>

        <div class="flow-custom-entry">
          <label class="sr-only" for="flow-name">
            {{ t('flowResource.fields.name') }}
          </label>
          <InputText
            id="flow-name"
            v-model="flowName"
            class="flow-name-input !w-full"
            autocomplete="off"
            maxlength="255"
            :placeholder="customPlaceholder"
            :invalid="Boolean(fieldError('name'))"
          />
          <Button
            type="submit"
            :label="t('flowResource.actions.create')"
            icon="pi pi-check"
            :disabled="submitDisabled"
            :loading="isSaving"
            class="theme-primary-button flow-create-button !justify-center"
          />
        </div>

        <span v-if="fieldError('name')" class="auth-field-error flow-name-error">
          {{ fieldError('name') }}
        </span>
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
  width: 100%;
  min-height: calc(100svh - 7.5rem);
  place-items: center;
  overflow: hidden;
  border-radius: 8px;
  background:
    radial-gradient(ellipse at 50% 8%, rgba(var(--flow-accent-rgb), 0.2), transparent 34rem),
    radial-gradient(ellipse at 18% 90%, rgba(var(--mode-companion-rgb), 0.12), transparent 30rem),
    linear-gradient(180deg, rgba(7, 16, 14, 0.34), rgba(7, 16, 14, 0.12));
  padding: clamp(1.5rem, 5vw, 4.5rem) 1rem;
  isolation: isolate;
}

.flow-guide::before {
  position: absolute;
  inset: 0;
  z-index: -1;
  background:
    linear-gradient(120deg, transparent 0 26%, rgba(255, 255, 255, 0.04) 48%, transparent 72%),
    repeating-linear-gradient(
      90deg,
      transparent 0 2.2rem,
      rgba(255, 255, 255, 0.028) 2.24rem 2.3rem
    );
  content: '';
  opacity: 0.5;
  mask-image: linear-gradient(180deg, transparent, #000 20%, #000 82%, transparent);
}

.flow-guide--compact {
  min-height: 100svh;
  border-radius: 0;
}

.flow-guide-error {
  position: absolute;
  top: 1rem;
  right: 1rem;
  left: 1rem;
  z-index: 3;
  margin: 0 auto;
  max-width: 36rem;
}

.flow-scene {
  width: min(100%, 56rem);
  margin: 0 auto;
  text-align: center;
}

.flow-scene h2 {
  margin: 0;
  color: #ffffff;
  font-size: clamp(2.15rem, 5vw, 4.8rem);
  font-weight: 760;
  letter-spacing: 0;
  line-height: 0.98;
  text-wrap: balance;
}

.flow-scene--initial {
  display: grid;
  gap: clamp(2.1rem, 5vw, 4rem);
}

.flow-category-grid {
  display: grid;
  gap: 1rem;
}

.flow-category-card {
  display: grid;
  min-height: clamp(9rem, 21vw, 12.5rem);
  place-items: center;
  gap: 0.85rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  background:
    linear-gradient(145deg, rgba(var(--flow-accent-rgb), 0.14), transparent 72%),
    rgba(255, 255, 255, 0.052);
  color: #ffffff;
  padding: 1.25rem;
  text-align: center;
  box-shadow: 0 18px 70px rgba(0, 0, 0, 0.2);
  backdrop-filter: blur(20px);
  transition:
    border-color 180ms ease,
    background 180ms ease,
    box-shadow 180ms ease,
    transform 220ms ease;
}

.flow-category-card:hover {
  border-color: color-mix(in srgb, var(--flow-accent), transparent 44%);
  background:
    linear-gradient(145deg, rgba(var(--flow-accent-rgb), 0.22), transparent 70%),
    rgba(255, 255, 255, 0.07);
  box-shadow: 0 24px 90px rgba(0, 0, 0, 0.28);
  transform: translateY(-0.28rem);
}

.flow-category-icon {
  display: block;
  font-size: clamp(2rem, 5vw, 3.4rem);
  line-height: 1;
}

.flow-category-card strong {
  font-size: clamp(1.25rem, 3vw, 1.85rem);
  font-weight: 760;
  line-height: 1.05;
  overflow-wrap: anywhere;
}

.flow-scene--suggestions {
  display: grid;
  width: min(100%, 62rem);
  gap: clamp(1.25rem, 3vw, 2rem);
  justify-items: center;
}

.flow-selected-category {
  display: inline-flex;
  min-height: 2.8rem;
  max-width: min(100%, 18rem);
  align-items: center;
  justify-content: center;
  gap: 0.55rem;
  border: 1px solid rgba(var(--flow-accent-rgb), 0.28);
  border-radius: 999px;
  background: rgba(var(--flow-accent-rgb), 0.1);
  padding: 0.45rem 0.82rem;
  color: color-mix(in srgb, var(--flow-accent), #ffffff 24%);
  font-size: 0.9rem;
  transition:
    border-color 160ms ease,
    background 160ms ease,
    color 160ms ease;
}

.flow-selected-category:hover {
  border-color: color-mix(in srgb, var(--flow-accent), transparent 34%);
  background: rgba(var(--flow-accent-rgb), 0.16);
  color: #ffffff;
}

.flow-selected-category strong {
  min-width: 0;
  overflow-wrap: anywhere;
}

.flow-selected-category i {
  font-size: 0.72rem;
  opacity: 0.68;
}

.flow-suggestion-grid {
  display: flex;
  max-width: 58rem;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.75rem;
}

.flow-suggestion-card {
  display: inline-flex;
  min-height: 3.8rem;
  max-width: 100%;
  align-items: center;
  justify-content: center;
  gap: 0.65rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 999px;
  background:
    linear-gradient(135deg, rgba(var(--flow-accent-rgb), 0.11), transparent 76%),
    rgba(255, 255, 255, 0.06);
  padding: 0.85rem 1.18rem;
  color: rgba(255, 255, 255, 0.82);
  font-size: clamp(0.98rem, 2vw, 1.12rem);
  line-height: 1.1;
  box-shadow: 0 14px 48px rgba(0, 0, 0, 0.14);
  transition:
    border-color 160ms ease,
    background 160ms ease,
    color 160ms ease,
    transform 180ms ease;
}

.flow-suggestion-card span {
  font-size: 1.15rem;
}

.flow-suggestion-card strong {
  min-width: 0;
  font-weight: 720;
  overflow-wrap: anywhere;
}

.flow-suggestion-card:hover,
.flow-suggestion-card.is-selected {
  border-color: color-mix(in srgb, var(--flow-accent), transparent 42%);
  background:
    linear-gradient(135deg, rgba(var(--flow-accent-rgb), 0.22), transparent 76%),
    rgba(255, 255, 255, 0.084);
  color: #ffffff;
  transform: translateY(-0.15rem);
}

.flow-custom-entry {
  display: grid;
  width: min(100%, 42rem);
  gap: 0.75rem;
  margin-top: clamp(0.5rem, 2vw, 1.1rem);
}

:deep(.flow-name-input) {
  min-height: 3.55rem;
  border-color: rgba(255, 255, 255, 0.14) !important;
  border-radius: 999px !important;
  background: rgba(255, 255, 255, 0.078) !important;
  padding-right: 1.2rem !important;
  padding-left: 1.2rem !important;
  color: #f7fbf8 !important;
  text-align: center;
  box-shadow: 0 18px 70px rgba(0, 0, 0, 0.16) !important;
}

:deep(.flow-name-input:hover) {
  border-color: rgba(var(--flow-accent-rgb), 0.42) !important;
}

:deep(.flow-name-input:enabled:focus) {
  border-color: var(--flow-accent) !important;
  box-shadow:
    0 0 0 1px color-mix(in srgb, var(--flow-accent), transparent 44%),
    0 18px 70px rgba(0, 0, 0, 0.16) !important;
}

:deep(.flow-name-input::placeholder) {
  color: rgba(255, 255, 255, 0.46) !important;
}

.flow-create-button {
  min-height: 3.35rem;
  border-radius: 999px !important;
}

.flow-name-error {
  display: block;
  text-align: center;
}

.flow-guide-scene-enter-active,
.flow-guide-scene-leave-active {
  transition:
    opacity 260ms ease,
    transform 280ms ease,
    filter 280ms ease;
}

.flow-guide-scene-enter-from {
  opacity: 0;
  filter: blur(0.35rem);
  transform: translateY(0.9rem);
}

.flow-guide-scene-leave-to {
  opacity: 0;
  filter: blur(0.35rem);
  transform: translateY(-0.9rem);
}

@media (min-width: 700px) {
  .flow-category-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .flow-custom-entry {
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.055);
    padding: 0.35rem;
    box-shadow: 0 18px 70px rgba(0, 0, 0, 0.16);
    backdrop-filter: blur(20px);
  }

  :deep(.flow-name-input) {
    border-color: transparent !important;
    background: transparent !important;
    text-align: left;
    box-shadow: none !important;
  }

  :deep(.flow-name-input:enabled:focus) {
    border-color: transparent !important;
    box-shadow: none !important;
  }

  .flow-create-button {
    min-width: 10rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .flow-category-card,
  .flow-suggestion-card,
  .flow-selected-category,
  .flow-guide-scene-enter-active,
  .flow-guide-scene-leave-active {
    transition: none;
  }

  .flow-category-card:hover,
  .flow-suggestion-card:hover,
  .flow-suggestion-card.is-selected {
    transform: none;
  }
}
</style>
