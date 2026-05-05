<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import ProgressBar from 'primevue/progressbar'
import SelectButton from 'primevue/selectbutton'
import Tag from 'primevue/tag'
import AppNavbar from '@/components/AppNavbar.vue'
import {
  useVisualThemeStore,
  visualModeConfigs,
  type VisualModeConfig,
  type VisualModeKey,
} from '@/stores/visualTheme'

type Mode = {
  key: VisualModeKey
  label: string
  title: string
  subtitle: string
  frequency: string
  description: string
  accent: string
  soft: string
  ink: string
  progress: number
  icon: string
}

type PillarKey = 'subscription' | 'tracking' | 'server'

type PillarConfig = {
  key: PillarKey
  icon: string
}

const { t } = useI18n()
const visualTheme = useVisualThemeStore()

const pillarConfigs: PillarConfig[] = [
  {
    key: 'subscription',
    icon: 'pi pi-wallet',
  },
  {
    key: 'tracking',
    icon: 'pi pi-shield',
  },
  {
    key: 'server',
    icon: 'pi pi-wifi',
  },
]

const modeFromConfig = (mode: VisualModeConfig): Mode => ({
  ...mode,
  label: t(`modes.${mode.key}.label`),
  title: t(`modes.${mode.key}.title`),
  subtitle: t(`modes.${mode.key}.subtitle`),
  description: t(`modes.${mode.key}.description`),
})

const modes = computed<Mode[]>(() => visualModeConfigs.map(modeFromConfig))

const pillars = computed(() =>
  pillarConfigs.map((pillar) => ({
    icon: pillar.icon,
    title: t(`privacy.pillars.${pillar.key}.title`),
    text: t(`privacy.pillars.${pillar.key}.text`),
  })),
)

const steps = computed(() => [0, 1, 2].map((index) => t(`process.steps.${index}`)))

const modeOptions = computed(() =>
  modes.value.map((mode) => ({
    label: mode.label,
    value: mode.key,
  })),
)

const selectedMode = computed<VisualModeKey>({
  get: () => visualTheme.selectedMode,
  set: (mode) => visualTheme.setMode(mode),
})
const isPlaying = ref(true)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const bars = Array.from({ length: 34 }, (_, index) => index)

const activeMode = computed<Mode>(
  () =>
    modes.value.find((mode) => mode.key === selectedMode.value) ??
    modeFromConfig(visualTheme.activeMode),
)

const pageStyle = computed(() => visualTheme.cssVars)

const barStyle = (index: number) => {
  const ratio = Math.sin(index * 0.72) * 0.5 + Math.cos(index * 0.21) * 0.5
  const height = 28 + Math.abs(ratio) * 58 + (index % 4) * 3

  return {
    height: `${Math.min(height, 92)}%`,
    animationDelay: `${index * -0.055}s`,
    animationDuration: `${1.1 + (index % 6) * 0.12}s`,
  }
}

const modeCardStyle = (mode: Mode) =>
  ({
    '--card-accent': mode.accent,
    borderColor: `${mode.accent}33`,
  }) as Record<string, string>

const modeIconStyle = (mode: Mode) => ({
  backgroundColor: `${mode.accent}20`,
  borderColor: `${mode.accent}4d`,
  color: mode.accent,
})

let animationFrame = 0
let resizeObserver: ResizeObserver | undefined

