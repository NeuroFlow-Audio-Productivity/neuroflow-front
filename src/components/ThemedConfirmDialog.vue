<script setup lang="ts">
import Button from 'primevue/button'
import ConfirmDialog from 'primevue/confirmdialog'
</script>

<template>
  <ConfirmDialog
    group="theme"
    :draggable="false"
    class="theme-confirm-dialog"
    :pt="{ mask: { class: 'theme-confirm-mask' } }"
  >
    <template #container="{ message, acceptCallback, rejectCallback }">
      <section class="theme-confirm-card">
        <div class="theme-confirm-body">
          <div class="theme-confirm-icon" aria-hidden="true">
            <i :class="message.icon || 'pi pi-exclamation-triangle'" />
          </div>

          <div class="theme-confirm-copy">
            <h2>{{ message.header }}</h2>
            <p>{{ message.message }}</p>
          </div>
        </div>

        <div class="theme-confirm-actions">
          <Button
            :label="message.rejectLabel"
            icon="pi pi-times"
            class="theme-confirm-cancel"
            autofocus
            @click="rejectCallback"
          />
          <Button
            :label="message.acceptLabel"
            icon="pi pi-trash"
            class="theme-confirm-accept"
            @click="acceptCallback"
          />
        </div>
      </section>
    </template>
  </ConfirmDialog>
</template>

<style scoped>
:global(.theme-confirm-mask) {
  background: rgba(1, 7, 7, 0.76) !important;
  backdrop-filter: blur(7px);
}

:global(html[data-fast-mode='true'] .theme-confirm-mask) {
  backdrop-filter: none;
}

:deep(.p-dialog) {
  margin: 1rem;
  border: 0 !important;
  border-radius: 8px !important;
  background: transparent !important;
  box-shadow: none !important;
}

.theme-confirm-card {
  position: relative;
  width: min(calc(100vw - 2rem), 27rem);
  overflow: hidden;
  border: 1px solid rgba(var(--theme-border-rgb), 0.14);
  border-radius: 8px;
  background: rgba(var(--theme-surface-rgb), 0.98);
  color: #f7fbf8;
  box-shadow:
    0 1.5rem 4rem rgba(var(--theme-shadow-rgb), 0.46),
    inset 0 1px 0 rgba(var(--theme-text-rgb), 0.045);
}

.theme-confirm-card::before {
  position: absolute;
  top: 0;
  right: 3rem;
  left: 3rem;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--mode-accent), transparent);
  content: '';
  opacity: 0.7;
  pointer-events: none;
}

.theme-confirm-body {
  display: flex;
  align-items: flex-start;
  gap: 0.9rem;
  padding: 1.3rem 1.3rem 1.15rem;
}

.theme-confirm-icon {
  display: grid;
  width: 2.35rem;
  height: 2.35rem;
  flex: 0 0 auto;
  place-items: center;
  border: 1px solid rgba(248, 113, 113, 0.25);
  border-radius: 8px;
  background: rgba(248, 113, 113, 0.08);
  color: #fca5a5;
  font-size: 0.9rem;
}

.theme-confirm-copy {
  min-width: 0;
  padding-top: 0.05rem;
}

.theme-confirm-copy h2 {
  margin: 0;
  color: rgb(var(--theme-text-rgb));
  font-size: 1.15rem;
  font-weight: 720;
  letter-spacing: 0;
  line-height: 1.3;
}

.theme-confirm-copy p {
  margin: 0.38rem 0 0;
  color: rgba(var(--theme-text-rgb), 0.58);
  font-size: 0.9rem;
  line-height: 1.55;
  overflow-wrap: anywhere;
}

.theme-confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.6rem;
  border-top: 1px solid rgba(var(--theme-text-rgb), 0.08);
  padding: 0.85rem 1.3rem 1rem;
}

.theme-confirm-cancel,
.theme-confirm-accept {
  min-height: 2.55rem;
  justify-content: center !important;
  border-radius: 7px !important;
  padding-inline: 0.9rem !important;
  font-size: 0.875rem !important;
  font-weight: 680 !important;
  box-shadow: none !important;
  transition:
    border-color 160ms ease,
    background 160ms ease,
    color 160ms ease !important;
}

.theme-confirm-cancel {
  border-color: rgba(var(--theme-border-rgb), 0.14) !important;
  background: transparent !important;
  color: rgba(var(--theme-text-rgb), 0.68) !important;
}

.theme-confirm-cancel:hover {
  border-color: rgba(var(--theme-text-rgb), 0.2) !important;
  background: rgba(var(--theme-text-rgb), 0.055) !important;
  color: rgb(var(--theme-text-rgb)) !important;
}

.theme-confirm-accept {
  border-color: rgba(248, 113, 113, 0.28) !important;
  background: rgba(248, 113, 113, 0.1) !important;
  color: #fca5a5 !important;
}

.theme-confirm-accept:hover {
  border-color: rgba(248, 113, 113, 0.42) !important;
  background: rgba(248, 113, 113, 0.17) !important;
  color: #fecaca !important;
}

.theme-confirm-cancel:focus-visible,
.theme-confirm-accept:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--mode-accent), transparent 28%) !important;
  outline-offset: 2px;
}

@media (max-width: 420px) {
  .theme-confirm-body {
    padding: 1.1rem 1.05rem 1rem;
  }

  .theme-confirm-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    padding: 0.8rem 1.05rem 1rem;
  }
}
</style>
