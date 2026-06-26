<script lang="ts" setup>
import {
  FileText, Sparkles, CheckCircle2, Wrench, Plus, X, Trash2, ChevronUp, ChevronDown, Info,
} from 'lucide-vue-next';
import type { EditorStep, StepType } from '~/services/workflows/authoring';
import {
  STEP_TYPE_META, TOOL_OPTIONS, CHANNEL_OPTIONS, TEMPLATE_HELP, EXPR_HELP,
  idify, applyTypeDefaults,
  policyKind, setPolicyKind, quorumCount, setQuorumCount,
  hintsFor, inputStr, setInputStr, channelsOf, toggleChannel,
  extraKeys, renameExtraKey, addExtraKey, removeExtraKey,
} from '~/services/workflows/authoring';

// Right-hand inspector for the single selected step. Mirrors the per-type
// sub-editors that used to live inline in WorkflowBuilder.vue, now driven from the
// graph canvas. `step` is the live reactive EditorStep from the editor's array, so
// edits mutate in place (no v-model plumbing back up). Structural actions (delete,
// reorder) are emitted to the editor which owns the list.
const props = defineProps<{
  step: EditorStep;
  index: number;
  total: number;
}>();
const emit = defineEmits<{
  (e: 'delete'): void;
  (e: 'move', dir: -1 | 1): void;
}>();

const TYPE_ICON = {
  draft_document: FileText, reason: Sparkles, approval: CheckCircle2, action: Wrench,
} as const;

