<script setup lang="ts">
import * as XLSX from 'xlsx';
import { FileSpreadsheet } from 'lucide-vue-next';
import { sendDirectInvite } from '~/services/admin';
import { getSignedInUser } from '~/services/auth';
import { toast } from 'vue-sonner';
import ImportLawyersContent from './ImportLawyersContent.vue';

const emit = defineEmits(['imported']);

// ── State ────────────────────────────────────────────────────
const open = ref(false);
const step = ref<'guide' | 'preview' | 'results'>('guide');
const fileInput = ref<HTMLInputElement | null>(null);
const isDragging = ref(false);
const parsing = ref(false);
const sending = ref(false);

interface ParsedRow {
  _row: number;
  name: string;
  email: string;
  role: string;
  organisationRole: string;
  errors: string[];
}

interface ResultRow extends ParsedRow {
  status: 'success' | 'error' | 'pending';
  message?: string;
}

const rows = ref<ParsedRow[]>([]);
const results = ref<ResultRow[]>([]);

const user = getSignedInUser();

// ── Validation helpers ────────────────────────────────────────
const VALID_ROLES = ['member', 'admin'];
const VALID_ORG_ROLES = ['partner', 'senior_associate', 'associate', 'paralegal', 'intern'];
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalise(val: unknown): string {
  return String(val ?? '').trim().toLowerCase().replace(/\s+/g, '_');
}

function validateRow(raw: Record<string, unknown>, rowIndex: number): ParsedRow {
  const name = String(raw['Full Name'] ?? raw['full_name'] ?? raw['Name'] ?? raw['name'] ?? '').trim();
  const email = String(raw['Email'] ?? raw['email'] ?? '').trim().toLowerCase();
  const rolRaw = normalise(raw['Role'] ?? raw['role'] ?? 'member');
  const orgRoleRaw = normalise(raw['Organisation Role'] ?? raw['organisation_role'] ?? raw['Org Role'] ?? raw['org_role'] ?? '');

  const errors: string[] = [];

  if (!name) errors.push('Full Name is required');
  if (!email) errors.push('Email is required');
  else if (!emailRegex.test(email)) errors.push('Invalid email address');

  const role = VALID_ROLES.includes(rolRaw) ? rolRaw : 'member';
  if (rolRaw && !VALID_ROLES.includes(rolRaw)) errors.push(`Unknown role "${rolRaw}" – defaulted to "member"`);

  const organisationRole = VALID_ORG_ROLES.includes(orgRoleRaw) ? orgRoleRaw : '';
  if (orgRoleRaw && !VALID_ORG_ROLES.includes(orgRoleRaw)) errors.push(`Unknown organisation role "${orgRoleRaw}"`);

  return { _row: rowIndex, name, email, role, organisationRole, errors };
}

// ── Parse uploaded file ───────────────────────────────────────
async function parseFile(file: File) {
  parsing.value = true;
  rows.value = [];
  try {
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: 'array' });
    const sheetName = wb.SheetNames[0];
    if (!sheetName) {
      toast.error('The spreadsheet appears to be empty.');
      return;
    }
    const ws = wb.Sheets[sheetName]!;
    const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });

    if (raw.length === 0) {
      toast.error('The spreadsheet appears to be empty.');
      return;
    }

    rows.value = raw.map((r, i) => validateRow(r, i + 2));
    step.value = 'preview';
  } catch (e) {
    toast.error('Failed to parse file. Please use the sample template.');
    console.error(e);
  } finally {
    parsing.value = false;
  }
}

function onFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) parseFile(file);
}

function onDrop(e: DragEvent) {
  isDragging.value = false;
  const file = e.dataTransfer?.files?.[0];
  if (file) parseFile(file);
}

function removeRow(index: number) {
  rows.value.splice(index, 1);
}

// ── Download sample ───────────────────────────────────────────
// Removed: template is now a Google Sheet — see ImportLawyersContent.vue

// ── Send invitations ──────────────────────────────────────────
const validRows = computed(() => rows.value.filter(r => r.errors.length === 0));
const hasErrors = computed(() => rows.value.some(r => r.errors.length > 0));

