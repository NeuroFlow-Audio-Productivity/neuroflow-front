<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'

import AppNavbar from '@/components/AppNavbar.vue'
import FlowCreationGuide from '@/components/flows/FlowCreationGuide.vue'
import { useThemedConfirm } from '@/composables/useThemedConfirm'
import { ApiError } from '@/services/authApi'
import { translateApiKey, translateApiMessage } from '@/services/apiMessageTranslator'
import { flowApi } from '@/services/flowApi'
import {
  flowCategoryByKey,
  flowCategoryKeyFromName,
  flowCategoryStyle,
} from '@/services/flowPresets'
import { useAuthStore } from '@/stores/auth'
import type { Flow } from '@/types/flow'

const { t, locale } = useI18n()
const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const { confirmDanger } = useThemedConfirm()

const flows = ref<Flow[]>([])
const isLoading = ref(false)
const deletingFlowId = ref<number | null>(null)
const savingFlowId = ref<number | null>(null)
const flowNameDrafts = ref<Record<number, string>>({})
const error = ref<string | null>(null)
const successMessage = ref<string | null>(null)

const sortedFlows = computed(() => [...flows.value].sort((first, second) => second.id - first.id))
const totalFlows = computed(() => sortedFlows.value.length)
const latestFlow = computed(() => sortedFlows.value[0] ?? null)
const dateFormatter = computed(
  () =>
    new Intl.DateTimeFormat(locale.value, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }),
)

const categoryForFlow = (flow: Flow) => flowCategoryByKey(flowCategoryKeyFromName(flow.name))
const flowCardStyle = (flow: Flow) => flowCategoryStyle(flowCategoryKeyFromName(flow.name))
const flowCategoryLabel = (flow: Flow) => {
  const category = categoryForFlow(flow)

  return category ? t(category.labelKey) : t('flowResource.categories.focus.label')
}
const flowCategoryEmoji = (flow: Flow) => categoryForFlow(flow)?.emoji ?? '🧠'
const flowCategoryIcon = (flow: Flow) => categoryForFlow(flow)?.icon ?? 'pi pi-bolt'

const formatDate = (value: string) => {
  const date = new Date(value)

  return Number.isNaN(date.getTime()) ? value : dateFormatter.value.format(date)
}

const setError = (caughtError: unknown, fallbackKey: string) => {
  if (caughtError instanceof ApiError) {
    error.value = translateApiMessage(caughtError.message, {
      fallbackKey,
      status: caughtError.status,
    })
    return
  }

  error.value = translateApiKey(fallbackKey)
}

const loadFlows = async () => {
  if (!auth.token) return

  isLoading.value = true
  error.value = null

  try {
    const response = await flowApi.listFlows(auth.token)

    flows.value = response.data
  } catch (caughtError) {
    setError(caughtError, 'flowResource.errors.loadFlows')
  } finally {
    isLoading.value = false
  }
}

const handleCreated = async (flow: Flow) => {
  flows.value = [flow, ...flows.value.filter((item) => item.id !== flow.id)]
  successMessage.value = t('flowResource.feedback.created')
  error.value = null

  await router.push({ name: 'flows-edit', params: { id: flow.id } })
}

const flowNameDraft = (flow: Flow) => flowNameDrafts.value[flow.id] ?? flow.name

const updateFlowNameDraft = (flow: Flow, value: string) => {
  flowNameDrafts.value = {
    ...flowNameDrafts.value,
    [flow.id]: value,
  }
}

const resetFlowNameDraft = (flow: Flow) => {
  const nextDrafts = { ...flowNameDrafts.value }

  delete nextDrafts[flow.id]
  flowNameDrafts.value = nextDrafts
}

const openFlow = async (flow: Flow) => {
  await router.push({ name: 'flows-edit', params: { id: flow.id } })
}

