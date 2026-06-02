<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'

import { resolveFlowNodeMode, sortFlowNodes } from '@/services/flowExecution'
import { modeSemanticKey } from '@/services/modeVisuals'
import type { Flow, FlowNode } from '@/types/flow'
import type { Mode } from '@/types/mode'

type FlowVisualIdentity = {
  key: string
  label: string
  accent: string
  accentRgb: string
  ink: string
}

type FlowPickerSummary = {
  flow: Flow
  nodes: FlowNode[]
  totalMinutes: number
  sectionCount: number
  dominantMode: Mode | null
  identity: FlowVisualIdentity
  description: string
  timeline: FlowNode[]
}

const props = defineProps<{
  visible: boolean
  flows: Flow[]
  modes: Mode[]
  nodesByFlowId: Record<number, FlowNode[]>
  selectedFlowId: number | null
  isLoadingFlows: boolean
  isLoadingSelectedFlow: boolean
  loadingFlowSummaryIds: number[]
}>()

const emit = defineEmits<{
  'update:visible': [visible: boolean]
  start: [flowId: number]
  clear: []
  requestSummaries: []
}>()

const { t } = useI18n()
const previewFlowId = ref<number | null>(props.selectedFlowId)

const sortedFlows = computed(() =>
  [...props.flows].sort((first, second) => first.name.localeCompare(second.name)),
)
const flowPickerSummaries = computed(() =>
  sortedFlows.value.map((flow) =>
    createFlowPickerSummary(flow, props.nodesByFlowId[flow.id] ?? []),
  ),
)
const selectedFlowPickerSummary = computed(
  () =>
    flowPickerSummaries.value.find((summary) => summary.flow.id === previewFlowId.value) ??
    flowPickerSummaries.value[0] ??
    null,
)

watch(
  () => props.visible,
  (visible) => {
    if (!visible) return

    previewFlowId.value = props.selectedFlowId ?? sortedFlows.value[0]?.id ?? null
    emit('requestSummaries')
  },
)

watch(sortedFlows, (flows) => {
  if (!props.visible || previewFlowId.value !== null || flows.length === 0) return

  previewFlowId.value = flows.at(0)?.id ?? null
})

function close() {
  emit('update:visible', false)
}

function startJourney() {
  const summary = selectedFlowPickerSummary.value

  if (!summary || summary.sectionCount === 0) return

  emit('start', summary.flow.id)
}

function clearFlow() {
  emit('clear')
  close()
}

function hexToRgbTriplet(color: string | null | undefined) {
  const normalized = color?.trim().replace('#', '') ?? ''
  const expanded =
    normalized.length === 3
      ? normalized
          .split('')
          .map((part) => part + part)
          .join('')
      : normalized

  if (!/^[0-9a-fA-F]{6}$/.test(expanded)) return '110, 231, 216'

  return [0, 2, 4]
    .map((index) => String(Number.parseInt(expanded.slice(index, index + 2), 16)))
    .join(', ')
}

function normalizedModeName(mode: Mode | null | undefined) {
  return mode?.name.trim().toLowerCase() ?? ''
}

function flowVisualIdentity(mode: Mode | null): FlowVisualIdentity {
  const modeKey = modeSemanticKey(mode) ?? normalizedModeName(mode) ?? 'focus'
  const fallbackAccent = mode?.color || '#6ee7d8'

  if (modeKey.includes('relax')) {
    return {
      key: 'relax',
      label: t('coreTimer.flow.identities.relax'),
      accent: mode?.color || '#f7b267',
      accentRgb: hexToRgbTriplet(mode?.color || '#f7b267'),
      ink: '#1a1208',
    }
  }

  if (modeKey.includes('sleep')) {
    return {
      key: 'deep',
      label: t('coreTimer.flow.identities.deep'),
      accent: mode?.color || '#93c5fd',
      accentRgb: hexToRgbTriplet(mode?.color || '#93c5fd'),
      ink: '#05101d',
    }
  }

  if (modeKey.includes('creative')) {
    return {
      key: 'creative',
      label: t('coreTimer.flow.identities.creative'),
      accent: mode?.color || '#c084fc',
      accentRgb: hexToRgbTriplet(mode?.color || '#c084fc'),
      ink: '#16051f',
    }
  }

  return {
    key: 'focus',
    label: t('coreTimer.flow.identities.focus'),
    accent: fallbackAccent,
    accentRgb: hexToRgbTriplet(fallbackAccent),
    ink: '#04110f',
  }
}

