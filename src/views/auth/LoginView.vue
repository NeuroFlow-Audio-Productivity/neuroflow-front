<script setup lang="ts">
import { computed, reactive } from 'vue'
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

const form = reactive({
  email: typeof route.query.email === 'string' ? route.query.email : '',
  password: '',
})

const isSubmitting = computed(() => auth.status === 'loading')
const resetCompleted = computed(() => route.query.reset === 'complete')

const fieldError = (field: string) => auth.fieldErrors[field]?.[0]

const safeRedirect = () => {
  const redirect = route.query.redirect

  if (typeof redirect === 'string' && redirect.startsWith('/')) {
    return redirect
  }

  return '/dashboard'
}

const submit = async () => {
  try {
    await auth.login(form)
    await router.push(safeRedirect())
  } catch {
    // The store keeps API errors available for the form.
  }
}
</script>

<template>
  <AuthShell
    :eyebrow="t('auth.login.eyebrow')"
    :title="t('auth.login.title')"
    :subtitle="t('auth.login.subtitle')"
    :alternate-label="t('auth.actions.createAccount')"
    alternate-to="/auth/register"
  >
    <form class="space-y-5" @submit.prevent="submit">
      <div>
        <h2 class="text-2xl font-semibold text-white">{{ t('auth.login.formTitle') }}</h2>
        <p class="mt-2 text-sm leading-6 text-white/62">{{ t('auth.login.formSubtitle') }}</p>
      </div>

      <div
        v-if="resetCompleted"
        class="theme-success-panel rounded-[8px] border px-4 py-3 text-sm leading-6"
      >
        {{ t('auth.login.resetComplete') }}
      </div>

      <div
        v-if="auth.error"
        class="rounded-[8px] border border-red-300/30 bg-red-500/10 px-4 py-3 text-sm leading-6 text-red-100"
      >
        {{ auth.error }}
      </div>

      <div class="auth-field">
        <label class="auth-field-label" for="login-email">{{ t('auth.fields.email') }}</label>
        <InputText
          id="login-email"
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
        <label class="auth-field-label" for="login-password">
          {{ t('auth.fields.password') }}
        </label>
        <Password
          input-id="login-password"
          v-model="form.password"
          class="auth-password"
          input-class="!w-full"
          :feedback="false"
          toggle-mask
          autocomplete="current-password"
          :invalid="Boolean(fieldError('password'))"
        />
        <span v-if="fieldError('password')" class="auth-field-error">
          {{ fieldError('password') }}
        </span>
      </div>

      <div class="flex items-center justify-end">
        <RouterLink
          to="/auth/forgot-password"
          class="theme-accent-link text-sm font-semibold"
        >
          {{ t('auth.actions.forgotPassword') }}
        </RouterLink>
      </div>

      <Button
        type="submit"
        :label="t('auth.actions.signIn')"
        icon="pi pi-arrow-right"
        icon-pos="right"
        :loading="isSubmitting"
        class="theme-primary-button !w-full !justify-center !py-3 !font-semibold"
      />

      <p class="text-center text-sm text-white/62">
        {{ t('auth.login.noAccount') }}
        <RouterLink class="theme-accent-link font-semibold" to="/auth/register">
          {{ t('auth.actions.createAccount') }}
        </RouterLink>
      </p>
    </form>
  </AuthShell>
</template>
