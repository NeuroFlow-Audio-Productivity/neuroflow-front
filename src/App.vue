<script setup lang="ts">
import { watchEffect } from 'vue'
import { RouterView } from 'vue-router'

import { useVisualThemeStore } from '@/stores/visualTheme'

const visualTheme = useVisualThemeStore()

watchEffect(() => {
  visualTheme.applyDocumentTheme()
})
</script>

<template>
  <RouterView />
</template>
