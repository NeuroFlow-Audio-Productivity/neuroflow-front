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
        <div class="theme-confirm-icon" aria-hidden="true">
          <i :class="message.icon || 'pi pi-exclamation-triangle'" />
        </div>

        <div class="theme-confirm-copy">
          <p class="theme-confirm-kicker">NeuroFlow</p>
          <h2>{{ message.header }}</h2>
          <p>{{ message.message }}</p>
        </div>

        <div class="theme-confirm-actions">
          <Button
            :label="message.rejectLabel"
            icon="pi pi-times"
            class="theme-confirm-cancel"
            @click="rejectCallback"
          />
          <Button
            :label="message.acceptLabel"
            icon="pi pi-trash"
            class="theme-confirm-accept"
            autofocus
            @click="acceptCallback"
          />
        </div>
      </section>
    </template>
  </ConfirmDialog>
</template>

<style scoped>
:global(.theme-confirm-mask) {
  background:
    radial-gradient(circle at 50% 34%, rgba(var(--mode-glow-rgb), 0.14), transparent 28rem),
    rgba(1, 5, 5, 0.72) !important;
  backdrop-filter: blur(10px);
}

:deep(.p-dialog) {
  border: 0 !important;
  border-radius: 8px !important;
  background: transparent !important;
  box-shadow: none !important;
}

.theme-confirm-card {
  position: relative;
  width: min(calc(100vw - 2rem), 30rem);
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--mode-accent), transparent 62%);
  border-radius: 8px;
  background:
    radial-gradient(circle at 18% 10%, rgba(var(--mode-glow-rgb), 0.22), transparent 14rem),
    radial-gradient(circle at 90% 92%, rgba(var(--mode-companion-rgb), 0.16), transparent 15rem),
    linear-gradient(145deg, rgba(12, 25, 22, 0.98), rgba(3, 8, 8, 0.98));
  padding: 1.2rem;
  color: #f7fbf8;
  box-shadow:
    0 28px 90px rgba(0, 0, 0, 0.48),
    inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

.theme-confirm-card::before {
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    90deg,
    transparent 0 0.9rem,
    rgba(255, 255, 255, 0.035) 0.95rem 1rem
  );
  content: '';
  opacity: 0.42;
  pointer-events: none;
}

.theme-confirm-icon,
.theme-confirm-copy,
.theme-confirm-actions {
  position: relative;
  z-index: 1;
}

.theme-confirm-icon {
  display: grid;
  width: 3rem;
  height: 3rem;
  place-items: center;
  border: 1px solid rgba(248, 113, 113, 0.42);
  border-radius: 999px;
  background:
    linear-gradient(135deg, rgba(248, 113, 113, 0.24), rgba(var(--mode-glow-rgb), 0.12)),
    rgba(255, 255, 255, 0.065);
  color: #fecaca;
  box-shadow: 0 0 2rem rgba(248, 113, 113, 0.2);
  font-size: 1.2rem;
}

.theme-confirm-copy {
  margin-top: 1rem;
}

.theme-confirm-kicker {
  margin: 0;
  color: var(--mode-accent);
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0;
  line-height: 1.1;
  text-transform: uppercase;
}

.theme-confirm-copy h2 {
  margin: 0.45rem 0 0;
  color: #ffffff;
  font-size: 1.55rem;
  font-weight: 750;
  letter-spacing: 0;
  line-height: 1.15;
}

.theme-confirm-copy p:last-child {
  margin: 0.7rem 0 0;
  color: rgba(255, 255, 255, 0.68);
  font-size: 0.95rem;
  line-height: 1.6;
}

.theme-confirm-actions {
  display: flex;
  flex-direction: column-reverse;
  gap: 0.65rem;
  margin-top: 1.25rem;
}

.theme-confirm-cancel,
.theme-confirm-accept {
  justify-content: center !important;
}

.theme-confirm-cancel {
  border-color: rgba(255, 255, 255, 0.13) !important;
  background: rgba(255, 255, 255, 0.07) !important;
  color: rgba(255, 255, 255, 0.76) !important;
}

.theme-confirm-cancel:hover {
  background: rgba(255, 255, 255, 0.12) !important;
  color: #ffffff !important;
}

.theme-confirm-accept {
  border-color: transparent !important;
  background: linear-gradient(135deg, #fecaca, #f87171) !important;
  color: #3b0707 !important;
  box-shadow: 0 0.85rem 2rem rgba(248, 113, 113, 0.24) !important;
}

.theme-confirm-accept:hover {
  filter: brightness(1.06);
}

@media (min-width: 520px) {
  .theme-confirm-card {
    padding: 1.35rem;
  }

  .theme-confirm-actions {
    flex-direction: row;
    justify-content: flex-end;
  }
}
</style>
