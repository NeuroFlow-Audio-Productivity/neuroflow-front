<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Select from 'primevue/select'

import AppNavbar from '@/components/AppNavbar.vue'
import { ApiError } from '@/services/authApi'
import { translateApiKey, translateApiMessage } from '@/services/apiMessageTranslator'
import { audioApi, audioSourceUrl } from '@/services/audioApi'
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
import { modeRhythmStyle, modeSemanticKey } from '@/services/modeVisuals'
import { useAuthStore } from '@/stores/auth'
import { useVisualThemeStore } from '@/stores/visualTheme'
import type { Audio } from '@/types/audio'
import type { Flow } from '@/types/flow'
import type { Mode } from '@/types/mode'

type TimerPhase = 'work' | 'shortBreak' | 'longBreak'
type BrowserWindowWithLegacyAudioContext = Window & {
  webkitAudioContext?: typeof AudioContext
}

const defaultPhaseDurations: Record<TimerPhase, number> = {
  work: 25 * 60,
  shortBreak: 5 * 60,
  longBreak: 15 * 60,
}
const FLOW_EXECUTION_STORAGE_KEY = 'neuroflow-core-flow-session'

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
const selectedFlowId = ref<number | null>(null)
const flowSession = ref<FlowSession | null>(null)
const flowExecutionState = ref<FlowExecutionState | null>(null)
const isLoadingFlows = ref(false)
const isLoadingSelectedFlow = ref(false)
const selectedModeId = ref<number | null>(null)
const selectedAudioId = ref<string | number | null>(null)
const selectedAlarmAudioId = ref<string | number | null>(null)
const timerPhase = ref<TimerPhase>('work')
const remainingSeconds = ref(defaultPhaseDurations.work)
const cycleIndex = ref(0)
const completedBlocks = ref(0)
const isRunning = ref(false)
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
const audioVolume = ref(0.74)
const isAudioMuted = ref(false)
const isAudioPlaying = ref(false)
const isAudioWaiting = ref(false)
const hasAudioError = ref(false)

let timerInterval: ReturnType<typeof window.setInterval> | undefined
let completionAudioContext: AudioContext | undefined

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
const flowOptions = computed(() => [
  { label: t('coreTimer.flow.defaultMode'), value: null },
  ...sortedFlows.value.map((flow) => ({ label: flow.name, value: flow.id })),
])
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
const selectedAudioSource = computed(() => audioSourceUrl(selectedAudio.value))
const selectedAlarmAudioSource = computed(() =>
  audioSourceUrl(isFlowLoaded.value ? currentFlowCompletionAudio.value : selectedAlarmAudio.value),
)
const selectedTrackLabel = computed(() => selectedAudio.value?.name ?? t('coreTimer.audio.noTrack'))
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
const hasAudioSource = computed(() => Boolean(selectedAudioSource.value))
const audioVolumeStyle = computed(() => ({
  '--audio-volume': `${isAudioMuted.value ? 0 : audioVolume.value * 100}%`,
}))
const audioVolumeIcon = computed(() => {
  if (isAudioMuted.value || audioVolume.value === 0) return 'pi pi-volume-off'
  if (audioVolume.value < 0.5) return 'pi pi-volume-down'

  return 'pi pi-volume-up'
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
const timerProgressStyle = computed(() => ({
  '--timer-progress': `${timerProgress.value}%`,
}))
const playPauseLabel = computed(() =>
  isRunning.value ? t('coreTimer.actions.pause') : t('coreTimer.actions.start'),
)
const playPauseIcon = computed(() => (isRunning.value ? 'pi pi-pause' : 'pi pi-play'))
const isMinimalMode = ref(false)
const minimalModeLabel = computed(() =>
  isMinimalMode.value ? t('coreTimer.actions.exitMinimal') : t('coreTimer.actions.enterMinimal'),
)
const minimalModeIcon = computed(() =>
  isMinimalMode.value ? 'pi pi-window-maximize' : 'pi pi-window-minimize',
)
const activeCycleStep = computed(() => cycleIndex.value + 1)
const trackCountLabel = computed(() =>
  t('coreTimer.audio.trackCount', { count: sortedAudios.value.length }),
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

function browserStorage() {
  return typeof localStorage === 'undefined' ? null : localStorage
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
        .map((node) => node.end_audio)
        .filter((audio): audio is Audio => Boolean(audio))
    }
    flowSession.value = session
    flowExecutionState.value = createFlowExecutionState(session, persistedState)
    remainingSeconds.value = flowExecutionState.value.remainingSeconds
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
}

function restartLoadedFlow() {
  const session = flowSession.value

  if (!session) return

  pauseSession()
  flowExecutionState.value = restartFlowExecutionState(session)
  remainingSeconds.value = flowExecutionState.value.remainingSeconds
  syncActiveFlowMode()
  persistFlowExecutionState()
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

function clearTimerInterval() {
  if (timerInterval === undefined) return

  window.clearInterval(timerInterval)
  timerInterval = undefined
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
    masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.05)
    masterGain.connect(audioContext.destination)

    bellFrequencies.forEach((frequency, index) => {
      const oscillator = audioContext.createOscillator()
      const noteGain = audioContext.createGain()
      const startTime = now + index * 0.14
      const stopTime = startTime + 0.72

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

        if (index === bellFrequencies.length - 1) {
          masterGain.disconnect()
        }
      }
    })
  } catch {
    // Bell playback is best-effort and should never block the next phase.
  }
}

