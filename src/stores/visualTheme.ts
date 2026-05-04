import { defineStore } from 'pinia'

const THEME_KEY = 'neuroflow-visual-mode'

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

const storage = () => (typeof localStorage === 'undefined' ? undefined : localStorage)

const isVisualModeKey = (value: string | null | undefined): value is VisualModeKey =>
  visualModeConfigs.some((mode) => mode.key === value)

const readVisualMode = (): VisualModeKey => {
  const storedMode = storage()?.getItem(THEME_KEY)

  return isVisualModeKey(storedMode) ? storedMode : 'focus'
}

const modeByKey = (key: VisualModeKey) =>
  visualModeConfigs.find((mode) => mode.key === key) ?? visualModeConfigs[0]

export const useVisualThemeStore = defineStore('visualTheme', {
  state: () => ({
    selectedMode: readVisualMode(),
  }),

  getters: {
    modes: () => visualModeConfigs,

    activeMode: (state): VisualModeConfig => modeByKey(state.selectedMode),

    cssVars(): Record<string, string> {
      const mode = this.activeMode

      return {
        '--mode-accent': mode.accent,
        '--mode-soft': mode.soft,
        '--mode-ink': mode.ink,
        '--mode-glow-rgb': mode.glowRgb,
        '--mode-companion-rgb': mode.companionRgb,
      }
    },
  },

  actions: {
    setMode(mode: VisualModeKey) {
      if (!isVisualModeKey(mode)) return

      this.selectedMode = mode
      storage()?.setItem(THEME_KEY, mode)
    },

    applyDocumentTheme() {
      if (typeof document === 'undefined') return

      Object.entries(this.cssVars).forEach(([name, value]) => {
        document.documentElement.style.setProperty(name, value)
      })

      document.documentElement.dataset.visualMode = this.selectedMode
    },
  },
})