onMounted(() => {
  const canvas = canvasRef.value
  const context = canvas?.getContext('2d')

  if (!canvas || !context) return

  const resize = () => {
    const parent = canvas.parentElement
    const width = parent?.clientWidth ?? window.innerWidth
    const height = parent?.clientHeight ?? window.innerHeight
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)

    canvas.width = width * pixelRatio
    canvas.height = height * pixelRatio
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
  }

  const draw = (time: number) => {
    const width = canvas.clientWidth
    const height = canvas.clientHeight
    const mode = activeMode.value
    const pulse = isPlaying.value ? time / 1000 : 0

    context.clearRect(0, 0, width, height)

    const base = context.createLinearGradient(0, 0, width, height)
    base.addColorStop(0, '#06100e')
    base.addColorStop(0.44, '#0b1714')
    base.addColorStop(1, '#130d22')
    context.fillStyle = base
    context.fillRect(0, 0, width, height)

    const glow = context.createRadialGradient(
      width * 0.68,
      height * 0.34,
      0,
      width * 0.68,
      height * 0.34,
      Math.max(width, height) * 0.62,
    )
    glow.addColorStop(0, `${mode.accent}66`)
    glow.addColorStop(0.34, `${mode.accent}24`)
    glow.addColorStop(1, 'rgba(6, 16, 14, 0)')
    context.fillStyle = glow
    context.fillRect(0, 0, width, height)

    context.lineWidth = 1
    context.strokeStyle = 'rgba(255,255,255,0.1)'
    for (let ring = 0; ring < 5; ring += 1) {
      const radius = Math.max(width, height) * (0.16 + ring * 0.105)
      const drift = Math.sin(pulse * 0.28 + ring) * 12
      context.beginPath()
      context.ellipse(
        width * 0.55 + drift,
        height * 0.44 - drift * 0.22,
        radius,
        radius * 0.56,
        -0.26 + ring * 0.045,
        0,
        Math.PI * 2,
      )
      context.stroke()
    }

    const lanes = 5
    for (let lane = 0; lane < lanes; lane += 1) {
      const y = height * (0.34 + lane * 0.105)
      const amplitude = 18 + lane * 7
      context.beginPath()
      for (let x = -20; x <= width + 20; x += 10) {
        const wave =
          Math.sin(x * 0.012 + pulse * (0.68 + lane * 0.13)) * amplitude +
          Math.sin(x * 0.027 - pulse * 0.5) * (amplitude * 0.36)
        const nextY = y + wave
        if (x === -20) context.moveTo(x, nextY)
        else context.lineTo(x, nextY)
      }
      context.strokeStyle = lane === 2 ? `${mode.accent}b8` : 'rgba(255,255,255,0.12)'
      context.lineWidth = lane === 2 ? 2 : 1
      context.stroke()
    }

    const particles = 58
    for (let particle = 0; particle < particles; particle += 1) {
      const seed = particle * 17.17
      const x = ((Math.sin(seed) * 0.5 + 0.5) * width + Math.sin(pulse * 0.15 + seed) * 18) % width
      const y = (Math.cos(seed * 0.74) * 0.5 + 0.5) * height + Math.cos(pulse * 0.22 + seed) * 14
      const size = 1 + (particle % 4) * 0.4
      context.fillStyle = particle % 7 === 0 ? `${mode.soft}b0` : 'rgba(255,255,255,0.26)'
      context.beginPath()
      context.arc(x, y, size, 0, Math.PI * 2)
      context.fill()
    }

    animationFrame = window.requestAnimationFrame(draw)
  }

  resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(canvas.parentElement ?? canvas)
  resize()
  animationFrame = window.requestAnimationFrame(draw)
})

onBeforeUnmount(() => {
  if (animationFrame) window.cancelAnimationFrame(animationFrame)
  resizeObserver?.disconnect()
})
</script>

