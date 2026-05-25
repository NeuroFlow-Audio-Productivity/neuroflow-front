<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'

import FlowNodeList from '@/components/flow-builder/FlowNodeList.vue'
import { useThemedConfirm } from '@/composables/useThemedConfirm'
import { ApiError } from '@/services/authApi'
import { translateApiKey, translateApiMessage } from '@/services/apiMessageTranslator'
import { audioApi } from '@/services/audioApi'
import { flowNodeApi } from '@/services/flowNodeApi'
import { isSystemMode, isUserMode, modeRgbString, modeSemanticKey } from '@/services/modeVisuals'
import { modeApi } from '@/services/modeApi'
import { useAuthStore } from '@/stores/auth'
import type { Audio } from '@/types/audio'
import type { Flow, FlowNode } from '@/types/flow'
import type { Mode } from '@/types/mode'

const props = defineProps<{
  flow: Flow
}>()

const { t } = useI18n()
const auth = useAuthStore()
const { confirmDanger } = useThemedConfirm()

const nodes = ref<FlowNode[]>([])
const modes = ref<Mode[]>([])
const audios = ref<Audio[]>([])
const isLoading = ref(false)
const isCreating = ref(false)
const isReordering = ref(false)
const showAddPanel = ref(false)
const savingNodeIds = ref(new Set<number>())
const deletingNodeIds = ref(new Set<number>())
const recentlySavedNodeIds = ref(new Set<number>())
const error = ref<string | null>(null)
const successMessage = ref<string | null>(null)

const sortedNodes = computed(() =>
  [...nodes.value].sort((first, second) => first.order - second.order),
)
const availableModes = computed(() => modes.value.filter(isUserMode))
const alarmAudios = computed(() =>
  audios.value.filter(
    (audio) =>
      (audio.mode !== null && isSystemMode(audio.mode)) || audio.mode?.name === 'Session Alarm',
  ),
)
const hasAvailableModes = computed(() => availableModes.value.length > 0)
const hasAlarmAudios = computed(() => alarmAudios.value.length > 0)
const sectionCount = computed(() => sortedNodes.value.length)
const totalDuration = computed(() =>
  sortedNodes.value.reduce((duration, node) => duration + Number(node.time || 0), 0),
)
const longestDuration = computed(() =>
  sortedNodes.value.reduce((duration, node) => Math.max(duration, Number(node.time || 0)), 0),
)
const averageDuration = computed(() =>
  sectionCount.value === 0 ? 0 : Math.round(totalDuration.value / sectionCount.value),
)
const estimatedCompletion = computed(() => {
  if (totalDuration.value === 0) return '--'

  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(Date.now() + totalDuration.value * 60 * 1000))
})
const saveState = computed(() => {
  if (isLoading.value) return t('flowResource.builder.loading')
  if (isCreating.value || isReordering.value || savingNodeIds.value.size > 0) {
    return t('flowResource.builder.saving')
  }

  return 'Saved ✓'
})
const saveStateClass = computed(() => ({
  'is-saving': isCreating.value || isReordering.value || savingNodeIds.value.size > 0,
}))
const flowSummary = computed(() => {
  if (sectionCount.value === 0) return 'A blank ritual ready for its first intentional block.'

  return 'Designed as a calm sequence of attention, recovery, and completion.'
})
const previewSegments = computed(() =>
  sortedNodes.value.map((node) => {
    const mode = node.mode ?? modes.value.find((item) => item.id === Number(node.mode_id))
    const color = mode?.color ?? '#6ee7d8'
    const width =
      totalDuration.value === 0 ? 0 : Math.max(7, (node.time / totalDuration.value) * 100)

    return {
      id: node.id,
      label:
        node.title || mode?.name || t('flowResource.builder.sectionTitle', { number: node.order }),
      time: node.time,
      style: {
        '--segment-rgb': modeRgbString(color),
        flex: String(width),
      },
    }
  }),
)
const flowStats = computed(() => [
  { label: 'Total Duration', value: totalDuration.value + ' min' },
  { label: 'Sections', value: String(sectionCount.value) },
  { label: 'Longest Session', value: longestDuration.value + ' min' },
  { label: 'Average Block', value: averageDuration.value + ' min' },
])
const addModeOptions = computed(() =>
  availableModes.value.map((mode) => ({
    mode,
    title: modeLabel(mode),
    subtitle: modeOptionSubtitle(mode),
    time: defaultTimeForMode(mode),
    icon: iconForMode(mode),
    style: {
      '--option-rgb': modeRgbString(mode.color),
    },
  })),
)