async function playCompletionAlarm() {
  const alarmAudio = alarmAudioElement.value

  if (alarmAudio && selectedAlarmAudioSource.value) {
    try {
      alarmAudio.pause()
      alarmAudio.currentTime = 0
      await alarmAudio.play()
      return
    } catch {
      if (isFlowLoaded.value) return
      // Fall back to the generated bell if the uploaded alarm cannot play.
    }
  }

  if (!isFlowLoaded.value) {
    await ringCompletionBell()
  }
}

function completePhase() {
  if (flowSession.value && flowExecutionState.value) {
    flowExecutionState.value = completeCurrentFlowNode(flowExecutionState.value, flowSession.value)
    remainingSeconds.value = flowExecutionState.value.remainingSeconds
    syncActiveFlowMode()
    persistFlowExecutionState()

    if (flowExecutionState.value.isComplete) {
      pauseSession()
    }

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
  const shouldContinueFlow = isFlowLoaded.value

  if (!shouldContinueFlow) {
    pauseSession()
  }

  void playCompletionAlarm()
  completePhase()
}

function tickTimer() {
  if (remainingSeconds.value <= 1) {
    completeExpiredPhase()
    return
  }

  remainingSeconds.value -= 1

  if (flowExecutionState.value) {
    flowExecutionState.value = {
      ...flowExecutionState.value,
      remainingSeconds: remainingSeconds.value,
    }
    persistFlowExecutionState()
  }
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
  if (!canRunTimer.value) return

  isRunning.value = true
  void prepareCompletionBell()
  await nextTick()
  await playAudio()
}

function pauseSession() {
  isRunning.value = false
  clearTimerInterval()
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
  completePhase()
}

function extendSession() {
  remainingSeconds.value += 5 * 60
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
  isDurationDialogVisible.value = false
}

function toggleMinimalMode() {
  isMinimalMode.value = !isMinimalMode.value
}

function selectPhase(phase: TimerPhase) {
  if (isFlowLoaded.value || timerPhase.value === phase) return

  pauseSession()
  timerPhase.value = phase
  cycleIndex.value = phaseCycle.findIndex((cyclePhase) => cyclePhase === phase)
  remainingSeconds.value = phaseDurations.value[phase]
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

  alarmAudio.pause()
  alarmAudio.load()
})

onMounted(() => {
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
  pauseAudio()

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
            <div v-if="auth.isAuthenticated" class="core-flow-field auth-field">
              <label class="sr-only" for="core-flow-select">
                {{ t('coreTimer.flow.selectLabel') }}
              </label>
              <Select
                input-id="core-flow-select"
                v-model="selectedFlowId"
                :options="flowOptions"
                option-label="label"
                option-value="value"
                :placeholder="t('coreTimer.flow.selectPlaceholder')"
                :loading="isLoadingFlows || isLoadingSelectedFlow"
                :disabled="isLoadingFlows || isLoadingSelectedFlow"
                class="!w-full"
              />
            </div>

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
                <div class="core-timer-orbit" :style="timerProgressStyle">
                  <span class="core-timer-ring core-timer-ring--outer" aria-hidden="true" />
                  <span class="core-timer-ring core-timer-ring--inner" aria-hidden="true" />

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

        <aside class="core-music-panel">
          <div class="core-panel-heading">
            <div>
              <p>{{ t('coreTimer.audio.eyebrow') }}</p>
              <h2>{{ t('coreTimer.audio.title', { mode: selectedModeName }) }}</h2>
            </div>
            <span>{{ trackCountLabel }}</span>
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
                <small>{{ section.modeName || selectedModeName }}</small>
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
                <span v-for="beat in 7" :key="beat" />
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
  overflow: hidden;
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

.core-mode-field,
.core-flow-field {
  width: min(100%, 17rem);
}

.core-mode-field :deep(.p-select),
.core-flow-field :deep(.p-select) {
  align-items: center;
  min-height: 3.1rem;
  border-color: rgba(255, 255, 255, 0.16) !important;
  background: rgba(13, 10, 18, 0.72) !important;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08) !important;
}

.core-mode-field :deep(.p-select-label),
.core-flow-field :deep(.p-select-label) {
  display: flex;
  min-width: 0;
  align-items: center;
  align-self: stretch;
  padding-block: 0;
  line-height: 1.2;
}

.core-minimal-toggle {
  width: 3.1rem !important;
  height: 3.1rem !important;
  flex: 0 0 auto;
  border: 1px solid rgba(var(--resource-mode-rgb), 0.28) !important;
  background: rgba(255, 255, 255, 0.08) !important;
  color: rgba(255, 255, 255, 0.8) !important;
}

.core-minimal-toggle:hover {
  background: rgba(var(--resource-mode-rgb), 0.14) !important;
  color: #ffffff !important;
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
.core-timer-orbit::after,
.core-timer-ring,
.core-timer-readout strong {
  transition:
    opacity 260ms ease,
    transform 320ms ease,
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
}

.core-workspace--minimal .core-mode-field,
.core-workspace--minimal .core-flow-field {
  display: none;
}

.core-workspace--minimal .core-mode-summary,
.core-workspace--minimal .core-player-footer,
.core-workspace--minimal .core-session-stats,
.core-workspace--minimal .core-music-panel,
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

.core-workspace--minimal .core-timer-orbit::after,
.core-workspace--minimal .core-timer-ring {
  opacity: 0;
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

.core-flow-sections {
  display: grid;
  gap: 0.52rem;
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

@media (prefers-reduced-motion: reduce) {
  .core-track--active .core-track-wave span {
    animation: none;
  }
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
