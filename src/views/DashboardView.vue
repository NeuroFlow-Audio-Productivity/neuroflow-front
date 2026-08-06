<script setup lang="ts">
import {
  computed,
  defineAsyncComponent,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from 'vue'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Select from 'primevue/select'

import AppNavbar from '@/components/AppNavbar.vue'
import CognitiveEnvironmentVisual from '@/components/audios/CognitiveEnvironmentVisual.vue'
import YouTubePlayer from '@/components/audios/YouTubePlayer.vue'
import FlowJourneyPicker from '@/components/flows/FlowJourneyPicker.vue'
import { ApiError } from '@/services/authApi'
import { translateApiKey, translateApiMessage } from '@/services/apiMessageTranslator'
import { audioApi, audioSourceNeedsRefresh, audioSourceUrl } from '@/services/audioApi'
import {
  completeCurrentFlowNode,
  createFlowExecutionState,
  flowProgressPercent,
  flowSectionViews,
  nodeDurationSeconds,
  resolveFlowNodeEndAudio,
  resolveFlowNodeMode,
  restartFlowExecutionState,
  sortFlowNodes,
  type FlowExecutionState,
  type FlowSession,
} from '@/services/flowExecution'
import { flowApi } from '@/services/flowApi'
import { flowNodeApi } from '@/services/flowNodeApi'
import { modeApi } from '@/services/modeApi'
import { normalizeNeuralCoreProgress, resolveNeuralCoreSessionState } from '@/services/neuralCore'
import {
  modeInkColor,
  modeRgbString,
  modeRhythmStyle,
  modeSemanticKey,
  normalizeModeColor,
} from '@/services/modeVisuals'
import {
  createYouTubeTrack,
  emptyYouTubeLibrary,
  loadYouTubeLibrary,
  parseYouTubeUrl,
  removeYouTubeTrack as removeStoredYouTubeTrack,
  saveYouTubeLibrary,
  selectYouTubeTrack,
  upsertYouTubeTrack,
  youtubeLibraryStorageKey,
} from '@/services/youtubeTracks'
import { useAuthStore } from '@/stores/auth'
import { useVisualThemeStore } from '@/stores/visualTheme'
import type { Audio } from '@/types/audio'
import type { Flow, FlowNode } from '@/types/flow'
import type { Mode } from '@/types/mode'
import type { YouTubeLibrary, YouTubeTrack } from '@/types/youtube'
import type { YouTubePlayerState } from '@/services/youtubeIframeApi'

type TimerPhase = 'work' | 'shortBreak' | 'longBreak'
type AudioProvider = 'uploaded' | 'youtube'
type BrowserWindowWithLegacyAudioContext = Window & {
  webkitAudioContext?: typeof AudioContext
}

const NeuralCore = defineAsyncComponent(() => import('@/components/core/NeuralCore.vue'))

const defaultPhaseDurations: Record<TimerPhase, number> = {
  work: 25 * 60,
  shortBreak: 5 * 60,
  longBreak: 15 * 60,
}
const FLOW_EXECUTION_STORAGE_KEY = 'neuroflow-core-flow-session'
const MAX_COMPLETION_ALARM_SECONDS = 10
const ENDING_WARNING_SECONDS = 10

const phaseDurations = ref<Record<TimerPhase, number>>({ ...defaultPhaseDurations })

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

const fallbackModes: Mode[] = [
  {
    id: 1,
    name: 'Focus',
    description: 'Deep focus session for attention and flow.',
    color: '#6ee7d8',
    is_system: false,
    created_at: '',
    updated_at: '',
  },
  {
    id: 2,
    name: 'Relax',
    description: 'Relax session for breathing and recovery.',
    color: '#a7f3d0',
    is_system: false,
    created_at: '',
    updated_at: '',
  },
  {
    id: 3,
    name: 'Sleep',
    description: 'Sleep session for slower evening wind-down.',
    color: '#c4b5fd',
    is_system: false,
    created_at: '',
    updated_at: '',
  },
]

const { t } = useI18n()
const auth = useAuthStore()
const visualTheme = useVisualThemeStore()

const modes = ref<Mode[]>([])
const audios = ref<Audio[]>([])
const alarmAudios = ref<Audio[]>([])
const flowCompletionAudios = ref<Audio[]>([])
const flows = ref<Flow[]>([])
const flowPickerNodesByFlowId = ref<Record<number, FlowNode[]>>({})
const isFlowPickerVisible = ref(false)
const loadingFlowSummaryIds = ref<number[]>([])
const selectedFlowId = ref<number | null>(null)
const flowSession = ref<FlowSession | null>(null)
const flowExecutionState = ref<FlowExecutionState | null>(null)
const isLoadingFlows = ref(false)
const isLoadingSelectedFlow = ref(false)
const selectedModeId = ref<number | null>(null)
const selectedAudioId = ref<string | number | null>(null)
const selectedAlarmAudioId = ref<string | number | null>(null)
const activeAudioProvider = ref<AudioProvider>('uploaded')
const youtubeLibrary = ref<YouTubeLibrary>(emptyYouTubeLibrary())
const isEnvironmentExplorerVisible = ref(false)
const environmentSearchQuery = ref('')
const previewEnvironmentId = ref<string | null>(null)
const previewYouTubeVideoId = ref<string | null>(null)
const selectingEnvironmentId = ref<string | null>(null)
const selectingYouTubeVideoId = ref<string | null>(null)
const isYouTubeComposerVisible = ref(false)
const youtubeDraftUrl = ref('')
const youtubeDraftTrack = ref<YouTubeTrack | null>(null)
const youtubeDraftError = ref<string | null>(null)
const youtubePreviewPlayableVideoId = ref<string | null>(null)
const youtubePreviewError = ref<string | null>(null)
const youtubePlayerError = ref<string | null>(null)
const isEnvironmentLanding = ref(false)
const timerPhase = ref<TimerPhase>('work')
const remainingSeconds = ref(defaultPhaseDurations.work)
const cycleIndex = ref(0)
const completedBlocks = ref(0)
const isRunning = ref(false)
const hasSessionStarted = ref(false)
const neuralCoreResetSignal = ref(0)
const neuralCoreWaveSignal = ref(0)
const neuralCoreCompletionSignal = ref(0)
const isLoadingModes = ref(false)
const isLoadingAudios = ref(false)
const isLoadingAlarmAudios = ref(false)
const isDurationDialogVisible = ref(false)
const durationDraft = ref<Record<TimerPhase, number>>({
  work: Math.floor(defaultPhaseDurations.work / 60),
  shortBreak: Math.floor(defaultPhaseDurations.shortBreak / 60),
  longBreak: Math.floor(defaultPhaseDurations.longBreak / 60),
})
const error = ref<string | null>(null)

const audioElement = ref<HTMLAudioElement | null>(null)
const alarmAudioElement = ref<HTMLAudioElement | null>(null)
const environmentPreviewAudioElement = ref<HTMLAudioElement | null>(null)
const activeYouTubePlayer = ref<InstanceType<typeof YouTubePlayer> | null>(null)
const youtubeCurrentSeconds = ref(0)
const youtubeDurationSeconds = ref(0)
const isYouTubeVideoHovered = ref(false)
const isYouTubeCoverVisible = ref(true)
const audioVolume = ref(0.74)
const isAudioMuted = ref(false)
const isAudioPlaying = ref(false)
const isAudioWaiting = ref(false)
const hasAudioError = ref(false)

let timerInterval: ReturnType<typeof window.setInterval> | undefined
let timerDeadline: number | undefined
let defaultDocumentTitle = 'NeuroFlow'
let completionAlarmTimeout: ReturnType<typeof window.setTimeout> | undefined
let environmentSelectionTimeout: ReturnType<typeof window.setTimeout> | undefined
let environmentLandingTimeout: ReturnType<typeof window.setTimeout> | undefined
let youtubeCoverTimeout: number | undefined
let environmentPreviewFrame: number | undefined
let activeCompletionBellGain: GainNode | undefined
let completionAudioContext: AudioContext | undefined
let environmentExplorerScrollY = 0
let bodyStyleBeforeEnvironmentExplorer: string | undefined
let htmlOverflowBeforeEnvironmentExplorer = ''
const audioRefreshRequests = new Map<string, Promise<Audio>>()

const phaseOptions = computed(() =>
  (['work', 'shortBreak', 'longBreak'] as TimerPhase[]).map((phase) => ({
    key: phase,
    label: t(`coreTimer.phases.${phase}`),
    icon: phaseIcons[phase],
    minutes: Math.floor(phaseDurations.value[phase] / 60),
  })),
)

function normalizedModeName(mode: Mode) {
  return mode.name.trim().toLowerCase()
}

function modeSystemFlag(mode: Mode) {
  const flag =
    (mode as { isSystem?: unknown; is_system?: unknown }).is_system ??
    (mode as { isSystem?: unknown; is_system?: unknown }).isSystem

  if (typeof flag === 'boolean') return flag
  if (typeof flag === 'number') return flag === 1
  if (typeof flag === 'string') return ['1', 'true', 'yes'].includes(flag.trim().toLowerCase())

  return false
}

function isSessionAlarmMode(mode: Mode) {
  return normalizedModeName(mode) === 'session alarm'
}

function isSystemMode(mode: Mode) {
  return modeSystemFlag(mode) || isSessionAlarmMode(mode)
}

const sortedSystemModes = computed(() =>
  [...modes.value].filter((mode) => isSystemMode(mode)).sort((a, b) => a.id - b.id),
)
const sortedModes = computed(() =>
  [...modes.value].filter((mode) => !isSystemMode(mode)).sort((a, b) => a.id - b.id),
)
const sessionAlarmMode = computed(
  () =>
    sortedSystemModes.value.find((mode) => isSessionAlarmMode(mode)) ??
    sortedSystemModes.value[0] ??
    null,
)
const sortedFlows = computed(() =>
  [...flows.value].sort((first, second) => first.name.localeCompare(second.name)),
)
const isFlowLoaded = computed(() => Boolean(flowSession.value && flowExecutionState.value))
const flowNodes = computed(() => flowSession.value?.nodes ?? [])
const activeFlowNode = computed(() => {
  const session = flowSession.value
  const state = flowExecutionState.value

  if (!session || !state || state.isComplete) return null

  return session.nodes[state.currentNodeIndex] ?? null
})
const activeFlowMode = computed(() => resolveFlowNodeMode(activeFlowNode.value, modes.value))
const selectedMode = computed(
  () =>
    activeFlowMode.value ??
    sortedModes.value.find((mode) => mode.id === selectedModeId.value) ??
    null,
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
const sortedAlarmAudios = computed(() =>
  [...alarmAudios.value].sort((a, b) => a.name.localeCompare(b.name)),
)
const selectedAudio = computed(
  () =>
    sortedAudios.value.find((audio) => audioId(audio) === String(selectedAudioId.value)) ?? null,
)
const selectedAlarmAudio = computed(
  () =>
    sortedAlarmAudios.value.find(
      (audio) => audioId(audio) === String(selectedAlarmAudioId.value),
    ) ?? null,
)
const currentFlowCompletionAudio = computed(() =>
  resolveFlowNodeEndAudio(activeFlowNode.value, flowCompletionAudios.value),
)
const youtubeTracks = computed(() => youtubeLibrary.value.tracks)
const selectedYouTubeTrack = computed(
  () =>
    youtubeTracks.value.find((track) => track.videoId === youtubeLibrary.value.selectedVideoId) ??
    null,
)
const isYouTubeAudioSelected = computed(
  () => activeAudioProvider.value === 'youtube' && Boolean(selectedYouTubeTrack.value),
)
const youtubeCoverUrl = computed(() =>
  selectedYouTubeTrack.value
    ? 'https://i.ytimg.com/vi/' +
      encodeURIComponent(selectedYouTubeTrack.value.videoId) +
      '/maxresdefault.jpg'
    : '',
)
const selectedAudioSource = computed(() =>
  isYouTubeAudioSelected.value ? '' : audioSourceUrl(selectedAudio.value),
)
const selectedAlarmAudioSource = computed(() =>
  audioSourceUrl(isFlowLoaded.value ? currentFlowCompletionAudio.value : selectedAlarmAudio.value),
)
const selectedTrackLabel = computed(() =>
  isYouTubeAudioSelected.value && selectedYouTubeTrack.value
    ? selectedYouTubeTrack.value.title
    : (selectedAudio.value?.name ?? t('coreTimer.audio.noTrack')),
)
const activeEnvironmentLabel = computed(() => {
  if (isYouTubeAudioSelected.value && selectedYouTubeTrack.value) {
    return selectedYouTubeTrack.value.title
  }

  return selectedAudio.value
    ? formatEnvironmentTitle(selectedAudio.value.name)
    : t('coreTimer.audio.noTrack')
})
const activeEnvironmentSubtitle = computed(() =>
  isYouTubeAudioSelected.value
    ? t('coreTimer.environment.youtubeSource')
    : selectedAudio.value
      ? audioModeLabel(selectedAudio.value)
      : selectedModeName.value,
)
const filteredEnvironmentAudios = computed(() => {
  const query = environmentSearchQuery.value.trim().toLowerCase()

  if (!query) return sortedAudios.value

  return sortedAudios.value.filter((audio) => {
    const name = formatEnvironmentTitle(audio.name).toLowerCase()
    const mode = audioModeLabel(audio).toLowerCase()

    return name.includes(query) || mode.includes(query)
  })
})
const filteredYouTubeTracks = computed(() => {
  const query = environmentSearchQuery.value.trim().toLowerCase()

  if (!query) return youtubeTracks.value

  return youtubeTracks.value.filter((track) => {
    return (
      track.title.toLowerCase().includes(query) ||
      track.videoId.toLowerCase().includes(query) ||
      t('coreTimer.environment.youtubeSource').toLowerCase().includes(query)
    )
  })
})
const previewYouTubeTrack = computed(
  () =>
    youtubeDraftTrack.value ??
    youtubeTracks.value.find((track) => track.videoId === previewYouTubeVideoId.value) ??
    null,
)
const isPreviewingYouTube = computed(() =>
  Boolean(isYouTubeComposerVisible.value || previewYouTubeTrack.value),
)
const previewEnvironmentAudio = computed(() => {
  if (isPreviewingYouTube.value) return null

  return (
    sortedAudios.value.find((audio) => audioId(audio) === previewEnvironmentId.value) ??
    (!isYouTubeAudioSelected.value ? selectedAudio.value : null) ??
    sortedAudios.value[0] ??
    null
  )
})
const environmentExplorerStyle = computed(() => {
  const palette = environmentPaletteForAudio(previewEnvironmentAudio.value)

  return {
    '--environment-aura': palette.aura,
    '--environment-rgb': palette.rgb,
    '--environment-ink': palette.ink,
  }
})
const selectedAlarmLabel = computed(() =>
  isFlowLoaded.value
    ? (currentFlowCompletionAudio.value?.name ?? t('coreTimer.flow.noAlarm'))
    : (selectedAlarmAudio.value?.name ?? t('coreTimer.settings.defaultAlarm')),
)
const alarmOptions = computed(() => [
  { label: t('coreTimer.settings.defaultAlarm'), value: null },
  ...sortedAlarmAudios.value.map((audio) => ({
    label: audio.name,
    value: audio.id,
  })),
])
const hasAudioSource = computed(
  () => isYouTubeAudioSelected.value || Boolean(selectedAudioSource.value),
)
const audioVolumeStyle = computed(() => ({
  '--audio-volume': `${isAudioMuted.value ? 0 : audioVolume.value * 100}%`,
}))
const youtubeProgressStyle = computed(() => ({
  '--youtube-progress': youtubeDurationSeconds.value
    ? String(Math.min(100, (youtubeCurrentSeconds.value / youtubeDurationSeconds.value) * 100)) +
      '%'
    : '0%',
}))
const audioVolumeIcon = computed(() => {
  if (isAudioMuted.value || audioVolume.value === 0) return 'pi pi-volume-off'
  if (audioVolume.value < 0.5) return 'pi pi-volume-down'

  return 'pi pi-volume-up'
})
const audioStatusLabel = computed(() => {
  if (isYouTubeAudioSelected.value) {
    if (isAudioWaiting.value) return t('coreTimer.environment.youtubeBuffering')

    return isRunning.value ? t('coreTimer.audio.playing') : t('coreTimer.audio.ready')
  }

  return isAudioPlaying.value ? t('coreTimer.audio.playing') : t('coreTimer.audio.ready')
})

const currentPhaseTotalSeconds = computed(() =>
  activeFlowNode.value
    ? nodeDurationSeconds(activeFlowNode.value)
    : phaseDurations.value[timerPhase.value],
)
const formattedRemaining = computed(() => formatClock(remainingSeconds.value))
const timerProgress = computed(() => {
  const totalSeconds = currentPhaseTotalSeconds.value

  if (!totalSeconds) return 0

  return Math.min(100, Math.max(0, ((totalSeconds - remainingSeconds.value) / totalSeconds) * 100))
})
const neuralCoreProgress = computed(() => normalizeNeuralCoreProgress(timerProgress.value))
const neuralCoreSessionState = computed(() =>
  resolveNeuralCoreSessionState(isRunning.value, neuralCoreProgress.value, hasSessionStarted.value),
)
const neuralCoreModeKey = computed(() => selectedModeKey.value ?? 'focus')
const neuralCoreAccentColor = computed(
  () =>
    visualTheme.modes.find((mode) => mode.key === neuralCoreModeKey.value)?.accent ??
    normalizeModeColor(selectedMode.value?.color ?? visualTheme.activePalette.accent),
)
const isTimerEndingSoon = computed(
  () =>
    isRunning.value &&
    remainingSeconds.value > 0 &&
    remainingSeconds.value <= ENDING_WARNING_SECONDS,
)
const playPauseLabel = computed(() =>
  isRunning.value ? t('coreTimer.actions.pause') : t('coreTimer.actions.start'),
)
const playPauseIcon = computed(() => (isRunning.value ? 'pi pi-pause' : 'pi pi-play'))
const isMinimalMode = ref(false)
const isMusicPanelExpanded = ref(true)
const isMusicPanelCompact = computed(() => !isMusicPanelExpanded.value)
const minimalModeLabel = computed(() =>
  isMinimalMode.value ? t('coreTimer.actions.exitMinimal') : t('coreTimer.actions.enterMinimal'),
)
const minimalModeIcon = computed(() =>
  isMinimalMode.value ? 'pi pi-window-maximize' : 'pi pi-window-minimize',
)
const activeCycleStep = computed(() => cycleIndex.value + 1)
const environmentOptionCount = computed(
  () => sortedAudios.value.length + youtubeTracks.value.length,
)
const trackCountLabel = computed(() =>
  t('coreTimer.audio.trackCount', { count: environmentOptionCount.value }),
)
const flowSectionList = computed(() =>
  flowSession.value
    ? flowSectionViews(flowSession.value, flowExecutionState.value, modes.value)
    : [],
)
const completedFlowSections = computed(() => flowExecutionState.value?.completedNodeIds.length ?? 0)
const totalFlowSections = computed(() => flowNodes.value.length)
const currentFlowSectionNumber = computed(() =>
  flowExecutionState.value && totalFlowSections.value > 0
    ? Math.min(flowExecutionState.value.currentNodeIndex + 1, totalFlowSections.value)
    : 0,
)
const flowProgressLabel = computed(() =>
  t('coreTimer.flow.progress', {
    completed: completedFlowSections.value,
    total: totalFlowSections.value,
  }),
)
const flowProgressStyle = computed(() => ({
  '--flow-progress':
    String(flowProgressPercent(flowExecutionState.value, totalFlowSections.value)) + '%',
}))
const sessionTitle = computed(() => flowSession.value?.flow.name ?? selectedModeName.value)
const sessionSubtitle = computed(() => {
  if (flowExecutionState.value?.isComplete && flowSession.value) {
    return t('coreTimer.flow.completedSubtitle', { flow: flowSession.value.flow.name })
  }

  if (activeFlowNode.value) {
    return t('coreTimer.flow.activeSection', {
      current: currentFlowSectionNumber.value,
      total: totalFlowSections.value,
      title: activeFlowNode.value.title,
    })
  }

  return selectedModeDescription.value
})
const timerEyebrow = computed(
  () => activeFlowNode.value?.title ?? t('coreTimer.phases.' + timerPhase.value),
)
const isFlowEmpty = computed(() => Boolean(flowSession.value && totalFlowSections.value === 0))
const canRunTimer = computed(
  () => Boolean(selectedMode.value) && !isFlowEmpty.value && !flowExecutionState.value?.isComplete,
)
const flowEditRoute = computed(() =>
  flowSession.value ? { name: 'flows-edit', params: { id: flowSession.value.flow.id } } : '/flows',
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

function isPreviewEnvironment(audio: Audio) {
  return (
    audioId(audio) ===
    String(previewEnvironmentAudio.value ? audioId(previewEnvironmentAudio.value) : '')
  )
}

function audioModeLabel(audio: Audio | null | undefined) {
  return audio?.mode ? translatedModeName(audio.mode) : selectedModeName.value
}

function audioModeColor(audio: Audio | null | undefined) {
  return normalizeModeColor(audio?.mode?.color ?? selectedMode.value?.color)
}

function formatEnvironmentTitle(name: string) {
  return name
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/(^|\s)(\S)/g, (_match, space: string, letter: string) => space + letter.toUpperCase())
}

function environmentHash(input: string) {
  return Array.from(input).reduce(
    (hash, character) => (hash * 31 + character.charCodeAt(0)) >>> 0,
    2166136261,
  )
}

function environmentPaletteForAudio(audio: Audio | null | undefined) {
  const modeColor = audioModeColor(audio)

  return {
    aura: modeColor,
    rgb: modeRgbString(modeColor),
    ink: modeInkColor(modeColor),
  }
}

function environmentCoverStyle(audio: Audio | null | undefined, index = 0) {
  const palette = environmentPaletteForAudio(audio)
  const hash = audio
    ? environmentHash(formatEnvironmentTitle(audio.name) + audioModeLabel(audio))
    : index

  return {
    '--environment-card-aura': palette.aura,
    '--environment-card-rgb': palette.rgb,
    '--environment-card-ink': palette.ink,
    '--environment-card-shift': String(hash % 42) + '%',
  }
}

function environmentCardStyle(audio: Audio, index: number) {
  return environmentCoverStyle(audio, index)
}

function environmentSignatureSeed(audio: Audio) {
  return audioId(audio) + ':' + formatEnvironmentTitle(audio.name) + ':' + audioModeLabel(audio)
}

function youtubeTrackId(track: YouTubeTrack) {
  return 'youtube:' + track.videoId
}

function isSelectedYouTubeTrack(track: YouTubeTrack) {
  return isYouTubeAudioSelected.value && selectedYouTubeTrack.value?.videoId === track.videoId
}

function isPreviewYouTubeTrack(track: YouTubeTrack) {
  return previewYouTubeTrack.value?.videoId === track.videoId
}

function youtubeEnvironmentSeed(track: YouTubeTrack) {
  return 'youtube:' + track.videoId + ':' + track.title
}

function youtubeEnvironmentCoverStyle(track: YouTubeTrack | null | undefined, index = 0) {
  const palette = environmentPaletteForAudio(null)
  const hash = track ? environmentHash(youtubeEnvironmentSeed(track)) : index

  return {
    '--environment-card-aura': palette.aura,
    '--environment-card-rgb': palette.rgb,
    '--environment-card-ink': palette.ink,
    '--environment-card-shift': String(hash % 42) + '%',
  }
}

function formatClock(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds))
  const minutes = Math.floor(safeSeconds / 60)
  const seconds = safeSeconds % 60

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function handleYouTubeTimeUpdate(currentSeconds: number, durationSeconds: number) {
  youtubeCurrentSeconds.value = Math.min(durationSeconds, Math.max(0, currentSeconds))
  youtubeDurationSeconds.value = Math.max(0, durationSeconds)
}

function seekYouTubeVideo(event: Event) {
  const nextSeconds = Number((event.target as HTMLInputElement).value)

  youtubeCurrentSeconds.value = nextSeconds
  activeYouTubePlayer.value?.seekTo(nextSeconds)
}

function clearYouTubeCoverTimeout() {
  if (youtubeCoverTimeout === undefined) return

  window.clearTimeout(youtubeCoverTimeout)
  youtubeCoverTimeout = undefined
}

function revealYouTubeVideo() {
  clearYouTubeCoverTimeout()
  isYouTubeVideoHovered.value = true
  isYouTubeCoverVisible.value = false
}

function scheduleYouTubeCover() {
  clearYouTubeCoverTimeout()
  isYouTubeVideoHovered.value = false
  youtubeCoverTimeout = window.setTimeout(() => {
    isYouTubeCoverVisible.value = true
    youtubeCoverTimeout = undefined
  }, 1000)
}

function useFallbackYouTubeCover(event: Event) {
  const image = event.target as HTMLImageElement
  const videoId = selectedYouTubeTrack.value?.videoId

  if (!videoId || image.dataset.fallback === 'true') return

  image.dataset.fallback = 'true'
  image.src = 'https://i.ytimg.com/vi/' + encodeURIComponent(videoId) + '/mqdefault.jpg'
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

function browserStorage() {
  return typeof localStorage === 'undefined' ? null : localStorage
}

function currentYouTubeStorageKey() {
  return youtubeLibraryStorageKey(auth.user?.id ?? null)
}

function persistYouTubeLibrary(nextLibrary = youtubeLibrary.value) {
  const parsedLibrary = { ...nextLibrary }

  youtubeLibrary.value = parsedLibrary
  saveYouTubeLibrary(browserStorage(), currentYouTubeStorageKey(), parsedLibrary)
}

function loadStoredYouTubeLibrary() {
  youtubeLibrary.value = loadYouTubeLibrary(browserStorage(), currentYouTubeStorageKey())

  activeAudioProvider.value = youtubeLibrary.value.selectedVideoId ? 'youtube' : 'uploaded'
}

function updateStoredYouTubeTrackTitle(videoId: string, title: string) {
  const cleanedTitle = title.trim()

  if (!cleanedTitle) return

  let didUpdate = false
  const tracks = youtubeLibrary.value.tracks.map((track) => {
    if (track.videoId !== videoId || track.title === cleanedTitle) return track

    didUpdate = true
    return { ...track, title: cleanedTitle }
  })

  if (didUpdate) {
    persistYouTubeLibrary({ ...youtubeLibrary.value, tracks })
  }

  if (youtubeDraftTrack.value?.videoId === videoId) {
    youtubeDraftTrack.value = { ...youtubeDraftTrack.value, title: cleanedTitle }
  }
}

function readPersistedFlowExecutionState() {
  const rawState = browserStorage()?.getItem(FLOW_EXECUTION_STORAGE_KEY)

  if (!rawState) return null

  try {
    const parsed = JSON.parse(rawState) as Partial<FlowExecutionState>

    if (typeof parsed.flowId === 'number') return parsed
  } catch {
    return null
  }

  return null
}

function persistFlowExecutionState() {
  const state = flowExecutionState.value

  if (!state || !flowSession.value) return

  browserStorage()?.setItem(FLOW_EXECUTION_STORAGE_KEY, JSON.stringify(state))
}

function clearPersistedFlowExecutionState() {
  browserStorage()?.removeItem(FLOW_EXECUTION_STORAGE_KEY)
}

function syncActiveFlowMode() {
  const node = activeFlowNode.value

  if (!node) return

  selectedModeId.value = Number(node.mode_id)
}

async function loadFlows() {
  if (!auth.token) return

  isLoadingFlows.value = true

  try {
    const response = await flowApi.listFlows(auth.token)
    flows.value = response.data
    void loadFlowPickerSummaries(response.data)
  } catch (caughtError) {
    setError(caughtError, 'coreTimer.errors.loadFlows')
  } finally {
    isLoadingFlows.value = false
  }
}

async function loadFlowSession(flowId: number, persistedState = readPersistedFlowExecutionState()) {
  if (!auth.token) return

  isLoadingSelectedFlow.value = true
  error.value = null
  pauseSession()

  try {
    const [flow, nodesResponse] = await Promise.all([
      flowApi.getFlow(auth.token, flowId),
      flowNodeApi.listFlowNodes(auth.token, flowId),
    ])
    const session = { flow, nodes: sortFlowNodes(nodesResponse.data) }

    try {
      const audiosResponse = await audioApi.listAllAudios(auth.token)
      flowCompletionAudios.value = audiosResponse.data
    } catch {
      flowCompletionAudios.value = session.nodes
        .map((node) => node.end_audio ?? node.end_sound_alarm)
        .filter((audio): audio is Audio => Boolean(audio))
    }
    flowSession.value = session
    flowExecutionState.value = createFlowExecutionState(session, persistedState)
    remainingSeconds.value = flowExecutionState.value.remainingSeconds
    hasSessionStarted.value = neuralCoreProgress.value > 0
    neuralCoreResetSignal.value += 1
    syncActiveFlowMode()
    persistFlowExecutionState()
  } catch (caughtError) {
    flowSession.value = null
    flowExecutionState.value = null
    selectedFlowId.value = null
    clearPersistedFlowExecutionState()
    setError(caughtError, 'coreTimer.errors.loadFlow')
  } finally {
    isLoadingSelectedFlow.value = false
  }
}

function clearLoadedFlow() {
  pauseSession()
  selectedFlowId.value = null
  flowSession.value = null
  flowExecutionState.value = null
  flowCompletionAudios.value = []
  clearPersistedFlowExecutionState()
  remainingSeconds.value = phaseDurations.value[timerPhase.value]
  hasSessionStarted.value = false
  neuralCoreResetSignal.value += 1
}

function restartLoadedFlow() {
  const session = flowSession.value

  if (!session) return

  pauseSession()
  flowExecutionState.value = restartFlowExecutionState(session)
  remainingSeconds.value = flowExecutionState.value.remainingSeconds
  hasSessionStarted.value = false
  neuralCoreResetSignal.value += 1
  syncActiveFlowMode()
  persistFlowExecutionState()
}

async function loadFlowPickerSummaries(targetFlows = flows.value) {
  if (!auth.token) return

  const flowsMissingNodes = targetFlows.filter((flow) => !flowPickerNodesByFlowId.value[flow.id])

  if (flowsMissingNodes.length === 0) return

  loadingFlowSummaryIds.value = flowsMissingNodes.map((flow) => flow.id)

  try {
    const summaryEntries = await Promise.all(
      flowsMissingNodes.map(async (flow) => {
        const response = await flowNodeApi.listFlowNodes(auth.token as string, flow.id)

        return [flow.id, sortFlowNodes(response.data)] as const
      }),
    )

    flowPickerNodesByFlowId.value = {
      ...flowPickerNodesByFlowId.value,
      ...Object.fromEntries(summaryEntries),
    }
  } catch (caughtError) {
    setError(caughtError, 'coreTimer.errors.loadFlow')
  } finally {
    loadingFlowSummaryIds.value = []
  }
}

async function openFlowPicker() {
  isFlowPickerVisible.value = true

  if (flows.value.length === 0) {
    await loadFlows()
  }

  void loadFlowPickerSummaries()
}

async function startFlowJourney(flowId: number) {
  await loadFlowSession(flowId, null)
  selectedFlowId.value = flowId
  isFlowPickerVisible.value = false
}

async function loadModes() {
  isLoadingModes.value = true
  error.value = null

  try {
    const response = await modeApi.listAllModes(auth.token)

    const nextModes = response.data.length > 0 ? response.data : fallbackModes
    const nextSessionModes = nextModes.filter((mode) => !isSystemMode(mode))

    modes.value = nextModes
    selectedModeId.value = nextSessionModes.some((mode) => mode.id === selectedModeId.value)
      ? selectedModeId.value
      : (nextSessionModes.find((mode) => modeSemanticKey(mode) === 'focus')?.id ??
        nextSessionModes[0]?.id ??
        null)

    if (sessionAlarmMode.value) {
      await loadAlarmAudiosForMode(sessionAlarmMode.value.id)
    } else {
      alarmAudios.value = []
      selectedAlarmAudioId.value = null
    }
  } catch (caughtError) {
    modes.value = fallbackModes
    alarmAudios.value = []
    selectedAlarmAudioId.value = null
    selectedModeId.value =
      fallbackModes.find((mode) => modeSemanticKey(mode) === 'focus')?.id ??
      fallbackModes[0]?.id ??
      null
    setError(caughtError, 'coreTimer.errors.loadModes')
  } finally {
    isLoadingModes.value = false
  }
}

async function loadAudiosForMode(modeId: number) {
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

async function loadAlarmAudiosForMode(modeId: number) {
  isLoadingAlarmAudios.value = true

  try {
    const response = await audioApi.listAudiosForMode(auth.token, modeId, { per_page: 50 })

    if (sessionAlarmMode.value?.id !== modeId) return

    alarmAudios.value = response.data
    selectedAlarmAudioId.value = response.data.some(
      (audio) => audioId(audio) === String(selectedAlarmAudioId.value),
    )
      ? selectedAlarmAudioId.value
      : (response.data[0]?.id ?? null)
  } catch (caughtError) {
    if (sessionAlarmMode.value?.id === modeId) {
      alarmAudios.value = []
      selectedAlarmAudioId.value = null
      setError(caughtError, 'coreTimer.errors.loadAlarmAudios')
    }
  } finally {
    if (sessionAlarmMode.value?.id === modeId) {
      isLoadingAlarmAudios.value = false
    }
  }
}

function replaceAudioRecord(collection: Audio[], refreshedAudio: Audio) {
  const refreshedId = audioId(refreshedAudio)

  return collection.map((audio) => (audioId(audio) === refreshedId ? refreshedAudio : audio))
}

function storeRefreshedAudio(refreshedAudio: Audio) {
  audios.value = replaceAudioRecord(audios.value, refreshedAudio)
  alarmAudios.value = replaceAudioRecord(alarmAudios.value, refreshedAudio)
  flowCompletionAudios.value = replaceAudioRecord(flowCompletionAudios.value, refreshedAudio)

  return refreshedAudio
}

async function ensureFreshAudioSource(audio: Audio) {
  if (!audioSourceNeedsRefresh(audio)) return audio
  if (!auth.token) throw new Error('Missing authentication token')

  const id = audioId(audio)
  const pendingRefresh = audioRefreshRequests.get(id)

  if (pendingRefresh) return pendingRefresh

  const refreshRequest = audioApi
    .getAudio(auth.token, audio.id)
    .then(storeRefreshedAudio)
    .finally(() => audioRefreshRequests.delete(id))

  audioRefreshRequests.set(id, refreshRequest)

  return refreshRequest
}

function clearTimerInterval() {
  if (timerInterval === undefined) return

  window.clearInterval(timerInterval)
  timerInterval = undefined
}

function updateDocumentTitle() {
  document.title =
    (document.hidden || !document.hasFocus()) && isRunning.value
      ? `${formattedRemaining.value} · ${defaultDocumentTitle}`
      : defaultDocumentTitle
}

function syncTimerFromDeadline() {
  if (!isRunning.value || timerDeadline === undefined) return

  const nextRemainingSeconds = Math.max(0, Math.ceil((timerDeadline - Date.now()) / 1000))

  if (nextRemainingSeconds <= 0) {
    completeExpiredPhase()
    return
  }

  if (nextRemainingSeconds === remainingSeconds.value) return

  remainingSeconds.value = nextRemainingSeconds

  if (flowExecutionState.value) {
    flowExecutionState.value = {
      ...flowExecutionState.value,
      remainingSeconds: nextRemainingSeconds,
    }
    persistFlowExecutionState()
  }
}

function handleDocumentVisibilityChange() {
  syncTimerFromDeadline()
  updateDocumentTitle()
}

function clearCompletionAlarmTimeout() {
  if (completionAlarmTimeout === undefined) return

  window.clearTimeout(completionAlarmTimeout)
  completionAlarmTimeout = undefined
}

function stopCompletionAlarm() {
  clearCompletionAlarmTimeout()

  if (activeCompletionBellGain) {
    activeCompletionBellGain.disconnect()
    activeCompletionBellGain = undefined
  }

  const alarmAudio = alarmAudioElement.value

  if (!alarmAudio) return

  alarmAudio.pause()
  alarmAudio.currentTime = 0
}

function getCompletionAudioContext() {
  const AudioContextConstructor =
    window.AudioContext ?? (window as BrowserWindowWithLegacyAudioContext).webkitAudioContext

  if (!AudioContextConstructor) return null

  completionAudioContext ??= new AudioContextConstructor()

  return completionAudioContext
}

async function prepareCompletionBell() {
  const audioContext = getCompletionAudioContext()

  if (!audioContext || audioContext.state !== 'suspended') return

  try {
    await audioContext.resume()
  } catch {
    // The timer can still run if the browser refuses notification audio.
  }
}

async function ringCompletionBell() {
  const audioContext = getCompletionAudioContext()

  if (!audioContext) return

  try {
    if (audioContext.state === 'suspended') {
      await audioContext.resume()
    }

    const now = audioContext.currentTime
    const bellFrequencies = [880, 1174.66]
    const masterGain = audioContext.createGain()

    masterGain.gain.setValueAtTime(0.0001, now)
    masterGain.gain.exponentialRampToValueAtTime(0.48, now + 0.02)
    masterGain.gain.setValueAtTime(0.48, now + MAX_COMPLETION_ALARM_SECONDS - 0.15)
    masterGain.gain.exponentialRampToValueAtTime(0.0001, now + MAX_COMPLETION_ALARM_SECONDS)
    masterGain.connect(audioContext.destination)
    activeCompletionBellGain = masterGain

    const ringCount = Math.ceil(MAX_COMPLETION_ALARM_SECONDS / 1.25)

    Array.from({ length: ringCount }).forEach((_, ringIndex) => {
      bellFrequencies.forEach((frequency, noteIndex) => {
        const oscillator = audioContext.createOscillator()
        const noteGain = audioContext.createGain()
        const startTime = now + ringIndex * 1.25 + noteIndex * 0.14
        const stopTime = Math.min(startTime + 0.72, now + MAX_COMPLETION_ALARM_SECONDS)

        oscillator.type = 'sine'
        oscillator.frequency.setValueAtTime(frequency, startTime)
        noteGain.gain.setValueAtTime(0.0001, startTime)
        noteGain.gain.exponentialRampToValueAtTime(1, startTime + 0.02)
        noteGain.gain.exponentialRampToValueAtTime(0.0001, stopTime)

        oscillator.connect(noteGain).connect(masterGain)
        oscillator.start(startTime)
        oscillator.stop(stopTime)
        oscillator.onended = () => {
          oscillator.disconnect()
          noteGain.disconnect()
        }
      })
    })

    completionAlarmTimeout = window.setTimeout(() => {
      masterGain.disconnect()
      activeCompletionBellGain = undefined
      completionAlarmTimeout = undefined
    }, MAX_COMPLETION_ALARM_SECONDS * 1000)
  } catch {
    // Bell playback is best-effort and should never block the next phase.
  }
}

async function playCompletionAlarm(
  audio = isFlowLoaded.value ? currentFlowCompletionAudio.value : selectedAlarmAudio.value,
  isFlowAlarm = isFlowLoaded.value,
) {
  if (audio) {
    const alarmAudio = alarmAudioElement.value

    try {
      stopCompletionAlarm()

      if (!alarmAudio) throw new Error('Missing alarm audio element')

      const playableAudio = await ensureFreshAudioSource(audio)
      const source = audioSourceUrl(playableAudio)

      if (!source) throw new Error('Missing alarm audio source')
      if (alarmAudio.src !== source) {
        alarmAudio.src = source
        alarmAudio.load()
      }

      alarmAudio.currentTime = 0
      await alarmAudio.play()
      completionAlarmTimeout = window.setTimeout(
        stopCompletionAlarm,
        MAX_COMPLETION_ALARM_SECONDS * 1000,
      )
      return
    } catch {
      if (isFlowAlarm) return
      // Fall back to the generated bell if the uploaded alarm cannot play.
    }
  }

  if (!isFlowAlarm) {
    await ringCompletionBell()
  }
}

function completePhase() {
  if (flowSession.value && flowExecutionState.value) {
    flowExecutionState.value = completeCurrentFlowNode(flowExecutionState.value, flowSession.value)
    remainingSeconds.value = flowExecutionState.value.remainingSeconds
    syncActiveFlowMode()
    persistFlowExecutionState()

    return
  }

  if (timerPhase.value === 'work') {
    completedBlocks.value += 1
  }

  cycleIndex.value = (cycleIndex.value + 1) % phaseCycle.length
  const nextPhase = phaseCycle[cycleIndex.value] ?? 'work'

  timerPhase.value = nextPhase
  remainingSeconds.value = phaseDurations.value[nextPhase]
}

function completeExpiredPhase() {
  const completionAlarm = isFlowLoaded.value
    ? currentFlowCompletionAudio.value
    : selectedAlarmAudio.value
  const isFlowAlarm = isFlowLoaded.value

  neuralCoreCompletionSignal.value += 1
  pauseSession(false)
  void playCompletionAlarm(completionAlarm, isFlowAlarm)
  completePhase()
  hasSessionStarted.value = false
  isMusicPanelExpanded.value = true
}

function tickTimer() {
  syncTimerFromDeadline()
}

function syncAudioVolume() {
  const audio = audioElement.value

  if (!audio) return

  audio.volume = audioVolume.value
  audio.muted = isAudioMuted.value
}

async function playAudio() {
  if (isYouTubeAudioSelected.value) return

  const currentAudio = selectedAudio.value

  if (!currentAudio) return

  try {
    const playableAudio = await ensureFreshAudioSource(currentAudio)

    if (audioSourceUrl(playableAudio) !== audioSourceUrl(currentAudio)) {
      return
    }

    await nextTick()

    const audio = audioElement.value

    if (!audio || !hasAudioSource.value) return

    syncAudioVolume()
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
  if (!canRunTimer.value) return

  isMusicPanelExpanded.value = false
  hasSessionStarted.value = true
  timerDeadline = Date.now() + remainingSeconds.value * 1000
  isRunning.value = true
  void prepareCompletionBell()
  await nextTick()
  await playAudio()
}

function pauseSession(reconcileTimer = true) {
  if (reconcileTimer && isRunning.value) {
    syncTimerFromDeadline()

    if (!isRunning.value) return
  }

  isRunning.value = false
  timerDeadline = undefined
  clearTimerInterval()
  stopCompletionAlarm()
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
  hasSessionStarted.value = false
  isMusicPanelExpanded.value = true
  neuralCoreResetSignal.value += 1

  if (flowExecutionState.value && activeFlowNode.value) {
    flowExecutionState.value = {
      ...flowExecutionState.value,
      remainingSeconds: nodeDurationSeconds(activeFlowNode.value),
      isComplete: false,
    }
    remainingSeconds.value = flowExecutionState.value.remainingSeconds
    persistFlowExecutionState()
    return
  }

  remainingSeconds.value = phaseDurations.value[timerPhase.value]
}

function skipPhase() {
  pauseSession()
  completePhase()
  hasSessionStarted.value = false
  isMusicPanelExpanded.value = true
  neuralCoreResetSignal.value += 1
}

function extendSession() {
  remainingSeconds.value += 5 * 60

  if (isRunning.value && timerDeadline !== undefined) {
    timerDeadline += 5 * 60 * 1000
  }
  neuralCoreWaveSignal.value += 1
}

function normalizeDurationMinutes(value: number) {
  return Math.min(180, Math.max(1, Math.round(Number.isFinite(value) ? value : 1)))
}

function openDurationDialog() {
  durationDraft.value = {
    work: Math.floor(phaseDurations.value.work / 60),
    shortBreak: Math.floor(phaseDurations.value.shortBreak / 60),
    longBreak: Math.floor(phaseDurations.value.longBreak / 60),
  }
  isDurationDialogVisible.value = true
}

function saveDurationSettings() {
  const previousTotalSeconds = currentPhaseTotalSeconds.value
  const elapsedSeconds = Math.max(0, previousTotalSeconds - remainingSeconds.value)
  const nextDurations: Record<TimerPhase, number> = {
    work: normalizeDurationMinutes(durationDraft.value.work) * 60,
    shortBreak: normalizeDurationMinutes(durationDraft.value.shortBreak) * 60,
    longBreak: normalizeDurationMinutes(durationDraft.value.longBreak) * 60,
  }

  phaseDurations.value = nextDurations

  const nextTotalSeconds = nextDurations[timerPhase.value]
  remainingSeconds.value = isRunning.value
    ? Math.max(1, Math.min(nextTotalSeconds, nextTotalSeconds - elapsedSeconds))
    : nextTotalSeconds

  if (isRunning.value) {
    timerDeadline = Date.now() + remainingSeconds.value * 1000
  }
  isDurationDialogVisible.value = false
}

function toggleMinimalMode() {
  isMinimalMode.value = !isMinimalMode.value
}

function expandMusicPanel() {
  isMusicPanelExpanded.value = true
}

function collapseMusicPanel() {
  isMusicPanelExpanded.value = false
}

function selectPhase(phase: TimerPhase) {
  if (isFlowLoaded.value || timerPhase.value === phase) return

  pauseSession()
  timerPhase.value = phase
  cycleIndex.value = phaseCycle.findIndex((cyclePhase) => cyclePhase === phase)
  remainingSeconds.value = phaseDurations.value[phase]
  hasSessionStarted.value = false
  neuralCoreResetSignal.value += 1
}

function resetYouTubePreviewState() {
  previewYouTubeVideoId.value = null
  selectingYouTubeVideoId.value = null
  isYouTubeComposerVisible.value = false
  youtubeDraftUrl.value = ''
  youtubeDraftTrack.value = null
  youtubeDraftError.value = null
  youtubePreviewPlayableVideoId.value = null
  youtubePreviewError.value = null
}

function openEnvironmentExplorer() {
  environmentSearchQuery.value = ''
  previewEnvironmentId.value =
    !isYouTubeAudioSelected.value && selectedAudio.value ? audioId(selectedAudio.value) : null
  previewYouTubeVideoId.value = isYouTubeAudioSelected.value
    ? (selectedYouTubeTrack.value?.videoId ?? null)
    : null
  selectingEnvironmentId.value = null
  selectingYouTubeVideoId.value = null
  isYouTubeComposerVisible.value = false
  youtubeDraftUrl.value = ''
  youtubeDraftTrack.value = null
  youtubeDraftError.value = null
  youtubePreviewPlayableVideoId.value = previewYouTubeVideoId.value
  youtubePreviewError.value = null
  isEnvironmentExplorerVisible.value = true
}

function closeEnvironmentExplorer() {
  isEnvironmentExplorerVisible.value = false
  selectingEnvironmentId.value = null
  previewEnvironmentId.value = null
  environmentSearchQuery.value = ''
  resetYouTubePreviewState()
  clearEnvironmentPreview()
}

function lockEnvironmentExplorerScroll() {
  if (bodyStyleBeforeEnvironmentExplorer !== undefined) return

  const { body, documentElement } = document
  environmentExplorerScrollY = window.scrollY
  bodyStyleBeforeEnvironmentExplorer = body.getAttribute('style') ?? ''
  htmlOverflowBeforeEnvironmentExplorer = documentElement.style.overflow

  documentElement.style.overflow = 'hidden'
  body.style.position = 'fixed'
  body.style.top = '-' + environmentExplorerScrollY + 'px'
  body.style.left = '0'
  body.style.right = '0'
  body.style.width = '100%'
  body.style.overflow = 'hidden'
}

function unlockEnvironmentExplorerScroll() {
  if (bodyStyleBeforeEnvironmentExplorer === undefined) return

  const { body, documentElement } = document
  const scrollY = environmentExplorerScrollY

  if (bodyStyleBeforeEnvironmentExplorer) {
    body.setAttribute('style', bodyStyleBeforeEnvironmentExplorer)
  } else {
    body.removeAttribute('style')
  }

  documentElement.style.overflow = htmlOverflowBeforeEnvironmentExplorer
  bodyStyleBeforeEnvironmentExplorer = undefined
  htmlOverflowBeforeEnvironmentExplorer = ''
  environmentExplorerScrollY = 0
  window.scrollTo(0, scrollY)
}

function finishEnvironmentLanding() {
  isEnvironmentLanding.value = false
}

function clearEnvironmentSelectionTimeout() {
  if (environmentSelectionTimeout === undefined) return

  window.clearTimeout(environmentSelectionTimeout)
  environmentSelectionTimeout = undefined
}

function clearEnvironmentLandingTimeout() {
  if (environmentLandingTimeout === undefined) return

  window.clearTimeout(environmentLandingTimeout)
  environmentLandingTimeout = undefined
}

function fadeEnvironmentPreviewVolume(targetVolume: number, onComplete?: () => void) {
  const previewAudio = environmentPreviewAudioElement.value

  if (!previewAudio) {
    onComplete?.()
    return
  }

  if (environmentPreviewFrame !== undefined) {
    window.cancelAnimationFrame(environmentPreviewFrame)
  }

  const startVolume = previewAudio.volume
  const startedAt = performance.now()
  const duration = 260

  const step = (time: number) => {
    const progress = Math.min(1, (time - startedAt) / duration)
    previewAudio.volume = startVolume + (targetVolume - startVolume) * progress

    if (progress < 1) {
      environmentPreviewFrame = window.requestAnimationFrame(step)
      return
    }

    environmentPreviewFrame = undefined
    onComplete?.()
  }

  environmentPreviewFrame = window.requestAnimationFrame(step)
}

function clearEnvironmentPreview() {
  fadeEnvironmentPreviewVolume(0, () => {
    const previewAudio = environmentPreviewAudioElement.value

    if (!previewAudio) return

    previewAudio.pause()
    delete previewAudio.dataset.previewSource
    previewAudio.removeAttribute('src')
    previewAudio.load()
  })
}

function clearYouTubeComposerMessages() {
  youtubeDraftError.value = null
  youtubePreviewError.value = null
  youtubePreviewPlayableVideoId.value = null
}

function startYouTubeComposer() {
  clearEnvironmentPreview()
  previewEnvironmentId.value = null
  previewYouTubeVideoId.value = null
  selectingEnvironmentId.value = null
  isYouTubeComposerVisible.value = true
  youtubeDraftUrl.value = ''
  youtubeDraftTrack.value = null
  clearYouTubeComposerMessages()
}

function previewYouTubeTrackRow(track: YouTubeTrack) {
  clearEnvironmentPreview()
  previewEnvironmentId.value = null
  youtubeDraftTrack.value = null
  youtubeDraftUrl.value = ''
  isYouTubeComposerVisible.value = false
  youtubeDraftError.value = null
  youtubePreviewError.value = null
  youtubePreviewPlayableVideoId.value = track.videoId
  previewYouTubeVideoId.value = track.videoId
}

function validateYouTubeDraft() {
  clearYouTubeComposerMessages()
  const parsedUrl = parseYouTubeUrl(youtubeDraftUrl.value)

  if (!parsedUrl) {
    youtubeDraftTrack.value = null
    youtubeDraftError.value = youtubeDraftUrl.value.trim()
      ? t('coreTimer.environment.youtubeInvalid')
      : null
    return
  }

  youtubeDraftTrack.value = createYouTubeTrack(parsedUrl)
}

function handleYouTubePreviewState(state: YouTubePlayerState) {
  if (!previewYouTubeTrack.value) return

  if ([1, 2, 5].includes(state)) {
    youtubePreviewPlayableVideoId.value = previewYouTubeTrack.value.videoId
    youtubePreviewError.value = null
  }
}

function handleYouTubePreviewError() {
  youtubePreviewPlayableVideoId.value = null
  youtubePreviewError.value = t('coreTimer.environment.youtubePreviewUnavailable')
}

function handleYouTubePlayerError() {
  hasAudioError.value = true
  youtubePlayerError.value = t('coreTimer.environment.youtubePlayerError')
}

function handleYouTubeAutoplayBlocked() {
  youtubePlayerError.value = t('coreTimer.environment.youtubeAutoplayBlocked')
}

function handleYouTubeTitle(videoId: string, title: string) {
  updateStoredYouTubeTrackTitle(videoId, title)
}

async function previewEnvironment(audio: Audio) {
  if (!isEnvironmentExplorerVisible.value || selectingEnvironmentId.value) return

  resetYouTubePreviewState()
  const previewId = audioId(audio)
  previewEnvironmentId.value = previewId

  try {
    const playableAudio = await ensureFreshAudioSource(audio)

    if (previewEnvironmentId.value !== previewId || !isEnvironmentExplorerVisible.value) return

    const previewAudio = environmentPreviewAudioElement.value
    const source = audioSourceUrl(playableAudio)

    if (!previewAudio || !source) return

    if (previewAudio.dataset.previewSource !== source) {
      previewAudio.dataset.previewSource = source
      previewAudio.src = source
      previewAudio.currentTime = 0
      previewAudio.load()
    }

    previewAudio.loop = true
    previewAudio.volume = Math.min(previewAudio.volume, 0.08)

    await previewAudio.play()
    fadeEnvironmentPreviewVolume(0.22)
  } catch {
    // Environment previews are best-effort and should not interrupt the session.
  }
}

function selectPreviewEnvironment() {
  if (previewYouTubeTrack.value) {
    selectYouTubeEnvironment(previewYouTubeTrack.value)
    return
  }

  if (!previewEnvironmentAudio.value) return

  selectEnvironment(previewEnvironmentAudio.value)
}

function selectEnvironment(audio: Audio) {
  clearEnvironmentSelectionTimeout()
  clearEnvironmentPreview()
  selectedAudioId.value = audio.id
  activeAudioProvider.value = 'uploaded'
  youtubePlayerError.value = null
  persistYouTubeLibrary(selectYouTubeTrack(youtubeLibrary.value, null))
  selectingEnvironmentId.value = audioId(audio)

  environmentSelectionTimeout = window.setTimeout(() => {
    isEnvironmentExplorerVisible.value = false
    selectingEnvironmentId.value = null
    resetYouTubePreviewState()
    isEnvironmentLanding.value = true
    clearEnvironmentLandingTimeout()
    environmentLandingTimeout = window.setTimeout(finishEnvironmentLanding, 720)

    if (isRunning.value) {
      void playAudio()
    }
  }, 440)
}

function selectYouTubeEnvironment(track: YouTubeTrack) {
  if (youtubePreviewPlayableVideoId.value !== track.videoId) {
    youtubePreviewError.value = t('coreTimer.environment.youtubePreviewUnavailable')
    return
  }

  clearEnvironmentSelectionTimeout()
  clearEnvironmentPreview()
  pauseAudio()
  activeAudioProvider.value = 'youtube'
  hasAudioError.value = false
  youtubePlayerError.value = null
  selectingYouTubeVideoId.value = track.videoId
  persistYouTubeLibrary(upsertYouTubeTrack(youtubeLibrary.value, track, true))

  environmentSelectionTimeout = window.setTimeout(() => {
    isEnvironmentExplorerVisible.value = false
    selectingYouTubeVideoId.value = null
    resetYouTubePreviewState()
    isEnvironmentLanding.value = true
    clearEnvironmentLandingTimeout()
    environmentLandingTimeout = window.setTimeout(finishEnvironmentLanding, 720)
  }, 440)
}

function removeYouTubeEnvironment(track: YouTubeTrack) {
  const wasSelected = selectedYouTubeTrack.value?.videoId === track.videoId

  persistYouTubeLibrary(removeStoredYouTubeTrack(youtubeLibrary.value, track.videoId))

  if (previewYouTubeVideoId.value === track.videoId) {
    resetYouTubePreviewState()
    previewEnvironmentId.value = selectedAudio.value ? audioId(selectedAudio.value) : null
  }

  if (wasSelected) {
    activeAudioProvider.value = 'uploaded'
    youtubePlayerError.value = null
    pauseAudio()

    if (isRunning.value) {
      void playAudio()
    }
  }
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

watch(
  () => selectedYouTubeTrack.value?.videoId,
  () => {
    clearYouTubeCoverTimeout()
    isYouTubeCoverVisible.value = !isYouTubeVideoHovered.value
  },
)

watch(youtubeDraftUrl, validateYouTubeDraft)

watch(
  () => auth.user?.id,
  () => {
    loadStoredYouTubeLibrary()
  },
)

watch(isYouTubeAudioSelected, (selected) => {
  if (selected) {
    audioElement.value?.pause()
    isAudioPlaying.value = false
    isAudioWaiting.value = false
    hasAudioError.value = false
    return
  }

  youtubePlayerError.value = null
})

watch(selectedYouTubeTrack, (track) => {
  if (!track && activeAudioProvider.value === 'youtube') {
    activeAudioProvider.value = 'uploaded'
  }
})

watch(isRunning, (running) => {
  clearTimerInterval()

  if (running) {
    timerInterval = window.setInterval(tickTimer, 1000)
  }

  updateDocumentTitle()
})

watch(remainingSeconds, updateDocumentTitle)

watch(selectedModeId, (modeId) => {
  audios.value = []
  selectedAudioId.value = null

  if (modeId !== null) {
    void loadAudiosForMode(modeId)
  }
})

watch(selectedFlowId, (flowId) => {
  if (!auth.isAuthenticated) return

  if (flowId === null) {
    if (flowSession.value) clearLoadedFlow()
    return
  }

  if (flowSession.value?.flow.id === flowId) return

  void loadFlowSession(flowId)
})

watch(
  () => auth.isAuthenticated,
  (isAuthenticated) => {
    if (isAuthenticated) {
      void loadFlows()
      return
    }

    flows.value = []
    clearLoadedFlow()
  },
)

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

watch(selectedAlarmAudioSource, () => {
  const alarmAudio = alarmAudioElement.value

  if (!alarmAudio) return

  stopCompletionAlarm()
  alarmAudio.load()
})

watch(isEnvironmentExplorerVisible, (isVisible) => {
  if (isVisible) {
    lockEnvironmentExplorerScroll()
    return
  }

  unlockEnvironmentExplorerScroll()
})

onMounted(() => {
  defaultDocumentTitle = document.title
  document.addEventListener('visibilitychange', handleDocumentVisibilityChange)
  window.addEventListener('blur', handleDocumentVisibilityChange)
  window.addEventListener('focus', handleDocumentVisibilityChange)
  loadStoredYouTubeLibrary()

  void (async () => {
    await loadModes()

    if (!auth.isAuthenticated) return

    await loadFlows()

    const persistedState = readPersistedFlowExecutionState()

    if (persistedState?.flowId) {
      selectedFlowId.value = persistedState.flowId
    }
  })()
})

onBeforeUnmount(() => {
  persistFlowExecutionState()
  clearTimerInterval()
  timerDeadline = undefined
  document.removeEventListener('visibilitychange', handleDocumentVisibilityChange)
  window.removeEventListener('blur', handleDocumentVisibilityChange)
  window.removeEventListener('focus', handleDocumentVisibilityChange)
  document.title = defaultDocumentTitle
  stopCompletionAlarm()
  pauseAudio()

  clearEnvironmentSelectionTimeout()
  clearEnvironmentLandingTimeout()
  clearYouTubeCoverTimeout()
  unlockEnvironmentExplorerScroll()

  if (environmentPreviewFrame !== undefined) {
    window.cancelAnimationFrame(environmentPreviewFrame)
    environmentPreviewFrame = undefined
  }

  clearEnvironmentPreview()

  if (completionAudioContext && completionAudioContext.state !== 'closed') {
    void completionAudioContext.close()
  }

  completionAudioContext = undefined
})
</script>

<template>
  <main
    class="core-page dark min-h-screen overflow-hidden px-0 py-4 text-[#f7fbf8]"
    :style="pageVisualStyle"
    :class="{ 'core-page--minimal': isMinimalMode }"
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

    <audio
      ref="alarmAudioElement"
      :key="selectedAlarmAudioSource"
      class="sr-only"
      :src="selectedAlarmAudioSource || undefined"
      preload="auto"
    />

    <audio ref="environmentPreviewAudioElement" class="sr-only" preload="metadata" />

    <Dialog
      v-model:visible="isDurationDialogVisible"
      modal
      :draggable="false"
      :header="t('coreTimer.settings.title')"
      class="core-duration-dialog"
      :style="pageVisualStyle"
    >
      <form class="core-duration-form" v-on:submit.prevent="saveDurationSettings">
        <label v-for="phase in phaseOptions" :key="phase.key" class="core-duration-field">
          <span>{{ phase.label }}</span>
          <input
            v-model.number="durationDraft[phase.key]"
            type="number"
            min="1"
            max="180"
            step="1"
            inputmode="numeric"
          />
          <small>{{ t('coreTimer.settings.minutes') }}</small>
        </label>

        <label class="core-duration-field core-duration-field--stacked">
          <span>{{ t('coreTimer.settings.alarmSound') }}</span>
          <Select
            v-model="selectedAlarmAudioId"
            :options="alarmOptions"
            option-label="label"
            option-value="value"
            :placeholder="selectedAlarmLabel"
            :loading="isLoadingAlarmAudios"
            class="core-alarm-select !w-full"
          />
          <small>{{ t('coreTimer.settings.alarmHint', { alarm: selectedAlarmLabel }) }}</small>
        </label>

        <div class="core-duration-actions">
          <Button
            type="button"
            :label="t('auth.actions.cancel')"
            text
            class="core-duration-cancel"
            v-on:click="isDurationDialogVisible = false"
          />
          <Button
            type="submit"
            :label="t('coreTimer.actions.saveDurations')"
            class="core-duration-save"
          />
        </div>
      </form>
    </Dialog>

    <FlowJourneyPicker
      v-model:visible="isFlowPickerVisible"
      :flows="sortedFlows"
      :modes="sortedModes"
      :nodes-by-flow-id="flowPickerNodesByFlowId"
      :selected-flow-id="selectedFlowId"
      :is-loading-flows="isLoadingFlows"
      :is-loading-selected-flow="isLoadingSelectedFlow"
      :loading-flow-summary-ids="loadingFlowSummaryIds"
      @request-summaries="loadFlowPickerSummaries"
      @start="startFlowJourney"
      @clear="clearLoadedFlow"
    />

    <Teleport to="body">
      <Transition name="core-environment-portal">
        <div
          v-if="isEnvironmentExplorerVisible"
          class="core-environment-backdrop"
          @click.self="closeEnvironmentExplorer"
        >
          <section
            class="core-environment-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="core-environment-title"
            :style="environmentExplorerStyle"
            @keydown.esc="closeEnvironmentExplorer"
          >
            <div class="core-environment-modal-glow" aria-hidden="true" />
            <header class="core-environment-header">
              <div>
                <p>{{ t('coreTimer.environment.eyebrow') }}</p>
                <h2 id="core-environment-title">{{ t('coreTimer.environment.title') }}</h2>
                <span>{{ t('coreTimer.environment.subtitle') }}</span>
              </div>
              <button
                type="button"
                class="core-environment-close"
                :aria-label="t('coreTimer.environment.close')"
                @click="closeEnvironmentExplorer"
              >
                <i class="pi pi-times" aria-hidden="true" />
              </button>
            </header>

            <section
              class="core-environment-stage"
              :aria-label="t('coreTimer.environment.catalogLabel')"
            >
              <aside class="core-environment-catalog">
                <div class="core-environment-search">
                  <i class="pi pi-search" aria-hidden="true" />
                  <label class="sr-only" for="environment-search">{{
                    t('coreTimer.environment.searchLabel')
                  }}</label>
                  <input
                    id="environment-search"
                    v-model="environmentSearchQuery"
                    type="search"
                    autocomplete="off"
                    :placeholder="t('coreTimer.environment.searchPlaceholder')"
                  />
                </div>

                <div
                  class="core-environment-list"
                  role="listbox"
                  :aria-label="t('coreTimer.environment.catalogLabel')"
                >
                  <button
                    type="button"
                    class="core-environment-row core-environment-row--youtube-action"
                    role="option"
                    :aria-selected="isYouTubeComposerVisible"
                    @click="startYouTubeComposer"
                  >
                    <span class="core-environment-youtube-icon" aria-hidden="true">
                      <i class="pi pi-youtube" />
                    </span>
                    <span class="core-environment-row-copy">
                      <strong>{{ t('coreTimer.environment.addYoutube') }}</strong>
                      <small>{{ t('coreTimer.environment.addYoutubeCopy') }}</small>
                    </span>
                  </button>
                  <button
                    v-for="(audio, index) in filteredEnvironmentAudios"
                    :key="audioId(audio)"
                    type="button"
                    class="core-environment-row"
                    :class="[
                      isSelectedAudio(audio) && 'core-environment-row--active',
                      isPreviewEnvironment(audio) && 'core-environment-row--preview',
                      selectingEnvironmentId === audioId(audio) &&
                        'core-environment-row--selecting',
                    ]"
                    :style="environmentCardStyle(audio, index)"
                    role="option"
                    :aria-selected="isPreviewEnvironment(audio)"
                    @focus="previewEnvironment(audio)"
                    @mouseenter="previewEnvironment(audio)"
                    @mouseleave="clearEnvironmentPreview"
                    @blur="clearEnvironmentPreview"
                    @click="previewEnvironment(audio)"
                  >
                    <CognitiveEnvironmentVisual
                      :color="audioModeColor(audio)"
                      :seed="environmentSignatureSeed(audio)"
                      :selected="isSelectedAudio(audio)"
                      variant="thumbnail"
                    />
                    <span class="core-environment-row-copy">
                      <strong>{{ formatEnvironmentTitle(audio.name) }}</strong>
                      <small>{{ audioModeLabel(audio) }}</small>
                    </span>
                    <span
                      v-if="isSelectedAudio(audio) && !isYouTubeAudioSelected"
                      class="core-environment-row-badge"
                    >
                      {{ t('coreTimer.environment.current') }}
                    </span>
                  </button>

                  <div
                    v-for="(track, index) in filteredYouTubeTracks"
                    :key="youtubeTrackId(track)"
                    class="core-environment-row core-environment-row--youtube"
                    :class="[
                      isSelectedYouTubeTrack(track) && 'core-environment-row--active',
                      isPreviewYouTubeTrack(track) && 'core-environment-row--preview',
                      selectingYouTubeVideoId === track.videoId &&
                        'core-environment-row--selecting',
                    ]"
                    :style="youtubeEnvironmentCoverStyle(track, index)"
                    role="option"
                    tabindex="0"
                    :aria-selected="isPreviewYouTubeTrack(track)"
                    @focus="previewYouTubeTrackRow(track)"
                    @mouseenter="previewYouTubeTrackRow(track)"
                    @click="previewYouTubeTrackRow(track)"
                    @keydown.enter.prevent="previewYouTubeTrackRow(track)"
                    @keydown.space.prevent="previewYouTubeTrackRow(track)"
                  >
                    <span class="core-environment-youtube-icon" aria-hidden="true">
                      <i class="pi pi-youtube" />
                    </span>
                    <span class="core-environment-row-copy">
                      <strong>{{ track.title }}</strong>
                      <small>{{ t('coreTimer.environment.youtubeSource') }}</small>
                    </span>
                    <span v-if="isSelectedYouTubeTrack(track)" class="core-environment-row-badge">
                      {{ t('coreTimer.environment.current') }}
                    </span>
                    <button
                      type="button"
                      class="core-environment-row-remove"
                      :aria-label="t('coreTimer.environment.removeYoutube', { title: track.title })"
                      @click.stop="removeYouTubeEnvironment(track)"
                    >
                      <i class="pi pi-times" aria-hidden="true" />
                    </button>
                  </div>

                  <div
                    v-if="
                      filteredEnvironmentAudios.length === 0 && filteredYouTubeTracks.length === 0
                    "
                    class="core-environment-empty"
                  >
                    <i class="pi pi-search" aria-hidden="true" />
                    <span>{{ t('coreTimer.environment.noMatching') }}</span>
                  </div>
                </div>
              </aside>

              <section
                v-if="isYouTubeComposerVisible || previewYouTubeTrack"
                class="core-environment-preview core-environment-preview--youtube"
                :class="{ 'core-environment-preview--youtube-empty': !previewYouTubeTrack }"
                :style="youtubeEnvironmentCoverStyle(previewYouTubeTrack)"
                aria-live="polite"
              >
                <div class="core-environment-youtube-form">
                  <label for="youtube-environment-url">{{
                    t('coreTimer.environment.youtubeInputLabel')
                  }}</label>
                  <input
                    id="youtube-environment-url"
                    v-model="youtubeDraftUrl"
                    type="url"
                    inputmode="url"
                    autocomplete="off"
                    :placeholder="t('coreTimer.environment.youtubePlaceholder')"
                  />
                  <small>{{ t('coreTimer.environment.youtubeHint') }}</small>
                </div>

                <div v-if="previewYouTubeTrack" class="core-youtube-preview-player">
                  <YouTubePlayer
                    :key="'preview-' + previewYouTubeTrack.videoId"
                    :video-id="previewYouTubeTrack.videoId"
                    :playing="false"
                    :volume="audioVolume"
                    :muted="isAudioMuted"
                    :label="t('coreTimer.environment.youtubePreviewLabel')"
                    @state-change="handleYouTubePreviewState"
                    @error="handleYouTubePreviewError"
                    @title="
                      (title) => handleYouTubeTitle(previewYouTubeTrack?.videoId ?? '', title)
                    "
                  />
                </div>

                <div class="core-environment-preview-copy">
                  <span class="core-environment-preview-badge">
                    {{
                      previewYouTubeTrack && isSelectedYouTubeTrack(previewYouTubeTrack)
                        ? t('coreTimer.environment.currentlySelected')
                        : t('coreTimer.environment.youtubeBadge')
                    }}
                  </span>
                  <h3>{{ previewYouTubeTrack?.title ?? t('coreTimer.environment.addYoutube') }}</h3>
                  <p>{{ t('coreTimer.environment.youtubeSource') }}</p>
                </div>

                <p
                  v-if="youtubeDraftError || youtubePreviewError"
                  class="core-youtube-error"
                  role="alert"
                >
                  {{ youtubeDraftError || youtubePreviewError }}
                </p>

                <button
                  type="button"
                  class="core-environment-use"
                  :disabled="
                    !previewYouTubeTrack ||
                    youtubePreviewPlayableVideoId !== previewYouTubeTrack.videoId ||
                    selectingYouTubeVideoId !== null
                  "
                  @click="selectPreviewEnvironment"
                >
                  <i class="pi pi-check" aria-hidden="true" />
                  <span>{{ t('coreTimer.environment.useYoutube') }}</span>
                </button>
              </section>

              <section
                v-else-if="previewEnvironmentAudio"
                class="core-environment-preview"
                :style="environmentCoverStyle(previewEnvironmentAudio)"
                aria-live="polite"
              >
                <CognitiveEnvironmentVisual
                  :color="audioModeColor(previewEnvironmentAudio)"
                  :seed="environmentSignatureSeed(previewEnvironmentAudio)"
                  :selected="isSelectedAudio(previewEnvironmentAudio)"
                />

                <div class="core-environment-preview-copy">
                  <span class="core-environment-preview-badge">
                    {{
                      isSelectedAudio(previewEnvironmentAudio)
                        ? t('coreTimer.environment.currentlySelected')
                        : t('coreTimer.environment.previewing')
                    }}
                  </span>
                  <h3>{{ formatEnvironmentTitle(previewEnvironmentAudio.name) }}</h3>
                  <p>{{ audioModeLabel(previewEnvironmentAudio) }}</p>
                </div>

                <button
                  type="button"
                  class="core-environment-use"
                  :disabled="selectingEnvironmentId !== null"
                  @click="selectPreviewEnvironment"
                >
                  <i class="pi pi-check" aria-hidden="true" />
                  <span>{{ t('coreTimer.environment.useAudio') }}</span>
                </button>
              </section>
            </section>
          </section>
        </div>
      </Transition>
    </Teleport>

    <section class="core-shell flex min-h-[calc(100svh-5.5rem)] flex-col pt-4 sm:pt-5">
      <div
        v-if="error"
        class="mb-4 rounded-[8px] border border-red-300/30 bg-red-500/10 px-4 py-3 text-sm leading-6 text-red-100"
      >
        {{ error }}
      </div>

      <section class="core-workspace" :class="{ 'core-workspace--minimal': isMinimalMode }">
        <section class="core-stage">
          <header class="core-topbar">
            <button
              v-if="auth.isAuthenticated"
              type="button"
              class="core-flow-trigger"
              :disabled="isLoadingFlows || isLoadingSelectedFlow"
              @click="openFlowPicker"
            >
              <span>
                <small>{{ t('coreTimer.flow.triggerEyebrow') }}</small>
                <strong>{{ flowSession?.flow.name ?? t('coreTimer.flow.chooseFlow') }}</strong>
              </span>
              <i class="pi pi-arrow-up-right" aria-hidden="true" />
            </button>

            <div v-if="!isFlowLoaded" class="core-mode-field auth-field">
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

            <button
              v-if="isMinimalMode"
              type="button"
              class="core-minimal-audio-toggle"
              :aria-label="t('coreTimer.environment.browseAction')"
              :title="t('coreTimer.environment.browseAction')"
              @click.stop="openEnvironmentExplorer"
            >
              <i class="pi pi-compass" aria-hidden="true" />
            </button>

            <Button
              type="button"
              :icon="minimalModeIcon"
              rounded
              text
              :aria-label="minimalModeLabel"
              :title="minimalModeLabel"
              class="core-minimal-toggle"
              @click="toggleMinimalMode"
            />
          </header>

          <div v-if="isLoadingModes || isLoadingSelectedFlow" class="core-empty-state">
            <i class="pi pi-spin pi-spinner" aria-hidden="true" />
            <span>{{
              isLoadingSelectedFlow ? t('coreTimer.flow.loading') : t('coreTimer.mode.loading')
            }}</span>
          </div>

          <div v-else-if="!isFlowLoaded && sortedModes.length === 0" class="core-empty-state">
            <i class="pi pi-wave-pulse" aria-hidden="true" />
            <span>{{ t('coreTimer.mode.empty') }}</span>
          </div>

          <div v-else-if="isFlowEmpty" class="core-flow-message">
            <i class="pi pi-list-check" aria-hidden="true" />
            <h2>{{ t('coreTimer.flow.emptyTitle') }}</h2>
            <p>{{ t('coreTimer.flow.emptyBody') }}</p>
            <RouterLink :to="flowEditRoute" class="core-flow-link">
              <i class="pi pi-pencil" aria-hidden="true" />
              <span>{{ t('coreTimer.flow.editFlow') }}</span>
            </RouterLink>
          </div>

          <div v-else-if="flowExecutionState?.isComplete" class="core-flow-message">
            <i class="pi pi-check-circle" aria-hidden="true" />
            <h2>{{ t('coreTimer.flow.completeTitle') }}</h2>
            <p>{{ sessionSubtitle }}</p>
            <div class="core-flow-actions">
              <Button
                type="button"
                icon="pi pi-refresh"
                :label="t('coreTimer.flow.restartFlow')"
                class="core-flow-primary"
                @click="restartLoadedFlow"
              />
              <Button
                type="button"
                icon="pi pi-list"
                :label="t('coreTimer.flow.loadAnother')"
                text
                class="core-flow-secondary"
                @click="clearLoadedFlow"
              />
              <Button
                type="button"
                icon="pi pi-times"
                :label="t('coreTimer.flow.returnDefault')"
                text
                class="core-flow-secondary"
                @click="clearLoadedFlow"
              />
            </div>
          </div>

          <template v-else>
            <div class="core-focus-layout">
              <div class="core-timer-zone">
                <div
                  class="core-timer-orbit"
                  :class="{
                    'core-timer-orbit--ending': isTimerEndingSoon,
                    'core-timer-orbit--panel-expanded': isMusicPanelExpanded,
                  }"
                >
                  <NeuralCore
                    :progress="neuralCoreProgress"
                    :session-state="neuralCoreSessionState"
                    :mode-key="neuralCoreModeKey"
                    :accent-color="neuralCoreAccentColor"
                    :panel-expanded="isMusicPanelExpanded"
                    :reset-signal="neuralCoreResetSignal"
                    :wave-signal="neuralCoreWaveSignal"
                    :completion-signal="neuralCoreCompletionSignal"
                  />

                  <div class="core-timer-readout">
                    <span class="core-eyebrow">{{ timerEyebrow }}</span>
                    <strong>{{ formattedRemaining }}</strong>
                    <span class="core-track-label">{{ selectedTrackLabel }}</span>
                  </div>
                </div>
              </div>

              <div class="core-mode-summary">
                <p class="text-sm font-semibold uppercase text-[var(--resource-mode-color)]">
                  {{ t('coreTimer.eyebrow') }}
                </p>
                <h1>{{ sessionTitle }}</h1>
                <p>{{ sessionSubtitle }}</p>
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
                  :disabled="!canRunTimer"
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
                  v-if="!isFlowLoaded"
                  type="button"
                  icon="pi pi-plus"
                  :label="t('coreTimer.actions.addFive')"
                  class="core-soft-action"
                  @click="extendSession"
                />
                <Button
                  v-if="!isFlowLoaded"
                  type="button"
                  icon="pi pi-cog"
                  :label="t('coreTimer.actions.configureDurations')"
                  class="core-soft-action"
                  v-on:click="openDurationDialog"
                />
              </div>
            </div>

            <dl class="core-session-stats">
              <div>
                <dt>
                  {{
                    isFlowLoaded
                      ? t('coreTimer.flow.completedSections')
                      : t('coreTimer.stats.completed')
                  }}
                </dt>
                <dd>{{ isFlowLoaded ? flowProgressLabel : completedBlocks }}</dd>
              </div>
              <div>
                <dt>
                  {{
                    isFlowLoaded ? t('coreTimer.flow.currentSection') : t('coreTimer.stats.cycle')
                  }}
                </dt>
                <dd>
                  {{
                    isFlowLoaded
                      ? currentFlowSectionNumber + '/' + totalFlowSections
                      : activeCycleStep + '/' + phaseCycle.length
                  }}
                </dd>
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

        <aside
          id="core-music-panel"
          class="core-music-panel"
          :class="{ 'core-music-panel--compact': isMusicPanelCompact }"
          :aria-label="t('coreTimer.audio.panelLabel')"
        >
          <Transition name="core-panel-compact">
            <div v-if="isMusicPanelCompact" class="core-panel-compact">
              <span class="core-panel-compact-artwork" aria-hidden="true">
                <img v-if="isYouTubeAudioSelected" :src="youtubeCoverUrl" alt="" />
                <i v-else class="pi pi-wave-pulse" />
              </span>
              <span class="core-panel-compact-copy">
                <small>{{ audioStatusLabel }}</small>
                <strong>{{ activeEnvironmentLabel }}</strong>
                <span>{{ activeEnvironmentSubtitle }}</span>
              </span>
              <button
                type="button"
                class="core-panel-state-toggle"
                :aria-label="t('coreTimer.actions.expandMusicPanel')"
                :title="t('coreTimer.actions.expandMusicPanel')"
                aria-expanded="false"
                aria-controls="core-music-panel-expanded"
                @click="expandMusicPanel"
              >
                <i class="pi pi-angle-left" aria-hidden="true" />
              </button>
            </div>
          </Transition>

          <div
            id="core-music-panel-expanded"
            class="core-panel-expanded"
            :aria-hidden="isMusicPanelCompact"
            :inert="isMusicPanelCompact"
          >
            <div class="core-panel-heading">
              <div>
                <p>{{ t('coreTimer.audio.eyebrow') }}</p>
                <h2>{{ t('coreTimer.audio.title', { mode: selectedModeName }) }}</h2>
              </div>
              <div class="core-panel-heading-actions">
                <span class="core-panel-track-count">{{ trackCountLabel }}</span>
                <button
                  v-if="isRunning"
                  type="button"
                  class="core-panel-state-toggle"
                  :aria-label="t('coreTimer.actions.collapseMusicPanel')"
                  :title="t('coreTimer.actions.collapseMusicPanel')"
                  aria-expanded="true"
                  aria-controls="core-music-panel-expanded"
                  @click="collapseMusicPanel"
                >
                  <i class="pi pi-angle-right" aria-hidden="true" />
                </button>
              </div>
            </div>

            <div
              v-if="!isFlowLoaded"
              class="core-phase-tabs"
              role="tablist"
              :aria-label="t('coreTimer.phaseLabel')"
            >
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

            <div v-else class="core-flow-sections" :style="flowProgressStyle">
              <div class="core-flow-progress" aria-hidden="true">
                <span />
              </div>
              <div class="core-flow-progress-label">{{ flowProgressLabel }}</div>
              <div
                v-for="section in flowSectionList"
                :key="section.id"
                class="core-flow-section"
                :class="{
                  'core-flow-section--active': section.isActive,
                  'core-flow-section--complete': section.isComplete,
                }"
              >
                <span class="core-flow-section-index">{{
                  String(section.order).padStart(2, '0')
                }}</span>
                <span class="core-flow-section-copy">
                  <strong>{{ section.title }}</strong>
                  <small>
                    {{ section.mode ? translatedModeName(section.mode) : selectedModeName }}
                  </small>
                </span>
                <span class="core-flow-section-time">{{
                  t('coreTimer.minutes', { count: section.minutes })
                }}</span>
              </div>
            </div>

            <div v-if="isLoadingAudios" class="core-list-state">
              <i class="pi pi-spin pi-spinner" aria-hidden="true" />
              <span>{{ t('coreTimer.audio.loading') }}</span>
            </div>

            <button
              v-else
              type="button"
              class="core-current-environment"
              :class="[isEnvironmentLanding && 'core-current-environment--landing']"
              @animationend="finishEnvironmentLanding"
              @click="openEnvironmentExplorer"
            >
              <span class="core-current-environment-copy">
                <span>{{ t('coreTimer.environment.currentEnvironment') }}</span>
                <strong>
                  {{ activeEnvironmentLabel }}
                </strong>
                <small>{{ activeEnvironmentSubtitle }}</small>
              </span>
              <span class="core-current-environment-action">
                <i class="pi pi-compass" aria-hidden="true" />
                <span>{{ t('coreTimer.environment.browseAction') }}</span>
              </span>
            </button>
          </div>

          <div
            v-if="isYouTubeAudioSelected && selectedYouTubeTrack"
            class="core-youtube-panel"
            :class="{ 'core-youtube-floating': isMinimalMode }"
          >
            <div
              class="core-youtube-viewport"
              @pointerenter="revealYouTubeVideo"
              @pointerleave="scheduleYouTubeCover"
            >
              <YouTubePlayer
                ref="activeYouTubePlayer"
                :key="'active-' + selectedYouTubeTrack.videoId"
                :video-id="selectedYouTubeTrack.videoId"
                :playing="isRunning"
                :volume="audioVolume"
                :muted="isAudioMuted"
                :controls="false"
                :label="t('coreTimer.environment.youtubeActiveLabel')"
                @waiting="(waiting) => (isAudioWaiting = waiting)"
                @error="handleYouTubePlayerError"
                @autoplay-blocked="handleYouTubeAutoplayBlocked"
                @title="(title) => handleYouTubeTitle(selectedYouTubeTrack?.videoId ?? '', title)"
                @time-update="handleYouTubeTimeUpdate"
              />
              <img
                :key="selectedYouTubeTrack.videoId"
                :src="youtubeCoverUrl"
                alt=""
                aria-hidden="true"
                class="core-youtube-clean-cover"
                :class="{ 'core-youtube-clean-cover--visible': isYouTubeCoverVisible }"
                @error="useFallbackYouTubeCover"
              />
            </div>

            <div class="core-youtube-timeline">
              <span>{{ formatClock(youtubeCurrentSeconds) }}</span>
              <label class="core-range core-range--timeline">
                <span class="sr-only">{{ t('coreTimer.audio.progress') }}</span>
                <input
                  type="range"
                  min="0"
                  :max="youtubeDurationSeconds"
                  step="1"
                  :value="youtubeCurrentSeconds"
                  :style="youtubeProgressStyle"
                  :disabled="youtubeDurationSeconds <= 0"
                  @input="seekYouTubeVideo"
                />
              </label>
              <span>{{ formatClock(youtubeDurationSeconds) }}</span>
            </div>

            <div v-if="isMinimalMode" class="core-volume-row core-youtube-mini-volume">
              <button
                type="button"
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
                  @input="changeVolume"
                />
              </label>
            </div>
          </div>

          <div class="core-audio-console">
            <div class="core-now-playing">
              <span>
                {{ audioStatusLabel }}
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
              <span>{{ youtubePlayerError ?? t('coreTimer.errors.playAudio') }}</span>
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
  overflow-x: hidden;
  overflow-y: auto;
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

.core-page :deep(.app-navbar) {
  transition:
    opacity 220ms ease,
    transform 260ms ease,
    visibility 0s linear 0s;
}

.core-page--minimal :deep(.app-navbar) {
  position: absolute;
  left: 50%;
  top: 1rem;
  opacity: 0;
  pointer-events: none;
  transform: translate(-50%, -0.75rem);
  visibility: hidden;
  transition:
    opacity 180ms ease,
    transform 240ms ease,
    visibility 0s linear 240ms;
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
  overflow: visible;
  border: 0;
  border-radius: 0;
  background: transparent !important;
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

.core-flow-trigger {
  cursor: pointer;
  display: inline-grid;
  min-width: min(100%, 14.25rem);
  min-height: 2.9rem;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.65rem;
  border: 1px solid rgba(var(--resource-mode-rgb), 0.24);
  border-radius: 10px;
  background: rgba(13, 10, 18, 0.64);
  color: #ffffff;
  padding: 0.44rem 0.6rem 0.44rem 0.95rem;
  text-align: left;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
  transition:
    border-color 180ms ease,
    background 180ms ease,
    color 180ms ease;
}

.core-flow-trigger:hover {
  border-color: rgba(var(--resource-mode-rgb), 0.42);
  background: rgba(13, 10, 18, 0.78);
}

.core-flow-trigger:disabled {
  cursor: wait;
  opacity: 0.65;
}

.core-flow-trigger span {
  min-width: 0;
}

.core-flow-trigger small,
.core-flow-trigger strong {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.core-flow-trigger small {
  color: var(--resource-mode-color);
  font-size: 0.62rem;
  font-weight: 760;
  line-height: 1.1;
  text-transform: uppercase;
}

.core-flow-trigger strong {
  margin-top: 0.14rem;
  font-size: 0.88rem;
  font-weight: 720;
  line-height: 1.2;
}

.core-flow-trigger i {
  display: grid;
  width: 1.85rem;
  height: 1.85rem;
  place-items: center;
  border-radius: 999px;
  border: 1px solid rgba(var(--resource-mode-rgb), 0.36);
  background: rgba(var(--resource-mode-rgb), 0.08);
  color: var(--resource-mode-color);
  font-size: 0.72rem;
}

.core-minimal-toggle,
.core-minimal-audio-toggle {
  cursor: pointer;
  display: grid;
  width: 3.1rem !important;
  height: 3.1rem !important;
  flex: 0 0 auto;
  place-items: center;
  border: 1px solid rgba(var(--resource-mode-rgb), 0.28) !important;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08) !important;
  color: rgba(255, 255, 255, 0.8) !important;
  pointer-events: auto;
}

.core-minimal-toggle:hover,
.core-minimal-audio-toggle:hover {
  background: rgba(var(--resource-mode-rgb), 0.14) !important;
  color: #ffffff !important;
}

.core-minimal-toggle :deep(.p-button-icon) {
  transform: translateY(0.5rem);
}

.core-mode-summary,
.core-player-footer,
.core-session-stats,
.core-music-panel,
.core-eyebrow,
.core-track-label {
  transition:
    opacity 220ms ease,
    transform 260ms ease,
    visibility 0s linear 0s;
}

.core-timer-orbit,
.core-timer-readout strong {
  transition:
    opacity 260ms ease,
    transform 320ms ease,
    translate 320ms ease,
    width 320ms ease,
    font-size 320ms ease;
}

.core-workspace--minimal {
  min-height: calc(100svh - 6.5rem);
}

.core-workspace--minimal .core-stage {
  min-height: inherit;
}

.core-workspace--minimal .core-topbar {
  position: absolute;
  top: 1rem;
  right: 1rem;
  z-index: 40;
  flex-direction: row;
  align-items: center;
  pointer-events: auto;
}

.core-workspace--minimal .core-mode-field,
.core-workspace--minimal .core-flow-trigger {
  display: none;
}

.core-workspace--minimal .core-mode-summary,
.core-workspace--minimal .core-player-footer,
.core-workspace--minimal .core-session-stats,
.core-workspace--minimal .core-eyebrow,
.core-workspace--minimal .core-track-label {
  opacity: 0;
  pointer-events: none;
  transform: translateY(0.65rem) scale(0.98);
  visibility: hidden;
  transition:
    opacity 180ms ease,
    transform 240ms ease,
    visibility 0s linear 240ms;
}

.core-workspace--minimal .core-music-panel {
  display: contents;
}

.core-workspace--minimal .core-music-panel > :not(.core-youtube-panel) {
  display: none;
}

.core-workspace--minimal .core-focus-layout {
  position: absolute;
  inset: 0;
  min-height: 0;
  padding: 0;
  pointer-events: none;
}

.core-workspace--minimal .core-timer-zone {
  min-height: 0;
}

.core-workspace--minimal .core-timer-orbit {
  width: min(86vw, 78svh, 42rem);
}

.core-timer-orbit--ending {
  animation: core-ending-pulse 1.6s ease-in-out infinite;
}

.core-timer-orbit--ending .core-timer-readout strong {
  color: #ff7b84;
  text-shadow:
    0 0 0.65rem rgba(255, 92, 104, 0.22),
    0 1.2rem 4rem rgba(0, 0, 0, 0.55);
}

.core-workspace--minimal .core-timer-readout strong {
  font-size: clamp(5.2rem, 16vw, 10rem);
}

:global(.core-duration-dialog) {
  width: min(26rem, calc(100vw - 2rem));
  overflow: hidden;
  border: 1px solid rgba(var(--resource-mode-rgb), 0.26);
  border-radius: 12px;
  background:
    linear-gradient(145deg, rgba(var(--resource-mode-rgb), 0.18), transparent 46%),
    rgba(6, 12, 14, 0.98) !important;
  color: #f7fbf8 !important;
  box-shadow:
    0 1.5rem 5rem rgba(0, 0, 0, 0.46),
    inset 0 1px 0 rgba(255, 255, 255, 0.06);
  backdrop-filter: blur(22px);
}

:global(.core-duration-dialog .p-dialog-header) {
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  background: transparent !important;
  color: #ffffff;
  padding: 1rem 1.1rem;
}

:global(.core-duration-dialog .p-dialog-title) {
  color: #ffffff;
  font-size: 1rem;
  font-weight: 760;
}

:global(.core-duration-dialog .p-dialog-close-button) {
  color: rgba(255, 255, 255, 0.62) !important;
}

:global(.core-duration-dialog .p-dialog-close-button:hover) {
  background: rgba(var(--resource-mode-rgb), 0.14) !important;
  color: #ffffff !important;
}

:global(.core-duration-dialog .p-dialog-content) {
  background: transparent !important;
  color: inherit;
  padding: 1rem 1.1rem 1.1rem;
}

.core-duration-form {
  display: grid;
  gap: 0.85rem;
}

.core-duration-field {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 5.5rem auto;
  align-items: center;
  gap: 0.65rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.055);
  padding: 0.7rem;
}

.core-duration-field span {
  color: #ffffff;
  font-size: 0.9rem;
  font-weight: 740;
  line-height: 1.2;
}

.core-duration-field input {
  width: 100%;
  min-width: 0;
  border: 1px solid rgba(var(--resource-mode-rgb), 0.22);
  border-radius: 8px;
  background: rgba(var(--resource-mode-rgb), 0.12);
  color: #ffffff;
  font: inherit;
  font-weight: 720;
  outline: none;
  padding: 0.55rem 0.65rem;
}

.core-duration-field input:focus {
  border-color: var(--resource-mode-color);
  box-shadow: 0 0 0 1px rgba(var(--resource-mode-rgb), 0.32);
}

.core-duration-field--stacked {
  grid-template-columns: minmax(0, 1fr);
  align-items: stretch;
}

.core-duration-field :deep(.p-select) {
  min-height: 2.8rem;
  border-color: rgba(var(--resource-mode-rgb), 0.22) !important;
  background: rgba(var(--resource-mode-rgb), 0.12) !important;
  color: #ffffff !important;
}

.core-duration-field :deep(.p-select-label) {
  color: #ffffff;
  font-weight: 720;
}

.core-duration-field small {
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.72rem;
  font-weight: 750;
}

.core-duration-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.65rem;
  margin-top: 0.2rem;
}

