<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import AppNavbar from '@/components/AppNavbar.vue'
import FlowCreationGuide from '@/components/flows/FlowCreationGuide.vue'

const { t } = useI18n()
const router = useRouter()

const handleCreated = async () => {
  await router.push({ name: 'flows-index', query: { created: '1' } })
}
</script>

<template>
  <main class="flow-create-page dark min-h-screen px-4 py-4 text-[#f7fbf8] sm:px-6 lg:px-8">
    <AppNavbar />

    <section class="mx-auto max-w-5xl py-8 sm:py-10">
      <RouterLink
        class="theme-accent-link inline-flex items-center gap-2 text-sm font-semibold"
        to="/flows"
      >
        <i class="pi pi-arrow-left text-xs" aria-hidden="true" />
        <span>{{ t('flowResource.actions.back') }}</span>
      </RouterLink>

      <div class="mt-6">
        <p class="text-sm font-semibold uppercase text-[var(--mode-accent)]">
          {{ t('flowResource.create.eyebrow') }}
        </p>
        <h1 class="mt-3 text-4xl font-semibold leading-tight text-white sm:text-5xl">
          {{ t('flowResource.create.title') }}
        </h1>
        <p class="mt-3 max-w-2xl text-base leading-7 text-white/66">
          {{ t('flowResource.create.subtitle') }}
        </p>
      </div>

      <FlowCreationGuide class="mt-6" @created="handleCreated" />
    </section>
  </main>
</template>

<style scoped>
.flow-create-page {
  background:
    radial-gradient(circle at 78% 8%, rgba(var(--mode-companion-rgb), 0.16), transparent 34rem),
    radial-gradient(circle at 6% 68%, rgba(var(--mode-glow-rgb), 0.13), transparent 32rem),
    linear-gradient(180deg, #06100e 0%, #081512 48%, #06100e 100%);
}
</style>
