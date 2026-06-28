<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'

import { resolveFlowNodeMode, sortFlowNodes } from '@/services/flowExecution'
import { modeSemanticKey } from '@/services/modeVisuals'
import type { Flow, FlowNode } from '@/types/flow'
import type { Mode } from '@/types/mode'

type FlowExperienceKey = 'focus' | 'relax' | 'sleep' | 'creative'
type JourneyNodeKind = 'focus' | 'recovery' | 'sleep' | 'creative'

type FlowVisualIdentity = {
  key: FlowExperienceKey
  label: string
  accent: string
  accentRgb: string
  ink: string
}

type JourneyNodeView = {
  id: number
  title: string
  minutes: number
  modeName: string
  kind: JourneyNodeKind
  roleLabel: string
  icon: string
  energy: number
  accent: string
  accentRgb: string
  style: Record<string, string>
}

type JourneyMetric = {
  label: string
  value: string
}

type EnergyPoint = {
  x: number
  y: number
}

type FlowPickerSummary = {
  flow: Flow
  nodes: FlowNode[]
  totalMinutes: number
  sectionCount: number
  dominantMode: Mode | null
  identity: FlowVisualIdentity
  description: string
  nodeViews: JourneyNodeView[]
  signatureNodes: JourneyNodeView[]
  metrics: JourneyMetric[]
  narrative: string
  outcomes: string[]
  ctaLabel: string
  energyPath: string
  energyFillPath: string
  energyPoints: EnergyPoint[]
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

function normalizedText(value: string | null | undefined) {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function experienceKeyFromText(value: string | null | undefined): FlowExperienceKey | null {
  const text = normalizedText(value)

  if (!text) return null
  if (/\b(creative|criativo|creativo|creation|idea|ideia|brainstorm)\b/.test(text)) {
    return 'creative'
  }
  if (/\b(sleep|sleeping|sono|sueno|dormir|delta|night|noite)\b/.test(text)) return 'sleep'
  if (/\b(relax|relaxed|relaxing|recovery|recover|rest|pausa|break|reset|theta)\b/.test(text)) {
    return 'relax'
  }
  if (/\b(focus|focused|foco|study|estudo|deep|work|concentr|attention|beta)\b/.test(text)) {
    return 'focus'
  }

  return null
}

function experienceKeyFromMode(mode: Mode | null | undefined): FlowExperienceKey | null {
  const semanticKey = modeSemanticKey(mode)

  if (semanticKey === 'sleep') return 'sleep'
  if (semanticKey === 'relax') return 'relax'
  if (semanticKey === 'focus') return 'focus'

  return experienceKeyFromText(`${mode?.name ?? ''} ${mode?.description ?? ''}`)
}

function translatedModeName(mode: Mode | null | undefined, fallback: string) {
  if (!mode) return fallback

  const key = modeSemanticKey(mode)

  return key ? t('modes.' + key + '.label') : mode.name
}

function flowVisualIdentity(flow: Flow, mode: Mode | null): FlowVisualIdentity {
  const modeKey =
    experienceKeyFromText(flow.name) ??
    experienceKeyFromMode(mode) ??
    experienceKeyFromText(normalizedModeName(mode)) ??
    'focus'
  const fallbackAccent = mode?.color || '#6ee7d8'

  if (modeKey === 'relax') {
    return {
      key: 'relax',
      label: t('coreTimer.flow.identities.relax'),
      accent: mode?.color || '#f59e5b',
      accentRgb: hexToRgbTriplet(mode?.color || '#f59e5b'),
      ink: '#10061c',
    }
  }

  if (modeKey === 'sleep') {
    return {
      key: 'sleep',
      label: t('coreTimer.flow.identities.sleep'),
      accent: mode?.color || '#a78bfa',
      accentRgb: hexToRgbTriplet(mode?.color || '#a78bfa'),
      ink: '#05101d',
    }
  }

  if (modeKey === 'creative') {
    return {
      key: 'creative',
      label: t('coreTimer.flow.identities.creative'),
      accent: mode?.color || '#f6c763',
      accentRgb: hexToRgbTriplet(mode?.color || '#f6c763'),
      ink: '#1a1102',
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
  const modeMinutes = nodes.reduce<Record<number, number>>((counts, node) => {
    const modeId = Number(node.mode_id)

    if (Number.isFinite(modeId)) {
      counts[modeId] = (counts[modeId] ?? 0) + Math.max(1, Math.round(Number(node.time) || 1))
    }

    return counts
  }, {})
  const dominantModeId = Number(
    Object.entries(modeMinutes).sort((first, second) => second[1] - first[1])[0]?.[0],
  )

  return (
    props.modes.find((mode) => mode.id === dominantModeId) ??
    nodes[0]?.mode ??
    props.modes[0] ??
    null
  )
}

function journeyKindForNode(node: FlowNode): JourneyNodeKind {
  const mode = resolveFlowNodeMode(node, props.modes)
  const titleExperience = experienceKeyFromText(node.title)
  const modeExperience = experienceKeyFromMode(mode)

  if (titleExperience === 'relax') return 'recovery'
  if (titleExperience === 'focus') return 'focus'
  if (titleExperience === 'creative') return 'creative'
  if (titleExperience === 'sleep') return 'sleep'

  if (modeExperience === 'relax') return 'recovery'
  if (modeExperience === 'creative') return 'creative'
  if (modeExperience === 'sleep') return 'sleep'

  return 'focus'
}

function journeyNodeVisual(kind: JourneyNodeKind) {
  if (kind === 'recovery') {
    return {
      roleLabel: t('coreTimer.flow.nodeRoles.recovery'),
      icon: 'pi pi-sparkles',
      accent: '#f59e5b',
      energy: 34,
    }
  }

  if (kind === 'sleep') {
    return {
      roleLabel: t('coreTimer.flow.nodeRoles.sleep'),
      icon: 'pi pi-moon',
      accent: '#a78bfa',
      energy: 20,
    }
  }

  if (kind === 'creative') {
    return {
      roleLabel: t('coreTimer.flow.nodeRoles.creative'),
      icon: 'pi pi-bolt',
      accent: '#f6c763',
      energy: 68,
    }
  }

  return {
    roleLabel: t('coreTimer.flow.nodeRoles.focus'),
    icon: 'pi pi-circle-fill',
    accent: '#6ee7d8',
    energy: 86,
  }
}

function createJourneyNodeView(node: FlowNode, index: number): JourneyNodeView {
  const mode = resolveFlowNodeMode(node, props.modes)
  const kind = journeyKindForNode(node)
  const visual = journeyNodeVisual(kind)
  const accent = visual.accent
  const accentRgb = hexToRgbTriplet(accent)
  const minutes = Math.max(1, Math.round(Number(node.time) || 1))

  return {
    id: node.id,
    title: node.title,
    minutes,
    modeName: translatedModeName(mode, visual.roleLabel),
    kind,
    roleLabel: visual.roleLabel,
    icon: visual.icon,
    energy: visual.energy,
    accent,
    accentRgb,
    style: {
      '--node-accent': accent,
      '--node-rgb': accentRgb,
      '--node-delay': `${Math.min(index * 90, 540)}ms`,
      '--energy-height': `${Math.max(22, visual.energy)}%`,
    },
  }
}

function signatureKindOffset(kind: JourneyNodeKind) {
  if (kind === 'focus') return -6
  if (kind === 'creative') return 11
  if (kind === 'recovery') return 18

  return 32
}

function signatureBreathScale(kind: JourneyNodeKind) {
  if (kind === 'focus') return '1.16'
  if (kind === 'creative') return '1.1'
  if (kind === 'recovery') return '1.07'

  return '1.04'
}

function signatureOrbitSpeed(kind: JourneyNodeKind, totalMinutes: number, minutes: number) {
  const journeyWeight = Math.min(totalMinutes, 180) / 180
  const durationWeight = Math.min(minutes, 90) / 90
  const baseSpeed = {
    focus: 8.2,
    creative: 9.8,
    recovery: 12.8,
    sleep: 17.5,
  }[kind]

  return (baseSpeed + journeyWeight * 3.2 + durationWeight * 2.4).toFixed(1) + 's'
}

function applySignatureNodeStyles(
  nodeViews: JourneyNodeView[],
  totalMinutes: number,
): JourneyNodeView[] {
  const largestDuration = Math.max(...nodeViews.map((node) => node.minutes), 1)
  const signatureTilt = (totalMinutes % 37) - 18

  return nodeViews.map((node, index) => {
    const progress = nodeViews.length <= 1 ? 0 : index / nodeViews.length
    const durationRatio = node.minutes / largestDuration
    const typeRadius =
      node.kind === 'sleep' ? 8 : node.kind === 'recovery' ? 4 : node.kind === 'creative' ? 1 : -2
    const radius = 24 + durationRatio * 13 + typeRadius
    const angle = -90 + progress * 360 + signatureTilt + signatureKindOffset(node.kind)
    const radians = (angle * Math.PI) / 180
    const x = 50 + Math.cos(radians) * radius
    const y = 50 + Math.sin(radians) * (radius * 0.76) + (node.kind === 'sleep' ? 3.5 : 0)
    const size = 0.9 + durationRatio * 1.15 + node.energy / 170
    const glow = 0.26 + node.energy / 210

    return {
      ...node,
      style: {
        ...node.style,
        '--signature-angle': angle + 'deg',
        '--signature-left': Math.min(88, Math.max(12, x)).toFixed(2) + '%',
        '--signature-top': Math.min(84, Math.max(16, y)).toFixed(2) + '%',
        '--signature-radius': radius.toFixed(2) + '%',
        '--signature-size': size.toFixed(2) + 'rem',
        '--signature-glow': glow.toFixed(2),
        '--signature-breath': signatureBreathScale(node.kind),
        '--signature-speed': signatureOrbitSpeed(node.kind, totalMinutes, node.minutes),
        '--signature-delay': Math.min(index * 170, 1200) + 'ms',
        '--particle-left': Math.min(92, Math.max(8, 50 + Math.cos(radians + 0.65) * (radius + 9))).toFixed(2) + '%',
        '--particle-top': Math.min(88, Math.max(12, 50 + Math.sin(radians + 0.65) * (radius * 0.72 + 5))).toFixed(2) + '%',
      },
    }
  })
}

function createEnergyPoints(nodes: JourneyNodeView[]): EnergyPoint[] {
  if (nodes.length === 0) return []

  const firstNode = nodes[0]

  if (nodes.length === 1 && firstNode) return [{ x: 50, y: 100 - firstNode.energy }]

  return nodes.map((node, index) => ({
    x: 8 + (index / Math.max(1, nodes.length - 1)) * 84,
    y: 92 - node.energy * 0.78,
  }))
}

function createEnergyPath(points: EnergyPoint[]) {
  const firstPoint = points[0]

  if (!firstPoint) return ''
  if (points.length === 1) return `M ${firstPoint.x} ${firstPoint.y}`

  return points.slice(1).reduce((path, point, index) => {
    const previous = points[index]

    if (!previous) return path

    const midX = (previous.x + point.x) / 2

    return `${path} C ${midX} ${previous.y}, ${midX} ${point.y}, ${point.x} ${point.y}`
  }, `M ${firstPoint.x} ${firstPoint.y}`)
}

function createEnergyFillPath(points: EnergyPoint[], linePath: string) {
  const first = points[0]
  const last = points.at(-1)

  if (!first || !last || !linePath) return ''

  return `${linePath} L ${last.x} 96 L ${first.x} 96 Z`
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

function cognitiveIntensityLabel(averageEnergy: number, identityKey: FlowExperienceKey) {
  if (identityKey === 'sleep') return t('coreTimer.flow.intensity.low')
  if (averageEnergy >= 74) return t('coreTimer.flow.intensity.high')
  if (averageEnergy >= 48) return t('coreTimer.flow.intensity.moderate')

  return t('coreTimer.flow.intensity.low')
}

function createMetrics(
  nodeViews: JourneyNodeView[],
  totalMinutes: number,
  identityKey: FlowExperienceKey,
): JourneyMetric[] {
  const focusMinutes = nodeViews
    .filter((node) => node.kind === 'focus' || node.kind === 'creative')
    .reduce((total, node) => total + node.minutes, 0)
  const recoveryMoments = nodeViews.filter((node) => node.kind === 'recovery').length
  const focusCycles = nodeViews.filter(
    (node) => node.kind === 'focus' || node.kind === 'creative',
  ).length
  const focusRatio = totalMinutes > 0 ? Math.round((focusMinutes / totalMinutes) * 100) : 0
  const averageEnergy =
    nodeViews.length > 0
      ? nodeViews.reduce((total, node) => total + node.energy, 0) / nodeViews.length
      : 0

  return [
    {
      label: t('coreTimer.flow.metrics.focusCycles'),
      value: String(focusCycles),
    },
    {
      label: t('coreTimer.flow.metrics.recoveryMoments'),
      value: String(recoveryMoments),
    },
    {
      label: t('coreTimer.flow.metrics.totalDuration'),
      value: formatJourneyDuration(totalMinutes),
    },
    {
      label: t('coreTimer.flow.metrics.focusRatio'),
      value: `${focusRatio}%`,
    },
    {
      label: t('coreTimer.flow.metrics.cognitiveIntensity'),
      value: cognitiveIntensityLabel(averageEnergy, identityKey),
    },
  ]
}

function createJourneyNarrative(
  identityKey: FlowExperienceKey,
  nodeViews: JourneyNodeView[],
  totalMinutes: number,
) {
  const focusCycles = nodeViews.filter(
    (node) => node.kind === 'focus' || node.kind === 'creative',
  ).length
  const recoveryMoments = nodeViews.filter((node) => node.kind === 'recovery').length

  if (identityKey === 'sleep') return t('coreTimer.flow.narratives.sleep')
  if (identityKey === 'relax') return t('coreTimer.flow.narratives.relax')
  if (identityKey === 'creative') return t('coreTimer.flow.narratives.creative')

  return t('coreTimer.flow.narratives.focus', {
    cycles: focusCycles,
    recoveries: recoveryMoments,
    duration: formatJourneyDuration(totalMinutes),
  })
}

function isLanguageFlow(flow: Flow) {
  return /\b(japanese|japan|language|languages|vocab|listening|idioma|idiomas|japones|nihongo)\b/i.test(
    normalizedText(flow.name),
  )
}

function createForecastOutcomes(flow: Flow, identityKey: FlowExperienceKey) {
  const outcomeKey = identityKey === 'focus' && isLanguageFlow(flow) ? 'language' : identityKey

  return [0, 1, 2, 3].map((index) => t(`coreTimer.flow.forecasts.${outcomeKey}.${index}`))
}

function createCtaLabel(identityKey: FlowExperienceKey) {
  return t(`coreTimer.flow.cta.${identityKey}`)
}

function createFlowPickerSummary(flow: Flow, nodes: FlowNode[]): FlowPickerSummary {
  const sortedNodes = sortFlowNodes(nodes)
  const dominantMode = dominantFlowMode(sortedNodes)
  const identity = flowVisualIdentity(flow, dominantMode)
  const sectionCount = sortedNodes.length
  const totalMinutes = sortedNodes.reduce(
    (total, node) => total + Math.max(1, Math.round(Number(node.time) || 1)),
    0,
  )
  const nodeViews = applySignatureNodeStyles(sortedNodes.map(createJourneyNodeView), totalMinutes)
  const energyPoints = createEnergyPoints(nodeViews)
  const energyPath = createEnergyPath(energyPoints)

  return {
    flow,
    nodes: sortedNodes,
    totalMinutes,
    sectionCount,
    dominantMode,
    identity,
    description: t('coreTimer.flow.descriptions.' + identity.key),
    nodeViews,
    signatureNodes: nodeViews.slice(0, 7),
    metrics: createMetrics(nodeViews, totalMinutes, identity.key),
    narrative: createJourneyNarrative(identity.key, nodeViews, totalMinutes),
    outcomes: createForecastOutcomes(flow, identity.key),
    ctaLabel: createCtaLabel(identity.key),
    energyPath,
    energyFillPath: createEnergyFillPath(energyPoints, energyPath),
    energyPoints,
  }
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
        <div class="core-flow-picker-header-actions">
          <button v-if="selectedFlowId" type="button" class="core-picker-reset" @click="clearFlow">
            <i class="pi pi-times" aria-hidden="true" />
            <span>{{ t('coreTimer.flow.returnDefault') }}</span>
          </button>
          <button
            type="button"
            class="core-flow-picker-close"
            :aria-label="t('auth.actions.cancel')"
            @click="close"
          >
            <i class="pi pi-times" aria-hidden="true" />
          </button>
        </div>
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
        <TransitionGroup name="core-journey-list" tag="div" class="core-flow-card-grid">
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
            :aria-pressed="summary.flow.id === previewFlowId"
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
            <span class="core-card-energy" aria-hidden="true">
              <span
                v-for="node in summary.signatureNodes"
                :key="node.id"
                :class="'core-card-energy-bar--' + node.kind"
                :style="node.style"
              />
            </span>
            <span class="core-journey-meta">
              <span>{{ t('coreTimer.flow.sectionCount', { count: summary.sectionCount }) }}</span>
              <span class="core-journey-duration">{{
                formatJourneyDuration(summary.totalMinutes)
              }}</span>
              <span>{{ summary.identity.label }}</span>
            </span>
            <span v-if="isFlowSummaryLoading(summary.flow.id)" class="core-journey-loading">
              <i class="pi pi-spin pi-spinner" aria-hidden="true" />
            </span>
          </button>
        </TransitionGroup>

        <Transition name="core-preview-swap" mode="out-in">
          <aside
            v-if="selectedFlowPickerSummary"
            :key="selectedFlowPickerSummary.flow.id"
            class="core-flow-preview"
            :class="'core-flow-preview--' + selectedFlowPickerSummary.identity.key"
            :style="flowPickerCardStyle(selectedFlowPickerSummary)"
            :aria-label="t('coreTimer.flow.previewTimeline')"
          >
            <div class="core-flow-preview-ambient" aria-hidden="true" />

            <div class="core-flow-preview-heading">
              <span>{{ selectedFlowPickerSummary.identity.label }}</span>
              <h3>
                {{
                  t('coreTimer.flow.nextJourney', {
                    duration: formatJourneyDuration(selectedFlowPickerSummary.totalMinutes),
                  })
                }}
              </h3>
              <p>{{ selectedFlowPickerSummary.narrative }}</p>
            </div>

            <div class="core-journey-visualization">
              <section class="core-journey-map" :aria-label="t('coreTimer.flow.journeyMap')">
                <div class="core-section-heading">
                  <p>{{ t('coreTimer.flow.journeyMap') }}</p>
                  <strong>{{ selectedFlowPickerSummary.flow.name }}</strong>
                </div>

                <ol v-if="selectedFlowPickerSummary.nodeViews.length > 0" class="core-map-path">
                  <li class="core-map-terminal core-map-terminal--start">
                    <span aria-hidden="true" />
                    <strong>{{ t('coreTimer.flow.startPoint') }}</strong>
                  </li>
                  <li
                    v-for="node in selectedFlowPickerSummary.nodeViews"
                    :key="node.id"
                    class="core-map-node"
                    :class="'core-map-node--' + node.kind"
                    :style="node.style"
                  >
                    <span class="core-node-marker" aria-hidden="true">
                      <i :class="node.icon" aria-hidden="true" />
                    </span>
                    <span class="core-node-copy">
                      <small>{{ node.roleLabel }}</small>
                      <strong>{{ node.title }}</strong>
                    </span>
                    <span class="core-node-duration">{{
                      t('coreTimer.minutes', { count: node.minutes })
                    }}</span>
                  </li>
                  <li class="core-map-terminal core-map-terminal--finish">
                    <span aria-hidden="true" />
                    <strong>{{ t('coreTimer.flow.finishPoint') }}</strong>
                  </li>
                </ol>

                <div v-else class="core-flow-preview-empty">
                  {{ t('coreTimer.flow.emptyTitle') }}
                </div>
              </section>

              <section class="core-energy-panel" :aria-label="t('coreTimer.flow.energySignature')">
                <div class="core-section-heading">
                  <p>{{ t('coreTimer.flow.energySignature') }}</p>
                  <strong>{{ t('coreTimer.flow.howItFeels') }}</strong>
                </div>
                <div class="core-cognitive-signature">
                  <span class="core-signature-aurora" aria-hidden="true" />
                  <span class="core-signature-ring core-signature-ring--outer" aria-hidden="true" />
                  <span class="core-signature-ring core-signature-ring--inner" aria-hidden="true" />
                  <span
                    v-for="node in selectedFlowPickerSummary.nodeViews"
                    :key="'link-' + node.id"
                    class="core-signature-link"
                    :class="'core-signature-link--' + node.kind"
                    :style="node.style"
                    aria-hidden="true"
                  />
                  <span
                    v-for="node in selectedFlowPickerSummary.nodeViews"
                    :key="'particle-' + node.id"
                    class="core-signature-particle"
                    :class="'core-signature-particle--' + node.kind"
                    :style="node.style"
                    aria-hidden="true"
                  />
                  <span class="core-signature-core" aria-hidden="true">
                    <span />
                  </span>
                  <button
                    v-for="node in selectedFlowPickerSummary.nodeViews"
                    :key="'signature-' + node.id"
                    type="button"
                    class="core-signature-node"
                    :class="'core-signature-node--' + node.kind"
                    :style="node.style"
                    :aria-label="node.title"
                  >
                    <span class="core-signature-node-orb" aria-hidden="true" />
                    <span class="core-signature-tooltip">
                      <strong>{{ node.title }}</strong>
                      <small>{{ node.modeName }} / {{ t("coreTimer.minutes", { count: node.minutes }) }}</small>
                    </span>
                  </button>
                </div>
              </section>
            </div>

            <section class="core-flow-metrics" :aria-label="t('coreTimer.flow.metricsLabel')">
              <div
                v-for="metric in selectedFlowPickerSummary.metrics"
                :key="metric.label"
                class="core-flow-metric"
              >
                <small>{{ metric.label }}</small>
                <strong>{{ metric.value }}</strong>
              </div>
            </section>

            <section class="core-forecast" :aria-label="t('coreTimer.flow.expectedOutcome')">
              <div class="core-section-heading">
                <p>{{ t('coreTimer.flow.expectedOutcome') }}</p>
                <strong>{{ t('coreTimer.flow.forecastTitle') }}</strong>
              </div>
              <ul>
                <li v-for="outcome in selectedFlowPickerSummary.outcomes" :key="outcome">
                  <i class="pi pi-check" aria-hidden="true" />
                  <span>{{ outcome }}</span>
                </li>
              </ul>
            </section>

            <div class="core-flow-picker-actions">
              <Button
                type="button"
                icon="pi pi-arrow-right"
                icon-pos="right"
                :label="selectedFlowPickerSummary.ctaLabel"
                class="core-start-journey"
                :disabled="isLoadingSelectedFlow || selectedFlowPickerSummary.sectionCount === 0"
                @click="startJourney"
              />
            </div>
          </aside>
        </Transition>
      </div>
    </section>
  </Dialog>
</template>

<style scoped>
:global(.core-flow-picker-dialog) {
  width: min(92rem, calc(100vw - 1.5rem));
  overflow: hidden;
  border: 1px solid rgba(110, 231, 216, 0.22);
  border-radius: 18px;
  background:
    linear-gradient(145deg, rgba(110, 231, 216, 0.12), transparent 40%), rgba(5, 9, 11, 0.96) !important;
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
  max-height: min(50rem, calc(100vh - 2rem));
  overflow: auto;
  padding: 1rem;
  scrollbar-color: rgba(110, 231, 216, 0.42) transparent;
}

.core-flow-picker::before {
  position: absolute;
  inset: -30% -20% auto;
  height: 22rem;
  background:
    radial-gradient(circle, rgba(110, 231, 216, 0.16), transparent 62%),
    radial-gradient(circle at 80% 20%, rgba(183, 140, 255, 0.13), transparent 42%);
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
.core-section-heading p {
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
  font-size: clamp(1.8rem, 4vw, 3.35rem);
  font-weight: 760;
  letter-spacing: 0;
  line-height: 0.98;
}

.core-flow-picker-header-actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 0.55rem;
}

.core-picker-reset {
  display: inline-flex;
  min-height: 2.35rem;
  align-items: center;
  gap: 0.45rem;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.045);
  color: rgba(255, 255, 255, 0.72);
  font-size: 0.82rem;
  font-weight: 700;
  padding: 0 0.85rem;
  transition:
    border-color 180ms ease,
    background 180ms ease,
    color 180ms ease,
    transform 180ms ease;
}

.core-picker-reset:hover {
  border-color: rgba(110, 231, 216, 0.34);
  background: rgba(110, 231, 216, 0.08);
  color: #d9fff8;
  transform: translateY(-1px);
}

.core-picker-reset i {
  font-size: 0.75rem;
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
  transition:
    border-color 180ms ease,
    background 180ms ease,
    color 180ms ease;
}

.core-flow-picker-close:hover {
  border-color: rgba(255, 255, 255, 0.24);
  background: rgba(255, 255, 255, 0.12);
  color: #ffffff;
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
  min-height: 12.5rem;
  overflow: hidden;
  border: 1px solid rgba(var(--flow-card-rgb), 0.24);
  border-radius: 8px;
  background:
    radial-gradient(circle at 84% 18%, rgba(var(--flow-card-rgb), 0.26), transparent 30%),
    linear-gradient(145deg, rgba(var(--flow-card-rgb), 0.13), rgba(255, 255, 255, 0.045)),
    rgba(5, 10, 12, 0.82);
  color: #ffffff;
  padding: 1rem;
  text-align: left;
  box-shadow: 0 1rem 3rem rgba(0, 0, 0, 0.22);
  transition:
    border-color 360ms cubic-bezier(0.22, 1, 0.36, 1),
    box-shadow 360ms cubic-bezier(0.22, 1, 0.36, 1),
    transform 360ms cubic-bezier(0.22, 1, 0.36, 1),
    min-height 420ms cubic-bezier(0.22, 1, 0.36, 1),
    background 420ms cubic-bezier(0.22, 1, 0.36, 1);
}

.core-journey-card:hover,
.core-journey-card--selected {
  border-color: rgba(var(--flow-card-rgb), 0.58);
  box-shadow:
    0 1.6rem 4.5rem rgba(0, 0, 0, 0.34),
    0 0 2.5rem rgba(var(--flow-card-rgb), 0.18);
  transform: translateY(-2px) scale(1.012);
}

.core-journey-card:focus-visible {
  outline: 2px solid rgba(var(--flow-card-rgb), 0.88);
  outline-offset: 3px;
}

.core-journey-card--selected {
  min-height: 14.75rem;
}

.core-journey-list-move,
.core-journey-list-enter-active,
.core-journey-list-leave-active {
  transition: all 420ms cubic-bezier(0.22, 1, 0.36, 1);
}

.core-journey-list-enter-from,
.core-journey-list-leave-to {
  opacity: 0;
  transform: translateY(0.75rem) scale(0.98);
}

.core-journey-list-leave-active {
  position: absolute;
  width: 100%;
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

.core-journey-card--sleep .core-journey-visual span {
  animation-duration: 6.2s;
}

.core-journey-copy,
.core-card-energy,
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

.core-card-energy {
  display: flex;
  height: 2.85rem;
  align-items: end;
  gap: 0.28rem;
  width: min(12rem, 62%);
  margin-top: 1.15rem;
}

.core-card-energy span {
  width: 0.48rem;
  height: var(--energy-height);
  border-radius: 999px;
  background: linear-gradient(to top, rgba(var(--node-rgb), 0.32), var(--node-accent));
  box-shadow: 0 0 0 rgba(var(--node-rgb), 0);
  opacity: 0.68;
  transform-origin: bottom;
  transition:
    box-shadow 260ms ease,
    opacity 260ms ease,
    transform 260ms ease;
}

.core-journey-card:hover .core-card-energy span,
.core-journey-card--selected .core-card-energy span {
  animation: core-card-energy-rise 820ms cubic-bezier(0.22, 1, 0.36, 1) both;
  animation-delay: var(--node-delay);
  box-shadow: 0 0 1rem rgba(var(--node-rgb), 0.28);
  opacity: 1;
}

.core-journey-meta {
  display: flex;
  flex-wrap: wrap;
  align-self: end;
  gap: 0.45rem;
  margin-top: 1.5rem;
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

.core-journey-duration {
  transition:
    color 220ms ease,
    transform 220ms ease,
    background 220ms ease;
}

.core-journey-card:hover .core-journey-duration,
.core-journey-card--selected .core-journey-duration {
  background: rgba(var(--flow-card-rgb), 0.2);
  color: #ffffff;
  transform: translateY(-1px) scale(1.04);
}

.core-journey-loading {
  position: absolute;
  top: 0.85rem;
  right: 0.85rem;
  color: var(--flow-card-accent);
}

.core-flow-preview {
  position: relative;
  display: grid;
  align-content: start;
  gap: 1rem;
  min-height: 100%;
  overflow: hidden;
  border: 1px solid rgba(var(--flow-card-rgb), 0.24);
  border-radius: 8px;
  background:
    radial-gradient(circle at 16% 12%, rgba(var(--flow-card-rgb), 0.2), transparent 28%),
    linear-gradient(145deg, rgba(var(--flow-card-rgb), 0.1), rgba(8, 12, 16, 0.7)),
    rgba(5, 9, 12, 0.88);
  padding: 1rem;
  animation: core-preview-reveal 720ms cubic-bezier(0.22, 1, 0.36, 1) both;
}

.core-flow-preview-ambient {
  position: absolute;
  inset: 0;
  opacity: 0.72;
  pointer-events: none;
}

.core-flow-preview-ambient::before,
.core-flow-preview-ambient::after {
  position: absolute;
  inset: -20%;
  content: '';
}

.core-flow-preview--focus .core-flow-preview-ambient::before {
  background-image:
    radial-gradient(circle, rgba(var(--flow-card-rgb), 0.34) 0 1px, transparent 1px),
    radial-gradient(circle, rgba(255, 255, 255, 0.18) 0 1px, transparent 1px);
  background-position:
    0 0,
    2rem 1.5rem;
  background-size:
    4.5rem 4.5rem,
    6rem 6rem;
  animation: core-particle-drift 14s linear infinite;
}

.core-flow-preview--relax .core-flow-preview-ambient::before,
.core-flow-preview--creative .core-flow-preview-ambient::before {
  background:
    radial-gradient(circle at 18% 24%, rgba(183, 140, 255, 0.24), transparent 24rem),
    radial-gradient(circle at 84% 70%, rgba(var(--flow-card-rgb), 0.2), transparent 22rem);
  filter: blur(16px);
  animation: core-fog-breathe 5.8s ease-in-out infinite;
}

.core-flow-preview--sleep .core-flow-preview-ambient::before {
  background:
    repeating-linear-gradient(
      165deg,
      rgba(120, 167, 255, 0.02) 0,
      rgba(120, 167, 255, 0.1) 1px,
      transparent 2px,
      transparent 1.8rem
    ),
    radial-gradient(circle at 50% 100%, rgba(120, 167, 255, 0.2), transparent 34rem);
  animation: core-sleep-waves 8s ease-in-out infinite;
}

.core-flow-preview > *:not(.core-flow-preview-ambient) {
  position: relative;
  z-index: 1;
}

.core-preview-swap-enter-active,
.core-preview-swap-leave-active {
  transition:
    opacity 260ms ease,
    transform 320ms cubic-bezier(0.22, 1, 0.36, 1);
}

.core-preview-swap-enter-from {
  opacity: 0;
  transform: translateY(0.65rem) scale(0.985);
}

.core-preview-swap-leave-to {
  opacity: 0;
  transform: translateY(-0.35rem) scale(0.99);
}

.core-flow-preview-heading {
  padding: 0.35rem 0.15rem 0.2rem;
}

.core-flow-preview-heading span {
  color: var(--flow-card-accent);
  font-size: 0.72rem;
  font-weight: 820;
  text-transform: uppercase;
}

.core-flow-preview-heading h3 {
  max-width: 34rem;
  margin: 0.35rem 0 0;
  color: #ffffff;
  font-size: clamp(1.65rem, 4vw, 3.1rem);
  font-weight: 780;
  line-height: 0.98;
  overflow-wrap: anywhere;
}

.core-flow-preview-heading p {
  max-width: 42rem;
  margin: 0.75rem 0 0;
  color: rgba(255, 255, 255, 0.68);
  font-size: 0.98rem;
  line-height: 1.55;
}

.core-journey-visualization {
  display: grid;
  gap: 0.85rem;
}

.core-journey-map,
.core-energy-panel,
.core-forecast {
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.045);
  padding: 0.95rem;
}

.core-section-heading {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 1rem;
}

.core-section-heading strong {
  min-width: 0;
  color: #ffffff;
  font-size: 0.9rem;
  font-weight: 760;
  line-height: 1.2;
  overflow-wrap: anywhere;
  text-align: right;
}

.core-map-path {
  position: relative;
  display: grid;
  gap: 0.4rem;
  margin: 1rem 0 0;
  padding: 0;
  list-style: none;
}

.core-map-path::before {
  position: absolute;
  top: 1.05rem;
  bottom: 1.05rem;
  left: 1.05rem;
  width: 2px;
  background: linear-gradient(
    to bottom,
    transparent,
    rgba(var(--flow-card-rgb), 0.88),
    rgba(183, 140, 255, 0.5),
    transparent
  );
  box-shadow: 0 0 1.25rem rgba(var(--flow-card-rgb), 0.4);
  content: '';
  transform-origin: top;
  animation: core-path-draw 660ms cubic-bezier(0.22, 1, 0.36, 1) both;
}

.core-map-terminal,
.core-map-node {
  position: relative;
  display: grid;
  grid-template-columns: 2.15rem minmax(0, 1fr) auto;
  gap: 0.5rem 0.75rem;
  align-items: center;
}

.core-map-terminal {
  min-height: 2.15rem;
  color: rgba(255, 255, 255, 0.74);
  font-size: 0.76rem;
  font-weight: 780;
  text-transform: uppercase;
}

.core-map-terminal span {
  display: block;
  width: 0.8rem;
  height: 0.8rem;
  justify-self: center;
  border-radius: 999px;
  background: #ffffff;
  box-shadow:
    0 0 0 0.32rem rgba(255, 255, 255, 0.08),
    0 0 1.1rem rgba(255, 255, 255, 0.5);
}

.core-map-node {
  min-height: 4.4rem;
  border: 1px solid rgba(var(--node-rgb), 0.2);
  border-radius: 8px;
  background:
    linear-gradient(90deg, rgba(var(--node-rgb), 0.12), rgba(255, 255, 255, 0.025)),
    rgba(3, 7, 10, 0.36);
  padding: 0.65rem 0.7rem 0.65rem 0;
  animation: core-node-reveal 520ms cubic-bezier(0.22, 1, 0.36, 1) both;
  animation-delay: var(--node-delay);
}

.core-node-marker {
  display: grid;
  width: 2.15rem;
  height: 2.15rem;
  place-items: center;
}

.core-node-marker i {
  display: grid;
  width: 1.75rem;
  height: 1.75rem;
  place-items: center;
  border: 1px solid rgba(var(--node-rgb), 0.42);
  border-radius: 999px;
  background: rgba(var(--node-rgb), 0.16);
  color: var(--node-accent);
  font-size: 0.68rem;
  box-shadow:
    0 0 0.85rem rgba(var(--node-rgb), 0.24),
    inset 0 0 0.8rem rgba(var(--node-rgb), 0.12);
  animation: core-node-pulse 3.8s ease-in-out infinite;
}

.core-map-node--recovery .core-node-marker i {
  animation-duration: 5.2s;
}

.core-map-node--sleep .core-node-marker i {
  animation: core-node-wave 6.4s ease-in-out infinite;
}

.core-node-copy {
  min-width: 0;
}

.core-node-copy small {
  display: block;
  color: rgba(255, 255, 255, 0.52);
  font-size: 0.68rem;
  font-weight: 780;
  text-transform: uppercase;
}

.core-node-copy strong {
  display: block;
  margin-top: 0.16rem;
  color: #ffffff;
  font-size: 0.92rem;
  font-weight: 760;
  line-height: 1.18;
  overflow-wrap: anywhere;
}

.core-node-duration {
  border: 1px solid rgba(var(--node-rgb), 0.24);
  border-radius: 999px;
  background: rgba(var(--node-rgb), 0.1);
  color: rgba(255, 255, 255, 0.74);
  font-size: 0.74rem;
  font-weight: 780;
  padding: 0.38rem 0.54rem;
  white-space: nowrap;
}

.core-energy-panel {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  gap: 0.9rem;
}

.core-cognitive-signature {
  position: relative;
  min-height: clamp(18rem, 42vw, 30rem);
  overflow: hidden;
  border-radius: 8px;
  background:
    radial-gradient(circle at 50% 50%, rgba(var(--flow-card-rgb), 0.2), transparent 7rem),
    radial-gradient(circle at 28% 24%, rgba(183, 140, 255, 0.14), transparent 11rem),
    radial-gradient(circle at 74% 72%, rgba(120, 167, 255, 0.13), transparent 12rem),
    linear-gradient(145deg, rgba(255, 255, 255, 0.055), rgba(255, 255, 255, 0.018)),
    rgba(0, 0, 0, 0.18);
  isolation: isolate;
}

.core-cognitive-signature::before,
.core-cognitive-signature::after {
  position: absolute;
  inset: 12%;
  border-radius: 48% 52% 44% 56%;
  content: "";
  pointer-events: none;
}

.core-cognitive-signature::before {
  border: 1px solid rgba(var(--flow-card-rgb), 0.14);
  filter: drop-shadow(0 0 1.6rem rgba(var(--flow-card-rgb), 0.16));
  animation: core-signature-breathe 8s ease-in-out infinite;
}

.core-cognitive-signature::after {
  inset: 23%;
  border: 1px solid rgba(255, 255, 255, 0.06);
  transform: rotate(28deg);
  animation: core-signature-drift 18s linear infinite;
}

.core-signature-aurora {
  position: absolute;
  inset: -18%;
  background:
    conic-gradient(
      from 124deg,
      transparent,
      rgba(var(--flow-card-rgb), 0.16),
      rgba(183, 140, 255, 0.1),
      rgba(120, 167, 255, 0.12),
      transparent
    );
  filter: blur(2.1rem);
  opacity: 0.7;
  animation: core-signature-drift 28s linear infinite reverse;
}

.core-signature-ring {
  position: absolute;
  left: 50%;
  top: 50%;
  border: 1px solid rgba(var(--flow-card-rgb), 0.16);
  border-radius: 999px;
  pointer-events: none;
  transform: translate(-50%, -50%) rotate(-12deg);
}

.core-signature-ring--outer {
  width: 68%;
  height: 48%;
  box-shadow: 0 0 2.6rem rgba(var(--flow-card-rgb), 0.1);
}

.core-signature-ring--inner {
  width: 42%;
  height: 29%;
  border-color: rgba(255, 255, 255, 0.07);
  transform: translate(-50%, -50%) rotate(24deg);
}

.core-signature-link {
  position: absolute;
  left: 50%;
  top: 50%;
  width: var(--signature-radius);
  height: 1px;
  background: linear-gradient(90deg, rgba(var(--node-rgb), 0), rgba(var(--node-rgb), 0.5), rgba(var(--node-rgb), 0));
  box-shadow: 0 0 0.9rem rgba(var(--node-rgb), 0.28);
  opacity: 0.52;
  transform: rotate(var(--signature-angle)) scaleX(0);
  transform-origin: left center;
  animation: core-signature-link 860ms cubic-bezier(0.22, 1, 0.36, 1) both;
  animation-delay: var(--signature-delay);
}

.core-signature-particle {
  position: absolute;
  left: var(--particle-left);
  top: var(--particle-top);
  width: 0.28rem;
  height: 0.28rem;
  border-radius: 999px;
  background: var(--node-accent);
  box-shadow: 0 0 1rem rgba(var(--node-rgb), 0.72);
  opacity: 0.72;
  transform: translate(-50%, -50%);
  animation: core-signature-particle var(--signature-speed) ease-in-out infinite;
  animation-delay: var(--signature-delay);
}

.core-signature-core {
  position: absolute;
  left: 50%;
  top: 50%;
  display: grid;
  width: clamp(3.8rem, 10vw, 5.8rem);
  aspect-ratio: 1;
  place-items: center;
  border-radius: 999px;
  background:
    radial-gradient(circle, rgba(255, 255, 255, 0.92) 0 9%, rgba(var(--flow-card-rgb), 0.9) 10% 32%, rgba(var(--flow-card-rgb), 0.18) 33% 66%, transparent 68%),
    rgba(var(--flow-card-rgb), 0.06);
  box-shadow:
    0 0 2.5rem rgba(var(--flow-card-rgb), 0.5),
    0 0 5rem rgba(var(--flow-card-rgb), 0.18);
  transform: translate(-50%, -50%);
  animation: core-signature-core 5.8s ease-in-out infinite;
}

.core-signature-core span {
  width: 36%;
  aspect-ratio: 1;
  border-radius: inherit;
  background: #ffffff;
  box-shadow: 0 0 1.4rem rgba(255, 255, 255, 0.72);
}

.core-signature-node {
  position: absolute;
  left: var(--signature-left);
  top: var(--signature-top);
  display: grid;
  width: max(2.45rem, var(--signature-size));
  aspect-ratio: 1;
  place-items: center;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: #ffffff;
  padding: 0;
  transform: translate(-50%, -50%);
  animation: core-signature-float var(--signature-speed) ease-in-out infinite;
  animation-delay: var(--signature-delay);
  z-index: 2;
}

.core-signature-node:focus-visible {
  outline: 2px solid rgba(var(--node-rgb), 0.9);
  outline-offset: 0.35rem;
}

.core-signature-node-orb {
  width: 74%;
  aspect-ratio: 1;
  border: 1px solid rgba(255, 255, 255, 0.34);
  border-radius: inherit;
  background:
    radial-gradient(circle at 36% 30%, rgba(255, 255, 255, 0.95), rgba(255, 255, 255, 0.18) 16%, transparent 28%),
    radial-gradient(circle, var(--node-accent), rgba(var(--node-rgb), 0.28) 58%, transparent 70%);
  box-shadow:
    0 0 calc(1.6rem * var(--signature-glow)) rgba(var(--node-rgb), 0.88),
    0 0 calc(4.4rem * var(--signature-glow)) rgba(var(--node-rgb), 0.28),
    inset 0 0 1rem rgba(255, 255, 255, 0.15);
  animation: core-signature-orb 4.8s ease-in-out infinite;
}

.core-signature-node--focus .core-signature-node-orb {
  animation-duration: 2.8s;
}

.core-signature-node--recovery .core-signature-node-orb {
  animation-duration: 5.6s;
}

.core-signature-node--sleep .core-signature-node-orb {
  animation-duration: 7.8s;
}

.core-signature-tooltip {
  position: absolute;
  left: 50%;
  bottom: calc(100% + 0.65rem);
  min-width: min(12rem, 64vw);
  border: 1px solid rgba(var(--node-rgb), 0.24);
  border-radius: 8px;
  background: rgba(5, 9, 12, 0.86);
  box-shadow:
    0 1rem 2.5rem rgba(0, 0, 0, 0.32),
    0 0 1.8rem rgba(var(--node-rgb), 0.18);
  opacity: 0;
  padding: 0.58rem 0.68rem;
  pointer-events: none;
  text-align: left;
  transform: translate(-50%, 0.35rem) scale(0.96);
  transition:
    opacity 180ms ease,
    transform 180ms ease;
}

.core-signature-tooltip strong,
.core-signature-tooltip small {
  display: block;
  min-width: 0;
  overflow-wrap: anywhere;
}

.core-signature-tooltip strong {
  color: #ffffff;
  font-size: 0.82rem;
  font-weight: 780;
  line-height: 1.12;
}

.core-signature-tooltip small {
  margin-top: 0.22rem;
  color: rgba(255, 255, 255, 0.62);
  font-size: 0.68rem;
  font-weight: 720;
}

.core-signature-node:hover .core-signature-tooltip,
.core-signature-node:focus-visible .core-signature-tooltip {
  opacity: 1;
  transform: translate(-50%, 0) scale(1);
}


.core-flow-metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.65rem;
}

.core-flow-metric {
  min-height: 4.8rem;
  border: 1px solid rgba(var(--flow-card-rgb), 0.2);
  border-radius: 8px;
  background:
    linear-gradient(135deg, rgba(var(--flow-card-rgb), 0.1), rgba(255, 255, 255, 0.03)),
    rgba(255, 255, 255, 0.035);
  padding: 0.75rem;
  animation: core-node-reveal 520ms cubic-bezier(0.22, 1, 0.36, 1) both;
}

.core-flow-metric small,
.core-flow-metric strong {
  display: block;
}

.core-flow-metric small {
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.66rem;
  font-weight: 820;
  line-height: 1.2;
  text-transform: uppercase;
}

.core-flow-metric strong {
  margin-top: 0.34rem;
  color: #ffffff;
  font-size: 1.1rem;
  font-weight: 780;
  line-height: 1.1;
  overflow-wrap: anywhere;
}

.core-flow-metric:nth-child(3) {
  grid-column: span 2;
}

.core-forecast {
  display: grid;
  gap: 0.8rem;
}

.core-forecast ul {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.core-forecast li {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.5rem;
  color: rgba(255, 255, 255, 0.74);
  font-size: 0.84rem;
  font-weight: 680;
  line-height: 1.25;
}

.core-forecast li i {
  flex: 0 0 auto;
  color: var(--flow-card-accent);
  font-size: 0.75rem;
}

.core-forecast li span {
  min-width: 0;
  overflow-wrap: anywhere;
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
  margin-top: 0.1rem;
}

.core-start-journey {
  width: 100%;
  min-height: 3.2rem;
  border-color: transparent !important;
  border-radius: 8px !important;
  background: linear-gradient(
    90deg,
    var(--flow-card-accent),
    color-mix(in srgb, var(--flow-card-accent), #ffffff 22%)
  ) !important;
  color: var(--flow-card-ink) !important;
  font-weight: 860 !important;
  box-shadow:
    0 0 1.6rem rgba(var(--flow-card-rgb), 0.24),
    inset 0 1px 0 rgba(255, 255, 255, 0.32);
  transition:
    filter 180ms ease,
    transform 180ms ease,
    box-shadow 180ms ease;
}

.core-start-journey:hover {
  filter: saturate(1.08) brightness(1.04);
  transform: translateY(-1px);
  box-shadow:
    0 0 2.25rem rgba(var(--flow-card-rgb), 0.34),
    inset 0 1px 0 rgba(255, 255, 255, 0.36);
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

@keyframes core-card-energy-rise {
  from {
    transform: scaleY(0.55);
  }

  to {
    transform: scaleY(1);
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
    transform: translateY(0.45rem) scale(0.988);
  }

  to {
    opacity: 1;
    transform: none;
  }
}

@keyframes core-path-draw {
  from {
    opacity: 0.2;
    transform: scaleY(0);
  }

  to {
    opacity: 1;
    transform: scaleY(1);
  }
}

@keyframes core-node-reveal {
  from {
    opacity: 0;
    transform: translateY(0.55rem) scale(0.98);
  }

  to {
    opacity: 1;
    transform: none;
  }
}

@keyframes core-node-pulse {
  0%,
  100% {
    box-shadow:
      0 0 0.85rem rgba(var(--node-rgb), 0.24),
      inset 0 0 0.8rem rgba(var(--node-rgb), 0.12);
    transform: scale(0.97);
  }

  50% {
    box-shadow:
      0 0 1.45rem rgba(var(--node-rgb), 0.42),
      inset 0 0 1rem rgba(var(--node-rgb), 0.18);
    transform: scale(1.04);
  }
}

@keyframes core-node-wave {
  0%,
  100% {
    transform: translateY(0) scale(0.96);
  }

  50% {
    transform: translateY(-0.12rem) scale(1.04);
  }
}

@keyframes core-energy-draw {
  to {
    stroke-dashoffset: 0;
  }
}

@keyframes core-energy-fill {
  to {
    opacity: 1;
  }
}

@keyframes core-particle-drift {
  to {
    background-position:
      4.5rem 9rem,
      -4rem 7rem;
  }
}

@keyframes core-fog-breathe {
  0%,
  100% {
    opacity: 0.48;
    transform: scale(0.98);
  }

  50% {
    opacity: 0.78;
    transform: scale(1.06);
  }
}

@keyframes core-signature-link {
  to {
    transform: rotate(var(--signature-angle)) scaleX(1);
  }
}

@keyframes core-signature-breathe {
  0%,
  100% {
    opacity: 0.46;
    transform: scale(0.96) rotate(-3deg);
  }

  50% {
    opacity: 0.86;
    transform: scale(1.04) rotate(5deg);
  }
}

@keyframes core-signature-drift {
  to {
    transform: rotate(360deg);
  }
}

@keyframes core-signature-core {
  0%,
  100% {
    transform: translate(-50%, -50%) scale(0.96);
  }

  50% {
    transform: translate(-50%, -50%) scale(1.05);
  }
}

@keyframes core-signature-float {
  0%,
  100% {
    transform: translate(-50%, -50%) translateY(0) scale(1);
  }

  50% {
    transform: translate(-50%, -50%) translateY(-0.45rem) scale(var(--signature-breath));
  }
}

@keyframes core-signature-orb {
  0%,
  100% {
    filter: saturate(0.94) brightness(0.96);
    transform: scale(0.92);
  }

  50% {
    filter: saturate(1.18) brightness(1.08);
    transform: scale(1.08);
  }
}

@keyframes core-signature-particle {
  0%,
  100% {
    opacity: 0.2;
    transform: translate(-50%, -50%) scale(0.72);
  }

  50% {
    opacity: 0.86;
    transform: translate(-50%, -50%) scale(1.28);
  }
}

@keyframes core-sleep-waves {
  0%,
  100% {
    opacity: 0.44;
    transform: translateY(0);
  }

  50% {
    opacity: 0.76;
    transform: translateY(-0.5rem);
  }
}

@media (min-width: 760px) {
  .core-journey-visualization {
    grid-template-columns: minmax(0, 1.1fr) minmax(17rem, 0.9fr);
    align-items: stretch;
  }

  .core-flow-metrics {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }

  .core-flow-metric:nth-child(3) {
    grid-column: auto;
  }
}

@media (min-width: 980px) {
  .core-flow-picker {
    padding: 1.25rem;
  }

  .core-flow-picker-body {
    grid-template-columns: minmax(18rem, 0.42fr) minmax(0, 1fr);
    align-items: stretch;
  }

  .core-flow-card-grid {
    grid-template-columns: minmax(0, 1fr);
    align-content: start;
    max-height: calc(100vh - 10rem);
    overflow: auto;
    padding-right: 0.25rem;
    scrollbar-color: rgba(110, 231, 216, 0.34) transparent;
  }

  .core-journey-card--selected {
    grid-column: auto;
  }
}

@media (max-width: 640px) {
  .core-flow-picker {
    max-height: calc(100vh - 1rem);
    padding: 0.8rem;
  }

  .core-flow-picker-header {
    align-items: stretch;
    flex-direction: column;
  }

  .core-flow-picker-header-actions {
    justify-content: space-between;
  }

  .core-picker-reset {
    min-width: 0;
  }

  .core-picker-reset span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .core-cognitive-signature {
    min-height: 19.5rem;
  }

  .core-signature-tooltip {
    min-width: min(10.5rem, 58vw);
  }

  .core-map-terminal,
  .core-map-node {
    grid-template-columns: 2.15rem minmax(0, 1fr);
  }

  .core-node-duration {
    grid-column: 2;
    justify-self: start;
  }

  .core-forecast ul {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (prefers-reduced-motion: reduce) {
  .core-journey-card,
  .core-flow-picker-body,
  .core-flow-preview,
  .core-flow-metric,
  .core-map-node,
  .core-map-path::before,
  .core-card-energy span,
  .core-energy-beacon,
  .core-signature-aurora,
  .core-signature-ring,
  .core-signature-link,
  .core-signature-particle,
  .core-signature-core,
  .core-signature-node,
  .core-signature-node-orb,
  .core-energy-line,
  .core-energy-fill,
  .core-flow-preview-ambient::before {
    animation: none;
    transition: none;
  }

  .core-journey-visual span,
  .core-node-marker i {
    animation: none;
  }
}
</style>
