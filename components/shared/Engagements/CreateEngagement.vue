<script lang="ts" setup>
// Multi-step "New engagement" flow. Rendered as a bottom Drawer on mobile and a
// Dialog on desktop (same body via a reusable template), it walks the user through:
//   Step 1 — pick a playbook from a searchable list of cards (mirrors the look of
//            the Playbook Library sheet), tapping a card advances the flow.
//   Step 2 — name the issue (+ optional target date) and create.
// Controlled purely via v-model:open (the page opens it programmatically, incl. the
// deep-linked "New work" picker). Emits `created` with the new engagement id.
import {
  Loader2, Search, Layers, Milestone, CalendarClock, FileText,
  Lock, Users, Globe, ChevronLeft, ArrowLeft, Plus,
} from 'lucide-vue-next';
import {
  listEngagementTemplates, createEngagement,
  type EngagementTemplate, type TemplateField,
} from '~/services/engagements';

const open = defineModel<boolean>('open', { default: false });
const emit = defineEmits<{ created: [id: string] }>();

const router = useRouter();

const [DefineBody, ReuseBody] = createReusableTemplate();

// ── State ────────────────────────────────────────────────────────────────────
const step = ref<1 | 2>(1);
const search = ref('');
const selected = ref<EngagementTemplate | null>(null);
const form = reactive({ name: '', targetDate: '' });
// Values for the picked playbook's input fields, keyed by field id (→ fieldValues).
const fieldValues = reactive<Record<string, any>>({});

const templates = ref<EngagementTemplate[]>([]);
const templatesLoading = ref(false);
const creating = ref(false);
const error = ref('');

// Reload templates every time the flow opens so playbooks just built in Studio
// (or duplicated/deleted) show up without a stale cache.
watch(open, async (v) => {
  if (!v) return;
  step.value = 1;
  search.value = '';
  selected.value = null;
  form.name = '';
  form.targetDate = '';
  clearFieldValues();
  error.value = '';
  templatesLoading.value = true;
  try {
    templates.value = await listEngagementTemplates();
  } catch (e: any) {
    error.value = e?.message || 'Could not load playbooks.';
  } finally {
    templatesLoading.value = false;
  }
});

// ── Step 1: searchable, grouped playbook cards ───────────────────────────────
const filtered = computed(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return templates.value;
  return templates.value.filter((t) =>
    `${t.name} ${t.description ?? ''}`.toLowerCase().includes(q));
});
const groups = computed(() => [
  { key: 'mine', label: 'Your playbooks', items: filtered.value.filter((t) => !t.isPublic) },
  { key: 'starters', label: 'Starter library', items: filtered.value.filter((t) => t.isPublic) },
].filter((g) => g.items.length));

function scopeOf(t: EngagementTemplate): { icon: any; text: string } {
  if (t.isPublic) return { icon: Globe, text: 'Starter' };
  if (t.organisation) return { icon: Users, text: 'Firm' };
  return { icon: Lock, text: 'Personal' };
}

function clearFieldValues() {
  for (const k of Object.keys(fieldValues)) delete fieldValues[k];
}

function pick(t: EngagementTemplate) {
  selected.value = t;
  clearFieldValues();
  step.value = 2;
}

// ── Step 2: name + fields + create ───────────────────────────────────────────
// The picked playbook's sections define the intake form for this engagement; each
// field's value is collected into fieldValues keyed by field id.
const sections = computed(() => selected.value?.data?.sections?.filter((s) => s.fields?.length) ?? []);
const allFields = computed<TemplateField[]>(() => sections.value.flatMap((s) => s.fields));

// A required field is missing when its value is blank. Booleans are exempt: a
// switch always carries an answer (unset = false = "No"), so it's never "missing".
const missingRequired = computed(() =>
  allFields.value.filter((f) => {
    if (!f.required || f.type === 'boolean') return false;
    const v = fieldValues[f.id];
    return v === undefined || v === null || v === '';
  }));

// Strip blank values so we never persist empty keys.
function cleanedFieldValues(): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(fieldValues)) {
    if (v !== undefined && v !== null && v !== '') out[k] = v;
  }
  return out;
}

async function submit() {
  if (!selected.value || !form.name.trim()) return;
  if (missingRequired.value.length) {
    error.value = `Please fill in: ${missingRequired.value.map((f) => f.label).join(', ')}`;
    return;
  }
  creating.value = true;
  error.value = '';
  try {
    const values = cleanedFieldValues();
    const res = await createEngagement({
      templateId: selected.value.id,
      name: form.name.trim(),
      targetDate: form.targetDate || undefined,
      fieldValues: Object.keys(values).length ? values : undefined,
    });
    open.value = false;
    emit('created', res.engagement.id);
    await router.push(`/main/engagements/${res.engagement.id}`);
  } catch (e: any) {
    error.value = e?.message || 'Could not create engagement.';
  } finally {
    creating.value = false;
  }
}

function goStudio() {
  open.value = false;
  router.push('/main/engagements/studio');
}
</script>

