<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { persistLocale, supportedLocales, type Locale } from '@/i18n'

const { t, locale } = useI18n()

const triggerRef = ref<HTMLButtonElement | null>(null)
const listRef = ref<HTMLDivElement | null>(null)
const isOpen = ref(false)
const listStyle = ref<Record<string, string>>({})

const isLocale = (value: string): value is Locale =>
  supportedLocales.some((language) => language.code === value)

const currentLocale = computed<Locale>({
  get: () => (isLocale(locale.value) ? locale.value : 'pt-BR'),
  set: (value) => {
    locale.value = value
  },
})

const currentLanguageLabel = computed(
  () =>
    supportedLocales.find((language) => language.code === currentLocale.value)?.label ?? 'PT-BR',
)

const selectLocale = (value: Locale) => {
  currentLocale.value = value
  isOpen.value = false
}

const updatePosition = () => {
  const trigger = triggerRef.value

  if (!trigger) return

  const rect = trigger.getBoundingClientRect()
  const width = 128
  const left = Math.max(8, Math.min(window.innerWidth - width - 8, rect.right - width))

  listStyle.value = {
    top: `${rect.bottom + 8}px`,
    left: `${left}px`,
    width: `${width}px`,
  }
}

const toggleMenu = async () => {
  isOpen.value = !isOpen.value

  if (isOpen.value) {
    await nextTick()
    updatePosition()
  }
}

const closeOnOutsidePress = (event: PointerEvent) => {
  const target = event.target

  if (
    !isOpen.value ||
    !(target instanceof Node) ||
    triggerRef.value?.contains(target) ||
    listRef.value?.contains(target)
  ) {
    return
  }

  isOpen.value = false
}

const closeOnEscape = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    isOpen.value = false
  }
}

watch(
  currentLocale,
  (value) => {
    document.documentElement.lang = value
    persistLocale(value)
  },
  { immediate: true },
)

onMounted(() => {
  document.addEventListener('pointerdown', closeOnOutsidePress)
  document.addEventListener('keydown', closeOnEscape)
  window.addEventListener('resize', updatePosition)
  window.addEventListener('scroll', updatePosition, true)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', closeOnOutsidePress)
  document.removeEventListener('keydown', closeOnEscape)
  window.removeEventListener('resize', updatePosition)
  window.removeEventListener('scroll', updatePosition, true)
})
</script>

<template>
  <div class="language-menu">
    <button
      ref="triggerRef"
      class="language-trigger"
      :class="{ 'language-trigger--open': isOpen }"
      type="button"
      :aria-expanded="isOpen"
      :aria-label="t('language.label')"
      @click="toggleMenu"
    >
      <span>{{ currentLanguageLabel }}</span>
      <i class="pi pi-chevron-down text-[0.65rem]" aria-hidden="true" />
    </button>

    <Teleport to="body">
      <div v-if="isOpen" ref="listRef" class="language-list" :style="listStyle">
        <button
          v-for="language in supportedLocales"
          :key="language.code"
          class="language-option"
          :class="{ 'language-option--active': currentLocale === language.code }"
          type="button"
          @click="selectLocale(language.code)"
        >
          {{ language.label }}
        </button>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.language-menu {
  position: relative;
  z-index: 1000;
  flex-shrink: 0;
}

.language-trigger {
  display: inline-flex;
  height: 2.5rem;
  min-width: 5.75rem;
  cursor: pointer;
  align-items: center;
  justify-content: space-between;
  gap: 0.55rem;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  padding: 0 0.78rem 0 0.95rem;
  color: #ffffff;
  font-size: 0.75rem;
  font-weight: 700;
  line-height: 1;
  transition:
    border-color 160ms ease,
    background 160ms ease,
    color 160ms ease;
}

.language-trigger--open {
  border-color: color-mix(in srgb, var(--mode-accent), white 10%);
  background: color-mix(in srgb, var(--mode-accent), transparent 86%);
  color: var(--mode-accent);
}

.language-trigger--open i {
  transform: rotate(180deg);
}

.language-list {
  position: fixed;
  z-index: 2147483000;
  height: 8.25rem;
  overflow-y: scroll;
  overscroll-behavior: contain;
  scrollbar-color: var(--mode-accent) rgba(255, 255, 255, 0.08);
  scrollbar-gutter: stable;
  scrollbar-width: thin;
  touch-action: pan-y;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  background: rgba(7, 16, 14, 0.96);
  padding: 0.35rem;
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.32);
  backdrop-filter: blur(18px);
}

.language-list::-webkit-scrollbar {
  width: 0.42rem;
}

.language-list::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.08);
  border-radius: 999px;
}

.language-list::-webkit-scrollbar-thumb {
  background: var(--mode-accent);
  border-radius: 999px;
}

.language-option {
  display: flex;
  width: 100%;
  align-items: center;
  border: 0;
  border-radius: 999px;
  background: transparent;
  padding: 0.52rem 0.72rem;
  color: rgba(255, 255, 255, 0.72);
  font-size: 0.75rem;
  font-weight: 700;
  text-align: left;
  transition:
    background 160ms ease,
    color 160ms ease;
}

.language-option:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #ffffff;
}

.language-option--active {
  background: var(--mode-accent);
  color: var(--mode-ink);
}
</style>
