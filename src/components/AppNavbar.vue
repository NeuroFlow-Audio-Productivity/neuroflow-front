<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import LocaleSwitcher from '@/components/LocaleSwitcher.vue'
import { useAuthStore } from '@/stores/auth'
import type { ProfileItem } from '@/types/auth'

type NavbarItem = ProfileItem & {
  key: string
}

const props = withDefaults(
  defineProps<{
    marketingLinks?: boolean
    alternateLabel?: string
    alternateTo?: string
  }>(),
  {
    marketingLinks: false,
    alternateLabel: '',
    alternateTo: '',
  },
)

const { t } = useI18n()
const auth = useAuthStore()
const router = useRouter()

const profileItems = computed(() => auth.profileItems)
const profileLabel = computed(() => auth.user?.profile?.name ?? auth.user?.profile?.slug ?? '')
const displayName = computed(() => auth.user?.name ?? t('nav.account'))
const profileRouteOrder = ['/dashboard', '/core', '/flows', '/modes', '/audios', '/users', '/settings']

const initials = computed(() => {
  const parts = displayName.value.trim().split(/\s+/).filter(Boolean)
  const lastPart = parts[parts.length - 1]
  const letters = parts.length > 1 ? [parts[0], lastPart] : [parts[0]]

  return (
    letters
      .map((part) => part?.[0] ?? '')
      .join('')
      .toUpperCase() || 'NF'
  )
})

const alternateIcon = computed(() =>
  props.alternateTo.includes('register') ? 'pi pi-user-plus' : 'pi pi-user',
)

const usesNativeHref = (route: string) => {
  const trimmed = route.trim()

  return (
    trimmed.startsWith('#') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('mailto:') ||
    trimmed.startsWith('tel:')
  )
}

const normalizedItemRoute = (route: string) => {
  const trimmed = route.trim()

  if (!trimmed) return '/dashboard'
  if (trimmed.startsWith('/')) return trimmed

  return `/${trimmed.replace(/^\/+/, '')}`
}

const hasUsersProfileItem = computed(() =>
  profileItems.value.some((item) => normalizedItemRoute(item.route) === '/users'),
)

const hasModesProfileItem = computed(() =>
  profileItems.value.some((item) => normalizedItemRoute(item.route) === '/modes'),
)

const hasAudiosProfileItem = computed(() =>
  profileItems.value.some((item) => normalizedItemRoute(item.route) === '/audios'),
)

const hasSettingsProfileItem = computed(() =>
  profileItems.value.some((item) => normalizedItemRoute(item.route).startsWith('/settings')),
)

const fallbackItem = (key: string, name: string, route: string): NavbarItem => ({
  id: -1,
  key,
  name,
  route,
  created_at: '',
  updated_at: '',
})

const sortProfileItems = (items: NavbarItem[]) =>
  [...items].sort((first, second) => {
    const firstRoute = normalizedItemRoute(first.route)
    const secondRoute = normalizedItemRoute(second.route)
    const firstIndex = profileRouteOrder.findIndex((route) => firstRoute.startsWith(route))
    const secondIndex = profileRouteOrder.findIndex((route) => secondRoute.startsWith(route))
    const firstRank = firstIndex === -1 ? profileRouteOrder.length : firstIndex
    const secondRank = secondIndex === -1 ? profileRouteOrder.length : secondIndex

    return firstRank - secondRank
  })

const navigationItems = computed(() => {
  const items: NavbarItem[] = profileItems.value.map((item) => ({
    ...item,
    key: `profile-${item.id}`,
  }))

  if (profileItems.value.length === 0) {
    items.push(fallbackItem('fallback-core', t('nav.core'), '/dashboard'))
  }

  if (!hasModesProfileItem.value) {
    items.push(fallbackItem('fallback-modes', t('nav.modes'), '/modes'))
  }

  if (!hasAudiosProfileItem.value) {
    items.push(fallbackItem('fallback-audios', t('nav.audios'), '/audios'))
  }

  if (auth.isAdmin && !hasUsersProfileItem.value) {
    items.push(fallbackItem('fallback-users', t('nav.users'), '/users'))
  }

  if (!hasSettingsProfileItem.value) {
    items.push(fallbackItem('fallback-settings', t('nav.settings'), '/settings/account'))
  }

  return sortProfileItems(items)
})

const profileItemLabel = (name: string, route: string) => {
  if (usesNativeHref(route)) return name

  const labelKeyByRoute: Record<string, string> = {
    '/dashboard': 'nav.core',
    '/core': 'nav.core',
    '/flows': 'nav.flows',
    '/audios': 'nav.audios',
    '/modes': 'nav.modes',
    '/settings': 'nav.settings',
    '/settings/account': 'nav.settings',
    '/users': 'nav.users',
  }

  const labelKey = labelKeyByRoute[normalizedItemRoute(route)]

  return labelKey ? t(labelKey) : name
}

