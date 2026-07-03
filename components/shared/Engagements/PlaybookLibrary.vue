<script lang="ts" setup>
import {
  Loader2, Wand2, Copy, Trash2, ChevronDown, ChevronRight, Layers,
  CalendarClock, FileText, Milestone, Lock, Users, Globe, Plus, Bell, BellOff,
} from 'lucide-vue-next';
import {
  listEngagementTemplates, duplicateEngagementTemplate, deleteEngagementTemplate,
  canManageTemplate, describeCompliance,
  type EngagementTemplate,
} from '~/services/engagements';

const open = defineModel<boolean>('open', { default: false });
const emit = defineEmits<{ changed: [] }>();

const router = useRouter();

const templates = ref<EngagementTemplate[]>([]);
const loading = ref(false);
const error = ref('');
const expandedId = ref('');
const busyId = ref('');

async function load() {
  loading.value = true;
  error.value = '';
  try {
    templates.value = await listEngagementTemplates();
  } catch (e: any) {
    error.value = e?.message || 'Could not load playbooks.';
  } finally {
    loading.value = false;
  }
}

watch(open, (v) => { if (v) load(); });

// Split into the firm's/own editable playbooks vs. the read-only starter library.
const mine = computed(() => templates.value.filter((t) => !t.isPublic));
const starters = computed(() => templates.value.filter((t) => t.isPublic));
const groups = computed(() => [
  { key: 'mine', label: 'Your playbooks', items: mine.value, empty: 'None yet. Build one in Studio, or duplicate a starter below.' },
  { key: 'starters', label: 'Starter library', items: starters.value, empty: '' },
]);

function scopeOf(t: EngagementTemplate): { icon: any; text: string } {
  if (t.isPublic) return { icon: Globe, text: 'Starter' };
  if (t.organisation) return { icon: Users, text: 'Firm' };
  return { icon: Lock, text: 'Personal' };
}

function fieldLabels(t: EngagementTemplate): Record<string, string> {
  const m: Record<string, string> = {};
  for (const s of t.data?.sections ?? []) for (const f of s.fields ?? []) m[f.id] = f.label;
  return m;
}

function toggle(id: string) {
  expandedId.value = expandedId.value === id ? '' : id;
}

// Edit routes through Studio: for an own/firm playbook the tool updates it in
// place (upsert-by-name); for a starter it forks a firm-scoped override.
function editInStudio(name: string) {
  open.value = false;
  router.push({ path: '/main/engagements/studio', query: name ? { edit: name } : {} });
}

async function duplicate(t: EngagementTemplate) {
  busyId.value = t.id;
  try {
    await duplicateEngagementTemplate(t);
    await load();
    emit('changed');
  } catch (e: any) {
    error.value = e?.message || 'Could not duplicate.';
  } finally {
    busyId.value = '';
  }
}

const deleteTarget = ref<EngagementTemplate | null>(null);
const deleting = ref(false);
async function confirmDelete() {
  if (!deleteTarget.value) return;
  deleting.value = true;
  try {
    await deleteEngagementTemplate(deleteTarget.value.id);
    deleteTarget.value = null;
    await load();
    emit('changed');
  } catch (e: any) {
    error.value = e?.message || 'Could not delete.';
  } finally {
    deleting.value = false;
  }
}
</script>

