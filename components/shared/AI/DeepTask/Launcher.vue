<script lang="ts" setup>
import {
  Sparkles, Loader2, Paperclip, AtSign, X, FileText, Image as ImageIcon,
  Building2, Library, Check,
} from 'lucide-vue-next';
import { toast } from 'vue-sonner';
import {
  createDeepTask, type DeepTaskScope, type DeepAttachment,
} from '~/services/deepTask';
import { getMatters } from '~/services/matters';
import { listVaults } from '~/services/vault';

// Compose-and-launch panel for a deep-research task. Built from the same
// InputGroup primitives as the chat composer (components/shared/AI/Chat.vue) so
// the two stay visually consistent: Add Context in the block-start addon, attach
// + launch in the block-end. Attaches files and pins context — the two things a
// deep sweep most benefits from. Emits `started` with the new task id so the host
// can show its live card.
//
// Attachments ride to the backend as base64 (PDFs/images) or raw text (Markdown/
// plain) and become primary source material for the gather phase. Context pins
// matters + custom vaults into the task scope so the sweep is focused. When a
// scope prop is supplied (e.g. from a matter page) it seeds the pinned context.
const props = defineProps<{
  conversationId?: string;
  scope?: DeepTaskScope;
}>();
const emit = defineEmits<{ (e: 'started', taskId: string): void }>();

const instruction = ref('');
const starting = ref(false);

// ── Attachments ───────────────────────────────────────────────────────────────
interface Attachment {
  id: string;
  name: string;
  mime: string;
  size: number;
  kind: 'binary' | 'text';
  base64?: string;
  text?: string;
}
const attachments = ref<Attachment[]>([]);
const fileInput = ref<HTMLInputElement | null>(null);

const MAX_FILE_BYTES = 10 * 1024 * 1024;   // 10MB per file
const MAX_TOTAL_BYTES = 25 * 1024 * 1024;  // 25MB raw across all files

const totalAttachmentBytes = computed(() =>
  attachments.value.reduce((sum, a) => sum + a.size, 0),
);

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result ?? '');
      const comma = dataUrl.indexOf(',');
      resolve(comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl);
    };
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const TEXT_EXTENSIONS = ['.md', '.markdown', '.txt', '.text', '.csv', '.json', '.log', '.rtf'];
function isTextFile(file: File): boolean {
  const name = file.name.toLowerCase();
  if (TEXT_EXTENSIONS.some(ext => name.endsWith(ext))) return true;
  const t = file.type;
  return t.startsWith('text/') || t === 'application/json' || t === 'application/markdown';
}
function isAcceptedFile(file: File): boolean {
  return file.type === 'application/pdf'
    || ACCEPTED_IMAGE_TYPES.includes(file.type)
    || isTextFile(file);
}

async function addFiles(files: File[] | FileList) {
  for (const file of Array.from(files)) {
    if (!isAcceptedFile(file)) {
      toast('Unsupported file', { description: `${file.name} — PDFs, images, and text/Markdown only.` });
      continue;
    }
    if (file.size > MAX_FILE_BYTES) {
      toast('File too large', { description: `${file.name} is ${formatBytes(file.size)}. Each file must be under ${formatBytes(MAX_FILE_BYTES)}.` });
      continue;
    }
    if (totalAttachmentBytes.value + file.size > MAX_TOTAL_BYTES) {
      toast('Attachment limit reached', { description: `Total attachment size must stay under ${formatBytes(MAX_TOTAL_BYTES)}.` });
      break;
    }
    const id = crypto.randomUUID();
    try {
      if (isTextFile(file)) {
        const text = await file.text();
        attachments.value.push({ id, name: file.name, mime: file.type || 'text/markdown', size: file.size, kind: 'text', text });
      } else {
        const base64 = await fileToBase64(file);
        attachments.value.push({ id, name: file.name, mime: file.type, size: file.size, kind: 'binary', base64 });
      }
    } catch (err: any) {
      toast('Could not read file', { description: file.name + (err?.message ? ` — ${err.message}` : '') });
    }
  }
}

async function onFilesChosen(e: Event) {
  const input = e.target as HTMLInputElement;
  if (!input.files?.length) return;
  await addFiles(input.files);
  input.value = ''; // allow re-selecting the same file after removal
}

function removeAttachment(id: string) {
  attachments.value = attachments.value.filter(a => a.id !== id);
}

function openFilePicker() {
  fileInput.value?.click();
}

// ── Context (matters + vaults) ──────────────────────────────────────────────────
type CtxKind = 'matter' | 'vault';
interface CtxItem { kind: CtxKind; id: string; label: string; sublabel?: string }

