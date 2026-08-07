<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import ToggleSwitch from 'primevue/toggleswitch'

import AppNavbar from '@/components/AppNavbar.vue'
import LocaleSwitcher from '@/components/LocaleSwitcher.vue'
import SettingsSectionNav from '@/components/settings/SettingsSectionNav.vue'
import {
  useVisualThemeStore,
  visualPaletteConfigs,
  type VisualPaletteConfig,
  type VisualPaletteKey,
} from '@/stores/visualTheme'

const { t } = useI18n()
const visualTheme = useVisualThemeStore()

const selectedPalette = computed<VisualPaletteKey>({
  get: () => visualTheme.selectedPalette,
  set: (palette) => visualTheme.setPalette(palette),
})

const fastModeEnabled = computed({
  get: () => visualTheme.fastModeEnabled,
  set: (enabled: boolean) => visualTheme.setFastMode(enabled),
})

const customizationPalettes = computed(() =>
  visualPaletteConfigs.map((palette) => ({
    ...palette,
    label: t(`palettes.${palette.key}.label`),
  })),
)

const customizationPaletteStyle = (palette: VisualPaletteConfig) => ({
  borderColor: `${palette.accent}4d`,
  background: `linear-gradient(135deg, ${palette.accent}24, rgba(255, 255, 255, 0.045))`,
})
</script>

<template>
  <main class="settings-page dark min-h-screen px-4 py-4 text-[#f7fbf8] sm:px-6 lg:px-8">
    <AppNavbar />

    <section class="mx-auto max-w-6xl py-8 sm:py-10">
      <div>
        <p class="text-sm font-semibold uppercase text-[var(--mode-accent)]">
          {{ t('users.settings.eyebrow') }}
        </p>
        <h1 class="mt-3 text-4xl font-semibold leading-tight text-white sm:text-5xl">
          {{ t('users.settings.title') }}
        </h1>
        <p class="mt-3 max-w-2xl text-base leading-7 text-white/66">
          {{ t('users.settings.subtitle') }}
        </p>
      </div>

      <SettingsSectionNav class="mt-6" />

      <section
        class="mt-6 rounded-[8px] border border-white/12 bg-[#07100e]/86 p-5 shadow-[0_24px_90px_rgba(0,0,0,0.28)] backdrop-blur-2xl sm:p-6"
      >
        <div class="border-b border-white/10 pb-5">
          <p class="text-sm font-semibold uppercase text-[var(--mode-accent)]">
            {{ t('users.settings.customizationTitle') }}
          </p>
          <p class="mt-2 max-w-2xl text-sm leading-6 text-white/62">
            {{ t('users.settings.customizationSubtitle') }}
          </p>
        </div>

        <div class="mt-5">
          <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <button
              v-for="palette in customizationPalettes"
              :key="palette.key"
              type="button"
              class="customization-palette-option"
              :class="{
                'customization-palette-option--active': selectedPalette === palette.key,
              }"
              :style="customizationPaletteStyle(palette)"
              :aria-pressed="selectedPalette === palette.key"
              @click="selectedPalette = palette.key"
            >
              <span class="flex min-w-0 items-center gap-2">
                <span
                  class="grid size-8 shrink-0 place-items-center rounded-full"
                  :style="{ backgroundColor: palette.accent, color: palette.ink }"
                >
                  <i :class="[palette.icon, 'text-sm']" aria-hidden="true" />
                </span>
                <span class="palette-label font-semibold text-white">{{ palette.label }}</span>
              </span>
              <span class="flex shrink-0 gap-1" aria-hidden="true">
                <span class="palette-dot" :style="{ backgroundColor: palette.accent }" />
                <span class="palette-dot" :style="{ backgroundColor: palette.soft }" />
                <span
                  class="palette-dot"
                  :style="{ backgroundColor: `rgb(${palette.companionRgb})` }"
                />
              </span>
            </button>
          </div>
        </div>

        <div class="customization-setting-row mt-6">
          <div>
            <p id="fast-mode-title" class="text-sm font-semibold text-white">
              {{ t('users.settings.fastModeTitle') }}
            </p>
            <p id="fast-mode-description" class="mt-1 text-sm leading-6 text-white/58">
              {{ t('users.settings.fastModeSubtitle') }}
            </p>
          </div>
          <div class="fast-mode-control">
            <span aria-live="polite">
              {{
                t(
                  fastModeEnabled
                    ? 'users.settings.fastModeEnabled'
                    : 'users.settings.fastModeAutomatic',
                )
              }}
            </span>
            <ToggleSwitch
              v-model="fastModeEnabled"
              input-id="fast-mode-toggle"
              aria-labelledby="fast-mode-title fast-mode-description"
            />
          </div>
        </div>

        <div class="customization-setting-row mt-5">
          <div>
            <p class="text-sm font-semibold text-white">{{ t('users.settings.languageTitle') }}</p>
            <p class="mt-1 text-sm leading-6 text-white/58">
              {{ t('users.settings.languageSubtitle') }}
            </p>
          </div>
          <LocaleSwitcher />
        </div>
      </section>
    </section>
  </main>
</template>

<style scoped>
.settings-page {
  background:
    radial-gradient(circle at 78% 8%, rgba(var(--mode-companion-rgb), 0.16), transparent 34rem),
    radial-gradient(circle at 6% 68%, rgba(var(--mode-glow-rgb), 0.13), transparent 32rem),
    linear-gradient(180deg, #06100e 0%, #081512 48%, #06100e 100%);
}

.customization-palette-option {
  display: flex;
  min-height: 5.4rem;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  border: 1px solid;
  border-radius: 8px;
  padding: 1rem;
  text-align: left;
  transition:
    border-color 160ms ease,
    filter 160ms ease,
    transform 160ms ease;
}

.customization-palette-option:hover,
.customization-palette-option--active {
  border-color: var(--mode-accent) !important;
  filter: brightness(1.08);
}

.customization-palette-option--active {
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--mode-accent), transparent 38%);
}

.palette-dot {
  display: block;
  width: 0.85rem;
  height: 0.85rem;
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: 999px;
}

.palette-label {
  min-width: 0;
  line-height: 1.2;
  overflow-wrap: normal;
  word-break: normal;
  hyphens: none;
}

.customization-setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  padding-top: 1.25rem;
}

.fast-mode-control {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 0.75rem;
}

.fast-mode-control > span {
  color: rgba(255, 255, 255, 0.62);
  font-size: 0.8rem;
  font-weight: 700;
}

:deep(.fast-mode-control .p-toggleswitch.p-toggleswitch-checked .p-toggleswitch-slider) {
  background: var(--mode-accent);
}

@media (max-width: 520px) {
  .customization-setting-row {
    align-items: flex-start;
    flex-direction: column;
  }

  .fast-mode-control {
    width: 100%;
    justify-content: space-between;
  }
}
</style>
