import { flowCategoryKeyFromName } from '@/services/flowPresets'
import { modeSemanticKey, type ModeSemanticKey } from '@/services/modeVisuals'
import type { Flow, FlowNode } from '@/types/flow'
import type { Mode } from '@/types/mode'

export type FlowNodeTitleFlowType = 'focus' | 'relaxation' | 'sleep'
export type FlowNodeTitleMode = 'focus' | 'relaxation' | 'sleep'
export type FlowNodeTitleSuggestionKey =
  (typeof NODE_TITLE_SUGGESTIONS)[FlowNodeTitleFlowType][FlowNodeTitleMode][number]

const MAX_NODE_TITLE_LENGTH = 255

const NODE_TITLE_SUGGESTIONS: Record<FlowNodeTitleFlowType, Record<FlowNodeTitleMode, string[]>> = {
  focus: {
    focus: [
      'studySession',
      'focusSession',
      'deepWorkSession',
      'learningBlock',
      'concentrationBlock',
    ],
    relaxation: [
      'shortBreak',
      'recoveryBreak',
      'mentalReset',
      'longBreak',
      'quickRecharge',
      'pause',
    ],
    sleep: ['powerNap', 'recoveryNap', 'restBlock', 'sleepReset', 'deepRest'],
  },
  relaxation: {
    relaxation: [
      'relaxationSession',
      'breathingSession',
      'calmSession',
      'mindfulSession',
      'unwindSession',
    ],
    focus: [
      'attentionExercise',
      'reflectionExercise',
      'mindfulFocus',
      'journaling',
      'clarityPractice',
    ],
    sleep: ['sleepPreparation', 'windDown', 'nightRoutine', 'sleepTransition', 'eveningReset'],
  },
  sleep: {
    sleep: ['sleepPhase', 'sleepCycle', 'nightPhase', 'deepSleepBlock', 'restPhase'],
    relaxation: [
      'windDown',
      'relaxationPhase',
      'bodyRelaxation',
      'breathingPhase',
      'sleepPreparation',
    ],
    focus: ['mentalClearing', 'reflection', 'brainDump', 'mindReset', 'thoughtRelease'],
  },
}

const normalizeTitleText = (value: string) => value.trim().replace(/\s+/g, ' ')
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const generatedBaseTitle = (value: string) => normalizeTitleText(value).replace(/ \d+$/, '')

export const flowTypeFromFlow = (flow: Pick<Flow, 'name'>): FlowNodeTitleFlowType => {
  const category = flowCategoryKeyFromName(flow.name)

  return category === 'unwind' ? 'relaxation' : category
}

export const nodeTitleModeFromSemanticKey = (
  key: ModeSemanticKey | null | undefined,
): FlowNodeTitleMode => {
  if (key === 'relax') return 'relaxation'
  if (key === 'sleep') return 'sleep'
  return 'focus'
}

export const nodeTitleModeFromMode = (mode: Mode | null | undefined): FlowNodeTitleMode =>
  nodeTitleModeFromSemanticKey(modeSemanticKey(mode))

export const getNodeTitleSuggestions = (
  flowType: FlowNodeTitleFlowType,
  nodeMode: FlowNodeTitleMode,
) => NODE_TITLE_SUGGESTIONS[flowType][nodeMode]

export const getNodeTitleSuggestionsForMode = (flow: Pick<Flow, 'name'>, mode: Mode) =>
  getNodeTitleSuggestions(flowTypeFromFlow(flow), nodeTitleModeFromMode(mode))

export const isGeneratedNodeTitle = (title: string, generatedTitles: string[]) =>
  generatedTitles.includes(generatedBaseTitle(title))

const numberedTitle = (title: string, suffix: number) => {
  const suffixText = ' ' + suffix

  return title.slice(0, MAX_NODE_TITLE_LENGTH - suffixText.length) + suffixText
}

export const ensureUniqueNodeTitle = (title: string, existingNodes: Pick<FlowNode, 'title'>[]) => {
  const baseTitle = normalizeTitleText(title)
  const fallbackTitle = (baseTitle || 'Section').slice(0, MAX_NODE_TITLE_LENGTH)
  const titlePattern = new RegExp('^' + escapeRegex(fallbackTitle) + '(?: (\\d+))?$')
  let highestSuffix = 0
  let hasBaseTitle = false

  existingNodes.forEach((node) => {
    const match = normalizeTitleText(node.title ?? '').match(titlePattern)

    if (!match) return
    if (match[1] === undefined) {
      hasBaseTitle = true
      highestSuffix = Math.max(highestSuffix, 1)
      return
    }

    highestSuffix = Math.max(highestSuffix, Number(match[1]))
  })

  return hasBaseTitle || highestSuffix > 0
    ? numberedTitle(fallbackTitle, highestSuffix + 1)
    : fallbackTitle
}
