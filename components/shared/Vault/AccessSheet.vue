<script lang="ts" setup>
import {
  Loader2, ShieldCheck, Eye, Download, Sparkles, History, FileText, Ban,
} from 'lucide-vue-next';
import { toast } from 'vue-sonner';
import {
  getVaultPolicy, setVaultPolicy, setDocumentRestrictions, getVaultAccessHistory,
  ROLE_LABELS, VAULT_ROLES,
  type VaultScope, type VaultRole, type VaultDocument,
  type VaultPolicy, type VaultAccessAxis, type VaultAccessSetting, type VaultAccessEvent,
} from '~/services/vault';
import { whenLabel } from '~/utils/vaultDisplay';

// Access rules + access log, in a right-hand Sheet. Two modes off one component:
// with `doc` it edits that one file's overrides, without it the whole library's
// policy. Both read the library policy, because a per-file rule only makes sense
// next to the rule it is overriding.
const props = defineProps<{
  open: boolean;
  scope: VaultScope;
  scopeId: string;
  /** Set to restrict a single document instead of the library. */
  doc?: VaultDocument | null;
  /** What to call this library in the header. */
  libraryLabel?: string;
}>();
const emit = defineEmits<{ 'update:open': [boolean]; updated: [VaultDocument] }>();

const open = computed({
  get: () => props.open,
  set: (v: boolean) => emit('update:open', v),
});

const docMode = computed(() => !!props.doc);
const tab = ref<'rules' | 'history'>('rules');

const loading = ref(false);
const saving = ref(false);
const policy = ref<VaultPolicy | null>(null);
const canManage = computed(() => !!policy.value?.can_manage);

// Library form. Switches read "allowed", which is the way round a firm thinks
// about it; the wire format is allow/deny.
const allowView = ref(true);
const allowDownload = ref(true);
const allowAi = ref(true);
// 'none' is a sentinel: reka-ui's Select rejects an empty-string item value.
const defaultRole = ref<VaultRole | 'none'>('none');

// Document form. Three-way, because "no opinion" is different from "allow" —
// clearing an override hands the file back to the library rule.
type Override = 'inherit' | VaultAccessSetting;
const docView = ref<Override>('inherit');
const docDownload = ref<Override>('inherit');
const docAi = ref<Override>('inherit');

const OVERRIDES: { value: Override; label: string }[] = [
  { value: 'inherit', label: 'Follow the library' },
  { value: 'allow', label: 'Allow' },
  { value: 'deny', label: 'Deny' },
];

/** What the library says for one axis, spelled out under a document override. */
function libraryNote(axis: VaultAccessAxis) {
  const p = policy.value;
  if (!p) return '';
  const setting = axis === 'download' ? p.downloads : axis === 'view' ? p.view : p.ai;
  return setting === 'deny' ? 'The library denies this' : 'The library allows this';
}

function seed() {
  const p = policy.value;
  if (p) {
    allowView.value = p.view !== 'deny';
    allowDownload.value = p.downloads !== 'deny';
    allowAi.value = p.ai !== 'deny';
    defaultRole.value = (p.default_role || 'none') as VaultRole | 'none';
  }
  const r = props.doc?.restrictions || {};
  docView.value = r.view || 'inherit';
  docDownload.value = r.download || 'inherit';
  docAi.value = r.ai || 'inherit';
}

async function load() {
  loading.value = true;
  try {
    policy.value = await getVaultPolicy(props.scope, props.scopeId);
    seed();
  } catch (e: any) {
    toast.error(e?.message || 'Could not load the access rules.');
  } finally {
    loading.value = false;
  }
}

async function save() {
  saving.value = true;
  try {
    if (docMode.value && props.doc) {
      // Only the axes actually decided are sent; an omitted axis is inheritance.
      const restrictions: Partial<Record<VaultAccessAxis, VaultAccessSetting>> = {};
      if (docView.value !== 'inherit') restrictions.view = docView.value;
      if (docDownload.value !== 'inherit') restrictions.download = docDownload.value;
      if (docAi.value !== 'inherit') restrictions.ai = docAi.value;
      const updated = await setDocumentRestrictions(props.doc.id, restrictions);
      emit('updated', updated);
      toast.success('Access rules saved.');
    } else {
      // A whole-policy write: every axis goes every time, or an unsent one
      // silently reverts to allow.
      policy.value = {
        ...(await setVaultPolicy(props.scope, props.scopeId, {
          view: allowView.value ? 'allow' : 'deny',
          downloads: allowDownload.value ? 'allow' : 'deny',
          ai: allowAi.value ? 'allow' : 'deny',
          default_role: defaultRole.value === 'none' ? '' : defaultRole.value,
        })),
        can_manage: true,
      };
      toast.success('Access rules saved.');
    }
    open.value = false;
  } catch (e: any) {
    toast.error(e?.message || 'Could not save the access rules.');
  } finally {
    saving.value = false;
  }
}