<template>
  <Sheet v-model:open="open">
    <SheetContent side="right" class="w-full sm:max-w-lg p-0 flex flex-col">
      <SheetHeader class="p-4 border-b">
        <SheetTitle class="flex items-center gap-2"><Layers class="size-4" /> Playbooks</SheetTitle>
        <SheetDescription>
          View, edit, duplicate, and delete the engagement playbooks your work is built from.
        </SheetDescription>
      </SheetHeader>

      <div class="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-5">
        <Button variant="outline" class="gap-1.5 w-full" @click="editInStudio('')">
          <Plus class="size-4" /> Build a new playbook in Studio
        </Button>

        <div v-if="loading" class="flex items-center gap-2 text-sm text-muted-foreground py-4">
          <Loader2 class="size-4 animate-spin" /> Loading…
        </div>
        <p v-else-if="error" class="text-sm text-destructive">{{ error }}</p>

        <template v-else>
          <section v-for="g in groups" :key="g.key" class="flex flex-col gap-2">
            <h3 class="text-[11px] uppercase tracking-wide text-muted-foreground">{{ g.label }}</h3>
            <p v-if="!g.items.length && g.empty" class="text-sm text-muted-foreground">{{ g.empty }}</p>

            <div v-for="t in g.items" :key="t.id" class="rounded-lg border bg-muted/40">
              <!-- Header row -->
              <div class="flex items-start gap-2 p-3">
                <button class="mt-0.5 shrink-0 text-muted-foreground" @click="toggle(t.id)">
                  <component :is="expandedId === t.id ? ChevronDown : ChevronRight" class="size-4" />
                </button>
                <div class="min-w-0 flex-1 cursor-pointer" @click="toggle(t.id)">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="font-medium text-sm">{{ t.name }}</span>
                    <Badge variant="outline" class="gap-1 text-[10px]">
                      <component :is="scopeOf(t).icon" class="size-2.5" /> {{ scopeOf(t).text }}
                    </Badge>
                  </div>
                  <p class="text-xs text-muted-foreground line-clamp-2 mt-0.5">{{ t.description }}</p>
                  <div class="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground">
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
                </div>
                <div class="flex items-center gap-0.5 shrink-0">
                  <Button size="icon-sm" variant="ghost" title="Edit in Studio" @click="editInStudio(t.name)">
                    <Wand2 class="size-3.5" />
                  </Button>
                  <Button size="icon-sm" variant="ghost" title="Duplicate" :disabled="busyId === t.id" @click="duplicate(t)">
                    <Loader2 v-if="busyId === t.id" class="size-3.5 animate-spin" />
                    <Copy v-else class="size-3.5" />
                  </Button>
                  <Button
                    v-if="canManageTemplate(t)"
                    size="icon-sm" variant="ghost" title="Delete"
                    class="text-muted-foreground hover:text-destructive"
                    @click="deleteTarget = t"
                  >
                    <Trash2 class="size-3.5" />
                  </Button>
                </div>
              </div>

              <!-- Expanded detail -->
              <div v-if="expandedId === t.id" class="border-t px-3 py-3 flex flex-col gap-3 text-xs">
                <div v-if="t.data?.stages?.length" class="flex items-center gap-1.5 flex-wrap">
                  <template v-for="(s, i) in t.data.stages" :key="s.id">
                    <span class="rounded-full bg-muted px-2 py-0.5">{{ s.label }}</span>
                    <ChevronRight v-if="i < t.data.stages.length - 1" class="size-3 text-muted-foreground" />
                  </template>
                </div>

                <div v-if="t.data?.milestones?.length">
                  <p class="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Milestones</p>
                  <ul class="flex flex-col gap-1">
                    <li v-for="m in t.data.milestones" :key="m.id" class="flex items-center gap-1.5">
                      <component :is="m.reminder ? Bell : BellOff" class="size-3 shrink-0"
                        :class="m.reminder ? 'text-primary' : 'text-muted-foreground'" />
                      <span>{{ m.label }}</span>
                    </li>
                  </ul>
                </div>

                <div v-if="t.data?.compliance?.length">
                  <p class="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Recurring obligations</p>
                  <ul class="flex flex-col gap-1">
                    <li v-for="c in t.data.compliance" :key="c.id">
                      <span class="font-medium">{{ c.label }}</span>
                      <span class="text-muted-foreground"> — {{ describeCompliance(c, fieldLabels(t)) }}</span>
                    </li>
                  </ul>
                </div>

                <div v-if="t.data?.documents?.length" class="flex items-center gap-1.5 flex-wrap">
                  <Badge v-for="d in t.data.documents" :key="d.id" variant="outline" class="text-[10px]">
                    {{ d.label }}<span v-if="d.optional" class="text-muted-foreground"> (optional)</span>
                  </Badge>
                </div>
              </div>
            </div>
          </section>
        </template>
      </div>
    </SheetContent>
  </Sheet>

  <AlertDialog :open="!!deleteTarget" @update:open="(v) => { if (!v) deleteTarget = null; }">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Delete "{{ deleteTarget?.name }}"?</AlertDialogTitle>
        <AlertDialogDescription>
          This removes the playbook. Engagements already created from it are unaffected. This can't be undone.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel :disabled="deleting">Cancel</AlertDialogCancel>
        <Button variant="destructive" :disabled="deleting" @click="confirmDelete">
          <Loader2 v-if="deleting" class="size-4 animate-spin mr-1.5" /> Delete
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