.core-duration-cancel {
  color: rgba(255, 255, 255, 0.7) !important;
}

.core-duration-cancel:hover {
  background: rgba(var(--resource-mode-rgb), 0.14) !important;
  color: #ffffff !important;
}

.core-duration-save {
  border-color: transparent !important;
  background: var(--resource-mode-color) !important;
  color: var(--resource-mode-ink) !important;
  font-weight: 760 !important;
}

.core-duration-save:hover {
  filter: brightness(1.06);
}

.core-flow-message {
  display: grid;
  flex: 1;
  min-height: 24rem;
  place-items: center;
  align-content: center;
  gap: 0.85rem;
  padding: 2rem 1rem;
  text-align: center;
}

.core-flow-message > i {
  display: grid;
  width: 3.6rem;
  height: 3.6rem;
  place-items: center;
  border: 1px solid rgba(var(--resource-mode-rgb), 0.3);
  border-radius: 999px;
  background: rgba(var(--resource-mode-rgb), 0.14);
  color: var(--resource-mode-color);
  font-size: 1.3rem;
}

.core-flow-message h2 {
  margin: 0;
  color: #ffffff;
  font-size: clamp(1.7rem, 5vw, 3.2rem);
  font-weight: 760;
  line-height: 1.05;
}

.core-flow-message p {
  max-width: 32rem;
  margin: 0;
  color: rgba(255, 255, 255, 0.62);
  line-height: 1.55;
}

