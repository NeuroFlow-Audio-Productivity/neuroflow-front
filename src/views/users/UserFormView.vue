<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Password from 'primevue/password'
import Select from 'primevue/select'

import AppNavbar from '@/components/AppNavbar.vue'
import { ApiError } from '@/services/authApi'
import { translateApiKey, translateApiMessage } from '@/services/apiMessageTranslator'
import { userApi, type StoreUserPayload, type UpdateUserPayload } from '@/services/userApi'
import { translateValidationErrors, validationSummary } from '@/services/validationTranslator'
import { useAuthStore } from '@/stores/auth'
import type { Profile, User, ValidationErrors } from '@/types/auth'

type FormMode = 'create' | 'edit' | 'settings'
type VerificationStatus = 'verified' | 'unverified'

const props = defineProps<{
  mode: FormMode
}>()

const { t } = useI18n()
const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const form = reactive({
  name: '',
  email: '',
  profile_id: null as number | null,
  verificationStatus: 'unverified' as VerificationStatus,
  email_verified_at: '',
  password: '',
  password_confirmation: '',
})

const profiles = ref<Profile[]>([])
const fieldErrors = ref<ValidationErrors>({})
const isLoading = ref(false)
const isSaving = ref(false)
const error = ref<string | null>(null)
const successMessage = ref<string | null>(null)

const isCreate = computed(() => props.mode === 'create')
const isSettings = computed(() => props.mode === 'settings')
const canManageAdminFields = computed(() => auth.isAdmin)
const titleKey = computed(() => `users.${props.mode}.title`)
const subtitleKey = computed(() => `users.${props.mode}.subtitle`)
const eyebrowKey = computed(() => `users.${props.mode}.eyebrow`)
const passwordLabel = computed(() =>
  isCreate.value ? t('auth.fields.password') : t('users.fields.newPassword'),
)
const submitLabel = computed(() =>
  isCreate.value ? t('users.actions.create') : t('users.actions.save'),
)

const targetUserId = computed(() => {
  if (isCreate.value) return null

  if (isSettings.value) {
    return auth.user?.id ?? null
  }

  const id = Number(route.params.id)

  return Number.isFinite(id) ? id : null
})

const profileOptions = computed(() =>
  profiles.value.map((profile) => ({
    label: profile.name,
    value: profile.id,
  })),
)

const verificationOptions = computed(() => [
  { label: t('users.fields.unverified'), value: 'unverified' },
  { label: t('users.fields.verified'), value: 'verified' },
])

const fieldError = (field: string) => fieldErrors.value[field]?.[0]

const resetFeedback = () => {
  fieldErrors.value = {}
  error.value = null
  successMessage.value = null
}

const resetForm = () => {
  form.name = ''
  form.email = ''
  form.profile_id = null
  form.verificationStatus = 'unverified'
  form.email_verified_at = ''
  form.password = ''
  form.password_confirmation = ''
}

const toDatetimeLocal = (value: string | null | undefined) => {
  if (!value) return ''

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return ''

  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)

  return localDate.toISOString().slice(0, 16)
}

const toApiDateTime = (value: string) => {
  if (!value) return null

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return value

  return date.toISOString()
}

const verificationTimestamp = () => {
  if (form.verificationStatus === 'unverified') return null

  return toApiDateTime(form.email_verified_at) ?? new Date().toISOString()
}

const assignUser = (user: User) => {
  form.name = user.name
  form.email = user.email
  form.profile_id = user.profile?.id ?? null
  form.verificationStatus = user.email_verified_at ? 'verified' : 'unverified'
  form.email_verified_at = toDatetimeLocal(user.email_verified_at)
  form.password = ''
  form.password_confirmation = ''
}

const setError = (caughtError: unknown, fallbackKey: string) => {
  if (caughtError instanceof ApiError) {
    fieldErrors.value = translateValidationErrors(caughtError.errors)
    error.value = validationSummary(
      fieldErrors.value,
      translateApiMessage(caughtError.message, {
        fallbackKey,
        status: caughtError.status,
      }),
    )
    return
  }

  fieldErrors.value = {}
  error.value = translateApiKey(fallbackKey)
}

const loadProfiles = async () => {
  if (!auth.token || !canManageAdminFields.value) {
    profiles.value = []
    return
  }

  try {
    const response = await userApi.listProfiles(auth.token)

    profiles.value = response.data
  } catch (caughtError) {
    setError(caughtError, 'users.errors.loadProfiles')
  }
}

