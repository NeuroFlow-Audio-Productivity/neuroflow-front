<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>

<template>
  <nav class="settings-section-nav" :aria-label="t('nav.settings')">
    <RouterLink class="settings-section-link" to="/settings/account">
      <i class="pi pi-user" aria-hidden="true" />
      <span>{{ t('users.settings.accountTitle') }}</span>
    </RouterLink>
    <RouterLink class="settings-section-link" to="/settings/customization">
      <i class="pi pi-palette" aria-hidden="true" />
      <span>{{ t('users.settings.customizationTitle') }}</span>
    </RouterLink>
  </nav>
</template>

<style scoped>
.settings-section-nav {
  display: grid;
  gap: 0.75rem;
}

.settings-section-link {
  display: flex;
  min-height: 3.15rem;
  align-items: center;
  gap: 0.7rem;
  border: 1px solid rgba(var(--theme-text-rgb), 0.1);
  border-radius: 8px;
  background: rgba(var(--theme-text-rgb), 0.045);
  padding: 0.85rem 1rem;
  color: rgba(var(--theme-text-rgb), 0.72);
  font-size: 0.925rem;
  font-weight: 700;
  transition:
    background 160ms ease,
    border-color 160ms ease,
    color 160ms ease;
}

.settings-section-link:hover,
.settings-section-link.router-link-active {
  border-color: color-mix(in srgb, var(--mode-accent), transparent 48%);
  background: color-mix(in srgb, var(--mode-accent), transparent 88%);
  color: var(--mode-soft);
}

@media (min-width: 640px) {
  .settings-section-nav {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