.core-flow-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.65rem;
  margin-top: 0.35rem;
}

.core-flow-primary {
  border-color: transparent !important;
  background: var(--resource-mode-color) !important;
  color: var(--resource-mode-ink) !important;
  font-weight: 760 !important;
}

.core-flow-secondary {
  color: rgba(255, 255, 255, 0.74) !important;
}

.core-flow-secondary:hover {
  background: rgba(var(--resource-mode-rgb), 0.14) !important;
  color: #ffffff !important;
}

.core-flow-link {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  border-radius: 999px;
  background: var(--resource-mode-color);
  color: var(--resource-mode-ink);
  font-size: 0.9rem;
  font-weight: 760;
  line-height: 1;
  padding: 0.8rem 1rem;
  text-decoration: none;
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
  isolation: isolate;
  display: grid;
  width: min(86vw, 66svh, 37rem);
  max-width: 100%;
  aspect-ratio: 1;
  place-items: center;
  border-radius: 999px;
  translate: 0 0;
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
  box-sizing: border-box;
  width: 100%;
  margin-top: 0.35rem;
  padding: 0 1rem;
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

.core-flow-sections {
  display: grid;
  flex: 0 1 auto;
  min-height: 0;
  max-height: clamp(8rem, 45svh, 31rem);
  align-content: start;
  gap: 0.52rem;
  overflow-x: hidden;
  overflow-y: auto;
  padding-right: 0.12rem;
  scrollbar-width: thin;
  scrollbar-color: rgba(var(--resource-mode-rgb), 0.42) transparent;
}

.core-flow-progress {
  height: 0.46rem;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.1);
}

