<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import Button from 'primevue/button'

import AppNavbar from '@/components/AppNavbar.vue'
import { ApiError } from '@/services/authApi'
import { translateApiKey, translateApiMessage } from '@/services/apiMessageTranslator'
import { modeApi } from '@/services/modeApi'
import { modeVisualStyle, normalizeModeColor } from '@/services/modeVisuals'
import { useAuthStore } from '@/stores/auth'
import type { Mode } from '@/types/mode'

const { t, locale } = useI18n()
const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const mode = ref<Mode | null>(null)
const isLoading = ref(false)
const isDeleting = ref(false)
const error = ref<string | null>(null)

const modeId = computed(() => {
  const id = Number(route.params.id)

  return Number.isFinite(id) ? id : null
})

const pageStyle = computed(() => modeVisualStyle(mode.value?.color))
const modeColor = computed(() => normalizeModeColor(mode.value?.color))

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

const loadMode = async () => {
  if (!auth.token) return

  if (!modeId.value) {
    error.value = t('modeResource.errors.missingMode')
    return
  }

  isLoading.value = true
  error.value = null

  try {
    mode.value = await modeApi.getMode(auth.token, modeId.value)
  } catch (caughtError) {
    setError(caughtError, 'modeResource.errors.loadMode')
  } finally {
    isLoading.value = false
  }
}

const deleteMode = async () => {
  if (!auth.token || !auth.isAdmin || !mode.value) return

  const confirmed = window.confirm(t('modeResource.confirmDelete', { name: mode.value.name }))

  if (!confirmed) return

  isDeleting.value = true
  error.value = null

  try {
    await modeApi.deleteMode(auth.token, mode.value.id)
    await router.push({ name: 'modes-index' })
  } catch (caughtError) {
    setError(caughtError, 'modeResource.errors.delete')
  } finally {
    isDeleting.value = false
  }
}

watch(
  () => route.params.id,
  () => {
    void loadMode()
  },
  { immediate: true },
)
</script>

<template>
  <main
    class="mode-show-page dark min-h-screen overflow-hidden px-4 py-4 text-[#f7fbf8] sm:px-6 lg:px-8"
    :style="pageStyle"
  >
    <AppNavbar />

    <section class="mx-auto max-w-7xl py-8 sm:py-10">
      <RouterLink
        class="mode-back-link inline-flex items-center gap-2 text-sm font-semibold"
        to="/modes"
      >
        <i class="pi pi-arrow-left text-xs" aria-hidden="true" />
        <span>{{ t('modeResource.actions.back') }}</span>
      </RouterLink>

      <div
        v-if="error"
        class="mt-6 rounded-[8px] border border-red-300/30 bg-red-500/10 px-4 py-3 text-sm leading-6 text-red-100"
      >
        {{ error }}
      </div>

      <section v-if="isLoading" class="mode-loading-stage mt-6">
        {{ t('modeResource.show.loading') }}
      </section>

      <template v-else-if="mode">
        <section class="mode-stage mt-6">
          <div class="mode-ridge-field" aria-hidden="true" />
          <div class="mode-heat-field" aria-hidden="true" />

          <div class="mode-stage-copy">
            <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p class="text-sm font-semibold uppercase text-[var(--resource-mode-color)]">
                  {{ t('modeResource.show.eyebrow') }}
                </p>
                <h1 class="mt-4 text-5xl font-semibold leading-none text-white sm:text-6xl">
                  {{ mode.name }}
                </h1>
              </div>

              <div v-if="auth.isAdmin" class="relative z-10 flex flex-wrap gap-2">
                <RouterLink :to="{ name: 'modes-edit', params: { id: mode.id } }">
                  <Button
                    :label="t('modeResource.actions.edit')"
                    icon="pi pi-pencil"
                    class="theme-primary-button !justify-center"
                  />
                </RouterLink>
                <Button
                  :label="t('modeResource.actions.delete')"
                  icon="pi pi-trash"
                  severity="danger"
                  :loading="isDeleting"
                  @click="deleteMode"
                />
              </div>
            </div>

            <p class="relative z-10 mt-6 max-w-2xl text-lg leading-8 text-white/72">
              {{ mode.description }}
            </p>

            <dl class="mode-detail-strip relative z-10 mt-8">
              <div>
                <dt>{{ t('modeResource.fields.color') }}</dt>
                <dd>
                  <span class="mode-swatch" aria-hidden="true" />
                  <span>{{ modeColor }}</span>
                </dd>
              </div>
              <div>
                <dt>{{ t('modeResource.fields.id') }}</dt>
                <dd>#{{ mode.id }}</dd>
              </div>
              <div>
                <dt>{{ t('modeResource.fields.updatedAt') }}</dt>
                <dd>{{ formatDate(mode.updated_at) }}</dd>
              </div>
            </dl>
          </div>

          <div class="mode-dimensional-scene" aria-hidden="true">
            <div class="mode-glow-pool" />
            <div class="mode-slab mode-slab--rear" />
            <div class="mode-slab mode-slab--front">
              <span />
            </div>
            <div class="mode-disc mode-disc--large" />
            <div class="mode-disc mode-disc--small" />
          </div>

          <div class="mode-light-track" aria-hidden="true">
            <span />
          </div>
        </section>

        <section class="mode-info-grid mt-6">
          <div>
            <span>{{ t('modeResource.fields.createdAt') }}</span>
            <strong>{{ formatDate(mode.created_at) }}</strong>
          </div>
          <div>
            <span>{{ t('modeResource.fields.updatedAt') }}</span>
            <strong>{{ formatDate(mode.updated_at) }}</strong>
          </div>
          <div>
            <span>{{ t('modeResource.fields.color') }}</span>
            <strong>{{ modeColor }}</strong>
          </div>
        </section>
      </template>
    </section>
  </main>