const saveFlowName = async (flow: Flow) => {
  if (!auth.token) return

  const name = flowNameDraft(flow).trim()
  successMessage.value = null
  error.value = null

  if (!name) {
    error.value = t('flowResource.validation.nameRequired')
    return
  }

  if (name === flow.name) {
    resetFlowNameDraft(flow)
    return
  }

  savingFlowId.value = flow.id

  try {
    const savedFlow = await flowApi.updateFlow(auth.token, flow.id, { name })

    flows.value = flows.value.map((item) => (item.id === savedFlow.id ? savedFlow : item))
    resetFlowNameDraft(savedFlow)
    successMessage.value = t('flowResource.feedback.saved')
  } catch (caughtError) {
    setError(caughtError, 'flowResource.errors.save')
  } finally {
    savingFlowId.value = null
  }
}

const deleteFlow = async (flow: Flow) => {
  if (!auth.token) return

  const confirmed = await confirmDanger({
    message: t('flowResource.confirmDelete', { name: flow.name }),
  })

  if (!confirmed) return

  deletingFlowId.value = flow.id
  error.value = null
  successMessage.value = null

  try {
    await flowApi.deleteFlow(auth.token, flow.id)

    flows.value = flows.value.filter((item) => item.id !== flow.id)
    successMessage.value = t('flowResource.feedback.deleted')
    resetFlowNameDraft(flow)
  } catch (caughtError) {
    setError(caughtError, 'flowResource.errors.delete')
  } finally {
    deletingFlowId.value = null
  }
}

onMounted(() => {
  void loadFlows().then(() => {
    if (route.query.created !== '1') return

    successMessage.value = t('flowResource.feedback.created')
    void router.replace({ name: 'flows-index' })
  })
})
</script>

<template>
  <main
    v-if="!isLoading && sortedFlows.length === 0"
    class="flows-page flows-page--onboarding dark min-h-screen text-[#f7fbf8]"
  >
    <section class="flows-onboarding-shell">
      <div
        v-if="error"
        class="flows-onboarding-feedback rounded-[8px] border border-red-300/30 bg-red-500/10 px-4 py-3 text-sm leading-6 text-red-100"
      >
        {{ error }}
      </div>

      <FlowCreationGuide compact @created="handleCreated" />
    </section>
  </main>

  <main v-else class="flows-page dark min-h-screen px-4 py-4 text-[#f7fbf8] sm:px-6 lg:px-8">
    <AppNavbar />

    <section
      v-if="isLoading"
      class="mx-auto mt-6 max-w-7xl rounded-[8px] border border-white/12 bg-[#07100e]/86 px-5 py-12 text-center text-sm text-white/62 shadow-[0_24px_90px_rgba(0,0,0,0.28)] backdrop-blur-2xl"
    >
      {{ t('flowResource.index.loading') }}
    </section>

    <section v-else class="mx-auto max-w-7xl py-8 sm:py-10">
      <div class="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p class="text-sm font-semibold uppercase text-[var(--mode-accent)]">
            {{ t('flowResource.index.eyebrow') }}
          </p>
          <h1 class="mt-3 text-4xl font-semibold leading-tight text-white sm:text-5xl">
            {{ t('flowResource.index.title') }}
          </h1>
          <p class="mt-3 max-w-2xl text-base leading-7 text-white/66">
            {{ t('flowResource.index.subtitle') }}
          </p>
        </div>

        <RouterLink to="/flows/create">
          <Button
            :label="t('flowResource.actions.create')"
            icon="pi pi-plus"
            class="theme-primary-button !justify-center"
          />
        </RouterLink>
      </div>

      <div
        v-if="successMessage"
        class="theme-success-panel mt-6 rounded-[8px] border px-4 py-3 text-sm leading-6"
      >
        {{ successMessage }}
      </div>

      <div
        v-if="error"
        class="mt-6 rounded-[8px] border border-red-300/30 bg-red-500/10 px-4 py-3 text-sm leading-6 text-red-100"
      >
        {{ error }}
      </div>

      <section class="mt-6 grid gap-3 sm:grid-cols-2">
        <div class="flow-stat-panel">
          <span class="flow-stat-value">{{ totalFlows }}</span>
          <span class="flow-stat-label">{{ t('flowResource.index.total') }}</span>
        </div>
        <div class="flow-stat-panel">
          <span class="flow-stat-value">
            {{ latestFlow?.name ?? t('flowResource.index.noLatest') }}
          </span>
          <span class="flow-stat-label">{{ t('flowResource.index.latest') }}</span>
        </div>
      </section>

      <section class="mt-6">
        <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <article
            v-for="flow in sortedFlows"
            :key="flow.id"
            class="flow-card"
            :style="flowCardStyle(flow)"
            role="button"
            tabindex="0"
            @click="openFlow(flow)"
            @keydown.enter.prevent="openFlow(flow)"
            @keydown.space.prevent="openFlow(flow)"
          >
            <div class="flow-card-top">
              <span class="flow-card-symbol" aria-hidden="true">{{ flowCategoryEmoji(flow) }}</span>
              <span class="flow-card-pill">
                <i :class="flowCategoryIcon(flow)" aria-hidden="true" />
                {{ flowCategoryLabel(flow) }}
              </span>
            </div>

            <form
              class="flow-card-name-form"
              @submit.prevent="saveFlowName(flow)"
              @click.stop
              @keydown.stop
            >
              <label class="sr-only" :for="`flow-name-${flow.id}`">
                {{ t('flowResource.fields.name') }}
              </label>
              <InputText
                :id="`flow-name-${flow.id}`"
                :model-value="flowNameDraft(flow)"
                class="flow-card-name-input"
                autocomplete="off"
                maxlength="255"
                :disabled="savingFlowId === flow.id"
                @update:model-value="updateFlowNameDraft(flow, String($event ?? ''))"
                @blur="saveFlowName(flow)"
                @keydown.enter.prevent="saveFlowName(flow)"
              />
            </form>
            <p>{{ t('flowResource.index.cardSubtitle') }}</p>

            <div class="flow-card-meta">
              <span>{{ t('flowResource.fields.createdAt') }}</span>
              <strong>{{ formatDate(flow.created_at) }}</strong>
            </div>

            <div class="flow-card-footer">
              <Button
                icon="pi pi-trash"
                severity="danger"
                text
                rounded
                :loading="deletingFlowId === flow.id"
                :aria-label="t('flowResource.actions.delete')"
                class="hover:!bg-red-500/10"
                @click.stop="deleteFlow(flow)"
              />
            </div>
          </article>
        </div>
      </section>
    </section>
  </main>