.core-flow-progress span {
  display: block;
  width: var(--flow-progress);
  height: 100%;
  border-radius: inherit;
  background: var(--resource-mode-color);
  transition: width 220ms ease;
}

.core-flow-progress-label {
  color: rgba(255, 255, 255, 0.55);
  font-size: 0.74rem;
  font-weight: 780;
  line-height: 1.2;
  text-transform: uppercase;
}

.core-flow-section {
  display: grid;
  min-height: 3.75rem;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.65rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.72);
  padding: 0.58rem;
}

.core-flow-section--active {
  border-color: rgba(var(--resource-mode-rgb), 0.42);
  background: rgba(var(--resource-mode-rgb), 0.14);
  color: #ffffff;
}

.core-flow-section--complete {
  opacity: 0.62;
}

.core-flow-section-index {
  display: grid;
  width: 2.1rem;
  height: 2.1rem;
  place-items: center;
  border-radius: 999px;
  background: rgba(var(--resource-mode-rgb), 0.16);
  color: var(--resource-mode-color);
  font-size: 0.72rem;
  font-weight: 820;
}

.core-flow-section-copy {
  min-width: 0;
}

.core-flow-section-copy strong,
.core-flow-section-copy small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.core-flow-section-copy strong {
  font-size: 0.86rem;
  font-weight: 760;
  line-height: 1.2;
}

