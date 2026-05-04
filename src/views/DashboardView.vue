<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import Tag from 'primevue/tag'

import LocaleSwitcher from '@/components/LocaleSwitcher.vue'
import { useAuthStore } from '@/stores/auth'

const { t } = useI18n()
const auth = useAuthStore()
const router = useRouter()

const verificationSeverity = computed(() => (auth.isVerified ? 'success' : 'warn'))
const verificationLabel = computed(() =>
  auth.isVerified ? t('auth.dashboard.verified') : t('auth.dashboard.unverified'),
)

const logout = async () => {
  await auth.logout()
  await router.push({ name: 'login' })
}

const resendVerification = async () => {
  if (!auth.user?.email) return

  try {
    await auth.resendVerificationEmail({ email: auth.user.email })
  } catch {
    // The store keeps API errors available for the page.
  }
}
</script>

<template>
  <main
    class="dashboard-page dark min-h-screen overflow-hidden px-4 py-4 text-[#f7fbf8] sm:px-6 lg:px-8"
  >
    <header
      class="mx-auto flex max-w-7xl items-center justify-between gap-3 rounded-full border border-white/10 bg-black/45 px-3 py-2 shadow-[0_20px_80px_rgba(0,0,0,0.28)] backdrop-blur-xl"
    >
      <RouterLink to="/" class="flex min-w-0 items-center gap-3 text-white">
        <span
          class="grid size-9 shrink-0 place-items-center rounded-full border border-white/15 bg-white/8"
          aria-hidden="true"
        >
          <span class="logo-mark" />
        </span>
        <span class="text-base font-semibold">NeuroFlow</span>
      </RouterLink>

      <div class="flex items-center gap-2">
        <LocaleSwitcher />
        <button
          class="grid size-10 place-items-center rounded-full border border-white/12 bg-white/10 text-white transition hover:bg-white/16"
          type="button"
          :aria-label="t('auth.actions.signOut')"
          @click="logout"
        >
          <i class="pi pi-sign-out" aria-hidden="true" />
        </button>
      </div>
    </header>

    <section
      class="mx-auto grid min-h-[calc(100svh-5.5rem)] max-w-7xl items-center gap-8 py-10 lg:grid-cols-[minmax(0,0.82fr)_minmax(360px,0.68fr)]"
    >
      <div>
        <p class="text-sm font-semibold uppercase text-[#6ee7d8]">
          {{ t('auth.dashboard.eyebrow') }}
        </p>
        <h1 class="mt-4 text-5xl font-semibold leading-none text-white sm:text-6xl lg:text-7xl">
          {{ t('auth.dashboard.title', { name: auth.user?.name ?? 'NeuroFlow' }) }}
        </h1>
        <p class="mt-6 max-w-2xl text-lg leading-8 text-white/72">
          {{ t('auth.dashboard.subtitle') }}
        </p>
      </div>

      <section
        class="rounded-[8px] border border-white/12 bg-[#07100e]/86 p-5 shadow-[0_24px_90px_rgba(0,0,0,0.38)] backdrop-blur-2xl sm:p-6"
      >
        <div class="flex items-start justify-between gap-4">
          <div>
            <p class="text-sm text-white/55">{{ t('auth.dashboard.session') }}</p>
            <h2 class="mt-1 text-2xl font-semibold text-white">{{ auth.user?.name }}</h2>
          </div>
          <Tag :value="verificationLabel" :severity="verificationSeverity" />
        </div>

        <dl class="mt-8 space-y-4">
          <div class="rounded-[8px] border border-white/10 bg-white/[0.045] p-4">
            <dt class="text-sm text-white/55">{{ t('auth.fields.email') }}</dt>
            <dd class="mt-1 break-words text-base font-semibold text-white">
              {{ auth.user?.email }}
            </dd>
          </div>
          <div class="rounded-[8px] border border-white/10 bg-white/[0.045] p-4">
            <dt class="text-sm text-white/55">{{ t('auth.dashboard.userId') }}</dt>
            <dd class="mt-1 text-base font-semibold text-white">#{{ auth.user?.id }}</dd>
          </div>
        </dl>

        <div
          v-if="auth.successMessage"
          class="mt-5 rounded-[8px] border border-[#6ee7d8]/30 bg-[#6ee7d8]/10 px-4 py-3 text-sm leading-6 text-[#d9fff8]"
        >
          {{ auth.successMessage }}
        </div>

        <div
          v-if="auth.error"
          class="mt-5 rounded-[8px] border border-red-300/30 bg-red-500/10 px-4 py-3 text-sm leading-6 text-red-100"
        >
          {{ auth.error }}
        </div>

        <div class="mt-6 grid gap-3 sm:grid-cols-2">
          <Button
            v-if="!auth.isVerified"
            type="button"
            :label="t('auth.actions.resendVerification')"
            icon="pi pi-send"
            :loading="auth.status === 'loading'"
            class="!justify-center !border-[#6ee7d8]/40 !bg-[#6ee7d8]/10 !text-[#d9fff8] hover:!bg-[#6ee7d8]/18"
            @click="resendVerification"
          />
          <Button
            type="button"
            :label="t('auth.actions.signOut')"
            icon="pi pi-sign-out"
            severity="secondary"
            :loading="auth.status === 'loading'"
            class="!justify-center !border-white/12 !bg-white/10 !text-white hover:!bg-white/16"
            @click="logout"
          />
        </div>
      </section>
    </section>
  </main>
</template>

<style scoped>
.dashboard-page {
  background:
    radial-gradient(circle at 68% 12%, rgba(110, 231, 216, 0.16), transparent 34rem),
    radial-gradient(circle at 0% 58%, rgba(185, 167, 255, 0.12), transparent 34rem),
    linear-gradient(180deg, #06100e 0%, #081512 48%, #06100e 100%);
}

.logo-mark {
  position: relative;
  width: 18px;
  height: 18px;
}

.logo-mark,
.logo-mark::before,
.logo-mark::after {
  border: 1px solid rgba(255, 255, 255, 0.76);
  border-radius: 999px;
}

.logo-mark::before,
.logo-mark::after {
  content: '';
  position: absolute;
  inset: -1px;
}

.logo-mark::before {
  transform: rotate(60deg);
}

.logo-mark::after {
  transform: rotate(-60deg);
}
</style>