const loadForm = async () => {
  resetFeedback()
  resetForm()

  if (isCreate.value) {
    await loadProfiles()
    return
  }

  if (!auth.token || !targetUserId.value) {
    error.value = t('users.errors.missingUser')
    return
  }

  isLoading.value = true

  try {
    const user = await userApi.getUser(auth.token, targetUserId.value)

    assignUser(user)
    await loadProfiles()
  } catch (caughtError) {
    setError(caughtError, 'users.errors.loadUser')
  } finally {
    isLoading.value = false
  }
}

const createPayload = (): StoreUserPayload => {
  const payload: StoreUserPayload = {
    name: form.name,
    email: form.email,
    password: form.password,
    password_confirmation: form.password_confirmation,
  }

  if (canManageAdminFields.value) {
    if (form.profile_id !== null) payload.profile_id = form.profile_id
    payload.email_verified_at = verificationTimestamp()
  }

  return payload
}

const updatePayload = (): UpdateUserPayload => {
  const payload: UpdateUserPayload = {
    name: form.name,
  }

  if (form.password) {
    payload.password = form.password
    payload.password_confirmation = form.password_confirmation
  }

  if (canManageAdminFields.value) {
    payload.email = form.email
    payload.profile_id = form.profile_id
    payload.email_verified_at = verificationTimestamp()
  }

  return payload
}

const syncCurrentSession = async (savedUser: User) => {
  if (auth.user?.id !== savedUser.id) return

  auth.setCurrentUser(savedUser)

  try {
    await auth.fetchProfileItems(true)
  } catch {
    // The account save should remain successful even if navigation refresh fails.
  }
}

const submit = async () => {
  if (!auth.token) return

  resetFeedback()
  isSaving.value = true

  try {
    if (isCreate.value) {
      const createdUser = await userApi.createUser(auth.token, createPayload())

      successMessage.value = t('users.feedback.created')
      await router.push({ name: 'users-show', params: { id: createdUser.id } })
      return
    }

    if (!targetUserId.value) {
      error.value = t('users.errors.missingUser')
      return
    }

    const savedUser = await userApi.updateUser(auth.token, targetUserId.value, updatePayload())

    assignUser(savedUser)
    await syncCurrentSession(savedUser)

    successMessage.value = t('users.feedback.saved')

    if (!auth.isAdmin && !isSettings.value) {
      await router.push({ name: 'dashboard' })
    }
  } catch (caughtError) {
    setError(caughtError, 'users.errors.save')
  } finally {
    isSaving.value = false
  }
}

watch(
  () => [props.mode, route.params.id, auth.user?.id, auth.isAdmin],
  () => {
    void loadForm()
  },
  { immediate: true },
)
</script>