function dominantFlowMode(nodes: FlowNode[]) {
  const modeCounts = nodes.reduce<Record<number, number>>((counts, node) => {
    const modeId = Number(node.mode_id)

    if (Number.isFinite(modeId)) counts[modeId] = (counts[modeId] ?? 0) + 1

    return counts
  }, {})
  const dominantModeId = Number(
    Object.entries(modeCounts).sort((first, second) => second[1] - first[1])[0]?.[0],
  )

  return (
    props.modes.find((mode) => mode.id === dominantModeId) ??
    nodes[0]?.mode ??
    props.modes[0] ??
    null
  )
}

function createFlowPickerSummary(flow: Flow, nodes: FlowNode[]): FlowPickerSummary {
  const sortedNodes = sortFlowNodes(nodes)
  const dominantMode = dominantFlowMode(sortedNodes)
  const identity = flowVisualIdentity(dominantMode)
  const sectionCount = sortedNodes.length
  const totalMinutes = sortedNodes.reduce(
    (total, node) => total + Math.max(1, Math.round(Number(node.time) || 1)),
    0,
  )

  return {
    flow,
    nodes: sortedNodes,
    totalMinutes,
    sectionCount,
    dominantMode,
    identity,
    description: t('coreTimer.flow.descriptions.' + identity.key),
    timeline: sortedNodes.slice(0, 6),
  }
}

function formatJourneyDuration(totalMinutes: number) {
  const minutes = Math.max(0, Math.round(totalMinutes))
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60

  if (hours > 0 && remainingMinutes > 0) {
    return t('coreTimer.flow.durationHoursMinutes', { hours, minutes: remainingMinutes })
  }

  if (hours > 0) return t('coreTimer.flow.durationHours', { hours })

  return t('coreTimer.minutes', { count: minutes })
}

function flowPickerCardStyle(summary: FlowPickerSummary) {
  return {
    '--flow-card-accent': summary.identity.accent,
    '--flow-card-rgb': summary.identity.accentRgb,
    '--flow-card-ink': summary.identity.ink,
  }
}

function isFlowSummaryLoading(flowId: number) {
  return props.loadingFlowSummaryIds.includes(flowId)
}
</script>

