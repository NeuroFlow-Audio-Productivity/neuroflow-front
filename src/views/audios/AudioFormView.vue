<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'

import AppNavbar from '@/components/AppNavbar.vue'
import AudioPlayer from '@/components/audios/AudioPlayer.vue'
import { ApiError } from '@/services/authApi'
import { translateApiKey, translateApiMessage } from '@/services/apiMessageTranslator'
import {
  audioApi,
  audioSourceUrl,
  type StoreAudioPayload,
  type UpdateAudioPayload,
} from '@/services/audioApi'
import { modeRhythmStyle, modeSemanticKey, modeVisualStyle } from '@/services/modeVisuals'
import { modeApi } from '@/services/modeApi'
import { translateValidationErrors, validationSummary } from '@/services/validationTranslator'
import { useAuthStore } from '@/stores/auth'
import type { Audio } from '@/types/audio'
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
  mode_id: null as number | null,
  file: null as File | null,
})

const modes = ref<Mode[]>([])
const currentAudio = ref<Audio | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const previewObjectUrl = ref<string | null>(null)
const fieldErrors = ref<ValidationErrors>({})
const isLoading = ref(false)
const isLoadingModes = ref(false)
const isSaving = ref(false)
const error = ref<string | null>(null)
const successMessage = ref<string | null>(null)

const isCreate = computed(() => props.mode === 'create')
const titleKey = computed(() => `audioResource.${props.mode}.title`)
const subtitleKey = computed(() => `audioResource.${props.mode}.subtitle`)
const eyebrowKey = computed(() => `audioResource.${props.mode}.eyebrow`)
const submitLabel = computed(() =>
  isCreate.value ? t('audioResource.actions.create') : t('audioResource.actions.save'),
)

const targetAudioId = computed(() => {
  if (isCreate.value) return null

  const id = route.params.id

  return typeof id === 'string' && id.trim() ? id : null
})

const modeOptions = computed(() => [
  { label: t('audioResource.fields.unassigned'), value: null },
  ...modes.value.map((mode) => ({
    label: translatedModeName(mode),
    value: mode.id,
  })),
])

const selectedMode = computed(
  () => modes.value.find((mode) => mode.id === form.mode_id) ?? currentAudio.value?.mode ?? null,
)

const previewStyle = computed(() => ({
  ...modeVisualStyle(selectedMode.value?.color),
  ...modeRhythmStyle(selectedMode.value),
}))

const currentSourceUrl = computed(() => audioSourceUrl(currentAudio.value))
const previewSourceUrl = computed(() => previewObjectUrl.value ?? currentSourceUrl.value)
const previewModeName = computed(() => translatedModeName(selectedMode.value))
const selectedFileName = computed(
  () => form.file?.name ?? currentAudio.value?.path.split('/').filter(Boolean).at(-1) ?? '',
)
const selectedFileSize = computed(() => (form.file ? formatFileSize(form.file.size) : ''))

const translatedModeName = (mode: Mode | null | undefined) => {
  if (!mode) return t('audioResource.fields.unassigned')

  const key = modeSemanticKey(mode)

  return key ? t(`modes.${key}.label`) : mode.name
}

const numericId = (value: number | string | null | undefined) => {
  const id = Number(value)

  return Number.isFinite(id) ? id : null
}

