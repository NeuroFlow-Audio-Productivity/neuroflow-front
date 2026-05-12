export const FALLBACK_MODE_COLOR = '#6ee7d8'

const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i

export const isHexColor = (value: string | null | undefined) =>
  HEX_COLOR_PATTERN.test(value?.trim() ?? '')

export const normalizeModeColor = (value: string | null | undefined) => {
  const color = value?.trim()

  return color && HEX_COLOR_PATTERN.test(color) ? color.toLowerCase() : FALLBACK_MODE_COLOR
}

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