.core-flow-section-copy small,
.core-flow-section-time {
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.68rem;
  font-weight: 700;
  line-height: 1.1;
}

.core-flow-section-time {
  white-space: nowrap;
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
  min-height: 0;
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

.core-music-panel {
  transition:
    width 300ms cubic-bezier(0.2, 0.9, 0.24, 1),
    max-height 300ms cubic-bezier(0.2, 0.9, 0.24, 1),
    padding 260ms ease,
    border-color 220ms ease,
    background 260ms ease,
    box-shadow 260ms ease;
}

.core-music-panel--compact {
  gap: 0.62rem;
  border-color: rgba(255, 255, 255, 0.08);
  background:
    linear-gradient(145deg, rgba(var(--resource-mode-rgb), 0.08), transparent 52%),
    rgba(5, 9, 10, 0.54);
  padding: 0.72rem;
  box-shadow:
    0 0.8rem 2.8rem rgba(0, 0, 0, 0.22),
    inset 0 1px 0 rgba(255, 255, 255, 0.035);
}

.core-panel-expanded {
  display: grid;
  max-height: 90rem;
  gap: 0.85rem;
  opacity: 1;
  transform: translateY(0);
  visibility: visible;
  transition:
    max-height 320ms cubic-bezier(0.2, 0.9, 0.24, 1),
    opacity 200ms ease,
    transform 260ms ease,
    visibility 0s linear 0s;
}

.core-music-panel--compact .core-panel-expanded {
  max-height: 0;
  overflow: hidden;
  opacity: 0;
  pointer-events: none;
  transform: translateY(-0.55rem);
  visibility: hidden;
  transition:
    max-height 280ms cubic-bezier(0.2, 0.9, 0.24, 1),
    opacity 160ms ease,
    transform 220ms ease,
    visibility 0s linear 280ms;
}

.core-panel-compact {
  display: grid;
  min-width: 0;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.65rem;
}

.core-panel-compact-artwork {
  display: grid;
  width: 3.1rem;
  height: 3.1rem;
  overflow: hidden;
  place-items: center;
  border: 1px solid rgba(var(--resource-mode-rgb), 0.2);
  border-radius: 9px;
  background: rgba(var(--resource-mode-rgb), 0.1);
  color: var(--resource-mode-color);
}

.core-panel-compact-artwork img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.core-panel-compact-artwork i {
  font-size: 1rem;
}

.core-panel-compact-copy {
  display: grid;
  min-width: 0;
  gap: 0.18rem;
}

.core-panel-compact-copy small,
.core-panel-compact-copy strong,
.core-panel-compact-copy > span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.core-panel-compact-copy small {
  color: rgba(255, 255, 255, 0.46);
  font-size: 0.62rem;
  font-weight: 780;
  line-height: 1.1;
  text-transform: uppercase;
}

.core-panel-compact-copy strong {
  color: rgba(255, 255, 255, 0.9);
  font-size: 0.84rem;
  font-weight: 740;
  line-height: 1.2;
}

.core-panel-compact-copy > span {
  color: rgba(255, 255, 255, 0.44);
  font-size: 0.68rem;
  font-weight: 620;
}

.core-panel-compact-enter-active,
.core-panel-compact-leave-active {
  transition:
    opacity 180ms ease,
    transform 240ms cubic-bezier(0.2, 0.9, 0.24, 1);
}

.core-panel-compact-enter-from,
.core-panel-compact-leave-to {
  opacity: 0;
  transform: translateX(0.55rem) scale(0.98);
}

.core-panel-heading-actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 0.45rem;
}

