<script lang="ts" setup>
import {
  Clock, Image as ImageIcon, FileText, Music, Building2, Lock, Briefcase,
  Trash2, PieChart, ChevronRight, Loader2, Scale,
} from 'lucide-vue-next';
import {
  listRecentDocuments, countDocuments, countTrashedDocuments,
  type VaultDocument, type VaultScope,
} from '~/services/vault';
import { listEngagements } from '~/services/engagements';
import { listVaults } from '~/services/vault';
import { getSignedInUser } from '~/services/auth';

// The phone-sized vault home. Deliberately NOT the desktop workspace shrunk down:
// the desktop leads with the library tree (rail + browser), which on a phone
// collapsed into an empty "Choose a library" panel. This is the file-manager home
// pattern instead — recents, then categories, then the libraries as "storage
// volumes", then bin/analysis — so the first screen always has content on it.
// Rendered only below `lg`; Workspace.vue keeps the two-column desktop UI intact.
export type MobileView =
  | 'recents' | 'images' | 'documents' | 'audio'
  | 'vaults' | 'engagements' | 'matters' | 'trash';

const emit = defineEmits<{
  /** Open one of the flat mobile views (recents / a category / bin / a picker). */
  view: [view: MobileView];
  /** Jump straight into a library browser (firm / personal). */
  select: [lib: { scope: VaultScope; scopeId: string; label: string }];
}>();

const { matters, orgId, personalLibrary, refresh } = useVaultLibraries();

// ── Counts + recents ────────────────────────────────────────────────────────
const loading = ref(true);
const recent = ref<VaultDocument[]>([]);
const counts = reactive({ top: 0, vaults: 0, engagements: 0, trash: 0 });

onMounted(async () => {
  refresh();
  try {
    const uid = getSignedInUser()?.id;
    const engFilter = uid ? `owner = "${uid}" || members ~ "${uid}"` : undefined;
    const [docs, topCount, trashCount, engs, vaultList] = await Promise.all([
      listRecentDocuments(3).catch(() => []),
      countDocuments(topScopeFilter()).catch(() => 0),
      countTrashedDocuments().catch(() => 0),
      listEngagements(1, 1, { filter: engFilter }).catch(() => null),
      listVaults().catch(() => []),
    ]);
    recent.value = docs;
    counts.top = topCount;
    counts.trash = trashCount;
    counts.engagements = engs?.totalItems ?? 0;
    counts.vaults = vaultList.length;
  } finally {
    loading.value = false;
  }
});

/** The firm library for a firm account, the personal library for a solo one. */
function topScopeFilter(): string {
  const uid = getSignedInUser()?.id;
  return orgId.value
    ? `scope = "org" && scope_id = "${orgId.value}"`
    : `scope = "user" && scope_id = "${uid || ''}"`;
}
const topLabel = computed(() => (orgId.value ? 'Firm documents' : 'Personal documents'));

function openTop() {
  if (orgId.value) return emit('select', { scope: 'org', scopeId: orgId.value, label: 'Firm Library' });
  const lib = personalLibrary.value;
  if (lib) emit('select', lib);
}

const categories = [
  { id: 'images' as const, label: 'Images', icon: ImageIcon, tone: 'text-rose-500' },
  { id: 'documents' as const, label: 'Documents', icon: FileText, tone: 'text-amber-500' },
  { id: 'audio' as const, label: 'Audio files', icon: Music, tone: 'text-sky-500' },
];

