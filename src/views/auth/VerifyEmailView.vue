<script setup lang="ts">
import { computed, onMounted, reactive } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'

import AuthShell from '@/components/auth/AuthShell.vue'
import { useAuthStore } from '@/stores/auth'

type VerificationQuery = Record<string, string | number | boolean | null | undefined | string[]>

const { t } = useI18n()
const auth = useAuthStore()
const route = useRoute()

const routeEmail = computed(() => {
  const email = route.query.email

  return typeof email === 'string' ? email : (auth.user?.email ?? '')
})

const form = reactive({
  email: routeEmail.value,
})

const isSubmitting = computed(() => auth.status === 'loading')
const isVerificationLink = computed(() => Boolean(route.params.id && route.params.hash))
const verified = computed(() => Boolean(auth.successMessage && isVerificationLink.value))

const fieldError = (field: string) => auth.fieldErrors[field]?.[0]

const normalizeSignedQueryKey = (key: string) => {
  try {
    return decodeURIComponent(key).replace(/^amp;/i, '')
  } catch {
    return key.replace(/^amp;/i, '')
  }
}

const normalizedQuery = () =>
  Object.entries(route.query).reduce<VerificationQuery>((query, [key, value]) => {
    const normalizedKey = normalizeSignedQueryKey(key)

    query[normalizedKey] = Array.isArray(value)
      ? value.filter((item): item is string => item !== null)
      : value

    return query
  }, {})

const verifyFromRoute = async () => {
  const id = route.params.id
  const hash = route.params.hash

  if (!id || !hash) return

  try {
    await auth.verifyEmail(String(id), String(hash), normalizedQuery())
  } catch {
    // The store keeps API errors available for the page.
  }
}

const resend = async () => {
  try {
    await auth.resendVerificationEmail(form)
  } catch {
    // The store keeps API errors available for the form.
  }
}

onMounted(() => {
  void verifyFromRoute()
})
</script>

<template>
  <AuthShell
    :eyebrow="t('auth.verify.eyebrow')"
    :title="isVerificationLink ? t('auth.verify.linkTitle') : t('auth.verify.title')"
    :subtitle="isVerificationLink ? t('auth.verify.linkSubtitle') : t('auth.verify.subtitle')"
    :alternate-label="t('auth.actions.signIn')"
    alternate-to="/auth/login"
  >
    <div v-if="isVerificationLink" class="space-y-5">
      <div
        v-if="isSubmitting"
        class="rounded-[8px] border border-white/10 bg-white/[0.045] px-4 py-3 text-sm leading-6 text-white/70"
      >
        {{ t('auth.verify.checking') }}
      </div>

      <div
        v-else-if="verified"
        class="rounded-[8px] border border-[#6ee7d8]/30 bg-[#6ee7d8]/10 px-4 py-3 text-sm leading-6 text-[#d9fff8]"
      >
        {{ auth.successMessage }}
      </div>

      <div
        v-else-if="auth.error"
        class="rounded-[8px] border border-red-300/30 bg-red-500/10 px-4 py-3 text-sm leading-6 text-red-100"
      >
        {{ auth.error }}
      </div>

      <RouterLink
        to="/auth/login"
        class="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#6ee7d8] px-6 font-semibold text-[#06100e] transition hover:brightness-110"
      >
        <i class="pi pi-arrow-right" aria-hidden="true" />
        <span>{{ t('auth.actions.signIn') }}</span>
      </RouterLink>
    </div>

    <form v-else class="space-y-5" @submit.prevent="resend">
      <div>
        <h2 class="text-2xl font-semibold text-white">{{ t('auth.verify.formTitle') }}</h2>
        <p class="mt-2 text-sm leading-6 text-white/62">{{ t('auth.verify.formSubtitle') }}</p>
      </div>

      <div
        v-if="auth.successMessage"
        class="rounded-[8px] border border-[#6ee7d8]/30 bg-[#6ee7d8]/10 px-4 py-3 text-sm leading-6 text-[#d9fff8]"
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
        :label="t('auth.actions.resendVerification')"
        icon="pi pi-send"
        :loading="isSubmitting"
        class="!w-full !justify-center !border-0 !bg-[#6ee7d8] !py-3 !font-semibold !text-[#06100e] hover:!brightness-110"
      />
    </form>
  </AuthShell>
</template>