const pinned = ref<CtxItem[]>([]);
const contextOpen = ref(false);
const contextLoading = ref(false);
const contextSearch = ref('');
const mattersList = ref<CtxItem[]>([]);
const vaultsList = ref<CtxItem[]>([]);
let contextLoaded = false;

watch(contextOpen, async (open) => {
  if (!open) { contextSearch.value = ''; return; }
  if (contextLoaded) return;
  contextLoading.value = true;
  try {
    const [matters, vaults] = await Promise.all([
      getMatters(1, 100, { sort: '-created' }).catch(() => ({ items: [] as any[] })),
      listVaults().catch(() => []),
    ]);
    mattersList.value = (matters.items ?? []).map((m: any) => ({
      kind: 'matter' as const, id: m.id, label: m.name || 'Matter', sublabel: m.caseNumber,
    }));
    vaultsList.value = (vaults ?? []).map((v: any) => ({
      kind: 'vault' as const, id: v.id, label: v.name || 'Vault',
      sublabel: v.visibility === 'shared' ? 'Shared' : 'Personal',
    }));
    contextLoaded = true;
  } finally {
    contextLoading.value = false;
  }
});

const q = computed(() => contextSearch.value.trim().toLowerCase());
function match(items: CtxItem[]) {
  if (!q.value) return items;
  return items.filter(i =>
    i.label.toLowerCase().includes(q.value) || i.sublabel?.toLowerCase().includes(q.value));
}
const filteredMatters = computed(() => match(mattersList.value));
const filteredVaults = computed(() => match(vaultsList.value));

function isPinned(id: string) {
  return pinned.value.some(i => i.id === id);
}
function togglePin(item: CtxItem) {
  const idx = pinned.value.findIndex(i => i.id === item.id);
  if (idx >= 0) pinned.value.splice(idx, 1);
  else pinned.value.push(item);
}
function unpin(id: string) {
  pinned.value = pinned.value.filter(i => i.id !== id);
}

// Seed pinned context from a supplied scope prop (e.g. launched from a matter).
watch(() => props.scope, (s) => {
  if (!s) return;
  for (const id of s.matterIds ?? []) {
    if (!isPinned(id)) pinned.value.push({ kind: 'matter', id, label: 'Matter' });
  }
  for (const id of s.vaultIds ?? []) {
    if (!isPinned(id)) pinned.value.push({ kind: 'vault', id, label: 'Vault' });
  }
}, { immediate: true });

function buildScope(): DeepTaskScope | undefined {
  const matterIds = pinned.value.filter(i => i.kind === 'matter').map(i => i.id);
  const vaultIds = pinned.value.filter(i => i.kind === 'vault').map(i => i.id);
  const memoryScopes = props.scope?.memoryScopes;
  if (!matterIds.length && !vaultIds.length && !memoryScopes?.length) return undefined;
  return { matterIds, vaultIds, memoryScopes };
}

// ── Launch ───────────────────────────────────────────────────────────────────
const canStart = computed(() => !starting.value && instruction.value.trim().length > 0);

async function start() {
  if (!canStart.value) return;
  starting.value = true;
  try {
    const task = await createDeepTask({
      instruction: instruction.value.trim(),
      conversationId: props.conversationId,
      scope: buildScope(),
      attachments: attachments.value.map<DeepAttachment>(a => ({
        name: a.name, mime: a.mime, kind: a.kind, base64: a.base64, text: a.text,
      })),
    });
    instruction.value = '';
    attachments.value = [];
    emit('started', task.id);
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Could not start the task');
  } finally {
    starting.value = false;
  }
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
    e.preventDefault();
    start();
  }
}
</script>

