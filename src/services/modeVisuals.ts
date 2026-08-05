export const FALLBACK_MODE_COLOR = '#6ee7d8'

const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i
const MODE_RHYTHM_STYLES = {
  focus: {
    '--resource-mode-wave-duration': '3.2s',
    '--resource-mode-wave-scale': '1.18',
    '--resource-mode-band-duration': '6s',
  },
  relax: {
    '--resource-mode-wave-duration': '5.4s',
    '--resource-mode-wave-scale': '0.92',
    '--resource-mode-band-duration': '9s',
  },
  sleep: {
    '--resource-mode-wave-duration': '7.8s',
    '--resource-mode-wave-scale': '0.72',
    '--resource-mode-band-duration': '12s',
  },
} as const

export type ModeSemanticKey = keyof typeof MODE_RHYTHM_STYLES

type ModeSemanticInput = {
  name?: string | null
  description?: string | null
}

type SystemModeInput = {
  is_system?: boolean | number | string | null
}

export const isSystemMode = (mode: SystemModeInput | null | undefined) => {
  const value = mode?.is_system

  return value === true || value === 1 || value === '1' || value === 'true'
}

export const isAlarmModeName = (mode: ModeSemanticInput | null | undefined) =>
  normalizeSemanticText(mode?.name) === 'session alarm'

export const isUserMode = (mode: (SystemModeInput & ModeSemanticInput) | null | undefined) =>
  !isSystemMode(mode) && !isAlarmModeName(mode)

export const isHexColor = (value: string | null | undefined) =>
  HEX_COLOR_PATTERN.test(value?.trim() ?? '')

export const normalizeModeColor = (value: string | null | undefined) => {
  const color = value?.trim()

  return color && HEX_COLOR_PATTERN.test(color) ? color.toLowerCase() : FALLBACK_MODE_COLOR
}

const normalizeSemanticText = (value: string | null | undefined) =>
  (value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

const semanticKeyFromText = (value: string | null | undefined): ModeSemanticKey | null => {
  const text = normalizeSemanticText(value)

  if (!text) return null
  if (/\b(focus|focused|focusing|foco|concentr[a-z]*|attention|beta)\b/.test(text)) {
    return 'focus'
  }

  if (/\b(relax|relaxed|relaxing|relajar|relaxamento|relajacion|theta)\b/.test(text)) {
    return 'relax'
  }

  if (/\b(sleep|sleeping|sono|sueno|dormir|delta)\b/.test(text)) return 'sleep'

  return null
}

export const modeSemanticKey = (mode: ModeSemanticInput | null | undefined) =>
  semanticKeyFromText(mode?.description) ?? semanticKeyFromText(mode?.name)

const hexChannel = (color: string, start: number) =>
  Number.parseInt(color.slice(start, start + 2), 16)

const hexToRgb = (value: string) => {
  const color = normalizeModeColor(value)

  return {
    r: hexChannel(color, 1),
    g: hexChannel(color, 3),
    b: hexChannel(color, 5),
  }
}

const toLinearChannel = (channel: number) => {
  const normalized = channel / 255

  return normalized <= 0.03928 ? normalized / 12.92 : Math.pow((normalized + 0.055) / 1.055, 2.4)
}

export const modeRgbString = (value: string | null | undefined) => {
  const { r, g, b } = hexToRgb(normalizeModeColor(value))

  return `${r}, ${g}, ${b}`
}

export const modeInkColor = (value: string | null | undefined) => {
  const { r, g, b } = hexToRgb(normalizeModeColor(value))
  const luminance =
    0.2126 * toLinearChannel(r) + 0.7152 * toLinearChannel(g) + 0.0722 * toLinearChannel(b)

  return luminance > 0.42 ? '#06100e' : '#ffffff'
}

export const modeVisualStyle = (value: string | null | undefined): Record<string, string> => {
  const color = normalizeModeColor(value)

  return {
    '--resource-mode-color': color,
    '--resource-mode-rgb': modeRgbString(color),
    '--resource-mode-ink': modeInkColor(color),
  }
}

export const modeRhythmStyle = (
  mode: ModeSemanticInput | null | undefined,
): Record<string, string> => MODE_RHYTHM_STYLES[modeSemanticKey(mode) ?? 'focus']
