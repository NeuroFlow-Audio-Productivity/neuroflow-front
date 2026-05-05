import { apiRequest } from '@/services/authApi'
import type { Profile, User } from '@/types/auth'

export type UsersResponse = {
  data: User[]
}

export type ProfilesResponse = {
  data: Profile[]
}

export type StoreUserPayload = {
  name: string
  email: string
  password: string
  password_confirmation: string
  profile_id?: number | null
  email_verified_at?: string | null
}

export type UpdateUserPayload = {
  name?: string
  password?: string
  password_confirmation?: string
  profile_id?: number | null
  email?: string
  email_verified_at?: string | null
}

const userPath = (id: string | number) => `/users/${encodeURIComponent(String(id))}`

export const userApi = {
  listUsers: (token: string) =>
    apiRequest<UsersResponse>('/users', {
      token,
    }),

  createUser: (token: string, payload: StoreUserPayload) =>
    apiRequest<User>('/users', {
      method: 'POST',
      token,
      body: payload,
    }),

  getUser: (token: string, user: string | number) =>
    apiRequest<User>(userPath(user), {
      token,
    }),

  updateUser: (token: string, user: string | number, payload: UpdateUserPayload) =>
    apiRequest<User>(userPath(user), {
      method: 'PUT',
      token,
      body: payload,
    }),

  deleteUser: (token: string, user: string | number) =>
    apiRequest<null>(userPath(user), {
      method: 'DELETE',
      token,
    }),

  listProfiles: (token: string) =>
    apiRequest<ProfilesResponse>('/profiles', {
      token,
    }),
}
