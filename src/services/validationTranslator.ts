import { i18n } from '@/i18n'
import type { ValidationErrors } from '@/types/auth'

const fieldKeyByApiField: Record<string, string> = {
  name: 'auth.fields.name',
  email: 'auth.fields.email',
  password: 'auth.fields.password',
  password_confirmation: 'auth.fields.passwordConfirmation',
  profile_id: 'auth.fields.profile',
  email_verified_at: 'auth.fields.emailVerifiedAt',
  description: 'modeResource.fields.description',
  color: 'modeResource.fields.color',
  is_system: 'modeResource.fields.isSystem',
  mode_id: 'audioResource.fields.mode',
  file: 'audioResource.fields.file',
  path: 'audioResource.fields.path',
}

const translate = (key: string, params: Record<string, string | number> = {}) =>
  i18n.global.t(key, params)

const fieldLabel = (field: string) => {
  const key = fieldKeyByApiField[field]

  if (key) return translate(key)

  return field.replace(/_/g, ' ')
}

const extractLimit = (message: string) => message.match(/\b(\d+)\b/)?.[1] ?? ''

export const translateValidationMessage = (message: string, field: string) => {
  const normalized = message.toLowerCase()
  const label = fieldLabel(field)

  if (
    (normalized.includes('credentials') && normalized.includes('do not match')) ||
    normalized.includes('provided credentials are incorrect')
  ) {
    return translate('auth.api.errors.credentials')
  }

  if (
    normalized.includes('registered with password login') ||
    normalized.includes('sign in with email and password')
  ) {
    return translate('auth.api.errors.oauthPasswordAccount')
  }

  if (normalized.includes('uses google sign-in') || normalized.includes('continue with google')) {
    return translate('auth.api.errors.oauthGoogleAccount')
  }

  if (normalized.includes('required')) {
    return translate('auth.validation.required', { field: label })
  }

  if (normalized.includes('valid email')) {
    return translate('auth.validation.email', { field: label })
  }

  if (normalized.includes('confirmation') && normalized.includes('does not match')) {
    return translate('auth.validation.confirmed', { field: label })
  }

  if (normalized.includes('already been taken')) {
    return translate('auth.validation.unique', { field: label })
  }

  if (normalized.includes('already verified')) {
    return translate('auth.validation.alreadyVerified', { field: label })
  }

  if (normalized.includes('at least')) {
    return translate('auth.validation.minString', { field: label, min: extractLimit(message) })
  }

  if (normalized.includes('greater than')) {
    return translate('auth.validation.maxString', { field: label, max: extractLimit(message) })
  }

  if (normalized.includes('must be a string')) {
    return translate('auth.validation.string', { field: label })
  }

  if (normalized.includes('selected') && normalized.includes('invalid')) {
    return translate('auth.validation.invalid', { field: label })
  }

  return translate('auth.validation.default', { field: label })
}

const shouldIgnoreValidationMessage = (field: string, message: string) =>
  field === 'auth_provider' && ['password', 'google'].includes(message.trim().toLowerCase())

export const translateValidationErrors = (errors: ValidationErrors) =>
  Object.entries(errors).reduce<ValidationErrors>((translatedErrors, [field, messages]) => {
    const translatedMessages = messages
      .filter((message) => !shouldIgnoreValidationMessage(field, message))
      .map((message) => translateValidationMessage(message, field))

    if (translatedMessages.length) {
      translatedErrors[field] = translatedMessages
    }

    return translatedErrors
  }, {})

export const validationSummary = (errors: ValidationErrors, fallback: string) => {
  const messages = Object.values(errors).flat()
  const firstMessage = messages[0]

  if (!firstMessage) return fallback

  const remaining = messages.length - 1

  if (remaining < 1) return firstMessage

  return `${firstMessage}${translate(
    remaining === 1 ? 'auth.validation.summaryMoreOne' : 'auth.validation.summaryMore',
    { count: remaining },
  )}`
}
