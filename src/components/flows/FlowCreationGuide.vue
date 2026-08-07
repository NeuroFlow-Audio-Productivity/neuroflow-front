<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
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
import { useVisualThemeStore } from '@/stores/visualTheme'
import type { ValidationErrors } from '@/types/auth'
import type { Flow } from '@/types/flow'

type NavigatorWithPerformanceHints = Navigator & {
  deviceMemory?: number
  connection?: { saveData?: boolean }
}

const shouldReduceVisualEffects = () => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false

  const deviceNavigator = navigator as NavigatorWithPerformanceHints
  const hasLimitedMemory =
    typeof deviceNavigator.deviceMemory === 'number' && deviceNavigator.deviceMemory <= 4
  const hasLimitedCpu =
    typeof deviceNavigator.hardwareConcurrency === 'number' &&
    deviceNavigator.hardwareConcurrency > 0 &&
    deviceNavigator.hardwareConcurrency <= 4

  return (
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
    window.matchMedia('(pointer: coarse)').matches ||
    deviceNavigator.connection?.saveData === true ||
    hasLimitedMemory ||
    hasLimitedCpu
  )
}

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
const visualTheme = useVisualThemeStore()

const selectedCategoryKey = ref<FlowCategoryKey | null>(null)
const selectedSuggestionKey = ref<string | null>(null)
const flowName = ref('')
const fieldErrors = ref<ValidationErrors>({})
const error = ref<string | null>(null)
const isSaving = ref(false)
const hoveredCategoryKey = ref<FlowCategoryKey | null>(null)
const cursorX = ref(50)
const cursorY = ref(50)
const cursorOpacity = ref(0)
const automaticallyReducedEffects = ref(shouldReduceVisualEffects())
const reducedEffects = computed(
  () => visualTheme.fastModeEnabled || automaticallyReducedEffects.value,
)

const cursorTarget = {
  x: 50,
  y: 50,
}
let cursorFrame: number | null = null
let reducedMotionQuery: MediaQueryList | null = null

const syncReducedEffects = () => {
  automaticallyReducedEffects.value = shouldReduceVisualEffects()
}

const selectedCategory = computed(() => flowCategoryByKey(selectedCategoryKey.value))
const guideStyle = computed(() =>
  selectedCategory.value ? flowCategoryStyle(selectedCategory.value.key) : {},
)
const ambientCategory = computed(() =>
  flowCategoryByKey(hoveredCategoryKey.value ?? selectedCategoryKey.value),
)
const activeMood = computed(() => hoveredCategoryKey.value ?? selectedCategoryKey.value ?? 'idle')
const ambientStyle = computed(() => ({
  ...(ambientCategory.value ? flowCategoryStyle(ambientCategory.value.key) : guideStyle.value),
  '--cursor-x': cursorX.value + '%',
  '--cursor-y': cursorY.value + '%',
  '--cursor-opacity': String(cursorOpacity.value),
}))
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

const neuralLines = Array.from({ length: 34 }, (_, index) => {
  const duration = 8 + ((index * 7) % 9)
  const delay = -((index * 11) % 17)
  const peak = 0.065 + ((index * 13) % 55) / 1000

  return {
    id: index,
    style: {
      left: (((index + 0.5) / 34) * 100).toFixed(3) + '%',
      '--line-duration': duration + 's',
      '--line-delay': delay + 's',
      '--line-base': String(0.024 + ((index * 5) % 18) / 1000),
      '--line-peak': String(peak),
    },
  }
})

const orbitalRings = [
  {
    id: 'wide',
    reverse: false,
    style: {
      width: '92rem',
      height: '92rem',
      '--ring-duration': '240s',
      '--ring-delay': '-42s',
      '--ring-opacity': '0.044',
      '--ring-x': '-50%',
      '--ring-y': '-47%',
    },
  },
  {
    id: 'deep',
    reverse: true,
    style: {
      width: '72rem',
      height: '72rem',
      '--ring-duration': '320s',
      '--ring-delay': '-88s',
      '--ring-opacity': '0.032',
      '--ring-x': '-48%',
      '--ring-y': '-51%',
    },
  },
  {
    id: 'near',
    reverse: false,
    style: {
      width: '112rem',
      height: '112rem',
      '--ring-duration': '280s',
      '--ring-delay': '-126s',
      '--ring-opacity': '0.024',
      '--ring-x': '-52%',
      '--ring-y': '-49%',
    },
  },
]