.core-panel-state-toggle {
  display: grid;
  width: 2.25rem;
  height: 2.25rem;
  flex: 0 0 auto;
  place-items: center;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.055);
  color: rgba(255, 255, 255, 0.68);
  transition:
    border-color 160ms ease,
    background 160ms ease,
    color 160ms ease,
    transform 160ms ease;
}

.core-panel-state-toggle:hover {
  border-color: rgba(var(--resource-mode-rgb), 0.32);
  background: rgba(var(--resource-mode-rgb), 0.12);
  color: #ffffff;
  transform: translateY(-1px);
}

.core-panel-state-toggle:focus-visible {
  outline: 2px solid rgba(var(--resource-mode-rgb), 0.72);
  outline-offset: 3px;
}

.core-panel-heading,
.core-phase-tabs,
.core-flow-sections,
.core-list-state,
.core-current-environment {
  flex: 0 0 auto;
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

.core-panel-track-count {
  flex: 0 0 auto;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.64);
  font-size: 0.78rem;
  font-weight: 750;
  line-height: 1.1;
  padding: 0.45rem 0.65rem;
}

.core-current-environment {
  position: relative;
  display: grid;
  min-height: 0;
  gap: 0.85rem;
  overflow: hidden;
  border: 1px solid rgba(var(--resource-mode-rgb), 0.18);
  border-radius: 10px;
  background:
    radial-gradient(circle at 12% 18%, rgba(var(--resource-mode-rgb), 0.2), transparent 32%),
    rgba(255, 255, 255, 0.055);
  padding: 0.95rem;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
  color: inherit;
  cursor: pointer;
  text-align: left;
  transition:
    border-color 180ms ease,
    background 180ms ease,
    transform 180ms ease;
}

