<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import Select from 'primevue/select'
import Tag from 'primevue/tag'

import AppNavbar from '@/components/AppNavbar.vue'
import PaginationControls from '@/components/PaginationControls.vue'
import AudioPlayer from '@/components/audios/AudioPlayer.vue'
import { useThemedConfirm } from '@/composables/useThemedConfirm'
import { ApiError } from '@/services/authApi'
import { translateApiKey, translateApiMessage } from '@/services/apiMessageTranslator'
import { audioApi, audioSourceUrl } from '@/services/audioApi'
import { modeRhythmStyle, modeSemanticKey, modeVisualStyle } from '@/services/modeVisuals'
import { modeApi } from '@/services/modeApi'
import { useAuthStore } from '@/stores/auth'
import type { Audio } from '@/types/audio'
import type { Mode } from '@/types/mode'
import { paginationMetaFromResponse, type PaginationMeta } from '@/types/pagination'

const { t } = useI18n()
const auth = useAuthStore()
const { confirmDanger } = useThemedConfirm()

const audios = ref<Audio[]>([])
const modes = ref<Mode[]>([])
const pagination = ref<PaginationMeta | null>(null)
const selectedModeId = ref<number | null>(null)
const isLoading = ref(false)
const isLoadingModes = ref(false)
const deletingAudioId = ref<string | number | null>(null)
const error = ref<string | null>(null)
const successMessage = ref<string | null>(null)

const sortedAudios = computed(() =>
  [...audios.value].sort((a, b) => a.name.localeCompare(b.name)),
)

const totalAudios = computed(() => pagination.value?.total ?? sortedAudios.value.length)
const assignedAudios = computed(() => audios.value.filter((audio) => audio.mode || audio.mode_id))
const unassignedAudios = computed(() => audios.value.length - assignedAudios.value.length)

const modeOptions = computed(() => [
  { label: t('audioResource.index.allModes'), value: null },
  ...modes.value.map((mode) => ({
    label: translatedModeName(mode),
    value: mode.id,
  })),
])

const translatedModeName = (mode: Mode | null | undefined) => {
  if (!mode) return t('audioResource.fields.unassigned')

  const key = modeSemanticKey(mode)

  return key ? t(`modes.${key}.label`) : mode.name
}

const audioModeName = (audio: Audio) => translatedModeName(audio.mode)

const audioCardStyle = (audio: Audio) => ({
  ...modeVisualStyle(audio.mode?.color),
  ...modeRhythmStyle(audio.mode),
})

const audioId = (audio: Audio) => String(audio.id)

