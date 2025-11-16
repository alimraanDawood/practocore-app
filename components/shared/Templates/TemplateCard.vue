<script setup lang="ts">
import type {EnhancedTemplate} from '~/lib/types/template';
import {
  getCountryLabel,
  getPracticeAreaLabel,
  getCourtLevelLabel,
  getComplexityLabel,
  PRACTICE_AREAS,
  COMPLEXITY_LEVELS,
} from '~/lib/constants/template-categories';
import {Calendar, User, Building2, FileText, Tag, Globe, CalendarIcon} from 'lucide-vue-next';

interface Props {
  template: EnhancedTemplate;
  compact?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  compact: false,
});

const emit = defineEmits<{
  'click': [template: EnhancedTemplate];
  'use': [template: EnhancedTemplate];
}>();

// Get practice area icon
const practiceAreaIcon = computed(() => {
  return PRACTICE_AREAS.find(p => p.value === props.template.practiceArea)?.icon || '📁';
});

// Get complexity color
const complexityColor = computed(() => {
  return COMPLEXITY_LEVELS.find(c => c.value === props.template.complexity)?.color || 'gray';
});

// Format date
function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}
</script>

<template>
  <button
      class="flex text-left flex-col p-3 gap-3 overflow-hidden aspect-video border shrink-0 w-full rounded-lg bg-muted">
    <span class="text-lg font-semibold ibm-plex-serif">{{ template.name }}</span>
    <div class="flex flex-col w-full h-full overflow-hidden relative">
      <div
          class="text-sm w-full prose text-foreground prose-headings:text-foreground prose-h1:text-foreground prose-h1:ibm-plex-serif prose-headings:ibm-plex-serif"
          v-html="template.description">

      </div>

      <div class="absolute h-5 bottom-0 left-0 w-full bg-gradient-to-t from-muted to-transparent"></div>
    </div>
    <div class="flex flex-row items-center justify-between gap-3">
      <div class="flex flex-row gap-2">
        <div class="flex flex-row text-sm font-semibold items-center gap-1">
          <CalendarIcon class="size-4"/>

          {{
            (() => {
              const d = new Date(template.created);
              return `${String(d.getFullYear()).slice(-2)}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
            })()
          }}
        </div>

      </div>

      <Button class="" size="sm" variant="outline">Use Template</Button>
    </div>
  </button>
</template>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