const easeCursor = () => {
  cursorX.value += (cursorTarget.x - cursorX.value) * 0.03
  cursorY.value += (cursorTarget.y - cursorY.value) * 0.03

  if (
    Math.abs(cursorTarget.x - cursorX.value) > 0.05 ||
    Math.abs(cursorTarget.y - cursorY.value) > 0.05
  ) {
    cursorFrame = window.requestAnimationFrame(easeCursor)
    return
  }

  cursorFrame = null
}

const startCursorEase = () => {
  if (cursorFrame === null) {
    cursorFrame = window.requestAnimationFrame(easeCursor)
  }
}

const handlePointerMove = (event: PointerEvent) => {
  if (reducedEffects.value) return

  const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect()

  cursorTarget.x = ((event.clientX - bounds.left) / bounds.width) * 100
  cursorTarget.y = ((event.clientY - bounds.top) / bounds.height) * 100
  cursorOpacity.value = 1
  startCursorEase()
}

const handlePointerLeave = () => {
  cursorOpacity.value = 0
}

const setHoveredCategory = (categoryKey: FlowCategoryKey) => {
  hoveredCategoryKey.value = categoryKey
}

const clearHoveredCategory = () => {
  hoveredCategoryKey.value = null
}

onMounted(() => {
  cursorX.value = 50
  cursorY.value = 50
  reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  syncReducedEffects()
  reducedMotionQuery.addEventListener('change', syncReducedEffects)
})

onBeforeUnmount(() => {
  reducedMotionQuery?.removeEventListener('change', syncReducedEffects)

  if (cursorFrame !== null) {
    window.cancelAnimationFrame(cursorFrame)
  }
})

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
  <section
    class="flow-guide"
    :class="{
      'flow-guide--compact': props.compact,
      'flow-guide--reduced-effects': reducedEffects,
    }"
    :data-mood="activeMood"
    :style="ambientStyle"
    @pointermove="handlePointerMove"
    @pointerleave="handlePointerLeave"
  >
    <div class="flow-ambient" aria-hidden="true">
      <span class="flow-aurora flow-aurora--teal" />
      <span class="flow-aurora flow-aurora--blue" />
      <span class="flow-aurora flow-aurora--purple" />
      <span class="flow-center-glow" />
      <span class="flow-rings">
        <span
          v-for="ring in orbitalRings"
          :key="ring.id"
          class="flow-ring"
          :class="{ 'flow-ring--reverse': ring.reverse }"
          :style="ring.style"
        />
      </span>
      <span class="flow-neural">
        <span
          v-for="line in neuralLines"
          :key="line.id"
          class="flow-neural-line"
          :style="line.style"
        />
      </span>
      <span class="flow-cursor-fog" />
      <span class="flow-noise" />
    </div>
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
            @mouseenter="setHoveredCategory(category.key)"
            @mouseleave="clearHoveredCategory"
            @focus="setHoveredCategory(category.key)"
            @blur="clearHoveredCategory"
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
  --flow-accent: #6ee7d8;
  --flow-accent-rgb: 110, 231, 216;
  --aurora-teal-opacity: 0.14;
  --aurora-blue-opacity: 0.12;
  --aurora-purple-opacity: 0.08;
  --center-glow-opacity: 0.18;
  --line-boost: 0;
  --ring-alpha: 1;
  --scene-softness: 0;
  --cursor-x: 50%;
  --cursor-y: 50%;
  --cursor-opacity: 0;
  position: relative;
  display: grid;
  width: 100%;
  min-height: calc(100svh - 7.5rem);
  place-items: center;
  overflow: hidden;
  border-radius: 8px;
  background:
    linear-gradient(180deg, rgba(4, 11, 12, 0.94), rgba(5, 15, 14, 0.9) 46%, rgba(4, 10, 13, 0.96)),
    #040b0c;
  padding: clamp(1.5rem, 5vw, 4.5rem) 1rem;
  isolation: isolate;
  transition:
    background-color 900ms ease,
    filter 900ms ease;
}

