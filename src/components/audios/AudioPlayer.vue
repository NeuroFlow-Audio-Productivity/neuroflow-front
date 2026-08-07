<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    src: string
    title?: string
    subtitle?: string
    compact?: boolean
  }>(),
  {
    title: '',
    subtitle: '',
    compact: false,
  },
)

const audioElement = ref<HTMLAudioElement | null>(null)
const currentTime = ref(0)
const duration = ref(0)
const volume = ref(1)
const isPlaying = ref(false)
const isWaiting = ref(false)
const isMuted = ref(false)
const hasError = ref(false)

const hasSource = computed(() => Boolean(props.src))
const progress = computed(() => {
  if (!duration.value) return 0

  return Math.min(100, Math.max(0, (currentTime.value / duration.value) * 100))
})
const progressStyle = computed(() => ({
  '--audio-progress': `${progress.value}%`,
}))
const volumeStyle = computed(() => ({
  '--audio-volume': `${isMuted.value ? 0 : volume.value * 100}%`,
}))
const playIcon = computed(() => (isPlaying.value ? 'pi pi-pause' : 'pi pi-play'))
const volumeIcon = computed(() => {
  if (isMuted.value || volume.value === 0) return 'pi pi-volume-off'
  if (volume.value < 0.5) return 'pi pi-volume-down'

  return 'pi pi-volume-up'
})

const formatTime = (value: number) => {
  if (!Number.isFinite(value) || value < 0) return '0:00'

  const totalSeconds = Math.floor(value)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }

  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

const resetState = () => {
  currentTime.value = 0
  duration.value = 0
  isPlaying.value = false
  isWaiting.value = false
  hasError.value = false
}

const syncVolume = () => {
  const audio = audioElement.value

  if (!audio) return

  audio.volume = volume.value
  audio.muted = isMuted.value
}

const togglePlayback = async () => {
  const audio = audioElement.value

  if (!audio || !hasSource.value) return

  try {
    if (audio.paused) {
      await audio.play()
      return
    }

    audio.pause()
  } catch {
    hasError.value = true
    isPlaying.value = false
  }
}

const seek = (event: Event) => {
  const audio = audioElement.value

  if (!audio || !duration.value) return

  const value = Number((event.target as HTMLInputElement).value)

  audio.currentTime = (value / 100) * duration.value
  currentTime.value = audio.currentTime
}

const changeVolume = (event: Event) => {
  const value = Number((event.target as HTMLInputElement).value)

  volume.value = Math.min(1, Math.max(0, value / 100))
  isMuted.value = volume.value === 0
  syncVolume()
}

const toggleMute = () => {
  isMuted.value = !isMuted.value
  syncVolume()
}

const onLoadedMetadata = () => {
  const audio = audioElement.value

  if (!audio) return

  duration.value = Number.isFinite(audio.duration) ? audio.duration : 0
  currentTime.value = audio.currentTime
  syncVolume()
}

const onTimeUpdate = () => {
  currentTime.value = audioElement.value?.currentTime ?? 0
}

const onDurationChange = () => {
  const audioDuration = audioElement.value?.duration ?? 0

  duration.value = Number.isFinite(audioDuration) ? audioDuration : 0
}

const onEnded = () => {
  isPlaying.value = false
  isWaiting.value = false
}

watch(
  () => props.src,
  async () => {
    const audio = audioElement.value

    resetState()

    if (!audio) return

    audio.pause()
    audio.load()
    await nextTick()
    syncVolume()
  },
)
</script>