</template>

<style scoped>
.mode-show-page {
  background:
    radial-gradient(circle at 74% 8%, rgba(var(--resource-mode-rgb), 0.22), transparent 34rem),
    radial-gradient(circle at 6% 82%, rgba(var(--resource-mode-rgb), 0.14), transparent 30rem),
    linear-gradient(180deg, #050807 0%, #081512 50%, #040706 100%);
}

.mode-back-link {
  color: var(--resource-mode-color);
  transition: color 160ms ease;
}

.mode-back-link:hover {
  color: color-mix(in srgb, var(--resource-mode-color), #ffffff 34%);
}

.mode-loading-stage,
.mode-stage {
  border: 1px solid rgba(var(--resource-mode-rgb), 0.28);
  border-radius: 8px;
  background: #050706;
  box-shadow: 0 30px 120px rgba(0, 0, 0, 0.42);
}

.mode-loading-stage {
  padding: 4rem 1.25rem;
  text-align: center;
  color: rgba(255, 255, 255, 0.62);
}

.mode-stage {
  position: relative;
  display: grid;
  min-height: 35rem;
  overflow: hidden;
  isolation: isolate;
}

.mode-ridge-field,
.mode-heat-field,
.mode-dimensional-scene,
.mode-light-track {
  position: absolute;
  pointer-events: none;
}

.mode-ridge-field {
  inset: -12% -10%;
  z-index: -3;
  background:
    radial-gradient(circle at 34% 72%, rgba(var(--resource-mode-rgb), 0.18), transparent 18rem),
    repeating-linear-gradient(
      106deg,
      rgba(255, 255, 255, 0.018) 0 0.75rem,
      rgba(255, 255, 255, 0.085) 0.78rem 0.92rem,
      rgba(0, 0, 0, 0.62) 0.95rem 1.85rem
    );
  filter: contrast(1.1);
  opacity: 0.82;
  transform: rotate(-4deg) scale(1.06);
  animation: ridgeDrift 12s ease-in-out infinite alternate;
}

.mode-heat-field {
  inset: auto auto -18% -8%;
  z-index: -2;
  width: 44rem;
  height: 24rem;
  border-radius: 999px;
  background: radial-gradient(circle, rgba(var(--resource-mode-rgb), 0.84), transparent 62%);
  filter: blur(22px);
  opacity: 0.44;
  animation: heatSweep 7s ease-in-out infinite alternate;
}

.mode-stage-copy {
  position: relative;
  z-index: 2;
  display: flex;
  min-height: 35rem;
  flex-direction: column;
  justify-content: flex-end;
  padding: 1.25rem;
}

.mode-detail-strip {
  display: grid;
  max-width: 45rem;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  background: rgba(3, 6, 5, 0.68);
  backdrop-filter: blur(18px);
}

.mode-detail-strip div {
  min-width: 0;
  padding: 1rem;
}

.mode-detail-strip div + div {
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.mode-detail-strip dt,
.mode-info-grid span {
  color: rgba(255, 255, 255, 0.48);
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0;
  line-height: 1.2;
  text-transform: uppercase;
}

.mode-detail-strip dd {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.55rem;
  margin: 0.55rem 0 0;
  color: #ffffff;
  font-size: 0.95rem;
  font-weight: 700;
  overflow-wrap: anywhere;
}

.mode-swatch {
  display: inline-block;
  width: 0.9rem;
  height: 0.9rem;
  flex: 0 0 auto;
  border: 1px solid rgba(255, 255, 255, 0.28);
  border-radius: 999px;
  background: var(--resource-mode-color);
  box-shadow: 0 0 1.6rem rgba(var(--resource-mode-rgb), 0.72);
}

.mode-dimensional-scene {
  right: -2rem;
  bottom: 2.5rem;
  z-index: 1;
  width: min(42rem, 64vw);
  height: min(32rem, 56vw);
  transform: perspective(62rem) rotateX(54deg) rotateZ(-17deg);
  transform-style: preserve-3d;
}

.mode-glow-pool {
  position: absolute;
  right: 4%;
  bottom: -4%;
  width: 76%;
  height: 35%;
  border-radius: 999px;
  background: radial-gradient(circle, rgba(var(--resource-mode-rgb), 0.86), transparent 66%);
  filter: blur(18px);
  opacity: 0.62;
  transform: translateZ(-5rem);
}

.mode-slab,
.mode-disc {
  position: absolute;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.38), rgba(var(--resource-mode-rgb), 0.18)),
    linear-gradient(170deg, rgba(255, 255, 255, 0.1), rgba(0, 0, 0, 0.78));
  box-shadow:
    0 2rem 4rem rgba(0, 0, 0, 0.4),
    inset 0 0 3rem rgba(255, 255, 255, 0.08);
}

.mode-slab {
  width: 58%;
  height: 48%;
  border-radius: 8px;
  transform-style: preserve-3d;
}

.mode-slab--rear {
  right: 14%;
  bottom: 20%;
  transform: translateZ(0) rotateZ(8deg);
}

.mode-slab--front {
  right: 34%;
  bottom: 31%;
  transform: translateZ(7rem) rotateZ(-13deg);
  animation: slabFloat 5s ease-in-out infinite alternate;
}

.mode-slab--front span {
  position: absolute;
  right: 11%;
  bottom: 13%;
  width: 42%;
  height: 0.55rem;
  border-radius: 999px;
  background: var(--resource-mode-color);
  box-shadow: 0 0 2rem rgba(var(--resource-mode-rgb), 0.85);
}

.mode-disc {
  border-radius: 999px;
}

.mode-disc--large {
  right: 28%;
  bottom: 42%;
  width: 8.2rem;
  height: 8.2rem;
  transform: translateZ(10rem);
  animation: discFloat 5.5s ease-in-out infinite alternate;
}

.mode-disc--small {
  right: 20%;
  bottom: 33%;
  width: 5.2rem;
  height: 5.2rem;
  transform: translateZ(12rem);
  animation: discFloat 4.8s ease-in-out infinite alternate-reverse;
}

.mode-light-track {
  right: 1.25rem;
  bottom: 1.1rem;
  left: 1.25rem;
  z-index: 3;
  height: 0.55rem;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.28);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.12);
}

