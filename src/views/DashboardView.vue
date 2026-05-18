<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import Select from 'primevue/select'

import AppNavbar from '@/components/AppNavbar.vue'
import { ApiError } from '@/services/authApi'
import { translateApiKey, translateApiMessage } from '@/services/apiMessageTranslator'
import { audioApi, audioSourceUrl } from '@/services/audioApi'
import { modeApi } from '@/services/modeApi'
import { modeRhythmStyle, modeSemanticKey } from '@/services/modeVisuals'
import { useAuthStore } from '@/stores/auth'
import { useVisualThemeStore } from '@/stores/visualTheme'
import type { Audio } from '@/types/audio'
import type { Mode } from '@/types/mode'

type TimerPhase = 'work' | 'shortBreak' | 'longBreak'

const phaseDurations: Record<TimerPhase, number> = {
  work: 25 * 60,
  shortBreak: 5 * 60,
  longBreak: 15 * 60,
}

const phaseCycle: TimerPhase[] = [
  'work',
  'shortBreak',
  'work',
  'shortBreak',
  'work',
  'shortBreak',
  'work',
  'longBreak',
]

const phaseIcons: Record<TimerPhase, string> = {
  work: 'pi pi-bolt',
  shortBreak: 'pi pi-sparkles',
  longBreak: 'pi pi-moon',
}

const { t } = useI18n()
const auth = useAuthStore()
const visualTheme = useVisualThemeStore()

const modes = ref<Mode[]>([])
const audios = ref<Audio[]>([])
const selectedModeId = ref<number | null>(null)
const selectedAudioId = ref<string | number | null>(null)
const timerPhase = ref<TimerPhase>('work')
const remainingSeconds = ref(phaseDurations.work)
const cycleIndex = ref(0)
const completedBlocks = ref(0)
const isRunning = ref(false)
const isLoadingModes = ref(false)
const isLoadingAudios = ref(false)
const error = ref<string | null>(null)

const audioElement = ref<HTMLAudioElement | null>(null)
const audioVolume = ref(0.74)
const isAudioMuted = ref(false)
const isAudioPlaying = ref(false)
const isAudioWaiting = ref(false)
const hasAudioError = ref(false)

let timerInterval: ReturnType<typeof window.setInterval> | undefined

const phaseOptions = computed(() =>
  (['work', 'shortBreak', 'longBreak'] as TimerPhase[]).map((phase) => ({
    key: phase,
    label: t(`coreTimer.phases.${phase}`),
    icon: phaseIcons[phase],
    minutes: Math.floor(phaseDurations[phase] / 60),
  })),
)

const sortedModes = computed(() => [...modes.value].sort((a, b) => a.id - b.id))
const selectedMode = computed(
  () => sortedModes.value.find((mode) => mode.id === selectedModeId.value) ?? null,
)
const selectedModeKey = computed(() => modeSemanticKey(selectedMode.value))
const selectedModeName = computed(() => translatedModeName(selectedMode.value))
const selectedModeDescription = computed(() => translatedModeDescription(selectedMode.value))
const pageVisualStyle = computed(() => {
  const palette = visualTheme.activePalette

  return {
    ...visualTheme.cssVars,
    '--resource-mode-color': palette.accent,
    '--resource-mode-rgb': palette.glowRgb,
    '--resource-mode-ink': palette.ink,
    ...modeRhythmStyle(selectedMode.value),
  }
})
const modeOptions = computed(() =>
  sortedModes.value.map((mode) => ({
    label: translatedModeName(mode),
    value: mode.id,
  })),
)

const sortedAudios = computed(() => [...audios.value].sort((a, b) => a.name.localeCompare(b.name)))
const selectedAudio = computed(
  () =>
    sortedAudios.value.find((audio) => audioId(audio) === String(selectedAudioId.value)) ?? null,
)
const selectedAudioSource = computed(() => audioSourceUrl(selectedAudio.value))
const selectedTrackLabel = computed(() => selectedAudio.value?.name ?? t('coreTimer.audio.noTrack'))
const hasAudioSource = computed(() => Boolean(selectedAudioSource.value))
const audioVolumeStyle = computed(() => ({
  '--audio-volume': `${isAudioMuted.value ? 0 : audioVolume.value * 100}%`,
}))
const audioVolumeIcon = computed(() => {
  if (isAudioMuted.value || audioVolume.value === 0) return 'pi pi-volume-off'
  if (audioVolume.value < 0.5) return 'pi pi-volume-down'

  return 'pi pi-volume-up'
})

