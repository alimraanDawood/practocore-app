<script setup lang="ts">
import { Briefcase, Check, Loader2, Scale } from 'lucide-vue-next';
import { toast } from 'vue-sonner';
import { updateMilestoneStatus, type EngagementMilestone } from '~/services/engagements';

const props = defineProps<{ milestone: EngagementMilestone }>();
const emit = defineEmits<{ (e: 'changed'): void }>();

const busy = ref(false);
const isDone = computed(() => props.milestone.status === 'done');
// L4: a milestone hangs off an engagement OR a litigation matter. Reduced to one
// shape here so the card renders and links the same either way, with only the icon
// distinguishing the two.
const parent = computed(() => {
  const matter = props.milestone.expand?.matter;
  if (matter) return { kind: 'matter' as const, id: matter.id, name: matter.name };
  const eng = props.milestone.expand?.engagement;
  if (eng) return { kind: 'engagement' as const, id: eng.id, name: eng.name };
  return null;
});

async function toggleDone() {
  if (busy.value || isDone.value) return;
  busy.value = true;
  try {
    await updateMilestoneStatus(props.milestone.id, 'done');
    toast.success('Milestone completed');
    emit('changed');
  } catch (e: any) {
    toast.error(e?.message || 'Failed to update');
  } finally {
    busy.value = false;
  }
}

function openParent() {
  const p = parent.value;
  if (!p?.id) return;
  navigateTo(p.kind === 'matter' ? `/main/matters/matter/${p.id}` : `/main/engagements/${p.id}`);
}
</script>

<template>
  <div class="flex flex-col gap-2 p-3 border rounded-lg bg-background" :class="{ 'opacity-60': isDone }">
    <div class="flex flex-row items-start gap-2">
      <button
        type="button"
        :disabled="busy || isDone"
        class="mt-0.5 size-4 shrink-0 rounded-full border grid place-items-center transition-colors"
        :class="isDone ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground/40 hover:border-primary'"
        :aria-label="isDone ? 'Completed' : 'Mark milestone done'"
        @click.stop="toggleDone"
      >
        <Loader2 v-if="busy" class="size-3 animate-spin" />
        <Check v-else-if="isDone" class="size-3" />
      </button>

      <div class="flex flex-col flex-1 min-w-0">
        <p class="text-sm font-medium truncate" :class="{ 'line-through': isDone }">{{ milestone.label }}</p>
        <button
          v-if="parent"
          type="button"
          class="flex flex-row items-center gap-1.5 mt-1 text-xs text-muted-foreground hover:text-foreground w-fit"
          @click.stop="openParent"
        >
          <Scale v-if="parent.kind === 'matter'" class="size-3 shrink-0" />
          <Briefcase v-else class="size-3 shrink-0" />
          <span class="truncate">{{ parent.name }}</span>
        </button>
      </div>
    </div>
  </div>
</template>
