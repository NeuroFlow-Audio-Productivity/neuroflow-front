<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'

import AppNavbar from '@/components/AppNavbar.vue'
import { ApiError } from '@/services/authApi'
import { translateApiKey, translateApiMessage } from '@/services/apiMessageTranslator'
import { modeApi, type StoreModePayload, type UpdateModePayload } from '@/services/modeApi'
import {
  FALLBACK_MODE_COLOR,
  isHexColor,
  modeRhythmStyle,
  modeVisualStyle,
  normalizeModeColor,
} from '@/services/modeVisuals'
import { translateValidationErrors, validationSummary } from '@/services/validationTranslator'
import { useAuthStore } from '@/stores/auth'
import type { ValidationErrors } from '@/types/auth'
import type { Mode } from '@/types/mode'

type FormMode = 'create' | 'edit'

const props = defineProps<{
  mode: FormMode
}>()

const { t } = useI18n()
const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const form = reactive({
  name: '',
  description: '',
  color: FALLBACK_MODE_COLOR,
})

const fieldErrors = ref<ValidationErrors>({})
const isLoading = ref(false)
const isSaving = ref(false)
const error = ref<string | null>(null)
const successMessage = ref<string | null>(null)

const isCreate = computed(() => props.mode === 'create')
const titleKey = computed(() => `modeResource.${props.mode}.title`)
const subtitleKey = computed(() => `modeResource.${props.mode}.subtitle`)
const eyebrowKey = computed(() => `modeResource.${props.mode}.eyebrow`)
const submitLabel = computed(() =>
  isCreate.value ? t('modeResource.actions.create') : t('modeResource.actions.save'),
)
const previewStyle = computed(() => ({
  ...modeVisualStyle(form.color),
  ...modeRhythmStyle(form),
}))

const colorPickerValue = computed({
  get: () => (isHexColor(form.color) ? normalizeModeColor(form.color) : FALLBACK_MODE_COLOR),
  set: (value: string) => {
    form.color = normalizeModeColor(value)
  },
})

const targetModeId = computed(() => {
  if (isCreate.value) return null

  const id = Number(route.params.id)

  return Number.isFinite(id) ? id : null
})

const fieldError = (field: string) => fieldErrors.value[field]?.[0]

const resetFeedback = () => {
  fieldErrors.value = {}
  error.value = null
  successMessage.value = null
}

const resetForm = () => {
  form.name = ''
  form.description = ''
  form.color = FALLBACK_MODE_COLOR
}

const assignMode = (mode: Mode) => {
  form.name = mode.name
  form.description = mode.description
  form.color = mode.color
}