</template>

<style scoped>
.flows-page {
  background:
    radial-gradient(circle at 74% 8%, rgba(var(--mode-companion-rgb), 0.15), transparent 34rem),
    radial-gradient(circle at 8% 68%, rgba(var(--mode-glow-rgb), 0.13), transparent 32rem),
    linear-gradient(180deg, #06100e 0%, #081512 48%, #06100e 100%);
}

.flow-stat-panel {
  min-height: 6.3rem;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  background: rgba(7, 16, 14, 0.72);
  padding: 1rem;
  box-shadow: 0 18px 60px rgba(0, 0, 0, 0.2);
  backdrop-filter: blur(18px);
}

.flow-stat-value {
  display: block;
  color: #ffffff;
  font-size: 1.35rem;
  font-weight: 700;
  line-height: 1.1;
  overflow-wrap: anywhere;
}

.flow-stat-label {
  display: block;
  margin-top: 0.55rem;
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0;
  line-height: 1.2;
  text-transform: uppercase;
}

.flows-onboarding-shell {
  display: grid;
  width: 100%;
  min-height: 100svh;
  place-items: stretch;
}

.flows-onboarding-feedback {
  position: absolute;
  top: 1rem;
  right: 1rem;
  left: 1rem;
  z-index: 4;
  margin: 0 auto;
  max-width: 36rem;
}

.flow-card {
  --flow-accent: var(--mode-accent);
  --flow-accent-rgb: var(--mode-glow-rgb);
  position: relative;
  display: grid;
  min-height: 20rem;
  overflow: hidden;
  border: 1px solid rgba(var(--flow-accent-rgb), 0.34);
  border-radius: 8px;
  background:
    linear-gradient(112deg, rgba(var(--flow-accent-rgb), 0.2), transparent 40%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.04), transparent 56%), rgba(7, 16, 14, 0.9);
  padding: 1rem;
  box-shadow: 0 24px 90px rgba(0, 0, 0, 0.28);
  backdrop-filter: blur(20px);
  cursor: pointer;
}

