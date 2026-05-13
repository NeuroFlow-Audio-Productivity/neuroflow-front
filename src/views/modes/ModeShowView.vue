<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import Button from 'primevue/button'

import AppNavbar from '@/components/AppNavbar.vue'
import { useThemedConfirm } from '@/composables/useThemedConfirm'
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

const { t } = useI18n()
const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const { confirmDanger } = useThemedConfirm()

const mode = ref<Mode | null>(null)
const isLoading = ref(false)
const isDeleting = ref(false)
const error = ref<string | null>(null)

const modeId = computed(() => {
  const id = Number(route.params.id)

  return Number.isFinite(id) ? id : null
})

const pageStyle = computed(() => ({
  ...modeVisualStyle(mode.value?.color),
  ...modeRhythmStyle(mode.value),
}))
const translatedModeName = computed(() => {
  if (!mode.value) return ''

  const key = modeSemanticKey(mode.value)

  return key ? t(`modes.${key}.label`) : mode.value.name
})
const translatedModeDescription = computed(() => {
  if (!mode.value) return ''

  const key = modeSemanticKey(mode.value)

  return key ? t(`modes.${key}.description`) : mode.value.description
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

  const confirmed = await confirmDanger({
    message: t('modeResource.confirmDelete', { name: translatedModeName.value }),
  })

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
          <div class="mode-wave-field" aria-hidden="true" />
          <div class="mode-frequency-field" aria-hidden="true" />

          <div class="mode-stage-copy">
            <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p class="text-sm font-semibold uppercase text-[var(--resource-mode-color)]">
                  {{ t('modeResource.show.eyebrow') }}
                </p>
                <h1 class="mt-4 text-5xl font-semibold leading-none text-white sm:text-6xl">
                  {{ translatedModeName }}
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
              {{ translatedModeDescription }}
            </p>

            <dl class="mode-detail-strip relative z-10 mt-8">
              <div>
                <dt>{{ t('modeResource.fields.color') }}</dt>
                <dd class="mode-color-display">
                  <span class="mode-color-preview" aria-hidden="true">
                    <span />
                  </span>
                  <span class="mode-color-ramp" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                  </span>
                  <code class="mode-color-code">{{ normalizeModeColor(mode.color) }}</code>
                </dd>
              </div>
              <div>
                <dt>{{ t('modeResource.fields.id') }}</dt>
                <dd>#{{ mode.id }}</dd>
              </div>
            </dl>
          </div>

          <div class="mode-audio-scene" aria-hidden="true">
            <div class="mode-wave-panel">
              <span class="mode-wave-baseline" />
              <div class="mode-wave-bars">
                <span v-for="bar in 18" :key="`primary-${bar}`" />
              </div>
            </div>
            <div class="mode-wave-panel mode-wave-panel--echo">
              <span class="mode-wave-baseline" />
              <div class="mode-wave-bars">
                <span v-for="bar in 14" :key="`echo-${bar}`" />
              </div>
            </div>
            <div class="mode-spectral-bands">
              <span v-for="band in 7" :key="band" />
            </div>
          </div>

          <div class="mode-signal-track" aria-hidden="true">
            <span />
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

.mode-wave-field,
.mode-frequency-field,
.mode-audio-scene,
.mode-signal-track {
  position: absolute;
  pointer-events: none;
}

.mode-wave-field {
  inset: -12% -10%;
  z-index: -3;
  background:
    linear-gradient(112deg, rgba(var(--resource-mode-rgb), 0.24), transparent 34%),
    linear-gradient(292deg, rgba(var(--resource-mode-rgb), 0.12), transparent 42%),
    repeating-linear-gradient(
      90deg,
      rgba(255, 255, 255, 0.018) 0 0.95rem,
      rgba(var(--resource-mode-rgb), 0.12) 0.98rem 1.06rem,
      rgba(0, 0, 0, 0.56) 1.1rem 2.25rem
    );
  filter: contrast(1.1);
  opacity: 0.76;
  transform: skewY(-6deg) scale(1.06);
  animation: waveFieldDrift var(--resource-mode-band-duration) ease-in-out infinite alternate;
}

.mode-frequency-field {
  inset: 12% -8% auto 8%;
  z-index: -2;
  height: 18rem;
  background: repeating-linear-gradient(
    0deg,
    transparent 0 2.2rem,
    rgba(255, 255, 255, 0.075) 2.25rem 2.3rem,
    transparent 2.35rem 4.6rem
  );
  opacity: 0.5;
  transform: perspective(48rem) rotateX(58deg) rotateZ(-5deg);
  animation: frequencyFloat 9s ease-in-out infinite alternate;
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

.mode-detail-strip dt {
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

.mode-color-display {
  flex-wrap: wrap;
}

.mode-color-preview {
  position: relative;
  display: grid;
  width: 4.5rem;
  height: 4.5rem;
  place-items: center;
  overflow: hidden;
  border: 1px solid rgba(var(--resource-mode-rgb), 0.42);
  border-radius: 8px;
  background:
    linear-gradient(135deg, rgba(var(--resource-mode-rgb), 0.95), rgba(255, 255, 255, 0.14)),
    var(--resource-mode-color);
  box-shadow:
    0 0 2.4rem rgba(var(--resource-mode-rgb), 0.45),
    inset 0 0 2.2rem rgba(255, 255, 255, 0.14);
}

.mode-color-preview::before {
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    115deg,
    transparent 0 0.7rem,
    rgba(255, 255, 255, 0.18) 0.72rem 0.8rem,
    transparent 0.82rem 1.4rem
  );
  content: '';
  opacity: 0.42;
}

.mode-color-preview span {
  position: relative;
  width: 1.15rem;
  height: 1.15rem;
  border-radius: 999px;
  background: var(--resource-mode-color);
  box-shadow: 0 0 1.6rem rgba(0, 0, 0, 0.28);
}

.mode-color-ramp {
  display: grid;
  min-width: min(16rem, 100%);
  flex: 1 1 12rem;
  gap: 0.45rem;
}

.mode-color-ramp span {
  display: block;
  height: 0.75rem;
  border-radius: 999px;
}

.mode-color-ramp span:nth-child(1) {
  background: linear-gradient(90deg, transparent, rgba(var(--resource-mode-rgb), 0.9));
}

.mode-color-ramp span:nth-child(2) {
  background: linear-gradient(
    90deg,
    rgba(var(--resource-mode-rgb), 0.28),
    var(--resource-mode-color),
    rgba(255, 255, 255, 0.42)
  );
}

.mode-color-ramp span:nth-child(3) {
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0.28),
    rgba(var(--resource-mode-rgb), 0.7)
  );
}

.mode-color-code {
  display: inline-flex;
  min-height: 2.05rem;
  align-items: center;
  border: 1px solid rgba(var(--resource-mode-rgb), 0.38);
  border-radius: 999px;
  background: rgba(var(--resource-mode-rgb), 0.12);
  padding: 0.3rem 0.7rem;
  color: #ffffff;
  font-family: inherit;
  font-size: 0.85rem;
  font-weight: 800;
}

.mode-audio-scene {
  right: -1.5rem;
  bottom: 4.2rem;
  z-index: 1;
  width: min(45rem, 66vw);
  height: min(29rem, 48vw);
  transform: perspective(60rem) rotateX(54deg) rotateZ(-10deg);
  transform-style: preserve-3d;
}

.mode-wave-panel {
  position: absolute;
  right: 10%;
  bottom: 30%;
  width: 72%;
  height: 42%;
  overflow: hidden;
  border: 1px solid rgba(var(--resource-mode-rgb), 0.32);
  border-radius: 8px;
  background:
    linear-gradient(108deg, rgba(var(--resource-mode-rgb), 0.18), transparent 48%),
    rgba(3, 6, 5, 0.7);
  box-shadow:
    0 2rem 4.4rem rgba(0, 0, 0, 0.34),
    inset 0 0 4rem rgba(var(--resource-mode-rgb), 0.12);
  transform: translateZ(7rem);
  animation: wavePanelFloat 5.5s ease-in-out infinite alternate;
}

.mode-wave-panel--echo {
  right: 3%;
  bottom: 13%;
  width: 58%;
  height: 30%;
  opacity: 0.58;
  transform: translateZ(2rem);
  animation-duration: 7s;
  animation-direction: alternate-reverse;
}

.mode-wave-baseline {
  position: absolute;
  right: 8%;
  left: 8%;
  top: 50%;
  height: 1px;
  background: rgba(255, 255, 255, 0.16);
}

.mode-wave-bars {
  position: absolute;
  inset: 0.9rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.42rem;
}

.mode-wave-bars span {
  display: block;
  width: 0.42rem;
  height: var(--bar-height, 5.2rem);
  border-radius: 999px;
  background: color-mix(in srgb, var(--resource-mode-color), #ffffff 10%);
  box-shadow: 0 0 1.6rem rgba(var(--resource-mode-rgb), 0.62);
  transform: scaleY(0.44);
  transform-origin: center;
  animation: waveformPulse var(--resource-mode-wave-duration) ease-in-out infinite;
}

.mode-wave-bars span:nth-child(2n) {
  --bar-height: 4.1rem;
  animation-delay: -0.35s;
}

.mode-wave-bars span:nth-child(3n) {
  --bar-height: 6.4rem;
  animation-delay: -0.7s;
}

.mode-wave-bars span:nth-child(4n) {
  --bar-height: 3.4rem;
  animation-delay: -1.05s;
}

.mode-wave-bars span:nth-child(5n) {
  --bar-height: 7.2rem;
  animation-delay: -1.4s;
}

.mode-spectral-bands {
  position: absolute;
  right: 12%;
  bottom: 2%;
  width: 70%;
  height: 38%;
  transform: translateZ(-2rem);
}

.mode-spectral-bands span {
  display: block;
  height: 0.35rem;
  margin-top: 0.86rem;
  border-radius: 999px;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(var(--resource-mode-rgb), 0.82),
    transparent
  );
  opacity: 0.56;
  transform: translateX(-12%);
  animation: spectralBand var(--resource-mode-band-duration) ease-in-out infinite alternate;
}

.mode-spectral-bands span:nth-child(2n) {
  animation-delay: -1.2s;
  opacity: 0.38;
}

.mode-spectral-bands span:nth-child(3n) {
  animation-delay: -2.4s;
  opacity: 0.7;
}

.mode-signal-track {
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

.mode-signal-track span {
  display: block;
  width: 42%;
  height: 100%;
  border-radius: inherit;
  background: var(--resource-mode-color);
  box-shadow: 0 0 1.4rem rgba(var(--resource-mode-rgb), 0.85);
  animation: signalTrack var(--resource-mode-band-duration) ease-in-out infinite alternate;
}

@keyframes waveFieldDrift {
  from {
    transform: skewY(-6deg) scale(1.06) translate3d(-0.6rem, 0, 0);
  }

  to {
    transform: skewY(-6deg) scale(1.08) translate3d(0.9rem, -0.45rem, 0);
  }
}

@keyframes frequencyFloat {
  from {
    transform: perspective(48rem) rotateX(58deg) rotateZ(-5deg) translate3d(-0.4rem, 0, 0);
  }

  to {
    transform: perspective(48rem) rotateX(58deg) rotateZ(-5deg) translate3d(0.9rem, -0.4rem, 0);
  }
}

@keyframes wavePanelFloat {
  from {
    transform: translateZ(7rem) translate3d(0, 0, 0);
  }

  to {
    transform: translateZ(8.2rem) translate3d(0.6rem, -0.45rem, 0);
  }
}

@keyframes waveformPulse {
  0%,
  100% {
    transform: scaleY(0.44);
  }

  45% {
    transform: scaleY(var(--resource-mode-wave-scale));
  }

  72% {
    transform: scaleY(0.64);
  }
}

@keyframes spectralBand {
  from {
    transform: translateX(-12%) scaleX(0.72);
  }

  to {
    transform: translateX(14%) scaleX(1);
  }
}

@keyframes signalTrack {
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
    grid-template-columns: minmax(0, 1.35fr) minmax(10rem, 0.65fr);
  }

  .mode-detail-strip div + div {
    border-top: 0;
    border-left: 1px solid rgba(255, 255, 255, 0.1);
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

  .mode-audio-scene {
    right: -9rem;
    bottom: 5.5rem;
    width: 36rem;
    height: 26rem;
    opacity: 0.86;
  }
}

@media (prefers-reduced-motion: reduce) {
  .mode-wave-field,
  .mode-frequency-field,
  .mode-wave-panel,
  .mode-wave-bars span,
  .mode-spectral-bands span,
  .mode-signal-track span {
    animation: none;
  }
}
</style>
