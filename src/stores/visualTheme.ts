import { defineStore } from 'pinia'

const THEME_KEY = 'neuroflow-visual-mode'
const PALETTE_KEY = 'neuroflow-color-palette'
const FAST_MODE_KEY = 'neuroflow-fast-mode'

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
    page: '#06100e',
    pageAlt: '#081512',
    surfaceRgb: '7, 16, 14',
    surfaceRaisedRgb: '15, 29, 26',
    textRgb: '247, 251, 248',
    borderRgb: '226, 255, 247',
    shadowRgb: '0, 0, 0',
    tone: 'dark',
    icon: 'pi pi-bolt',
  },
  {
    key: 'relax',
    accent: '#f6c177',
    soft: '#fff0d6',
    ink: '#2f1c08',
    glowRgb: '246, 193, 119',
    companionRgb: '110, 231, 216',
    page: '#100d08',
    pageAlt: '#19140b',
    surfaceRgb: '22, 18, 10',
    surfaceRaisedRgb: '36, 29, 17',
    textRgb: '255, 249, 239',
    borderRgb: '255, 232, 197',
    shadowRgb: '13, 9, 3',
    tone: 'dark',
    icon: 'pi pi-sparkles',
  },
  {
    key: 'sleep',
    accent: '#b9a7ff',
    soft: '#ebe6ff',
    ink: '#17102f',
    glowRgb: '185, 167, 255',
    companionRgb: '110, 231, 216',
    page: '#090813',
    pageAlt: '#111021',
    surfaceRgb: '15, 14, 28',
    surfaceRaisedRgb: '27, 24, 47',
    textRgb: '249, 247, 255',
    borderRgb: '231, 225, 255',
    shadowRgb: '3, 2, 10',
    tone: 'dark',
    icon: 'pi pi-moon',
  },
  {
    key: 'deepSpace',
    accent: '#5ab8ff',
    soft: '#d7ecff',
    ink: '#061a2f',
    glowRgb: '90, 184, 255',
    companionRgb: '118, 94, 255',
    page: '#050a13',
    pageAlt: '#071424',
    surfaceRgb: '7, 14, 27',
    surfaceRaisedRgb: '13, 27, 47',
    textRgb: '244, 249, 255',
    borderRgb: '211, 234, 255',
    shadowRgb: '1, 4, 10',
    tone: 'dark',
    icon: 'pi pi-globe',
  },
  {
    key: 'nocturne',
    accent: '#a8b3bd',
    soft: '#f2f5f7',
    ink: '#101820',
    glowRgb: '168, 179, 189',
    companionRgb: '80, 94, 108',
    page: '#090b0e',
    pageAlt: '#12161b',
    surfaceRgb: '16, 20, 25',
    surfaceRaisedRgb: '27, 33, 40',
    textRgb: '245, 247, 249',
    borderRgb: '214, 222, 229',
    shadowRgb: '0, 0, 0',
    tone: 'dark',
    icon: 'pi pi-circle',
  },
  {
    key: 'cleanLab',
    accent: '#74d8e4',
    soft: '#f5feff',
    ink: '#073238',
    glowRgb: '116, 216, 228',
    companionRgb: '186, 229, 240',
    page: '#edf5f4',
    pageAlt: '#f8fbfb',
    surfaceRgb: '255, 255, 255',
    surfaceRaisedRgb: '235, 245, 246',
    textRgb: '18, 39, 42',
    borderRgb: '30, 82, 87',
    shadowRgb: '42, 76, 80',
    tone: 'light',
    icon: 'pi pi-asterisk',
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

const readFastMode = () => storage()?.getItem(FAST_MODE_KEY) === 'true'

const modeByKey = (key: VisualModeKey) =>
  visualModeConfigs.find((mode) => mode.key === key) ?? visualModeConfigs[0]

const paletteByKey = (key: VisualPaletteKey) =>
  visualPaletteConfigs.find((palette) => palette.key === key) ?? visualPaletteConfigs[0]

export const useVisualThemeStore = defineStore('visualTheme', {
  state: () => ({
    selectedMode: readVisualMode(),
    selectedPalette: readVisualPalette(),
    fastModeEnabled: readFastMode(),
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
        '--theme-page': palette.page,
        '--theme-page-alt': palette.pageAlt,
        '--theme-surface-rgb': palette.surfaceRgb,
        '--theme-surface-raised-rgb': palette.surfaceRaisedRgb,
        '--theme-text-rgb': palette.textRgb,
        '--theme-border-rgb': palette.borderRgb,
        '--theme-shadow-rgb': palette.shadowRgb,
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

    setFastMode(enabled: boolean) {
      this.fastModeEnabled = enabled
      storage()?.setItem(FAST_MODE_KEY, String(enabled))
    },

    applyDocumentTheme() {
      if (typeof document === 'undefined') return

      Object.entries(this.cssVars).forEach(([name, value]) => {
        document.documentElement.style.setProperty(name, value)
      })

      document.documentElement.dataset.visualMode = this.selectedMode
      document.documentElement.dataset.visualPalette = this.selectedPalette
      document.documentElement.dataset.themeTone = this.activePalette.tone
      document.documentElement.dataset.fastMode = String(this.fastModeEnabled)
      document.documentElement.classList.toggle('dark', this.activePalette.tone === 'dark')
    },
  },
})