<template>
  <!-- Shared body for both the Dialog (desktop) and Drawer (mobile) shells. -->
  <DefineBody>
    <div class="flex min-h-0 flex-1 flex-col">
      <!-- Step 1: pick a playbook -->
      <template v-if="step === 1">
        <div class="border-b p-3">
          <div class="relative">
            <Search class="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input v-model="search" placeholder="Search playbooks…" class="pl-9" />
          </div>
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto p-3">
          <div v-if="templatesLoading" class="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 class="size-4 animate-spin" /> Loading playbooks…
          </div>

          <p v-else-if="error" class="py-6 text-center text-sm text-destructive">{{ error }}</p>

          <div v-else-if="!filtered.length" class="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
            <Layers class="size-6" />
            <p class="text-sm">No playbooks match “{{ search }}”.</p>
          </div>

          <div v-else class="flex flex-col gap-5">
            <section v-for="g in groups" :key="g.key" class="flex flex-col gap-2">
              <h3 class="text-[11px] uppercase tracking-wide text-muted-foreground">{{ g.label }}</h3>
              <button
                v-for="t in g.items" :key="t.id"
                type="button"
                class="flex flex-col gap-1.5 rounded-lg border bg-muted/40 p-3 text-left transition-colors hover:border-primary hover:bg-muted"
                @click="pick(t)"
              >
                <div class="flex flex-wrap items-center gap-2">
                  <span class="text-sm font-medium">{{ t.name }}</span>
                  <Badge variant="outline" class="gap-1 text-[10px]">
                    <component :is="scopeOf(t).icon" class="size-2.5" /> {{ scopeOf(t).text }}
                  </Badge>
                </div>
                <p v-if="t.description" class="line-clamp-2 text-xs text-muted-foreground">{{ t.description }}</p>
                <div class="flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span class="flex items-center gap-1">
                    <Layers class="size-3" />
                    {{ t.data?.stages?.length ? `${t.data.stages.length} stages` : 'Lightweight' }}
                  </span>
                  <span v-if="t.data?.milestones?.length" class="flex items-center gap-1">
                    <Milestone class="size-3" /> {{ t.data.milestones.length }}
                  </span>
                  <span v-if="t.data?.compliance?.length" class="flex items-center gap-1">
                    <CalendarClock class="size-3" /> {{ t.data.compliance.length }}
                  </span>
                  <span v-if="t.data?.documents?.length" class="flex items-center gap-1">
                    <FileText class="size-3" /> {{ t.data.documents.length }}
                  </span>
                </div>
              </button>
            </section>
          </div>
        </div>

        <div class="border-t p-3">
          <p class="text-xs text-muted-foreground">
            Don't see your work type?
            <button class="text-primary hover:underline" @click="goStudio">Build a playbook →</button>
          </p>
        </div>
      </template>

      <!-- Step 2: name the issue -->
      <template v-else>
        <div class="min-h-0 flex-1 overflow-y-auto p-4">
          <button
            type="button"
            class="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
            @click="step = 1"
          >
            <ArrowLeft class="size-4" /> Change playbook
          </button>

          <div class="mb-4 flex flex-col gap-1.5 rounded-lg border bg-muted/40 p-3">
            <div class="flex flex-wrap items-center gap-2">
              <span class="text-sm font-medium">{{ selected?.name }}</span>
              <Badge v-if="selected" variant="outline" class="gap-1 text-[10px]">
                <component :is="scopeOf(selected).icon" class="size-2.5" /> {{ scopeOf(selected).text }}
              </Badge>
            </div>
            <p v-if="selected?.description" class="line-clamp-2 text-xs text-muted-foreground">{{ selected.description }}</p>
          </div>

          <div class="flex flex-col gap-4">
            <div class="flex flex-col gap-1.5">
              <Label>Name of the issue</Label>
              <Input v-model="form.name" placeholder="e.g. Nakato Ltd — Incorporation" @keydown.enter="submit" />
            </div>
            <div class="flex flex-col gap-1.5">
              <Label>Target date (optional)</Label>
              <Input v-model="form.targetDate" type="date" />
            </div>

            <!-- Playbook intake fields, grouped by section. -->
            <section v-for="s in sections" :key="s.id" class="flex flex-col gap-3">
              <Separator />
              <h3 v-if="s.label" class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {{ s.label }}
              </h3>
              <SharedEngagementsFieldInput
                v-for="f in s.fields"
                :key="f.id"
                :field="f"
                v-model="fieldValues[f.id]"
              />
            </section>

            <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
          </div>
        </div>

        <div class="flex items-center justify-end gap-2 border-t p-3">
          <Button variant="outline" @click="step = 1">
            <ChevronLeft class="size-4" /> Back
          </Button>
          <Button :disabled="creating || !form.name.trim()" @click="submit">
            <Loader2 v-if="creating" class="mr-1.5 size-4 animate-spin" />
            Create
          </Button>
        </div>
      </template>
    </div>
  </DefineBody>

  <!-- Desktop: Dialog -->
  <Dialog v-if="$viewport.isGreaterOrEquals('customxs')" v-model:open="open">
    <DialogContent class="flex h-[80vh] max-h-[640px] flex-col gap-0 p-0 sm:max-w-lg">
      <DialogHeader class="border-b p-4">
        <DialogTitle>New engagement</DialogTitle>
        <DialogDescription>
          {{ step === 1 ? 'Pick a playbook to base this engagement on.' : 'Name the issue and set a target date if you have one.' }}
        </DialogDescription>
      </DialogHeader>
      <ReuseBody />
    </DialogContent>
  </Dialog>

  <!-- Mobile: bottom Drawer -->
  <Drawer v-else v-model:open="open">
    <DrawerContent class="h-[90dvh] max-h-[90dvh]">
      <DrawerHeader class="border-b text-left">
        <DrawerTitle>New engagement</DrawerTitle>
        <DrawerDescription>
          {{ step === 1 ? 'Pick a playbook to base this engagement on.' : 'Name the issue and set a target date if you have one.' }}
        </DrawerDescription>
      </DrawerHeader>
      <ReuseBody />
    </DrawerContent>
  </Drawer>
</template>
