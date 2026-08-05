import type { Audio } from '@/types/audio'
import type { Flow, FlowNode } from '@/types/flow'
import type { Mode } from '@/types/mode'

export type FlowSession = {
  flow: Flow
  nodes: FlowNode[]
}

export type FlowExecutionState = {
  flowId: number
  currentNodeIndex: number
  completedNodeIds: number[]
  remainingSeconds: number
  isComplete: boolean
}

export type PersistedFlowExecutionState = Partial<FlowExecutionState> & {
  flowId?: number
}

export type FlowSectionView = {
  id: number
  title: string
  order: number
  mode: Mode | null
  modeName: string
  minutes: number
  isActive: boolean
  isComplete: boolean
}

const clampNodeIndex = (index: number, nodes: FlowNode[]) =>
  Math.min(
    Math.max(0, Math.floor(Number.isFinite(index) ? index : 0)),
    Math.max(0, nodes.length - 1),
  )

export const sortFlowNodes = (nodes: FlowNode[]) =>
  [...nodes].sort((first, second) => {
    if (first.order !== second.order) return first.order - second.order

    return first.id - second.id
  })

export const nodeDurationSeconds = (node: FlowNode | null | undefined) =>
  Math.max(1, Math.round(Number(node?.time ?? 1))) * 60

export const createFlowExecutionState = (
  session: FlowSession,
  persisted?: PersistedFlowExecutionState | null,
): FlowExecutionState => {
  const nodes = session.nodes
  const currentNodeIndex =
    persisted?.flowId === session.flow.id
      ? clampNodeIndex(persisted.currentNodeIndex ?? 0, nodes)
      : 0
  const node = nodes[currentNodeIndex] ?? null
  const completedNodeIds =
    persisted?.flowId === session.flow.id && Array.isArray(persisted.completedNodeIds)
      ? persisted.completedNodeIds.filter((id) => nodes.some((node) => node.id === id))
      : []
  const remainingSeconds =
    persisted?.flowId === session.flow.id &&
    typeof persisted.remainingSeconds === 'number' &&
    persisted.remainingSeconds > 0
      ? Math.min(nodeDurationSeconds(node), Math.floor(persisted.remainingSeconds))
      : nodeDurationSeconds(node)

  return {
    flowId: session.flow.id,
    currentNodeIndex,
    completedNodeIds,
    remainingSeconds,
    isComplete:
      persisted?.flowId === session.flow.id &&
      Boolean(persisted.isComplete) &&
      nodes.length > 0 &&
      completedNodeIds.length >= nodes.length,
  }
}

export const restartFlowExecutionState = (session: FlowSession): FlowExecutionState => ({
  flowId: session.flow.id,
  currentNodeIndex: 0,
  completedNodeIds: [],
  remainingSeconds: nodeDurationSeconds(session.nodes[0]),
  isComplete: false,
})

export const completeCurrentFlowNode = (
  state: FlowExecutionState,
  session: FlowSession,
): FlowExecutionState => {
  const currentNode = session.nodes[state.currentNodeIndex]

  if (!currentNode) return state

  const completedNodeIds = state.completedNodeIds.includes(currentNode.id)
    ? state.completedNodeIds
    : [...state.completedNodeIds, currentNode.id]
  const nextIndex = state.currentNodeIndex + 1
  const isComplete = nextIndex >= session.nodes.length
  const nextNode = session.nodes[nextIndex]

  return {
    flowId: session.flow.id,
    currentNodeIndex: isComplete ? state.currentNodeIndex : nextIndex,
    completedNodeIds,
    remainingSeconds: isComplete ? 0 : nodeDurationSeconds(nextNode),
    isComplete,
  }
}

export const flowProgressPercent = (state: FlowExecutionState | null, totalNodes: number) => {
  if (!state || totalNodes <= 0) return 0

  return Math.min(100, Math.max(0, (state.completedNodeIds.length / totalNodes) * 100))
}

export const resolveFlowNodeMode = (node: FlowNode | null | undefined, modes: Mode[]) =>
  modes.find((mode) => mode.id === Number(node?.mode_id)) ?? node?.mode ?? null

export const resolveFlowNodeEndAudio = (node: FlowNode | null | undefined, audios: Audio[]) => {
  if (!node) return null
  if (node.end_audio) return node.end_audio
  if (node.end_sound_alarm) return node.end_sound_alarm

  return audios.find((audio) => String(audio.id) === String(node.end_audio_id)) ?? null
}

export const flowSectionViews = (
  session: FlowSession,
  state: FlowExecutionState | null,
  modes: Mode[],
): FlowSectionView[] =>
  session.nodes.map((node, index) => {
    const mode = resolveFlowNodeMode(node, modes)

    return {
      id: node.id,
      title: node.title,
      order: node.order,
      mode,
      modeName: mode?.name ?? '',
      minutes: Math.max(1, Math.round(Number(node.time) || 1)),
      isActive: Boolean(state && !state.isComplete && state.currentNodeIndex === index),
      isComplete: Boolean(state?.completedNodeIds.includes(node.id)),
    }
  })
