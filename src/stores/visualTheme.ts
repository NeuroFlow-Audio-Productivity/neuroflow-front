import { defineStore } from 'pinia'

const THEME_KEY = 'neuroflow-visual-mode'
const PALETTE_KEY = 'neuroflow-color-palette'

export const visualModeConfigs = [
  {
    key: 'focus',
    frequency: '14 Hz',
    accent: '#6ee7d8',
    soft: '#d9fff8',
    ink: '#09231f',
    glowRgb: '110, 231, 216',
    companionRgb: '185, 167, 255',
    progress: 72,
    icon: 'pi pi-bolt',
  },
  {
    key: 'relax',
    frequency: '6 Hz',
    accent: '#f6c177',
    soft: '#fff0d6',
    ink: '#2f1c08',
    glowRgb: '246, 193, 119',
    companionRgb: '110, 231, 216',
    progress: 48,
    icon: 'pi pi-sparkles',
  },
  {
    key: 'sleep',
    frequency: '2 Hz',
    accent: '#b9a7ff',
    soft: '#ebe6ff',
    ink: '#17102f',
    glowRgb: '185, 167, 255',
    companionRgb: '110, 231, 216',
    progress: 31,
    icon: 'pi pi-moon',
  },
] as const

export type VisualModeConfig = (typeof visualModeConfigs)[number]
export type VisualModeKey = VisualModeConfig['key']

export const visualPaletteConfigs = [
  {
    key: 'focus',
    accent: '#6ee7d8',
    soft: '#d9fff8',
    ink: '#09231f',
    glowRgb: '110, 231, 216',
    companionRgb: '185, 167, 255',
    icon: 'pi pi-bolt',
  },
  {
    key: 'relax',
    accent: '#f6c177',
    soft: '#fff0d6',
    ink: '#2f1c08',
    glowRgb: '246, 193, 119',
    companionRgb: '110, 231, 216',
    icon: 'pi pi-sparkles',
  },
  {
    key: 'sleep',
    accent: '#b9a7ff',
    soft: '#ebe6ff',
    ink: '#17102f',
    glowRgb: '185, 167, 255',
    companionRgb: '110, 231, 216',
    icon: 'pi pi-moon',
  },
  {
    key: 'deepSpace',
    accent: '#5ab8ff',
    soft: '#d7ecff',
    ink: '#061a2f',
    glowRgb: '90, 184, 255',
    companionRgb: '118, 94, 255',
    icon: 'pi pi-globe',
  },
] as const

export type VisualPaletteConfig = (typeof visualPaletteConfigs)[number]
export type VisualPaletteKey = VisualPaletteConfig['key']

const storage = () => (typeof localStorage === 'undefined' ? undefined : localStorage)

const isVisualModeKey = (value: string | null | undefined): value is VisualModeKey =>
  visualModeConfigs.some((mode) => mode.key === value)

const isVisualPaletteKey = (value: string | null | undefined): value is VisualPaletteKey =>
  visualPaletteConfigs.some((palette) => palette.key === value)

const readVisualMode = (): VisualModeKey => {
  const storedMode = storage()?.getItem(THEME_KEY)

  return isVisualModeKey(storedMode) ? storedMode : 'focus'
}

const readVisualPalette = (): VisualPaletteKey => {
  const store = storage()
  const storedPalette = store?.getItem(PALETTE_KEY)
  const storedMode = store?.getItem(THEME_KEY)

  if (isVisualPaletteKey(storedPalette)) return storedPalette
  if (isVisualPaletteKey(storedMode)) return storedMode

  return 'focus'
}

const modeByKey = (key: VisualModeKey) =>
  visualModeConfigs.find((mode) => mode.key === key) ?? visualModeConfigs[0]

const paletteByKey = (key: VisualPaletteKey) =>
  visualPaletteConfigs.find((palette) => palette.key === key) ?? visualPaletteConfigs[0]

export const useVisualThemeStore = defineStore('visualTheme', {
  state: () => ({
    selectedMode: readVisualMode(),
    selectedPalette: readVisualPalette(),
  }),

  getters: {
    modes: () => visualModeConfigs,
    palettes: () => visualPaletteConfigs,

    activeMode: (state): VisualModeConfig => modeByKey(state.selectedMode),
    activePalette: (state): VisualPaletteConfig => paletteByKey(state.selectedPalette),

    cssVars(): Record<string, string> {
      const palette = this.activePalette

      return {
        '--mode-accent': palette.accent,
        '--mode-soft': palette.soft,
        '--mode-ink': palette.ink,
        '--mode-glow-rgb': palette.glowRgb,
        '--mode-companion-rgb': palette.companionRgb,
      }
    },
  },

  actions: {
    setMode(mode: VisualModeKey) {
      if (!isVisualModeKey(mode)) return

      this.selectedMode = mode
      storage()?.setItem(THEME_KEY, mode)
    },

    setPalette(palette: VisualPaletteKey) {
      if (!isVisualPaletteKey(palette)) return

      this.selectedPalette = palette
      storage()?.setItem(PALETTE_KEY, palette)
    },

    applyDocumentTheme() {
      if (typeof document === 'undefined') return

      Object.entries(this.cssVars).forEach(([name, value]) => {
        document.documentElement.style.setProperty(name, value)
      })

      document.documentElement.dataset.visualMode = this.selectedMode
      document.documentElement.dataset.visualPalette = this.selectedPalette
    },
  },
})
