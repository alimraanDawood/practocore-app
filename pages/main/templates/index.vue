<script setup lang="ts">
import { ref, computed } from 'vue';
import { toast } from 'vue-sonner';
import type { EnhancedTemplate, TemplateCategoryFilter } from '~/lib/types/template';
import { getAllTemplates, getTemplates } from '~/services/templates';
import TemplateFilters from '~/components/shared/Templates/TemplateFilters.vue';
import TemplateCard from '~/components/shared/Templates/TemplateCard.vue';
import CreateTemplate from '~/components/shared/Templates/CreateTemplate/CreateTemplate.vue';
import { Plus, Grid3x3, List, Loader2 } from 'lucide-vue-next';

// Page metadata
definePageMeta({
  title: 'Template Marketplace',
  description: 'Browse and discover deadline templates',
  layout: 'default',
});

// State
const templates = ref<EnhancedTemplate[]>([]);
const loading = ref(true);
const filters = ref<TemplateCategoryFilter>({});
const viewMode = ref<'grid' | 'list'>('grid');
const sortBy = ref<string>('-created');

// Pagination
const currentPage = ref(1);
const perPage = ref(12);
const totalPages = ref(1);
const totalItems = ref(0);

// Sort options
const sortOptions = [
  { value: '-created', label: 'Newest First' },
  { value: 'created', label: 'Oldest First' },
  { value: '-updated', label: 'Recently Updated' },
  { value: 'name', label: 'Name (A-Z)' },
  { value: '-name', label: 'Name (Z-A)' },
  { value: '-usageCount', label: 'Most Popular' },
];

// Computed
const hasFilters = computed(() => {
  return (
    filters.value.country?.length ||
    filters.value.practiceArea?.length ||
    filters.value.courtLevel?.length ||
    filters.value.complexity?.length ||
    filters.value.searchQuery
  );
});

const isEmpty = computed(() => {
  return !loading.value && templates.value.length === 0;
});

// Load templates
async function loadTemplates() {
  loading.value = true;
  try {
    const result = await getTemplates(
      currentPage.value,
      perPage.value,
      filters.value,
      sortBy.value
    );

    templates.value = result.items;
    totalPages.value = result.totalPages;
    totalItems.value = result.totalItems;
    currentPage.value = result.page;
  } catch (error) {
    console.error('Failed to load templates:', error);
    toast.error('Failed to load templates');
  } finally {
    loading.value = false;
  }
}

// Handle filter changes
function onFilterApply(newFilters: TemplateCategoryFilter) {
  filters.value = newFilters;
  currentPage.value = 1; // Reset to first page
  loadTemplates();
}

// Handle sort change
function onSortChange(value: string) {
  sortBy.value = value;
  loadTemplates();
}

// Navigate to template details
function viewTemplate(template: EnhancedTemplate) {
  navigateTo(`/main/templates/${template.id}`);
}

// Use template
function useTemplate(template: EnhancedTemplate) {
  navigateTo(`/main/matters/create?template=${template.id}`);
}

// Pagination
function goToPage(page: number) {
  currentPage.value = page;
  loadTemplates();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Initialize
onMounted(() => {
  loadTemplates();
});
</script>

<template>
  <div class="flex flex-col h-full lg:w-[95vw] w-full overflow-y-scroll p-3 gap-6">
    <!-- Header -->
    <div class="flex flex-col gap-4">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-lg lg:text-2xl ibm-plex-serif font-bold">Template</h1>
          <p class="text-muted-foreground mt-1 hidden lg:block">
            Browse and discover deadline templates for your practice
          </p>
        </div>

        <!-- Create Template Button -->
        <CreateTemplate>
          <Button size="sm">
            <Plus class="h-4 w-4 mr-2" />
            Create Template
          </Button>
        </CreateTemplate>
      </div>

      <!-- Filters -->
      <div class="flex flex-col gap-3 lg:flex-row justify-between w-full">
        <div class="">
          <TemplateFilters v-model="filters" @apply="onFilterApply" />
        </div>

        <div class="flex flex-col-reverse gap-2 lg:flex-row lg:items-center justify-between">
          <div class="flex items-center gap-2">
            <!-- Results Count -->
            <p class="text-sm text-muted-foreground lg:hidden">
              <span v-if="!loading">
                {{ totalItems }} template{{ totalItems !== 1 ? 's' : '' }} found
              </span>
              <span v-else>Loading...</span>
            </p>

            <!-- Clear Filters -->
            <Button
              v-if="hasFilters"
              variant="ghost"
              size="sm"
              @click="onFilterApply({})"
            >
              Clear Filters
            </Button>
          </div>

          <div class="flex w-full lg:w-fit items-center gap-4">
            <!-- Sort -->
            <Select class="w-full" v-model="sortBy" @update:model-value="onSortChange">
              <SelectTrigger class="w-full">
                <SelectValue placeholder="Sort by..." />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem
                    v-for="option in sortOptions"
                    :key="option.value"
                    :value="option.value"
                  >
                    {{ option.label }}
                  </SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <p class="text-sm text-muted-foreground hidden lg:block">
            <span v-if="!loading">
              {{ totalItems }} template{{ totalItems !== 1 ? 's' : '' }} found
            </span>
        <span v-else>Loading...</span>
      </p>

      <!-- Toolbar -->
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex items-center justify-center py-12">
      <Loader2 class="h-8 w-8 animate-spin text-muted-foreground" />
    </div>

    <!-- Empty State -->
    <div
      v-else-if="isEmpty"
      class="flex flex-col items-center justify-center py-12 gap-4"
    >
      <div class="text-center">
        <h3 class="text-lg font-semibold">No templates found</h3>
        <p class="text-sm text-muted-foreground mt-1">
          {{ hasFilters
            ? 'Try adjusting your filters or search query'
            : 'Create your first template to get started'
          }}
        </p>
      </div>
      <CreateTemplate v-if="!hasFilters">
        <Button>
          <Plus class="h-4 w-4 mr-2" />
          Create Your First Template
        </Button>
      </CreateTemplate>
    </div>

    <!-- Templates Grid/List -->
    <div v-else>
      <!-- Grid View -->
      <div
        class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
      >
        <NuxtLink v-for="template in templates" :to="`/main/templates/template/${template.id}`">
          <TemplateCard
            :key="template.id"
            :template="template"
            @click="viewTemplate"
            @use="useTemplate"
          />
        </NuxtLink>
      </div>
    </div>

    <!-- Pagination -->
    <div
      v-if="!loading && !isEmpty && totalPages > 1"
      class="flex items-center justify-center gap-2 mt-6"
    >
      <Button
        variant="outline"
        size="sm"
        :disabled="currentPage === 1"
        @click="goToPage(currentPage - 1)"
      >
        Previous
      </Button>

      <div class="flex items-center gap-1">
        <Button
          v-for="page in totalPages"
          :key="page"
          variant="outline"
          size="sm"
          :class="{ 'bg-primary text-primary-foreground': page === currentPage }"
          @click="goToPage(page)"
        >
          {{ page }}
        </Button>
      </div>

      <Button
        variant="outline"
        size="sm"
        :disabled="currentPage === totalPages"
        @click="goToPage(currentPage + 1)"
      >
        Next
      </Button>
    </div>
  </div>
</template>

<style scoped>
/* Custom scrollbar for better UX */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: hsl(var(--muted));
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: hsl(var(--muted-foreground));
}
</style>