async function sendInvitations() {
  if (!user?.organisation) {
    toast.error('No organisation found');
    return;
  }
  if (validRows.value.length === 0) {
    toast.error('No valid rows to import');
    return;
  }

  sending.value = true;
  results.value = validRows.value.map(r => ({ ...r, status: 'pending' as const }));
  step.value = 'results';

  const settled = await Promise.allSettled(
    validRows.value.map((row, idx) =>
      sendDirectInvite(row.email, user!.organisation!, row.role, row.name || undefined, row.organisationRole || undefined)
        .then(res => ({ idx, res }))
    )
  );

  let successCount = 0;
  settled.forEach((outcome, idx) => {
    const entry = results.value[idx];
    if (!entry) return;
    if (outcome.status === 'fulfilled') {
      const { res } = outcome.value;
      if (res?.message || res?.invite) {
        entry.status = 'success';
        entry.message = res.message ?? 'Invitation sent';
        successCount++;
      } else {
        entry.status = 'error';
        entry.message = res?.error ?? 'Failed to send';
      }
    } else {
      entry.status = 'error';
      entry.message = 'Network error';
    }
  });

  sending.value = false;
  toast.success(`${successCount} of ${validRows.value.length} invitations sent`);
  emit('imported');
}

// ── Reset on close ────────────────────────────────────────────
watch(open, (val) => {
  if (!val) {
    setTimeout(() => {
      step.value = 'guide';
      rows.value = [];
      results.value = [];
      if (fileInput.value) fileInput.value.value = '';
    }, 300);
  }
});

// ── Role display helpers ──────────────────────────────────────
const roleLabels: Record<string, string> = {
  member: 'Member', admin: 'Admin',
};
const orgRoleLabels: Record<string, string> = {
  partner: 'Partner',
  senior_associate: 'Senior Associate',
  associate: 'Associate',
  paralegal: 'Paralegal',
  intern: 'Intern',
};

const successCount = computed(() => results.value.filter(r => r.status === 'success').length);
const errorCount = computed(() => results.value.filter(r => r.status === 'error').length);
</script>

<template>
  <!-- Desktop: Dialog -->
  <Dialog v-if="$viewport.isGreaterOrEquals('customxs')" v-model:open="open">
    <DialogTrigger as-child>
      <slot />
    </DialogTrigger>

    <DialogContent class="max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <FileSpreadsheet class="size-5 text-primary" />
          Import Lawyers in Bulk
        </DialogTitle>
        <DialogDescription>
          Upload an Excel or CSV file to send invitations to multiple lawyers at once.
        </DialogDescription>
      </DialogHeader>

      <div class="flex-1 overflow-y-auto min-h-0">
        <ImportLawyersContent
          :step="step"
          :rows="rows"
          :results="results"
          :valid-rows="validRows"
          :has-errors="hasErrors"
          :parsing="parsing"
          :sending="sending"
          :success-count="successCount"
          :error-count="errorCount"
          :role-labels="roleLabels"
          :org-role-labels="orgRoleLabels"
          :is-dragging="isDragging"
          :file-input="fileInput"
          @file-change="onFileChange"
          @drop="onDrop"
          @drag-enter="isDragging = true"
          @drag-leave="isDragging = false"
          @remove-row="removeRow"
          @go-back="step = 'guide'; rows = []"
          @send="sendInvitations"
          @close="open = false"
        />
      </div>
    </DialogContent>
  </Dialog>

  <!-- Mobile: Sheet -->
  <Sheet v-else v-model:open="open">
    <SheetTrigger as-child>
      <slot />
    </SheetTrigger>

    <SheetContent class="w-full overflow-y-scroll flex flex-col">
      <SheetHeader>
        <SheetTitle class="flex items-center gap-2">
          <FileSpreadsheet class="size-5 text-primary" />
          Import Lawyers in Bulk
        </SheetTitle>
        <SheetDescription>
          Upload an Excel or CSV file to invite multiple lawyers at once.
        </SheetDescription>
      </SheetHeader>

      <div class="flex-1 overflow-y-auto">
        <ImportLawyersContent
          :step="step"
          :rows="rows"
          :results="results"
          :valid-rows="validRows"
          :has-errors="hasErrors"
          :parsing="parsing"
          :sending="sending"
          :success-count="successCount"
          :error-count="errorCount"
          :role-labels="roleLabels"
          :org-role-labels="orgRoleLabels"
          :is-dragging="isDragging"
          :file-input="fileInput"
          @file-change="onFileChange"
          @drop="onDrop"
          @drag-enter="isDragging = true"
          @drag-leave="isDragging = false"
          @remove-row="removeRow"
          @go-back="step = 'guide'; rows = []"
          @send="sendInvitations"
          @close="open = false"
        />
      </div>
    </SheetContent>
  </Sheet>
</template>

