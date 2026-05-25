import { flowCategoryKeyFromName } from '@/services/flowPresets'
import { modeSemanticKey, type ModeSemanticKey } from '@/services/modeVisuals'
import type { Flow, FlowNode } from '@/types/flow'
import type { Mode } from '@/types/mode'

export type FlowNodeTitleFlowType = 'focus' | 'relaxation' | 'sleep'
export type FlowNodeTitleMode = 'focus' | 'relaxation' | 'sleep'

const MAX_NODE_TITLE_LENGTH = 255

const NODE_TITLE_SUGGESTIONS: Record<FlowNodeTitleFlowType, Record<FlowNodeTitleMode, string[]>> = {
  focus: {
    focus: [
      'Study Session',
      'Focus Session',
      'Deep Work Session',
      'Learning Block',
      'Concentration Block',
    ],
    relaxation: [
      'Short Break',
      'Recovery Break',
      'Mental Reset',
      'Long Break',
      'Quick Recharge',
      'Pause',
    ],
    sleep: ['Power Nap', 'Recovery Nap', 'Rest Block', 'Sleep Reset', 'Deep Rest'],
  },
  relaxation: {
    relaxation: [
      'Relaxation Session',
      'Breathing Session',
      'Calm Session',
      'Mindful Session',
      'Unwind Session',
    ],
    focus: [
      'Attention Exercise',
      'Reflection Exercise',
      'Mindful Focus',
      'Journaling',
      'Clarity Practice',
    ],
    sleep: ['Sleep Preparation', 'Wind Down', 'Night Routine', 'Sleep Transition', 'Evening Reset'],
  },
  sleep: {
    sleep: ['Sleep Phase', 'Sleep Cycle', 'Night Phase', 'Deep Sleep Block', 'Rest Phase'],
    relaxation: [
      'Wind Down',
      'Relaxation Phase',
      'Body Relaxation',
      'Breathing Phase',
      'Sleep Preparation',
    ],
    focus: ['Mental Clearing', 'Reflection', 'Brain Dump', 'Mind Reset', 'Thought Release'],
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

export const isGeneratedNodeTitle = (
  title: string,
  flow: Pick<Flow, 'name'>,
  mode: Mode | null | undefined,
) => {
  if (!mode) return false

  return getNodeTitleSuggestionsForMode(flow, mode).includes(generatedBaseTitle(title))
}

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