const ensureProfileItems = async () => {
  await auth.hydrate()

  if (!auth.isAuthenticated) return

  try {
    await auth.fetchProfileItems()
  } catch {
    // The navbar falls back to the dashboard link if item loading is unavailable.
  }
}

const logout = async () => {
  await auth.logout()

  if (router.currentRoute.value.meta.requiresAuth) {
    await router.push({ name: 'login' })
  }
}

onMounted(() => {
  void ensureProfileItems()
})

watch(
  () => auth.isAuthenticated,
  (isAuthenticated) => {
    if (isAuthenticated) void ensureProfileItems()
  },
)
</script>

<template>
  <header
    class="app-navbar mx-auto flex max-w-7xl items-center justify-between gap-3 rounded-full border border-white/10 bg-black/45 px-3 py-2 shadow-[0_20px_80px_rgba(0,0,0,0.28)] backdrop-blur-xl"
  >
    <RouterLink to="/" class="flex min-w-0 items-center gap-3 text-white">
      <span
        class="grid size-9 shrink-0 place-items-center overflow-hidden rounded-full border border-white/15 bg-white/8"
        aria-hidden="true"
      >
        <img class="logo-mark" src="/neuroflow-logo.svg" alt="" width="28" height="28" />
      </span>
      <span class="text-base font-semibold">NeuroFlow</span>
    </RouterLink>

    <nav
      v-if="auth.isAuthenticated"
      class="hidden min-w-0 flex-1 items-center justify-center gap-1 px-4 text-sm text-white/70 md:flex"
      :aria-label="t('nav.profileItems')"
    >
      <template v-for="item in navigationItems" :key="item.key">
        <a
          v-if="usesNativeHref(item.route)"
          class="navbar-link"
          :href="item.route"
          :title="profileItemLabel(item.name, item.route)"
        >
          {{ profileItemLabel(item.name, item.route) }}
        </a>
        <RouterLink
          v-else
          class="navbar-link"
          :to="normalizedItemRoute(item.route)"
          :title="profileItemLabel(item.name, item.route)"
        >
          {{ profileItemLabel(item.name, item.route) }}
        </RouterLink>
      </template>
    </nav>

    <nav
      v-else-if="marketingLinks"
      class="hidden items-center gap-1 text-sm text-white/70 md:flex"
      :aria-label="t('nav.label')"
    >
      <a class="navbar-link" href="#modes">
        {{ t('nav.modes') }}
      </a>
      <a class="navbar-link" href="#privacy">
        {{ t('nav.privacy') }}
      </a>
      <a class="navbar-link" href="#how-it-works">
        {{ t('nav.howItWorks') }}
      </a>
    </nav>

    <div class="flex min-w-0 items-center gap-2">
      <LocaleSwitcher v-if="!auth.isAuthenticated" />

      <template v-if="auth.isAuthenticated">
        <RouterLink
          to="/settings/account"
          class="hidden h-10 max-w-56 items-center gap-2 rounded-full border border-white/12 bg-white/10 px-2.5 pr-3 text-sm font-semibold text-white transition hover:bg-white/16 md:inline-flex"
        >
          <span
            class="grid size-7 shrink-0 place-items-center rounded-full bg-[var(--mode-accent)] text-[0.7rem] font-bold text-[var(--mode-ink)]"
            aria-hidden="true"
          >
            {{ initials }}
          </span>
          <span class="min-w-0">
            <span class="block truncate leading-4">{{ displayName }}</span>
            <span v-if="profileLabel" class="block truncate text-[0.68rem] leading-3 text-white/56">
              {{ profileLabel }}
            </span>
          </span>
        </RouterLink>

        <button
          class="hidden size-10 place-items-center rounded-full border border-white/12 bg-white/10 text-white transition hover:bg-white/16 md:grid"
          type="button"
          :aria-label="t('auth.actions.signOut')"
          @click="logout"
        >
          <i class="pi pi-sign-out" aria-hidden="true" />
        </button>

        <details class="mobile-profile-menu md:hidden">
          <summary
            class="grid size-10 cursor-pointer list-none place-items-center rounded-full border border-white/12 bg-white/10 text-white transition hover:bg-white/16"
            :aria-label="t('nav.profileItems')"
          >
            <span
              class="grid size-7 place-items-center rounded-full bg-[var(--mode-accent)] text-[0.68rem] font-bold text-[var(--mode-ink)]"
              aria-hidden="true"
            >
              {{ initials }}
            </span>
          </summary>

          <div class="mobile-profile-panel">
            <div class="border-b border-white/10 px-3 pb-3">
              <p class="truncate text-sm font-semibold text-white">{{ displayName }}</p>
              <p class="mt-1 truncate text-xs text-white/58">
                {{ profileLabel || auth.user?.email }}
              </p>
            </div>

            <nav class="mt-2 grid gap-1" :aria-label="t('nav.profileItems')">
              <template v-for="item in navigationItems" :key="`mobile-${item.key}`">
                <a v-if="usesNativeHref(item.route)" class="mobile-profile-link" :href="item.route">
                  {{ profileItemLabel(item.name, item.route) }}
                </a>
                <RouterLink v-else class="mobile-profile-link" :to="normalizedItemRoute(item.route)">
                  {{ profileItemLabel(item.name, item.route) }}
                </RouterLink>
              </template>
            </nav>

            <button class="mobile-profile-link mt-2 w-full text-left" type="button" @click="logout">
              <i class="pi pi-sign-out text-sm" aria-hidden="true" />
              <span>{{ t('auth.actions.signOut') }}</span>
            </button>
          </div>
        </details>
      </template>

      <template v-else>
        <template v-if="alternateTo">
          <RouterLink
            :to="alternateTo"
            class="hidden h-10 items-center gap-2 rounded-full border border-white/12 bg-white/10 px-4 text-sm font-semibold text-white transition hover:bg-white/16 sm:inline-flex"
          >
            <i :class="alternateIcon" aria-hidden="true" />
            <span>{{ alternateLabel }}</span>
          </RouterLink>
          <RouterLink
            :to="alternateTo"
            class="grid size-10 place-items-center rounded-full border border-white/12 bg-white/10 text-white transition hover:bg-white/16 sm:hidden"
            :aria-label="alternateLabel"
          >
            <i :class="alternateIcon" aria-hidden="true" />
          </RouterLink>
        </template>

        <template v-else>
          <RouterLink
            to="/auth/login"
            class="hidden h-10 items-center gap-2 rounded-full border border-white/12 bg-white/10 px-4 text-sm font-semibold text-white transition hover:bg-white/16 sm:inline-flex"
          >
            <i class="pi pi-user" aria-hidden="true" />
            <span>{{ t('auth.actions.signIn') }}</span>
          </RouterLink>
          <RouterLink
            to="/auth/register"
            class="theme-soft-button hidden h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold transition lg:inline-flex"
          >
            <i class="pi pi-user-plus" aria-hidden="true" />
            <span>{{ t('auth.actions.createAccount') }}</span>
          </RouterLink>
          <RouterLink
            to="/auth/register"
            class="grid size-10 place-items-center rounded-full border border-white/12 bg-white/10 text-white transition hover:bg-white/16 sm:hidden"
            :aria-label="t('auth.actions.createAccount')"
          >
            <i class="pi pi-user-plus" aria-hidden="true" />
          </RouterLink>
        </template>
      </template>
    </div>
  </header>
