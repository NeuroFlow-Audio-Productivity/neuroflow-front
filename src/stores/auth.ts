import { defineStore } from 'pinia'

import { ApiError, authApi } from '@/services/authApi'
import { translateApiKey, translateApiMessage } from '@/services/apiMessageTranslator'
import { translateValidationErrors, validationSummary } from '@/services/validationTranslator'
import type {
  ForgotPasswordPayload,
  LoginPayload,
  LoginResponse,
  ProfileItem,
  RegisterPayload,
  ResendVerificationPayload,
  ResetPasswordPayload,
  User,
  ValidationErrors,
} from '@/types/auth'

type AuthStatus = 'idle' | 'loading' | 'ready'
type ProfileItemsStatus = 'idle' | 'loading' | 'ready'
type VerificationQuery = Record<
  string,
  string | number | boolean | null | undefined | Array<string | null>
>

const TOKEN_KEY = 'neuroflow-auth-token'
const TOKEN_TYPE_KEY = 'neuroflow-auth-token-type'
const USER_KEY = 'neuroflow-auth-user'
const GOOGLE_OAUTH_STATE_KEY = 'neuroflow-google-oauth-state'
const GOOGLE_OAUTH_STATE_TTL = 15 * 60 * 1000
const GOOGLE_OAUTH_POPUP_TIMEOUT = 3 * 60 * 1000

type GoogleOAuthStatePayload = {
  state: string
  redirect: string
  redirect_uri: string | null
  created_at: number
}

type GoogleOAuthCallbackPayload = Partial<LoginResponse> & {
  message?: string
  errors?: ValidationErrors
}

type GoogleOAuthLoginResponse = Omit<LoginResponse, 'message' | 'user'> & {
  message?: string
  user?: User
}

const storage = () => (typeof localStorage === 'undefined' ? undefined : localStorage)

const readToken = () => storage()?.getItem(TOKEN_KEY) ?? null
const readTokenType = () => storage()?.getItem(TOKEN_TYPE_KEY) ?? 'Bearer'

const readUser = (): User | null => {
  const rawUser = storage()?.getItem(USER_KEY)

  if (!rawUser) return null

  try {
    const parsed = JSON.parse(rawUser) as Partial<User>

    if (typeof parsed.id === 'number' && typeof parsed.email === 'string') {
      return parsed as User
    }
  } catch {
    return null
  }

  return null
}

const browserDeviceName = () => {
  if (typeof navigator === 'undefined') return 'NeuroFlow Web'

  return `NeuroFlow Web - ${navigator.platform || 'Browser'}`
}

const safeRedirectPath = (redirect?: string | null) =>
  redirect && redirect.startsWith('/') && !redirect.startsWith('//') ? redirect : '/core'

const googleOAuthRedirectUri = () => import.meta.env.VITE_GOOGLE_OAUTH_REDIRECT_URI?.trim() || null

const randomOAuthState = () => {
  const bytes = new Uint8Array(16)

  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes)

    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  }

  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

const readPendingGoogleOAuthState = () => {
  const rawState = storage()?.getItem(GOOGLE_OAUTH_STATE_KEY)

  if (!rawState) return null

  try {
    const parsed = JSON.parse(rawState) as Partial<GoogleOAuthStatePayload>

    if (
      typeof parsed.state === 'string' &&
      typeof parsed.redirect === 'string' &&
      (parsed.redirect_uri === null || typeof parsed.redirect_uri === 'string') &&
      typeof parsed.created_at === 'number'
    ) {
      return parsed as GoogleOAuthStatePayload
    }
  } catch {
    return null
  }

  return null
}

const storePendingGoogleOAuthState = (payload: GoogleOAuthStatePayload) => {
  storage()?.setItem(GOOGLE_OAUTH_STATE_KEY, JSON.stringify(payload))
}

const clearPendingGoogleOAuthState = () => {
  storage()?.removeItem(GOOGLE_OAUTH_STATE_KEY)
}