const currentPhaseTotalSeconds = computed(() => phaseDurations[timerPhase.value])
const formattedRemaining = computed(() => formatClock(remainingSeconds.value))
const timerProgress = computed(() => {
  const totalSeconds = currentPhaseTotalSeconds.value

  if (!totalSeconds) return 0

  return Math.min(100, Math.max(0, ((totalSeconds - remainingSeconds.value) / totalSeconds) * 100))
})
const timerProgressStyle = computed(() => ({
  '--timer-progress': `${timerProgress.value}%`,
}))
const playPauseLabel = computed(() =>
  isRunning.value ? t('coreTimer.actions.pause') : t('coreTimer.actions.start'),
)
const playPauseIcon = computed(() => (isRunning.value ? 'pi pi-pause' : 'pi pi-play'))
const activeCycleStep = computed(() => cycleIndex.value + 1)
const trackCountLabel = computed(() =>
  t('coreTimer.audio.trackCount', { count: sortedAudios.value.length }),
)

function translatedModeName(mode: Mode | null | undefined) {
  if (!mode) return t('coreTimer.mode.empty')

  const key = modeSemanticKey(mode)

  return key ? t(`modes.${key}.label`) : mode.name
}

function translatedModeDescription(mode: Mode | null | undefined) {
  if (!mode) return t('coreTimer.mode.emptyDescription')

  const key = modeSemanticKey(mode)

  return key ? t(`modes.${key}.subtitle`) : mode.description
}

function audioId(audio: Audio) {
  return String(audio.id)
}

function isSelectedAudio(audio: Audio) {
  return audioId(audio) === String(selectedAudioId.value)
}

function formatClock(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds))
  const minutes = Math.floor(safeSeconds / 60)
  const seconds = safeSeconds % 60

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function setError(caughtError: unknown, fallbackKey: string) {
  if (caughtError instanceof ApiError) {
    error.value = translateApiMessage(caughtError.message, {
      fallbackKey,
      status: caughtError.status,
    })
    return
  }

  error.value = translateApiKey(fallbackKey)
}

async function loadModes() {
  if (!auth.token) return

  isLoadingModes.value = true
  error.value = null

  try {
    const response = await modeApi.listAllModes(auth.token)

    modes.value = response.data
    selectedModeId.value =
      selectedModeId.value ??
      response.data.find((mode) => modeSemanticKey(mode) === 'focus')?.id ??
      response.data[0]?.id ??
      null
  } catch (caughtError) {
    setError(caughtError, 'coreTimer.errors.loadModes')
  } finally {
    isLoadingModes.value = false
  }
}

async function loadAudiosForMode(modeId: number) {
  if (!auth.token) return

  isLoadingAudios.value = true
  error.value = null

  try {
    const response = await audioApi.listAudiosForMode(auth.token, modeId, { per_page: 50 })

    if (selectedModeId.value !== modeId) return

    audios.value = response.data
    selectedAudioId.value = response.data.some(
      (audio) => audioId(audio) === String(selectedAudioId.value),
    )
      ? selectedAudioId.value
      : (response.data[0]?.id ?? null)
  } catch (caughtError) {
    if (selectedModeId.value === modeId) {
      audios.value = []
      selectedAudioId.value = null
      setError(caughtError, 'coreTimer.errors.loadAudios')
    }
  } finally {
    if (selectedModeId.value === modeId) {
      isLoadingAudios.value = false
    }
  }
}

function clearTimerInterval() {
  if (timerInterval === undefined) return

  window.clearInterval(timerInterval)
  timerInterval = undefined
}

function completePhase() {
  if (timerPhase.value === 'work') {
    completedBlocks.value += 1
  }

  cycleIndex.value = (cycleIndex.value + 1) % phaseCycle.length
  const nextPhase = phaseCycle[cycleIndex.value] ?? 'work'

  timerPhase.value = nextPhase
  remainingSeconds.value = phaseDurations[nextPhase]
}

function tickTimer() {
  if (remainingSeconds.value <= 1) {
    completePhase()
    return
  }

  remainingSeconds.value -= 1
}

function syncAudioVolume() {
  const audio = audioElement.value

  if (!audio) return

  audio.volume = audioVolume.value
  audio.muted = isAudioMuted.value
}

async function playAudio() {
  const audio = audioElement.value

  if (!audio || !hasAudioSource.value) return

  try {
    await audio.play()
  } catch {
    hasAudioError.value = true
    error.value = translateApiKey('coreTimer.errors.playAudio')
  }
}

function pauseAudio() {
  audioElement.value?.pause()
}

async function startSession() {
  isRunning.value = true
  await nextTick()
  await playAudio()
}

function pauseSession() {
  isRunning.value = false
  pauseAudio()
}

function toggleSession() {
  if (isRunning.value) {
    pauseSession()
    return
  }

  void startSession()
}

function resetSession() {
  pauseSession()
  remainingSeconds.value = phaseDurations[timerPhase.value]
}

function skipPhase() {
  completePhase()
}

