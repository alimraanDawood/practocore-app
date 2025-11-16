<script setup lang="ts">
import {ref, computed} from 'vue';
import type {TemplateCategoryFilter} from '~/lib/types/template';
import {
  COUNTRIES,
  PRACTICE_AREAS,
  COURT_LEVELS,
  COMPLEXITY_LEVELS,
} from '~/lib/constants/template-categories';
import {Search, X, SlidersHorizontal} from 'lucide-vue-next';

interface Props {
  modelValue?: TemplateCategoryFilter;
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: () => ({}),
});

const emit = defineEmits<{
  'update:modelValue': [value: TemplateCategoryFilter];
  'apply': [value: TemplateCategoryFilter];
}>();

const localFilter = ref<TemplateCategoryFilter>(props.modelValue || {});
const showAdvancedFilters = ref(false);

// Search query
const searchQuery = computed({
  get: () => localFilter.value.searchQuery || '',
  set: (value) => {
    localFilter.value.searchQuery = value;
    emitUpdate();
  }
});

function emitUpdate() {
  emit('update:modelValue', localFilter.value);
}

function applyFilters() {
  emit('apply', localFilter.value);
}

function clearFilters() {
  localFilter.value = {searchQuery: localFilter.value.searchQuery};
  emitUpdate();
  applyFilters();
}

// Count active filters (excluding search)
const activeFilterCount = computed(() => {
  let count = 0;
  if (localFilter.value.country?.length) count++;
  if (localFilter.value.practiceArea?.length) count++;
  if (localFilter.value.courtLevel?.length) count++;
  if (localFilter.value.complexity?.length) count++;
  if (localFilter.value.status?.length) count++;
  if (localFilter.value.isPublic !== undefined) count++;
  return count;
});

// Multi-select handlers
function toggleCountry(value: string) {
  if (!localFilter.value.country) localFilter.value.country = [];
  const index = localFilter.value.country.indexOf(value as any);
  if (index > -1) {
    localFilter.value.country.splice(index, 1);
  } else {
    localFilter.value.country.push(value as any);
  }
  emitUpdate();
}

function togglePracticeArea(value: string) {
  if (!localFilter.value.practiceArea) localFilter.value.practiceArea = [];
  const index = localFilter.value.practiceArea.indexOf(value as any);
  if (index > -1) {
    localFilter.value.practiceArea.splice(index, 1);
  } else {
    localFilter.value.practiceArea.push(value as any);
  }
  emitUpdate();
}

function toggleCourtLevel(value: string) {
  if (!localFilter.value.courtLevel) localFilter.value.courtLevel = [];
  const index = localFilter.value.courtLevel.indexOf(value as any);
  if (index > -1) {
    localFilter.value.courtLevel.splice(index, 1);
  } else {
    localFilter.value.courtLevel.push(value as any);
  }
  emitUpdate();
}

function toggleComplexity(value: string) {
  if (!localFilter.value.complexity) localFilter.value.complexity = [];
  const index = localFilter.value.complexity.indexOf(value as any);
  if (index > -1) {
    localFilter.value.complexity.splice(index, 1);
  } else {
    localFilter.value.complexity.push(value as any);
  }
  emitUpdate();
}
</script>