const resolvePendingGoogleOAuthState = (state?: string | null) => {
  const pendingState = readPendingGoogleOAuthState()

  if (!pendingState) {
    if (state) throw new ApiError(400, 'Invalid Google OAuth state.')

    return { redirect: '/core', redirect_uri: googleOAuthRedirectUri() }
  }

  if (Date.now() - pendingState.created_at > GOOGLE_OAUTH_STATE_TTL) {
    clearPendingGoogleOAuthState()
    throw new ApiError(400, 'Google OAuth session expired.')
  }

  if (!state || pendingState.state !== state) {
    clearPendingGoogleOAuthState()
    throw new ApiError(400, 'Invalid Google OAuth state.')
  }

  clearPendingGoogleOAuthState()

  return pendingState
}

const resolveFrontendGoogleOAuthState = (state?: string | null) => {
  const pendingState = readPendingGoogleOAuthState()

  if (!pendingState) return { redirect: '/core', redirect_uri: googleOAuthRedirectUri() }

  if (Date.now() - pendingState.created_at > GOOGLE_OAUTH_STATE_TTL) {
    clearPendingGoogleOAuthState()
    throw new ApiError(400, 'Google OAuth session expired.')
  }

  if (state && pendingState.state !== state) {
    clearPendingGoogleOAuthState()
    throw new ApiError(400, 'Invalid Google OAuth state.')
  }

  clearPendingGoogleOAuthState()

  return pendingState
}

type OAuthQuery = Record<string, unknown>

const queryString = (query: OAuthQuery, key: string) => {
  const value = query[key]

  if (Array.isArray(value)) {
    return value.find((item): item is string => typeof item === 'string') ?? null
  }

  return typeof value === 'string' ? value : null
}

const nullableQueryString = (query: OAuthQuery, key: string) => {
  const value = queryString(query, key)

  return value && value !== 'null' ? value : null
}

const queryRecordFromSearchParams = (params: URLSearchParams) => {
  const query: OAuthQuery = {}

  params.forEach((value, key) => {
    if (query[key] === undefined) {
      query[key] = value
      return
    }

    const currentValue = query[key]
    query[key] = Array.isArray(currentValue)
      ? [...currentValue, value]
      : [String(currentValue), value]
  })

  return query
}

const integerQueryValue = (value: unknown) => {
  const parsed = Number(value)

  return Number.isInteger(parsed) ? parsed : null
}

const userFromUnknown = (value: unknown): User | null => {
  if (!value || typeof value !== 'object') return null

  const payload = value as Record<string, unknown>
  const id = integerQueryValue(payload.id)
  const name = typeof payload.name === 'string' ? payload.name : null
  const email = typeof payload.email === 'string' ? payload.email : null

  if (id === null || !name || !email) return null

  const profilePayload = payload.profile as Record<string, unknown> | null | undefined
  const profileId = integerQueryValue(profilePayload?.id)
  const profile =
    profilePayload &&
    profileId !== null &&
    typeof profilePayload.name === 'string' &&
    typeof profilePayload.slug === 'string'
      ? {
          id: profileId,
          name: profilePayload.name,
          slug: profilePayload.slug,
          created_at:
            typeof profilePayload.created_at === 'string' ? profilePayload.created_at : '',
          updated_at:
            typeof profilePayload.updated_at === 'string' ? profilePayload.updated_at : '',
        }
      : null

  return {
    id,
    profile,
    name,
    email,
    email_verified_at:
      typeof payload.email_verified_at === 'string' ? payload.email_verified_at || null : null,
    auth_provider:
      payload.auth_provider === 'google' || payload.auth_provider === 'password'
        ? payload.auth_provider
        : undefined,
    google_avatar_url:
      typeof payload.google_avatar_url === 'string' ? payload.google_avatar_url || null : null,
    created_at: typeof payload.created_at === 'string' ? payload.created_at : '',
    updated_at: typeof payload.updated_at === 'string' ? payload.updated_at : '',
  }
}