const withOrders = (items: FlowNode[]) =>
  items.map((node, index) => ({
    ...node,
    order: index + 1,
  }))

const moveItem = <T,>(items: T[], fromIndex: number, toIndex: number) => {
  const nextItems = [...items]
  const [item] = nextItems.splice(fromIndex, 1)

  if (item === undefined) return items

  nextItems.splice(toIndex, 0, item)
  return nextItems
}

const nodePayload = (node: FlowNode) => ({
  title: normalizeNodeTitle(node.title, node.order),
  flow_id: node.flow_id,
  mode_id: node.mode_id,
  end_audio_id: node.end_audio_id,
  order: node.order,
  time: node.time,
})

const decorateNode = (node: FlowNode): FlowNode => {
  const mode = modes.value.find((item) => item.id === Number(node.mode_id))
  const endAudio =
    node.end_audio_id === null
      ? null
      : (audios.value.find((item) => Number(item.id) === Number(node.end_audio_id)) ?? null)

  return {
    ...node,
    title: normalizeNodeTitle(node.title, node.order),
    mode: mode ?? node.mode,
    end_audio: endAudio,
  }
}

function fallbackNodeTitle(order: number) {
  return t('flowResource.builder.sectionTitle', { number: order })
}

function normalizeNodeTitle(title: string | null | undefined, order: number) {
  const normalizedTitle = String(title ?? '').trim()

  return (normalizedTitle || fallbackNodeTitle(order)).slice(0, 255)
}

function defaultTitleForMode(mode: Mode, order: number) {
  return normalizeNodeTitle(modeLabel(mode), order)
}

function modeLabel(mode: Mode) {
  const key = modeSemanticKey(mode)

  return key ? t('modes.' + key + '.label') : mode.name
}

function defaultTimeForMode(mode: Mode) {
  const key = modeSemanticKey(mode)
  const name = mode.name.toLowerCase()

  if (key === 'sleep') return 45
  if (key === 'relax' || name.includes('break')) return 10
  return 25
}

function modeOptionSubtitle(mode: Mode) {
  const key = modeSemanticKey(mode)
  const name = mode.name.toLowerCase()

  if (key === 'sleep') return 'Deep calm block'
  if (key === 'relax' || name.includes('break')) return 'Reset and recover'
  return 'Focused attention block'
}

function iconForMode(mode: Mode) {
  const key = modeSemanticKey(mode)

  if (key === 'sleep') return 'pi pi-moon'
  if (key === 'relax') return 'pi pi-sparkles'
  return 'pi pi-bolt'
}

