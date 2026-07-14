<script lang="ts" setup>
import { ArrowLeft, Loader2, Lock } from 'lucide-vue-next';
import {
  type FormDef, type WorkflowDef, listForms, listWorkflows, getEntitlements, WorkflowsDisabledError,
} from '~/services/workflows';
import { toast } from 'vue-sonner';

definePageMeta({
  layout: 'blank'
})
// Dedicated, full-screen workflow editor (workflows-v2). Authoring moved out of
// the tabbed Workspace into its own page so the builder has room and no
// distraction. The route param drives intent:
//   /main/workflows/edit/new            → blank new workflow
//   /main/workflows/edit/<workflowId>   → edit an existing firm-owned workflow
//   /main/workflows/edit/new?clone=<id> → seed a new workflow from a curated one
//   ?describe=1                         → open the AI "describe" side-panel (Phase 3)
// On save/cancel we return to the Workflows workspace Manage→Workflows tab.
const route = useRoute();
const router = useRouter();

const routeId = computed(() => String(route.params.id || 'new'));
const cloneId = computed(() => (route.query.clone ? String(route.query.clone) : ''));
const openAssistant = computed(() => route.query.describe === '1' || route.query.describe === 'true');
// Optional initial AI-builder prompt carried from the main chat's draft_workflow link.
const seedPrompt = computed(() => (route.query.seed ? String(route.query.seed) : ''));

const checking = ref(true);
const enabled = ref(false);
const loading = ref(true);

const forms = ref<FormDef[]>([]);
const workflows = ref<WorkflowDef[]>([]);

// Resolve the editor seed from the loaded lists + route intent.
const editingWorkflow = computed(() =>
  routeId.value !== 'new' ? workflows.value.find((w) => w.id === routeId.value) || null : null);
const cloningWorkflow = computed(() =>
  cloneId.value ? workflows.value.find((w) => w.id === cloneId.value) || null : null);

// Guard: editing a non-existent / non-firm-owned id once loaded.
const notFound = computed(() =>
  !loading.value && routeId.value !== 'new' && !editingWorkflow.value);

const headerTitle = computed(() => {
  if (routeId.value !== 'new') return editingWorkflow.value?.name || 'Edit workflow';
  if (cloningWorkflow.value) return `New from “${cloningWorkflow.value.name}”`;
  return 'New workflow';
});

function backToList() {
  router.push({ path: '/main/workflows', query: { wfTab: 'manage' } });
}

function onSaved() {
  backToList();
}

function onDisabled() {
  enabled.value = false;
}

onMounted(async () => {
  try {
    enabled.value = (await getEntitlements()).workflows;
  } catch {
    enabled.value = false;
  } finally {
    checking.value = false;
  }
  if (!enabled.value) {
    loading.value = false;
    return;
  }
  try {
    [forms.value, workflows.value] = await Promise.all([listForms(), listWorkflows()]);
  } catch (err) {
    if (err instanceof WorkflowsDisabledError) enabled.value = false;
    else toast.error(err instanceof Error ? err.message : 'Could not load the workflow');
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="flex h-full w-full flex-col overflow-hidden border-x safe-area-shell">
    <!-- Header -->
    <div class="flex items-center gap-3 border-b p-3">
      <Button variant="outline" size="icon" aria-label="Back" @click="backToList">
        <ArrowLeft class="size-4" />
      </Button>
      <span class="ibm-plex-serif truncate text-lg font-semibold">{{ headerTitle }}</span>
    </div>

    <!-- Body -->
    <div class="min-h-0 flex-1">
      <!-- Checking / locked / not-found states are centered; the editor is full-bleed. -->
      <div
        v-if="checking || loading || !enabled || notFound"
        class="mx-auto flex h-full w-full max-w-4xl flex-col justify-center p-4"
      >
        <div
          v-if="checking || loading"
          class="flex items-center gap-2 rounded-xl border px-4 py-6 text-sm text-muted-foreground"
        >
          <Loader2 class="size-4 animate-spin" /> Loading editor…
        </div>

        <div
          v-else-if="!enabled"
          class="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center"
        >
          <div class="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
            <Lock class="size-6" />
          </div>
          <p class="text-sm font-semibold">Workflows isn't enabled yet</p>
          <p class="max-w-sm text-xs text-muted-foreground">
            Ask your organisation admin to enable Workflows on your plan.
          </p>
        </div>

        <div
          v-else-if="notFound"
          class="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center"
        >
          <p class="text-sm font-semibold">Workflow not found</p>
          <p class="max-w-sm text-xs text-muted-foreground">
            It may have been deleted, or it's a curated workflow you can only clone.
          </p>
          <Button size="sm" variant="outline" @click="backToList">Back to workflows</Button>
        </div>
      </div>

      <!-- Graph editor (full width + height) -->
      <SharedWorkflowsGraphEditor
        v-else
        :workflow="editingWorkflow"
        :clone-from="cloningWorkflow"
        :forms="forms"
        :open-assistant="openAssistant"
        :seed-prompt="seedPrompt"
        @saved="onSaved"
        @cancel="backToList"
        @disabled="onDisabled"
      />
    </div>
  </div>
</template>