.mode-light-track span {
  display: block;
  width: 42%;
  height: 100%;
  border-radius: inherit;
  background: var(--resource-mode-color);
  box-shadow: 0 0 1.4rem rgba(var(--resource-mode-rgb), 0.85);
  animation: lightTrack 4.2s ease-in-out infinite alternate;
}

.mode-info-grid {
  display: grid;
  gap: 0.75rem;
}

.mode-info-grid div {
  min-height: 5.2rem;
  border: 1px solid rgba(var(--resource-mode-rgb), 0.22);
  border-radius: 8px;
  background: rgba(7, 16, 14, 0.76);
  padding: 1rem;
  backdrop-filter: blur(18px);
}

.mode-info-grid strong {
  display: block;
  margin-top: 0.55rem;
  color: #ffffff;
  font-size: 1rem;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

@keyframes ridgeDrift {
  from {
    transform: rotate(-4deg) scale(1.06) translate3d(-0.6rem, 0, 0);
  }

  to {
    transform: rotate(-4deg) scale(1.08) translate3d(0.9rem, -0.45rem, 0);
  }
}

@keyframes heatSweep {
  from {
    transform: translate3d(0, 0, 0) scale(0.92);
  }

  to {
    transform: translate3d(12rem, -4rem, 0) scale(1.12);
  }
}

@keyframes slabFloat {
  from {
    transform: translateZ(7rem) rotateZ(-13deg) translate3d(0, 0, 0);
  }

  to {
    transform: translateZ(8.4rem) rotateZ(-10deg) translate3d(0.6rem, -0.45rem, 0);
  }
}

@keyframes discFloat {
  from {
    translate: 0 0;
  }

  to {
    translate: 0.45rem -0.7rem;
  }
}

@keyframes lightTrack {
  from {
    transform: translateX(0);
  }

  to {
    transform: translateX(138%);
  }
}

@media (min-width: 640px) {
  .mode-stage-copy {
    padding: 2rem;
  }

  .mode-detail-strip {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .mode-detail-strip div + div {
    border-top: 0;
    border-left: 1px solid rgba(255, 255, 255, 0.1);
  }

  .mode-info-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 767px) {
  .mode-stage {
    min-height: 42rem;
  }

  .mode-stage-copy {
    justify-content: flex-start;
    padding-top: 1.5rem;
  }

  .mode-dimensional-scene {
    right: -8rem;
    bottom: 4rem;
    width: 34rem;
    height: 26rem;
    opacity: 0.86;
  }
}

@media (prefers-reduced-motion: reduce) {
  .mode-ridge-field,
  .mode-heat-field,
  .mode-slab--front,
  .mode-disc,
  .mode-light-track span {
    animation: none;
  }
}
</style>