const normalizeColorInput = () => {
  const trimmed = form.color.trim()

  if (/^[0-9a-f]{6}$/i.test(trimmed)) {
    form.color = `#${trimmed.toLowerCase()}`
    return
  }

  form.color = trimmed
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

const loadForm = async () => {
  resetFeedback()
  resetForm()

  if (isCreate.value) return

  if (!auth.token || !targetModeId.value) {
    error.value = t('modeResource.errors.missingMode')
    return
  }

  isLoading.value = true

  try {
    const mode = await modeApi.getMode(auth.token, targetModeId.value)

    assignMode(mode)
  } catch (caughtError) {
    setError(caughtError, 'modeResource.errors.loadMode')
  } finally {
    isLoading.value = false
  }
}

const createPayload = (): StoreModePayload => ({
  name: form.name,
  description: form.description,
  color: form.color.trim(),
})

const updatePayload = (): UpdateModePayload => ({
  name: form.name,
  description: form.description,
  color: form.color.trim(),
})

const submit = async () => {
  if (!auth.token || !auth.isAdmin) return

  normalizeColorInput()
  resetFeedback()
  isSaving.value = true

  try {
    if (isCreate.value) {
      const createdMode = await modeApi.createMode(auth.token, createPayload())

      successMessage.value = t('modeResource.feedback.created')
      await router.push({ name: 'modes-show', params: { id: createdMode.id } })
      return
    }

    if (!targetModeId.value) {
      error.value = t('modeResource.errors.missingMode')
      return
    }

    const savedMode = await modeApi.updateMode(auth.token, targetModeId.value, updatePayload())

    assignMode(savedMode)
    successMessage.value = t('modeResource.feedback.saved')
  } catch (caughtError) {
    setError(caughtError, 'modeResource.errors.save')
  } finally {
    isSaving.value = false
  }
}

watch(
  () => [props.mode, route.params.id],
  () => {
    void loadForm()
  },
  { immediate: true },
)
</script>

<template>
  <main class="mode-form-page dark min-h-screen px-4 py-4 text-[#f7fbf8] sm:px-6 lg:px-8">
    <AppNavbar />

    <section class="mx-auto max-w-5xl py-8 sm:py-10">
      <RouterLink
        class="theme-accent-link inline-flex items-center gap-2 text-sm font-semibold"
        to="/modes"
      >
        <i class="pi pi-arrow-left text-xs" aria-hidden="true" />
        <span>{{ t('modeResource.actions.back') }}</span>
      </RouterLink>

      <div class="mt-6">
        <p class="text-sm font-semibold uppercase text-[var(--mode-accent)]">
          {{ t(eyebrowKey) }}
        </p>
        <h1 class="mt-3 text-4xl font-semibold leading-tight text-white sm:text-5xl">
          {{ t(titleKey) }}
        </h1>
        <p class="mt-3 max-w-2xl text-base leading-7 text-white/66">
          {{ t(subtitleKey) }}
        </p>
      </div>

      <form class="mode-form mt-6" :style="previewStyle" @submit.prevent="submit">
        <div v-if="isLoading" class="py-12 text-center text-sm text-white/62">
          {{ t('modeResource.form.loading') }}
        </div>

        <template v-else>
          <div
            v-if="successMessage"
            class="theme-success-panel rounded-[8px] border px-4 py-3 text-sm leading-6"
          >
            {{ successMessage }}
          </div>

          <div
            v-if="error"
            class="rounded-[8px] border border-red-300/30 bg-red-500/10 px-4 py-3 text-sm leading-6 text-red-100"
            :class="{ 'mt-4': successMessage }"
          >
            {{ error }}
          </div>

          <div class="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.64fr)]">
            <div class="grid gap-5">
              <div class="auth-field">
                <label class="auth-field-label" for="mode-name">
                  {{ t('modeResource.fields.name') }}
                </label>
                <InputText
                  id="mode-name"
                  v-model="form.name"
                  class="!w-full"
                  autocomplete="off"
                  :invalid="Boolean(fieldError('name'))"
                />
                <span v-if="fieldError('name')" class="auth-field-error">
                  {{ fieldError('name') }}
                </span>
              </div>

              <div class="auth-field">
                <label class="auth-field-label" for="mode-color">
                  {{ t('modeResource.fields.color') }}
                </label>
                <div class="mode-color-control">
                  <input
                    id="mode-color-picker"
                    v-model="colorPickerValue"
                    class="mode-color-picker"
                    type="color"
                    :aria-label="t('modeResource.fields.color')"
                  />
                  <InputText
                    id="mode-color"
                    v-model="form.color"
                    class="!w-full"
                    autocomplete="off"
                    maxlength="7"
                    placeholder="#6ee7d8"
                    :invalid="Boolean(fieldError('color'))"
                    @blur="normalizeColorInput"
                  />
                </div>
                <span v-if="fieldError('color')" class="auth-field-error">
                  {{ fieldError('color') }}
                </span>
              </div>

              <div class="auth-field">
                <label class="auth-field-label" for="mode-description">
                  {{ t('modeResource.fields.description') }}
                </label>
                <Textarea
                  id="mode-description"
                  v-model="form.description"
                  class="mode-textarea !w-full"
                  rows="7"
                  auto-resize
                  :invalid="Boolean(fieldError('description'))"
                />
                <span v-if="fieldError('description')" class="auth-field-error">
                  {{ fieldError('description') }}
                </span>
              </div>
            </div>

            <aside class="mode-form-preview">
              <span class="mode-preview-ridges" aria-hidden="true" />
              <span class="mode-preview-bands" aria-hidden="true">
                <span v-for="band in 5" :key="band" />
              </span>
              <span class="mode-preview-wave" aria-hidden="true">
                <span v-for="beat in 12" :key="beat" />
              </span>
              <div class="relative z-10">
                <p class="text-xs font-semibold uppercase text-white/48">
                  {{ t('modeResource.form.preview') }}
                </p>
                <h2 class="mt-6 text-3xl font-semibold leading-tight text-white">
                  {{ form.name || t('modeResource.form.previewName') }}
                </h2>
                <p class="mt-4 text-sm leading-6 text-white/68">
                  {{ form.description || t('modeResource.form.previewDescription') }}
                </p>
                <span class="mode-preview-color">{{ normalizeModeColor(form.color) }}</span>
              </div>
            </aside>
          </div>

          <div class="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            <RouterLink
              class="inline-flex min-h-10 items-center justify-center rounded-[8px] border border-white/12 px-4 text-sm font-semibold text-white/72 transition hover:bg-white/10 hover:text-white"
              to="/modes"
            >
              {{ t('modeResource.actions.back') }}
            </RouterLink>
            <Button
              type="submit"
              :label="submitLabel"
              icon="pi pi-check"
              :loading="isSaving"
              class="theme-primary-button !justify-center"
            />
          </div>
        </template>
      </form>
    </section>
  </main>
</template>

<style scoped>
.mode-form-page {
  background:
    radial-gradient(circle at 78% 8%, rgba(var(--mode-companion-rgb), 0.16), transparent 34rem),
    radial-gradient(circle at 6% 68%, rgba(var(--mode-glow-rgb), 0.13), transparent 32rem),
    linear-gradient(180deg, #06100e 0%, #081512 48%, #06100e 100%);
}

.mode-form {
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  background:
    linear-gradient(105deg, rgba(var(--resource-mode-rgb), 0.16), transparent 36%),
    rgba(7, 16, 14, 0.86);
  padding: 1.25rem;
  box-shadow: 0 24px 90px rgba(0, 0, 0, 0.28);
  backdrop-filter: blur(24px);
}

.mode-color-control {
  display: grid;
  grid-template-columns: 3rem minmax(0, 1fr);
  gap: 0.75rem;
}

.mode-color-picker {
  width: 3rem;
  min-width: 3rem;
  height: 2.65rem;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.08);
  padding: 0.2rem;
}

.mode-color-picker::-webkit-color-swatch-wrapper {
  padding: 0;
}

.mode-color-picker::-webkit-color-swatch {
  border: 0;
  border-radius: 6px;
}

.mode-color-picker::-moz-color-swatch {
  border: 0;
  border-radius: 6px;
}

:deep(.mode-textarea) {
  border-color: rgba(255, 255, 255, 0.16) !important;
  background: rgba(255, 255, 255, 0.075) !important;
  color: #f7fbf8 !important;
  box-shadow: none !important;
  resize: vertical;
}

:deep(.mode-textarea:hover) {
  border-color: rgba(var(--resource-mode-rgb), 0.44) !important;
}

:deep(.mode-textarea:enabled:focus) {
  border-color: var(--resource-mode-color) !important;
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--resource-mode-color), transparent 42%) !important;
}

