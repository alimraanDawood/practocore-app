<script lang="ts" setup>
import { VueFlow, useVueFlow, MarkerType, type Node, type Edge } from '@vue-flow/core';
import { Background } from '@vue-flow/background';
import { Controls } from '@vue-flow/controls';
import type { EditorStep } from '~/services/workflows/authoring';
import { stepIssue } from '~/services/workflows/authoring';

// Vue Flow canvas that renders the workflow's flat step list as a vertical node
// chain: a trigger node, then one node per step, connected top-to-bottom. The
// engine has no edges/nodes of its own (branching = per-step `when` guards), so
// this is a faithful *view* of the ordered list, not a separate graph model —
// the workflows-v2 decision (graph-as-view over the flat engine). Selection +
// add are emitted up to the editor, which owns the steps array.
const props = defineProps<{
  steps: EditorStep[];
  triggerLabel: string;
  // '' = nothing selected, 'trigger' = the trigger node, else an EditorStep._uid.
  selectedId: string;
}>();
const emit = defineEmits<{
  (e: 'select', id: string): void;
  // Insert a new step after this step index; -1 means "at the start" (after the trigger).
  (e: 'add', afterIndex: number): void;
}>();

// One Vue Flow instance, keyed so multiple canvases never share a store.
const flowId = `wf-canvas-${Math.random().toString(36).slice(2, 8)}`;
const { setNodes, setEdges, onNodeClick, fitView } = useVueFlow(flowId);

const GAP_Y = 150;

function buildNodes(): Node[] {
  const nodes: Node[] = [{
    id: 'trigger',
    type: 'trigger',
    position: { x: 0, y: 0 },
    draggable: false,
    selectable: false,
    data: {
      label: props.triggerLabel,
      selected: props.selectedId === 'trigger',
      onAdd: () => emit('add', -1),
    },
  }];
  props.steps.forEach((s, i) => {
    nodes.push({
      id: s._uid,
      type: 'step',
      position: { x: 0, y: (i + 1) * GAP_Y },
      draggable: false,
      data: {
        step: s,
        index: i,
        issue: stepIssue(s, props.steps),
        selected: props.selectedId === s._uid,
        onAdd: (idx: number) => emit('add', idx),
      },
    });
  });
  return nodes;
}

function buildEdges(): Edge[] {
  const ids = ['trigger', ...props.steps.map((s) => s._uid)];
  const edges: Edge[] = [];
  for (let i = 0; i < ids.length - 1; i += 1) {
    edges.push({
      id: `e-${ids[i]}-${ids[i + 1]}`,
      source: ids[i]!,
      target: ids[i + 1]!,
      type: 'smoothstep',
      markerEnd: MarkerType.ArrowClosed,
    });
  }
  return edges;
}

// Re-sync the store whenever steps, the trigger label, or selection change.
watch(
  () => [props.steps, props.triggerLabel, props.selectedId],
  () => {
    setNodes(buildNodes());
    setEdges(buildEdges());
  },
  { immediate: true, deep: true },
);

// Fit once after mount, and re-fit when the number of steps changes (structure).
onMounted(() => nextTick(() => fitView({ padding: 0.25, maxZoom: 1 })));
watch(
  () => props.steps.length,
  () => nextTick(() => fitView({ padding: 0.25, maxZoom: 1 })),
);

onNodeClick(({ node }) => emit('select', node.id));
</script>

<template>
  <VueFlow
    :id="flowId"
    :nodes-draggable="false"
    :nodes-connectable="false"
    :elements-selectable="true"
    :min-zoom="0.2"
    :max-zoom="1.5"
    :default-edge-options="{ type: 'smoothstep' }"
    class="h-full w-full"
  >
    <Background :gap="16" :size="1" pattern-color="var(--muted-foreground)" />
    <Controls :show-interactive="false" position="bottom-right" />
    <template #node-trigger="nodeProps">
      <SharedWorkflowsGraphTriggerNode v-bind="nodeProps" />
    </template>
    <template #node-step="nodeProps">
      <SharedWorkflowsGraphStepNode v-bind="nodeProps" />
    </template>
  </VueFlow>
</template>

<style>
/* Vue Flow core + theme styles (global; the library needs these to render). */
@import '@vue-flow/core/dist/style.css';
@import '@vue-flow/core/dist/theme-default.css';
@import '@vue-flow/controls/dist/style.css';

/* Small, subtle connection handles (we drive linking via the UI, not by dragging). */
.vue-flow__handle {
  width: 6px;
  height: 6px;
  min-width: 0;
  border: 0;
  background: var(--muted-foreground);
  opacity: 0.35;
}

/* Match the controls to the app theme rather than the default white. */
.vue-flow__controls {
  box-shadow: 0 1px 3px rgb(0 0 0 / 0.12);
}
.vue-flow__controls-button {
  background: var(--background);
  border-color: var(--border);
  color: var(--foreground);
  fill: var(--foreground);
}
.vue-flow__controls-button:hover {
  background: var(--muted);
}
</style>