<template>
  <Dialog
    :visible="visible"
    modal
    :draggable="false"
    :show-header="false"
    class="core-flow-picker-dialog"
    @update:visible="emit('update:visible', $event)"
  >
    <section class="core-flow-picker">
      <header class="core-flow-picker-header">
        <div>
          <p>{{ t('coreTimer.flow.pickerEyebrow') }}</p>
          <h2>{{ t('coreTimer.flow.pickerTitle') }}</h2>
        </div>
        <button
          type="button"
          class="core-flow-picker-close"
          :aria-label="t('auth.actions.cancel')"
          @click="close"
        >
          <i class="pi pi-times" aria-hidden="true" />
        </button>
      </header>

      <div v-if="isLoadingFlows && flowPickerSummaries.length === 0" class="core-flow-picker-state">
        <i class="pi pi-spin pi-spinner" aria-hidden="true" />
        <span>{{ t('coreTimer.flow.loading') }}</span>
      </div>

      <div v-else-if="flowPickerSummaries.length === 0" class="core-flow-picker-state">
        <i class="pi pi-compass" aria-hidden="true" />
        <span>{{ t('coreTimer.flow.noFlows') }}</span>
      </div>

      <div v-else class="core-flow-picker-body">
        <div class="core-flow-card-grid">
          <button
            v-for="summary in flowPickerSummaries"
            :key="summary.flow.id"
            type="button"
            class="core-journey-card"
            :class="[
              'core-journey-card--' + summary.identity.key,
              { 'core-journey-card--selected': summary.flow.id === previewFlowId },
            ]"
            :style="flowPickerCardStyle(summary)"
            @click="previewFlowId = summary.flow.id"
          >
            <span class="core-journey-visual" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            <span class="core-journey-copy">
              <strong>{{ summary.flow.name }}</strong>
              <small>{{ summary.description }}</small>
            </span>
            <span class="core-journey-meta">
              <span>{{ t('coreTimer.flow.sectionCount', { count: summary.sectionCount }) }}</span>
              <span>{{ formatJourneyDuration(summary.totalMinutes) }}</span>
              <span>{{ summary.identity.label }}</span>
            </span>
            <span v-if="isFlowSummaryLoading(summary.flow.id)" class="core-journey-loading">
              <i class="pi pi-spin pi-spinner" aria-hidden="true" />
            </span>
          </button>
        </div>

        <aside v-if="selectedFlowPickerSummary" class="core-flow-preview">
          <div
            class="core-flow-preview-heading"
            :style="flowPickerCardStyle(selectedFlowPickerSummary)"
          >
            <span>{{ selectedFlowPickerSummary.identity.label }}</span>
            <h3>{{ selectedFlowPickerSummary.flow.name }}</h3>
            <p>{{ selectedFlowPickerSummary.description }}</p>
          </div>

          <div class="core-flow-preview-stats">
            <span>
              <small>{{ t('coreTimer.flow.sectionsLabel') }}</small>
              <strong>{{ selectedFlowPickerSummary.sectionCount }}</strong>
            </span>
            <span>
              <small>{{ t('coreTimer.flow.durationLabel') }}</small>
              <strong>{{ formatJourneyDuration(selectedFlowPickerSummary.totalMinutes) }}</strong>
            </span>
          </div>

          <div class="core-flow-preview-timeline">
            <p>{{ t('coreTimer.flow.previewTimeline') }}</p>
            <ol v-if="selectedFlowPickerSummary.timeline.length > 0">
              <li
                v-for="node in selectedFlowPickerSummary.timeline"
                :key="node.id"
                :style="flowPickerCardStyle(selectedFlowPickerSummary)"
              >
                <span>{{
                  resolveFlowNodeMode(node, modes)?.name ?? selectedFlowPickerSummary.identity.label
                }}</span>
                <strong>{{ node.title }}</strong>
                <small>{{
                  t('coreTimer.minutes', {
                    count: Math.max(1, Math.round(Number(node.time) || 1)),
                  })
                }}</small>
              </li>
            </ol>
            <div v-else class="core-flow-preview-empty">
              {{ t('coreTimer.flow.emptyTitle') }}
            </div>
          </div>

          <div class="core-flow-picker-actions">
            <Button
              type="button"
              icon="pi pi-arrow-right"
              icon-pos="right"
              :label="t('coreTimer.flow.startJourney')"
              class="core-start-journey"
              :disabled="isLoadingSelectedFlow || selectedFlowPickerSummary.sectionCount === 0"
              @click="startJourney"
            />
            <Button
              v-if="selectedFlowId"
              type="button"
              icon="pi pi-times"
              :label="t('coreTimer.flow.returnDefault')"
              text
              class="core-picker-secondary"
              @click="clearFlow"
            />
          </div>
        </aside>
      </div>
    </section>
  </Dialog>
</template>

<style scoped>
:global(.core-flow-picker-dialog) {
  width: min(72rem, calc(100vw - 1.5rem));
  overflow: hidden;
  border: 1px solid rgba(110, 231, 216, 0.22);
  border-radius: 18px;
  background:
    linear-gradient(145deg, rgba(110, 231, 216, 0.14), transparent 40%), rgba(5, 9, 11, 0.96) !important;
  color: #f7fbf8 !important;
  box-shadow:
    0 2rem 7rem rgba(0, 0, 0, 0.66),
    0 0 0 1px rgba(255, 255, 255, 0.04),
    inset 0 1px 0 rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(28px);
}

:global(.core-flow-picker-dialog .p-dialog-content) {
  overflow: hidden;
  background: transparent !important;
  color: inherit;
  padding: 0;
}

.core-flow-picker {
  position: relative;
  overflow: hidden;
  padding: 1rem;
}

.core-flow-picker::before {
  position: absolute;
  inset: -30% -20% auto;
  height: 22rem;
  background: radial-gradient(circle, rgba(110, 231, 216, 0.18), transparent 62%);
  content: '';
  filter: blur(10px);
  pointer-events: none;
}

.core-flow-picker-header {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.35rem 0.35rem 1rem;
}

.core-flow-picker-header p,
.core-flow-preview-timeline p {
  margin: 0;
  color: #6ee7d8;
  font-size: 0.72rem;
  font-weight: 820;
  line-height: 1.2;
  text-transform: uppercase;
}