const userFromQuery = (query: OAuthQuery) => {
  const encodedUser = queryString(query, 'user')

  if (encodedUser) {
    try {
      const user = userFromUnknown(JSON.parse(encodedUser))

      if (user) return user
    } catch {
      // Fall through to bracket notation used by PHP query strings.
    }
  }

  return userFromUnknown({
    id: queryString(query, 'user[id]'),
    name: queryString(query, 'user[name]'),
    email: queryString(query, 'user[email]'),
    email_verified_at: nullableQueryString(query, 'user[email_verified_at]'),
    auth_provider: queryString(query, 'user[auth_provider]'),
    google_avatar_url: nullableQueryString(query, 'user[google_avatar_url]'),
    created_at: queryString(query, 'user[created_at]'),
    updated_at: queryString(query, 'user[updated_at]'),
    profile: {
      id: queryString(query, 'user[profile][id]'),
      name: queryString(query, 'user[profile][name]'),
      slug: queryString(query, 'user[profile][slug]'),
      created_at: queryString(query, 'user[profile][created_at]'),
      updated_at: queryString(query, 'user[profile][updated_at]'),
    },
  })
}

const googleOAuthErrorFromQuery = (query: OAuthQuery) => {
  const error = queryString(query, 'error')

  if (!error) return null

  if (error === 'auth_provider_password') {
    return new ApiError(
      422,
      'This email already uses password login. Sign in with email and password.',
      {
        auth_provider: ['password'],
      },
    )
  }

  return new ApiError(
    400,
    queryString(query, 'error_description') ?? 'Unable to complete Google sign-in.',
  )
}

const loginResponseFromQuery = (query: OAuthQuery) => {
  const accessToken = queryString(query, 'access_token')
  const tokenType = queryString(query, 'token_type')

  if (!accessToken && !tokenType) return null

  const user = userFromQuery(query)

  if (!accessToken || !tokenType) {
    throw new ApiError(422, 'The API rejected this request.')
  }

  return {
    message: queryString(query, 'message') ?? 'Login successful.',
    access_token: accessToken,
    token_type: tokenType,
    ...(user ? { user } : {}),
  }
}

const extractJsonText = (text: string) => {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')

  if (start === -1 || end <= start) return null

  return text.slice(start, end + 1)
}

const isGoogleOAuthLoginResponse = (
  payload: GoogleOAuthCallbackPayload,
): payload is GoogleOAuthLoginResponse =>
  typeof payload.access_token === 'string' &&
  typeof payload.token_type === 'string' &&
  (payload.user === undefined || (typeof payload.user === 'object' && payload.user !== null))

const popupCallbackPayload = (targetWindow: Window, expectedState: string) => {
  let popupUrl: URL

  try {
    popupUrl = new URL(targetWindow.location.href)
  } catch {
    return null
  }

  if (
    !popupUrl.pathname.endsWith('/auth/google/callback') &&
    !popupUrl.pathname.endsWith('/auth/callback')
  ) {
    return null
  }

  const query = queryRecordFromSearchParams(popupUrl.searchParams)
  const callbackState = queryString(query, 'state')

  if (callbackState && callbackState !== expectedState) {
    throw new ApiError(400, 'Invalid Google OAuth state.')
  }

  const queryError = googleOAuthErrorFromQuery(query)

  if (queryError) throw queryError

  const queryPayload = loginResponseFromQuery(query)

  if (queryPayload) return queryPayload

  const bodyText = targetWindow.document.body?.innerText?.trim() ?? ''
  const jsonText = extractJsonText(bodyText)

  if (!jsonText) return null

  try {
    return JSON.parse(jsonText) as GoogleOAuthCallbackPayload
  } catch {
    throw new ApiError(500, 'The API rejected this request.')
  }
}

