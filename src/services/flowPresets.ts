export type FlowCategoryKey = 'focus' | 'unwind' | 'sleep'

export type FlowSuggestion = {
  key: string
  emoji: string
  labelKey: string
  custom?: boolean
}

export type FlowCategory = {
  key: FlowCategoryKey
  emoji: string
  icon: string
  accent: string
  accentRgb: string
  labelKey: string
  descriptionKey: string
  suggestions: FlowSuggestion[]
}

const suggestion = (
  key: string,
  emoji: string,
  labelKey: string,
  custom = false,
): FlowSuggestion => ({
  key,
  emoji,
  labelKey,
  custom,
})

export const flowCategories: FlowCategory[] = [
  {
    key: 'focus',
    emoji: '🧠',
    icon: 'pi pi-bolt',
    accent: '#6ee7d8',
    accentRgb: '110, 231, 216',
    labelKey: 'flowResource.categories.focus.label',
    descriptionKey: 'flowResource.categories.focus.description',
    suggestions: [
      suggestion('programming', '💻', 'flowResource.suggestions.programming'),
      suggestion('languages', '🌍', 'flowResource.suggestions.languages'),
      suggestion('study', '📚', 'flowResource.suggestions.study'),
      suggestion('exams', '📝', 'flowResource.suggestions.exams'),
      suggestion('medicine', '🩺', 'flowResource.suggestions.medicine'),
      suggestion('reading', '📖', 'flowResource.suggestions.reading'),
      suggestion('writing', '✍️', 'flowResource.suggestions.writing'),
      suggestion('design', '🎨', 'flowResource.suggestions.design'),
      suggestion('business', '📊', 'flowResource.suggestions.business'),
      suggestion('mathematics', '🧮', 'flowResource.suggestions.mathematics'),
      suggestion('science', '🔬', 'flowResource.suggestions.science'),
      suggestion('musicPractice', '🎵', 'flowResource.suggestions.musicPractice'),
      suggestion('chess', '♟️', 'flowResource.suggestions.chess'),
      suggestion('fitnessTheory', '🏋️', 'flowResource.suggestions.fitnessTheory'),
      suggestion('work', '💼', 'flowResource.suggestions.work'),
      suggestion('deepWork', '🧠', 'flowResource.suggestions.deepWork'),
      suggestion('sideProject', '🚀', 'flowResource.suggestions.sideProject'),
      suggestion('productivity', '📂', 'flowResource.suggestions.productivity'),
      suggestion('custom', '✨', 'flowResource.suggestions.custom', true),
    ],
  },
  {
    key: 'unwind',
    emoji: '🌙',
    icon: 'pi pi-sparkles',
    accent: '#f6c177',
    accentRgb: '246, 193, 119',
    labelKey: 'flowResource.categories.unwind.label',
    descriptionKey: 'flowResource.categories.unwind.description',
    suggestions: [
      suggestion('gaming', '🎮', 'flowResource.suggestions.gaming'),
      suggestion('watching', '🎬', 'flowResource.suggestions.watching'),
      suggestion('listeningToMusic', '🎵', 'flowResource.suggestions.listeningToMusic'),
      suggestion('chill', '☕', 'flowResource.suggestions.chill'),
      suggestion('socialMedia', '📱', 'flowResource.suggestions.socialMedia'),
      suggestion('relaxing', '🛋️', 'flowResource.suggestions.relaxing'),
      suggestion('walk', '🚶', 'flowResource.suggestions.walk'),
      suggestion('meditation', '🧘', 'flowResource.suggestions.meditation'),
      suggestion('nightRoutine', '🌌', 'flowResource.suggestions.nightRoutine'),
      suggestion('hangingOut', '💬', 'flowResource.suggestions.hangingOut'),
      suggestion('movies', '🍿', 'flowResource.suggestions.movies'),
      suggestion('creativeTime', '🎨', 'flowResource.suggestions.creativeTime'),
      suggestion('custom', '✨', 'flowResource.suggestions.custom', true),
    ],
  },
  {
    key: 'sleep',
    emoji: '😴',
    icon: 'pi pi-moon',
    accent: '#b9a7ff',
    accentRgb: '185, 167, 255',
    labelKey: 'flowResource.categories.sleep.label',
    descriptionKey: 'flowResource.categories.sleep.description',
    suggestions: [
      suggestion('deepSleep', '🌙', 'flowResource.suggestions.deepSleep'),
      suggestion('nap', '😴', 'flowResource.suggestions.nap'),
      suggestion('quickRest', '💤', 'flowResource.suggestions.quickRest'),
      suggestion('rainSounds', '🌧️', 'flowResource.suggestions.rainSounds'),
      suggestion('sleepMusic', '🎵', 'flowResource.suggestions.sleepMusic'),
      suggestion('bedtimeReading', '📖', 'flowResource.suggestions.bedtimeReading'),
      suggestion('windDown', '🧘', 'flowResource.suggestions.windDown'),
      suggestion('nightRoutine', '🌌', 'flowResource.suggestions.nightRoutine'),
      suggestion('custom', '✨', 'flowResource.suggestions.custom', true),
    ],
  },
]

export const flowCategoryByKey = (key: FlowCategoryKey | null | undefined) =>
  flowCategories.find((category) => category.key === key) ?? null

const normalizeName = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\u3040-\u30ff\u3400-\u9fff]+/g, ' ')
    .trim()

export const flowCategoryKeyFromName = (name: string): FlowCategoryKey => {
  const normalized = normalizeName(name)

  if (
    /(?:\b(sleep|nap|rest|rain|bedtime|sono|dormir|sue[nn]o|siesta|descanso)\b|眠|睡|昼寝|雨音|休息)/.test(
      normalized,
    )
  ) {
    return 'sleep'
  }

  if (
    /(?:\b(gaming|game|watching|music|chill|social|relax|walk|meditation|movie|creative|jogo|filme|relajar|relaxar)\b|ゲーム|視聴|音楽|チル|散歩|瞑想|映画|創作|リラックス|くつろぎ|交流)/.test(
      normalized,
    )
  ) {
    return 'unwind'
  }

  return 'focus'
}

export const flowCategoryStyle = (categoryKey: FlowCategoryKey) => {
  const category = flowCategoryByKey(categoryKey) ?? flowCategories[0]!

  return {
    '--flow-accent': category.accent,
    '--flow-accent-rgb': category.accentRgb,
  }
}