function onTitleBlur() {
  if (!props.step.id && props.step.title) props.step.id = idify(props.step.title);
}
function onTypeChange() {
  applyTypeDefaults(props.step);
}
function addApprover() {
  (props.step.approvers ??= []).push('');
}
function removeApprover(i: number) {
  props.step.approvers?.splice(i, 1);
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- Header: type + reorder/delete -->
    <div class="flex items-center justify-between gap-2">
      <span class="text-xs font-medium text-muted-foreground">Step {{ index + 1 }} of {{ total }}</span>
      <div class="flex items-center gap-1">
        <Button size="icon-sm" variant="ghost" :disabled="index === 0" title="Move up" @click="emit('move', -1)">
          <ChevronUp class="size-4" />
        </Button>
        <Button size="icon-sm" variant="ghost" :disabled="index === total - 1" title="Move down" @click="emit('move', 1)">
          <ChevronDown class="size-4" />
        </Button>
        <Button size="icon-sm" variant="ghost" title="Delete step" @click="emit('delete')">
          <Trash2 class="size-4 text-muted-foreground" />
        </Button>
      </div>
    </div>

    <!-- Type -->
    <div class="flex flex-col gap-1.5">
      <Label class="text-xs">Step type</Label>
      <Select v-model="step.type" @update:model-value="onTypeChange">
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem v-for="t in STEP_TYPE_META" :key="t.id" :value="t.id">
            <span class="flex items-center gap-2">
              <component :is="TYPE_ICON[t.id]" class="size-3.5" /> {{ t.label }}
            </span>
          </SelectItem>
        </SelectContent>
      </Select>
      <p class="text-[11px] text-muted-foreground">{{ STEP_TYPE_META.find((m) => m.id === step.type)?.hint }}</p>
    </div>

    <!-- Title + id -->
    <div class="flex flex-col gap-1.5">
      <Label class="text-xs">Title</Label>
      <Input v-model="step.title" placeholder="Step title" @blur="onTitleBlur" />
    </div>
    <div class="flex flex-col gap-1.5">
      <Label class="text-xs">Step id</Label>
      <Input v-model="step.id" placeholder="step_id" class="font-mono text-xs" />
    </div>

    <!-- draft_document / reason -->
    <template v-if="step.type === 'draft_document' || step.type === 'reason'">
      <div class="flex flex-col gap-1.5">
        <Label class="text-xs">Instruction</Label>
        <Textarea
          v-model="step.instruction"
          rows="4"
          :placeholder="step.type === 'reason'
            ? 'What should the AI work out? You can reference {{ form.x }}.'
            : 'Describe the document to draft. Reference form values with {{ form.x }}.'"
        />
      </div>
      <div v-if="step.type === 'draft_document'" class="flex flex-col gap-1.5">
        <Label class="text-xs">Document kind (optional)</Label>
        <Input v-model="step.doc_kind" placeholder="agreement · notice · plaint · letter · affidavit" />
      </div>
    </template>

    <!-- approval -->
    <template v-else-if="step.type === 'approval'">
      <div class="flex flex-col gap-2">
        <Label class="text-xs">Approvers (User ids — usually a form field template)</Label>
        <div v-for="(_, ai) in step.approvers || []" :key="ai" class="flex items-center gap-2">
          <Input v-model="step.approvers![ai]" class="font-mono text-xs" placeholder="{{ form.approver_ids }}" />
          <Button size="icon-sm" variant="ghost" @click="removeApprover(ai)"><X class="size-4" /></Button>
        </div>
        <Button size="sm" variant="ghost" class="self-start" @click="addApprover">
          <Plus class="size-4" /> Add approver
        </Button>
      </div>
      <div class="grid gap-3 sm:grid-cols-2">
        <div class="flex flex-col gap-1.5">
          <Label class="text-xs">Policy</Label>
          <Select :model-value="policyKind(step)" @update:model-value="(v) => setPolicyKind(step, v as any)">
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="any_one">Any one approves</SelectItem>
              <SelectItem value="all">All must approve</SelectItem>
              <SelectItem value="quorum">Quorum (N approvals)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div v-if="policyKind(step) === 'quorum'" class="flex flex-col gap-1.5">
          <Label class="text-xs">Required approvals</Label>
          <Input
            type="number"
            min="1"
            :model-value="quorumCount(step)"
            @update:model-value="(v) => setQuorumCount(step, Number(v))"
          />
        </div>
      </div>
      <div class="flex flex-col gap-1.5">
        <Label class="text-xs">Prompt (what approvers decide on)</Label>
        <Textarea v-model="step.prompt" rows="2" placeholder="Approve proceeding for {{ form.company_name }}?" />
      </div>
    </template>

    <!-- action -->
    <template v-else-if="step.type === 'action'">
      <div class="flex flex-col gap-1.5">
        <Label class="text-xs">Tool</Label>
        <Select v-model="step.tool">
          <SelectTrigger><SelectValue placeholder="Pick a tool…" /></SelectTrigger>
          <SelectContent>
            <SelectItem v-for="t in TOOL_OPTIONS" :key="t" :value="t" class="font-mono text-xs">{{ t }}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div v-if="step.tool" class="flex flex-col gap-2">
        <Label class="text-xs">Inputs</Label>
        <template v-for="h in hintsFor(step.tool)" :key="h.key">
          <div v-if="h.kind === 'channels'" class="flex flex-col gap-1.5">
            <Label class="text-[11px] text-muted-foreground">{{ h.label }}</Label>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="ch in CHANNEL_OPTIONS"
                :key="ch"
                type="button"
                class="rounded-md border px-2.5 py-1 text-xs transition"
                :class="channelsOf(step).includes(ch)
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted/50'"
                @click="toggleChannel(step, ch)"
              >
                {{ ch }}
              </button>
            </div>
          </div>
          <div v-else class="flex flex-col gap-1">
            <Label class="text-[11px] text-muted-foreground">
              {{ h.label }} <span class="font-mono">({{ h.key }})</span>
            </Label>
            <Input
              :model-value="inputStr(step, h.key)"
              :placeholder="h.placeholder"
              class="text-xs"
              @update:model-value="(v) => setInputStr(step, h.key, String(v))"
            />
          </div>
        </template>
        <!-- Extra / raw key-value rows -->
        <div v-for="k in extraKeys(step)" :key="k" class="grid grid-cols-[1fr_1fr_auto] items-center gap-2">
          <Input
            :model-value="k"
            class="font-mono text-xs"
            placeholder="key"
            @change="(e: any) => renameExtraKey(step, k, e.target.value)"
          />
          <Input
            :model-value="inputStr(step, k)"
            class="text-xs"
            placeholder="value (templated)"
            @update:model-value="(v) => setInputStr(step, k, String(v))"
          />
          <Button size="icon-sm" variant="ghost" @click="removeExtraKey(step, k)"><X class="size-4" /></Button>
        </div>
        <Button size="sm" variant="ghost" class="self-start" @click="addExtraKey(step)">
          <Plus class="size-4" /> Add input
        </Button>
      </div>
    </template>

    <!-- when / for_each -->
    <div class="flex flex-col gap-3 border-t pt-4">
      <div class="flex flex-col gap-1.5">
        <Label class="text-xs">Run only when (optional)</Label>
        <Input v-model="step.when" class="font-mono text-xs" placeholder="form.single_member == false" />
      </div>
      <div v-if="step.type !== 'approval'" class="flex flex-col gap-1.5">
        <Label class="text-xs">Repeat for each (optional)</Label>
        <Input v-model="step.for_each" class="font-mono text-xs" placeholder="form.shareholders" />
      </div>
    </div>

    <!-- Help -->
    <details class="rounded-lg border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">
      <summary class="flex cursor-pointer items-center gap-1.5 font-medium text-foreground">
        <Info class="size-3.5" /> Templating & expressions
      </summary>
      <p class="mt-2 font-medium">Templated values:</p>
      <ul class="ml-4 list-disc space-y-0.5">
        <li v-for="t in TEMPLATE_HELP" :key="t" class="font-mono">{{ t }}</li>
      </ul>
      <p class="mt-2 font-medium">when / for_each expressions:</p>
      <ul class="ml-4 list-disc space-y-0.5">
        <li v-for="t in EXPR_HELP" :key="t" class="font-mono">{{ t }}</li>
      </ul>
    </details>
  </div>
</template>