.core-flow-picker-header h2 {
  margin: 0.3rem 0 0;
  color: #ffffff;
  font-size: clamp(1.8rem, 4vw, 3.5rem);
  font-weight: 760;
  letter-spacing: 0;
  line-height: 0.98;
}

.core-flow-picker-close {
  display: grid;
  width: 2.65rem;
  height: 2.65rem;
  flex: 0 0 auto;
  place-items: center;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.72);
}

.core-flow-picker-body {
  position: relative;
  z-index: 1;
  display: grid;
  gap: 1rem;
  animation: core-picker-enter 220ms ease both;
}

.core-flow-card-grid {
  display: grid;
  gap: 0.8rem;
}

.core-journey-card {
  position: relative;
  display: grid;
  min-height: 13rem;
  overflow: hidden;
  border: 1px solid rgba(var(--flow-card-rgb), 0.24);
  border-radius: 14px;
  background:
    radial-gradient(circle at 84% 18%, rgba(var(--flow-card-rgb), 0.3), transparent 30%),
    linear-gradient(145deg, rgba(var(--flow-card-rgb), 0.13), rgba(255, 255, 255, 0.045)),
    rgba(5, 10, 12, 0.82);
  color: #ffffff;
  padding: 1rem;
  text-align: left;
  box-shadow: 0 1rem 3rem rgba(0, 0, 0, 0.22);
  transition:
    border-color 220ms ease,
    box-shadow 220ms ease,
    transform 220ms ease,
    min-height 220ms ease;
}

.core-journey-card:hover,
.core-journey-card--selected {
  border-color: rgba(var(--flow-card-rgb), 0.58);
  box-shadow:
    0 1.6rem 4.5rem rgba(0, 0, 0, 0.34),
    0 0 2.5rem rgba(var(--flow-card-rgb), 0.16);
  transform: translateY(-2px) scale(1.01);
}

.core-journey-card--selected {
  min-height: 15.5rem;
}

.core-journey-visual {
  position: absolute;
  inset: auto 1rem 1rem auto;
  display: grid;
  width: 5.5rem;
  aspect-ratio: 1;
  place-items: center;
  opacity: 0.9;
}

.core-journey-visual span {
  position: absolute;
  border: 1px solid rgba(var(--flow-card-rgb), 0.42);
  border-radius: 999px;
  animation: core-flow-pulse 3.4s ease-in-out infinite;
}

.core-journey-visual span:nth-child(1) {
  inset: 12%;
}

.core-journey-visual span:nth-child(2) {
  inset: 26%;
  animation-delay: 260ms;
}

.core-journey-visual span:nth-child(3) {
  inset: 40%;
  background: var(--flow-card-accent);
  box-shadow: 0 0 1.5rem rgba(var(--flow-card-rgb), 0.56);
}

.core-journey-card--creative .core-journey-visual span {
  border-radius: 42% 58% 54% 46%;
}

.core-journey-card--relax .core-journey-visual span {
  animation-duration: 4.8s;
}

.core-journey-copy,
.core-journey-meta {
  position: relative;
  z-index: 1;
}

.core-journey-copy strong {
  display: block;
  max-width: 18rem;
  color: #ffffff;
  font-size: clamp(1.15rem, 2vw, 1.65rem);
  font-weight: 760;
  line-height: 1.05;
  overflow-wrap: anywhere;
}

.core-journey-copy small {
  display: block;
  max-width: 21rem;
  margin-top: 0.65rem;
  color: rgba(255, 255, 255, 0.62);
  font-size: 0.88rem;
  line-height: 1.45;
}

.core-journey-meta {
  display: flex;
  flex-wrap: wrap;
  align-self: end;
  gap: 0.45rem;
  margin-top: 2rem;
}

.core-journey-meta span {
  border: 1px solid rgba(var(--flow-card-rgb), 0.22);
  border-radius: 999px;
  background: rgba(var(--flow-card-rgb), 0.11);
  color: rgba(255, 255, 255, 0.78);
  font-size: 0.72rem;
  font-weight: 760;
  line-height: 1;
  padding: 0.48rem 0.62rem;
}

.core-journey-loading {
  position: absolute;
  top: 0.85rem;
  right: 0.85rem;
  color: var(--flow-card-accent);
}

.core-flow-preview {
  display: grid;
  align-content: start;
  gap: 0.85rem;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.055);
  padding: 1rem;
  animation: core-preview-reveal 260ms ease both;
}