.core-current-environment:hover,
.core-current-environment:focus-visible {
  border-color: rgba(var(--resource-mode-rgb), 0.38);
  background:
    radial-gradient(circle at 12% 18%, rgba(var(--resource-mode-rgb), 0.26), transparent 32%),
    rgba(255, 255, 255, 0.075);
  transform: translateY(-1px);
}

.core-current-environment:focus-visible {
  outline: 2px solid rgba(var(--resource-mode-rgb), 0.48);
  outline-offset: 3px;
}

.core-current-environment::before {
  position: absolute;
  inset: -45% 18% 18% -30%;
  border-radius: 999px;
  background: rgba(var(--resource-mode-rgb), 0.2);
  content: '';
  filter: blur(28px);
  opacity: 0.72;
  pointer-events: none;
}

.core-current-environment-copy {
  position: relative;
  z-index: 1;
  display: grid;
  gap: 0.32rem;
  min-width: 0;
}

.core-current-environment-copy span {
  color: rgba(255, 255, 255, 0.56);
  font-size: 0.72rem;
  font-weight: 820;
  line-height: 1.1;
  text-transform: uppercase;
}

.core-current-environment-copy strong {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.52rem;
  color: #ffffff;
  font-size: 1rem;
  font-weight: 780;
  line-height: 1.2;
  overflow-wrap: anywhere;
}

.core-current-environment-copy i {
  display: grid;
  width: 2rem;
  height: 2rem;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 999px;
  background: rgba(var(--resource-mode-rgb), 0.16);
  color: var(--resource-mode-color);
  font-size: 0.82rem;
}

.core-current-environment-copy small {
  color: rgba(255, 255, 255, 0.52);
  font-size: 0.78rem;
  font-weight: 680;
  line-height: 1.2;
}

.core-current-environment-action {
  position: relative;
  z-index: 1;
  display: inline-flex;
  width: fit-content;
  align-items: center;
  gap: 0.45rem;
  border-radius: 999px;
  background: var(--resource-mode-color);
  color: var(--resource-mode-ink);
  font-size: 0.78rem;
  font-weight: 820;
  line-height: 1;
  padding: 0.58rem 0.7rem;
}

.core-current-environment-action i {
  font-size: 0.78rem;
}

.core-environment-trigger {
  position: relative;
  z-index: 1;
  width: 100%;
  justify-content: center;
  border-color: transparent !important;
  border-radius: 8px !important;
  background: var(--resource-mode-color) !important;
  color: var(--resource-mode-ink) !important;
  font-weight: 780 !important;
}

.core-current-environment--landing {
  animation: core-environment-land 720ms cubic-bezier(0.18, 0.9, 0.24, 1);
}

.core-environment-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: grid;
  min-height: 100dvh;
  place-items: center;
  overflow: hidden;
  overscroll-behavior: contain;
  isolation: isolate;
  background: rgba(2, 5, 8, 0.54);
  padding: clamp(0.7rem, 2vw, 1.5rem);
  backdrop-filter: blur(32px) saturate(1.16);
}

.core-environment-modal {
  position: relative;
  display: grid;
  width: min(96vw, 76rem);
  height: min(94dvh, 48rem);
  min-height: 0;
  grid-template-rows: auto minmax(0, 1fr);
  gap: clamp(0.9rem, 1.8vw, 1.25rem);
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 22px;
  background:
    radial-gradient(circle at 16% 0%, rgba(var(--environment-rgb), 0.28), transparent 32%),
    radial-gradient(circle at 86% 18%, rgba(255, 255, 255, 0.12), transparent 24%),
    linear-gradient(145deg, rgba(8, 13, 17, 0.97), rgba(3, 6, 10, 0.94));
  color: #ffffff;
  padding: clamp(1rem, 2.2vw, 1.55rem);
  box-shadow:
    0 2.6rem 7rem rgba(0, 0, 0, 0.64),
    inset 0 1px 0 rgba(255, 255, 255, 0.12);
}

.core-environment-modal::before {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(rgba(255, 255, 255, 0.035) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.025) 1px, transparent 1px);
  background-size: 4.5rem 4.5rem;
  content: '';
  mask-image: linear-gradient(to bottom, rgba(0, 0, 0, 0.72), transparent 82%);
  opacity: 0.36;
  pointer-events: none;
}

.core-environment-modal-glow {
  position: absolute;
  inset: -28% -18% auto;
  height: 23rem;
  background: radial-gradient(circle, rgba(var(--environment-rgb), 0.24), transparent 66%);
  filter: blur(30px);
  opacity: 0.88;
  pointer-events: none;
  transition: background 260ms ease;
}

.core-environment-header,
.core-environment-stage {
  position: relative;
  z-index: 1;
}

.core-environment-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.core-environment-header p {
  margin: 0;
  color: var(--environment-aura);
  font-size: 0.72rem;
  font-weight: 850;
  line-height: 1.1;
  text-transform: uppercase;
}

.core-environment-header h2 {
  margin: 0.35rem 0 0;
  color: #ffffff;
  font-size: clamp(1.75rem, 4.6vw, 3.55rem);
  font-weight: 790;
  letter-spacing: 0;
  line-height: 0.96;
}

.core-environment-header span {
  display: block;
  margin-top: 0.65rem;
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.95rem;
  line-height: 1.45;
}

.core-environment-close {
  display: grid;
  width: 2.75rem;
  height: 2.75rem;
  flex: 0 0 auto;
  place-items: center;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.78);
  transition:
    border-color 180ms ease,
    background 180ms ease,
    transform 180ms ease;
}

.core-environment-close:hover,
.core-environment-close:focus-visible {
  border-color: rgba(var(--environment-rgb), 0.42);
  background: rgba(255, 255, 255, 0.13);
  transform: scale(1.04);
}

.core-environment-stage {
  display: grid;
  min-height: 0;
  grid-template-columns: minmax(18rem, 0.82fr) minmax(24rem, 1.18fr);
  gap: clamp(0.9rem, 1.8vw, 1.25rem);
  overflow: hidden;
}

.core-environment-catalog,
.core-environment-preview {
  min-width: 0;
  min-height: 0;
  border: 1px solid rgba(255, 255, 255, 0.13);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.065);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(18px) saturate(1.08);
}

.core-environment-catalog {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 0.8rem;
  overflow: hidden;
  padding: 0.8rem;
}

.core-environment-search {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 0.65rem;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.22);
  color: rgba(255, 255, 255, 0.52);
  padding: 0.74rem 0.82rem;
}

.core-environment-search:focus-within {
  border-color: rgba(var(--environment-rgb), 0.48);
  box-shadow: 0 0 0 0.2rem rgba(var(--environment-rgb), 0.12);
}

.core-environment-search input {
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: #ffffff;
  font: inherit;
  font-size: 0.9rem;
  font-weight: 680;
}

.core-environment-search input::placeholder {
  color: rgba(255, 255, 255, 0.42);
}

.core-environment-list {
  display: grid;
  min-height: 0;
  align-content: start;
  gap: 0.58rem;
  overflow-x: hidden;
  overflow-y: auto;
  padding: 0.05rem 0.15rem 0.15rem 0;
  scrollbar-width: thin;
  scrollbar-color: rgba(var(--environment-rgb), 0.42) transparent;
}

.core-environment-row {
  position: relative;
  display: grid;
  min-height: 4.85rem;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.78rem;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.052);
  color: #ffffff;
  padding: 0.62rem;
  text-align: left;
  transition:
    border-color 180ms ease,
    background 180ms ease,
    box-shadow 180ms ease,
    transform 180ms ease;
}

.core-environment-row::before {
  position: absolute;
  inset: -40% 44% -50% -24%;
  background: radial-gradient(
    circle at calc(18% + var(--environment-card-shift, 0%)) 42%,
    rgba(var(--environment-card-rgb), 0.18),
    transparent 64%
  );
  content: '';
  opacity: 0;
  pointer-events: none;
  transition: opacity 180ms ease;
}

.core-environment-row:hover,
.core-environment-row:focus-visible,
.core-environment-row--preview {
  border-color: rgba(var(--environment-card-rgb), 0.44);
  background: rgba(255, 255, 255, 0.084);
  box-shadow: 0 1.15rem 2.4rem rgba(0, 0, 0, 0.2);
  transform: translateY(-1px);
}

.core-environment-row:hover::before,
.core-environment-row:focus-visible::before,
.core-environment-row--preview::before {
  opacity: 1;
}

.core-environment-row--active {
  border-color: rgba(var(--environment-card-rgb), 0.6);
  background: rgba(var(--environment-card-rgb), 0.12);
}

.core-environment-row--selecting {
  animation: core-environment-confirm 440ms cubic-bezier(0.2, 0.9, 0.24, 1) forwards;
}

.core-environment-row-copy {
  position: relative;
  z-index: 1;
  display: grid;
  min-width: 0;
  gap: 0.28rem;
}

.core-environment-row-copy strong {
  overflow: hidden;
  color: #ffffff;
  font-size: 0.98rem;
  font-weight: 780;
  line-height: 1.12;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.core-environment-row-copy small {
  overflow: hidden;
  color: rgba(255, 255, 255, 0.54);
  font-size: 0.76rem;
  font-weight: 680;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.core-environment-row-badge,
.core-environment-preview-badge {
  border-radius: 999px;
  background: rgba(var(--environment-card-rgb), 0.18);
  color: var(--environment-card-aura);
  font-size: 0.66rem;
  font-weight: 850;
  line-height: 1;
  padding: 0.44rem 0.56rem;
  text-transform: uppercase;
  white-space: nowrap;
}

.core-environment-empty {
  display: grid;
  place-items: center;
  gap: 0.55rem;
  min-height: 10rem;
  color: rgba(255, 255, 255, 0.54);
  font-size: 0.88rem;
  font-weight: 720;
}

.core-environment-row--youtube-action {
  border-color: rgba(255, 0, 0, 0.24);
  background: linear-gradient(135deg, rgba(255, 0, 0, 0.12), rgba(255, 255, 255, 0.05));
}

.core-environment-youtube-icon {
  position: relative;
  z-index: 1;
  display: grid;
  width: 3.15rem;
  height: 3.15rem;
  place-items: center;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 12px;
  background: rgba(255, 0, 0, 0.18);
  color: #ff5c5c;
  font-size: 1.25rem;
}

.core-environment-row-remove {
  position: relative;
  z-index: 2;
  display: grid;
  width: 2rem;
  height: 2rem;
  place-items: center;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.22);
  color: rgba(255, 255, 255, 0.62);
  transition:
    border-color 180ms ease,
    background 180ms ease,
    color 180ms ease;
}

.core-environment-row-remove:hover,
.core-environment-row-remove:focus-visible {
  border-color: rgba(255, 255, 255, 0.3);
  background: rgba(255, 255, 255, 0.12);
  color: #ffffff;
}

.core-environment-preview.core-environment-preview--youtube {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: clamp(0.65rem, 1.35vw, 0.95rem);
  padding-block: clamp(0.85rem, 1.7vw, 1.15rem) clamp(1.15rem, 2vw, 1.55rem);
}

.core-environment-preview--youtube .core-environment-youtube-form,
.core-environment-preview--youtube .core-environment-use,
.core-environment-preview--youtube .core-youtube-error {
  flex: 0 0 auto;
}

.core-environment-preview--youtube .core-environment-use {
  align-self: center;
}

@media (min-width: 761px) {
  .core-environment-preview--youtube-empty {
    align-self: start;
  }
}

.core-environment-youtube-form {
  position: relative;
  z-index: 1;
  display: grid;
  gap: 0.45rem;
}

.core-environment-youtube-form label {
  color: rgba(255, 255, 255, 0.72);
  font-size: 0.78rem;
  font-weight: 780;
  text-transform: uppercase;
}

.core-environment-youtube-form input {
  width: 100%;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.28);
  color: #ffffff;
  font: inherit;
  font-size: 0.92rem;
  font-weight: 680;
  outline: 0;
  padding: 0.78rem 0.9rem;
}