function extendSession() {
  remainingSeconds.value += 5 * 60
}

function selectPhase(phase: TimerPhase) {
  if (timerPhase.value === phase) return

  pauseSession()
  timerPhase.value = phase
  cycleIndex.value = phaseCycle.findIndex((cyclePhase) => cyclePhase === phase)
  remainingSeconds.value = phaseDurations[phase]
}

function selectTrack(audio: Audio) {
  selectedAudioId.value = audio.id
}

function changeVolume(event: Event) {
  const value = Number((event.target as HTMLInputElement).value)

  audioVolume.value = Math.min(1, Math.max(0, value / 100))
  isAudioMuted.value = audioVolume.value === 0
  syncAudioVolume()
}

function toggleMute() {
  isAudioMuted.value = !isAudioMuted.value
  syncAudioVolume()
}

watch(isRunning, (running) => {
  clearTimerInterval()

  if (running) {
    timerInterval = window.setInterval(tickTimer, 1000)
  }
})

watch(selectedModeId, (modeId) => {
  audios.value = []
  selectedAudioId.value = null

  if (modeId !== null) {
    void loadAudiosForMode(modeId)
  }
})

watch(selectedAudioSource, async () => {
  const audio = audioElement.value

  hasAudioError.value = false
  isAudioWaiting.value = false

  if (!audio) return

  audio.pause()
  audio.load()
  await nextTick()
  syncAudioVolume()

  if (isRunning.value) {
    await playAudio()
  }
})

onMounted(() => {
  void loadModes()
})

onBeforeUnmount(() => {
  clearTimerInterval()
  pauseAudio()
})
</script>

