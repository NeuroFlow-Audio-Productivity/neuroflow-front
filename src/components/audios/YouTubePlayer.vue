<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import {
  loadYouTubeIframeApi,
  type YouTubePlayer,
  type YouTubePlayerEvent,
  type YouTubePlayerState,
} from '@/services/youtubeIframeApi'

const props = withDefaults(
  defineProps<{
    videoId: string
    playing?: boolean
    volume?: number
    muted?: boolean
    label?: string
  }>(),
  {
    playing: false,
    volume: 0.74,
    muted: false,
    label: 'YouTube player',
  },
)

const emit = defineEmits<{
  ready: []
  stateChange: [state: YouTubePlayerState]
  waiting: [waiting: boolean]
  error: [code: number]
  autoplayBlocked: []
  title: [title: string]
}>()

const hostElement = ref<HTMLElement | null>(null)
const statusMessage = ref('')
const player = ref<YouTubePlayer | null>(null)
const isReady = ref(false)
const lastState = ref<YouTubePlayerState>(-1)

function normalizedVolume() {
  return Math.round(Math.min(1, Math.max(0, props.volume)) * 100)
}

function syncVolume() {
  const currentPlayer = player.value

  if (!currentPlayer || !isReady.value) return

  currentPlayer.setVolume(normalizedVolume())

  if (props.muted || normalizedVolume() === 0) {
    currentPlayer.mute()
    return
  }

  currentPlayer.unMute()
}

function syncPlayback() {
  const currentPlayer = player.value

  if (!currentPlayer || !isReady.value) return

  if (props.playing) {
    try {
      currentPlayer.playVideo()
    } catch {
      emit('autoplayBlocked')
    }
    return
  }

  currentPlayer.pauseVideo()
}

function emitTitle() {
  const title = player.value?.getVideoData?.().title

  if (title?.trim()) {
    emit('title', title.trim())
  }
}

function handleReady(event: { target: YouTubePlayer }) {
  player.value = event.target
  isReady.value = true
  statusMessage.value = ''
  syncVolume()
  syncPlayback()
  emitTitle()
  emit('ready')
}

function handleStateChange(event: YouTubePlayerEvent) {
  lastState.value = event.data
  emit('stateChange', event.data)
  emit('waiting', event.data === 3)

  if (event.data === 1 || event.data === 2 || event.data === 5) {
    statusMessage.value = ''
    emitTitle()
  }

  if (event.data === 0 && props.playing) {
    event.target.seekTo(0, true)
    event.target.playVideo()
  }
}

function handleError(event: { data: number }) {
  statusMessage.value = 'Unable to play this YouTube video.'
  emit('error', event.data)
}

async function createPlayer() {
  const target = hostElement.value

  if (!target || !props.videoId) return

  statusMessage.value = ''
  isReady.value = false
  player.value?.destroy()
  player.value = null

  try {
    const api = await loadYouTubeIframeApi()
    await nextTick()

    if (!hostElement.value) return

    player.value = new api.Player(hostElement.value, {
      videoId: props.videoId,
      width: '100%',
      height: '100%',
      playerVars: {
        autoplay: 0,
        controls: 1,
        enablejsapi: 1,
        loop: 1,
        playlist: props.videoId,
        origin: window.location.origin,
        playsinline: 1,
        rel: 0,
      },
      events: {
        onReady: handleReady,
        onStateChange: handleStateChange,
        onError: handleError,
      },
    })
  } catch {
    statusMessage.value = 'Unable to load YouTube.'
    emit('error', -1)
  }
}

watch(() => props.videoId, createPlayer)
watch(() => props.playing, syncPlayback)
watch(() => [props.volume, props.muted] as const, syncVolume)

onMounted(createPlayer)

onBeforeUnmount(() => {
  emit('waiting', false)
  player.value?.destroy()
  player.value = null
})
</script>

<template>
  <div class="youtube-player" :aria-label="label" role="group">
    <div ref="hostElement" class="youtube-player__host" />
    <div v-if="statusMessage" class="youtube-player__status" role="status">
      {{ statusMessage }}
    </div>
  </div>
</template>

<style scoped>
.youtube-player {
  position: relative;
  min-width: 200px;
  min-height: 200px;
  overflow: hidden;
  border-radius: inherit;
  background: #05090d;
}

.youtube-player__host {
  position: absolute;
  inset: 0;
}

.youtube-player__host :deep(iframe) {
  width: 100%;
  height: 100%;
  border: 0;
}

.youtube-player__status {
  position: absolute;
  inset: auto 0 0;
  padding: 0.7rem 0.85rem;
  background: rgba(7, 10, 13, 0.82);
  color: #fff;
  font-size: 0.78rem;
  line-height: 1.4;
}
</style>
