import { i18n } from '@/i18n'

type TranslateOptions = {
  fallbackKey?: string
  status?: number
}

const knownMessageKeys: Record<string, string> = {
  'login successful': 'auth.api.success.login',
  'google authorization url generated successfully': 'auth.api.success.oauthRedirect',
  'google oauth authorization code is missing': 'auth.api.errors.oauth',
  'google oauth session expired': 'auth.api.errors.oauth',
  'invalid google oauth state': 'auth.api.errors.oauth',
  'registration successful please verify your email address': 'auth.api.success.register',
  'verification email sent successfully': 'auth.api.success.verificationSent',
  'email verified successfully': 'auth.api.success.emailVerified',
  'your email address has been verified': 'auth.api.success.emailVerified',
  'use this token and email address to complete the password reset':
    'auth.api.success.resetTokenReady',
  'we have emailed your password reset link': 'auth.api.success.resetLinkSent',
  'password reset link sent successfully': 'auth.api.success.resetLinkSent',
  'password reset successfully': 'auth.api.success.passwordReset',
  'your password has been reset': 'auth.api.success.passwordReset',
  'logout successful': 'auth.api.success.logout',
  'logged out successfully': 'auth.api.success.logout',
  'the local session was cleared': 'auth.api.errors.localSessionCleared',
  'unable to sign in with these credentials': 'auth.api.errors.credentials',
  'unable to create this account': 'auth.api.errors.register',
  'unable to resend the verification email': 'auth.api.errors.verificationResend',
  'unable to verify this email address': 'auth.api.errors.verification',
  'unable to send the password reset link': 'auth.api.errors.resetLink',
  'unable to load this password reset token': 'auth.api.errors.resetToken',
  'unable to reset this password': 'auth.api.errors.passwordReset',
  'unable to reach the neuroflow api': 'auth.api.errors.network',
  'the api rejected this request': 'auth.api.errors.default',
  'invalid signature': 'auth.api.errors.invalidSignature',
  unauthenticated: 'auth.api.errors.unauthenticated',
  unauthorized: 'auth.api.errors.unauthenticated',
  forbidden: 'auth.api.errors.forbidden',
  'not found': 'auth.api.errors.notFound',
  'the given data was invalid': 'auth.api.errors.validation',
  'too many attempts': 'auth.api.errors.tooManyAttempts',
  'too many requests': 'auth.api.errors.tooManyAttempts',
  'these credentials do not match our records': 'auth.api.errors.credentials',
  'the provided credentials are incorrect': 'auth.api.errors.credentials',
  'your email address is not verified': 'auth.api.errors.emailNotVerified',
  'email not verified': 'auth.api.errors.emailNotVerified',
  'this email address is already verified': 'auth.api.errors.emailAlreadyVerified',
  'the email address is already verified': 'auth.api.errors.emailAlreadyVerified',
  'email address already verified': 'auth.api.errors.emailAlreadyVerified',
  'csrf token mismatch': 'auth.api.errors.sessionExpired',
}

const statusFallbackKeys: Record<number, string> = {
  0: 'auth.api.errors.network',
  401: 'auth.api.errors.unauthenticated',
  403: 'auth.api.errors.forbidden',
  404: 'auth.api.errors.notFound',
  419: 'auth.api.errors.sessionExpired',
  422: 'auth.api.errors.validation',
  429: 'auth.api.errors.tooManyAttempts',
}

const normalizeMessage = (message: string) =>
  message
    .trim()
    .toLowerCase()
    .replace(/[.?!]+$/g, '')
    .replace(/\s+/g, ' ')

export const translateApiKey = (key: string) => i18n.global.t(key)

export const translateApiMessage = (
  message: string | null | undefined,
  options: TranslateOptions = {},
) => {
  const normalized = normalizeMessage(message ?? '')
  const key = knownMessageKeys[normalized]

  if (key) return translateApiKey(key)

  if (options.status !== undefined) {
    const statusKey =
      statusFallbackKeys[options.status] ??
      (options.status >= 500 ? 'auth.api.errors.server' : undefined)

    if (statusKey) return translateApiKey(statusKey)
  }

  return translateApiKey(options.fallbackKey ?? 'auth.api.errors.default')
}