<template>
  <main
    class="core-page dark min-h-screen overflow-hidden px-0 py-4 text-[#f7fbf8]"
    :style="pageVisualStyle"
  >
    <AppNavbar />

    <audio
      ref="audioElement"
      :key="selectedAudioSource"
      class="sr-only"
      :src="selectedAudioSource || undefined"
      preload="metadata"
      loop
      @loadedmetadata="syncAudioVolume"
      @play="isAudioPlaying = true"
      @pause="isAudioPlaying = false"
      @waiting="isAudioWaiting = true"
      @canplay="isAudioWaiting = false"
      @playing="isAudioWaiting = false"
      @error="hasAudioError = true"
    />

    <section class="core-shell flex min-h-[calc(100svh-5.5rem)] flex-col pt-4 sm:pt-5">
      <div
        v-if="error"
        class="mb-4 rounded-[8px] border border-red-300/30 bg-red-500/10 px-4 py-3 text-sm leading-6 text-red-100"
      >
        {{ error }}
      </div>

      <section class="core-workspace">
        <section class="core-stage">
          <header class="core-topbar">
            <div class="core-mode-field auth-field">
              <label class="sr-only" for="core-mode-select">
                {{ t('coreTimer.mode.label') }}
              </label>
              <Select
                input-id="core-mode-select"
                v-model="selectedModeId"
                :options="modeOptions"
                option-label="label"
                option-value="value"
                :loading="isLoadingModes"
                :disabled="isLoadingModes || sortedModes.length === 0"
                class="!w-full"
              />
            </div>
          </header>

          <div v-if="isLoadingModes" class="core-empty-state">
            <i class="pi pi-spin pi-spinner" aria-hidden="true" />
            <span>{{ t('coreTimer.mode.loading') }}</span>
          </div>

          <div v-else-if="sortedModes.length === 0" class="core-empty-state">
            <i class="pi pi-wave-pulse" aria-hidden="true" />
            <span>{{ t('coreTimer.mode.empty') }}</span>
          </div>

          <template v-else>
            <div class="core-focus-layout">
              <div class="core-timer-zone">
                <div class="core-timer-orbit" :style="timerProgressStyle">
                  <span class="core-timer-ring core-timer-ring--outer" aria-hidden="true" />
                  <span class="core-timer-ring core-timer-ring--inner" aria-hidden="true" />

                  <div class="core-timer-readout">
                    <span class="core-eyebrow">{{ t(`coreTimer.phases.${timerPhase}`) }}</span>
                    <strong>{{ formattedRemaining }}</strong>
                    <span class="core-track-label">{{ selectedTrackLabel }}</span>
                  </div>
                </div>
              </div>

              <div class="core-mode-summary">
                <p class="text-sm font-semibold uppercase text-[var(--resource-mode-color)]">
                  {{ t('coreTimer.eyebrow') }}
                </p>
                <h1>{{ selectedModeName }}</h1>
                <p>{{ selectedModeDescription }}</p>
              </div>
            </div>

            <div class="core-player-footer">
              <div class="core-controls">
                <Button
                  type="button"
                  icon="pi pi-refresh"
                  rounded
                  text
                  :aria-label="t('coreTimer.actions.reset')"
                  class="core-control-button"
                  @click="resetSession"
                />

                <Button
                  type="button"
                  :icon="playPauseIcon"
                  :label="playPauseLabel"
                  class="core-play-button"
                  @click="toggleSession"
                />

                <Button
                  type="button"
                  icon="pi pi-forward"
                  rounded
                  text
                  :aria-label="t('coreTimer.actions.skip')"
                  class="core-control-button"
                  @click="skipPhase"
                />

                <Button
                  type="button"
                  icon="pi pi-plus"
                  :label="t('coreTimer.actions.addFive')"
                  class="core-soft-action"
                  @click="extendSession"
                />
              </div>
            </div>

            <dl class="core-session-stats">
              <div>
                <dt>{{ t('coreTimer.stats.completed') }}</dt>
                <dd>{{ completedBlocks }}</dd>
              </div>
              <div>
                <dt>{{ t('coreTimer.stats.cycle') }}</dt>
                <dd>{{ activeCycleStep }}/{{ phaseCycle.length }}</dd>
              </div>
              <div>
                <dt>{{ t('coreTimer.stats.mode') }}</dt>
                <dd>
                  {{ selectedModeKey ? t(`modes.${selectedModeKey}.label`) : selectedModeName }}
                </dd>
              </div>
            </dl>
          </template>
        </section>

        <aside class="core-music-panel">
          <div class="core-panel-heading">
            <div>
              <p>{{ t('coreTimer.audio.eyebrow') }}</p>
              <h2>{{ t('coreTimer.audio.title', { mode: selectedModeName }) }}</h2>
            </div>
            <span>{{ trackCountLabel }}</span>
          </div>

          <div class="core-phase-tabs" role="tablist" :aria-label="t('coreTimer.phaseLabel')">
            <button
              v-for="phase in phaseOptions"
              :key="phase.key"
              type="button"
              class="core-phase-tab"
              :class="{ 'core-phase-tab--active': timerPhase === phase.key }"
              :aria-selected="timerPhase === phase.key"
              role="tab"
              @click="selectPhase(phase.key)"
            >
              <i :class="phase.icon" aria-hidden="true" />
              <span>{{ phase.label }}</span>
              <small>{{ t('coreTimer.minutes', { count: phase.minutes }) }}</small>
            </button>
          </div>

          <div v-if="isLoadingAudios" class="core-list-state">
            <i class="pi pi-spin pi-spinner" aria-hidden="true" />
            <span>{{ t('coreTimer.audio.loading') }}</span>
          </div>

          <div v-else-if="sortedAudios.length === 0" class="core-list-state">
            <i class="pi pi-volume-off" aria-hidden="true" />
            <span>{{ t('coreTimer.audio.empty') }}</span>
          </div>

          <div v-else class="core-track-list">
            <button
              v-for="audio in sortedAudios"
              :key="audioId(audio)"
              type="button"
              class="core-track"
              :class="{ 'core-track--active': isSelectedAudio(audio) }"
              :aria-label="t('coreTimer.actions.chooseTrack', { name: audio.name })"
              @click="selectTrack(audio)"
            >
              <span class="core-track-wave" aria-hidden="true">
                <span v-for="beat in 9" :key="beat" />
              </span>
              <span class="core-track-copy">
                <strong>{{ audio.name }}</strong>
                <small>{{ selectedModeName }}</small>
              </span>
              <i
                :class="isSelectedAudio(audio) ? 'pi pi-check' : 'pi pi-play'"
                aria-hidden="true"
              />
            </button>
          </div>

          <div class="core-audio-console">
            <div class="core-now-playing">
              <span>
                {{ isAudioPlaying ? t('coreTimer.audio.playing') : t('coreTimer.audio.ready') }}
              </span>
              <strong>{{ selectedTrackLabel }}</strong>
            </div>

            <div class="core-volume-row">
              <button
                type="button"
                :disabled="!hasAudioSource"
                :aria-label="
                  isAudioMuted ? t('coreTimer.actions.unmute') : t('coreTimer.actions.mute')
                "
                @click="toggleMute"
              >
                <i
                  :class="isAudioWaiting ? 'pi pi-spin pi-spinner' : audioVolumeIcon"
                  aria-hidden="true"
                />
              </button>
              <label class="core-range core-range--volume">
                <span class="sr-only">{{ t('coreTimer.audio.volume') }}</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  :value="isAudioMuted ? 0 : audioVolume * 100"
                  :style="audioVolumeStyle"
                  :disabled="!hasAudioSource"
                  @input="changeVolume"
                />
              </label>
            </div>

            <div v-if="hasAudioError" class="core-audio-error" aria-live="polite">
              <i class="pi pi-exclamation-triangle" aria-hidden="true" />
              <span>{{ t('coreTimer.errors.playAudio') }}</span>
            </div>
          </div>
        </aside>
      </section>
    </section>
  </main>
