<script lang="ts" setup>
import { Briefcase, Plus, Loader2, Wand2 } from 'lucide-vue-next';
import {
  listEngagements, listEngagementTemplates, createEngagement,
  type Engagement, type EngagementTemplate,
} from '~/services/engagements';

definePageMeta({ layout: 'default' });

const router = useRouter();

const engagements = ref<Engagement[]>([]);
const loading = ref(true);
const loadError = ref('');

async function refresh() {
  loading.value = true;
  loadError.value = '';
  try {
    const res = await listEngagements(1, 50);
    engagements.value = res.items;
  } catch (e: any) {
    loadError.value = e?.message || 'Could not load engagements.';
  } finally {
    loading.value = false;
  }
}
onMounted(refresh);

// ── Create dialog ────────────────────────────────────────────────────────
const createOpen = ref(false);
const templates = ref<EngagementTemplate[]>([]);
const templatesLoading = ref(false);
const form = reactive({ templateId: '', name: '', targetDate: '' });
const creating = ref(false);
const createError = ref('');

async function openCreate() {
  createOpen.value = true;
  createError.value = '';
  form.templateId = '';
  form.name = '';
  form.targetDate = '';
  if (templates.value.length === 0) {
    templatesLoading.value = true;
    try {
      templates.value = await listEngagementTemplates();
      if (templates.value[0]) form.templateId = templates.value[0].id;
    } catch (e: any) {
      createError.value = e?.message || 'Could not load templates.';
    } finally {
      templatesLoading.value = false;
    }
  } else if (templates.value[0]) {
    form.templateId = templates.value[0].id;
  }
}

async function submitCreate() {
  if (!form.templateId || !form.name.trim()) return;
  creating.value = true;
  createError.value = '';
  try {
    const res = await createEngagement({
      templateId: form.templateId,
      name: form.name.trim(),
      targetDate: form.targetDate || undefined,
    });
    createOpen.value = false;
    await router.push(`/main/engagements/${res.engagement.id}`);
  } catch (e: any) {
    createError.value = e?.message || 'Could not create engagement.';
  } finally {
    creating.value = false;
  }
}

function statusVariant(status: string) {
  switch (status) {
    case 'active': return 'default';
    case 'completed': return 'secondary';
    case 'archived': return 'outline';
    default: return 'outline';
  }
}
</script>

<template>
  <div class="flex flex-col w-full h-full overflow-y-auto p-4 sm:p-6 gap-6">
    <div class="flex items-center justify-between gap-4">
      <div>
        <h1 class="text-xl font-semibold flex items-center gap-2">
          <Briefcase class="size-5" />
          Engagements
        </h1>
        <p class="text-sm text-muted-foreground">
          Advisory, transactional, and regulatory work — anything that isn't a court case.
        </p>
      </div>
      <div class="flex items-center gap-2">
        <Button variant="outline" @click="router.push('/main/engagements/studio')">
          <Wand2 class="size-4 mr-1.5" />
          Build a playbook
        </Button>
        <Button @click="openCreate">
          <Plus class="size-4 mr-1.5" />
          New engagement
        </Button>
      </div>
    </div>

    <div v-if="loading" class="flex items-center justify-center py-16 text-muted-foreground">
      <Loader2 class="size-5 animate-spin mr-2" /> Loading…
    </div>
    <div v-else-if="loadError" class="text-sm text-destructive py-8">{{ loadError }}</div>
    <div v-else-if="engagements.length === 0" class="flex flex-col items-center justify-center py-16 text-center gap-2 text-muted-foreground">
      <Briefcase class="size-8" />
      <p>No engagements yet.</p>
      <Button variant="outline" size="sm" @click="openCreate">Create your first engagement</Button>
    </div>
    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <Card
        v-for="e in engagements"
        :key="e.id"
        class="cursor-pointer hover:border-primary/40 transition-colors"
        @click="router.push(`/main/engagements/${e.id}`)"
      >
        <CardHeader>
          <div class="flex items-start justify-between gap-2">
            <CardTitle class="text-base">{{ e.name }}</CardTitle>
            <Badge :variant="statusVariant(e.status)">{{ e.status }}</Badge>
          </div>
          <CardDescription v-if="e.expand?.template">{{ e.expand.template.name }}</CardDescription>
        </CardHeader>
        <CardContent v-if="e.targetDate" class="text-sm text-muted-foreground">
          Target: {{ new Date(e.targetDate).toLocaleDateString() }}
        </CardContent>
      </Card>
    </div>

    <Dialog v-model:open="createOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New engagement</DialogTitle>
          <DialogDescription>Pick a playbook, name the engagement, and set a target date if you have one.</DialogDescription>
        </DialogHeader>
        <div class="flex flex-col gap-4 py-2">
          <div class="flex flex-col gap-1.5">
            <Label>Playbook</Label>
            <Select v-model="form.templateId" :disabled="templatesLoading">
              <SelectTrigger class="w-full">
                <SelectValue placeholder="Select a template" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="t in templates" :key="t.id" :value="t.id">{{ t.name }}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="flex flex-col gap-1.5">
            <Label>Name</Label>
            <Input v-model="form.name" placeholder="e.g. Nakato Ltd — Incorporation" />
          </div>
          <div class="flex flex-col gap-1.5">
            <Label>Target date (optional)</Label>
            <Input v-model="form.targetDate" type="date" />
          </div>
          <p v-if="createError" class="text-sm text-destructive">{{ createError }}</p>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="createOpen = false">Cancel</Button>
          <Button :disabled="creating || !form.templateId || !form.name.trim()" @click="submitCreate">
            <Loader2 v-if="creating" class="size-4 animate-spin mr-1.5" />
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
