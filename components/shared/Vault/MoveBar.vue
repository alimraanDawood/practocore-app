<script lang="ts" setup>
import { useVaultMove } from '~/composables/useVaultMove';

// The bar that stays on screen while items are being carried to a new folder.
// It replaces a destination dialog on a phone, where a tree picker is both too
// small to read and a second, different way to navigate the same folders the
// user already knows how to walk.
//
// Everything about where the items are going is the host explorer's business —
// it knows what "here" is. This only reports what is carried and asks.
const props = defineProps<{
  /** Whether "here" can receive the items, and why not when it can't. */
  canDrop: boolean;
  reason?: string;
  /** Where they would land, named — "Move here" alone is a leap of faith. */
  destination: string;
}>();

const emit = defineEmits<{ commit: []; cancel: [] }>();

const { pending } = useVaultMove();
const count = computed(() => pending.value?.items.length ?? 0);
const lead = computed(() => pending.value?.items[0]);
</script>

<template>
  <Transition
    enter-active-class="transition duration-200 ease-out" enter-from-class="translate-y-full opacity-0"
    leave-active-class="transition duration-150 ease-in" leave-to-class="translate-y-full opacity-0">
    <div
      v-if="pending"
      class="fixed inset-x-0 bottom-0 z-40 border-t bg-primary/10 pb-(--safe-area-bottom) backdrop-blur
             sm:absolute sm:inset-x-2 sm:bottom-3 sm:rounded-xl sm:border sm:pb-0 sm:shadow-lg">
      <div class="flex items-center gap-3 px-3 py-2.5">
        <!-- What is being carried. A count with no face to it is easy to lose
             track of three folders deep. -->
        <div class="relative grid size-10 shrink-0 place-items-center rounded-lg bg-background shadow-sm">
          <component :is="lead.icon" v-if="lead" class="size-5" :class="lead.tint" />
          <span
            v-if="count > 1"
            class="absolute -right-1.5 -top-1.5 grid min-w-5 place-items-center rounded-full bg-primary px-1
                   text-[10px] font-semibold text-primary-foreground">
            {{ count }}
          </span>
        </div>

        <div class="flex min-w-0 flex-1 flex-col">
          <span class="truncate text-sm font-medium">
            {{ count === 1 ? lead?.name : `${count} items` }}
          </span>
          <span class="truncate text-xs text-muted-foreground">
            {{ canDrop ? `Move to ${destination}` : reason }}
          </span>
        </div>

        <Button size="sm" variant="ghost" class="shrink-0" @click="emit('cancel')">Cancel</Button>
        <Button size="sm" class="shrink-0" :disabled="!canDrop" @click="emit('commit')">
          Move here
        </Button>
      </div>
    </div>
  </Transition>
</template>