// A quiet reassurance under the Recent files row rather than a full list: the row
// is a destination, and three filenames would push Categories off the first screen.
const recentSummary = computed(() => {
  if (loading.value) return '';
  if (!recent.value.length) return 'Nothing uploaded yet';
  const names = recent.value.map((d) => d.filename || 'Untitled').join(' · ');
  return names;
});

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col bg-muted/30 overflow-y-auto">
    <div class="flex flex-col gap-5 p-3 pb-10">
      <!-- Recent files -->
      <button
        class="flex w-full items-center border gap-4 rounded-lg bg-background px-4 py-4 text-left transition-colors active:bg-accent"
        @click="emit('view', 'recents')">
        <Clock class="size-6 shrink-0 text-muted-foreground" />
        <span class="min-w-0 flex-1">
          <span class="block text-base font-medium">Recent files</span>
          <span v-if="recentSummary" class="mt-0.5 block truncate text-xs text-muted-foreground">
            {{ recentSummary }}
          </span>
        </span>
        <ChevronRight class="size-4 shrink-0 text-muted-foreground/60" />
      </button>

      <!-- Categories -->
      <section class="flex flex-col gap-2">
        <h2 class="px-1 text-sm font-medium text-muted-foreground">Categories</h2>
        <div class="grid grid-cols-3 rounded-2xl bg-card py-4 border">
          <button
            v-for="c in categories" :key="c.id"
            class="flex flex-col items-center gap-2 rounded-xl px-1 py-2 transition-colors active:bg-accent"
            @click="emit('view', c.id)">
            <component :is="c.icon" class="size-10 rounded-lg borer p-2 bg-muted text-muted-foreground" :stroke-width="1.5" />
            <span class="text-xs">{{ c.label }}</span>
          </button>
        </div>
      </section>

      <!-- Storage: the libraries, as a file manager lists its volumes -->
      <section class="flex flex-col gap-2">
        <h2 class="px-1 text-sm font-medium text-muted-foreground">Libraries</h2>
        <div class="bg-card border rounded-lg">
          <button
            class="flex w-full items-center gap-4 rounded-t-2xl px-4 py-3.5 text-left transition-colors active:bg-accent"
            @click="openTop">
            <Building2 class="size-10 shrink-0 text-muted-foreground p-2 bg-muted rounded-lg" :stroke-width="1.5" />
            <span class="min-w-0 flex-1">
              <span class="block truncate text-base">{{ topLabel }}</span>
              <span class="mt-0.5 block text-xs text-muted-foreground">
                <Loader2 v-if="loading" class="inline size-3 animate-spin" />
                <template v-else>{{ plural(counts.top, 'document') }}</template>
              </span>
            </span>
            <ChevronRight class="size-4 shrink-0 text-muted-foreground/60" />
          </button>

          <div class="mx-4 border-t" />

          <!-- Custom vaults live only in the desktop rail otherwise, so the phone
               would lose them entirely without this row. -->
          <button
            class="flex w-full items-center gap-4 px-4 py-3.5 text-left transition-colors active:bg-accent"
            @click="emit('view', 'vaults')">
            <Lock class="size-10 shrink-0 text-muted-foreground p-2 bg-muted rounded-lg" :stroke-width="1.5" />
            <span class="min-w-0 flex-1">
              <span class="block truncate text-base">My vaults</span>
              <span class="mt-0.5 block text-xs text-muted-foreground">
                <Loader2 v-if="loading" class="inline size-3 animate-spin" />
                <template v-else-if="counts.vaults">{{ plural(counts.vaults, 'vault') }}</template>
                <template v-else>None yet</template>
              </span>
            </span>
            <ChevronRight class="size-4 shrink-0 text-muted-foreground/60" />
          </button>

          <div class="mx-4 border-t" />

          <button
            class="flex w-full items-center gap-4 px-4 py-3.5 text-left transition-colors active:bg-accent"
            @click="emit('view', 'engagements')">
            <Briefcase class="size-10 shrink-0 text-muted-foreground p-2 bg-muted rounded-lg" :stroke-width="1.5" />
            <span class="min-w-0 flex-1">
              <span class="block truncate text-base">Engagements</span>
              <span class="mt-0.5 block text-xs text-muted-foreground">
                <Loader2 v-if="loading" class="inline size-3 animate-spin" />
                <template v-else-if="counts.engagements">{{ plural(counts.engagements, 'engagement') }}</template>
                <template v-else>None yet</template>
              </span>
            </span>
            <ChevronRight class="size-4 shrink-0 text-muted-foreground/60" />
          </button>

          <div class="mx-4 border-t" />

          <button
            class="flex w-full items-center gap-4 rounded-b-2xl px-4 py-3.5 text-left transition-colors active:bg-accent"
            @click="emit('view', 'matters')">
            <Scale class="size-10 shrink-0 text-muted-foreground p-2 bg-muted rounded-lg" :stroke-width="1.5" />
            <span class="min-w-0 flex-1">
              <span class="block truncate text-base">Matters</span>
              <span class="mt-0.5 block text-xs text-muted-foreground">
                <template v-if="matters.length">{{ plural(matters.length, 'case file') }}</template>
                <template v-else>None yet</template>
              </span>
            </span>
            <ChevronRight class="size-4 shrink-0 text-muted-foreground/60" />
          </button>
        </div>
      </section>

      <!-- Bin + analysis -->
      <div class="rounded-2xl bg-card shadow-sm">
        <button
          class="flex w-full items-center gap-4 rounded-t-2xl px-4 py-3.5 text-left transition-colors active:bg-accent"
          @click="emit('view', 'trash')">
          <Trash2 class="size-6 shrink-0 text-muted-foreground" :stroke-width="1.5" />
          <span class="min-w-0 flex-1 text-base">Recycle bin</span>
          <span v-if="counts.trash" class="shrink-0 text-xs text-muted-foreground">{{ counts.trash }}</span>
          <ChevronRight class="size-4 shrink-0 text-muted-foreground/60" />
        </button>

        <div class="mx-4 border-t" />

        <!-- Staged: the document rows carry no byte size (AiVaultDocuments stores
             the file, not its length), so a real storage breakdown needs a backend
             field before this can say anything true. -->
        <div class="flex w-full items-center gap-4 rounded-b-2xl px-4 py-3.5 text-left opacity-50">
          <PieChart class="size-6 shrink-0 text-muted-foreground" :stroke-width="1.5" />
          <span class="min-w-0 flex-1 text-base">Analyse storage</span>
          <span class="shrink-0 text-xs text-muted-foreground">Coming soon</span>
        </div>
      </div>
    </div>
  </div>
</template>
