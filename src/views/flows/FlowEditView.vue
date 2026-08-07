<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import Button from 'primevue/button'

import FlowBuilder from '@/components/flow-builder/FlowBuilder.vue'
import AppNavbar from '@/components/AppNavbar.vue'
import { ApiError } from '@/services/authApi'
import { translateApiKey, translateApiMessage } from '@/services/apiMessageTranslator'
import { flowApi } from '@/services/flowApi'
import { useAuthStore } from '@/stores/auth'
import type { Flow } from '@/types/flow'

const { t } = useI18n()
const auth = useAuthStore()
const route = useRoute()

const flow = ref<Flow | null>(null)
const isLoading = ref(false)
const error = ref<string | null>(null)

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

const loadFlow = async () => {
  if (!auth.token) return

  const flowId = String(route.params.id ?? '')

  if (!flowId) {
    error.value = t('flowResource.errors.missingFlow')
    return
  }

  isLoading.value = true
  error.value = null

  try {
    flow.value = await flowApi.getFlow(auth.token, flowId)
  } catch (caughtError) {
    setError(caughtError, 'flowResource.errors.loadFlow')
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  void loadFlow()
})
</script>

<template>
  <main
    class="flow-edit-page min-h-screen px-4 py-4 text-[rgb(var(--theme-text-rgb))] sm:px-6 lg:px-8"
  >
    <AppNavbar />

    <section class="mx-auto max-w-5xl py-8 sm:py-10">
      <RouterLink to="/flows">
        <Button
          :label="t('flowResource.actions.back')"
          icon="pi pi-arrow-left"
          severity="secondary"
          text
          class="!text-white/72 hover:!bg-white/10"
        />
      </RouterLink>

      <div
        v-if="isLoading"
        class="mt-6 rounded-[8px] border border-white/12 bg-[#07100e]/86 px-5 py-12 text-center text-sm text-white/62 shadow-[0_24px_90px_rgba(0,0,0,0.28)] backdrop-blur-2xl"
      >
        {{ t('flowResource.builder.loading') }}
      </div>

      <div
        v-else-if="error"
        class="mt-6 rounded-[8px] border border-red-300/30 bg-red-500/10 px-4 py-3 text-sm leading-6 text-red-100"
      >
        {{ error }}
      </div>

      <FlowBuilder v-else-if="flow" class="mt-6" :flow="flow" @update:flow="flow = $event" />
    </section>
  </main>
</template>

<style scoped>
.flow-edit-page {
  background:
    radial-gradient(circle at 74% 8%, rgba(var(--mode-companion-rgb), 0.15), transparent 34rem),
    radial-gradient(circle at 8% 68%, rgba(var(--mode-glow-rgb), 0.13), transparent 32rem),
    linear-gradient(180deg, #06100e 0%, #081512 48%, #06100e 100%);
}
</style>
