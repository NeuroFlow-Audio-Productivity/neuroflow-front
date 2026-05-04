<script setup lang="ts">
import { computed, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Password from 'primevue/password'

import AuthShell from '@/components/auth/AuthShell.vue'
import { useAuthStore } from '@/stores/auth'

const { t } = useI18n()
const auth = useAuthStore()
const router = useRouter()

const form = reactive({
  name: '',
  email: '',
  password: '',
  password_confirmation: '',
})

const isSubmitting = computed(() => auth.status === 'loading')

const fieldError = (field: string) => auth.fieldErrors[field]?.[0]

const submit = async () => {
  try {
    await auth.register(form)
    await router.push({
      name: 'verify-email',
      query: { email: form.email },
    })
  } catch {
    // The store keeps API errors available for the form.
  }
}
</script>

<template>
  <AuthShell
    :eyebrow="t('auth.register.eyebrow')"
    :title="t('auth.register.title')"
    :subtitle="t('auth.register.subtitle')"
    :alternate-label="t('auth.actions.signIn')"
    alternate-to="/auth/login"
  >
    <form class="space-y-5" @submit.prevent="submit">
      <div>
        <h2 class="text-2xl font-semibold text-white">{{ t('auth.register.formTitle') }}</h2>
        <p class="mt-2 text-sm leading-6 text-white/62">{{ t('auth.register.formSubtitle') }}</p>
      </div>

      <div
        v-if="auth.error"
        class="rounded-[8px] border border-red-300/30 bg-red-500/10 px-4 py-3 text-sm leading-6 text-red-100"
      >
        {{ auth.error }}
      </div>

      <div class="auth-field">
        <label class="auth-field-label" for="register-name">{{ t('auth.fields.name') }}</label>
        <InputText
          id="register-name"
          v-model="form.name"
          class="!w-full"
          autocomplete="name"
          :invalid="Boolean(fieldError('name'))"
        />
        <span v-if="fieldError('name')" class="auth-field-error">
          {{ fieldError('name') }}
        </span>
      </div>

      <div class="auth-field">
        <label class="auth-field-label" for="register-email">{{ t('auth.fields.email') }}</label>
        <InputText
          id="register-email"
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
        <label class="auth-field-label" for="register-password">
          {{ t('auth.fields.password') }}
        </label>
        <Password
          input-id="register-password"
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
        <label class="auth-field-label" for="register-password-confirmation">
          {{ t('auth.fields.passwordConfirmation') }}
        </label>
        <Password
          input-id="register-password-confirmation"
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
        :label="t('auth.actions.createAccount')"
        icon="pi pi-user-plus"
        :loading="isSubmitting"
        class="theme-primary-button !w-full !justify-center !py-3 !font-semibold"
      />

      <p class="text-center text-sm text-white/62">
        {{ t('auth.register.hasAccount') }}
        <RouterLink class="theme-accent-link font-semibold" to="/auth/login">
          {{ t('auth.actions.signIn') }}
        </RouterLink>
      </p>
    </form>
  </AuthShell>
</template>