<template>
  <div class="nf-audio-player" :class="{ 'nf-audio-player--compact': compact }">
    <audio
      ref="audioElement"
      :key="src"
      class="sr-only"
      :src="src || undefined"
      preload="metadata"
      @loadedmetadata="onLoadedMetadata"
      @durationchange="onDurationChange"
      @timeupdate="onTimeUpdate"
      @play="isPlaying = true"
      @pause="isPlaying = false"
      @waiting="isWaiting = true"
      @canplay="isWaiting = false"
      @playing="isWaiting = false"
      @ended="onEnded"
      @error="hasError = true"
    />

    <button
      class="nf-audio-play"
      type="button"
      :disabled="!hasSource"
      :aria-label="isPlaying ? 'Pause audio' : 'Play audio'"
      @click="togglePlayback"
    >
      <i :class="isWaiting ? 'pi pi-spin pi-spinner' : playIcon" aria-hidden="true" />
    </button>

    <div class="nf-audio-main">
      <div v-if="title || subtitle" class="nf-audio-heading">
        <span v-if="title" class="nf-audio-title">{{ title }}</span>
        <span v-if="subtitle" class="nf-audio-subtitle">{{ subtitle }}</span>
      </div>

      <div class="nf-audio-scrub-row">
        <span class="nf-audio-time">{{ formatTime(currentTime) }}</span>
        <label class="nf-audio-scrub">
          <span class="sr-only">Audio progress</span>
          <input
            type="range"
            min="0"
            max="100"
            step="0.1"
            :value="progress"
            :style="progressStyle"
            :disabled="!hasSource || !duration"
            @input="seek"
          />
        </label>
        <span class="nf-audio-time">{{ formatTime(duration) }}</span>
      </div>
    </div>

    <div class="nf-audio-actions">
      <button
        class="nf-audio-icon"
        type="button"
        :disabled="!hasSource"
        :aria-label="isMuted ? 'Unmute audio' : 'Mute audio'"
        @click="toggleMute"
      >
        <i :class="volumeIcon" aria-hidden="true" />
      </button>

      <label class="nf-audio-volume">
        <span class="sr-only">Volume</span>
        <input
          type="range"
          min="0"
          max="100"
          step="1"
          :value="isMuted ? 0 : volume * 100"
          :style="volumeStyle"
          :disabled="!hasSource"
          @input="changeVolume"
        />
      </label>
    </div>

    <span v-if="hasError" class="nf-audio-error" aria-live="polite">
      <i class="pi pi-exclamation-triangle" aria-hidden="true" />
    </span>
  </div>
</template>

<style scoped>
.nf-audio-player {
  position: relative;
  display: grid;
  width: 100%;
  min-height: 4.75rem;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 0.9rem;
  overflow: hidden;
  border: 1px solid rgba(var(--resource-mode-rgb, 110, 231, 216), 0.26);
  border-radius: 8px;
  background:
    linear-gradient(110deg, rgba(var(--resource-mode-rgb, 110, 231, 216), 0.18), transparent 42%),
    linear-gradient(180deg, rgba(var(--theme-text-rgb), 0.07), rgba(var(--theme-text-rgb), 0.035)),
    rgba(5, 10, 9, 0.82);
  padding: 0.75rem;
  box-shadow:
    inset 0 1px 0 rgba(var(--theme-text-rgb), 0.08),
    0 16px 46px rgba(var(--theme-shadow-rgb), 0.22);
}

.nf-audio-player::before {
  position: absolute;
  inset: -55% 12% auto auto;
  width: 11rem;
  height: 11rem;
  border: 1px solid rgba(var(--resource-mode-rgb, 110, 231, 216), 0.14);
  border-radius: 999px;
  background: repeating-radial-gradient(
    circle,
    transparent 0 0.54rem,
    rgba(var(--theme-text-rgb), 0.06) 0.58rem 0.62rem
  );
  content: '';
  opacity: 0.72;
  pointer-events: none;
}

.nf-audio-player--compact {
  min-height: 4.2rem;
  padding: 0.65rem;
}

