<!--
  ActionStrip — what the assistant changed in this conversation, and how to take it
  back.

  This is the other half of auto mode. The assistant used to stop for permission
  before every change, which is a check that happens BEFORE an action; auto mode
  trades that away for the reversible ones, and this is what it trades it for — a
  check that happens after. Without it the feature is not a smaller safeguard, it is
  an absent one.

  So the strip is deliberately not a notification. It stays for the whole
  conversation, it lists manual approvals alongside automatic ones (the record is of
  what happened, not of what happened without asking), and every row that can be
  reversed carries the button that reverses it.
-->
<template>
  <div v-if="actions.length" class="w-full">
    <!-- Collapsed: one line, so a working conversation is not crowded by a log. -->
    <button
        type="button"
        class="flex w-full flex-row items-center justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2 text-left transition-colors hover:bg-muted/60"
        @click="open = !open">
      <span class="flex min-w-0 flex-row items-center gap-2">
        <History class="size-4 shrink-0 text-muted-foreground"/>
        <span class="truncate text-sm">
          {{ summary }}
        </span>
      </span>
      <ChevronDown
          class="size-4 shrink-0 text-muted-foreground transition-transform"
          :class="open ? 'rotate-180' : ''"/>
    </button>

    <div v-if="open" class="mt-2 flex flex-col gap-2">
      <div
          v-for="action in actions"
          :key="action.id"
          class="flex flex-row items-start justify-between gap-3 rounded-lg border px-3 py-2">
        <div class="flex min-w-0 flex-col gap-0.5">
          <div class="flex flex-row flex-wrap items-center gap-2">
            <span class="text-sm font-medium">{{ describe(action) }}</span>

            <!-- The distinction the ledger exists to preserve: a person allowed this,
                 or the policy did. -->
            <span
                v-if="action.approval === 'auto'"
                class="rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
              Automatic
            </span>

            <span
                v-if="action.status === 'undone'"
                class="rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
              Undone
            </span>
            <span
                v-else-if="action.status === 'failed'"
                class="rounded border border-destructive/40 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-destructive">
              Did not run
            </span>
          </div>

          <p v-if="action.status === 'failed' && action.error" class="text-xs text-muted-foreground">
            {{ action.error }}
          </p>
          <p v-else class="text-xs text-muted-foreground">{{ when(action) }}</p>
        </div>

        <!-- Only a row this system can actually reverse offers the button. A tool
             whose effect the ledger cannot undo says so plainly rather than showing a
             control that would fail. -->
        <Button
            v-if="action.status === 'applied' && action.undoable"
            variant="ghost"
            size="sm"
            class="shrink-0"
            :disabled="undoing === action.id"
            @click="undo(action)">
          <Undo2 class="size-3.5"/>
          {{ undoing === action.id ? 'Undoing…' : 'Undo' }}
        </Button>
        <span
            v-else-if="action.status === 'applied'"
            class="shrink-0 pt-1 text-xs text-muted-foreground">
          Undo in the record itself
        </span>
      </div>

      <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import {ref, computed, watch} from 'vue';
import {ChevronDown, History, Undo2} from 'lucide-vue-next';
import {getAiActions, undoAiAction, type AiAction} from '~/services/vault';

const props = defineProps<{
  /** The conversation whose actions to show. Empty until the thread is saved. */
  conversationId?: string;
  /**
   * Bumped by the parent after every completed turn. The strip reloads on a change
   * rather than polling: the ledger only moves when a turn ends, and the parent is
   * the only thing that knows when that was.
   */
  refreshKey?: number;
}>();

const emit = defineEmits<{
  /** An action was reversed — the host may need to refresh whatever displayed it. */
  (e: 'undone', action: AiAction): void;
}>();

const actions = ref<AiAction[]>([]);
const open = ref(false);
const undoing = ref('');
const error = ref('');

/**
 * The collapsed line leads with what can still be taken back, because that is the
 * only thing a reader needs from it at a glance. A conversation whose changes have
 * all been undone or are all permanent still shows the count, so the record is never
 * silently absent.
 */
const summary = computed(() => {
  const applied = actions.value.filter((a) => a.status === 'applied');
  const undoable = applied.filter((a) => a.undoable).length;
  const noun = applied.length === 1 ? 'change' : 'changes';
  if (!applied.length) return `${actions.value.length} recorded, none in effect`;
  if (!undoable) return `${applied.length} ${noun} in this conversation`;
  return `${applied.length} ${noun} in this conversation · ${undoable} can be undone`;
});

/** create_matter_draft -> "Created a matter draft", so a row reads as a sentence. */
const VERBS: Record<string, string> = {
  create_matter_draft: 'Created a matter',
  create_matter_from_dates_draft: 'Created a matter from imported dates',
  create_engagement_draft: 'Created an engagement',
  add_milestone: 'Added a milestone',
  generate_document: 'Drafted a document',
  schedule_reminder: 'Scheduled a reminder',
  create_vault_folder: 'Created a vault folder',
  undo: 'Undid an earlier action',
};

function describe(action: AiAction): string {
  const known = VERBS[action.tool];
  if (known) return known;
  // An unmapped tool still gets a readable row rather than a raw identifier: the
  // ledger records every write, including ones this list has not been taught yet.
  return action.tool.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

function when(action: AiAction): string {
  const at = new Date(action.created);
  if (Number.isNaN(at.getTime())) return '';
  return at.toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

async function load() {
  if (!props.conversationId) {
    actions.value = [];
    return;
  }
  try {
    actions.value = await getAiActions(props.conversationId);
  } catch {
    // A backend without the ledger simply has nothing to show. Failing loudly here
    // would put an error above the composer for something the user cannot act on.
    actions.value = [];
  }
}

async function undo(action: AiAction) {
  undoing.value = action.id;
  error.value = '';
  try {
    const updated = await undoAiAction(action.id);
    // Replace in place rather than reloading: the row keeps its position, so the
    // thing that just changed does not move out from under the pointer.
    const idx = actions.value.findIndex((a) => a.id === action.id);
    if (idx >= 0 && updated) actions.value[idx] = updated;
    emit('undone', updated || action);
  } catch (e: any) {
    error.value = e?.message || 'Could not undo that action.';
  } finally {
    undoing.value = '';
  }
}

watch(() => [props.conversationId, props.refreshKey], load, {immediate: true});

defineExpose({reload: load});
</script>
