<script setup lang="ts">
import { computed, reactive } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'

import AuthShell from '@/components/auth/AuthShell.vue'
import { useAuthStore } from '@/stores/auth'

const { t } = useI18n()
const auth = useAuthStore()

const form = reactive({
  email: '',
})

const isSubmitting = computed(() => auth.status === 'loading')

const fieldError = (field: string) => auth.fieldErrors[field]?.[0]

const submit = async () => {
  try {
    await auth.forgotPassword(form)
  } catch {
    // The store keeps API errors available for the form.
  }
}
</script>

<template>
  <AuthShell
    :eyebrow="t('auth.forgot.eyebrow')"
    :title="t('auth.forgot.title')"
    :subtitle="t('auth.forgot.subtitle')"
    :alternate-label="t('auth.actions.signIn')"
    alternate-to="/auth/login"
  >
    <form class="space-y-5" @submit.prevent="submit">
      <div>
        <h2 class="text-2xl font-semibold text-white">{{ t('auth.forgot.formTitle') }}</h2>
        <p class="mt-2 text-sm leading-6 text-white/62">{{ t('auth.forgot.formSubtitle') }}</p>
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

      <label class="block">
        <span class="text-sm font-semibold text-white/78">{{ t('auth.fields.email') }}</span>
        <InputText
          v-model="form.email"
          class="mt-2 !w-full"
          type="email"
          autocomplete="email"
          :invalid="Boolean(fieldError('email'))"
        />
        <span v-if="fieldError('email')" class="mt-2 block text-sm text-red-200">
          {{ fieldError('email') }}
        </span>
      </label>

      <Button
        type="submit"
        :label="t('auth.actions.sendResetLink')"
        icon="pi pi-send"
        :loading="isSubmitting"
        class="theme-primary-button !w-full !justify-center !py-3 !font-semibold"
      />
    </form>
  </AuthShell>
</template>
