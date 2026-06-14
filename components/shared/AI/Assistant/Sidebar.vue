<script lang="ts" setup>
import {
  ChevronsUpDown, Plus, MessageSquareText, FolderLock, Workflow,
  History, Library, LifeBuoy, Settings, type LucideIcon,
} from 'lucide-vue-next';

// Harvey-style left rail for the assistant page: workspace switcher, client-matter
// picker, Create action, primary nav, and Settings/Help pinned to the bottom.
// Presentational — emits the chosen nav key via v-model:active and `create`.

export interface NavItem {
  key: string;
  label: string;
  icon: LucideIcon;
}

const props = withDefaults(defineProps<{
  workspace?: string;
  matters?: { id: string; label: string }[];
}>(), {
  workspace: 'PractoCore AI',
  matters: () => [],
});

const active = defineModel<string>('active', { default: 'assistant' });
const matterId = defineModel<string>('matterId');

const emit = defineEmits<{ create: []; navigate: [key: string] }>();

const nav: NavItem[] = [
  { key: 'assistant', label: 'Assistant', icon: MessageSquareText },
  { key: 'vault', label: 'Vault', icon: FolderLock },
  { key: 'workflows', label: 'Workflows', icon: Workflow },
  { key: 'history', label: 'History', icon: History },
  { key: 'library', label: 'Library', icon: Library },
  { key: 'guidance', label: 'Guidance', icon: LifeBuoy },
];

const bottom: NavItem[] = [
  { key: 'settings', label: 'Settings', icon: Settings },
  { key: 'help', label: 'Help', icon: LifeBuoy },
];

function go(key: string) {
  active.value = key;
  emit('navigate', key);
}
</script>

<template>
  <aside class="flex h-full w-60 shrink-0 flex-col gap-3 border-r bg-background p-3">
    <!-- Workspace switcher -->
    <DropdownMenu>
      <DropdownMenuTrigger as-child>
        <Button variant="ghost" class="h-auto w-full justify-start gap-2 px-2 py-2">
          <div class="grid size-7 shrink-0 place-items-center rounded-md bg-foreground text-xs font-bold text-background">
            {{ workspace.charAt(0) }}
          </div>
          <span class="flex-1 truncate text-left text-sm font-semibold">{{ workspace }}</span>
          <ChevronsUpDown class="size-3.5 shrink-0 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent class="w-[13.5rem]" align="start">
        <DropdownMenuLabel class="text-xs text-muted-foreground">Workspace</DropdownMenuLabel>
        <DropdownMenuItem>{{ workspace }}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>

    <!-- Client matter picker -->
    <div class="flex flex-col gap-1.5">
      <span class="px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Client matter</span>
      <Select v-model="matterId">
        <SelectTrigger class="h-9 w-full text-sm">
          <SelectValue placeholder="Select a matter…" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem v-for="m in matters" :key="m.id" :value="m.id">{{ m.label }}</SelectItem>
        </SelectContent>
      </Select>
    </div>

    <!-- Create -->
    <Button variant="outline" class="w-full gap-2" @click="emit('create')">
      <Plus class="size-4" />
      Create
    </Button>

    <Separator class="my-1" />

    <!-- Primary nav -->
    <nav class="flex flex-col gap-0.5">
      <Button
        v-for="item in nav"
        :key="item.key"
        :variant="active === item.key ? 'secondary' : 'ghost'"
        class="w-full justify-start gap-2.5 font-normal"
        :class="active === item.key ? 'font-medium' : 'text-muted-foreground'"
        @click="go(item.key)"
      >
        <component :is="item.icon" class="size-4" />
        {{ item.label }}
      </Button>
    </nav>

    <!-- Bottom -->
    <nav class="mt-auto flex flex-col gap-0.5">
      <Button
        v-for="item in bottom"
        :key="item.key"
        variant="ghost"
        class="w-full justify-start gap-2.5 font-normal text-muted-foreground"
        @click="go(item.key)"
      >
        <component :is="item.icon" class="size-4" />
        {{ item.label }}
      </Button>
    </nav>
  </aside>
</template>
