<script setup lang="ts">
import { useRouter } from 'vue-router'

import FlowCreationGuide from '@/components/flows/FlowCreationGuide.vue'

const router = useRouter()

const handleCreated = async () => {
  await router.push({ name: 'flows-index', query: { created: '1' } })
}
</script>

<template>
  <main class="flow-create-page dark min-h-screen text-[#f7fbf8]">
    <FlowCreationGuide compact @created="handleCreated" />
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