const markSaved = (nodeIds: number[]) => {
  const nextIds = new Set(recentlySavedNodeIds.value)

  nodeIds.forEach((id) => nextIds.add(id))
  recentlySavedNodeIds.value = nextIds

  window.setTimeout(() => {
    const currentIds = new Set(recentlySavedNodeIds.value)

    nodeIds.forEach((id) => currentIds.delete(id))
    recentlySavedNodeIds.value = currentIds
  }, 900)
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

const setSaving = (nodeId: number, saving: boolean) => {
  const nextIds = new Set(savingNodeIds.value)

  if (saving) nextIds.add(nodeId)
  else nextIds.delete(nodeId)

  savingNodeIds.value = nextIds
}

const setDeleting = (nodeId: number, deleting: boolean) => {
  const nextIds = new Set(deletingNodeIds.value)

  if (deleting) nextIds.add(nodeId)
  else nextIds.delete(nodeId)

  deletingNodeIds.value = nextIds
}

const loadBuilder = async () => {
  if (!auth.token) return

  isLoading.value = true
  error.value = null

  try {
    const [nodeResponse, modeResponse, audioResponse] = await Promise.all([
      flowNodeApi.listFlowNodes(auth.token, props.flow.id),
      modeApi.listAllModes(auth.token),
      audioApi.listAllAudios(auth.token),
    ])

    modes.value = modeResponse.data
    audios.value = audioResponse.data
    nodes.value = withOrders(
      [...nodeResponse.data].sort((first, second) => first.order - second.order).map(decorateNode),
    )
  } catch (caughtError) {
    setError(caughtError, 'flowResource.builder.errors.load')
  } finally {
    isLoading.value = false
  }
}

const focusNode = async (nodeId: number) => {
  await nextTick()

  const element = document.querySelector<HTMLElement>(
    '.flow-node-row[data-flow-node-id="' + nodeId + '"]',
  )

  element?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  element?.querySelector<HTMLElement>('.flow-title-input')?.focus()
}

const createNode = async (modeId?: number | string) => {
  if (!auth.token || isCreating.value) return

  const mode =
    modeId === undefined
      ? availableModes.value[0]
      : availableModes.value.find((item) => Number(item.id) === Number(modeId))
  const alarm = alarmAudios.value[0]

  if (!mode) {
    error.value = t('flowResource.builder.errors.noModes')
    return
  }

  if (!alarm) {
    error.value = t('flowResource.builder.errors.noAlarms')
    return
  }

  isCreating.value = true
  error.value = null
  successMessage.value = null

  try {
    const order = sortedNodes.value.length + 1
    const flowNode = await flowNodeApi.createFlowNode(auth.token, {
      title: defaultTitleForMode(mode, order),
      flow_id: props.flow.id,
      mode_id: mode.id,
      end_audio_id: alarm.id,
      order,
      time: defaultTimeForMode(mode),
    })

    nodes.value = withOrders([...sortedNodes.value, decorateNode(flowNode)])
    showAddPanel.value = false
    markSaved([flowNode.id])
    await focusNode(flowNode.id)
  } catch (caughtError) {
    setError(caughtError, 'flowResource.builder.errors.create')
  } finally {
    isCreating.value = false
  }
}

const updateNode = async (
  node: FlowNode,
  patch: Partial<Pick<FlowNode, 'title' | 'mode_id' | 'time' | 'end_audio_id'>>,
) => {
  if (!auth.token) return

  const previousNodes = nodes.value
  const nextNode = decorateNode({ ...node, ...patch })

  nodes.value = nodes.value.map((item) => (item.id === node.id ? nextNode : item))
  setSaving(node.id, true)
  error.value = null
  successMessage.value = null

  try {
    const savedNode = await flowNodeApi.updateFlowNode(auth.token, node.id, nodePayload(nextNode))

    nodes.value = nodes.value.map((item) =>
      item.id === savedNode.id ? decorateNode(savedNode) : item,
    )
    markSaved([savedNode.id])
  } catch (caughtError) {
    nodes.value = previousNodes
    setError(caughtError, 'flowResource.builder.errors.update')
  } finally {
    setSaving(node.id, false)
  }
}

const reorderNodes = async (fromIndex: number, toIndex: number) => {
  if (!auth.token || isReordering.value) return

  const currentNodes = sortedNodes.value

  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= currentNodes.length ||
    toIndex >= currentNodes.length
  ) {
    return
  }

  const previousNodes = nodes.value
  const reorderedNodes = withOrders(moveItem(currentNodes, fromIndex, toIndex))

  nodes.value = reorderedNodes
  isReordering.value = true
  error.value = null
  successMessage.value = null

  try {
    const savedNodes = await flowNodeApi.reorderFlowNodes(auth.token, reorderedNodes)

    nodes.value = withOrders(
      savedNodes.sort((first, second) => first.order - second.order).map(decorateNode),
    )
    markSaved(reorderedNodes.map((node) => node.id))
  } catch (caughtError) {
    nodes.value = previousNodes
    setError(caughtError, 'flowResource.builder.errors.reorder')
  } finally {
    isReordering.value = false
  }
}