<template>
  <main class="neuro-page dark min-h-screen overflow-hidden text-[#f7fbf8]" :style="pageStyle">
    <section class="relative isolate overflow-clip px-4 pb-20 pt-4 sm:px-6 lg:px-8">
      <canvas ref="canvasRef" aria-hidden="true" class="absolute inset-0 -z-20 h-full w-full" />
      <div aria-hidden="true" class="hero-vignette absolute inset-0 -z-10" />
      <div aria-hidden="true" class="section-flow-bg section-flow-bg--modes" />

      <div class="relative flex min-h-[86svh] flex-col">
        <AppNavbar marketing-links />

        <div
          class="mx-auto grid w-[calc(100vw-2rem)] max-w-7xl flex-1 items-center gap-8 py-6 sm:w-full md:grid-cols-[minmax(0,1fr)_minmax(330px,0.64fr)] md:py-8"
        >
          <div class="w-full min-w-0 max-w-[22rem] sm:max-w-2xl lg:max-w-4xl">
            <div class="flex flex-wrap gap-2">
              <Tag :value="t('hero.tags.openSource')" class="!bg-white/12 !text-white" />
              <Tag
                :value="t('hero.tags.browserOnly')"
                class="!bg-[var(--mode-soft)] !text-[var(--mode-ink)]"
              />
              <Tag :value="t('hero.tags.noTracking')" class="!bg-white/12 !text-white" />
            </div>

            <h1 class="mt-6 text-5xl font-semibold leading-none text-white sm:text-6xl lg:text-8xl">
              NeuroFlow
            </h1>
            <p class="mt-5 max-w-full text-lg leading-8 text-white/78 sm:max-w-2xl sm:text-xl">
              {{ t('hero.copy') }}
            </p>

            <div class="mt-7 flex w-full max-w-[22rem] flex-col gap-3 sm:max-w-none sm:flex-row">
              <RouterLink
                to="/auth/register"
                class="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full border-0 bg-[var(--mode-accent)] px-6 font-semibold text-[var(--mode-ink)] transition hover:brightness-110 sm:w-auto"
              >
                <i class="pi pi-play" aria-hidden="true" />
                <span>{{ t('hero.start') }}</span>
              </RouterLink>
              <Button
                as="a"
                href="#how-it-works"
                :label="t('hero.engine')"
                icon="pi pi-arrow-down"
                rounded
                outlined
                class="!w-full !justify-center !border-white/18 !px-6 !py-3 !text-white hover:!bg-white/10 sm:!w-auto"
              />
            </div>
          </div>

          <aside
            class="player-shell hidden min-w-0 rounded-[8px] border border-white/12 bg-[#07100e]/82 p-4 shadow-[0_24px_90px_rgba(0,0,0,0.38)] backdrop-blur-2xl md:block"
            :aria-label="t('player.preview')"
          >
            <div class="flex items-center justify-between gap-4">
              <div class="min-w-0">
                <p class="text-sm text-white/55">{{ t('player.sessionActive') }}</p>
                <h2 class="mt-1 truncate text-2xl font-semibold">{{ activeMode.title }}</h2>
              </div>
              <button
                class="grid size-12 shrink-0 place-items-center rounded-full border border-white/12 bg-white/10 text-white transition hover:bg-white/16"
                type="button"
                :aria-label="isPlaying ? t('player.pause') : t('player.play')"
                @click="isPlaying = !isPlaying"
              >
                <i :class="isPlaying ? 'pi pi-pause' : 'pi pi-play'" />
              </button>
            </div>

            <SelectButton
              v-model="selectedMode"
              :options="modeOptions"
              option-label="label"
              option-value="value"
              :allow-empty="false"
              class="mode-switch mt-5 w-full"
              :aria-label="t('player.selectMode')"
            />

            <div class="mt-7 min-w-0 overflow-hidden rounded-[8px] border border-white/10 bg-white/[0.035] p-4 sm:p-5">
              <div class="flex items-start justify-between gap-4">
                <div>
                  <p class="text-sm text-[var(--mode-accent)]">{{ activeMode.frequency }}</p>
                  <p class="mt-2 max-w-xs text-base leading-7 text-white/70">
                    {{ activeMode.subtitle }}
                  </p>
                </div>
                <span
                  class="grid size-11 shrink-0 place-items-center rounded-full bg-[var(--mode-soft)] text-[var(--mode-ink)]"
                >
                  <i :class="activeMode.icon" />
                </span>
              </div>

              <div class="wave-meter mt-8 flex h-28 min-w-0 items-end overflow-hidden" aria-hidden="true">
                <span
                  v-for="bar in bars"
                  :key="bar"
                  class="wave-bar flex-1 rounded-full bg-[var(--mode-accent)]/80"
                  :style="barStyle(bar)"
                />
              </div>

              <ProgressBar
                :value="activeMode.progress"
                :show-value="false"
                class="neuro-progress mt-6"
              />
            </div>
          </aside>
        </div>
      </div>

      <div id="modes" class="relative mx-auto max-w-7xl pt-14 sm:pt-20">
        <div class="grid gap-8 lg:grid-cols-[0.78fr_1fr] lg:items-end">
          <div>
            <p class="text-sm font-semibold uppercase text-[var(--mode-accent)]">
              {{ t('modesSection.eyebrow') }}
            </p>
            <h2 class="mt-3 text-4xl font-semibold leading-tight sm:text-5xl">
              {{ t('modesSection.title') }}
            </h2>
          </div>
          <p class="max-w-2xl text-lg leading-8 text-white/68 lg:justify-self-end">
            {{ t('modesSection.copy') }}
          </p>
        </div>

        <div class="mt-10 grid gap-4 md:grid-cols-3">
          <article
            v-for="mode in modes"
            :key="mode.key"
            class="mode-card rounded-[8px] border bg-white/[0.045] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.22)] backdrop-blur transition duration-300 hover:-translate-y-1 hover:bg-white/[0.065]"
            :style="modeCardStyle(mode)"
          >
            <span
              class="grid size-12 place-items-center rounded-full border"
              :style="modeIconStyle(mode)"
            >
              <i :class="mode.icon" />
            </span>
            <h3 class="mt-6 text-2xl font-semibold">{{ mode.title }}</h3>
            <p class="mt-3 text-base leading-7 text-white/64">{{ mode.description }}</p>
            <p class="mt-6 text-sm font-semibold" :style="{ color: mode.accent }">
              {{ mode.frequency }}
            </p>
          </article>
        </div>
      </div>
    </section>

    <section id="privacy" class="bg-[#06100e] px-4 py-16 text-white sm:px-6 lg:px-8">
      <div class="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.72fr_1fr] lg:items-center">
        <div>
          <p class="text-sm font-semibold uppercase text-[var(--mode-accent)]">
            {{ t('privacy.eyebrow') }}
          </p>
          <h2 class="mt-3 text-4xl font-semibold leading-tight sm:text-5xl">
            {{ t('privacy.title') }}
          </h2>
        </div>

        <div class="grid gap-4 sm:grid-cols-3">
          <article
            v-for="pillar in pillars"
            :key="pillar.title"
            class="rounded-[8px] border border-white/10 bg-white/[0.045] p-5"
          >
            <i :class="[pillar.icon, 'text-2xl text-[var(--mode-accent)]']" />
            <h3 class="mt-5 text-lg font-semibold">{{ pillar.title }}</h3>
            <p class="mt-3 text-sm leading-6 text-white/64">{{ pillar.text }}</p>
          </article>
        </div>
      </div>
    </section>

    <section
      id="how-it-works"
      class="relative overflow-hidden px-4 py-20 text-white sm:px-6 lg:px-8"
    >
      <div aria-hidden="true" class="section-flow-bg section-flow-bg--process" />
      <div class="relative mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1fr_0.82fr] lg:items-center">
        <div
          class="rounded-[8px] border border-white/10 bg-white/[0.045] p-4 shadow-[0_28px_90px_rgba(0,0,0,0.28)]"
        >
          <div class="sound-lab rounded-[8px] p-5 text-white">
            <div class="flex items-center justify-between">
              <span class="text-sm text-white/62">{{ t('process.engineLocal') }}</span>
              <span class="rounded-full bg-white/10 px-3 py-1 text-xs">Web Audio API</span>
            </div>
            <div class="mt-10 grid grid-cols-12 items-end gap-2" aria-hidden="true">
              <span
                v-for="bar in bars.slice(0, 24)"
                :key="`lab-${bar}`"
                class="lab-bar col-span-1 rounded-t-full bg-white"
                :style="barStyle(bar + 5)"
              />
            </div>
            <div class="mt-8 grid gap-3 sm:grid-cols-3">
              <span class="rounded-[8px] bg-white/10 px-4 py-3 text-sm">
                {{ t('process.oscillators') }}
              </span>
              <span class="rounded-[8px] bg-white/10 px-4 py-3 text-sm">
                {{ t('process.filters') }}
              </span>
              <span class="rounded-[8px] bg-white/10 px-4 py-3 text-sm">
                {{ t('process.envelopes') }}
              </span>
            </div>
          </div>
        </div>

        <div>
          <p class="text-sm font-semibold uppercase text-[var(--mode-accent)]">
            {{ t('process.eyebrow') }}
          </p>
          <h2 class="mt-3 text-4xl font-semibold leading-tight sm:text-5xl">
            {{ t('process.title') }}
          </h2>
          <ol class="mt-8 space-y-4">
            <li
              v-for="(step, index) in steps"
              :key="step"
              class="flex gap-4 rounded-[8px] border border-white/10 bg-white/[0.045] p-4 shadow-[0_18px_60px_rgba(0,0,0,0.18)]"
            >
              <span
                class="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--mode-soft)] text-sm font-semibold text-[var(--mode-ink)]"
              >
                {{ index + 1 }}
              </span>
              <span class="pt-1 text-base leading-7 text-white/68">{{ step }}</span>
            </li>
          </ol>
        </div>
      </div>
    </section>

    <section id="opensource" class="bg-[#06100e] px-4 py-16 text-white sm:px-6 lg:px-8">
      <div
        class="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 border-t border-white/10 pt-10 md:flex-row md:items-center"
      >
        <div>
          <p class="text-sm font-semibold uppercase text-[rgb(var(--mode-companion-rgb))]">
            {{ t('openSource.eyebrow') }}
          </p>
          <h2 class="mt-3 max-w-3xl text-4xl font-semibold leading-tight sm:text-5xl">
            {{ t('openSource.title') }}
          </h2>
        </div>
        <Button
          as="a"
          href="https://github.com"
          target="_blank"
          rel="noreferrer"
          :label="t('openSource.repo')"
          icon="pi pi-github"
          rounded
          class="theme-soft-button !px-6 !py-3 !font-semibold"
        />
      </div>
    </section>
  </main>
