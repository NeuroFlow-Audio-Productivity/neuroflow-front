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
const previewStyle = computed(() => modeVisualStyle(form.color))

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
              <span class="mode-preview-orb" aria-hidden="true" />
              <span class="mode-preview-slab" aria-hidden="true" />
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
    radial-gradient(circle at 82% 18%, rgba(var(--resource-mode-rgb), 0.16), transparent 18rem),
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
    radial-gradient(circle at 70% 24%, rgba(var(--resource-mode-rgb), 0.26), transparent 12rem),
    #050706;
  padding: 1.1rem;
  isolation: isolate;
}

.mode-preview-ridges,
.mode-preview-orb,
.mode-preview-slab {
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
  transform: rotate(-8deg);
}

.mode-preview-orb {
  right: -4rem;
  bottom: -4rem;
  width: 18rem;
  height: 18rem;
  border-radius: 999px;
  background: radial-gradient(circle, rgba(var(--resource-mode-rgb), 0.82), transparent 62%);
  filter: blur(18px);
  opacity: 0.5;
}

.mode-preview-slab {
  right: 1.4rem;
  bottom: 3rem;
  width: 13rem;
  height: 8rem;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.36), rgba(var(--resource-mode-rgb), 0.2)),
    linear-gradient(170deg, rgba(255, 255, 255, 0.1), rgba(0, 0, 0, 0.76));
  box-shadow: 0 2rem 4rem rgba(0, 0, 0, 0.4);
  transform: perspective(34rem) rotateX(58deg) rotateZ(-16deg);
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
</style>
