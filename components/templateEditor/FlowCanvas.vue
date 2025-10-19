<template>
  <div class="w-full h-full relative">
    <VueFlow
      v-model:nodes="nodes"
      v-model:edges="edges"
      class="w-full h-full"
      :node-types="nodeTypes"
      @node-click="onNodeClick"
      @edge-click="onEdgeClick"
      :default-zoom="0.85"
      :zoom-on-scroll="true"
      :fit-view-on-init="true"
      :connect-on-click="false"
      :snap-to-grid="true"
      :snap-grid="[15, 15]"
      @connect="onConnect"
      @nodes-initialized="onInit"
      @nodes-change="onNodesChange"
    >
      <Background variant="dots" :gap="15" :size="1" />
      <!-- <MiniMap pannable zoomable class="!bg-transparent" /> -->
      <Controls show-interactive class="!bg-background" />
    </VueFlow>
  </div>
</template>

<script setup lang="ts">
import { VueFlow, useVueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { MiniMap } from '@vue-flow/minimap'
import { computed } from 'vue'
import StartNode from './nodes/StartNode.vue'
import DeadlineNode from './nodes/DeadlineNode.vue'
import type { Connection, Edge, Node } from '@vue-flow/core'
import { useTemplateEditorStore } from '~/stores/templateEditor'

const store = useTemplateEditorStore()
const nodes = computed({ get: () => store.nodes, set: (v) => store.nodes = v as any })
const edges = computed({ get: () => store.edges, set: (v) => store.edges = v as any })

const nodeTypes = { 'start-node': StartNode, 'deadline-node': DeadlineNode }

function onNodeClick(e: any) {
  store.selectNode(e.node?.id || null)
}

function onEdgeClick(e: any) {
  // Could open offset editor later
}

function onConnect(params: Connection) {
  const exists = edges.value.some(ed => ed.source === params.source && ed.target === params.target)
  if (!exists && params.source && params.target) {
    edges.value.push({ id: `${params.source}_${params.target}`, source: params.source, target: params.target, label: '+1d', type: 'smoothstep' } as Edge)
  }
}

function onNodesChange() {
  // position changes are kept automatically by vue-flow binding
}

function onInit() {
  // Fit view after init
}

// Keyboard shortcuts
function onKeydown(ev: KeyboardEvent) {
  if (ev.ctrlKey && (ev.key === 's' || ev.key === 'S')) { ev.preventDefault(); store.saveLocal() }
  if (ev.key === 'Delete' && store.selectedNodeId) { store.deleteDeadline(store.selectedNodeId) }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>
