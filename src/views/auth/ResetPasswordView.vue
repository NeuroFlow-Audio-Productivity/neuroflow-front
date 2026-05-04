<script setup lang="ts">
import { computed, onMounted, reactive } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Password from 'primevue/password'

import AuthShell from '@/components/auth/AuthShell.vue'
import { useAuthStore } from '@/stores/auth'

const { t } = useI18n()
const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const routeToken = computed(() => String(route.params.token ?? ''))
const routeEmail = computed(() => {
  const email = route.query.email

  return typeof email === 'string' ? email : ''
})

const form = reactive({
  token: routeToken.value,
  email: routeEmail.value,
  password: '',
  password_confirmation: '',
})

const isSubmitting = computed(() => auth.status === 'loading')

const fieldError = (field: string) => auth.fieldErrors[field]?.[0]

const loadTokenPayload = async () => {
  if (!form.token) return

  try {
    const response = await auth.loadResetPasswordToken(form.token, routeEmail.value)

    if (typeof response.data.email === 'string') {
      form.email = response.data.email
    }
  } catch {
    // The form remains editable if the API cannot preflight the token.
  }
}

const submit = async () => {
  try {
    await auth.resetPassword(form)
    await router.push({
      name: 'login',
      query: {
        reset: 'complete',
        email: form.email,
      },
    })
  } catch {
    // The store keeps API errors available for the form.
  }
}

onMounted(() => {
  void loadTokenPayload()
})
</script>

<template>
  <AuthShell
    :eyebrow="t('auth.reset.eyebrow')"
    :title="t('auth.reset.title')"
    :subtitle="t('auth.reset.subtitle')"
    :alternate-label="t('auth.actions.signIn')"
    alternate-to="/auth/login"
  >
    <form class="space-y-5" @submit.prevent="submit">
      <div>
        <h2 class="text-2xl font-semibold text-white">{{ t('auth.reset.formTitle') }}</h2>
        <p class="mt-2 text-sm leading-6 text-white/62">{{ t('auth.reset.formSubtitle') }}</p>
      </div>

      <div
        v-if="auth.successMessage"
        class="theme-success-panel rounded-[8px] border px-4 py-3 text-sm leading-6"
      >
        {{ auth.successMessage }}
      </div>

      <div
        v-if="auth.error"
        class="rounded-[8px] border border-red-300/30 bg-red-500/10 px-4 py-3 text-sm leading-6 text-red-100"
      >
        {{ auth.error }}
      </div>

      <div class="auth-field">
        <label class="auth-field-label" for="reset-email">{{ t('auth.fields.email') }}</label>
        <InputText
          id="reset-email"
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

      <div class="auth-field">
        <label class="auth-field-label" for="reset-password">
          {{ t('auth.fields.password') }}
        </label>
        <Password
          input-id="reset-password"
          v-model="form.password"
          class="auth-password"
          input-class="!w-full"
          toggle-mask
          autocomplete="new-password"
          :invalid="Boolean(fieldError('password'))"
        />
        <span v-if="fieldError('password')" class="auth-field-error">
          {{ fieldError('password') }}
        </span>
      </div>

      <div class="auth-field">
        <label class="auth-field-label" for="reset-password-confirmation">
          {{ t('auth.fields.passwordConfirmation') }}
        </label>
        <Password
          input-id="reset-password-confirmation"
          v-model="form.password_confirmation"
          class="auth-password"
          input-class="!w-full"
          :feedback="false"
          toggle-mask
          autocomplete="new-password"
          :invalid="Boolean(fieldError('password_confirmation'))"
        />
        <span v-if="fieldError('password_confirmation')" class="auth-field-error">
          {{ fieldError('password_confirmation') }}
        </span>
      </div>

      <Button
        type="submit"
        :label="t('auth.actions.resetPassword')"
        icon="pi pi-lock"
        :loading="isSubmitting"
        class="theme-primary-button !w-full !justify-center !py-3 !font-semibold"
      />
    </form>
  </AuthShell>
</template>
