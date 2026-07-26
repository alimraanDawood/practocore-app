<template>
  <div class="flex flex-col gap-3">
    <InputGroup>
      <InputGroupInput v-model="query" placeholder="Search..."/>
      <InputGroupAddon>
        <Search/>
      </InputGroupAddon>
      <InputGroupAddon align="inline-end">
        {{ filteredTemplates.length }} result{{ filteredTemplates.length === 1 ? '' : 's' }}
      </InputGroupAddon>
    </InputGroup>

    <div v-if="loading === false && filteredTemplates.length > 0" class="flex flex-col">
      <div class="flex flex-col p-3 border overflow-y-scroll rounded-lg rounded-b-none h-full gap-3">
        <!-- Signed procedures. These carry the statutory deadlines and the
             authority behind them, which is why they are listed apart from a
             firm's own — the distinction is the product's core promise. -->
        <div v-if="signedTemplates.length" class="flex flex-col gap-2">
          <span class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            PractoCore procedures
          </span>
          <button
            v-for="template in signedTemplates" :key="template.id"
            type="button" @click="selectTemplate(template)"
            class="border p-2 flex flex-row w-full text-left rounded items-center gap-2"
            :class="{ 'bg-primary/10 text-primary ring ring-primary border-primary': template?.id === modelValue?.id }"
          >
            <span class="w-full">{{ template.name }}</span>
            <Check v-if="template.id === modelValue?.id" class="size-4 shrink-0"/>
          </button>
        </div>

        <!-- The firm's own. Never badged as verified: these are the firm's
             process, and the timeline they produce says so. -->
        <div v-if="firmTemplates.length" class="flex flex-col gap-2">
          <span class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Your firm's procedures
          </span>
          <button
            v-for="template in firmTemplates" :key="template.id"
            type="button" @click="selectTemplate(template)"
            class="border p-2 flex flex-row w-full text-left rounded items-center gap-2"
            :class="{ 'bg-primary/10 text-primary ring ring-primary border-primary': template?.id === modelValue?.id }"
          >
            <span class="flex flex-col w-full min-w-0">
              <span class="truncate">{{ template.name }}</span>
              <!-- Built on one of ours: the statutory deadlines are still PractoCore's
                   and still maintained. Worth saying, because it is the difference
                   between a procedure that tracks the rules and one that guesses. -->
              <span v-if="baseNameOf(template)" class="text-[11px] text-muted-foreground truncate">
                Builds on {{ baseNameOf(template) }} — statutory deadlines included
              </span>
            </span>
            <Badge variant="secondary" class="shrink-0 text-[10px] font-normal">Your firm</Badge>
            <Check v-if="template.id === modelValue?.id" class="size-4 shrink-0"/>
          </button>
        </div>
      </div>

      <div class="bg-muted rounded-b-lg p-2 border border-t-0 flex flex-row gap-3 items-center">
        <span class="text-sm ibm-plex-serif w-full">
          Not the procedure you run? Build your firm's own.
        </span>
        <Button type="button" variant="outline" size="xs" @click="openStudio">
          <Scale class="size-3 mr-1"/> Build one
        </Button>
      </div>
    </div>
    <div v-else-if="loading === false && filteredTemplates.length === 0"
         class="flex flex-col p-4 border rounded-lg h-full gap-2 items-center text-center">
      <span class="text-sm">No procedure matches that.</span>
      <span class="text-xs text-muted-foreground max-w-sm">
        Procedure varies by forum and by firm. If the one you run isn't here, build it in Matter Studio —
        it stays private to your firm.
      </span>
      <Button type="button" variant="outline" size="sm" class="mt-1" @click="openStudio">
        <Scale class="size-3.5 mr-1"/> Build your own procedure
      </Button>
    </div>
    <div v-else-if="loading === true"
         class="flex flex-col items-center justify-center p-3 border rounded-lg h-full gap-2">
      <Loader class="animate-spin size-5 text-primary"/>
    </div>
  </div>
</template>

<script setup lang="ts">
import {ref, computed, onMounted} from 'vue';
import {Search, Check, Scale} from 'lucide-vue-next';
import type {RecordModel} from 'pocketbase';
import {getTemplates} from '~/services/templates';
import {Loader} from "lucide-vue-next";
import {normalizeTemplateRecord} from '~/utils/normalizeTemplate';

const props = defineProps(['modelValue']);
const emits = defineEmits(['update:modelValue', 'templateSelected']);

const templates = ref([] as RecordModel[]);
const query = ref('');

const filteredTemplates = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return templates.value;
  return templates.value.filter(t => (t.name ?? '').toLowerCase().includes(q));
});

// An unset provenance means the row predates the column, and every such row is
// PractoCore's — the migration backfills them, so this is belt-and-braces for a
// client talking to an older backend.
const isFirmAuthored = (t: RecordModel) => t.provenance === 'firm';

// A firm procedure may extend a signed one. The pointer lives in the stored blob
// ({"extends": {...}}) rather than a column, so there is exactly one source of
// truth for it — the same JSON the engine composes from.
function baseNameOf(t: RecordModel): string {
  try {
    const raw = typeof t.template === 'string' ? JSON.parse(t.template) : t.template;
    const id = raw?.extends?.templateId;
    if (!id) return '';
    return templates.value.find((x) => x.id === id)?.name ?? 'a PractoCore procedure';
  } catch {
    return '';
  }
}
const signedTemplates = computed(() => filteredTemplates.value.filter(t => !isFirmAuthored(t)));
const firmTemplates = computed(() => filteredTemplates.value.filter(isFirmAuthored));

const loading = ref(false);

onMounted(async () => {
  loading.value = true;
  templates.value = (await getTemplates(1, 20, {filter: `name ~ '${query.value}'`}, 'order')).items;
  loading.value = false;
});

// Procedure is jurisdictional and firm-specific; there is no roadmap length at
// which PractoCore has authored everyone's practice. Where this used to say
// "coming soon" and open a mailto, it now opens the Studio.
const openStudio = () => navigateTo('/main/matters/studio');

const selectTemplate = (template: RecordModel) => {
  // Normalize to v1-compatible .data shape so all consumers work regardless of
  // whether the stored blob is a v1 template or a v2-IR bundle.
  // Pass the loaded list so an extension can be composed with its base for the
  // create form (trigger prompt + the base's intake fields).
  const normalized = normalizeTemplateRecord(template, templates.value)
  const data = normalized?.template?.data
  emits('templateSelected', normalized)
  emits('update:modelValue', {
    id: normalized.id,
    fields: data?.fields ?? [],
    triggerDatePrompt: data?.triggerDatePrompt ?? '',
    partyConfig: data?.parties,
  })
}
</script>