<template>
  <div class="space-y-2">
    <div class="flex items-center gap-2">
      <Sparkles class="size-4" />
      <h3 class="text-sm font-medium">Deep research &amp; compile</h3>
    </div>
    <p class="text-sm text-muted-foreground">
      Hand off a big task — researching across your memories, vaults and matters (and any files you attach) and
      compiling a document. It runs in the background; you'll review the outline before it writes.
    </p>

    <!-- Composer — uses the same InputGroup primitives as the chat composer
         (components/shared/AI/Chat.vue) so the two stay visually consistent:
         Add Context in the block-start addon, attach + launch in the block-end. -->
    <div class="space-y-2" :class="starting ? 'opacity-60 pointer-events-none' : ''">
      <!-- Pinned context + attachment chips -->
      <div v-if="pinned.length || attachments.length" class="flex flex-wrap gap-1.5">
        <Badge
          v-for="item in pinned"
          :key="'ctx-' + item.id"
          variant="secondary"
          class="gap-1 pl-1.5 pr-1"
        >
          <component :is="item.kind === 'matter' ? Building2 : Library" class="size-3 shrink-0" />
          <span class="max-w-[12rem] truncate">{{ item.label }}</span>
          <button class="rounded-sm p-0.5 hover:bg-foreground/10" @click="unpin(item.id)">
            <X class="size-3" />
          </button>
        </Badge>

        <Badge
          v-for="a in attachments"
          :key="'att-' + a.id"
          variant="outline"
          class="gap-1 pl-1.5 pr-1"
        >
          <component :is="a.kind === 'binary' && a.mime.startsWith('image/') ? ImageIcon : FileText" class="size-3 shrink-0" />
          <span class="max-w-[12rem] truncate">{{ a.name }}</span>
          <span class="text-muted-foreground">{{ formatBytes(a.size) }}</span>
          <button class="rounded-sm p-0.5 hover:bg-foreground/10" @click="removeAttachment(a.id)">
            <X class="size-3" />
          </button>
        </Badge>
      </div>

      <InputGroup>
        <InputGroupAddon align="block-start">
          <Popover v-model:open="contextOpen">
            <PopoverTrigger as-child>
              <Button
                size="sm"
                variant="outline"
                :class="pinned.length ? 'border-primary/50 text-primary' : ''"
                :disabled="starting"
              >
                <AtSign class="size-4" />
                Add Context
                <Badge v-if="pinned.length" variant="secondary" class="ml-1 text-xs px-1">
                  {{ pinned.length }}
                </Badge>
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" class="w-80 p-0">
              <Command>
                <CommandInput v-model="contextSearch" placeholder="Search matters and vaults…" />
                <CommandList>
                  <div v-if="contextLoading" class="flex items-center gap-2 p-4 text-sm text-muted-foreground">
                    <Loader2 class="size-4 animate-spin" /> Loading…
                  </div>
                  <template v-else>
                    <CommandEmpty>No matches.</CommandEmpty>
                    <CommandGroup v-if="filteredMatters.length" heading="Matters">
                      <CommandItem
                        v-for="m in filteredMatters"
                        :key="m.id"
                        :value="'matter:' + m.id"
                        class="gap-2"
                        @select="togglePin(m)"
                      >
                        <Building2 class="size-4 shrink-0 text-muted-foreground" />
                        <div class="flex min-w-0 flex-col">
                          <span class="truncate">{{ m.label }}</span>
                          <span v-if="m.sublabel" class="truncate text-xs text-muted-foreground">{{ m.sublabel }}</span>
                        </div>
                        <Check v-if="isPinned(m.id)" class="ml-auto size-4 text-primary" />
                      </CommandItem>
                    </CommandGroup>
                    <CommandGroup v-if="filteredVaults.length" heading="Vaults">
                      <CommandItem
                        v-for="v in filteredVaults"
                        :key="v.id"
                        :value="'vault:' + v.id"
                        class="gap-2"
                        @select="togglePin(v)"
                      >
                        <Library class="size-4 shrink-0 text-muted-foreground" />
                        <div class="flex min-w-0 flex-col">
                          <span class="truncate">{{ v.label }}</span>
                          <span v-if="v.sublabel" class="truncate text-xs text-muted-foreground">{{ v.sublabel }}</span>
                        </div>
                        <Check v-if="isPinned(v.id)" class="ml-auto size-4 text-primary" />
                      </CommandItem>
                    </CommandGroup>
                  </template>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </InputGroupAddon>

        <InputGroupTextarea
          v-model="instruction"
          :disabled="starting"
          placeholder="e.g. Research everything in my Acme dispute vault and compile a litigation strategy memo."
          @keydown="onKeydown"
        />

        <InputGroupAddon align="block-end">
          <InputGroupButton
            variant="outline"
            size="icon-sm"
            :disabled="starting"
            title="Attach a PDF, image or text file"
            @click="openFilePicker"
          >
            <Paperclip class="size-4" />
            <span class="sr-only">Attach files</span>
          </InputGroupButton>

          <Separator orientation="vertical" class="!h-4 ml-auto" />

          <InputGroupButton
            variant="default"
            size="sm"
            class="rounded-full"
            :disabled="!canStart"
            @click="start"
          >
            <Loader2 v-if="starting" class="size-4 animate-spin" />
            <Sparkles v-else class="size-4" />
            Start deep research
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </div>

    <input
      ref="fileInput"
      type="file"
      multiple
      accept="application/pdf,image/jpeg,image/png,image/webp,image/gif,text/*,.md,.markdown,.txt,.csv,.json,.log,.rtf"
      class="hidden"
      @change="onFilesChosen"
    >
  </div>
</template>
