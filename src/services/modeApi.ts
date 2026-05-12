import { apiRequest } from '@/services/authApi'
import type { Mode } from '@/types/mode'

export type ModesResponse = {
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
  listModes: (token: string) =>
    apiRequest<ModesResponse>('/modes', {
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