.core-environment-youtube-form input:focus {
  border-color: rgba(var(--environment-card-rgb), 0.5);
  box-shadow: 0 0 0 0.2rem rgba(var(--environment-card-rgb), 0.12);
}

.core-environment-youtube-form small,
.core-youtube-error {
  color: rgba(255, 255, 255, 0.56);
  font-size: 0.78rem;
  font-weight: 650;
  line-height: 1.4;
}

.core-youtube-preview-player {
  position: relative;
  z-index: 1;
  flex: 0 0 auto;
  overflow: hidden;
  width: min(100%, 29rem);
  aspect-ratio: 16 / 9;
  align-self: center;
  border: 1px solid rgba(var(--environment-card-rgb), 0.42);
  border-radius: 16px;
  background: #05090d;
  box-shadow: 0 1.25rem 3rem rgba(0, 0, 0, 0.28);
}

.core-youtube-preview-player :deep(.youtube-player) {
  height: 100%;
  min-width: 0;
  min-height: 0;
}

.core-youtube-error {
  position: relative;
  z-index: 1;
  margin: 0;
  color: #fecaca;
  text-align: center;
}

.core-environment-preview {
  position: relative;
  display: grid;
  align-content: center;
  gap: clamp(0.85rem, 1.8vw, 1.2rem);
  overflow-x: hidden;
  overflow-y: auto;
  padding: clamp(1rem, 2.2vw, 1.5rem);
  scrollbar-width: thin;
  scrollbar-color: rgba(var(--environment-card-rgb), 0.42) transparent;
  background:
    radial-gradient(circle at 50% 10%, rgba(var(--environment-card-rgb), 0.24), transparent 38%),
    linear-gradient(160deg, rgba(255, 255, 255, 0.085), rgba(255, 255, 255, 0.025));
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.1),
    inset 0 0 4rem rgba(var(--environment-card-rgb), 0.035);
}

.core-environment-preview::before {
  position: absolute;
  inset: -18% -12% auto;
  height: 24rem;
  background: radial-gradient(circle, rgba(var(--environment-card-rgb), 0.24), transparent 62%);
  content: '';
  filter: blur(24px);
  pointer-events: none;
}

.core-environment-preview-copy,
.core-environment-use {
  position: relative;
  z-index: 1;
}

.core-environment-preview-copy {
  display: grid;
  justify-items: center;
  gap: 0.48rem;
  text-align: center;
}

.core-environment-preview-badge {
  margin-bottom: 0.25rem;
  background: rgba(var(--environment-card-rgb), 0.2);
}

.core-environment-preview-copy h3 {
  max-width: 100%;
  margin: 0;
  color: #ffffff;
  font-size: clamp(1.7rem, 4vw, 3.15rem);
  font-weight: 820;
  letter-spacing: 0;
  line-height: 1;
  overflow-wrap: anywhere;
}

.core-environment-preview--youtube .core-environment-preview-copy {
  flex: 0 0 auto;
  gap: 0.36rem;
  margin-top: clamp(0.7rem, 1.5vw, 1.15rem);
}

.core-environment-preview--youtube .core-environment-preview-copy h3 {
  font-size: clamp(1.5rem, 3vw, 2.35rem);
  line-height: 1.06;
}

.core-environment-preview--youtube .core-environment-preview-badge {
  margin-bottom: 0.05rem;
}

.core-environment-preview-copy p {
  margin: 0;
  color: rgba(255, 255, 255, 0.62);
  font-size: 0.98rem;
  font-weight: 720;
  line-height: 1.25;
}

.core-environment-use {
  display: inline-flex;
  width: min(100%, 18rem);
  min-height: 3.15rem;
  align-items: center;
  justify-content: center;
  justify-self: center;
  gap: 0.55rem;
  border: 0;
  border-radius: 999px;
  background: var(--environment-card-aura);
  color: var(--environment-card-ink);
  font-size: 0.94rem;
  font-weight: 850;
  line-height: 1;
  padding: 0.9rem 1.2rem;
  box-shadow:
    0 1.2rem 2.2rem rgba(var(--environment-card-rgb), 0.24),
    inset 0 1px 0 rgba(255, 255, 255, 0.26);
  transition:
    box-shadow 180ms ease,
    transform 180ms ease;
}

.core-environment-use:hover:not(:disabled),
.core-environment-use:focus-visible:not(:disabled) {
  box-shadow:
    0 1.45rem 2.8rem rgba(var(--environment-card-rgb), 0.32),
    inset 0 1px 0 rgba(255, 255, 255, 0.32);
  transform: translateY(-1px) scale(1.01);
}

.core-environment-use:disabled {
  cursor: wait;
  opacity: 0.72;
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
  width: 2.35rem;
  height: 1.55rem;
  align-items: center;
  justify-content: center;
  gap: 0.16rem;
  border-radius: 6px;
  background: transparent !important;
}

.core-track-wave span {
  width: 0.08rem;
  height: 42%;
  border-radius: 999px;
  background: color-mix(in srgb, var(--resource-mode-color), transparent 20%);
  opacity: 0.9;
}

.core-track--active .core-track-wave span {
  animation: core-wave-pulse 920ms ease-in-out infinite;
  transform-origin: center;
}

.core-track--active .core-track-wave span:nth-child(2) {
  animation-delay: 80ms;
}

.core-track--active .core-track-wave span:nth-child(3) {
  animation-delay: 160ms;
}

.core-track--active .core-track-wave span:nth-child(4) {
  animation-delay: 240ms;
}

.core-track--active .core-track-wave span:nth-child(5) {
  animation-delay: 320ms;
}

.core-track--active .core-track-wave span:nth-child(6) {
  animation-delay: 400ms;
}

.core-track--active .core-track-wave span:nth-child(7) {
  animation-delay: 480ms;
}

.core-track-wave span:nth-child(2) {
  height: 64%;
}

.core-track-wave span:nth-child(3) {
  height: 82%;
}

.core-track-wave span:nth-child(4) {
  height: 100%;
}

.core-track-wave span:nth-child(5) {
  height: 76%;
}

.core-track-wave span:nth-child(6) {
  height: 56%;
}

.core-youtube-panel {
  position: relative;
  overflow: hidden;
  width: 100%;
  flex: 0 0 auto;
  margin-top: 0.9rem;
  border: 1px solid rgba(var(--resource-mode-rgb), 0.28);
  border-radius: 14px;
  background: #05090d;
  box-shadow: 0 1rem 2.4rem rgba(0, 0, 0, 0.24);
}

.core-youtube-viewport {
  position: relative;
  width: 100%;
  overflow: hidden;
  aspect-ratio: 16 / 9;
}

.core-youtube-clean-cover {
  position: absolute;
  inset: 0;
  z-index: 2;
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0;
  pointer-events: none;
  transition: opacity 120ms ease;
}

.core-youtube-clean-cover--visible {
  opacity: 1;
}

.core-youtube-floating {
  position: fixed;
  right: max(1rem, env(safe-area-inset-right));
  bottom: max(1rem, env(safe-area-inset-bottom));
  z-index: 50;
  width: min(20rem, calc(100vw - 2rem));
  height: auto;
  min-height: 0;
  margin: 0;
  border-radius: 8px;
}

.core-youtube-panel :deep(.youtube-player) {
  height: 100%;
  min-width: 0;
  min-height: 0;
}

.core-youtube-timeline {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  column-gap: 0.65rem;
  row-gap: 0.1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(5, 9, 13, 0.96);
  color: rgba(255, 255, 255, 0.68);
  font-size: 0.7rem;
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  padding: 0.45rem 0.65rem;
}

.core-range--timeline {
  display: grid;
  min-height: 2.35rem;
  align-items: center;
}

.core-youtube-timeline .core-range--timeline {
  display: grid;
  align-items: center;
  grid-column: 1 / -1;
  grid-row: 2;
}

.core-youtube-timeline > span:last-child {
  grid-column: 2;
  grid-row: 1;
}

.core-volume-row.core-youtube-mini-volume {
  margin: 0;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(5, 9, 13, 0.96);
  padding: 0.55rem 0.65rem;
}

.core-volume-row.core-youtube-mini-volume button {
  width: 2rem;
  height: 2rem;
}

.core-youtube-mini-volume .core-range--volume {
  min-height: 2rem;
}

.core-workspace:not(.core-workspace--minimal) .core-music-panel--compact .core-youtube-panel {
  margin: 0;
  border: 0;
  border-radius: 8px;
  background: transparent;
  box-shadow: none;
}

.core-workspace:not(.core-workspace--minimal) .core-music-panel--compact .core-youtube-viewport {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  opacity: 0;
  pointer-events: none;
  white-space: nowrap;
}

.core-workspace:not(.core-workspace--minimal) .core-music-panel--compact .core-youtube-timeline {
  border-top: 0;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.025);
  padding: 0.32rem 0.45rem;
}

.core-workspace:not(.core-workspace--minimal) .core-music-panel--compact .core-audio-console {
  margin-top: 0;
  border: 0;
  background: transparent;
  padding: 0.12rem 0.2rem 0.2rem;
}

.core-workspace:not(.core-workspace--minimal) .core-music-panel--compact .core-now-playing {
  display: none;
}

.core-workspace:not(.core-workspace--minimal) .core-music-panel--compact .core-volume-row {
  margin-top: 0;
}

.core-audio-console {
  flex: 0 0 auto;
  min-height: 0;
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

.core-range--volume {
  display: grid;
  min-height: 2.35rem;
  align-items: center;
}

.core-range input {
  display: block;
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

.core-range--timeline input {
  background: linear-gradient(
    90deg,
    var(--resource-mode-color) 0 var(--youtube-progress),
    rgba(255, 255, 255, 0.12) var(--youtube-progress) 100%
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

.core-environment-portal-enter-active,
.core-environment-portal-leave-active {
  transition: opacity 220ms ease;
}

.core-environment-portal-enter-active .core-environment-modal,
.core-environment-portal-leave-active .core-environment-modal {
  transition:
    opacity 260ms ease,
    transform 300ms cubic-bezier(0.18, 0.9, 0.24, 1);
}

.core-environment-portal-enter-from,
.core-environment-portal-leave-to {
  opacity: 0;
}

.core-environment-portal-enter-from .core-environment-modal,
.core-environment-portal-leave-to .core-environment-modal {
  opacity: 0;
  transform: scale(0.96) translateY(1rem);
}

@keyframes core-environment-confirm {
  0% {
    transform: translateY(-0.22rem) scale(1.018);
  }

  58% {
    transform: translateY(-0.4rem) scale(1.055);
  }

  100% {
    transform: translateY(-0.18rem) scale(1.035);
  }
}

@keyframes core-environment-land {
  0% {
    opacity: 0.2;
    transform: translateY(-28vh) scale(2.8);
  }

  68% {
    opacity: 1;
    transform: translateY(0) scale(0.96);
  }

  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes core-wave-pulse {
  0%,
  100% {
    transform: scaleY(0.72);
    opacity: 0.58;
  }

  50% {
    transform: scaleY(1.12);
    opacity: 1;
  }
}

@media (max-width: 760px) {
  .core-youtube-floating {
    width: min(13rem, calc(100vw - 2rem));
  }

  .core-environment-backdrop {
    padding: 0;
  }

  .core-environment-modal {
    width: 100vw;
    height: 100dvh;
    border-width: 0;
    border-radius: 0;
    padding: 1rem;
  }

  .core-environment-header {
    align-items: flex-start;
  }

  .core-environment-header h2 {
    font-size: clamp(1.65rem, 10vw, 2.45rem);
  }

  .core-environment-stage {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: minmax(15rem, 0.9fr) minmax(20rem, 1.1fr);
  }

  .core-environment-catalog {
    padding: 0.72rem;
  }

  .core-environment-preview {
    align-content: start;
  }

  .core-environment-preview-copy h3 {
    font-size: clamp(1.55rem, 8vw, 2.35rem);
  }

  .core-environment-row {
    min-height: 4.45rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .core-track--active .core-track-wave span,
  .core-current-environment--landing,
  .core-environment-row--selecting {
    animation: none;
  }

  .core-music-panel,
  .core-panel-expanded,
  .core-panel-compact-enter-active,
  .core-panel-compact-leave-active,
  .core-panel-state-toggle,
  .core-current-environment,
  .core-environment-close,
  .core-environment-row,
  .core-environment-row::before,
  .core-environment-use,
  .core-environment-portal-enter-active,
  .core-environment-portal-leave-active,
  .core-environment-portal-enter-active .core-environment-modal,
  .core-environment-portal-leave-active .core-environment-modal {
    transition: none;
  }
}

@keyframes core-ending-pulse {
  0%,
  100% {
    transform: scale(1);
    opacity: 0.96;
  }

  50% {
    transform: scale(1.008);
    opacity: 1;
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
    justify-content: flex-start;
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
  .core-page {
    height: 100svh;
    overflow: hidden;
  }

  .core-shell {
    height: calc(100svh - 3.5rem);
    min-height: 0;
    overflow: hidden;
  }

  .core-page--minimal .core-shell {
    height: 100svh;
    padding-top: 0;
  }

  .core-page--minimal .core-workspace--minimal,
  .core-page--minimal .core-workspace--minimal .core-stage {
    min-height: 100svh;
  }

  .core-page--minimal .core-timer-zone {
    transform: none;
  }

  .core-workspace {
    grid-template-columns: minmax(0, 1fr);
    min-height: calc(100svh - 6.35rem);
    overflow: hidden;
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
    transform: translateY(-4rem);
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
    overflow-x: hidden;
    overflow-y: auto;
    scrollbar-color: rgba(var(--resource-mode-rgb), 0.42) transparent;
    scrollbar-gutter: stable;
    scrollbar-width: thin;
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

  .core-music-panel.core-music-panel--compact {
    bottom: auto;
    width: clamp(15rem, 18vw, 18rem);
    max-height: calc(100svh - 8rem);
    overflow: hidden;
    scrollbar-gutter: auto;
    padding: 0.72rem;
  }

  .core-panel-heading {
    display: flex;
  }

  .core-panel-track-count {
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

@media (min-width: 1024px) and (max-width: 1280px) {
  .core-music-panel.core-music-panel--compact {
    top: 0.9rem;
    right: 0.8rem;
    width: 15rem;
  }
}

@media (min-width: 1024px) and (max-width: 1360px) {
  .core-timer-orbit--panel-expanded {
    width: clamp(24rem, 34vw, 28rem);
    translate: -4rem 0;
  }

  .core-timer-orbit:not(.core-timer-orbit--panel-expanded) {
    width: clamp(27rem, 44vw, 34rem);
    translate: -1.5rem 0;
  }
}

@media (min-width: 1024px) and (max-width: 1600px) {
  .core-session-stats {
    bottom: 5.9rem;
  }
}
</style>