.flow-card:focus-visible {
  outline: 2px solid rgba(var(--flow-accent-rgb), 0.76);
  outline-offset: 3px;
}

.flow-card::before {
  position: absolute;
  inset: -24%;
  background:
    repeating-linear-gradient(
      116deg,
      transparent 0 1rem,
      rgba(255, 255, 255, 0.055) 1.05rem 1.12rem,
      transparent 1.18rem 2.2rem
    ),
    radial-gradient(circle at 82% 16%, rgba(var(--flow-accent-rgb), 0.32), transparent 11rem);
  content: '';
  opacity: 0.54;
  pointer-events: none;
  transition:
    opacity 180ms ease,
    transform 240ms ease;
}

.flow-card:hover::before {
  opacity: 0.76;
  transform: translate3d(0.35rem, -0.35rem, 0);
}

.flow-card > * {
  position: relative;
  z-index: 1;
}

.flow-card-top,
.flow-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.flow-card-symbol {
  display: grid;
  width: 3rem;
  height: 3rem;
  place-items: center;
  border: 1px solid rgba(var(--flow-accent-rgb), 0.3);
  border-radius: 8px;
  background: rgba(4, 8, 8, 0.48);
  font-size: 1.35rem;
}

.flow-card-pill {
  display: inline-flex;
  min-height: 2.1rem;
  min-width: 0;
  max-width: 12rem;
  align-items: center;
  gap: 0.45rem;
  border: 1px solid rgba(var(--flow-accent-rgb), 0.34);
  border-radius: 999px;
  background: rgba(var(--flow-accent-rgb), 0.12);
  padding: 0.35rem 0.65rem;
  color: color-mix(in srgb, var(--flow-accent), #ffffff 18%);
  font-size: 0.75rem;
  font-weight: 800;
  line-height: 1.1;
  overflow-wrap: anywhere;
}

.flow-card-name-form {
  margin: 2.2rem 0 0;
}

:deep(.flow-card-name-input) {
  width: 100%;
  border: 1px solid transparent !important;
  border-radius: 8px !important;
  background: transparent !important;
  color: #ffffff !important;
  font-size: 2.15rem !important;
  font-weight: 760 !important;
  letter-spacing: 0 !important;
  line-height: 1.05 !important;
  overflow-wrap: anywhere;
  padding: 0.15rem 0.25rem !important;
  box-shadow: none !important;
}

:deep(.flow-card-name-input:hover),
:deep(.flow-card-name-input:focus) {
  border-color: rgba(var(--flow-accent-rgb), 0.36) !important;
  background: rgba(255, 255, 255, 0.045) !important;
}

:deep(.flow-card-name-input:disabled) {
  opacity: 0.66;
}

.flow-card p {
  margin: 0.9rem 0 0;
  max-width: 24rem;
  color: rgba(255, 255, 255, 0.62);
  font-size: 0.92rem;
  line-height: 1.6;
}

.flow-card-meta {
  align-self: end;
  display: grid;
  gap: 0.25rem;
  margin-top: 1.5rem;
}

.flow-card-meta span {
  color: rgba(255, 255, 255, 0.42);
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0;
  line-height: 1.2;
  text-transform: uppercase;
}

.flow-card-meta strong {
  color: rgba(255, 255, 255, 0.78);
  font-size: 0.9rem;
  line-height: 1.25;
}

.flow-card-footer {
  align-self: end;
  justify-content: flex-end;
  min-height: 3.2rem;
  margin: 0.85rem -0.25rem -0.25rem;
  border-top: 1px solid rgba(255, 255, 255, 0.09);
  padding-top: 0.55rem;
}

@media (prefers-reduced-motion: reduce) {
  .flow-card::before {
    transition: none;
  }

  .flow-card:hover::before {
    transform: none;
  }
}
</style>