<template>
  <main class="users-page dark min-h-screen px-4 py-4 text-[#f7fbf8] sm:px-6 lg:px-8">
    <AppNavbar />

    <section class="mx-auto max-w-4xl py-8 sm:py-10">
      <RouterLink
        v-if="auth.isAdmin && !isSettings"
        class="theme-accent-link inline-flex items-center gap-2 text-sm font-semibold"
        to="/users"
      >
        <i class="pi pi-arrow-left text-xs" aria-hidden="true" />
        <span>{{ t('users.actions.back') }}</span>
      </RouterLink>

      <div class="mt-6">
        <p class="text-sm font-semibold uppercase text-[var(--mode-accent)]">
          {{ t(eyebrowKey) }}
        </p>
        <h1 class="mt-3 text-4xl font-semibold leading-tight text-white sm:text-5xl">
          {{ t(titleKey) }}
        </h1>
        <p class="mt-3 max-w-2xl text-base leading-7 text-white/66">
          {{ t(subtitleKey) }}
        </p>
      </div>

      <form
        class="mt-6 rounded-[8px] border border-white/12 bg-[#07100e]/86 p-5 shadow-[0_24px_90px_rgba(0,0,0,0.28)] backdrop-blur-2xl sm:p-6"
        @submit.prevent="submit"
      >
        <div v-if="isLoading" class="py-12 text-center text-sm text-white/62">
          {{ t(titleKey) }}...
        </div>

        <template v-else>
          <div
            v-if="successMessage"
            class="theme-success-panel rounded-[8px] border px-4 py-3 text-sm leading-6"
          >
            {{ successMessage }}
          </div>

          <div
            v-if="error"
            class="rounded-[8px] border border-red-300/30 bg-red-500/10 px-4 py-3 text-sm leading-6 text-red-100"
            :class="{ 'mt-4': successMessage }"
          >
            {{ error }}
          </div>

          <div class="mt-5 grid gap-5 sm:grid-cols-2">
            <div class="auth-field">
              <label class="auth-field-label" for="user-name">{{ t('auth.fields.name') }}</label>
              <InputText
                id="user-name"
                v-model="form.name"
                class="!w-full"
                autocomplete="name"
                :invalid="Boolean(fieldError('name'))"
              />
              <span v-if="fieldError('name')" class="auth-field-error">
                {{ fieldError('name') }}
              </span>
            </div>

            <div v-if="canManageAdminFields" class="auth-field">
              <label class="auth-field-label" for="user-email">{{ t('auth.fields.email') }}</label>
              <InputText
                id="user-email"
                v-model="form.email"
                class="!w-full"
                type="email"
                autocomplete="email"
                :invalid="Boolean(fieldError('email'))"
              />
              <span v-if="fieldError('email')" class="auth-field-error">
                {{ fieldError('email') }}
              </span>
            </div>

            <div v-if="canManageAdminFields" class="auth-field">
              <label class="auth-field-label" for="user-profile">
                {{ t('users.fields.profile') }}
              </label>
              <Select
                input-id="user-profile"
                v-model="form.profile_id"
                :options="profileOptions"
                option-label="label"
                option-value="value"
                show-clear
                class="!w-full"
                :placeholder="t('users.fields.profile')"
                :invalid="Boolean(fieldError('profile_id'))"
              />
              <span v-if="fieldError('profile_id')" class="auth-field-error">
                {{ fieldError('profile_id') }}
              </span>
            </div>

            <div v-if="canManageAdminFields" class="auth-field">
              <label class="auth-field-label" for="user-verification-status">
                {{ t('users.fields.verificationStatus') }}
              </label>
              <Select
                input-id="user-verification-status"
                v-model="form.verificationStatus"
                :options="verificationOptions"
                option-label="label"
                option-value="value"
                class="!w-full"
              />
            </div>

            <div
              v-if="canManageAdminFields && form.verificationStatus === 'verified'"
              class="auth-field"
            >
              <label class="auth-field-label" for="user-email-verified-at">
                {{ t('users.fields.verifiedAt') }}
              </label>
              <InputText
                id="user-email-verified-at"
                v-model="form.email_verified_at"
                class="!w-full"
                type="datetime-local"
                :invalid="Boolean(fieldError('email_verified_at'))"
              />
              <span v-if="fieldError('email_verified_at')" class="auth-field-error">
                {{ fieldError('email_verified_at') }}
              </span>
            </div>

            <div class="auth-field">
              <label class="auth-field-label" for="user-password">{{ passwordLabel }}</label>
              <Password
                input-id="user-password"
                v-model="form.password"
                class="auth-password"
                input-class="!w-full"
                toggle-mask
                :feedback="isCreate"
                autocomplete="new-password"
                :required="isCreate"
                :invalid="Boolean(fieldError('password'))"
              />
              <span v-if="fieldError('password')" class="auth-field-error">
                {{ fieldError('password') }}
              </span>
            </div>

            <div class="auth-field">
              <label class="auth-field-label" for="user-password-confirmation">
                {{ t('auth.fields.passwordConfirmation') }}
              </label>
              <Password
                input-id="user-password-confirmation"
                v-model="form.password_confirmation"
                class="auth-password"
                input-class="!w-full"
                :feedback="false"
                toggle-mask
                autocomplete="new-password"
                :required="isCreate || Boolean(form.password)"
                :invalid="Boolean(fieldError('password_confirmation'))"
              />
              <span v-if="fieldError('password_confirmation')" class="auth-field-error">
                {{ fieldError('password_confirmation') }}
              </span>
            </div>
          </div>

          <div class="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            <RouterLink
              v-if="auth.isAdmin && !isSettings"
              class="inline-flex min-h-10 items-center justify-center rounded-[8px] border border-white/12 px-4 text-sm font-semibold text-white/72 transition hover:bg-white/10 hover:text-white"
              to="/users"
            >
              {{ t('users.actions.back') }}
            </RouterLink>
            <Button
              type="submit"
              :label="submitLabel"
              icon="pi pi-check"
              :loading="isSaving"
              class="theme-primary-button !justify-center"
            />
          </div>
        </template>
      </form>
    </section>
  </main>
</template>

<style scoped>
.users-page {
  background:
    radial-gradient(circle at 78% 8%, rgba(var(--mode-companion-rgb), 0.16), transparent 34rem),
    radial-gradient(circle at 6% 68%, rgba(var(--mode-glow-rgb), 0.13), transparent 32rem),
    linear-gradient(180deg, #06100e 0%, #081512 48%, #06100e 100%);
}
</style>