</template>

<style scoped>
.core-page {
  position: relative;
  isolation: isolate;
  background: #05090d;
}

.core-page::before {
  position: absolute;
  inset: -32% -24% -24%;
  z-index: 0;
  background:
    radial-gradient(
      ellipse at var(--aurora-x, 58%) var(--aurora-y, 36%),
      rgba(var(--resource-mode-rgb), 0.32),
      transparent 30%
    ),
    radial-gradient(ellipse at 72% 64%, rgba(91, 52, 106, 0.34), transparent 34%),
    conic-gradient(
      from 132deg at 54% 42%,
      rgba(var(--resource-mode-rgb), 0.26),
      rgba(74, 23, 68, 0.26),
      rgba(5, 10, 16, 0.88),
      rgba(31, 86, 80, 0.34),
      rgba(74, 23, 68, 0.24),
      rgba(var(--resource-mode-rgb), 0.22)
    ),
    linear-gradient(140deg, rgba(var(--resource-mode-rgb), 0.12), transparent 36%),
    linear-gradient(180deg, #05090d 0%, #071013 52%, #040607 100%);
  content: '';
  filter: blur(12px) saturate(1.04);
  opacity: 0.72;
  pointer-events: none;
  transform-origin: center;
}

.core-page::after {
  position: absolute;
  inset: -10rem -22vw;
  z-index: 0;
  background:
    repeating-radial-gradient(
      ellipse at 46% 43%,
      transparent 0 7.8rem,
      rgba(255, 255, 255, 0.03) 7.88rem 7.96rem,
      transparent 8.08rem 12.8rem
    ),
    radial-gradient(ellipse at 34% 52%, rgba(var(--resource-mode-rgb), 0.08), transparent 30%),
    linear-gradient(180deg, rgba(0, 0, 0, 0.46), transparent 34%, rgba(0, 0, 0, 0.52));
  content: '';
  opacity: 0.42;
  pointer-events: none;
}

.core-page > :not(audio) {
  position: relative;
  z-index: 1;
}

.core-page :deep(.app-navbar) {
  width: calc(100% - 2rem);
}

.core-shell {
  width: 100%;
}

.core-workspace {
  position: relative;
  display: grid;
  flex: 1;
  grid-template-columns: minmax(0, 1fr);
  min-height: calc(100svh - 6.5rem);
  overflow: hidden;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}

.core-stage,
.core-music-panel {
  min-width: 0;
}

.core-stage {
  position: relative;
  z-index: 1;
  display: flex;
  min-height: 45rem;
  flex-direction: column;
  padding: 1rem;
}

.core-topbar {
  position: relative;
  z-index: 5;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.core-mode-field {
  width: min(100%, 17rem);
}

.core-mode-field :deep(.p-select) {
  align-items: center;
  min-height: 3.1rem;
  border-color: rgba(255, 255, 255, 0.16) !important;
  background: rgba(13, 10, 18, 0.72) !important;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08) !important;
}

.core-mode-field :deep(.p-select-label) {
  display: flex;
  min-width: 0;
  align-items: center;
  align-self: stretch;
  padding-block: 0;
  line-height: 1.2;
}

.core-empty-state,
.core-list-state {
  display: grid;
  min-height: 16rem;
  place-items: center;
  gap: 0.7rem;
  color: rgba(255, 255, 255, 0.62);
  font-size: 0.92rem;
  text-align: center;
}

.core-empty-state {
  position: relative;
  z-index: 1;
  flex: 1;
}

.core-focus-layout {
  position: relative;
  z-index: 2;
  display: grid;
  flex: 1;
  min-height: 28rem;
  place-items: center;
  text-align: center;
}

.core-timer-zone {
  position: relative;
  display: grid;
  min-height: 29rem;
  place-items: center;
}

.core-timer-orbit {
  position: relative;
  display: grid;
  width: min(86vw, 66svh, 37rem);
  max-width: 100%;
  aspect-ratio: 1;
  place-items: center;
  border-radius: 999px;
}

.core-timer-orbit::before {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: conic-gradient(
    var(--resource-mode-color) var(--timer-progress),
    rgba(255, 255, 255, 0.08) 0
  );
  content: '';
  mask: radial-gradient(circle, transparent 0 63%, black 63.5% 64.4%, transparent 65%);
  opacity: 0.8;
}

.core-timer-orbit::after {
  position: absolute;
  inset: 25%;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: inherit;
  content: '';
  opacity: 0.8;
}

.core-timer-ring {
  position: absolute;
  border: 1px solid rgba(var(--resource-mode-rgb), 0.24);
  border-radius: 999px;
  pointer-events: none;
}

.core-timer-ring--outer {
  inset: 3%;
  animation: core-ring-drift var(--resource-mode-band-duration, 6s) linear infinite;
}

.core-timer-ring--inner {
  inset: 18%;
  border-color: rgba(255, 255, 255, 0.12);
  animation: core-ring-drift calc(var(--resource-mode-band-duration, 6s) * 1.35) linear infinite
    reverse;
}

.core-timer-readout {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  text-align: center;
}

.core-eyebrow,
.core-track-label {
  display: block;
  overflow-wrap: anywhere;
}

.core-eyebrow {
  color: rgba(255, 255, 255, 0.82);
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0;
  line-height: 1.1;
  text-transform: uppercase;
}

.core-timer-readout strong {
  display: block;
  width: 4.7ch;
  margin-top: 0.35rem;
  color: #ffffff;
  font-size: clamp(4.6rem, 15vw, 8.9rem);
  font-variant-numeric: tabular-nums lining-nums;
  font-weight: 760;
  letter-spacing: 0;
  line-height: 0.94;
  text-shadow: 0 1.2rem 4rem rgba(0, 0, 0, 0.55);
  text-align: center;
  white-space: nowrap;
}

.core-track-label {
  margin-top: 0.65rem;
  color: rgba(255, 255, 255, 0.62);
  font-size: 0.9rem;
  font-weight: 600;
  line-height: 1.3;
}

.core-mode-summary {
  width: min(100%, 35rem);
  margin-top: -1rem;
}

.core-mode-summary h1 {
  margin: 0.35rem 0 0;
  color: #ffffff;
  font-size: clamp(1.65rem, 4vw, 3.2rem);
  font-weight: 720;
  line-height: 1.05;
}

.core-mode-summary p:last-child {
  margin: 0.8rem 0 0;
  max-width: 40rem;
  color: rgba(255, 255, 255, 0.56);
  font-size: 0.95rem;
  line-height: 1.55;
}

.core-player-footer {
  position: relative;
  z-index: 3;
}

.core-phase-tabs {
  position: relative;
  display: grid;
  gap: 0.48rem;
}

.core-phase-tab {
  display: grid;
  min-height: 3.55rem;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.62rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.07);
  color: rgba(255, 255, 255, 0.72);
  padding: 0.58rem;
  text-align: left;
  transition:
    border-color 160ms ease,
    background 160ms ease,
    color 160ms ease,
    transform 160ms ease;
}

