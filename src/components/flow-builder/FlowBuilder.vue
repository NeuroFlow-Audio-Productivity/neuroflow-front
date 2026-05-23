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
const savingNodeIds = ref(new Set<number>())
const deletingNodeIds = ref(new Set<number>())
const error = ref<string | null>(null)
const successMessage = ref<string | null>(null)

const sortedNodes = computed(() =>
  [...nodes.value].sort((first, second) => first.order - second.order),
)
const availableModes = computed(() => modes.value.filter((mode) => !mode.is_system))
const alarmAudios = computed(() =>
  audios.value.filter(
    (audio) => audio.mode?.is_system === true || audio.mode?.name === 'Session Alarm',
  ),
)
const hasAvailableModes = computed(() => availableModes.value.length > 0)
const hasAlarmAudios = computed(() => alarmAudios.value.length > 0)

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
    mode: mode ?? node.mode,
    end_audio: endAudio,
  }
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
    '.flow-node-card[data-flow-node-id="' + nodeId + '"]',
  )

  element?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  element?.querySelector<HTMLElement>('.p-select')?.focus()
}

const createNode = async () => {
  if (!auth.token || isCreating.value) return

  const mode = availableModes.value[0]
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
    const flowNode = await flowNodeApi.createFlowNode(auth.token, {
      flow_id: props.flow.id,
      mode_id: mode.id,
      end_audio_id: alarm.id,
      order: sortedNodes.value.length + 1,
      time: 25,
    })

    nodes.value = withOrders([...sortedNodes.value, decorateNode(flowNode)])
    await focusNode(flowNode.id)
  } catch (caughtError) {
    setError(caughtError, 'flowResource.builder.errors.create')
  } finally {
    isCreating.value = false
  }
}

const updateNode = async (
  node: FlowNode,
  patch: Partial<Pick<FlowNode, 'mode_id' | 'time' | 'end_audio_id'>>,
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
    <header class="flow-builder-header">
      <div class="min-w-0">
        <p class="flow-builder-eyebrow">{{ t('flowResource.builder.eyebrow') }}</p>
        <h1>{{ flow.name }}</h1>
        <p>{{ t('flowResource.builder.subtitle') }}</p>
      </div>

      <Button
        :label="t('flowResource.builder.addSection')"
        icon="pi pi-plus"
        class="theme-primary-button flow-builder-add"
        :loading="isCreating"
        :disabled="isLoading || !hasAvailableModes || !hasAlarmAudios"
        @click="createNode"
      />
    </header>

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
      <span class="flow-builder-empty-icon" aria-hidden="true">
        <i class="pi pi-list-check" />
      </span>
      <h2>{{ t('flowResource.builder.emptyTitle') }}</h2>
      <p>{{ t('flowResource.builder.emptySubtitle') }}</p>
      <Button
        :label="t('flowResource.builder.addFirstSection')"
        icon="pi pi-plus"
        class="theme-primary-button !justify-center"
        :loading="isCreating"
        :disabled="!hasAvailableModes || !hasAlarmAudios"
        @click="createNode"
      />
    </section>

    <FlowNodeList
      v-else
      class="mt-5"
      :nodes="sortedNodes"
      :modes="availableModes"
      :alarms="alarmAudios"
      :saving-node-ids="savingNodeIds"
      :deleting-node-ids="deletingNodeIds"
      :disabled="isReordering"
      @update="updateNode"
      @delete="deleteNode"
      @reorder="reorderNodes"
    />
  </section>
</template>

<style scoped>
.flow-builder-shell {
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  background:
    radial-gradient(circle at 20% 0%, rgba(var(--mode-glow-rgb), 0.16), transparent 26rem),
    rgba(7, 16, 14, 0.82);
  padding: clamp(1rem, 3vw, 1.35rem);
  box-shadow: 0 24px 90px rgba(0, 0, 0, 0.28);
  backdrop-filter: blur(24px);
}

.flow-builder-header {
  display: flex;
  flex-direction: column;
  gap: 1rem;
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

.flow-builder-header h1 {
  margin: 0.55rem 0 0;
  color: #ffffff;
  font-size: clamp(2rem, 4vw, 3.8rem);
  font-weight: 760;
  letter-spacing: 0;
  line-height: 0.98;
  overflow-wrap: anywhere;
}

.flow-builder-header p:last-child {
  max-width: 42rem;
  margin: 0.85rem 0 0;
  color: rgba(255, 255, 255, 0.66);
  font-size: 1rem;
  line-height: 1.65;
}

.flow-builder-add {
  width: 100%;
  justify-content: center !important;
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

.flow-builder-empty-icon {
  display: grid;
  width: 3rem;
  height: 3rem;
  place-items: center;
  border: 1px solid rgba(var(--mode-glow-rgb), 0.28);
  border-radius: 999px;
  background: rgba(var(--mode-glow-rgb), 0.1);
  color: var(--mode-accent);
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

@media (min-width: 760px) {
  .flow-builder-shell {
    padding: clamp(1.25rem, 3vw, 2rem);
  }

  .flow-builder-header {
    flex-direction: row;
    align-items: flex-start;
    justify-content: space-between;
  }

  .flow-builder-add {
    width: auto;
    min-width: 10.5rem;
  }
}
</style>
