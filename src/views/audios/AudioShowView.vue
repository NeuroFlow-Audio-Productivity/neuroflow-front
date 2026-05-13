<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import Button from 'primevue/button'

import AppNavbar from '@/components/AppNavbar.vue'
import AudioPlayer from '@/components/audios/AudioPlayer.vue'
import { useThemedConfirm } from '@/composables/useThemedConfirm'
import { ApiError } from '@/services/authApi'
import { translateApiKey, translateApiMessage } from '@/services/apiMessageTranslator'
import { audioApi, audioSourceUrl } from '@/services/audioApi'
import { modeRhythmStyle, modeSemanticKey, modeVisualStyle } from '@/services/modeVisuals'
import { useAuthStore } from '@/stores/auth'

const { t, locale } = useI18n()
const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const { confirmDanger } = useThemedConfirm()

const audio = ref<Awaited<ReturnType<typeof audioApi.getAudio>> | null>(null)
const isLoading = ref(false)
const isDeleting = ref(false)
const error = ref<string | null>(null)

const audioId = computed(() => {
  const id = route.params.id

  return typeof id === 'string' && id.trim() ? id : null
})

const pageStyle = computed(() => ({
  ...modeVisualStyle(audio.value?.mode?.color),
  ...modeRhythmStyle(audio.value?.mode),
}))

const sourceUrl = computed(() => audioSourceUrl(audio.value))

const modeName = computed(() => {
  const mode = audio.value?.mode

  if (!mode) return t('audioResource.fields.unassigned')

  const key = modeSemanticKey(mode)

  return key ? t(`modes.${key}.label`) : mode.name
})

const sourceName = computed(() => {
  const path = audio.value?.path ?? ''
  const parts = path.split('/').filter(Boolean)

  return parts.at(-1) ?? path
})

