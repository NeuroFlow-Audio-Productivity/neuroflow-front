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

type GoogleOAuthStatePayload = {
  state: string
  redirect: string
  redirect_uri: string | null
  created_at: number
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
  redirect && redirect.startsWith('/') && !redirect.startsWith('//') ? redirect : '/dashboard'

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

    return { redirect: '/dashboard', redirect_uri: googleOAuthRedirectUri() }
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

    async startGoogleOAuth(redirect?: string | null) {
      this.resetFeedback()
      this.status = 'loading'

      try {
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

        if (typeof window !== 'undefined') {
          window.location.assign(response.authorization_url)
        }

        return response
      } catch (error) {
        clearPendingGoogleOAuthState()
        this.setError(error, 'auth.api.errors.oauthRedirect')
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
