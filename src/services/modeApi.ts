import { apiRequest } from '@/services/authApi'
import type { Mode } from '@/types/mode'
import type { PaginatedResponse, PaginationQuery } from '@/types/pagination'

export type ModesResponse = PaginatedResponse<Mode>

export type ModesAllResponse = {
  data: Mode[]
}

export type StoreModePayload = {
  name: string
  description: string
  color: string
}

export type UpdateModePayload = StoreModePayload

const modePath = (id: string | number) => `/modes/${encodeURIComponent(String(id))}`

export const modeApi = {
  listModes: (token?: string | null, query: PaginationQuery = {}) =>
    apiRequest<ModesResponse>('/modes', {
      token,
      query,
    }),

  listAllModes: (token?: string | null) =>
    apiRequest<ModesAllResponse>('/modes/all', {
      token,
    }),

  createMode: (token: string, payload: StoreModePayload) =>
    apiRequest<Mode>('/modes', {
      method: 'POST',
      token,
      body: payload,
    }),

  getMode: (token: string, mode: string | number) =>
    apiRequest<Mode>(modePath(mode), {
      token,
    }),

  updateMode: (token: string, mode: string | number, payload: UpdateModePayload) =>
    apiRequest<Mode>(modePath(mode), {
      method: 'PUT',
      token,
      body: payload,
    }),

  deleteMode: (token: string, mode: string | number) =>
    apiRequest<null>(modePath(mode), {
      method: 'DELETE',
      token,
    }),
}
