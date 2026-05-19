<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'

import AuthShell from '@/components/auth/AuthShell.vue'
import { useAuthStore } from '@/stores/auth'

const { t } = useI18n()
const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const queryString = (value: unknown) => (typeof value === 'string' ? value : null)

const callbackCode = computed(() => queryString(route.query.code))
const callbackState = computed(() => queryString(route.query.state))
const isProcessing = computed(() => auth.status === 'loading')
const completed = computed(() => Boolean(auth.successMessage && auth.isAuthenticated))
const eyebrow = computed(() => t('auth.oauth.eyebrow'))
const title = computed(() => t('auth.oauth.title'))
const subtitle = computed(() => t('auth.oauth.subtitle'))
const alternateLabel = computed(() => t('auth.actions.signIn'))

const processCallback = async () => {
  try {
    const result = await auth.completeGoogleOAuth(callbackCode.value, callbackState.value)

    await router.replace(result.redirect)
  } catch {
    // The store keeps OAuth errors available for this page.
  }
}

onMounted(() => {
  void processCallback()
})
</script>

<template>
  <AuthShell
    :eyebrow="eyebrow"
    :title="title"
    :subtitle="subtitle"
    :alternate-label="alternateLabel"
    alternate-to="/auth/login"
  >
    <div class="space-y-5">
      <div>
        <h2 class="text-2xl font-semibold text-white">{{ t('auth.oauth.formTitle') }}</h2>
        <p class="mt-2 text-sm leading-6 text-white/62">{{ t('auth.oauth.formSubtitle') }}</p>
      </div>

      <div
        v-if="isProcessing"
        class="rounded-[8px] border border-white/10 bg-white/[0.045] px-4 py-3 text-sm leading-6 text-white/70"
      >
        <div class="flex items-center gap-3">
          <i class="pi pi-spin pi-spinner text-[var(--mode-accent)]" aria-hidden="true" />
          <span>{{ t('auth.oauth.checking') }}</span>
        </div>
      </div>

      <div
        v-else-if="completed"
        class="theme-success-panel rounded-[8px] border px-4 py-3 text-sm leading-6"
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
        v-if="auth.error"
        to="/auth/login"
        class="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--mode-accent)] px-6 font-semibold text-[var(--mode-ink)] transition hover:brightness-110"
      >
        <i class="pi pi-arrow-left" aria-hidden="true" />
        <span>{{ t('auth.actions.signIn') }}</span>
      </RouterLink>
    </div>
  </AuthShell>
</template>