// ── history ────────────────────────────────────────────────────────────────
const events = ref<VaultAccessEvent[]>([]);
const historyLoaded = ref(false);
const historyLoading = ref(false);

const ACTION_LABELS: Record<VaultAccessEvent['action'], string> = {
  view: 'Opened', download: 'Downloaded', zip: 'Downloaded in a bundle',
  ai_read: 'Read by the AI', denied: 'Refused',
};

async function loadHistory() {
  historyLoading.value = true;
  try {
    const res = props.doc
      ? await getVaultAccessHistory({ documentId: props.doc.id })
      : await getVaultAccessHistory({ scope: props.scope, scopeId: props.scopeId });
    events.value = res.events || [];
    historyLoaded.value = true;
  } catch (e: any) {
    toast.error(e?.message || 'Could not load the access history.');
  } finally {
    historyLoading.value = false;
  }
}

watch(() => props.open, (v) => {
  if (!v) return;
  tab.value = 'rules';
  events.value = [];
  historyLoaded.value = false;
  policy.value = null;
  load();
}, { immediate: true });

watch(tab, (t) => { if (t === 'history' && !historyLoaded.value && !historyLoading.value) loadHistory(); });
</script>

<template>
  <Sheet v-model:open="open">
    <SheetContent side="right" class="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
      <SheetHeader class="border-b p-4">
        <SheetTitle class="ibm-plex-serif">
          {{ docMode ? 'Access to this file' : 'Access to this library' }}
        </SheetTitle>
        <SheetDescription class="truncate">
          {{ docMode ? doc?.filename : (libraryLabel || 'Who may open, download, and search these files.') }}
        </SheetDescription>
      </SheetHeader>

      <div v-if="loading" class="flex flex-1 items-center justify-center">
        <Loader2 class="size-5 animate-spin text-muted-foreground" />
      </div>

      <Tabs v-else v-model="tab" class="flex min-h-0 flex-1 flex-col">
        <TabsList v-if="canManage" class="mx-4 mt-3 grid w-auto grid-cols-2">
          <TabsTrigger value="rules" class="gap-1.5">
            <ShieldCheck class="size-4" /> Rules
          </TabsTrigger>
          <TabsTrigger value="history" class="gap-1.5">
            <History class="size-4" /> History
          </TabsTrigger>
        </TabsList>

        <!-- Rules -->
        <TabsContent value="rules" class="mt-0 min-h-0 flex-1 overflow-y-auto p-4">
          <div class="flex flex-col gap-3">
            <p v-if="!canManage" class="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
              You can see these rules but not change them. Ask whoever manages this library.
            </p>

            <!-- Library switches -->
            <template v-if="!docMode">
              <div class="flex items-start justify-between gap-3 rounded-lg border p-3">
                <div class="flex flex-col">
                  <span class="flex items-center gap-1.5 text-sm font-medium"><Eye class="size-4 text-muted-foreground" /> Opening files</span>
                  <span class="text-xs text-muted-foreground">Turn this off to leave only the file list visible.</span>
                </div>
                <Switch v-model="allowView" :disabled="!canManage" class="mt-0.5 shrink-0" />
              </div>
              <div class="flex items-start justify-between gap-3 rounded-lg border p-3">
                <div class="flex flex-col">
                  <span class="flex items-center gap-1.5 text-sm font-medium"><Download class="size-4 text-muted-foreground" /> Downloading files</span>
                  <span class="text-xs text-muted-foreground">Applies to single files and bundles, and to everyone including owners.</span>
                </div>
                <Switch v-model="allowDownload" :disabled="!canManage" class="mt-0.5 shrink-0" />
              </div>
              <div class="flex items-start justify-between gap-3 rounded-lg border p-3">
                <div class="flex flex-col">
                  <span class="flex items-center gap-1.5 text-sm font-medium"><Sparkles class="size-4 text-muted-foreground" /> AI may read these files</span>
                  <span class="text-xs text-muted-foreground">Turn this off to take the library out of the assistant's recall.</span>
                </div>
                <Switch v-model="allowAi" :disabled="!canManage" class="mt-0.5 shrink-0" />
              </div>

              <div v-if="scope === 'vault'" class="flex flex-col gap-1.5 rounded-lg border p-3">
                <Label class="text-xs">Firm members who are not on this vault</Label>
                <Select v-model="defaultRole" :disabled="!canManage">
                  <SelectTrigger class="h-9 text-sm"><SelectValue placeholder="No access" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No access</SelectItem>
                    <SelectItem v-for="r in VAULT_ROLES" :key="r" :value="r">{{ ROLE_LABELS[r] }}</SelectItem>
                  </SelectContent>
                </Select>
                <span class="text-xs text-muted-foreground">The role anyone in the firm holds here without being invited.</span>
              </div>
            </template>

            <!-- Per-document overrides -->
            <template v-else>
              <div class="flex flex-col gap-1.5 rounded-lg border p-3">
                <Label class="flex items-center gap-1.5 text-xs"><Eye class="size-3.5" /> Opening this file</Label>
                <Select v-model="docView" :disabled="!canManage">
                  <SelectTrigger class="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem v-for="o in OVERRIDES" :key="o.value" :value="o.value">{{ o.label }}</SelectItem></SelectContent>
                </Select>
                <span class="text-xs text-muted-foreground">{{ libraryNote('view') }}.</span>
              </div>
              <div class="flex flex-col gap-1.5 rounded-lg border p-3">
                <Label class="flex items-center gap-1.5 text-xs"><Download class="size-3.5" /> Downloading this file</Label>
                <Select v-model="docDownload" :disabled="!canManage">
                  <SelectTrigger class="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem v-for="o in OVERRIDES" :key="o.value" :value="o.value">{{ o.label }}</SelectItem></SelectContent>
                </Select>
                <span class="text-xs text-muted-foreground">{{ libraryNote('download') }}.</span>
              </div>
              <div class="flex flex-col gap-1.5 rounded-lg border p-3">
                <Label class="flex items-center gap-1.5 text-xs"><Sparkles class="size-3.5" /> AI may read this file</Label>
                <Select v-model="docAi" :disabled="!canManage">
                  <SelectTrigger class="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem v-for="o in OVERRIDES" :key="o.value" :value="o.value">{{ o.label }}</SelectItem></SelectContent>
                </Select>
                <span class="text-xs text-muted-foreground">{{ libraryNote('ai') }}.</span>
              </div>
            </template>

            <!-- Stated plainly: this is a boundary and a record, not prevention. -->
            <p class="text-xs leading-relaxed text-muted-foreground">
              Rules are enforced on the server, so they hold however the file is reached, and
              every open, download and refusal is recorded. Allowing someone to open a file
              without downloading it deters copying and leaves a record of who read it — it
              does not make copying impossible.
            </p>

            <Button v-if="canManage" size="sm" class="self-end" :disabled="saving" @click="save">
              <Loader2 v-if="saving" class="size-4 animate-spin" />
              {{ saving ? 'Saving…' : 'Save rules' }}
            </Button>
          </div>
        </TabsContent>

        <!-- History -->
        <TabsContent value="history" class="mt-0 min-h-0 flex-1 overflow-y-auto p-4">
          <div v-if="historyLoading" class="flex justify-center py-8">
            <Loader2 class="size-5 animate-spin text-muted-foreground" />
          </div>
          <p v-else-if="!events.length" class="py-8 text-center text-sm text-muted-foreground">
            Nothing recorded yet.
          </p>
          <ul v-else class="flex flex-col gap-1">
            <li v-for="ev in events" :key="ev.id" class="flex items-start gap-2.5 rounded-lg border p-2.5">
              <component :is="ev.action === 'denied' ? Ban : ev.action === 'view' ? Eye : ev.action === 'ai_read' ? Sparkles : Download"
                class="mt-0.5 size-4 shrink-0" :class="ev.action === 'denied' ? 'text-destructive' : 'text-muted-foreground'" />
              <div class="flex min-w-0 flex-col">
                <span class="truncate text-sm">
                  <span class="font-medium">{{ ev.actor_name || 'Someone' }}</span>
                  · {{ ACTION_LABELS[ev.action] }}
                </span>
                <span v-if="!docMode" class="flex items-center gap-1 truncate text-xs text-muted-foreground">
                  <FileText class="size-3 shrink-0" /> {{ ev.document_name || ev.document || '—' }}
                </span>
                <span class="text-xs text-muted-foreground">
                  {{ whenLabel(ev.created) }}<template v-if="ev.reason"> · {{ ev.reason }}</template>
                </span>
              </div>
            </li>
          </ul>
        </TabsContent>
      </Tabs>
    </SheetContent>
  </Sheet>
</template>