.core-phase-tab:hover,
.core-phase-tab--active {
  border-color: rgba(var(--resource-mode-rgb), 0.36);
  background: rgba(var(--resource-mode-rgb), 0.12);
  color: #ffffff;
}

.core-phase-tab:hover {
  transform: translateY(-1px);
}

.core-phase-tab i {
  display: grid;
  width: 2.1rem;
  height: 2.1rem;
  place-items: center;
  border-radius: 999px;
  background: rgba(var(--resource-mode-rgb), 0.16);
  color: var(--resource-mode-color);
}

.core-phase-tab span,
.core-phase-tab small {
  overflow-wrap: anywhere;
}

.core-phase-tab span {
  color: inherit;
  font-size: 0.86rem;
  font-weight: 740;
  line-height: 1.2;
}

.core-phase-tab small {
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.68rem;
  font-weight: 700;
  line-height: 1.1;
}

.core-controls {
  position: relative;
  z-index: 1;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.9rem;
  margin-top: -1.2rem;
}

.core-control-button {
  width: 3.1rem !important;
  height: 3.1rem !important;
  color: rgba(255, 255, 255, 0.78) !important;
}

.core-control-button:hover {
  background: rgba(255, 255, 255, 0.1) !important;
}

.core-play-button {
  width: 3.75rem !important;
  min-width: 3.75rem !important;
  height: 3.75rem !important;
  border-radius: 999px !important;
  border-color: transparent !important;
  background: rgba(255, 255, 255, 0.94) !important;
  color: #07100e !important;
  box-shadow: 0 1rem 3.5rem rgba(0, 0, 0, 0.44);
}

.core-play-button :deep(.p-button-label),
.core-soft-action :deep(.p-button-label) {
  display: none;
}

.core-soft-action {
  width: 3.1rem !important;
  min-width: 3.1rem !important;
  height: 3.1rem !important;
  border-radius: 999px !important;
  border-color: rgba(var(--resource-mode-rgb), 0.36) !important;
  background: rgba(255, 255, 255, 0.08) !important;
  color: rgba(255, 255, 255, 0.8) !important;
}

.core-session-stats {
  position: relative;
  z-index: 3;
  display: grid;
  gap: 0.65rem;
  margin: 1.15rem 0 0;
}