.flow-guide[data-mood='focus'] {
  --aurora-teal-opacity: 0.2;
  --aurora-blue-opacity: 0.13;
  --aurora-purple-opacity: 0.06;
  --center-glow-opacity: 0.24;
  --line-boost: 0.038;
  --ring-alpha: 1.28;
}

.flow-guide[data-mood='unwind'] {
  --aurora-teal-opacity: 0.1;
  --aurora-blue-opacity: 0.12;
  --aurora-purple-opacity: 0.16;
  --center-glow-opacity: 0.2;
  --line-boost: 0.016;
  --ring-alpha: 1.14;
  --scene-softness: 0.08rem;
}

.flow-guide[data-mood='sleep'] {
  --aurora-teal-opacity: 0.07;
  --aurora-blue-opacity: 0.16;
  --aurora-purple-opacity: 0.08;
  --center-glow-opacity: 0.12;
  --line-boost: -0.006;
  --ring-alpha: 0.78;
  background:
    linear-gradient(180deg, rgba(2, 6, 12, 0.97), rgba(3, 10, 19, 0.95) 46%, rgba(2, 5, 12, 0.98)),
    #02060c;
}

.flow-guide--compact {
  min-height: 100svh;
  border-radius: 0;
}

.flow-ambient {
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
}

.flow-ambient::before {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse at 50% 48%, rgba(96, 232, 218, 0.08), transparent 34rem),
    radial-gradient(ellipse at 50% 105%, rgba(73, 103, 177, 0.12), transparent 42rem),
    linear-gradient(180deg, rgba(255, 255, 255, 0.018), transparent 42%);
  content: '';
  filter: blur(var(--scene-softness));
  opacity: 0.85;
  transition:
    filter 900ms ease,
    opacity 900ms ease;
}

.flow-aurora {
  position: absolute;
  width: 74rem;
  height: 54rem;
  border-radius: 999px;
  filter: blur(7.5rem);
  mix-blend-mode: screen;
  opacity: 0.1;
  transform: translate3d(0, 0, 0);
  will-change: transform, opacity;
}

.flow-aurora--teal {
  top: -22rem;
  left: -20rem;
  background: radial-gradient(
    circle,
    rgba(88, 255, 219, 0.52),
    rgba(42, 173, 180, 0.18) 44%,
    transparent 72%
  );
  opacity: var(--aurora-teal-opacity);
  animation: flow-aurora-drift-a 46s ease-in-out infinite alternate;
}

.flow-aurora--blue {
  right: -24rem;
  bottom: -24rem;
  background: radial-gradient(
    circle,
    rgba(87, 139, 255, 0.5),
    rgba(22, 72, 118, 0.2) 48%,
    transparent 74%
  );
  opacity: var(--aurora-blue-opacity);
  animation: flow-aurora-drift-b 58s ease-in-out infinite alternate;
}

.flow-aurora--purple {
  top: 5%;
  right: 4%;
  width: 64rem;
  height: 44rem;
  background: radial-gradient(
    circle,
    rgba(180, 140, 255, 0.36),
    rgba(86, 68, 140, 0.14) 46%,
    transparent 76%
  );
  opacity: var(--aurora-purple-opacity);
  animation: flow-aurora-drift-c 52s ease-in-out infinite alternate;
}

