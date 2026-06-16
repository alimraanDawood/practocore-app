<script lang="ts" setup>
import { Building2, Briefcase, ChevronRight, Loader2, Search } from 'lucide-vue-next';
import type { VaultScope } from '~/services/vault';

// The top-level library chooser: a "Firm Library" (org scope) plus a card per
// matter the user can access (matter scope). Selecting one emits the library so
// the parent can mount <SharedVaultBrowser> for it. Shared by the standalone
// page and the assistant panel. The matter list is shared with the global
// sidebar via useVaultLibraries().
const emit = defineEmits<{ select: [lib: { scope: VaultScope; scopeId: string; label: string }] }>();

const { matters, loading, orgId, refresh } = useVaultLibraries();
const query = ref('');

onMounted(() => { refresh(); });

interface MatterLite { id: string; name?: string; caseNumber?: string }

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return matters.value;
  return matters.value.filter((m) =>
    (m.name || '').toLowerCase().includes(q) || (m.caseNumber || '').toLowerCase().includes(q));
});

function pickFirm() {
  if (orgId.value) emit('select', { scope: 'org', scopeId: orgId.value, label: 'Firm Library' });
}
function pickMatter(m: MatterLite) {
  emit('select', { scope: 'matter', scopeId: m.id, label: m.name || 'Matter' });
}
</script>

<template>
  <div class="flex flex-col gap-5">
    <!-- Firm library -->
    <div v-if="orgId">
      <p class="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Firm</p>
      <button
        class="group flex w-full items-center gap-3 rounded-xl border p-4 text-left transition-colors hover:border-primary/40 hover:bg-accent/40"
        @click="pickFirm">
        <div class="grid size-11 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          <Building2 class="size-5" />
        </div>
        <div class="flex min-w-0 flex-1 flex-col">
          <span class="text-sm font-semibold">Firm Library</span>
          <span class="text-xs text-muted-foreground">Precedents and firm-wide knowledge shared across matters</span>
        </div>
        <ChevronRight class="size-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
      </button>
    </div>

    <!-- Matters -->
    <div>
      <div class="mb-2 flex items-center justify-between gap-2">
        <p class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Case files</p>
        <div v-if="matters.length > 6" class="relative w-48">
          <Search class="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input v-model="query" placeholder="Search matters" class="h-8 pl-7 text-xs" />
        </div>
      </div>

      <div v-if="loading" class="grid gap-2 sm:grid-cols-2">
        <Skeleton v-for="i in 4" :key="i" class="h-16 rounded-xl" />
      </div>

      <div v-else-if="filtered.length" class="grid gap-2 sm:grid-cols-2">
        <button v-for="m in filtered" :key="m.id"
          class="group flex items-center gap-3 rounded-xl border p-3 text-left transition-colors hover:border-primary/40 hover:bg-accent/40"
          @click="pickMatter(m)">
          <div class="grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
            <Briefcase class="size-4" />
          </div>
          <div class="flex min-w-0 flex-1 flex-col">
            <span class="truncate text-sm font-medium">{{ m.name || 'Matter' }}</span>
            <span v-if="m.caseNumber" class="truncate text-xs text-muted-foreground">{{ m.caseNumber }}</span>
          </div>
          <ChevronRight class="size-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>

      <p v-else class="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
        No matters yet. Case files you add to a matter will appear here.
      </p>
    </div>
  </div>
</template>
