<template>
  <div class="flex flex-col w-full">
    <!-- Loading -->
    <div v-if="loading && !output" class="flex items-center gap-2 text-xs text-muted-foreground py-4">
      <Loader2 class="size-4 animate-spin"/>
      <span>Calculating deadlines…</span>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="text-xs text-destructive py-3">
      {{ error }}
    </div>

    <div v-else class="flex flex-col">
      <!-- Conversion warnings (surfaced from the engine) -->
      <div v-if="output?.warnings?.length"
           class="mb-3 rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-400">
        <div class="font-medium mb-1">Some rules need review:</div>
        <ul class="list-disc pl-4 space-y-0.5">
          <li v-for="(w, i) in output.warnings.slice(0, 5)" :key="i">{{ w }}</li>
        </ul>
        <div v-if="output.warnings.length > 5" class="mt-1 opacity-70">
          +{{ output.warnings.length - 5 }} more…
        </div>
      </div>

      <!-- Sorted deadlines -->
      <div v-for="(dl) in output?.deadlines" :key="dl.id" class="flex flex-row w-full group relative">
        <div class="flex flex-col px-2 items-center">
          <div class="w-1 h-5 bg-muted group-first:opacity-0"
               :class="{ 'bg-primary': dl.status === 'fulfilled' }"></div>
          <div class="size-8 bg-primary/10 text-primary shrink-0 rounded-full grid place-items-center border transition-all">
            <CheckCircle v-if="dl.status === 'fulfilled'" class="size-4"/>
            <Clock v-else class="size-4"/>
          </div>
          <div class="w-1 h-full bg-muted group-last:opacity-0"
               :class="{ 'bg-primary': dl.status === 'fulfilled' }"></div>
        </div>

        <div class="flex flex-col w-full justify-center gap-1 py-3 pr-2">
          <div class="flex flex-row items-center gap-2">
            <span class="text-sm font-semibold">{{ dl.name }}</span>
          </div>

          <div class="flex flex-row items-center gap-2 text-xs text-muted-foreground">
            <template v-if="dl.date">
              <span>{{ dayjs(dl.date).format("D MMM YYYY") }}</span>
              <span>•</span>
              <span>{{ dayjs(dl.date).fromNow() }}</span>
            </template>
            <span v-else-if="dl.status === 'unavailable'">Not applicable</span>
            <span v-else>Pending an earlier step</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { previewLegacyTemplate, type LegacyPreviewOutput } from "~/services/deadline-v2";
import dayjs from "dayjs";
import { CheckCircle, Clock, Loader2 } from "lucide-vue-next";

const props = defineProps(["template", "triggerDate", "fieldValues"]);

// Computation happens on the backend (v2 engine), not in the browser. Debounced
// so typing in form fields doesn't spam the endpoint.
const output = ref<LegacyPreviewOutput | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);

let timer: ReturnType<typeof setTimeout> | undefined;

async function run() {
  if (!props.template || !props.triggerDate) {
    output.value = null;
    return;
  }
  loading.value = true;
  error.value = null;
  try {
    output.value = await previewLegacyTemplate(props.template, props.triggerDate, props.fieldValues);
  } catch (e: any) {
    error.value = e?.detail?.error ?? e?.message ?? "Failed to calculate deadlines";
  } finally {
    loading.value = false;
  }
}

watch(
  () => [props.template, props.triggerDate, props.fieldValues],
  () => {
    clearTimeout(timer);
    timer = setTimeout(run, 300);
  },
  { deep: true, immediate: true },
);

onBeforeUnmount(() => clearTimeout(timer));
</script>