</template>

<style scoped>
.neuro-page {
  background:
    radial-gradient(
      circle at 62% 0%,
      color-mix(in srgb, var(--mode-accent), transparent 88%),
      transparent 34rem
    ),
    radial-gradient(circle at 0% 48%, rgba(var(--mode-glow-rgb), 0.08), transparent 34rem),
    linear-gradient(180deg, #06100e 0%, #081512 46%, #06100e 100%);
}

.hero-vignette {
  background:
    radial-gradient(
      circle at 15% 85%,
      color-mix(in srgb, var(--mode-accent), transparent 76%),
      transparent 25%
    ),
    linear-gradient(180deg, rgba(0, 0, 0, 0.08), rgba(6, 16, 14, 0.96) 92%);
}

.hero-vignette::after {
  content: '';
  position: absolute;
  inset: auto 0 -210px;
  height: 390px;
  background: linear-gradient(
    180deg,
    rgba(6, 16, 14, 0),
    rgba(6, 16, 14, 0.92) 48%,
    rgba(6, 16, 14, 0) 100%
  );
}

.section-flow-bg {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.section-flow-bg--modes {
  background:
    radial-gradient(
      circle at 18% 44%,
      color-mix(in srgb, var(--mode-accent), transparent 86%),
      transparent 31%
    ),
    radial-gradient(circle at 82% 48%, rgba(var(--mode-companion-rgb), 0.11), transparent 32%),
    linear-gradient(
      180deg,
      rgba(6, 16, 14, 0) 0%,
      rgba(6, 16, 14, 0) 36%,
      rgba(9, 26, 23, 0.48) 54%,
      rgba(10, 24, 21, 0.78) 68%,
      rgba(6, 16, 14, 0) 100%
    );
}

.section-flow-bg--process {
  background:
    radial-gradient(
      circle at 12% 50%,
      color-mix(in srgb, var(--mode-accent), transparent 87%),
      transparent 32%
    ),
    radial-gradient(circle at 84% 55%, rgba(var(--mode-glow-rgb), 0.09), transparent 30%),
    linear-gradient(
      180deg,
      rgba(6, 16, 14, 0) 0%,
      rgba(11, 23, 20, 0.82) 46%,
      rgba(6, 16, 14, 0) 100%
    );
}

.player-shell {
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    0 0 0 1px rgba(255, 255, 255, 0.02),
    0 28px 90px rgba(0, 0, 0, 0.36);
}

.mode-card {
  position: relative;
  overflow: hidden;
}

.mode-card::before {
  content: '';
  position: absolute;
  inset: 0 0 auto;
  height: 2px;
  background: linear-gradient(90deg, transparent, var(--card-accent), transparent);
  opacity: 0.78;
}

.mode-card::after {
  content: '';
  position: absolute;
  inset: auto 18px 0;
  height: 42px;
  background: radial-gradient(ellipse at center, var(--card-accent), transparent 72%);
  opacity: 0.08;
  pointer-events: none;
}

.wave-meter {
  gap: clamp(0.125rem, 0.55vw, 0.375rem);
}

.wave-bar {
  min-width: 0;
  animation-name: breathe;
  animation-iteration-count: infinite;
  animation-timing-function: ease-in-out;
  transform-origin: bottom;
}

.lab-bar {
  min-height: 34px;
  opacity: 0.82;
  animation-name: breathe;
  animation-duration: 1.8s;
  animation-iteration-count: infinite;
  animation-timing-function: ease-in-out;
  transform-origin: bottom;
}

.sound-lab {
  background:
    radial-gradient(circle at 80% 20%, rgba(var(--mode-companion-rgb), 0.36), transparent 28%),
    radial-gradient(
      circle at 8% 90%,
      color-mix(in srgb, var(--mode-accent), transparent 72%),
      transparent 28%
    ),
    linear-gradient(
      135deg,
      #07100e 0%,
      color-mix(in srgb, var(--mode-accent), #07100e 68%) 52%,
      color-mix(in srgb, rgb(var(--mode-companion-rgb)), #07100e 72%) 100%
    );
}

.mode-switch :deep(.p-togglebutton) {
  flex: 1 1 0;
  border-color: rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.7);
}

.mode-switch :deep(.p-togglebutton-checked) {
  border-color: color-mix(in srgb, var(--mode-accent), white 10%);
  background: color-mix(in srgb, var(--mode-accent), transparent 86%);
  color: var(--mode-accent);
  box-shadow:
    -1px 0 0 color-mix(in srgb, var(--mode-accent), white 10%),
    1px 0 0 color-mix(in srgb, var(--mode-accent), white 10%);
  z-index: 1;
}

.mode-switch :deep(.p-togglebutton-checked .p-togglebutton-label) {
  color: var(--mode-accent);
}

.neuro-progress {
  height: 0.5rem;
  border-radius: 999px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.08);
}

.neuro-progress :deep(.p-progressbar-value) {
  background: var(--mode-accent);
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
  .wave-bar,
  .lab-bar {
    animation: none;
  }
}
</style>