const deleteNode = async (node: FlowNode) => {
  if (!auth.token) return

  const confirmed = await confirmDanger({
    message: t('flowResource.builder.confirmDeleteSection'),
  })

  if (!confirmed) return

  const previousNodes = nodes.value
  const remainingNodes = withOrders(sortedNodes.value.filter((item) => item.id !== node.id))

  nodes.value = remainingNodes
  setDeleting(node.id, true)
  error.value = null
  successMessage.value = null

  try {
    await flowNodeApi.deleteFlowNode(auth.token, node.id)
  } catch (caughtError) {
    nodes.value = previousNodes
    setError(caughtError, 'flowResource.builder.errors.delete')
    setDeleting(node.id, false)
    return
  }

  try {
    if (remainingNodes.length > 0) {
      const savedNodes = await flowNodeApi.reorderFlowNodes(auth.token, remainingNodes)

      nodes.value = withOrders(
        savedNodes.sort((first, second) => first.order - second.order).map(decorateNode),
      )
      markSaved(remainingNodes.map((item) => item.id))
    }
  } catch (caughtError) {
    setError(caughtError, 'flowResource.builder.errors.reorder')
  } finally {
    setDeleting(node.id, false)
  }
}

onMounted(() => {
  void loadBuilder()
})
</script>