.core-session-stats div {
  min-width: 0;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.045);
  padding: 0.8rem;
}

.core-session-stats dt {
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.72rem;
  font-weight: 800;
  line-height: 1.2;
  text-transform: uppercase;
}

.core-session-stats dd {
  margin: 0.35rem 0 0;
  color: #ffffff;
  font-size: 1rem;
  font-weight: 740;
  line-height: 1.25;
  overflow-wrap: anywhere;
}

.core-music-panel {
  position: relative;
  z-index: 4;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  margin: 1rem;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 12px;
  background:
    linear-gradient(150deg, rgba(var(--resource-mode-rgb), 0.12), transparent 42%),
    rgba(5, 8, 10, 0.66);
  padding: 1rem;
  box-shadow:
    0 1.2rem 4rem rgba(0, 0, 0, 0.34),
    inset 0 1px 0 rgba(255, 255, 255, 0.06);
  backdrop-filter: blur(24px);
}

.core-panel-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.core-panel-heading p {
  margin: 0;
  color: var(--resource-mode-color);
  font-size: 0.72rem;
  font-weight: 800;
  line-height: 1.2;
  text-transform: uppercase;
}

.core-panel-heading h2 {
  margin: 0.35rem 0 0;
  color: #ffffff;
  font-size: 1.12rem;
  font-weight: 740;
  line-height: 1.15;
  overflow-wrap: anywhere;
}

.core-panel-heading > span {
  flex: 0 0 auto;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.64);
  font-size: 0.78rem;
  font-weight: 750;
  line-height: 1.1;
  padding: 0.45rem 0.65rem;
}

.core-track-list {
  display: grid;
  align-content: start;
  gap: 0.52rem;
  overflow: auto;
  padding-right: 0.15rem;
}

.core-track {
  display: grid;
  min-height: 3.9rem;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.8rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.055);
  color: #ffffff;
  padding: 0.6rem;
  text-align: left;
  transition:
    border-color 160ms ease,
    background 160ms ease,
    transform 160ms ease;
}

.core-track:hover,
.core-track--active {
  border-color: rgba(var(--resource-mode-rgb), 0.38);
  background: rgba(var(--resource-mode-rgb), 0.12);
}

.core-track:hover {
  transform: translateY(-1px);
}

.core-track > i {
  display: grid;
  width: 1.9rem;
  height: 1.9rem;
  place-items: center;
  border-radius: 999px;
  background: rgba(var(--resource-mode-rgb), 0.16);
  color: var(--resource-mode-color);
  font-size: 0.8rem;
}

.core-track-copy {
  min-width: 0;
}

.core-track-copy strong,
.core-track-copy small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.core-track-copy strong {
  color: #ffffff;
  font-size: 0.86rem;
  font-weight: 760;
  line-height: 1.2;
}

.core-track-copy small {
  margin-top: 0.25rem;
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.68rem;
  font-weight: 650;
  line-height: 1.2;
}

.core-track-wave {
  display: flex;
  width: 2.55rem;
  height: 1.45rem;
  align-items: center;
  justify-content: center;
  gap: 0.12rem;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.24);
}

.core-track-wave span {
  width: 0.1rem;
  height: 38%;
  border-radius: 999px;
  background: rgba(var(--resource-mode-rgb), 0.78);
}

.core-track-wave span:nth-child(2n) {
  height: 66%;
}

.core-track-wave span:nth-child(3n) {
  height: 88%;
}

.core-audio-console {
  margin-top: auto;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.05);
  padding: 0.78rem;
}

.core-now-playing {
  display: grid;
  gap: 0.25rem;
}

.core-now-playing span {
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.72rem;
  font-weight: 800;
  line-height: 1.2;
  text-transform: uppercase;
}

.core-now-playing strong {
  color: #ffffff;
  font-size: 0.88rem;
  font-weight: 760;
  line-height: 1.25;
  overflow-wrap: anywhere;
}

.core-volume-row {
  display: grid;
  align-items: center;
  gap: 0.65rem;
  margin-top: 0.85rem;
}

.core-volume-row {
  grid-template-columns: auto minmax(0, 1fr);
}

.core-volume-row button {
  display: grid;
  width: 2.35rem;
  height: 2.35rem;
  place-items: center;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.07);
  color: rgba(255, 255, 255, 0.76);
}

.core-volume-row button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.core-range {
  display: block;
  min-width: 0;
}

.core-range input {
  width: 100%;
  height: 0.35rem;
  appearance: none;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.12);
  outline: none;
}

.core-range--volume input {
  background: linear-gradient(
    90deg,
    var(--resource-mode-color) 0 var(--audio-volume),
    rgba(255, 255, 255, 0.12) var(--audio-volume) 100%
  );
}

