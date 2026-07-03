<script setup lang="ts">
// The unified "New work" entry point: one affordance that forks into the two
// matter systems — a litigation Matter (court case → deadlines) or an Engagement
// (advisory/transactional/regulatory → stages & milestones). Keeps users from
// having to know which of the two systems their work belongs to before starting.
import { FilePlus2, Scale, Briefcase, ChevronRight } from 'lucide-vue-next';
import { usePermissions } from '~/composables/usePermissions';

const router = useRouter();
const route = useRoute();
const { hasPermission } = usePermissions();

const open = ref(false);

// Litigation creation is permission-gated (mirrors the Matters index); the create
// page enforces it too, but we reflect it here so the option reads as unavailable.
const canCreateMatter = computed(() => hasPermission('canCreateMatters'));

function startLitigation() {
  if (!canCreateMatter.value) return;
  open.value = false;
  router.push(`/main/matters/create?next=${encodeURIComponent(route.fullPath)}`);
}

function startEngagement() {
  open.value = false;
  // The engagements index opens its create dialog when it sees `?new=1`.
  router.push('/main/engagements?new=1');
}
</script>

<template>
  <SidebarMenuItem>
    <SidebarMenuButton class="border" tooltip="New work" @click="open = true">
      <FilePlus2 />
      <span>New work</span>
    </SidebarMenuButton>
  </SidebarMenuItem>

  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Start new work</DialogTitle>
        <DialogDescription>What kind of work are you opening for your client?</DialogDescription>
      </DialogHeader>

      <div class="flex flex-col gap-3 py-1">
        <!-- Litigation -->
        <button
          type="button"
          :disabled="!canCreateMatter"
          class="group flex items-start gap-3 rounded-lg border p-4 text-left transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
          @click="startLitigation"
        >
          <div class="grid size-10 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
            <Scale class="size-5" />
          </div>
          <div class="flex-1 min-w-0">
            <p class="font-semibold">Litigation matter</p>
            <p class="text-sm text-muted-foreground">
              A court case. Pick a procedure and a trigger date; PractoCore computes the deadline timeline.
            </p>
            <p v-if="!canCreateMatter" class="text-xs text-destructive mt-1">
              You don't have permission to create matters.
            </p>
          </div>
          <ChevronRight class="size-4 shrink-0 mt-1 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>

        <!-- Engagement -->
        <button
          type="button"
          class="group flex items-start gap-3 rounded-lg border p-4 text-left transition-colors hover:bg-muted"
          @click="startEngagement"
        >
          <div class="grid size-10 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
            <Briefcase class="size-5" />
          </div>
          <div class="flex-1 min-w-0">
            <p class="font-semibold flex items-center gap-2">
              Engagement
              <Badge variant="secondary" class="text-[10px] uppercase tracking-wide">Beta</Badge>
            </p>
            <p class="text-sm text-muted-foreground">
              Anything that isn't a court case — advisory, transactional, regulatory. Runs on stages, milestones
              and recurring compliance.
            </p>
          </div>
          <ChevronRight class="size-4 shrink-0 mt-1 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
      </div>
    </DialogContent>
  </Dialog>
</template>