const formatFileSize = (size: number) => {
  if (size < 1024) return `${size} B`

  const units = ['KB', 'MB', 'GB']
  let value = size / 1024
  let unitIndex = 0

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }

  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`
}

const fieldError = (field: string) => fieldErrors.value[field]?.[0]

const resetFeedback = () => {
  fieldErrors.value = {}
  error.value = null
  successMessage.value = null
}

const revokePreviewUrl = () => {
  if (!previewObjectUrl.value) return

  URL.revokeObjectURL(previewObjectUrl.value)
  previewObjectUrl.value = null
}

const setSelectedFile = (file: File | null) => {
  revokePreviewUrl()
  form.file = file

  if (file) previewObjectUrl.value = URL.createObjectURL(file)
}

const resetForm = () => {
  form.name = ''
  form.mode_id = null
  setSelectedFile(null)
  currentAudio.value = null
  if (fileInput.value) fileInput.value.value = ''
}

const assignAudio = (audio: Audio) => {
  currentAudio.value = audio
  form.name = audio.name
  form.mode_id = audio.mode?.id ?? numericId(audio.mode_id)
  setSelectedFile(null)
  if (fileInput.value) fileInput.value.value = ''
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

const loadModes = async () => {
  if (!auth.token) return

  isLoadingModes.value = true

  try {
    const response = await modeApi.listAllModes(auth.token)

    modes.value = response.data
  } catch (caughtError) {
    setError(caughtError, 'audioResource.errors.loadModes')
  } finally {
    isLoadingModes.value = false
  }
}

const loadForm = async () => {
  resetFeedback()
  resetForm()

  if (!auth.token || !auth.isAdmin) return

  isLoading.value = true

  try {
    await loadModes()

    if (isCreate.value) return

    if (!targetAudioId.value) {
      error.value = t('audioResource.errors.missingAudio')
      return
    }

    const audio = await audioApi.getAudio(auth.token, targetAudioId.value)

    assignAudio(audio)
  } catch (caughtError) {
    setError(caughtError, 'audioResource.errors.loadAudio')
  } finally {
    isLoading.value = false
  }
}

const createPayload = (): StoreAudioPayload | null => {
  if (!form.file) {
    fieldErrors.value = { file: [t('audioResource.errors.missingFile')] }
    error.value = t('audioResource.errors.missingFile')
    return null
  }

  return {
    name: form.name,
    mode_id: form.mode_id,
    file: form.file,
  }
}

const updatePayload = (): UpdateAudioPayload => ({
  name: form.name,
  mode_id: form.mode_id,
  file: form.file,
})

const chooseFile = () => {
  fileInput.value?.click()
}

const onFileChange = (event: Event) => {
  const input = event.target as HTMLInputElement

  setSelectedFile(input.files?.[0] ?? null)
}

const onFileDrop = (event: DragEvent) => {
  const file = event.dataTransfer?.files?.[0]

  if (!file) return

  setSelectedFile(file)
}

const submit = async () => {
  if (!auth.token || !auth.isAdmin) return

  resetFeedback()
  isSaving.value = true

  try {
    if (isCreate.value) {
      const payload = createPayload()

      if (!payload) return

      const createdAudio = await audioApi.createAudio(auth.token, payload)
      const freshAudio = await audioApi.getAudio(auth.token, createdAudio.id)

      successMessage.value = t('audioResource.feedback.created')
      await router.push({ name: 'audios-show', params: { id: freshAudio.id } })
      return
    }

    if (!targetAudioId.value) {
      error.value = t('audioResource.errors.missingAudio')
      return
    }

    await audioApi.updateAudio(auth.token, targetAudioId.value, updatePayload())
    const freshAudio = await audioApi.getAudio(auth.token, targetAudioId.value)

    assignAudio(freshAudio)
    successMessage.value = t('audioResource.feedback.saved')
  } catch (caughtError) {
    setError(caughtError, 'audioResource.errors.save')
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

onBeforeUnmount(() => {
  revokePreviewUrl()
})
</script>

<template>
  <main
    class="audio-form-page min-h-screen px-4 py-4 text-[rgb(var(--theme-text-rgb))] sm:px-6 lg:px-8"
  >
    <AppNavbar />

    <section class="mx-auto max-w-6xl py-8 sm:py-10">
      <RouterLink
        class="theme-accent-link inline-flex items-center gap-2 text-sm font-semibold"
        to="/audios"
      >
        <i class="pi pi-arrow-left text-xs" aria-hidden="true" />
        <span>{{ t('audioResource.actions.back') }}</span>
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

      <form class="audio-form mt-6" :style="previewStyle" @submit.prevent="submit">
        <div v-if="isLoading" class="py-12 text-center text-sm text-white/62">
          {{ t('audioResource.form.loading') }}
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

          <div class="mt-5 grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(20rem,0.72fr)]">
            <div class="grid gap-5">
              <div class="auth-field">
                <label class="auth-field-label" for="audio-name">
                  {{ t('audioResource.fields.name') }}
                </label>
                <InputText
                  id="audio-name"
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
                <label class="auth-field-label" for="audio-mode">
                  {{ t('audioResource.fields.mode') }}
                </label>
                <Select
                  input-id="audio-mode"
                  v-model="form.mode_id"
                  :options="modeOptions"
                  option-label="label"
                  option-value="value"
                  class="!w-full"
                  :loading="isLoadingModes"
                  :invalid="Boolean(fieldError('mode_id'))"
                />
                <span v-if="fieldError('mode_id')" class="auth-field-error">
                  {{ fieldError('mode_id') }}
                </span>
              </div>

              <div class="auth-field">
                <span class="auth-field-label">{{ t('audioResource.form.dropTitle') }}</span>
                <input
                  ref="fileInput"
                  class="sr-only"
                  type="file"
                  accept="audio/*"
                  @change="onFileChange"
                />
                <button
                  class="audio-file-drop"
                  type="button"
                  @click="chooseFile"
                  @dragover.prevent
                  @drop.prevent="onFileDrop"
                >
                  <span class="audio-file-icon" aria-hidden="true">
                    <i class="pi pi-volume-up" />
                  </span>
                  <span class="min-w-0">
                    <span class="block font-semibold text-white">
                      {{ selectedFileName || t('audioResource.form.noFile') }}
                    </span>
                    <span class="mt-1 block text-sm leading-6 text-white/58">
                      {{
                        selectedFileSize ||
                        (isCreate
                          ? t('audioResource.form.dropCopy')
                          : t('audioResource.form.currentFile'))
                      }}
                    </span>
                  </span>
                </button>
                <span v-if="fieldError('file')" class="auth-field-error">
                  {{ fieldError('file') }}
                </span>
              </div>
            </div>

            <aside class="audio-form-preview">
              <span class="audio-preview-grid" aria-hidden="true" />
              <span class="audio-preview-disc" aria-hidden="true">
                <span />
              </span>
              <span class="audio-preview-wave" aria-hidden="true">
                <span v-for="beat in 18" :key="beat" />
              </span>

              <div class="relative z-10">
                <p class="text-xs font-semibold uppercase text-white/48">
                  {{ t('audioResource.form.preview') }}
                </p>
                <h2 class="mt-6 break-words text-3xl font-semibold leading-tight text-white">
                  {{ form.name || t('audioResource.fields.name') }}
                </h2>
                <p class="audio-preview-mode-badge mt-3 text-sm font-semibold">
                  {{ previewModeName }}
                </p>
              </div>

              <div class="audio-preview-player">
                <AudioPlayer
                  v-if="previewSourceUrl"
                  :src="previewSourceUrl"
                  :title="selectedFileName || form.name"
                  :subtitle="previewModeName"
                  compact
                />
                <p v-else class="text-sm text-white/56">
                  {{ t('audioResource.form.noFile') }}
                </p>
              </div>
            </aside>
          </div>

          <div class="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            <RouterLink
              class="inline-flex min-h-10 items-center justify-center rounded-[8px] border border-white/12 px-4 text-sm font-semibold text-white/72 transition hover:bg-white/10 hover:text-white"
              to="/audios"
            >
              {{ t('audioResource.actions.back') }}
            </RouterLink>
            <Button
              type="button"
              :label="t('audioResource.actions.chooseFile')"
              icon="pi pi-upload"
              severity="secondary"
              class="!justify-center !border-white/12 !bg-white/10 !text-white hover:!bg-white/16"
              @click="chooseFile"
            />
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
.audio-form-page {
  background:
    radial-gradient(circle at 78% 8%, rgba(255, 186, 73, 0.13), transparent 34rem),
    radial-gradient(circle at 6% 68%, rgba(var(--mode-glow-rgb), 0.13), transparent 32rem),
    linear-gradient(180deg, #050b0b 0%, #081512 48%, #050707 100%);
}

.audio-form {
  border: 1px solid rgba(var(--theme-text-rgb), 0.12);
  border-radius: 8px;
  background:
    linear-gradient(105deg, rgba(var(--mode-glow-rgb), 0.11), transparent 36%),
    rgba(var(--theme-surface-rgb), 0.86);
  padding: 1.25rem;
  box-shadow: 0 24px 90px rgba(var(--theme-shadow-rgb), 0.28);
  backdrop-filter: blur(24px);
}

.audio-file-drop {
  display: grid;
  min-height: 8rem;
  width: 100%;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 1rem;
  border: 1px dashed rgba(var(--theme-border-rgb), 0.26);
  border-radius: 8px;
  background: rgba(var(--theme-text-rgb), 0.055);
  padding: 1rem;
  text-align: left;
  transition:
    background 160ms ease,
    border-color 160ms ease,
    transform 160ms ease;
}

.audio-file-drop:hover,
.audio-file-drop:focus-visible {
  border-color: var(--mode-accent);
  background: rgba(var(--mode-glow-rgb), 0.1);
  outline: none;
  transform: translateY(-1px);
}

.audio-file-icon {
  display: grid;
  width: 3.25rem;
  height: 3.25rem;
  place-items: center;
  border: 1px solid rgba(var(--mode-glow-rgb), 0.3);
  border-radius: 8px;
  background: rgba(var(--mode-glow-rgb), 0.11);
  color: var(--mode-accent);
  font-size: 1.25rem;
}

.audio-form-preview {
  position: relative;
  display: flex;
  min-height: 27rem;
  overflow: hidden;
  flex-direction: column;
  justify-content: space-between;
  border: 1px solid rgba(var(--theme-border-rgb), 0.16);
  border-radius: 8px;
  background:
    linear-gradient(118deg, rgba(var(--mode-glow-rgb), 0.14), transparent 42%),
    linear-gradient(180deg, rgba(var(--theme-text-rgb), 0.04), transparent 54%),
    rgba(var(--theme-surface-rgb), 0.94);
  padding: 1.1rem;
  isolation: isolate;
}

.audio-preview-grid,
.audio-preview-disc,
.audio-preview-wave {
  position: absolute;
  pointer-events: none;
}

.audio-preview-grid {
  inset: -20%;
  z-index: -2;
  background: repeating-linear-gradient(
    112deg,
    transparent 0 1rem,
    rgba(var(--theme-text-rgb), 0.06) 1.05rem 1.14rem,
    rgba(var(--theme-shadow-rgb), 0.56) 1.18rem 2.2rem
  );
  opacity: 0.68;
  transform: skewY(-8deg);
}

.audio-preview-disc {
  right: 1rem;
  top: 1rem;
  display: grid;
  width: 7rem;
  height: 7rem;
  place-items: center;
  border: 1px solid rgba(var(--theme-text-rgb), 0.14);
  border-radius: 999px;
  background:
    repeating-radial-gradient(
      circle,
      transparent 0 0.46rem,
      rgba(var(--theme-text-rgb), 0.08) 0.5rem 0.56rem
    ),
    rgba(var(--theme-shadow-rgb), 0.3);
  opacity: 0.62;
}

.audio-preview-disc span {
  width: 1.15rem;
  height: 1.15rem;
  border-radius: 999px;
  background: var(--mode-accent);
}

.audio-preview-wave {
  right: 1rem;
  bottom: 5.5rem;
  left: 1rem;
  display: flex;
  height: 7rem;
  align-items: center;
  gap: 0.36rem;
  opacity: 0.62;
}

.audio-preview-wave span {
  flex: 1;
  height: 58%;
  border-radius: 999px;
  background: color-mix(in srgb, var(--mode-accent), rgb(var(--theme-text-rgb)) 12%);
  box-shadow: 0 0 1rem rgba(var(--mode-glow-rgb), 0.36);
  transform: scaleY(0.46);
  transform-origin: center;
  animation: previewWave var(--resource-mode-wave-duration) ease-in-out infinite;
}

.audio-preview-wave span:nth-child(2n) {
  animation-delay: -0.28s;
}

.audio-preview-wave span:nth-child(3n) {
  animation-delay: -0.58s;
}

.audio-preview-mode-badge {
  display: inline-flex;
  width: fit-content;
  align-items: center;
  border: 1px solid rgba(var(--resource-mode-rgb), 0.32);
  border-radius: 999px;
  background: rgba(var(--resource-mode-rgb), 0.13);
  padding: 0.36rem 0.62rem;
  color: var(--resource-mode-color);
  line-height: 1;
}

.audio-preview-player {
  position: relative;
  z-index: 10;
  margin-top: 9rem;
}

@media (min-width: 640px) {
  .audio-form {
    padding: 1.5rem;
  }
}

@keyframes previewWave {
  0%,
  100% {
    transform: scaleY(0.42);
  }

  48% {
    transform: scaleY(var(--resource-mode-wave-scale));
  }

  72% {
    transform: scaleY(0.72);
  }
}

@media (prefers-reduced-motion: reduce) {
  .audio-preview-wave span {
    animation: none;
  }
}
</style>