.core-flow-preview-heading {
  border-radius: 12px;
  background:
    radial-gradient(circle at 84% 24%, rgba(var(--flow-card-rgb), 0.32), transparent 34%),
    rgba(var(--flow-card-rgb), 0.1);
  padding: 1rem;
}

.core-flow-preview-heading span {
  color: var(--flow-card-accent);
  font-size: 0.72rem;
  font-weight: 820;
  text-transform: uppercase;
}

.core-flow-preview-heading h3 {
  margin: 0.35rem 0 0;
  color: #ffffff;
  font-size: clamp(1.35rem, 3vw, 2.25rem);
  font-weight: 760;
  line-height: 1.04;
}

.core-flow-preview-heading p {
  margin: 0.7rem 0 0;
  color: rgba(255, 255, 255, 0.62);
  line-height: 1.5;
}

.core-flow-preview-stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.65rem;
}

.core-flow-preview-stats span {
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.055);
  padding: 0.75rem;
}

.core-flow-preview-stats small,
.core-flow-preview-stats strong {
  display: block;
}

.core-flow-preview-stats small {
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.68rem;
  font-weight: 800;
  text-transform: uppercase;
}

.core-flow-preview-stats strong {
  margin-top: 0.25rem;
  color: #ffffff;
  font-size: 1.05rem;
  font-weight: 760;
}

.core-flow-preview-timeline ol {
  display: grid;
  gap: 0.55rem;
  margin: 0.75rem 0 0;
  padding: 0;
  list-style: none;
}

.core-flow-preview-timeline li {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.22rem 0.7rem;
  border-left: 2px solid var(--flow-card-accent);
  border-radius: 8px;
  background: rgba(var(--flow-card-rgb), 0.08);
  padding: 0.65rem 0.7rem;
  animation: core-preview-reveal 260ms ease both;
}

.core-flow-preview-timeline li span,
.core-flow-preview-timeline li small {
  color: rgba(255, 255, 255, 0.52);
  font-size: 0.68rem;
  font-weight: 760;
}

.core-flow-preview-timeline li strong {
  min-width: 0;
  color: #ffffff;
  font-size: 0.86rem;
  line-height: 1.2;
  overflow-wrap: anywhere;
}

.core-flow-preview-timeline li small {
  grid-row: 1 / span 2;
  grid-column: 2;
  align-self: center;
  white-space: nowrap;
}

.core-flow-preview-empty,
.core-flow-picker-state {
  color: rgba(255, 255, 255, 0.56);
  font-size: 0.9rem;
}

.core-flow-picker-state {
  position: relative;
  z-index: 1;
  display: grid;
  min-height: 22rem;
  place-items: center;
  gap: 0.75rem;
  text-align: center;
}

.core-flow-preview-empty {
  margin-top: 0.75rem;
}

.core-flow-picker-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
  margin-top: 0.2rem;
}

.core-start-journey {
  border-color: transparent !important;
  background: #6ee7d8 !important;
  color: #04110f !important;
  font-weight: 800 !important;
}

.core-picker-secondary {
  color: rgba(255, 255, 255, 0.74) !important;
}

@keyframes core-flow-pulse {
  0%,
  100% {
    opacity: 0.58;
    transform: scale(0.94) rotate(0deg);
  }

  50% {
    opacity: 1;
    transform: scale(1.08) rotate(12deg);
  }
}

@keyframes core-picker-enter {
  from {
    opacity: 0;
    transform: translateY(0.8rem) scale(0.985);
  }

  to {
    opacity: 1;
    transform: none;
  }
}

@keyframes core-preview-reveal {
  from {
    opacity: 0;
    transform: translateY(0.45rem);
  }

  to {
    opacity: 1;
    transform: none;
  }
}

@media (min-width: 900px) {
  .core-flow-picker {
    padding: 1.25rem;
  }

  .core-flow-picker-body {
    grid-template-columns: minmax(0, 1fr) minmax(20rem, 0.42fr);
    align-items: start;
  }

  .core-flow-card-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .core-journey-card--selected {
    grid-column: span 2;
  }
}

@media (prefers-reduced-motion: reduce) {
  .core-journey-card,
  .core-flow-picker-body,
  .core-flow-preview,
  .core-flow-preview-timeline li {
    animation: none;
    transition: none;
  }

  .core-journey-visual span {
    animation: none;
  }
}
</style>
