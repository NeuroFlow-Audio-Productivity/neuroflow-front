<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import Button from 'primevue/button'
import Tag from 'primevue/tag'

import AppNavbar from '@/components/AppNavbar.vue'
import { ApiError } from '@/services/authApi'
import { translateApiKey, translateApiMessage } from '@/services/apiMessageTranslator'
import { userApi } from '@/services/userApi'
import { useAuthStore } from '@/stores/auth'
import type { User } from '@/types/auth'

const { t, locale } = useI18n()
const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const user = ref<User | null>(null)
const isLoading = ref(false)
const isDeleting = ref(false)
const error = ref<string | null>(null)

const userId = computed(() => {
  const id = Number(route.params.id)

  return Number.isFinite(id) ? id : null
})

const formatDate = (value: string | null | undefined) => {
  if (!value) return '-'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat(locale.value, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

const profileName = computed(() => user.value?.profile?.name ?? user.value?.profile?.slug ?? '-')

const setError = (caughtError: unknown, fallbackKey: string) => {
  if (caughtError instanceof ApiError) {
    error.value = translateApiMessage(caughtError.message, {
      fallbackKey,
      status: caughtError.status,
    })
    return
  }

  error.value = translateApiKey(fallbackKey)
}

const loadUser = async () => {
  if (!auth.token) return

  if (!userId.value) {
    error.value = t('users.errors.missingUser')
    return
  }

  isLoading.value = true
  error.value = null

  try {
    user.value = await userApi.getUser(auth.token, userId.value)
  } catch (caughtError) {
    setError(caughtError, 'users.errors.loadUser')
  } finally {
    isLoading.value = false
  }
}

const deleteUser = async () => {
  if (!auth.token || !user.value) return

  const confirmed = window.confirm(t('users.confirmDelete', { name: user.value.name }))

  if (!confirmed) return

  isDeleting.value = true
  error.value = null

  try {
    await userApi.deleteUser(auth.token, user.value.id)

    if (auth.user?.id === user.value.id) {
      auth.clearSession()
      await router.push({ name: 'login' })
      return
    }

    await router.push({ name: 'users-index' })
  } catch (caughtError) {
    setError(caughtError, 'users.errors.delete')
  } finally {
    isDeleting.value = false
  }
}

watch(
  () => route.params.id,
  () => {
    void loadUser()
  },
  { immediate: true },
)
</script>

<template>
  <main class="users-page dark min-h-screen px-4 py-4 text-[#f7fbf8] sm:px-6 lg:px-8">
    <AppNavbar />

    <section class="mx-auto max-w-5xl py-8 sm:py-10">
      <RouterLink
        class="theme-accent-link inline-flex items-center gap-2 text-sm font-semibold"
        to="/users"
      >
        <i class="pi pi-arrow-left text-xs" aria-hidden="true" />
        <span>{{ t('users.actions.back') }}</span>
      </RouterLink>

      <div class="mt-6 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p class="text-sm font-semibold uppercase text-[var(--mode-accent)]">
            {{ t('users.show.eyebrow') }}
          </p>
          <h1 class="mt-3 text-4xl font-semibold leading-tight text-white sm:text-5xl">
            {{ user?.name ?? t('users.show.title') }}
          </h1>
          <p class="mt-3 max-w-2xl text-base leading-7 text-white/66">
            {{ t('users.show.subtitle') }}
          </p>
        </div>

        <div v-if="user" class="flex flex-wrap gap-2">
          <RouterLink :to="{ name: 'users-edit', params: { id: user.id } }">
            <Button
              :label="t('users.actions.edit')"
              icon="pi pi-pencil"
              class="theme-primary-button !justify-center"
            />
          </RouterLink>
          <Button
            :label="t('users.actions.delete')"
            icon="pi pi-trash"
            severity="danger"
            :loading="isDeleting"
            @click="deleteUser"
          />
        </div>
      </div>

      <div
        v-if="error"
        class="mt-6 rounded-[8px] border border-red-300/30 bg-red-500/10 px-4 py-3 text-sm leading-6 text-red-100"
      >
        {{ error }}
      </div>

      <section
        class="mt-6 rounded-[8px] border border-white/12 bg-[#07100e]/86 p-5 shadow-[0_24px_90px_rgba(0,0,0,0.28)] backdrop-blur-2xl sm:p-6"
      >
        <div v-if="isLoading" class="py-12 text-center text-sm text-white/62">
          {{ t('users.show.title') }}...
        </div>

        <dl v-else-if="user" class="grid gap-4 sm:grid-cols-2">
          <div class="rounded-[8px] border border-white/10 bg-white/[0.045] p-4">
            <dt class="text-sm text-white/55">{{ t('users.fields.id') }}</dt>
            <dd class="mt-1 text-base font-semibold text-white">#{{ user.id }}</dd>
          </div>
          <div class="rounded-[8px] border border-white/10 bg-white/[0.045] p-4">
            <dt class="text-sm text-white/55">{{ t('users.fields.status') }}</dt>
            <dd class="mt-2">
              <Tag
                :value="
                  user.email_verified_at ? t('users.fields.verified') : t('users.fields.unverified')
                "
                :severity="user.email_verified_at ? 'success' : 'warn'"
              />
            </dd>
          </div>
          <div class="rounded-[8px] border border-white/10 bg-white/[0.045] p-4">
            <dt class="text-sm text-white/55">{{ t('auth.fields.name') }}</dt>
            <dd class="mt-1 break-words text-base font-semibold text-white">{{ user.name }}</dd>
          </div>
          <div class="rounded-[8px] border border-white/10 bg-white/[0.045] p-4">
            <dt class="text-sm text-white/55">{{ t('auth.fields.email') }}</dt>
            <dd class="mt-1 break-words text-base font-semibold text-white">{{ user.email }}</dd>
          </div>
          <div class="rounded-[8px] border border-white/10 bg-white/[0.045] p-4">
            <dt class="text-sm text-white/55">{{ t('users.fields.profile') }}</dt>
            <dd class="mt-1 text-base font-semibold text-white">{{ profileName }}</dd>
          </div>
          <div class="rounded-[8px] border border-white/10 bg-white/[0.045] p-4">
            <dt class="text-sm text-white/55">{{ t('users.fields.verifiedAt') }}</dt>
            <dd class="mt-1 text-base font-semibold text-white">
              {{ formatDate(user.email_verified_at) }}
            </dd>
          </div>
          <div class="rounded-[8px] border border-white/10 bg-white/[0.045] p-4">
            <dt class="text-sm text-white/55">{{ t('users.fields.createdAt') }}</dt>
            <dd class="mt-1 text-base font-semibold text-white">
              {{ formatDate(user.created_at) }}
            </dd>
          </div>
          <div class="rounded-[8px] border border-white/10 bg-white/[0.045] p-4">
            <dt class="text-sm text-white/55">{{ t('users.fields.updatedAt') }}</dt>
            <dd class="mt-1 text-base font-semibold text-white">
              {{ formatDate(user.updated_at) }}
            </dd>
          </div>
        </dl>
      </section>
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