const setError = (caughtError: unknown, fallbackKey: string) => {
  if (caughtError instanceof ApiError) {
    error.value = translateApiMessage(caughtError.message, {
      fallbackKey,
      status: caughtError.status,
    })
    return
  }

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

const loadAudios = async (page = pagination.value?.currentPage ?? 1) => {
  if (!auth.token) return

  isLoading.value = true
  error.value = null

  try {
    const response =
      selectedModeId.value === null
        ? await audioApi.listAudios(auth.token, { page })
        : await audioApi.listAudiosForMode(auth.token, selectedModeId.value, { page })

    audios.value = response.data
    pagination.value = paginationMetaFromResponse(response)
  } catch (caughtError) {
    setError(caughtError, 'audioResource.errors.loadAudios')
  } finally {
    isLoading.value = false
  }
}

const deleteAudio = async (audio: Audio) => {
  if (!auth.token || !auth.isAdmin) return

  const confirmed = await confirmDanger({
    message: t('audioResource.confirmDelete', { name: audio.name }),
  })

  if (!confirmed) return

  deletingAudioId.value = audio.id
  error.value = null
  successMessage.value = null

  try {
    await audioApi.deleteAudio(auth.token, audio.id)

    const currentPage = pagination.value?.currentPage ?? 1
    const nextPage = audios.value.length === 1 && currentPage > 1 ? currentPage - 1 : currentPage

    await loadAudios(nextPage)
    successMessage.value = t('audioResource.feedback.deleted')
  } catch (caughtError) {
    setError(caughtError, 'audioResource.errors.delete')
  } finally {
    deletingAudioId.value = null
  }
}

onMounted(() => {
  void loadModes()
  void loadAudios()
})

watch(selectedModeId, () => {
  void loadAudios(1)
})
</script>

<template>
  <main class="audio-page dark min-h-screen overflow-hidden px-4 py-4 text-[#f7fbf8] sm:px-6 lg:px-8">
    <AppNavbar />

    <section class="mx-auto max-w-7xl py-8 sm:py-10">
      <div class="audio-hero">
        <div class="audio-hero-grid" aria-hidden="true" />
        <div class="audio-hero-orbit" aria-hidden="true">
          <span v-for="ring in 3" :key="ring" />
        </div>
        <div class="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p class="text-sm font-semibold uppercase text-[#8df2df]">
              {{ t('audioResource.index.eyebrow') }}
            </p>
            <h1 class="mt-3 text-4xl font-semibold leading-tight text-white sm:text-5xl">
              {{ t('audioResource.index.title') }}
            </h1>
            <p class="mt-3 max-w-2xl text-base leading-7 text-white/68">
              {{ t('audioResource.index.subtitle') }}
            </p>
          </div>

          <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div class="audio-filter auth-field">
              <label class="sr-only" for="audio-mode-filter">
                {{ t('audioResource.index.filter') }}
              </label>
              <Select
                input-id="audio-mode-filter"
                v-model="selectedModeId"
                :options="modeOptions"
                option-label="label"
                option-value="value"
                class="!w-full sm:!w-56"
                :loading="isLoadingModes"
              />
            </div>

            <RouterLink v-if="auth.isAdmin" to="/audios/create">
              <Button
                :label="t('audioResource.actions.create')"
                icon="pi pi-plus"
                class="theme-primary-button !justify-center"
              />
            </RouterLink>
          </div>
        </div>
      </div>

      <div
        v-if="successMessage"
        class="theme-success-panel mt-6 rounded-[8px] border px-4 py-3 text-sm leading-6"
      >
        {{ successMessage }}
      </div>

      <div
        v-if="error"
        class="mt-6 rounded-[8px] border border-red-300/30 bg-red-500/10 px-4 py-3 text-sm leading-6 text-red-100"
      >
        {{ error }}
      </div>

      <section class="mt-6 grid gap-3 sm:grid-cols-3">
        <div class="audio-stat-panel">
          <span class="audio-stat-value">{{ totalAudios }}</span>
          <span class="audio-stat-label">{{ t('audioResource.index.total') }}</span>
        </div>
        <div class="audio-stat-panel">
          <span class="audio-stat-value">{{ assignedAudios.length }}</span>
          <span class="audio-stat-label">{{ t('audioResource.index.assigned') }}</span>
        </div>
        <div class="audio-stat-panel">
          <span class="audio-stat-value">{{ unassignedAudios }}</span>
          <span class="audio-stat-label">{{ t('audioResource.index.unassigned') }}</span>
        </div>
      </section>

      <section class="mt-6">
        <div v-if="isLoading" class="audio-empty-panel">
          {{ t('audioResource.index.loading') }}
        </div>

        <div v-else-if="sortedAudios.length === 0" class="audio-empty-panel">
          {{ t('audioResource.index.empty') }}
        </div>

        <div v-else class="grid gap-4 lg:grid-cols-2">
          <article
            v-for="audio in sortedAudios"
            :key="audioId(audio)"
            class="audio-card"
            :style="audioCardStyle(audio)"
          >
            <RouterLink
              :to="{ name: 'audios-show', params: { id: audio.id } }"
              class="audio-card-main"
            >
              <span class="audio-card-wave" aria-hidden="true">
                <span v-for="beat in 18" :key="beat" />
              </span>
              <span class="audio-card-disc" aria-hidden="true">
                <span />
              </span>

              <div class="relative z-10 flex items-start justify-between gap-4">
                <div class="min-w-0">
                  <Tag :value="audioModeName(audio)" class="audio-mode-tag" />
                  <h2 class="mt-4 break-words text-3xl font-semibold leading-tight text-white">
                    {{ audio.name }}
                  </h2>
                </div>
                <span class="audio-card-id">#{{ audio.id }}</span>
              </div>
            </RouterLink>

            <div class="audio-card-player">
              <AudioPlayer
                :src="audioSourceUrl(audio)"
                :title="audio.name"
                :subtitle="audioModeName(audio)"
                compact
              />
            </div>

            <div class="audio-card-footer">
              <RouterLink :to="{ name: 'audios-show', params: { id: audio.id } }">
                <Button
                  :label="t('audioResource.actions.listen')"
                  icon="pi pi-play"
                  class="theme-soft-button !justify-center"
                />
              </RouterLink>

              <div v-if="auth.isAdmin" class="flex items-center gap-1">
                <RouterLink :to="{ name: 'audios-edit', params: { id: audio.id } }">
                  <Button
                    icon="pi pi-pencil"
                    severity="secondary"
                    text
                    rounded
                    :aria-label="t('audioResource.actions.edit')"
                    class="!text-white/72 hover:!bg-white/10"
                  />
                </RouterLink>
                <Button
                  icon="pi pi-trash"
                  severity="danger"
                  text
                  rounded
                  :loading="deletingAudioId === audio.id"
                  :aria-label="t('audioResource.actions.delete')"
                  class="hover:!bg-red-500/10"
                  @click="deleteAudio(audio)"
                />
              </div>
            </div>
          </article>
        </div>

        <PaginationControls
          class="mt-6"
          :meta="pagination"
          :loading="isLoading"
          @page-change="loadAudios"
        />
      </section>
    </section>
  </main>
</template>

<style scoped>
.audio-page {
  background:
    radial-gradient(circle at 80% 8%, rgba(255, 186, 73, 0.13), transparent 32rem),
    radial-gradient(circle at 8% 70%, rgba(141, 242, 223, 0.14), transparent 34rem),
    linear-gradient(180deg, #050b0b 0%, #081512 48%, #050707 100%);
}

.audio-hero {
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  background:
    linear-gradient(120deg, rgba(141, 242, 223, 0.14), transparent 45%),
    linear-gradient(290deg, rgba(255, 186, 73, 0.12), transparent 38%), rgba(7, 16, 14, 0.76);
  padding: 1.25rem;
  box-shadow: 0 24px 90px rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(22px);
}

.audio-hero-grid,
.audio-hero-orbit {
  position: absolute;
  pointer-events: none;
}

.audio-hero-grid {
  inset: -35%;
  background: repeating-linear-gradient(
    90deg,
    rgba(255, 255, 255, 0.04) 0 0.05rem,
    transparent 0.05rem 1.2rem
  );
  opacity: 0.42;
  transform: rotate(-12deg);
}

.audio-hero-orbit {
  right: -5rem;
  bottom: -7rem;
  width: 21rem;
  height: 21rem;
}

.audio-hero-orbit span {
  position: absolute;
  inset: 0;
  border: 1px solid rgba(141, 242, 223, 0.18);
  border-radius: 999px;
}

.audio-hero-orbit span:nth-child(2) {
  inset: 2rem;
  border-color: rgba(255, 186, 73, 0.2);
}

.audio-hero-orbit span:nth-child(3) {
  inset: 4rem;
}

.audio-stat-panel,
.audio-empty-panel {
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  background: rgba(7, 16, 14, 0.78);
  box-shadow: 0 18px 60px rgba(0, 0, 0, 0.2);
  backdrop-filter: blur(18px);
}

.audio-stat-panel {
  min-height: 6.3rem;
  padding: 1rem;
}

.audio-stat-value {
  display: block;
  color: #ffffff;
  font-size: 1.35rem;
  font-weight: 700;
  line-height: 1.1;
}

.audio-stat-label {
  display: block;
  margin-top: 0.55rem;
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0;
  line-height: 1.2;
  text-transform: uppercase;
}

.audio-empty-panel {
  padding: 3rem 1.25rem;
  text-align: center;
  color: rgba(255, 255, 255, 0.62);
  font-size: 0.875rem;
}

.audio-card {
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(var(--resource-mode-rgb), 0.28);
  border-radius: 8px;
  background:
    linear-gradient(120deg, rgba(var(--resource-mode-rgb), 0.22), transparent 44%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.045), transparent 65%), #050706;
  box-shadow: 0 24px 90px rgba(0, 0, 0, 0.3);
}

.audio-card-main {
  position: relative;
  display: block;
  min-height: 13rem;
  overflow: hidden;
  padding: 1.1rem;
  color: inherit;
}

.audio-card-wave {
  position: absolute;
  right: 1rem;
  bottom: 1.2rem;
  left: 1rem;
  display: flex;
  height: 5.2rem;
  align-items: center;
  gap: 0.32rem;
  opacity: 0.76;
}

.audio-card-wave span {
  flex: 1;
  min-width: 0.2rem;
  height: 52%;
  border-radius: 999px;
  background: color-mix(in srgb, var(--resource-mode-color), #ffffff 16%);
  box-shadow: 0 0 1rem rgba(var(--resource-mode-rgb), 0.34);
  transform: scaleY(0.44);
  transform-origin: center;
  animation: audioWave var(--resource-mode-wave-duration) ease-in-out infinite;
}

.audio-card-wave span:nth-child(2n) {
  animation-delay: -0.28s;
}

.audio-card-wave span:nth-child(3n) {
  animation-delay: -0.58s;
}

.audio-card-wave span:nth-child(4n) {
  animation-delay: -0.86s;
}

.audio-card-disc {
  position: absolute;
  right: 1.25rem;
  top: 1.1rem;
  display: grid;
  width: 5.8rem;
  height: 5.8rem;
  place-items: center;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 999px;
  background:
    repeating-radial-gradient(circle, transparent 0 0.38rem, rgba(255, 255, 255, 0.08) 0.42rem 0.48rem),
    rgba(0, 0, 0, 0.28);
  opacity: 0.65;
}

.audio-card-disc span {
  width: 1rem;
  height: 1rem;
  border-radius: 999px;
  background: var(--resource-mode-color);
}

.audio-mode-tag {
  border-color: rgba(var(--resource-mode-rgb), 0.32) !important;
  background: rgba(var(--resource-mode-rgb), 0.14) !important;
  color: color-mix(in srgb, var(--resource-mode-color), #ffffff 28%) !important;
}

.audio-card-id {
  position: relative;
  z-index: 10;
  color: rgba(255, 255, 255, 0.42);
  font-size: 0.82rem;
  font-weight: 800;
}

.audio-card-player {
  padding: 0 1.1rem 1.1rem;
}

.audio-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  padding: 0.9rem 1rem;
}

@media (min-width: 640px) {
  .audio-hero {
    padding: 1.5rem;
  }
}

@keyframes audioWave {
  0%,
  100% {
    transform: scaleY(0.38);
  }

  48% {
    transform: scaleY(var(--resource-mode-wave-scale));
  }

  72% {
    transform: scaleY(0.72);
  }
}

@media (prefers-reduced-motion: reduce) {
  .audio-card-wave span {
    animation: none;
  }
}
</style>
