import { apiRequest } from '@/services/authApi'
import type { Audio } from '@/types/audio'
import type { PaginatedResponse, PaginationQuery } from '@/types/pagination'

export type AudiosResponse = PaginatedResponse<Audio>

export type AudiosAllResponse = {
  data: Audio[]
}

export type StoreAudioPayload = {
  name: string
  mode_id?: number | null
  file: File
}

export type UpdateAudioPayload = {
  name?: string
  mode_id?: number | null
  file?: File | null
}

const audioPath = (id: string | number) => `/audios/${encodeURIComponent(String(id))}`

const createAudioFormData = (
  payload: StoreAudioPayload | UpdateAudioPayload,
  methodOverride?: 'PUT',
) => {
  const formData = new FormData()

  if (methodOverride) formData.set('_method', methodOverride)
  if (payload.name !== undefined) formData.set('name', payload.name)
  if (payload.mode_id !== undefined) {
    formData.set('mode_id', payload.mode_id === null ? '' : String(payload.mode_id))
  }
  if (payload.file) formData.set('file', payload.file)

  return formData
}

export const audioSourceUrl = (audio: Pick<Audio, 'url'> | null | undefined) => audio?.url ?? ''

const AUDIO_URL_REFRESH_BUFFER_SECONDS = 60

export const audioSourceNeedsRefresh = (audio: Pick<Audio, 'url'> | null | undefined) => {
  const source = audioSourceUrl(audio)

  if (!source) return true

  try {
    const expires = Number(new URL(source, window.location.origin).searchParams.get('expires'))

    if (!Number.isFinite(expires) || expires <= 0) return true

    return expires * 1000 <= Date.now() + AUDIO_URL_REFRESH_BUFFER_SECONDS * 1000
  } catch {
    return true
  }
}

export const audioApi = {
  listAudios: (token?: string | null, query: PaginationQuery = {}) =>
    apiRequest<AudiosResponse>('/audios', {
      token,
      query,
    }),

  listAllAudios: (token?: string | null) =>
    apiRequest<AudiosAllResponse>('/audios/all', {
      token,
    }),

  listAudiosForMode: (
    token: string | null | undefined,
    mode: string | number,
    query: PaginationQuery = {},
  ) =>
    apiRequest<AudiosResponse>(`/modes/${encodeURIComponent(String(mode))}/audios`, {
      token,
      query,
    }),

  createAudio: (token: string, payload: StoreAudioPayload) =>
    apiRequest<Audio>('/audios', {
      method: 'POST',
      token,
      body: createAudioFormData(payload),
    }),

  getAudio: (token: string, audio: string | number) =>
    apiRequest<Audio>(audioPath(audio), {
      token,
    }),

  updateAudio: (token: string, audio: string | number, payload: UpdateAudioPayload) =>
    apiRequest<Audio>(audioPath(audio), {
      method: 'POST',
      token,
      body: createAudioFormData(payload, 'PUT'),
    }),

  deleteAudio: (token: string, audio: string | number) =>
    apiRequest<null>(audioPath(audio), {
      method: 'DELETE',
      token,
    }),
}
