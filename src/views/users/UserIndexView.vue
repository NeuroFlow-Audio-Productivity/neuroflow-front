<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
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
const router = useRouter()

const users = ref<User[]>([])
const isLoading = ref(false)
const deletingUserId = ref<number | null>(null)
const error = ref<string | null>(null)
const successMessage = ref<string | null>(null)

const sortedUsers = computed(() => [...users.value].sort((a, b) => a.id - b.id))

const formatDate = (value: string | null | undefined) => {
  if (!value) return '-'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat(locale.value, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

const profileName = (user: User) => user.profile?.name ?? user.profile?.slug ?? '-'

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

const loadUsers = async () => {
  if (!auth.token) return

  isLoading.value = true
  error.value = null

  try {
    const response = await userApi.listUsers(auth.token)

    users.value = response.data
  } catch (caughtError) {
    setError(caughtError, 'users.errors.loadUsers')
  } finally {
    isLoading.value = false
  }
}

const deleteUser = async (user: User) => {
  if (!auth.token) return

  const confirmed = window.confirm(t('users.confirmDelete', { name: user.name }))

  if (!confirmed) return

  deletingUserId.value = user.id
  error.value = null
  successMessage.value = null

  try {
    await userApi.deleteUser(auth.token, user.id)

    users.value = users.value.filter((item) => item.id !== user.id)
    successMessage.value = t('users.feedback.deleted')

    if (auth.user?.id === user.id) {
      auth.clearSession()
      await router.push({ name: 'login' })
    }
  } catch (caughtError) {
    setError(caughtError, 'users.errors.delete')
  } finally {
    deletingUserId.value = null
  }
}

onMounted(() => {
  void loadUsers()
})
</script>

<template>
  <main class="users-page dark min-h-screen px-4 py-4 text-[#f7fbf8] sm:px-6 lg:px-8">
    <AppNavbar />

    <section class="mx-auto max-w-7xl py-8 sm:py-10">
      <div class="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p class="text-sm font-semibold uppercase text-[var(--mode-accent)]">
            {{ t('users.index.eyebrow') }}
          </p>
          <h1 class="mt-3 text-4xl font-semibold leading-tight text-white sm:text-5xl">
            {{ t('users.index.title') }}
          </h1>
          <p class="mt-3 max-w-2xl text-base leading-7 text-white/66">
            {{ t('users.index.subtitle') }}
          </p>
        </div>

        <RouterLink to="/users/create">
          <Button
            :label="t('users.actions.create')"
            icon="pi pi-user-plus"
            class="theme-primary-button !justify-center"
          />
        </RouterLink>
      </div>

      <div
        v-if="successMessage"
        class="theme-success-panel mt-6 rounded-[8px] border px-4 py-3 text-sm leading-6"
      >
        {{ successMessage }}
      </div>

      <div
        v-if="error"
        class="mt-6 rounded-[8px] border border-red-300/30 bg-red-500/10 px-4 py-3 text-sm leading-6 text-red-100"
      >
        {{ error }}
      </div>

      <section
        class="mt-6 overflow-hidden rounded-[8px] border border-white/12 bg-[#07100e]/86 shadow-[0_24px_90px_rgba(0,0,0,0.28)] backdrop-blur-2xl"
      >
        <div v-if="isLoading" class="px-5 py-12 text-center text-sm text-white/62">
          {{ t('users.fields.status') }}...
        </div>

        <div
          v-else-if="sortedUsers.length === 0"
          class="px-5 py-12 text-center text-sm text-white/62"
        >
          {{ t('users.index.empty') }}
        </div>

        <div v-else class="overflow-x-auto">
          <table class="min-w-full border-collapse text-left text-sm">
            <thead class="bg-white/[0.055] text-xs uppercase text-white/48">
              <tr>
                <th class="px-4 py-3 font-semibold">{{ t('users.fields.id') }}</th>
                <th class="px-4 py-3 font-semibold">{{ t('auth.fields.name') }}</th>
                <th class="px-4 py-3 font-semibold">{{ t('auth.fields.email') }}</th>
                <th class="px-4 py-3 font-semibold">{{ t('users.fields.profile') }}</th>
                <th class="px-4 py-3 font-semibold">{{ t('users.fields.status') }}</th>
                <th class="px-4 py-3 font-semibold">{{ t('users.fields.updatedAt') }}</th>
                <th class="px-4 py-3 text-right font-semibold"></th>
              </tr>
            </thead>
            <tbody class="divide-y divide-white/8">
              <tr v-for="user in sortedUsers" :key="user.id" class="align-middle">
                <td class="px-4 py-4 font-semibold text-white/72">#{{ user.id }}</td>
                <td class="px-4 py-4">
                  <RouterLink
                    :to="{ name: 'users-show', params: { id: user.id } }"
                    class="font-semibold text-white transition hover:text-[var(--mode-accent)]"
                  >
                    {{ user.name }}
                  </RouterLink>
                </td>
                <td class="max-w-[18rem] truncate px-4 py-4 text-white/66">
                  {{ user.email }}
                </td>
                <td class="px-4 py-4 text-white/66">{{ profileName(user) }}</td>
                <td class="px-4 py-4">
                  <Tag
                    :value="
                      user.email_verified_at
                        ? t('users.fields.verified')
                        : t('users.fields.unverified')
                    "
                    :severity="user.email_verified_at ? 'success' : 'warn'"
                  />
                </td>
                <td class="px-4 py-4 text-white/58">{{ formatDate(user.updated_at) }}</td>
                <td class="px-4 py-4">
                  <div class="flex justify-end gap-2">
                    <RouterLink :to="{ name: 'users-show', params: { id: user.id } }">
                      <Button
                        icon="pi pi-eye"
                        severity="secondary"
                        text
                        rounded
                        :aria-label="t('users.actions.view')"
                        class="!text-white/72 hover:!bg-white/10"
                      />
                    </RouterLink>
                    <RouterLink :to="{ name: 'users-edit', params: { id: user.id } }">
                      <Button
                        icon="pi pi-pencil"
                        severity="secondary"
                        text
                        rounded
                        :aria-label="t('users.actions.edit')"
                        class="!text-white/72 hover:!bg-white/10"
                      />
                    </RouterLink>
                    <Button
                      icon="pi pi-trash"
                      severity="danger"
                      text
                      rounded
                      :loading="deletingUserId === user.id"
                      :aria-label="t('users.actions.delete')"
                      class="hover:!bg-red-500/10"
                      @click="deleteUser(user)"
                    />
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
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