.mode-form-preview {
  position: relative;
  min-height: 25rem;
  overflow: hidden;
  border: 1px solid rgba(var(--resource-mode-rgb), 0.3);
  border-radius: 8px;
  background:
    linear-gradient(118deg, rgba(var(--resource-mode-rgb), 0.24), transparent 42%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.04), transparent 54%), #050706;
  padding: 1.1rem;
  isolation: isolate;
}

.mode-preview-ridges,
.mode-preview-bands,
.mode-preview-wave {
  position: absolute;
  pointer-events: none;
}

.mode-preview-ridges {
  inset: -18%;
  z-index: -2;
  background: repeating-linear-gradient(
    112deg,
    transparent 0 1rem,
    rgba(255, 255, 255, 0.065) 1.05rem 1.16rem,
    rgba(0, 0, 0, 0.62) 1.22rem 2.2rem
  );
  opacity: 0.72;
  transform: skewY(-8deg);
}

.mode-preview-bands {
  right: 1rem;
  bottom: 1.4rem;
  left: 1rem;
  display: grid;
  gap: 0.7rem;
  opacity: 0.58;
}

.mode-preview-bands span {
  display: block;
  height: 0.35rem;
  border-radius: 999px;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(var(--resource-mode-rgb), 0.78),
    transparent
  );
  animation: previewBand var(--resource-mode-band-duration) ease-in-out infinite alternate;
}

