<script lang="ts" setup>
import { Workflow, Briefcase, Lock, Loader2, Inbox, ChevronRight } from 'lucide-vue-next';
import { listEngagements, type Engagement } from '~/services/engagements';
import { getSignedInUser } from '~/services/auth';
import { listVaults, type Vault, type VaultScope } from '~/services/vault';

// The mobile home's "My vaults" / "Engagements" / "Matters" storage rows drill into
// this: a plain list of that one library kind, in the same card idiom as the home.
// The desktop's LibraryRail shows every group at once, which is right for a
// persistent column and wrong for a phone screen you navigate one level at a time.
const props = defineProps<{ kind: 'vaults' | 'engagements' | 'matters' }>();
const emit = defineEmits<{
  select: [lib: { scope: VaultScope; scopeId: string; label: string }];
}>();

const { matters, loading: mattersLoading, refresh } = useVaultLibraries();

const engagements = ref<Engagement[]>([]);
const vaults = ref<Vault[]>([]);
const fetching = ref(props.kind !== 'matters');

onMounted(async () => {
  if (props.kind === 'matters') { refresh(); return; }
  try {
    if (props.kind === 'vaults') {
      vaults.value = await listVaults();
    } else {
      const uid = getSignedInUser()?.id;
      const filter = uid ? `owner = "${uid}" || members ~ "${uid}"` : undefined;
      const res = await listEngagements(1, 100, { filter, sort: '-updated' });
      engagements.value = res?.items ?? [];
    }
  } catch {
    /* listing fails silently — the list just stays empty */
  } finally {
    fetching.value = false;
  }
});

const loading = computed(() =>
  (props.kind === 'matters' ? mattersLoading.value : fetching.value));

const rows = computed(() => {
  if (props.kind === 'vaults') {
    return vaults.value.map((v) => ({ id: v.id, label: v.name, sub: v.description || '' }));
  }
  if (props.kind === 'engagements') {
    return engagements.value.map((e) => ({
      id: e.id, label: e.name || 'Engagement', sub: e.expand?.template?.name || '',
    }));
  }
  return matters.value.map((m) => ({
    id: m.id, label: m.name || 'Matter', sub: m.caseNumber || '',
  }));
});

const EMPTY: Record<string, string> = {
  vaults: 'No vaults yet. Create one on a larger screen.',
  engagements: 'No engagements yet.',
  matters: 'No case files yet.',
};

const icon = computed(() =>
  (props.kind === 'vaults' ? Lock : props.kind === 'engagements' ? Workflow : Briefcase));
const scope = computed<VaultScope>(() =>
  (props.kind === 'vaults' ? 'vault' : props.kind === 'engagements' ? 'engagement' : 'matter'));
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col overflow-y-auto bg-muted/40">
    <div v-if="loading" class="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
      <Loader2 class="size-4 animate-spin" /> Loading…
    </div>

    <div v-else-if="!rows.length" class="flex flex-col items-center gap-2 p-10 text-center">
      <Inbox class="size-6 text-muted-foreground" />
      <p class="text-sm text-muted-foreground">{{ EMPTY[kind] }}</p>
    </div>

    <div v-else class="p-3">
      <div class="divide-y overflow-hidden rounded-2xl bg-card">
        <button
          v-for="r in rows" :key="r.id"
          class="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors active:bg-accent"
          @click="emit('select', { scope, scopeId: r.id, label: r.label })">
          <component :is="icon" class="size-5 shrink-0 text-muted-foreground" :stroke-width="1.5" />
          <span class="min-w-0 flex-1">
            <span class="block truncate text-sm">{{ r.label }}</span>
            <span v-if="r.sub" class="mt-0.5 block truncate text-xs text-muted-foreground">{{ r.sub }}</span>
          </span>
          <ChevronRight class="size-4 shrink-0 text-muted-foreground/60" />
        </button>
      </div>
    </div>
  </div>
</template>