</template>

<style scoped>
.app-navbar {
  width: calc(100vw - 2rem);
}

.navbar-link {
  display: inline-flex;
  max-width: 12rem;
  align-items: center;
  overflow: hidden;
  border-radius: 999px;
  padding: 0.5rem 1rem;
  color: rgba(255, 255, 255, 0.7);
  text-overflow: ellipsis;
  white-space: nowrap;
  transition:
    background 160ms ease,
    color 160ms ease;
}

.navbar-link:hover,
.router-link-active.navbar-link {
  background: rgba(255, 255, 255, 0.1);
  color: #ffffff;
}

.logo-mark {
  display: block;
  width: 28px;
  height: 28px;
  object-fit: cover;
}

.mobile-profile-menu {
  position: relative;
  z-index: 90;
}

.mobile-profile-menu summary::-webkit-details-marker {
  display: none;
}

.mobile-profile-panel {
  position: absolute;
  top: calc(100% + 0.55rem);
  right: 0;
  width: min(17rem, calc(100vw - 2rem));
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  background: rgba(7, 16, 14, 0.96);
  padding: 0.75rem;
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.32);
  backdrop-filter: blur(18px);
}

.mobile-profile-link {
  display: flex;
  min-height: 2.35rem;
  align-items: center;
  gap: 0.55rem;
  border: 0;
  border-radius: 8px;
  background: transparent;
  padding: 0.55rem 0.75rem;
  color: rgba(255, 255, 255, 0.76);
  font-size: 0.875rem;
  font-weight: 700;
  transition:
    background 160ms ease,
    color 160ms ease;
}

.mobile-profile-link:hover,
.router-link-active.mobile-profile-link {
  background: rgba(255, 255, 255, 0.08);
  color: #ffffff;
}

@media (min-width: 640px) {
  .app-navbar {
    width: 100%;
  }
}
</style>
