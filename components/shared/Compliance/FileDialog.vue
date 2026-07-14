<script setup lang="ts">
import { Loader2, Paperclip } from 'lucide-vue-next';
import { fileCompliance, type ComplianceFiling } from '~/services/engagements';

// Records one compliance occurrence as filed — the moment a nudge becomes a
// defensible register entry: a filing date, a reference (receipt/registration no.),
// an evidence file, and an optional note.
const props = defineProps<{ filing: ComplianceFiling | null }>();
const emit = defineEmits<{ (e: 'filed'): void }>();

const open = defineModel<boolean>('open', { default: false });

function toISO(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Shared body for the Dialog (desktop) and Drawer (mobile) shells.
const [DefineBody, ReuseBody] = createReusableTemplate();

const filedDate = ref(toISO(new Date()));
const reference = ref('');
const note = ref('');
const evidence = ref<File | null>(null);
const busy = ref(false);
const error = ref('');

watch(open, (v) => {
  if (v) {
    filedDate.value = toISO(new Date());
    reference.value = '';
    note.value = '';
    evidence.value = null;
    error.value = '';
  }
});

function onFile(e: Event) {
  const input = e.target as HTMLInputElement;
  evidence.value = input.files?.[0] ?? null;
}

async function submit() {
  if (!props.filing) return;
  busy.value = true;
  error.value = '';
  try {
    await fileCompliance(props.filing.id, {
      filedDate: filedDate.value,
      reference: reference.value.trim(),
      note: note.value.trim(),
      evidence: evidence.value ?? undefined,
    });
    emit('filed');
    open.value = false;
  } catch (e: any) {
    error.value = e?.message || 'Could not record this filing.';
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <DefineBody>
    <div class="flex flex-col gap-4">
      <div class="flex flex-col gap-1.5">
        <Label for="filed-date">Date filed</Label>
        <Input id="filed-date" v-model="filedDate" type="date" />
      </div>

      <div class="flex flex-col gap-1.5">
        <Label for="filed-ref">Reference <span class="text-muted-foreground font-normal">(receipt / registration no.)</span></Label>
        <Input id="filed-ref" v-model="reference" placeholder="e.g. URSB/AR/2026/00421" />
      </div>

      <div class="flex flex-col gap-1.5">
        <Label>Evidence <span class="text-muted-foreground font-normal">(optional)</span></Label>
        <label class="flex items-center gap-2 border rounded-md px-3 py-2 text-sm cursor-pointer hover:bg-secondary/50">
          <Paperclip class="size-4 text-muted-foreground shrink-0" />
          <span class="truncate">{{ evidence?.name || 'Attach the filed receipt or document…' }}</span>
          <input type="file" class="hidden" @change="onFile" />
        </label>
      </div>

      <div class="flex flex-col gap-1.5">
        <Label for="filed-note">Note <span class="text-muted-foreground font-normal">(optional)</span></Label>
        <Textarea id="filed-note" v-model="note" rows="2" placeholder="Anything worth recording about this filing…" />
      </div>

      <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
    </div>
  </DefineBody>

  <!-- Desktop: Dialog -->
  <Dialog v-if="$viewport.isGreaterOrEquals('customxs')" v-model:open="open">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Record filing</DialogTitle>
        <DialogDescription>
          {{ filing?.label }}<span v-if="filing?.dueDate"> · due {{ new Date(filing.dueDate).toLocaleDateString() }}</span>
        </DialogDescription>
      </DialogHeader>

      <div class="py-2">
        <ReuseBody />
      </div>

      <DialogFooter>
        <Button variant="ghost" :disabled="busy" @click="open = false">Cancel</Button>
        <Button :disabled="busy" @click="submit">
          <Loader2 v-if="busy" class="size-4 animate-spin mr-1.5" />
          Mark filed
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <!-- Mobile: bottom Drawer -->
  <Drawer v-else v-model:open="open">
    <DrawerContent class="max-h-[92dvh]">
      <DrawerHeader class="text-left">
        <DrawerTitle>Record filing</DrawerTitle>
        <DrawerDescription>
          {{ filing?.label }}<span v-if="filing?.dueDate"> · due {{ new Date(filing.dueDate).toLocaleDateString() }}</span>
        </DrawerDescription>
      </DrawerHeader>

      <div class="min-h-0 flex-1 overflow-y-auto px-4">
        <ReuseBody />
      </div>

      <DrawerFooter class="flex-row justify-end gap-2">
        <Button variant="ghost" :disabled="busy" @click="open = false">Cancel</Button>
        <Button :disabled="busy" @click="submit">
          <Loader2 v-if="busy" class="size-4 animate-spin mr-1.5" />
          Mark filed
        </Button>
      </DrawerFooter>
    </DrawerContent>
  </Drawer>
</template>
