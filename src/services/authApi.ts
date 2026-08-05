import type {
  ForgotPasswordPayload,
  GoogleCallbackPayload,
  GoogleRedirectQuery,
  GoogleRedirectResponse,
  LoginPayload,
  LoginResponse,
  MessageResponse,
  ProfileItemsResponse,
  RegisterPayload,
  ResendVerificationPayload,
  ResetPasswordPayload,
  ResetPasswordTokenResponse,
  User,
  UserPayloadResponse,
  ValidationErrors,
} from '@/types/auth'

export type QueryValue = string | number | boolean | null | undefined | Array<string | null>

type ApiRequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: unknown
  token?: string | null
  query?: Record<string, QueryValue>
}

type ErrorPayload = {
  message?: string
  errors?: ValidationErrors
}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost/api').replace(
  /\/$/,
  '',
)

export class ApiError extends Error {
  status: number
  errors: ValidationErrors

  constructor(status: number, message: string, errors: ValidationErrors = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.errors = errors
  }
}

const apiUrl = (path: string, query?: Record<string, QueryValue>) => {
  const origin = typeof window === 'undefined' ? 'http://localhost' : window.location.origin
  const base = API_BASE_URL.startsWith('http') ? API_BASE_URL : `${origin}${API_BASE_URL}`
  const url = new URL(`${base}${path}`)

  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item !== null) url.searchParams.append(key, item)
      })
      return
    }

    if (value !== null && value !== undefined) {
      url.searchParams.set(key, String(value))
    }
  })

  return url.toString()
}

const isFormDataBody = (body: unknown): body is FormData =>
  typeof FormData !== 'undefined' && body instanceof FormData

const parseJson = async (response: Response) => {
  const text = await response.text()

  if (!text) return null

  try {
    return JSON.parse(text) as unknown
  } catch {
    return null
  }
}

export const apiRequest = async <ResponseBody>(path: string, options: ApiRequestOptions = {}) => {
  const body = options.body
  const isFormData = isFormDataBody(body)
  const requestBody: BodyInit | undefined =
    body === undefined ? undefined : isFormData ? body : JSON.stringify(body)
  const headers = new Headers({
    Accept: 'application/json',
  })

  if (body !== undefined && !isFormData) {
    headers.set('Content-Type', 'application/json')
  }

  if (options.token) {
    headers.set('Authorization', `Bearer ${options.token}`)
  }

  let response: Response

  try {
    response = await fetch(apiUrl(path, options.query), {
      method: options.method ?? 'GET',
      headers,
      body: requestBody,
    })
  } catch {
    throw new ApiError(0, 'Unable to reach the NeuroFlow API.')
  }

  const payload = (await parseJson(response)) as ErrorPayload | ResponseBody | null

  if (!response.ok) {
    const errorPayload = payload as ErrorPayload | null

    throw new ApiError(
      response.status,
      errorPayload?.message ?? 'The API rejected this request.',
      errorPayload?.errors ?? {},
    )
  }

  return payload as ResponseBody
}

const request = apiRequest

export const authApi = {
  register: (payload: RegisterPayload) =>
    request<UserPayloadResponse>('/auth/register', {
      method: 'POST',
      body: payload,
    }),

  login: (payload: LoginPayload) =>
    request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: payload,
    }),

  googleRedirect: (query: GoogleRedirectQuery = {}) =>
    request<GoogleRedirectResponse>('/auth/google/redirect', {
      query,
    }),

  googleCallback: (payload: GoogleCallbackPayload) =>
    request<LoginResponse>('/auth/google/callback', {
      method: 'POST',
      body: payload,
    }),

  resendVerificationEmail: (payload: ResendVerificationPayload) =>
    request<MessageResponse>('/auth/email/verification-notification', {
      method: 'POST',
      body: payload,
    }),

  verifyEmail: (id: string | number, hash: string, query: Record<string, QueryValue> = {}) =>
    request<UserPayloadResponse>(
      `/auth/email/verify/${encodeURIComponent(String(id))}/${encodeURIComponent(hash)}`,
      {
        query,
      },
    ),

  forgotPassword: (payload: ForgotPasswordPayload) =>
    request<MessageResponse>('/auth/forgot-password', {
      method: 'POST',
      body: payload,
    }),

  getResetPasswordToken: (token: string, email?: string | null) =>
    request<ResetPasswordTokenResponse>(`/auth/reset-password/${encodeURIComponent(token)}`, {
      query: { email },
    }),

  resetPassword: (payload: ResetPasswordPayload) =>
    request<MessageResponse>('/auth/reset-password', {
      method: 'POST',
      body: payload,
    }),

  logout: (token: string) =>
    request<MessageResponse>('/auth/logout', {
      method: 'POST',
      token,
    }),

  currentUser: (token: string) =>
    request<User>('/user', {
      token,
    }),

  profileItems: (token: string) =>
    request<ProfileItemsResponse>('/items', {
      token,
    }),
}
