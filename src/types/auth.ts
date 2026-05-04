export type User = {
  id: number
  name: string
  email: string
  email_verified_at: string | null
  created_at: string
  updated_at: string
}

export type ValidationErrors = Record<string, string[]>

export type RegisterPayload = {
  name: string
  email: string
  password: string
  password_confirmation: string
}

export type LoginPayload = {
  email: string
  password: string
  device_name?: string | null
}

export type LoginResponse = {
  message: string
  access_token: string
  token_type: string
  user: User
}

export type MessageResponse = {
  message: string
}

export type UserPayloadResponse = {
  message: string
  data: User
}

export type ForgotPasswordPayload = {
  email: string
}

export type ResendVerificationPayload = {
  email: string
}

export type ResetPasswordPayload = {
  token: string
  email: string
  password: string
  password_confirmation: string
}

export type ResetPasswordTokenResponse = {
  message: string
  data: {
    token: string
    email: string | unknown[] | null
  }
}
