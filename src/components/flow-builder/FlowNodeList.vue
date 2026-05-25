<script setup lang="ts">
import { DragDropProvider, type DragEndEvent } from '@dnd-kit/vue'
import { isSortableOperation } from '@dnd-kit/vue/sortable'

import FlowNodeCard from '@/components/flow-builder/FlowNodeCard.vue'
import type { Audio } from '@/types/audio'
import type { FlowNode } from '@/types/flow'
import type { Mode } from '@/types/mode'

defineProps<{
  nodes: FlowNode[]
  modes: Mode[]
  alarms: Audio[]
  savingNodeIds: Set<number>
  deletingNodeIds: Set<number>
  recentlySavedNodeIds: Set<number>
  disabled?: boolean
}>()

const emit = defineEmits<{
  update: [
    node: FlowNode,
    patch: Partial<Pick<FlowNode, 'title' | 'mode_id' | 'time' | 'end_audio_id'>>,
  ]
  delete: [node: FlowNode]
  reorder: [fromIndex: number, toIndex: number]
}>()

const onDragEnd = (event: DragEndEvent) => {
  if (event.canceled || !isSortableOperation(event.operation)) return

  const { source } = event.operation

  if (!source || source.initialIndex === source.index) return

  emit('reorder', source.initialIndex, source.index)
}
</script>

<template>
  <DragDropProvider @dragEnd="onDragEnd">
    <div class="flow-node-timeline" role="list" aria-label="Flow sections">
      <FlowNodeCard
        v-for="(node, index) in nodes"
        :key="node.id"
        :node="node"
        :index="index"
        :is-last="index === nodes.length - 1"
        :modes="modes"
        :alarms="alarms"
        :saving="savingNodeIds.has(node.id)"
        :deleting="deletingNodeIds.has(node.id)"
        :saved="recentlySavedNodeIds.has(node.id)"
        :disabled="disabled"
        @update="(node, patch) => emit('update', node, patch)"
        @delete="emit('delete', $event)"
      />
    </div>
  </DragDropProvider>
</template>

<style scoped>
.flow-node-timeline {
  position: relative;
  display: grid;
  gap: 0;
}
</style>