<template>
  <section class="flow-builder-shell">
    <header class="flow-builder-hero">
      <div class="flow-builder-hero-copy">
        <div class="flow-builder-topline">
          <p class="flow-builder-eyebrow">{{ t('flowResource.builder.eyebrow') }}</p>
          <span class="flow-save-state" :class="saveStateClass">{{ saveState }}</span>
        </div>

        <h1>{{ flow.name }}</h1>
        <p class="flow-builder-meta">
          {{ sectionCount }} {{ sectionCount === 1 ? 'Section' : 'Sections' }} •
          {{ totalDuration }} min total • Ends around {{ estimatedCompletion }}
        </p>
        <p class="flow-builder-intent">{{ flowSummary }}</p>
      </div>

      <div class="flow-builder-actions">
        <Button
          :label="showAddPanel ? 'Close' : t('flowResource.builder.addSection')"
          :icon="showAddPanel ? 'pi pi-times' : 'pi pi-plus'"
          class="theme-primary-button flow-builder-add"
          :loading="isCreating"
          :disabled="isLoading || !hasAvailableModes || !hasAlarmAudios"
          @click="showAddPanel = !showAddPanel"
        />
      </div>
    </header>

    <section v-if="!isLoading" class="flow-overview-grid" aria-label="Flow overview">
      <div class="flow-preview-panel">
        <div class="flow-panel-heading">
          <span>Journey Preview</span>
          <strong>{{ totalDuration }}m</strong>
        </div>

        <div v-if="previewSegments.length > 0" class="flow-preview-track">
          <span
            v-for="segment in previewSegments"
            :key="segment.id"
            class="flow-preview-segment"
            :style="segment.style"
            :title="segment.label + ' • ' + segment.time + ' min'"
          />
        </div>
        <div v-else class="flow-preview-empty" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>

        <div v-if="previewSegments.length > 0" class="flow-preview-legend">
          <span v-for="segment in previewSegments" :key="segment.id">
            {{ segment.label }} · {{ segment.time }}m
          </span>
        </div>
      </div>

      <div class="flow-stats-panel">
        <div v-for="stat in flowStats" :key="stat.label" class="flow-stat-item">
          <span>{{ stat.label }}</span>
          <strong>{{ stat.value }}</strong>
        </div>
      </div>
    </section>

    <Transition name="flow-add-panel">
      <section v-if="showAddPanel && !isLoading" class="flow-add-panel">
        <div>
          <h2>Choose the next block</h2>
          <p>Start with a sensible duration, then tune it in the timeline.</p>
        </div>

        <div class="flow-add-options">
          <button
            v-for="option in addModeOptions"
            :key="option.mode.id"
            class="flow-add-option"
            type="button"
            :style="option.style"
            :disabled="isCreating"
            @click="createNode(option.mode.id)"
          >
            <span class="flow-add-option-icon"><i :class="option.icon" aria-hidden="true" /></span>
            <span>
              <strong>{{ option.title }}</strong>
              <small>{{ option.subtitle }} · {{ option.time }} min</small>
            </span>
          </button>
        </div>
      </section>
    </Transition>

    <div
      v-if="successMessage"
      class="theme-success-panel mt-5 rounded-[8px] border px-4 py-3 text-sm leading-6"
    >
      {{ successMessage }}
    </div>

    <div
      v-if="error"
      class="mt-5 rounded-[8px] border border-red-300/30 bg-red-500/10 px-4 py-3 text-sm leading-6 text-red-100"
    >
      {{ error }}
    </div>

    <div
      v-if="!isLoading && hasAvailableModes && !hasAlarmAudios"
      class="mt-5 rounded-[8px] border border-red-300/30 bg-red-500/10 px-4 py-3 text-sm leading-6 text-red-100"
    >
      {{ t('flowResource.builder.errors.noAlarms') }}
    </div>

    <div v-if="isLoading" class="flow-builder-loading">
      {{ t('flowResource.builder.loading') }}
    </div>

    <section v-else-if="sortedNodes.length === 0" class="flow-builder-empty">
      <div class="flow-empty-visual" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <h2>{{ t('flowResource.builder.emptyTitle') }}</h2>
      <p>Create your first block to start shaping the rhythm of this flow.</p>
      <Button
        :label="t('flowResource.builder.addFirstSection')"
        icon="pi pi-plus"
        class="theme-primary-button !justify-center"
        :loading="isCreating"
        :disabled="!hasAvailableModes || !hasAlarmAudios"
        @click="showAddPanel = true"
      />
    </section>

    <FlowNodeList
      v-else
      class="mt-6"
      :nodes="sortedNodes"
      :modes="availableModes"
      :alarms="alarmAudios"
      :saving-node-ids="savingNodeIds"
      :deleting-node-ids="deletingNodeIds"
      :recently-saved-node-ids="recentlySavedNodeIds"
      :disabled="isReordering"
      @update="updateNode"
      @delete="deleteNode"
      @reorder="reorderNodes"
    />
  </section>
</template>

<style scoped>
.flow-builder-shell {
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  background:
    radial-gradient(circle at 8% 0%, rgba(var(--mode-glow-rgb), 0.18), transparent 27rem),
    radial-gradient(circle at 94% 18%, rgba(var(--mode-companion-rgb), 0.12), transparent 30rem),
    rgba(7, 16, 14, 0.84);
  padding: clamp(1rem, 3vw, 1.35rem);
  box-shadow: 0 24px 90px rgba(0, 0, 0, 0.28);
  backdrop-filter: blur(24px);
}

.flow-builder-hero {
  display: grid;
  gap: 1.2rem;
}

.flow-builder-topline {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
}

.flow-builder-eyebrow {
  margin: 0;
  color: var(--mode-accent);
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0;
  line-height: 1.1;
  text-transform: uppercase;
}

