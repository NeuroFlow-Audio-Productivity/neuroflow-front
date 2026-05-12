<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'

import AppNavbar from '@/components/AppNavbar.vue'
import { ApiError } from '@/services/authApi'
import { translateApiKey, translateApiMessage } from '@/services/apiMessageTranslator'
import { modeApi } from '@/services/modeApi'
import {
  modeRhythmStyle,
  modeSemanticKey,
  modeVisualStyle,
  normalizeModeColor,
} from '@/services/modeVisuals'
import { useAuthStore } from '@/stores/auth'
import type { Mode } from '@/types/mode'

const { t, locale } = useI18n()
const auth = useAuthStore()

const modes = ref<Mode[]>([])
const isLoading = ref(false)
const deletingModeId = ref<number | null>(null)
const error = ref<string | null>(null)
const successMessage = ref<string | null>(null)

const sortedModes = computed(() => [...modes.value].sort((a, b) => a.id - b.id))

const latestUpdatedAt = computed(() =>
  sortedModes.value.reduce<string | null>((latest, mode) => {
    if (!latest) return mode.updated_at

    return new Date(mode.updated_at).getTime() > new Date(latest).getTime()
      ? mode.updated_at
      : latest
  }, null),
)

const formatDate = (value: string | null | undefined) => {
  if (!value) return '-'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat(locale.value, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

const translatedModeName = (mode: Mode) => {
  const key = modeSemanticKey(mode)

  return key ? t(`modes.${key}.label`) : mode.name
}

const translatedModeDescription = (mode: Mode) => {
  const key = modeSemanticKey(mode)

  return key ? t(`modes.${key}.description`) : mode.description
}

const modeCardStyle = (mode: Mode) => ({
  ...modeVisualStyle(mode.color),
  ...modeRhythmStyle(mode),
})

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

  isLoading.value = true
  error.value = null

  try {
    const response = await modeApi.listModes(auth.token)

    modes.value = response.data
  } catch (caughtError) {
    setError(caughtError, 'modeResource.errors.loadModes')
  } finally {
    isLoading.value = false
  }
}

const deleteMode = async (mode: Mode) => {
  if (!auth.token || !auth.isAdmin) return

  const confirmed = window.confirm(
    t('modeResource.confirmDelete', { name: translatedModeName(mode) }),
  )

  if (!confirmed) return

  deletingModeId.value = mode.id
  error.value = null
  successMessage.value = null

  try {
    await modeApi.deleteMode(auth.token, mode.id)

    modes.value = modes.value.filter((item) => item.id !== mode.id)
    successMessage.value = t('modeResource.feedback.deleted')
  } catch (caughtError) {
    setError(caughtError, 'modeResource.errors.delete')
  } finally {
    deletingModeId.value = null
  }
}

onMounted(() => {
  void loadModes()
})
</script>

<template>
  <main class="modes-page dark min-h-screen px-4 py-4 text-[#f7fbf8] sm:px-6 lg:px-8">
    <AppNavbar />

    <section class="mx-auto max-w-7xl py-8 sm:py-10">
      <div class="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p class="text-sm font-semibold uppercase text-[var(--mode-accent)]">
            {{ t('modeResource.index.eyebrow') }}
          </p>
          <h1 class="mt-3 text-4xl font-semibold leading-tight text-white sm:text-5xl">
            {{ t('modeResource.index.title') }}
          </h1>
          <p class="mt-3 max-w-2xl text-base leading-7 text-white/66">
            {{ t('modeResource.index.subtitle') }}
          </p>
        </div>

        <RouterLink v-if="auth.isAdmin" to="/modes/create">
          <Button
            :label="t('modeResource.actions.create')"
            icon="pi pi-plus"
            class="theme-primary-button !justify-center"
          />
        </RouterLink>
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
        <div class="mode-stat-panel">
          <span class="mode-stat-value">{{ sortedModes.length }}</span>
          <span class="mode-stat-label">{{ t('modeResource.index.total') }}</span>
        </div>
        <div class="mode-stat-panel">
          <span class="mode-stat-value">{{ formatDate(latestUpdatedAt) }}</span>
          <span class="mode-stat-label">{{ t('modeResource.fields.updatedAt') }}</span>
        </div>
        <div class="mode-stat-panel mode-stat-panel--color">
          <span class="mode-spectrum" aria-hidden="true">
            <span
              v-for="mode in sortedModes.slice(0, 5)"
              :key="mode.id"
              :style="{ backgroundColor: normalizeModeColor(mode.color) }"
            />
          </span>
          <span class="mode-stat-label">{{ t('modeResource.fields.color') }}</span>
        </div>
      </section>

      <section class="mt-6">
        <div
          v-if="isLoading"
          class="rounded-[8px] border border-white/12 bg-[#07100e]/86 px-5 py-12 text-center text-sm text-white/62 shadow-[0_24px_90px_rgba(0,0,0,0.28)] backdrop-blur-2xl"
        >
          {{ t('modeResource.index.loading') }}
        </div>

        <div
          v-else-if="sortedModes.length === 0"
          class="rounded-[8px] border border-white/12 bg-[#07100e]/86 px-5 py-12 text-center text-sm text-white/62 shadow-[0_24px_90px_rgba(0,0,0,0.28)] backdrop-blur-2xl"
        >
          {{ t('modeResource.index.empty') }}
        </div>

        <div v-else class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <article
            v-for="mode in sortedModes"
            :key="mode.id"
            class="mode-card"
            :style="modeCardStyle(mode)"
          >
            <RouterLink
              :to="{ name: 'modes-show', params: { id: mode.id } }"
              class="mode-card-main"
            >
              <span class="mode-card-wave" aria-hidden="true">
                <span v-for="beat in 10" :key="beat" />
              </span>

              <span class="relative z-10 text-xs font-semibold uppercase text-white/48">
                #{{ mode.id }} / {{ normalizeModeColor(mode.color) }}
              </span>

              <h2 class="relative z-10 mt-8 text-3xl font-semibold leading-tight text-white">
                {{ translatedModeName(mode) }}
              </h2>
              <p class="relative z-10 mt-4 text-sm leading-6 text-white/68">
                {{ translatedModeDescription(mode) }}
              </p>
            </RouterLink>

            <div class="mode-card-footer">
              <span class="text-xs font-semibold text-white/46">
                {{ formatDate(mode.updated_at) }}
              </span>

              <div v-if="auth.isAdmin" class="flex items-center gap-1">
                <RouterLink :to="{ name: 'modes-edit', params: { id: mode.id } }">
                  <Button
                    icon="pi pi-pencil"
                    severity="secondary"
                    text
                    rounded
                    :aria-label="t('modeResource.actions.edit')"
                    class="!text-white/72 hover:!bg-white/10"
                  />
                </RouterLink>
                <Button
                  icon="pi pi-trash"
                  severity="danger"
                  text
                  rounded
                  :loading="deletingModeId === mode.id"
                  :aria-label="t('modeResource.actions.delete')"
                  class="hover:!bg-red-500/10"
                  @click="deleteMode(mode)"
                />
              </div>
            </div>
          </article>
        </div>
      </section>
    </section>
  </main>
</template>

<style scoped>
.modes-page {
  background:
    radial-gradient(circle at 76% 10%, rgba(var(--mode-companion-rgb), 0.14), transparent 34rem),
    radial-gradient(circle at 6% 68%, rgba(var(--mode-glow-rgb), 0.12), transparent 32rem),
    linear-gradient(180deg, #06100e 0%, #081512 48%, #06100e 100%);
}

.mode-stat-panel {
  min-height: 6.3rem;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  background: rgba(7, 16, 14, 0.72);
  padding: 1rem;
  box-shadow: 0 18px 60px rgba(0, 0, 0, 0.2);
  backdrop-filter: blur(18px);
}

.mode-stat-value {
  display: block;
  color: #ffffff;
  font-size: 1.35rem;
  font-weight: 700;
  line-height: 1.1;
  overflow-wrap: anywhere;
}

.mode-stat-label {
  display: block;
  margin-top: 0.55rem;
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0;
  line-height: 1.2;
  text-transform: uppercase;
}

.mode-spectrum {
  display: flex;
  min-height: 1.65rem;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
}

.mode-spectrum span {
  flex: 1 1 0;
  min-width: 2.5rem;
}

.mode-stat-panel--color {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.mode-card {
  position: relative;
  min-height: 22rem;
  overflow: hidden;
  border: 1px solid rgba(var(--resource-mode-rgb), 0.34);
  border-radius: 8px;
  background:
    linear-gradient(105deg, rgba(var(--resource-mode-rgb), 0.24), transparent 38%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.04), transparent 52%),
    linear-gradient(145deg, rgba(var(--resource-mode-rgb), 0.13), rgba(7, 16, 14, 0.94) 52%);
  box-shadow: 0 24px 90px rgba(0, 0, 0, 0.28);
}

.mode-card::before {
  position: absolute;
  inset: -20%;
  background:
    repeating-linear-gradient(
      90deg,
      transparent 0 0.95rem,
      rgba(var(--resource-mode-rgb), 0.14) 0.98rem 1.06rem,
      transparent 1.1rem 2.15rem
    ),
    repeating-linear-gradient(
      0deg,
      transparent 0 3.5rem,
      rgba(255, 255, 255, 0.055) 3.55rem 3.62rem,
      transparent 3.68rem 7rem
    );
  content: '';
  opacity: 0.58;
  transform: skewY(-8deg);
  transition:
    opacity 180ms ease,
    transform 260ms ease;
}

.mode-card:hover::before {
  opacity: 0.78;
  transform: skewY(-8deg) translate3d(0.5rem, -0.35rem, 0);
}

.mode-card-main {
  position: relative;
  display: block;
  min-height: 17rem;
  padding: 1.1rem;
  color: inherit;
}

.mode-card-wave {
  position: absolute;
  top: 1rem;
  right: 1rem;
  display: flex;
  width: 7rem;
  height: 4.8rem;
  align-items: center;
  justify-content: center;
  gap: 0.32rem;
  border: 1px solid rgba(var(--resource-mode-rgb), 0.32);
  border-radius: 8px;
  background: rgba(3, 6, 5, 0.42);
  box-shadow:
    inset 0 0 2.4rem rgba(var(--resource-mode-rgb), 0.18),
    0 1rem 3rem rgba(0, 0, 0, 0.18);
  backdrop-filter: blur(16px);
}

.mode-card-wave span {
  display: block;
  width: 0.28rem;
  height: var(--bar-height, 2.4rem);
  border-radius: 999px;
  background: color-mix(in srgb, var(--resource-mode-color), #ffffff 12%);
  box-shadow: 0 0 1rem rgba(var(--resource-mode-rgb), 0.48);
  opacity: 0.86;
  transform: scaleY(0.52);
  transform-origin: center;
  animation: modeCardWave var(--resource-mode-wave-duration) ease-in-out infinite;
}

.mode-card-wave span:nth-child(2) {
  --bar-height: 3.1rem;
  animation-delay: -0.4s;
}

.mode-card-wave span:nth-child(3) {
  --bar-height: 2rem;
  animation-delay: -0.8s;
}

.mode-card-wave span:nth-child(4) {
  --bar-height: 3.5rem;
  animation-delay: -1.2s;
}

.mode-card-wave span:nth-child(5) {
  --bar-height: 2.4rem;
  animation-delay: -1.6s;
}

.mode-card-wave span:nth-child(6) {
  --bar-height: 3.7rem;
  animation-delay: -2s;
}

.mode-card-wave span:nth-child(7) {
  --bar-height: 2.2rem;
  animation-delay: -2.4s;
}

.mode-card-wave span:nth-child(8) {
  --bar-height: 3rem;
  animation-delay: -2.8s;
}

.mode-card-wave span:nth-child(9) {
  --bar-height: 1.8rem;
  animation-delay: -3.2s;
}

.mode-card-wave span:nth-child(10) {
  --bar-height: 2.7rem;
  animation-delay: -3.6s;
}

.mode-card-footer {
  position: relative;
  z-index: 1;
  display: flex;
  min-height: 4rem;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  border-top: 1px solid rgba(255, 255, 255, 0.09);
  padding: 0.55rem 0.75rem 0.65rem 1rem;
}

@keyframes modeCardWave {
  0%,
  100% {
    transform: scaleY(0.5);
  }

  42% {
    transform: scaleY(var(--resource-mode-wave-scale));
  }

  68% {
    transform: scaleY(0.72);
  }
}

@media (prefers-reduced-motion: reduce) {
  .mode-card-wave span {
    animation: none;
    transform: scaleY(0.8);
  }
}
</style>
