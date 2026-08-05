import { apiRequest } from '@/services/authApi'
import type { Flow } from '@/types/flow'

export type FlowsResponse = {
  data: Flow[]
}

export type StoreFlowPayload = {
  name: string
}

export type UpdateFlowPayload = StoreFlowPayload

const flowPath = (id: string | number) => `/flows/${encodeURIComponent(String(id))}`

export const flowApi = {
  listFlows: (token: string) =>
    apiRequest<FlowsResponse>('/flows', {
      token,
    }),

  createFlow: (token: string, payload: StoreFlowPayload) =>
    apiRequest<Flow>('/flows', {
      method: 'POST',
      token,
      body: payload,
    }),

  getFlow: (token: string, flow: string | number) =>
    apiRequest<Flow>(flowPath(flow), {
      token,
    }),

  updateFlow: (token: string, flow: string | number, payload: UpdateFlowPayload) =>
    apiRequest<Flow>(flowPath(flow), {
      method: 'PUT',
      token,
      body: payload,
    }),

  deleteFlow: (token: string, flow: string | number) =>
    apiRequest<null>(flowPath(flow), {
      method: 'DELETE',
      token,
    }),
}
