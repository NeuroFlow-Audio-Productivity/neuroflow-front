import { apiRequest } from '@/services/authApi'
import type { FlowNode } from '@/types/flow'

export type FlowNodesResponse = {
  data: FlowNode[]
}

export type FlowNodePayload = {
  title: string
  flow_id: number | string
  mode_id: number | string
  end_audio_id: number | string | null
  order: number
  time: number
}

export type StoreFlowNodePayload = FlowNodePayload

export type UpdateFlowNodePayload = FlowNodePayload

const flowNodePath = (id: string | number) => '/flow-nodes/' + encodeURIComponent(String(id))
const flowNodePayload = (node: FlowNode): FlowNodePayload => ({
  title: node.title,
  flow_id: node.flow_id,
  mode_id: node.mode_id,
  end_audio_id: node.end_audio_id,
  order: node.order,
  time: node.time,
})

export const flowNodeApi = {
  listFlowNodes: (token: string, flow: string | number) =>
    apiRequest<FlowNodesResponse>('/flow-nodes', {
      token,
      query: { flow_id: flow, pagination_amount: 1000 },
    }),

  createFlowNode: (token: string, payload: StoreFlowNodePayload) =>
    apiRequest<FlowNode>('/flow-nodes', {
      method: 'POST',
      token,
      body: payload,
    }),

  getFlowNode: (token: string, flowNode: string | number) =>
    apiRequest<FlowNode>(flowNodePath(flowNode), {
      token,
    }),

  updateFlowNode: (token: string, flowNode: string | number, payload: UpdateFlowNodePayload) =>
    apiRequest<FlowNode>(flowNodePath(flowNode), {
      method: 'PUT',
      token,
      body: payload,
    }),

  deleteFlowNode: (token: string, flowNode: string | number) =>
    apiRequest<null>(flowNodePath(flowNode), {
      method: 'DELETE',
      token,
    }),

  reorderFlowNodes: (token: string, nodes: FlowNode[]) =>
    Promise.all(
      nodes.map((node, index) =>
        flowNodeApi.updateFlowNode(token, node.id, {
          ...flowNodePayload(node),
          order: index + 1,
        }),
      ),
    ),
}