.flow-save-state {
  display: inline-flex;
  min-height: 1.7rem;
  align-items: center;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.055);
  color: rgba(255, 255, 255, 0.68);
  font-size: 0.76rem;
  font-weight: 760;
  padding: 0.22rem 0.6rem;
  transition:
    border-color 180ms ease,
    background 180ms ease,
    color 180ms ease;
}

.flow-save-state.is-saving {
  border-color: rgba(var(--mode-glow-rgb), 0.36);
  background: rgba(var(--mode-glow-rgb), 0.12);
  color: #ffffff;
}

.flow-builder-hero h1 {
  margin: 0.55rem 0 0;
  color: #ffffff;
  font-size: clamp(2.8rem, 7vw, 5.2rem);
  font-weight: 780;
  letter-spacing: 0;
  line-height: 0.92;
  overflow-wrap: anywhere;
}

.flow-builder-meta {
  margin: 1rem 0 0;
  color: rgba(255, 255, 255, 0.78);
  font-size: clamp(0.98rem, 2vw, 1.12rem);
  font-weight: 680;
  line-height: 1.45;
}

.flow-builder-intent {
  max-width: 44rem;
  margin: 0.6rem 0 0;
  color: rgba(255, 255, 255, 0.58);
  font-size: 0.98rem;
  line-height: 1.7;
}

.flow-builder-add {
  width: 100%;
  justify-content: center !important;
  transition:
    transform 160ms ease,
    box-shadow 160ms ease;
}

.flow-builder-add:active {
  transform: scale(0.98);
}

.flow-overview-grid {
  display: grid;
  gap: 0.85rem;
  margin-top: 1.35rem;
}

.flow-preview-panel,
.flow-stats-panel,
.flow-add-panel {
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.045);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

.flow-preview-panel {
  padding: 1rem;
}

.flow-panel-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  color: rgba(255, 255, 255, 0.58);
  font-size: 0.78rem;
  font-weight: 760;
  text-transform: uppercase;
}

.flow-panel-heading strong {
  color: #ffffff;
}

.flow-preview-track,
.flow-preview-empty {
  display: flex;
  height: 0.82rem;
  gap: 0.25rem;
  margin-top: 0.95rem;
}

.flow-preview-segment {
  min-width: 0.75rem;
  border-radius: 999px;
  background: linear-gradient(
    90deg,
    rgba(var(--segment-rgb), 0.95),
    rgba(var(--segment-rgb), 0.45)
  );
  box-shadow: 0 0 1.2rem rgba(var(--segment-rgb), 0.18);
  transition:
    flex 220ms cubic-bezier(0.2, 0.8, 0.2, 1),
    opacity 180ms ease,
    transform 180ms ease;
}

.flow-preview-segment:hover {
  transform: translateY(-1px);
  opacity: 0.9;
}

.flow-preview-empty span {
  flex: 1;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.075);
}

.flow-preview-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem 0.85rem;
  margin-top: 0.85rem;
  color: rgba(255, 255, 255, 0.56);
  font-size: 0.8rem;
  line-height: 1.4;
}

.flow-stats-panel {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1px;
  overflow: hidden;
}

.flow-stat-item {
  display: grid;
  gap: 0.35rem;
  min-height: 5.4rem;
  align-content: center;
  background: rgba(255, 255, 255, 0.035);
  padding: 0.95rem;
}

.flow-stat-item span {
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.74rem;
  font-weight: 760;
  text-transform: uppercase;
}

.flow-stat-item strong {
  color: #ffffff;
  font-size: 1.2rem;
  font-weight: 760;
  line-height: 1.05;
}

.flow-add-panel {
  display: grid;
  gap: 1rem;
  margin-top: 1rem;
  padding: 1rem;
}

.flow-add-panel h2 {
  margin: 0;
  color: #ffffff;
  font-size: 1rem;
  font-weight: 780;
}

.flow-add-panel p {
  margin: 0.35rem 0 0;
  color: rgba(255, 255, 255, 0.56);
  line-height: 1.6;
}

