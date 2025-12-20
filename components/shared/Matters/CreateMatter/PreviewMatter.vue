<template>
  <div class="flex flex-col w-full">
    <div class="flex flex-col">
      <!-- Sorted deadlines -->
      <div v-for="(dl, idx) in output?.deadlines" :key="dl.id" class="flex flex-row w-full group relative">
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
                      <span class="text-sm font-semibold">
                        {{ dl.name }}
                      </span>
          </div>

          <div class="flex flex-row items-center gap-2 text-xs text-muted-foreground">
            <span>{{ dayjs(dl.date).format("D MMM YYYY") }}</span>
            <span>•</span>
            <span>{{ dayjs(dl.date).fromNow() }}</span>
          </div>

          <div v-if="dl?.description"
               class="text-xs text-muted-foreground mt-1">
            {{ dl?.description }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { DeadlineEngine } from "~/lib/deadline-engine";
import dayjs from "dayjs";
import {CheckCircle, Clock, Target} from "lucide-vue-next";

const props = defineProps(["template", "triggerDate", "fieldValues"]);

const output = computed(() => {
  if(props.template && props.triggerDate) {
    return DeadlineEngine.generate(props.template, props.triggerDate, props.fieldValues);
  }
})
</script>