<template>
  <!-- Desktop: Show full popover if has counsel, otherwise simple button -->
  <SharedMattersOpposingCounselEditMatterOpposingCounsel
    v-if="!hasOpposingCounsel && $viewport.isGreaterOrEquals('tablet')"
    @updated="handleUpdated"
    :matter="matter"
    :opposing-counsel="matter?.opposingCounsel"
  >
    <Button variant="outline" size="sm">
      <Scale class="size-4"/>
      Opposing Counsel
    </Button>
  </SharedMattersOpposingCounselEditMatterOpposingCounsel>

  <Popover v-else-if="hasOpposingCounsel && $viewport.isGreaterOrEquals('tablet')" class="flex flex-col lg:max-w-lg w-full border rounded-lg p-3 gap-3 bg-muted/30">
    <PopoverTrigger>
      <Button variant="outline" size="sm">
        <Scale class="size-4"/>
        Opposing Counsel
        <ChevronDown class="size-5"/>
      </Button>
    </PopoverTrigger>

    <PopoverContent class="flex flex-col w-md gap-3">
      <SharedMattersOpposingCounselEditMatterOpposingCounsel
        @click="(e: Event) => e.stopPropagation()"
        @updated="handleUpdated"
        :matter="matter"
        :opposing-counsel="matter?.opposingCounsel"
        class="ml-auto"
      >
        <div class="flex flex-row w-full justify-between items-center">
          <span class="text-lg font-semibold ibm-plex-serif">Opposing Counsel</span>
          <Button class="w-fit ml-auto" size="xs" variant="destructive">Edit</Button>
        </div>
      </SharedMattersOpposingCounselEditMatterOpposingCounsel>

      <!-- Lawyers List -->
      <div class="flex flex-col gap-3">
        <div
          v-for="lawyer in opposingCounsel"
          :key="lawyer.id"
          class="flex flex-col gap-2 p-3 bg-background border rounded-md"
        >
          <div class="flex flex-row items-start justify-between gap-2">
            <div class="flex flex-col gap-1 flex-1 min-w-0">
              <span class="font-medium text-sm">{{ lawyer.name }}</span>
              <Badge v-if="lawyer.firm" variant="outline" class="w-fit text-xs">
                {{ lawyer.firm }}
              </Badge>
            </div>
          </div>

          <!-- Contact Info -->
          <div class="flex flex-col gap-1 text-xs text-muted-foreground">
            <div v-if="lawyer.email" class="flex items-center gap-1">
              <Mail class="size-3"/>
              <span class="truncate">{{ lawyer.email }}</span>
            </div>
            <div v-if="lawyer.phone" class="flex items-center gap-1">
              <Phone class="size-3"/>
              <span>{{ lawyer.phone }}</span>
            </div>
            <div v-if="lawyer.address" class="flex items-center gap-1">
              <MapPin class="size-3"/>
              <span class="truncate">{{ lawyer.address }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Summary Footer -->
      <div class="flex flex-row items-center justify-between pt-2 border-t text-xs text-muted-foreground">
        <span>
          Total: {{ opposingCounselCount }} {{ opposingCounselCount === 1 ? 'lawyer' : 'lawyers' }}
        </span>
      </div>
    </PopoverContent>
  </Popover>


  <!-- Mobile: Show full sheet if has counsel -->
  <Sheet v-else-if="hasOpposingCounsel && $viewport.isLessThan('tablet')" class="flex flex-col lg:max-w-lg w-full border rounded-lg p-3 gap-3 bg-muted/30">
    <SheetTrigger>
      <Button variant="outline" size="sm">
        <Scale class="size-4"/>
        Opposing Counsel
        <ChevronDown class="size-5"/>
      </Button>
    </SheetTrigger>

    <SheetContent class="flex flex-col gap-3 p-3 pt-8" side="bottom">
      <SharedMattersOpposingCounselEditMatterOpposingCounsel
        @click="(e: Event) => e.stopPropagation()"
        @updated="handleUpdated"
        :matter="matter"
        :opposing-counsel="matter?.opposingCounsel"
        class="ml-auto"
      >
        <div class="flex flex-row w-full justify-between items-center">
          <span class="text-lg font-semibold ibm-plex-serif">Opposing Counsel</span>
          <Button class="w-fit ml-auto" size="xs" variant="destructive">Edit</Button>
        </div>
      </SharedMattersOpposingCounselEditMatterOpposingCounsel>

      <!-- Lawyers List -->
      <div class="flex flex-col gap-3">
        <div
          v-for="lawyer in opposingCounsel"
          :key="lawyer.id"
          class="flex flex-col gap-2 p-3 bg-background border rounded-md"
        >
          <div class="flex flex-row items-start justify-between gap-2">
            <div class="flex flex-col gap-1 flex-1 min-w-0">
              <span class="font-medium text-sm">{{ lawyer.name }}</span>
              <Badge v-if="lawyer.firm" variant="outline" class="w-fit text-xs">
                {{ lawyer.firm }}
              </Badge>
            </div>
          </div>

          <!-- Contact Info -->
          <div class="flex flex-col gap-1 text-xs text-muted-foreground">
            <div v-if="lawyer.email" class="flex items-center gap-1">
              <Mail class="size-3"/>
              <span class="truncate">{{ lawyer.email }}</span>
            </div>
            <div v-if="lawyer.phone" class="flex items-center gap-1">
              <Phone class="size-3"/>
              <span>{{ lawyer.phone }}</span>
            </div>
            <div v-if="lawyer.address" class="flex items-center gap-1">
              <MapPin class="size-3"/>
              <span class="truncate">{{ lawyer.address }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Summary Footer -->
      <div class="flex flex-row items-center justify-between pt-2 border-t text-xs text-muted-foreground">
        <span>
          Total: {{ opposingCounselCount }} {{ opposingCounselCount === 1 ? 'lawyer' : 'lawyers' }}
        </span>
      </div>
    </SheetContent>
  </Sheet>

  <!-- Mobile: Show simple button if no counsel -->
  <SharedMattersOpposingCounselEditMatterOpposingCounsel
    v-else-if="!hasOpposingCounsel && $viewport.isLessThan('tablet')"
    @updated="handleUpdated"
    :matter="matter"
    :opposing-counsel="matter?.opposingCounsel"
  >
    <Button variant="outline" size="sm">
      <Scale class="size-4"/>
      Opposing Counsel
    </Button>
  </SharedMattersOpposingCounselEditMatterOpposingCounsel>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { Scale, Mail, Phone, MapPin, ChevronDown } from "lucide-vue-next";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "~/components/ui/popover";
import { Sheet, SheetTrigger, SheetContent } from "~/components/ui/sheet";

interface Props {
  matter: any;
}

const props = defineProps<Props>();

const emits = defineEmits<{
  updated: [];
}>();

// Check if matter has opposing counsel
const hasOpposingCounsel = computed(() => {
  return props.matter?.opposingCounsel && props.matter.opposingCounsel.length > 0;
});

// Get opposing counsel from matter
const opposingCounsel = computed(() => {
  return props.matter?.opposingCounsel || [];
});

// Opposing counsel count
const opposingCounselCount = computed(() => {
  return opposingCounsel.value.length;
});

// Forward the updated event
const handleUpdated = () => {
  emits('updated');
};
</script>

