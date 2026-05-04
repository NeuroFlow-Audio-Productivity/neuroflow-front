<script setup lang="ts">
import AppNavbar from '@/components/AppNavbar.vue'

defineProps<{
  eyebrow: string
  title: string
  subtitle: string
  alternateLabel: string
  alternateTo: string
}>()

const bars = Array.from({ length: 22 }, (_, index) => index)

const barStyle = (index: number) => ({
  height: `${32 + Math.abs(Math.sin(index * 0.72)) * 58}%`,
  animationDelay: `${index * -0.06}s`,
  animationDuration: `${1.15 + (index % 5) * 0.14}s`,
})
</script>

<template>
  <main class="auth-page dark min-h-screen overflow-hidden text-[#f7fbf8]">
    <section class="relative isolate min-h-screen px-4 py-4 sm:px-6 lg:px-8">
      <div aria-hidden="true" class="auth-vignette absolute inset-0 -z-10" />

      <AppNavbar :alternate-label="alternateLabel" :alternate-to="alternateTo" />

      <div
        class="mx-auto grid min-h-[calc(100svh-5.5rem)] max-w-7xl items-center gap-10 py-10 lg:grid-cols-[minmax(0,0.88fr)_minmax(360px,0.62fr)]"
      >
        <div class="max-w-3xl">
          <p class="text-sm font-semibold uppercase text-[var(--mode-accent)]">{{ eyebrow }}</p>
          <h1 class="mt-4 text-5xl font-semibold leading-none text-white sm:text-6xl lg:text-7xl">
            {{ title }}
          </h1>
          <p class="mt-6 max-w-2xl text-lg leading-8 text-white/72">
            {{ subtitle }}
          </p>

          <div
            class="mt-10 hidden rounded-[8px] border border-white/10 bg-white/[0.045] p-5 shadow-[0_28px_90px_rgba(0,0,0,0.28)] backdrop-blur-xl md:block"
            aria-hidden="true"
          >
            <div class="flex h-32 items-end gap-1.5">
              <span
                v-for="bar in bars"
                :key="bar"
                class="auth-wave-bar flex-1 rounded-full bg-[var(--mode-accent)]/80"
                :style="barStyle(bar)"
              />
            </div>
          </div>
        </div>

        <section
          class="auth-card rounded-[8px] border border-white/12 bg-[#07100e]/86 p-5 shadow-[0_24px_90px_rgba(0,0,0,0.38)] backdrop-blur-2xl sm:p-6"
        >
          <slot />
        </section>
      </div>
    </section>
  </main>
</template>

<style scoped>
.auth-page {
  background:
    radial-gradient(circle at 68% 12%, rgba(var(--mode-glow-rgb), 0.16), transparent 34rem),
    radial-gradient(circle at 0% 58%, rgba(var(--mode-companion-rgb), 0.12), transparent 34rem),
    linear-gradient(180deg, #06100e 0%, #081512 48%, #06100e 100%);
}

.auth-vignette {
  background:
    radial-gradient(circle at 16% 82%, rgba(var(--mode-glow-rgb), 0.2), transparent 25%),
    linear-gradient(180deg, rgba(0, 0, 0, 0.08), rgba(6, 16, 14, 0.96) 92%);
}

.auth-card {
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    0 0 0 1px rgba(255, 255, 255, 0.02),
    0 28px 90px rgba(0, 0, 0, 0.36);
}

.auth-wave-bar {
  min-width: 5px;
  animation-name: breathe;
  animation-iteration-count: infinite;
  animation-timing-function: ease-in-out;
  transform-origin: bottom;
}

@keyframes breathe {
  0%,
  100% {
    transform: scaleY(0.58);
    opacity: 0.48;
  }

  50% {
    transform: scaleY(1);
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .auth-wave-bar {
    animation: none;
  }
}
</style>