const waitForGoogleOAuthPopup = (targetWindow: Window, expectedState: string) =>
  new Promise<GoogleOAuthLoginResponse>((resolve, reject) => {
    const startedAt = Date.now()
    let intervalId = 0

    const finish = (callback: () => void) => {
      window.clearInterval(intervalId)
      callback()
    }

    intervalId = window.setInterval(() => {
      if (targetWindow.closed) {
        finish(() => reject(new ApiError(400, 'Google OAuth sign-in was canceled.')))
        return
      }

      if (Date.now() - startedAt > GOOGLE_OAUTH_POPUP_TIMEOUT) {
        targetWindow.close()
        finish(() => reject(new ApiError(408, 'Google OAuth sign-in timed out.')))
        return
      }

      try {
        const payload = popupCallbackPayload(targetWindow, expectedState)

        if (!payload) return

        targetWindow.close()

        if (isGoogleOAuthLoginResponse(payload)) {
          finish(() => resolve(payload))
          return
        }

        finish(() =>
          reject(
            new ApiError(
              422,
              payload.message ?? 'The API rejected this request.',
              payload.errors ?? {},
            ),
          ),
        )
      } catch (error) {
        if (error instanceof ApiError) {
          targetWindow.close()
          finish(() => reject(error))
        }
      }
    }, 300)
  })

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: readToken(),
    tokenType: readTokenType(),
    user: readUser(),
    status: 'idle' as AuthStatus,
    profileItems: [] as ProfileItem[],
    profileItemsStatus: 'idle' as ProfileItemsStatus,
    profileItemsError: null as string | null,
    bootstrapped: false,
    error: null as string | null,
    fieldErrors: {} as ValidationErrors,
    successMessage: null as string | null,
  }),

  getters: {
    isAuthenticated: (state) => Boolean(state.token),
    isVerified: (state) => Boolean(state.user?.email_verified_at),
    isAdmin: (state) => {
      const profile = state.user?.profile
      const slug = profile?.slug?.toLowerCase()
      const name = profile?.name?.toLowerCase()

      return slug === 'admin' || name === 'admin'
    },
  },

  actions: {
    resetFeedback() {
      this.error = null
      this.fieldErrors = {}
      this.successMessage = null
    },

    persistSession() {
      const store = storage()

      if (!store) return

      if (this.token) store.setItem(TOKEN_KEY, this.token)
      else store.removeItem(TOKEN_KEY)

      if (this.tokenType) store.setItem(TOKEN_TYPE_KEY, this.tokenType)
      else store.removeItem(TOKEN_TYPE_KEY)

      if (this.user) store.setItem(USER_KEY, JSON.stringify(this.user))
      else store.removeItem(USER_KEY)
    },

    clearSession() {
      this.token = null
      this.tokenType = 'Bearer'
      this.user = null
      this.profileItems = []
      this.profileItemsStatus = 'idle'
      this.profileItemsError = null
      this.persistSession()
    },

    setCurrentUser(user: User | null) {
      this.user = user
      this.persistSession()
    },

    applyLoginResponse(response: LoginResponse) {
      this.token = response.access_token
      this.tokenType = response.token_type
      this.user = response.user
      this.profileItems = []
      this.profileItemsStatus = 'idle'
      this.profileItemsError = null
      this.setSuccess(response.message, 'auth.api.success.login')
      this.persistSession()
    },

    async applyGoogleOAuthLoginResponse(response: GoogleOAuthLoginResponse) {
      const user = response.user ?? (await authApi.currentUser(response.access_token))
      const loginResponse = {
        message: response.message ?? 'Login successful.',
        access_token: response.access_token,
        token_type: response.token_type,
        user,
      }

      this.applyLoginResponse(loginResponse)

      return loginResponse
    },

    setSuccess(message: string | null | undefined, fallbackKey: string) {
      this.successMessage = translateApiMessage(message, { fallbackKey })
    },

    setError(error: unknown, fallbackKey = 'auth.api.errors.default') {
      if (error instanceof ApiError) {
        this.fieldErrors = translateValidationErrors(error.errors)
        this.error = validationSummary(
          this.fieldErrors,
          translateApiMessage(error.message, {
            fallbackKey,
            status: error.status,
          }),
        )
        return
      }

      this.error = translateApiKey(fallbackKey)
      this.fieldErrors = {}
    },

    async hydrate() {
      if (this.bootstrapped) return

      this.token = readToken()
      this.tokenType = readTokenType()
      this.user = readUser()
      this.bootstrapped = true

      if (!this.token) return

      try {
        await this.fetchCurrentUser()
        try {
          await this.fetchProfileItems()
        } catch {
          // Profile menu loading should not invalidate an otherwise healthy session.
        }
      } catch {
        this.clearSession()
      }
    },

    async fetchCurrentUser() {
      if (!this.token) return null

      const user = await authApi.currentUser(this.token)
      this.user = user
      this.persistSession()

      return user
    },

    async fetchProfileItems(force = false) {
      if (!this.token) {
        this.profileItems = []
        this.profileItemsStatus = 'idle'
        this.profileItemsError = null

        return []
      }

      if (!force && this.profileItemsStatus === 'ready') {
        return this.profileItems
      }

      if (this.profileItemsStatus === 'loading') {
        return this.profileItems
      }

      this.profileItemsStatus = 'loading'
      this.profileItemsError = null

      try {
        const response = await authApi.profileItems(this.token)

        this.profileItems = response.data
        this.profileItemsStatus = 'ready'

        return this.profileItems
      } catch (error) {
        this.profileItems = []
        this.profileItemsStatus = 'ready'

        if (error instanceof ApiError) {
          this.profileItemsError = translateApiMessage(error.message, {
            fallbackKey: 'auth.api.errors.profileItems',
            status: error.status,
          })

          if (error.status === 401) {
            this.clearSession()
          }
        } else {
          this.profileItemsError = translateApiKey('auth.api.errors.profileItems')
        }

        throw error
      }
    },

    async startGoogleOAuth(redirect?: string | null, targetWindow?: Window | null) {
      this.resetFeedback()
      this.status = 'loading'

      try {
        if (targetWindow === null) {
          throw new ApiError(400, 'Google OAuth popup was blocked.')
        }

        const pendingState = {
          state: randomOAuthState(),
          redirect: safeRedirectPath(redirect),
          redirect_uri: googleOAuthRedirectUri(),
          created_at: Date.now(),
        }
        const response = await authApi.googleRedirect({
          redirect_uri: pendingState.redirect_uri,
          state: pendingState.state,
        })

        storePendingGoogleOAuthState(pendingState)

        if (targetWindow && !targetWindow.closed) {
          targetWindow.location.assign(response.authorization_url)

          const loginResponse = await waitForGoogleOAuthPopup(targetWindow, pendingState.state)

          clearPendingGoogleOAuthState()
          const completedResponse = await this.applyGoogleOAuthLoginResponse(loginResponse)

          return { response: completedResponse, redirect: pendingState.redirect }
        }

        if (typeof window !== 'undefined') {
          window.location.assign(response.authorization_url)
        }

        return response
      } catch (error) {
        if (targetWindow && !targetWindow.closed) {
          targetWindow.close()
        }

        clearPendingGoogleOAuthState()
        this.setError(error, 'auth.api.errors.oauthRedirect')
        throw error
      } finally {
        this.status = 'ready'
      }
    },

    async completeGoogleOAuthRedirect(query: OAuthQuery) {
      this.resetFeedback()
      this.status = 'loading'

      try {
        const queryError = googleOAuthErrorFromQuery(query)

        if (queryError) {
          clearPendingGoogleOAuthState()
          throw queryError
        }

        const response = loginResponseFromQuery(query)

        if (!response) {
          clearPendingGoogleOAuthState()
          throw new ApiError(400, 'Google OAuth token payload is missing.')
        }

        const pendingState = resolveFrontendGoogleOAuthState(queryString(query, 'state'))

        const completedResponse = await this.applyGoogleOAuthLoginResponse(response)

        return { response: completedResponse, redirect: pendingState.redirect }
      } catch (error) {
        this.setError(error, 'auth.api.errors.oauth')
        throw error
      } finally {
        this.status = 'ready'
      }
    },

    async completeGoogleOAuth(code?: string | null, state?: string | null) {
      this.resetFeedback()
      this.status = 'loading'

      try {
        if (!code) {
          clearPendingGoogleOAuthState()
          throw new ApiError(400, 'Google OAuth authorization code is missing.')
        }

        const pendingState = resolvePendingGoogleOAuthState(state)
        const response = await authApi.googleCallback({
          code,
          redirect_uri: pendingState.redirect_uri,
          device_name: browserDeviceName(),
        })

        this.applyLoginResponse(response)

        return { response, redirect: pendingState.redirect }
      } catch (error) {
        this.setError(error, 'auth.api.errors.oauth')
        throw error
      } finally {
        this.status = 'ready'
      }
    },

    async login(payload: LoginPayload) {
      this.resetFeedback()
      this.status = 'loading'

      try {
        const response = await authApi.login({
          ...payload,
          device_name: payload.device_name ?? browserDeviceName(),
        })

        this.applyLoginResponse(response)

        return response
      } catch (error) {
        this.setError(error, 'auth.api.errors.credentials')
        throw error
      } finally {
        this.status = 'ready'
      }
    },

    async register(payload: RegisterPayload) {
      this.resetFeedback()
      this.status = 'loading'

      try {
        const response = await authApi.register(payload)
        this.setSuccess(response.message, 'auth.api.success.register')

        return response
      } catch (error) {
        this.setError(error, 'auth.api.errors.register')
        throw error
      } finally {
        this.status = 'ready'
      }
    },

    async resendVerificationEmail(payload: ResendVerificationPayload) {
      this.resetFeedback()
      this.status = 'loading'

      try {
        const response = await authApi.resendVerificationEmail(payload)
        this.setSuccess(response.message, 'auth.api.success.verificationSent')

        return response
      } catch (error) {
        this.setError(error, 'auth.api.errors.verificationResend')
        throw error
      } finally {
        this.status = 'ready'
      }
    },

    async verifyEmail(id: string | number, hash: string, query: VerificationQuery) {
      this.resetFeedback()
      this.status = 'loading'

      try {
        const response = await authApi.verifyEmail(id, hash, query)
        this.setSuccess(response.message, 'auth.api.success.emailVerified')

        if (this.user?.id === response.data.id) {
          this.user = response.data
          this.persistSession()
        }

        return response
      } catch (error) {
        this.setError(error, 'auth.api.errors.verification')
        throw error
      } finally {
        this.status = 'ready'
      }
    },

    async forgotPassword(payload: ForgotPasswordPayload) {
      this.resetFeedback()
      this.status = 'loading'

      try {
        const response = await authApi.forgotPassword(payload)
        this.setSuccess(response.message, 'auth.api.success.resetLinkSent')

        return response
      } catch (error) {
        this.setError(error, 'auth.api.errors.resetLink')
        throw error
      } finally {
        this.status = 'ready'
      }
    },

    async loadResetPasswordToken(token: string, email?: string | null) {
      this.resetFeedback()
      this.status = 'loading'

      try {
        const response = await authApi.getResetPasswordToken(token, email)
        this.setSuccess(response.message, 'auth.api.success.resetTokenReady')

        return response
      } catch (error) {
        this.setError(error, 'auth.api.errors.resetToken')
        throw error
      } finally {
        this.status = 'ready'
      }
    },

    async resetPassword(payload: ResetPasswordPayload) {
      this.resetFeedback()
      this.status = 'loading'

      try {
        const response = await authApi.resetPassword(payload)
        this.setSuccess(response.message, 'auth.api.success.passwordReset')

        return response
      } catch (error) {
        this.setError(error, 'auth.api.errors.passwordReset')
        throw error
      } finally {
        this.status = 'ready'
      }
    },

    async logout() {
      this.resetFeedback()
      this.status = 'loading'

      const token = this.token

      try {
        if (token) {
          const response = await authApi.logout(token)
          this.setSuccess(response.message, 'auth.api.success.logout')
        }
      } catch (error) {
        this.setError(error, 'auth.api.errors.localSessionCleared')
      } finally {
        this.clearSession()
        this.status = 'ready'
      }
    },
  },
})