.nf-audio-play,
.nf-audio-icon {
  position: relative;
  z-index: 2;
  display: grid;
  place-items: center;
  border: 0;
  color: var(--resource-mode-ink, #06100e);
  transition:
    filter 160ms ease,
    opacity 160ms ease,
    transform 160ms ease;
}

.nf-audio-play {
  width: 3rem;
  height: 3rem;
  border-radius: 999px;
  background: var(--resource-mode-color, var(--mode-accent));
  box-shadow: 0 0 1.8rem rgba(var(--resource-mode-rgb, 110, 231, 216), 0.3);
  font-size: 0.95rem;
}

.nf-audio-play:hover:not(:disabled),
.nf-audio-icon:hover:not(:disabled) {
  filter: brightness(1.08);
  transform: translateY(-1px);
}

.nf-audio-play:disabled,
.nf-audio-icon:disabled,
.nf-audio-scrub input:disabled,
.nf-audio-volume input:disabled {
  cursor: not-allowed;
  opacity: 0.46;
}

.nf-audio-main {
  position: relative;
  z-index: 2;
  min-width: 0;
}

.nf-audio-heading {
  display: flex;
  min-width: 0;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.45rem;
}

.nf-audio-title,
.nf-audio-subtitle {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.nf-audio-title {
  color: rgb(var(--theme-text-rgb));
  font-size: 0.86rem;
  font-weight: 800;
}

.nf-audio-subtitle {
  color: rgba(var(--theme-text-rgb), 0.52);
  font-size: 0.72rem;
  font-weight: 700;
}

.nf-audio-scrub-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.72rem;
}

.nf-audio-time {
  min-width: 2.65rem;
  color: rgba(var(--theme-text-rgb), 0.72);
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
  font-weight: 800;
}

.nf-audio-time:last-child {
  text-align: right;
}

.nf-audio-scrub,
.nf-audio-volume {
  display: block;
  min-width: 0;
}

.nf-audio-scrub input,
.nf-audio-volume input {
  display: block;
  width: 100%;
  height: 1.25rem;
  margin: 0;
  appearance: none;
  background: transparent;
  cursor: pointer;
}

.nf-audio-scrub input::-webkit-slider-runnable-track,
.nf-audio-volume input::-webkit-slider-runnable-track {
  height: 0.42rem;
  border-radius: 999px;
  background: linear-gradient(
    90deg,
    var(--resource-mode-color, var(--mode-accent)) var(--audio-progress, 0%),
    rgba(var(--theme-text-rgb), 0.18) var(--audio-progress, 0%)
  );
}

.nf-audio-volume input::-webkit-slider-runnable-track {
  height: 0.32rem;
  background: linear-gradient(
    90deg,
    rgba(var(--resource-mode-rgb, 110, 231, 216), 0.78) var(--audio-volume, 100%),
    rgba(var(--theme-text-rgb), 0.16) var(--audio-volume, 100%)
  );
}

.nf-audio-scrub input::-moz-range-track,
.nf-audio-volume input::-moz-range-track {
  height: 0.42rem;
  border-radius: 999px;
  background: rgba(var(--theme-text-rgb), 0.18);
}

.nf-audio-scrub input::-moz-range-progress {
  height: 0.42rem;
  border-radius: 999px;
  background: var(--resource-mode-color, var(--mode-accent));
}

.nf-audio-volume input::-moz-range-track {
  height: 0.32rem;
}

.nf-audio-volume input::-moz-range-progress {
  height: 0.32rem;
  border-radius: 999px;
  background: rgba(var(--resource-mode-rgb, 110, 231, 216), 0.78);
}

.nf-audio-scrub input::-webkit-slider-thumb,
.nf-audio-volume input::-webkit-slider-thumb {
  width: 1rem;
  height: 1rem;
  margin-top: -0.29rem;
  appearance: none;
  border: 2px solid rgb(var(--theme-text-rgb));
  border-radius: 999px;
  background: var(--resource-mode-color, var(--mode-accent));
  box-shadow: 0 0 1rem rgba(var(--resource-mode-rgb, 110, 231, 216), 0.48);
}

.nf-audio-volume input::-webkit-slider-thumb {
  width: 0.78rem;
  height: 0.78rem;
  margin-top: -0.23rem;
}

.nf-audio-scrub input::-moz-range-thumb,
.nf-audio-volume input::-moz-range-thumb {
  width: 0.85rem;
  height: 0.85rem;
  border: 2px solid rgb(var(--theme-text-rgb));
  border-radius: 999px;
  background: var(--resource-mode-color, var(--mode-accent));
  box-shadow: 0 0 1rem rgba(var(--resource-mode-rgb, 110, 231, 216), 0.48);
}

.nf-audio-actions {
  position: relative;
  z-index: 2;
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: auto minmax(4.5rem, 7rem);
  align-items: center;
  gap: 0.55rem;
}

.nf-audio-icon {
  width: 2.2rem;
  height: 2.2rem;
  border-radius: 8px;
  background: rgba(var(--resource-mode-rgb, 110, 231, 216), 0.14);
  color: color-mix(
    in srgb,
    var(--resource-mode-color, var(--mode-accent)),
    rgb(var(--theme-text-rgb)) 26%
  );
}

.nf-audio-error {
  position: absolute;
  top: 0.55rem;
  right: 0.55rem;
  z-index: 3;
  color: #fecaca;
  font-size: 0.8rem;
}

@media (min-width: 640px) {
  .nf-audio-player {
    grid-template-columns: auto minmax(0, 1fr) auto;
  }

  .nf-audio-actions {
    grid-column: auto;
  }
}
</style>