<template>
  <div class="flex flex-col gap-4 w-full">
    <!-- Search Bar -->
    <div class="flex gap-2 items-center">
      <div class="relative flex-1">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
        <Input
            v-model="searchQuery"
            type="search"
            placeholder="Search templates..."
            class="pl-9"
            @keyup.enter="applyFilters"
        />
      </div>
      <Sheet>
        <SheetTrigger>
          <Button
              variant="outline"
              size="icon"
              @click="showAdvancedFilters = !showAdvancedFilters"
              :class="{ 'bg-accent': showAdvancedFilters || activeFilterCount > 0 }"
          >
            <SlidersHorizontal class="h-4 w-4"/>
            <span v-if="activeFilterCount > 0"
                  class="absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-full h-5 w-5 text-xs flex items-center justify-center">
              {{ activeFilterCount }}
            </span>
          </Button>
        </SheetTrigger>

        <SheetContent :side="$viewport.isGreaterThan('tablet') ? 'right' : 'bottom'" class="overflow-hidden flex flex-col max-h-[100dvh]">
          <SheetHeader>
            <SheetTitle>Template Filters</SheetTitle>
          </SheetHeader>

          <div class="flex flex-col w-full h-full overflow-y-hidden">
            <div class="p-4 space-y-4 flex flex-col w-full h-full overflow-y-scroll">
              <!-- Country Filter -->
              <div class="space-y-2">
                <Label class="text-sm font-medium">Country</Label>
                <div class="flex flex-wrap gap-2">
                  <Badge
                      v-for="country in COUNTRIES"
                      :key="country.value"
                      variant="outline"
                      class="cursor-pointer transition-colors hover:bg-accent"
                      :class="{
                      'bg-primary text-primary-foreground': localFilter.country?.includes(country.value as any)
                    }"
                      @click="toggleCountry(country.value)"
                  >
                    {{ country.label }}
                  </Badge>
                </div>
              </div>

              <Separator/>

              <!-- Practice Area Filter -->
              <div class="space-y-2">
                <Label class="text-sm font-medium">Practice Area</Label>
                <div class="flex flex-wrap gap-2">
                  <Badge
                      v-for="area in PRACTICE_AREAS"
                      :key="area.value"
                      variant="outline"
                      class="cursor-pointer transition-colors hover:bg-accent"
                      :class="{
                      'bg-primary text-primary-foreground': localFilter.practiceArea?.includes(area.value as any)
                    }"
                      @click="togglePracticeArea(area.value)"
                  >
                    {{ area.label }}
                  </Badge>
                </div>
              </div>

              <Separator/>

              <!-- Court Level Filter -->
              <div class="space-y-2">
                <Label class="text-sm font-medium">Court Level</Label>
                <div class="flex flex-wrap gap-2">
                  <Badge
                      v-for="court in COURT_LEVELS"
                      :key="court.value"
                      variant="outline"
                      class="cursor-pointer transition-colors hover:bg-accent"
                      :class="{
                      'bg-primary text-primary-foreground': localFilter.courtLevel?.includes(court.value as any)
                    }"
                      @click="toggleCourtLevel(court.value)"
                  >
                    {{ court.label }}
                  </Badge>
                </div>
              </div>

              <Separator/>

              <!-- Complexity Filter -->
              <div class="space-y-2">
                <Label class="text-sm font-medium">Complexity</Label>
                <div class="flex flex-wrap gap-2">
                  <Badge
                      v-for="level in COMPLEXITY_LEVELS"
                      :key="level.value"
                      variant="outline"
                      class="cursor-pointer transition-colors hover:bg-accent"
                      :class="{
                      'bg-primary text-primary-foreground': localFilter.complexity?.includes(level.value as any)
                    }"
                      @click="toggleComplexity(level.value)"
                  >
                    {{ level.label }}
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          <!-- Filter Actions -->
          <div class="flex gap-2 p-3">
            <Button @click="applyFilters" class="flex-1">
              Apply Filters
            </Button>
            <Button variant="outline" @click="clearFilters">
              <X class="h-4 w-4 mr-2"/>
              Clear
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>

    <!-- Active Filter Pills -->
    <div v-if="activeFilterCount > 0" class="flex flex-wrap gap-2">
      <Badge
          v-for="country in localFilter.country || []"
          :key="`country-${country}`"
          variant="secondary"
          class="cursor-pointer"
          @click="toggleCountry(country)"
      >
        {{ COUNTRIES.find(c => c.value === country)?.label }}
        <X class="h-3 w-3 ml-1"/>
      </Badge>
      <Badge
          v-for="area in localFilter.practiceArea || []"
          :key="`area-${area}`"
          variant="secondary"
          class="cursor-pointer"
          @click="togglePracticeArea(area)"
      >
        {{ PRACTICE_AREAS.find(a => a.value === area)?.label }}
        <X class="h-3 w-3 ml-1"/>
      </Badge>
      <Badge
          v-for="court in localFilter.courtLevel || []"
          :key="`court-${court}`"
          variant="secondary"
          class="cursor-pointer"
          @click="toggleCourtLevel(court)"
      >
        {{ COURT_LEVELS.find(c => c.value === court)?.label }}
        <X class="h-3 w-3 ml-1"/>
      </Badge>
      <Badge
          v-for="complexity in localFilter.complexity || []"
          :key="`complexity-${complexity}`"
          variant="secondary"
          class="cursor-pointer"
          @click="toggleComplexity(complexity)"
      >
        {{ COMPLEXITY_LEVELS.find(l => l.value === complexity)?.label }}
        <X class="h-3 w-3 ml-1"/>
      </Badge>
    </div>
  </div>
</template>