const formatDate = (value: string | null | undefined) => {
  if (!value) return '-'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat(locale.value, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

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

const loadAudio = async () => {
  if (!auth.token) return

  if (!audioId.value) {
    error.value = t('audioResource.errors.missingAudio')
    return
  }

  isLoading.value = true
  error.value = null

  try {
    audio.value = await audioApi.getAudio(auth.token, audioId.value)
  } catch (caughtError) {
    setError(caughtError, 'audioResource.errors.loadAudio')
  } finally {
    isLoading.value = false
  }
}

const deleteAudio = async () => {
  if (!auth.token || !auth.isAdmin || !audio.value) return

  const confirmed = await confirmDanger({
    message: t('audioResource.confirmDelete', { name: audio.value.name }),
  })

  if (!confirmed) return

  isDeleting.value = true
  error.value = null

  try {
    await audioApi.deleteAudio(auth.token, audio.value.id)
    await router.push({ name: 'audios-index' })
  } catch (caughtError) {
    setError(caughtError, 'audioResource.errors.delete')
  } finally {
    isDeleting.value = false
  }
}

watch(
  () => route.params.id,
  () => {
    void loadAudio()
  },
  { immediate: true },
)
</script>

<template>
  <main
    class="audio-show-page dark min-h-screen overflow-hidden px-4 py-4 text-[#f7fbf8] sm:px-6 lg:px-8"
    :style="pageStyle"
  >
    <AppNavbar />

    <section class="mx-auto max-w-7xl py-8 sm:py-10">
      <RouterLink
        class="audio-back-link inline-flex items-center gap-2 text-sm font-semibold"
        to="/audios"
      >
        <i class="pi pi-arrow-left text-xs" aria-hidden="true" />
        <span>{{ t('audioResource.actions.back') }}</span>
      </RouterLink>

      <div
        v-if="error"
        class="mt-6 rounded-[8px] border border-red-300/30 bg-red-500/10 px-4 py-3 text-sm leading-6 text-red-100"
      >
        {{ error }}
      </div>

      <section v-if="isLoading" class="audio-loading-stage mt-6">
        {{ t('audioResource.show.loading') }}
      </section>

      <template v-else-if="audio">
        <section class="audio-stage mt-6">
          <div class="audio-stage-grid" aria-hidden="true" />
          <div class="audio-stage-spectrum" aria-hidden="true">
            <span v-for="band in 24" :key="band" />
          </div>

          <div class="audio-stage-copy">
            <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div class="min-w-0">
                <p class="text-sm font-semibold uppercase text-[var(--resource-mode-color)]">
                  {{ t('audioResource.show.eyebrow') }}
                </p>
                <h1 class="mt-4 break-words text-5xl font-semibold leading-none text-white sm:text-6xl">
                  {{ audio.name }}
                </h1>
              </div>

              <div v-if="auth.isAdmin" class="relative z-10 flex flex-wrap gap-2">
                <RouterLink :to="{ name: 'audios-edit', params: { id: audio.id } }">
                  <Button
                    :label="t('audioResource.actions.edit')"
                    icon="pi pi-pencil"
                    class="theme-primary-button !justify-center"
                  />
                </RouterLink>
                <Button
                  :label="t('audioResource.actions.delete')"
                  icon="pi pi-trash"
                  severity="danger"
                  :loading="isDeleting"
                  @click="deleteAudio"
                />
              </div>
            </div>

            <div class="audio-player-panel">
              <AudioPlayer
                :src="sourceUrl"
                :title="sourceName"
                :subtitle="`${t('audioResource.show.nowPlaying')} · ${modeName}`"
              />
            </div>

            <dl class="audio-detail-grid">
              <div>
                <dt>{{ t('audioResource.fields.id') }}</dt>
                <dd>#{{ audio.id }}</dd>
              </div>
              <div>
                <dt>{{ t('audioResource.fields.mode') }}</dt>
                <dd>{{ modeName }}</dd>
              </div>
              <div>
                <dt>{{ t('audioResource.fields.createdAt') }}</dt>
                <dd>{{ formatDate(audio.created_at) }}</dd>
              </div>
              <div>
                <dt>{{ t('audioResource.fields.updatedAt') }}</dt>
                <dd>{{ formatDate(audio.updated_at) }}</dd>
              </div>
              <div class="sm:col-span-2">
                <dt>{{ t('audioResource.fields.path') }}</dt>
                <dd class="break-all">{{ audio.path }}</dd>
              </div>
            </dl>
          </div>
        </section>
      </template>
    </section>
  </main>
</template>

<style scoped>
.audio-show-page {
  background:
    radial-gradient(circle at 72% 8%, rgba(var(--resource-mode-rgb), 0.2), transparent 35rem),
    radial-gradient(circle at 0% 80%, rgba(255, 186, 73, 0.11), transparent 30rem),
    linear-gradient(180deg, #050807 0%, #081512 50%, #040706 100%);
}

.audio-back-link {
  color: var(--resource-mode-color);
  transition: color 160ms ease;
}

.audio-back-link:hover {
  color: color-mix(in srgb, var(--resource-mode-color), #ffffff 34%);
}

.audio-loading-stage,
.audio-stage {
  border: 1px solid rgba(var(--resource-mode-rgb), 0.28);
  border-radius: 8px;
  background: #050706;
  box-shadow: 0 30px 120px rgba(0, 0, 0, 0.42);
}

.audio-loading-stage {
  padding: 4rem 1.25rem;
  text-align: center;
  color: rgba(255, 255, 255, 0.62);
}

.audio-stage {
  position: relative;
  min-height: 38rem;
  overflow: hidden;
  isolation: isolate;
}

.audio-stage-grid,
.audio-stage-spectrum {
  position: absolute;
  pointer-events: none;
}

.audio-stage-grid {
  inset: -16%;
  z-index: -3;
  background:
    linear-gradient(116deg, rgba(var(--resource-mode-rgb), 0.24), transparent 36%),
    repeating-linear-gradient(
      90deg,
      rgba(255, 255, 255, 0.02) 0 1rem,
      rgba(var(--resource-mode-rgb), 0.12) 1.04rem 1.1rem,
      rgba(0, 0, 0, 0.55) 1.14rem 2.25rem
    );
  opacity: 0.78;
  transform: skewY(-7deg) scale(1.05);
}

.audio-stage-spectrum {
  right: 1.25rem;
  bottom: 2rem;
  left: 1.25rem;
  display: flex;
  height: 12rem;
  align-items: flex-end;
  gap: 0.42rem;
  opacity: 0.52;
}

.audio-stage-spectrum span {
  flex: 1;
  height: 54%;
  border-radius: 999px 999px 0 0;
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--resource-mode-color), #ffffff 14%),
    transparent
  );
  transform-origin: bottom;
  animation: showSpectrum var(--resource-mode-wave-duration) ease-in-out infinite;
}

.audio-stage-spectrum span:nth-child(2n) {
  animation-delay: -0.35s;
}

.audio-stage-spectrum span:nth-child(3n) {
  animation-delay: -0.7s;
}

.audio-stage-copy {
  position: relative;
  z-index: 2;
  display: flex;
  min-height: 38rem;
  flex-direction: column;
  justify-content: flex-end;
  padding: 1.25rem;
}

.audio-player-panel {
  margin-top: 2rem;
  max-width: 48rem;
}

.audio-detail-grid {
  display: grid;
  max-width: 54rem;
  margin-top: 1rem;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  background: rgba(3, 6, 5, 0.68);
  backdrop-filter: blur(18px);
}

.audio-detail-grid div {
  min-width: 0;
  padding: 1rem;
}

.audio-detail-grid div + div {
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.audio-detail-grid dt {
  color: rgba(255, 255, 255, 0.48);
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0;
  text-transform: uppercase;
}

.audio-detail-grid dd {
  margin: 0.45rem 0 0;
  color: #ffffff;
  font-size: 1rem;
  font-weight: 700;
}

@media (min-width: 640px) {
  .audio-stage-copy {
    padding: 1.5rem;
  }

  .audio-detail-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .audio-detail-grid div + div {
    border-top: 0;
  }

  .audio-detail-grid div:nth-child(2n) {
    border-left: 1px solid rgba(255, 255, 255, 0.1);
  }

  .audio-detail-grid div:nth-child(n + 3) {
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }
}

@keyframes showSpectrum {
  0%,
  100% {
    transform: scaleY(0.36);
  }

  48% {
    transform: scaleY(var(--resource-mode-wave-scale));
  }

  72% {
    transform: scaleY(0.72);
  }
}

@media (prefers-reduced-motion: reduce) {
  .audio-stage-spectrum span {
    animation: none;
  }
}
</style>
