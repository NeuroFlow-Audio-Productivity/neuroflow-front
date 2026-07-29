import type { ModeSemanticKey } from '@/services/modeVisuals'

export type NeuralCoreSessionState = 'idle' | 'playing' | 'paused'
export type NeuralCoreRenderMode = 'full' | 'minimal' | 'static'

export type NeuralCoreAudioBands = {
  low: number
  mid: number
  high: number
}

export type NeuralCoreModeConfig = {
  speed: number
  deformation: number
  breathRate: number
  orbitSpread: number
  brightness: number
  verticalDrift: number
}

const MODE_CONFIGS: Record<ModeSemanticKey, NeuralCoreModeConfig> = {
  focus: {
    speed: 0.24,
    deformation: 0.16,
    breathRate: 0.78,
    orbitSpread: 0.9,
    brightness: 0.92,
    verticalDrift: 0,
  },
  relax: {
    speed: 0.14,
    deformation: 0.25,
    breathRate: 0.46,
    orbitSpread: 1.12,
    brightness: 0.78,
    verticalDrift: 0.025,
  },
  sleep: {
    speed: 0.075,
    deformation: 0.19,
    breathRate: 0.28,
    orbitSpread: 1.2,
    brightness: 0.52,
    verticalDrift: -0.055,
  },
}

export const normalizeNeuralCoreValue = (value: number) =>
  Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0

export const normalizeNeuralCoreProgress = (progressPercent: number) =>
  normalizeNeuralCoreValue(progressPercent / 100)

export const resolveNeuralCoreMode = (
  modeKey: ModeSemanticKey | null | undefined,
): NeuralCoreModeConfig => MODE_CONFIGS[modeKey ?? 'focus']

export const resolveNeuralCoreSessionState = (
  running: boolean,
  progress: number,
  sessionStarted = normalizeNeuralCoreValue(progress) > 0,
): NeuralCoreSessionState => {
  if (running) return 'playing'

  return sessionStarted || normalizeNeuralCoreValue(progress) > 0 ? 'paused' : 'idle'
}

export const resolveNeuralCoreMotionScale = (
  state: NeuralCoreSessionState,
  reducedMotion: boolean,
) => {
  if (reducedMotion) return 0.035
  if (state === 'playing') return 1
  if (state === 'paused') return 0.18

  return 0.3
}

export const selectNeuralCoreRenderMode = ({
  webglAvailable,
  reducedMotion,
  lowCapability,
}: {
  webglAvailable: boolean
  reducedMotion: boolean
  lowCapability: boolean
}): NeuralCoreRenderMode => {
  if (!webglAvailable) return 'static'
  if (reducedMotion || lowCapability) return 'minimal'

  return 'full'
}

export const normalizeAudioBands = (
  bands: NeuralCoreAudioBands | null | undefined,
): NeuralCoreAudioBands => ({
  low: normalizeNeuralCoreValue(bands?.low ?? 0),
  mid: normalizeNeuralCoreValue(bands?.mid ?? 0),
  high: normalizeNeuralCoreValue(bands?.high ?? 0),
})