.flow-center-glow {
  position: absolute;
  top: 50%;
  left: 50%;
  width: min(88rem, 115vw);
  height: min(52rem, 78vh);
  border-radius: 999px;
  background: radial-gradient(
    ellipse,
    rgba(var(--flow-accent-rgb), 0.34),
    rgba(86, 136, 203, 0.12) 38%,
    transparent 72%
  );
  filter: blur(6.5rem);
  opacity: var(--center-glow-opacity);
  transform: translate3d(-50%, -53%, 0) scale(1);
  transform-origin: center;
  animation: flow-center-breathe 20s ease-in-out infinite;
  mix-blend-mode: screen;
  transition: opacity 900ms ease;
  will-change: transform, opacity;
}

.flow-neural {
  position: absolute;
  inset: 0;
  mask-image: linear-gradient(180deg, transparent, #000 14%, #000 86%, transparent);
}

.flow-neural-line {
  position: absolute;
  top: -8%;
  bottom: -8%;
  width: 1px;
  background: linear-gradient(180deg, transparent, rgba(255, 255, 255, 0.52) 46%, transparent);
  opacity: var(--line-base);
  transform: translate3d(0, 0, 0);
  animation: flow-neural-breathe var(--line-duration) ease-in-out var(--line-delay) infinite;
  will-change: opacity;
}

.flow-rings {
  position: absolute;
  inset: 0;
  opacity: var(--ring-alpha);
  transition: opacity 900ms ease;
}

.flow-ring {
  position: absolute;
  top: 48%;
  left: 50%;
  border: 1px solid rgba(255, 255, 255, calc(var(--ring-opacity) * var(--ring-alpha)));
  border-radius: 999px;
  background:
    radial-gradient(
      circle at 50% 50%,
      transparent 58%,
      rgba(var(--flow-accent-rgb), 0.02) 60%,
      transparent 62%
    ),
    linear-gradient(
      115deg,
      rgba(255, 255, 255, 0.028),
      transparent 34%,
      rgba(var(--flow-accent-rgb), 0.024) 64%,
      transparent
    );
  opacity: 1;
  transform: translate3d(var(--ring-x), var(--ring-y), 0) rotate(0deg);
  animation: flow-ring-turn var(--ring-duration) linear var(--ring-delay) infinite;
  will-change: transform;
}

.flow-ring--reverse {
  animation-name: flow-ring-turn-reverse;
}

.flow-cursor-fog {
  position: absolute;
  width: clamp(19rem, 34vw, 31rem);
  height: clamp(19rem, 34vw, 31rem);
  border-radius: 999px;
  background: radial-gradient(
    circle,
    rgba(var(--flow-accent-rgb), 0.18),
    rgba(83, 146, 190, 0.07) 42%,
    transparent 72%
  );
  filter: blur(4rem);
  left: var(--cursor-x);
  top: var(--cursor-y);
  mix-blend-mode: screen;
  opacity: calc(var(--cursor-opacity) * 0.58);
  transform: translate3d(-50%, -50%, 0);
  transition: opacity 700ms ease;
  will-change: transform, opacity;
}

.flow-noise {
  position: absolute;
  inset: -18%;
  background-image:
    radial-gradient(circle at 18% 22%, rgba(255, 255, 255, 0.18) 0 0.06rem, transparent 0.07rem),
    radial-gradient(circle at 72% 38%, rgba(255, 255, 255, 0.12) 0 0.05rem, transparent 0.06rem),
    radial-gradient(circle at 42% 78%, rgba(255, 255, 255, 0.13) 0 0.05rem, transparent 0.06rem),
    radial-gradient(circle at 86% 68%, rgba(255, 255, 255, 0.12) 0 0.045rem, transparent 0.055rem);
  background-size:
    7rem 7rem,
    9rem 9rem,
    6rem 6rem,
    8rem 8rem;
  mix-blend-mode: soft-light;
  opacity: 0.028;
  animation: flow-noise-shift 18s steps(8) infinite;
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
  position: relative;
  z-index: 1;
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

@keyframes flow-aurora-drift-a {
  0% {
    transform: translate3d(-4%, -2%, 0) rotate(0deg) scale(1);
  }

  50% {
    transform: translate3d(12%, 8%, 0) rotate(8deg) scale(1.05);
  }

  100% {
    transform: translate3d(24%, 4%, 0) rotate(-5deg) scale(1.02);
  }
}

@keyframes flow-aurora-drift-b {
  0% {
    transform: translate3d(4%, 2%, 0) rotate(0deg) scale(1);
  }

  50% {
    transform: translate3d(-11%, -7%, 0) rotate(-7deg) scale(1.04);
  }

  100% {
    transform: translate3d(-22%, -2%, 0) rotate(5deg) scale(1.01);
  }
}

@keyframes flow-aurora-drift-c {
  0% {
    transform: translate3d(6%, -4%, 0) rotate(0deg) scale(1);
  }

  50% {
    transform: translate3d(-8%, 6%, 0) rotate(6deg) scale(1.04);
  }

  100% {
    transform: translate3d(-18%, 2%, 0) rotate(-4deg) scale(1.02);
  }
}

@keyframes flow-center-breathe {
  0%,
  100% {
    transform: translate3d(-50%, -53%, 0) scale(1);
  }

  50% {
    transform: translate3d(-50%, -53%, 0) scale(1.08);
  }
}

@keyframes flow-neural-breathe {
  0%,
  100% {
    opacity: calc(var(--line-base) + var(--line-boost));
  }

  50% {
    opacity: calc(var(--line-peak) + var(--line-boost));
  }
}

@keyframes flow-ring-turn {
  to {
    transform: translate3d(var(--ring-x), var(--ring-y), 0) rotate(360deg);
  }
}

@keyframes flow-ring-turn-reverse {
  to {
    transform: translate3d(var(--ring-x), var(--ring-y), 0) rotate(-360deg);
  }
}

@keyframes flow-noise-shift {
  0% {
    transform: translate3d(0, 0, 0);
  }

  25% {
    transform: translate3d(-2%, 1%, 0);
  }

  50% {
    transform: translate3d(1%, -1%, 0);
  }

  75% {
    transform: translate3d(2%, 2%, 0);
  }

  100% {
    transform: translate3d(0, 0, 0);
  }
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

.flow-guide--reduced-effects {
  transition: none;
}

.flow-guide--reduced-effects .flow-aurora,
.flow-guide--reduced-effects .flow-center-glow,
.flow-guide--reduced-effects .flow-neural-line,
.flow-guide--reduced-effects .flow-ring,
.flow-guide--reduced-effects .flow-noise {
  animation: none;
  will-change: auto;
}

.flow-guide--reduced-effects .flow-aurora {
  filter: blur(3.5rem);
  mix-blend-mode: normal;
}

.flow-guide--reduced-effects .flow-aurora--purple,
.flow-guide--reduced-effects .flow-cursor-fog,
.flow-guide--reduced-effects .flow-noise,
.flow-guide--reduced-effects .flow-neural-line:nth-child(3n + 2),
.flow-guide--reduced-effects .flow-neural-line:nth-child(3n + 3) {
  display: none;
}

.flow-guide--reduced-effects .flow-center-glow {
  filter: blur(3rem);
  mix-blend-mode: normal;
}

.flow-guide--reduced-effects .flow-category-card,
.flow-guide--reduced-effects .flow-custom-entry {
  backdrop-filter: none;
}

.flow-guide--reduced-effects .flow-guide-scene-enter-active,
.flow-guide--reduced-effects .flow-guide-scene-leave-active {
  transition: none;
}

.flow-guide--reduced-effects .flow-guide-scene-enter-from,
.flow-guide--reduced-effects .flow-guide-scene-leave-to {
  filter: none;
  transform: none;
}

@media (prefers-reduced-motion: reduce) {
  .flow-aurora,
  .flow-center-glow,
  .flow-neural-line,
  .flow-ring,
  .flow-noise {
    animation: none;
  }

  .flow-cursor-fog {
    display: none;
  }

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