.flow-add-options {
  display: grid;
  gap: 0.65rem;
}

.flow-add-option {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  min-height: 4.25rem;
  border: 1px solid rgba(var(--option-rgb), 0.18);
  border-radius: 8px;
  background: rgba(var(--option-rgb), 0.07);
  color: #ffffff;
  padding: 0.85rem;
  text-align: left;
  transition:
    transform 170ms ease,
    border-color 170ms ease,
    background 170ms ease,
    box-shadow 170ms ease;
}

.flow-add-option:hover {
  border-color: rgba(var(--option-rgb), 0.42);
  background: rgba(var(--option-rgb), 0.12);
  box-shadow: 0 16px 46px rgba(var(--option-rgb), 0.12);
  transform: translateY(-1px);
}

.flow-add-option:active {
  transform: scale(0.99);
}

.flow-add-option-icon {
  display: grid;
  width: 2.4rem;
  height: 2.4rem;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 8px;
  background: rgba(var(--option-rgb), 0.14);
  color: rgb(var(--option-rgb));
}

.flow-add-option strong,
.flow-add-option small {
  display: block;
}

.flow-add-option strong {
  font-size: 0.94rem;
  font-weight: 760;
}

.flow-add-option small {
  margin-top: 0.18rem;
  color: rgba(255, 255, 255, 0.58);
  font-size: 0.8rem;
}

.flow-builder-loading,
.flow-builder-empty {
  margin-top: 1.25rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.045);
  padding: clamp(1.5rem, 5vw, 3rem);
  text-align: center;
}

.flow-builder-loading {
  color: rgba(255, 255, 255, 0.62);
  font-size: 0.95rem;
}

.flow-builder-empty {
  display: grid;
  justify-items: center;
  gap: 0.75rem;
}

.flow-empty-visual {
  display: grid;
  width: min(18rem, 100%);
  gap: 0.55rem;
  margin-bottom: 0.4rem;
}

.flow-empty-visual span {
  height: 0.68rem;
  border-radius: 999px;
  background: linear-gradient(90deg, rgba(var(--mode-glow-rgb), 0.42), rgba(255, 255, 255, 0.06));
}

.flow-empty-visual span:nth-child(2) {
  width: 62%;
  background: linear-gradient(
    90deg,
    rgba(var(--mode-companion-rgb), 0.34),
    rgba(255, 255, 255, 0.05)
  );
}

.flow-empty-visual span:nth-child(3) {
  width: 78%;
  background: linear-gradient(90deg, rgba(130, 120, 255, 0.34), rgba(255, 255, 255, 0.05));
}

.flow-builder-empty h2 {
  margin: 0;
  color: #ffffff;
  font-size: 1.35rem;
  font-weight: 760;
}

.flow-builder-empty p {
  max-width: 28rem;
  margin: 0 0 0.35rem;
  color: rgba(255, 255, 255, 0.62);
  line-height: 1.6;
}

.flow-add-panel-enter-active,
.flow-add-panel-leave-active {
  transition:
    opacity 180ms ease,
    transform 180ms ease;
}

.flow-add-panel-enter-from,
.flow-add-panel-leave-to {
  opacity: 0;
  transform: translateY(-0.35rem);
}

@media (min-width: 760px) {
  .flow-builder-shell {
    padding: clamp(1.25rem, 3vw, 2rem);
  }

  .flow-builder-hero {
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: flex-start;
  }

  .flow-builder-add {
    width: auto;
    min-width: 10.5rem;
  }

  .flow-overview-grid {
    grid-template-columns: minmax(0, 1.35fr) minmax(18rem, 0.65fr);
    align-items: stretch;
  }

  .flow-add-panel {
    grid-template-columns: minmax(12rem, 0.55fr) minmax(0, 1fr);
    align-items: start;
  }

  .flow-add-options {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