.core-range input:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.core-range input::-webkit-slider-thumb {
  width: 0.95rem;
  height: 0.95rem;
  appearance: none;
  border: 0;
  border-radius: 999px;
  background: #ffffff;
  box-shadow: 0 0 0 0.25rem rgba(var(--resource-mode-rgb), 0.16);
}

.core-range input::-moz-range-thumb {
  width: 0.95rem;
  height: 0.95rem;
  border: 0;
  border-radius: 999px;
  background: #ffffff;
  box-shadow: 0 0 0 0.25rem rgba(var(--resource-mode-rgb), 0.16);
}

.core-audio-error {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  margin-top: 0.8rem;
  color: #fecaca;
  font-size: 0.82rem;
  line-height: 1.35;
}

@keyframes core-ring-drift {
  to {
    transform: rotate(360deg);
  }
}

@media (min-width: 640px) {
  .core-stage,
  .core-music-panel {
    padding: 1.25rem;
  }

  .core-topbar {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }

  .core-phase-tabs,
  .core-session-stats {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (min-width: 640px) and (max-width: 1023.98px) {
  .core-stage {
    min-height: 0;
  }

  .core-focus-layout {
    min-height: 0;
    gap: 1.35rem;
    padding-top: 1rem;
  }

  .core-timer-zone {
    min-height: 18rem;
  }

  .core-timer-orbit {
    width: min(72vw, 21rem);
  }

  .core-mode-summary {
    margin-top: 0;
  }

  .core-player-footer {
    margin-top: 1.25rem;
  }

  .core-controls {
    margin-top: 0;
  }
}

@media (min-width: 1024px) {
  .core-workspace {
    grid-template-columns: minmax(0, 1fr);
    min-height: calc(100svh - 6.35rem);
  }

  .core-stage {
    min-height: calc(100svh - 6.35rem);
    padding: 1.45rem 1.55rem 1.35rem;
  }

  .core-focus-layout {
    position: absolute;
    inset: 0;
    min-height: 0;
    padding-left: 0;
    pointer-events: none;
  }

  .core-timer-zone {
    min-height: 0;
    pointer-events: auto;
  }

  .core-mode-summary {
    position: absolute;
    top: 5.4rem;
    left: clamp(2rem, 4vw, 4rem);
    z-index: 4;
    width: min(18rem, 24vw);
    margin: 0;
    text-align: left;
  }

  .core-mode-summary h1 {
    font-size: clamp(1.4rem, 2vw, 2.1rem);
  }

  .core-mode-summary p:last-child {
    display: none;
  }

  .core-player-footer {
    position: absolute;
    left: 50%;
    bottom: 1.6rem;
    transform: translateX(-50%);
    margin-top: 0;
    padding-left: 0;
  }

  .core-music-panel {
    position: absolute;
    top: 1.35rem;
    right: 1.15rem;
    bottom: 1.35rem;
    width: min(22rem, calc(100% - 2.3rem));
    min-width: 0;
    max-height: none;
    overflow: hidden;
    margin: 0;
    border: 1px solid rgba(255, 255, 255, 0.16);
    border-radius: 14px;
    background:
      linear-gradient(180deg, rgba(var(--resource-mode-rgb), 0.12), transparent 42%),
      rgba(5, 9, 10, 0.66);
    padding: 1.15rem;
    box-shadow:
      0 1.8rem 5rem rgba(0, 0, 0, 0.34),
      0 0 0 1px rgba(0, 0, 0, 0.14),
      inset 0 1px 0 rgba(255, 255, 255, 0.06);
    backdrop-filter: blur(26px);
  }

  .core-panel-heading {
    display: flex;
  }

  .core-panel-heading > span {
    justify-self: auto;
    margin-top: 0;
    font-size: 0.78rem;
  }

  .core-phase-tabs {
    grid-template-columns: minmax(0, 1fr);
  }

  .core-track-list {
    flex: 0 1 auto;
    min-height: 0;
    max-height: 15rem;
  }

  .core-audio-console {
    padding: 0.85rem;
  }

  .core-session-stats {
    position: absolute;
    right: calc(min(22rem, calc(100% - 2.3rem)) + 1.45rem);
    bottom: 1.55rem;
    width: clamp(18rem, 22vw, 20rem);
    grid-template-columns: repeat(3, minmax(0, 1fr));
    margin: 0;
  }

  .core-session-stats div {
    border-color: transparent;
    background: rgba(0, 0, 0, 0.2);
    padding: 0.6rem;
  }

  .core-session-stats dt {
    font-size: 0.62rem;
  }

  .core-session-stats dd {
    font-size: 0.86rem;
  }
}

@media (min-width: 1024px) and (max-width: 1600px) {
  .core-session-stats {
    bottom: 5.9rem;
  }
}
</style>