.mode-preview-bands span:nth-child(2n) {
  animation-delay: -1.1s;
}

.mode-preview-bands span:nth-child(3n) {
  animation-delay: -2.2s;
}

.mode-preview-wave {
  right: 1.2rem;
  bottom: 5.6rem;
  display: flex;
  width: 13.5rem;
  height: 7rem;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  border: 1px solid rgba(var(--resource-mode-rgb), 0.32);
  border-radius: 8px;
  background: rgba(3, 6, 5, 0.56);
  box-shadow: inset 0 0 3rem rgba(var(--resource-mode-rgb), 0.14);
  transform: perspective(34rem) rotateX(58deg) rotateZ(-14deg);
}

.mode-preview-wave span {
  display: block;
  width: 0.33rem;
  height: var(--bar-height, 4.5rem);
  border-radius: 999px;
  background: color-mix(in srgb, var(--resource-mode-color), #ffffff 12%);
  box-shadow: 0 0 1rem rgba(var(--resource-mode-rgb), 0.56);
  transform: scaleY(0.5);
  transform-origin: center;
  animation: previewWave var(--resource-mode-wave-duration) ease-in-out infinite;
}

.mode-preview-wave span:nth-child(2n) {
  --bar-height: 3.5rem;
  animation-delay: -0.35s;
}

.mode-preview-wave span:nth-child(3n) {
  --bar-height: 5.7rem;
  animation-delay: -0.7s;
}

.mode-preview-wave span:nth-child(4n) {
  --bar-height: 2.8rem;
  animation-delay: -1.05s;
}

.mode-preview-color {
  display: inline-flex;
  min-height: 2.15rem;
  align-items: center;
  margin-top: 2rem;
  border: 1px solid rgba(var(--resource-mode-rgb), 0.44);
  border-radius: 999px;
  background: rgba(var(--resource-mode-rgb), 0.12);
  padding: 0.35rem 0.75rem;
  color: color-mix(in srgb, var(--resource-mode-color), #ffffff 28%);
  font-size: 0.82rem;
  font-weight: 800;
}

@media (min-width: 640px) {
  .mode-form {
    padding: 1.5rem;
  }
}

@keyframes previewWave {
  0%,
  100% {
    transform: scaleY(0.5);
  }

  45% {
    transform: scaleY(var(--resource-mode-wave-scale));
  }

  72% {
    transform: scaleY(0.66);
  }
}

@keyframes previewBand {
  from {
    transform: translateX(-8%) scaleX(0.72);
  }

  to {
    transform: translateX(10%) scaleX(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .mode-preview-wave span,
  .mode-preview-bands span {
    animation: none;
  }
}
</style>
