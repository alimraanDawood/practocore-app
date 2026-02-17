<template>
  <Popover v-if="hasCourtOfficers && $viewport.isGreaterOrEquals('tablet')" class="flex flex-col lg:max-w-lg w-full border rounded-lg p-3 gap-3 bg-muted/30">
    <PopoverTrigger>
      <Button variant="outline" size="sm">
        <Gavel class="size-4"/>
        Court Officers

        <ChevronDown class="size-5"/>
      </Button>
    </PopoverTrigger>

    <PopoverContent class="flex flex-col w-md gap-3">
      <SharedMattersCourtOfficersEditMatterCourtOfficers
        @click="(e: Event) => e.stopPropagation()"
        :matter="matter"
        @updated="$emit('updated')"
        class="ml-auto"
      >
        <div class="flex flex-row w-full justify-between items-center">
          <span class="text-lg font-semibold ibm-plex-serif">Court Officers</span>
          <Button class="w-fit ml-auto" size="xs" variant="destructive">Edit</Button>
        </div>
      </SharedMattersCourtOfficersEditMatterCourtOfficers>

      <!-- Court -->
      <div v-if="courtInfo" class="flex flex-col gap-2">
        <h4 class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Court
        </h4>
        <div class="flex flex-col gap-1 p-2 bg-background border rounded-md">
          <div class="flex flex-row items-center gap-2">
            <Building2 class="size-4 text-muted-foreground"/>
            <span class="font-medium text-sm">{{ courtInfo.name }}</span>
          </div>
        </div>
      </div>

      <!-- Judge -->
      <div v-if="judgesInfo" class="flex flex-col gap-2">
        <h4 class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Judges
        </h4>
        <div v-for="judge in judgesInfo" class="flex flex-col gap-1 p-2 bg-background border rounded-md">
          <div class="flex flex-row items-center gap-2">
            <Gavel class="size-4 text-muted-foreground"/>
            <span class="font-medium text-sm">{{ judge.name }}</span>
          </div>
          <div v-if="judge.expand?.court" class="flex items-center gap-1 text-xs text-muted-foreground mt-1">
            <Building2 class="size-3"/>
            <span>{{ judge.expand.court.name }}</span>
          </div>
        </div>
      </div>

      <!-- Registrars -->
      <div v-if="registrars.length > 0" class="flex flex-col gap-2">
        <h4 class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Registrars
        </h4>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div
            v-for="registrar in registrars"
            :key="registrar.id"
            class="flex flex-col gap-1 p-2 bg-background border rounded-md"
          >
            <div class="flex flex-row items-center gap-2">
              <FileText class="size-4 text-muted-foreground"/>
              <span class="font-medium text-sm">{{ registrar.name }}</span>
            </div>
            <div v-if="registrar.role" class="text-xs text-muted-foreground">
              {{ registrar.role }}
            </div>
          </div>
        </div>
      </div>

      <!-- Clerks -->
      <div v-if="clerks.length > 0" class="flex flex-col gap-2">
        <h4 class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Clerks
        </h4>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div
            v-for="clerk in clerks"
            :key="clerk.id"
            class="flex flex-col gap-1 p-2 bg-background border rounded-md"
          >
            <div class="flex flex-row items-center gap-2">
              <User class="size-4 text-muted-foreground"/>
              <span class="font-medium text-sm">{{ clerk.name }}</span>
            </div>

            <!-- Contact Info -->
            <div class="flex flex-col gap-0.5 text-xs text-muted-foreground mt-1">
              <div v-if="clerk.email" class="flex items-center gap-1">
                <Mail class="size-3"/>
                <span class="truncate">{{ clerk.email }}</span>
              </div>
              <div v-if="clerk.phone" class="flex items-center gap-1">
                <Phone class="size-3"/>
                <span>{{ clerk.phone }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Summary Footer -->
      <div class="flex flex-row items-center justify-between pt-2 border-t text-xs text-muted-foreground">
        <span>
          Total: {{ totalOfficerCount }} {{ totalOfficerCount === 1 ? 'officer' : 'officers' }}
        </span>
      </div>
    </PopoverContent>
  </Popover>

  <Sheet v-else-if="hasCourtOfficers && $viewport.isLessThan('tablet')" class="flex flex-col lg:max-w-lg w-full border rounded-lg p-3 gap-3 bg-muted/30">
    <SheetTrigger>
      <Button variant="outline" size="sm">
        <Gavel class="size-4"/>
        Court Officers

        <ChevronDown class="size-5"/>
      </Button>
    </SheetTrigger>

    <SheetContent class="flex flex-col gap-3 p-3 pt-8" side="bottom">
      <SharedMattersCourtOfficersEditMatterCourtOfficers
        @click="(e: Event) => e.stopPropagation()"
        :matter="matter"
        @updated="$emit('updated')"
        class="ml-auto"
      >
        <div class="flex flex-row w-full justify-between items-center">
          <span class="text-lg font-semibold ibm-plex-serif">Court Officers</span>
          <Button class="w-fit ml-auto" size="xs" variant="destructive">Edit</Button>
        </div>
      </SharedMattersCourtOfficersEditMatterCourtOfficers>

      <!-- Court -->
      <div v-if="courtInfo" class="flex flex-col gap-2">
        <h4 class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Court
        </h4>
        <div class="flex flex-col gap-1 p-2 bg-background border rounded-md">
          <div class="flex flex-row items-center gap-2">
            <Building2 class="size-4 text-muted-foreground"/>
            <span class="font-medium text-sm">{{ courtInfo.name }}</span>
          </div>
        </div>
      </div>

      <!-- Judge -->
      <div v-if="judgesInfo" class="flex flex-col gap-2">
        <h4 class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Judges
        </h4>
        <div v-for="judge in judgesInfo" class="flex flex-col gap-1 p-2 bg-background border rounded-md">
          <div class="flex flex-row items-center gap-2">
            <Gavel class="size-4 text-muted-foreground"/>
            <span class="font-medium text-sm">{{ judge?.name }}</span>
          </div>
          <div v-if="judge.expand?.court" class="flex items-center gap-1 text-xs text-muted-foreground mt-1">
            <Building2 class="size-3"/>
            <span>{{ judge.expand.court.name }}</span>
          </div>
        </div>
      </div>

      <!-- Registrars -->
      <div v-if="registrars.length > 0" class="flex flex-col gap-2">
        <h4 class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Registrars
        </h4>
        <div class="grid grid-cols-1 gap-2">
          <div
            v-for="registrar in registrars"
            :key="registrar.id"
            class="flex flex-col gap-1 p-2 bg-background border rounded-md"
          >
            <div class="flex flex-row items-center gap-2">
              <FileText class="size-4 text-muted-foreground"/>
              <span class="font-medium text-sm">{{ registrar.name }}</span>
            </div>
            <div v-if="registrar.role" class="text-xs text-muted-foreground">
              {{ registrar.role }}
            </div>
          </div>
        </div>
      </div>

      <!-- Clerks -->
      <div v-if="clerks.length > 0" class="flex flex-col gap-2">
        <h4 class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Clerks
        </h4>
        <div class="grid grid-cols-1 gap-2">
          <div
            v-for="clerk in clerks"
            :key="clerk.id"
            class="flex flex-col gap-1 p-2 bg-background border rounded-md"
          >
            <div class="flex flex-row items-center gap-2">
              <User class="size-4 text-muted-foreground"/>
              <span class="font-medium text-sm">{{ clerk.name }}</span>
            </div>

            <!-- Contact Info -->
            <div class="flex flex-col gap-0.5 text-xs text-muted-foreground mt-1">
              <div v-if="clerk.email" class="flex items-center gap-1">
                <Mail class="size-3"/>
                <span class="truncate">{{ clerk.email }}</span>
              </div>
              <div v-if="clerk.phone" class="flex items-center gap-1">
                <Phone class="size-3"/>
                <span>{{ clerk.phone }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Summary Footer -->
      <div class="flex flex-row items-center justify-between pt-2 border-t text-xs text-muted-foreground">
        <span>
          Total: {{ totalOfficerCount }} {{ totalOfficerCount === 1 ? 'officer' : 'officers' }}
        </span>
      </div>
    </SheetContent>
  </Sheet>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { Gavel, Building2, FileText, User, Mail, Phone, ChevronDown } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "~/components/ui/popover";
import { Sheet, SheetTrigger, SheetContent } from "~/components/ui/sheet";

interface Props {
  matter: any;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  updated: [];
}>();

// Check if matter has any court officers
const hasCourtOfficers = computed(() => {
  return !!(
    props.matter?.expand?.court ||
    props.matter?.expand?.judges ||
    props.matter?.courtOfficers?.registrars?.length > 0 ||
    props.matter?.courtOfficers?.clerks?.length > 0
  );
});

// Get court info (expanded relation)
const courtInfo = computed(() => {
  return props.matter?.expand?.court || null;
});

// Get judge info (expanded relation)
const judgesInfo = computed(() => {
  return props.matter?.expand?.judges || null;
});

// Get registrars from courtOfficers JSON field
const registrars = computed(() => {
  return props.matter?.courtOfficers?.registrars || [];
});

// Get clerks from courtOfficers JSON field
const clerks = computed(() => {
  return props.matter?.courtOfficers?.clerks || [];
});

// Total officer count
const totalOfficerCount = computed(() => {
  let count = 0;
  if (courtInfo.value) count++;
  if (judgesInfo.value) count++;
  count += registrars.value.length;
  count += clerks.value.length;
  return count;
});
</script>

