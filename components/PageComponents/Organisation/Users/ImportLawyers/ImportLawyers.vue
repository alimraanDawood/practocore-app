<script setup lang="ts">
import * as XLSX from 'xlsx';
import { FileSpreadsheet } from 'lucide-vue-next';
import { sendDirectInvite, getOrganisationRoles } from '~/services/admin';
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
// Names the downloaded file, so a partner with two firms open does not end up
// with two identically named templates in their downloads folder.
const authStore = useAuthStore();
const organisationName = computed(() => authStore.organisation?.name ?? '');

// ── Validation helpers ────────────────────────────────────────
//
// Authority is a fixed set — owner is absent because ownership moves by transfer
// rather than being granted, and certainly not by spreadsheet.
const VALID_ROLES = ['member', 'admin'];

// Titles are the FIRM'S, not a hardcoded five.
//
// A title now carries a permission bundle and a firm may rename one or define its
// own. Validating against the seeded five meant a firm that renamed "Paralegal"
// to "Legal Assistant" had every such row rejected as an unknown title and
// silently fall through to the server's default — which, since an invited member
// now inherits their title's bundle, is not "no permissions" any more. It is the
// associate bundle.
const VALID_ORG_ROLES = ref<string[]>(['partner', 'senior_associate', 'associate', 'paralegal', 'intern']);
const orgRoleLabels = ref<Record<string, string>>({
  partner: 'Partner',
  senior_associate: 'Senior Associate',
  associate: 'Associate',
  paralegal: 'Paralegal',
  intern: 'Intern',
});
// What a row with a blank Title column will actually be given. The server picks
// this when none is sent, and the preview names it rather than showing a dash
// that hides a real grant.
const defaultOrgRole = ref('associate');
// Carried into the generated template's Titles sheet, so whoever fills the file
// in can see what each title actually allows.
const orgRoleDescriptions = ref<Record<string, string>>({});

// Held so parseFile can await it. Opening the dialog and immediately dropping a
// file is a real sequence, and validating against the seeded five while the
// firm's own titles were still in flight would reject rows that are correct.
let firmRolesLoaded: Promise<void> | null = null;

async function loadFirmRoles() {
  if (!user?.organisation) return;
  try {
    const response: any = await getOrganisationRoles(user.organisation);
    const roles = response?.roles ?? [];
    if (!roles.length) return;
    VALID_ORG_ROLES.value = roles.map((r: any) => r.key);
    orgRoleLabels.value = Object.fromEntries(roles.map((r: any) => [r.key, r.label]));
    orgRoleDescriptions.value = Object.fromEntries(roles.map((r: any) => [r.key, r.description ?? '']));
    if (!VALID_ORG_ROLES.value.includes(defaultOrgRole.value)) {
      defaultOrgRole.value = VALID_ORG_ROLES.value[0];
    }
  } catch (e) {
    // Keep the seeded five. A failed lookup must not make every row invalid.
    console.error('Failed to load organisation roles:', e);
  }
}

// A written title, matched to one of the firm's role keys. Returns null when it
// matches nothing, which is the only case that is an error.
function resolveTitle(written: string): string | null {
  if (!written) return null;
  if (VALID_ORG_ROLES.value.includes(written)) return written;
  for (const [key, label] of Object.entries(orgRoleLabels.value)) {
    if (normalise(label) === written) return key;
  }
  return null;
}

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalise(val: unknown): string {
  return String(val ?? '').trim().toLowerCase().replace(/\s+/g, '_');
}

// Header lookup that does not care about case, spacing or punctuation.
//
// The previous version indexed the parsed row by EXACT string — `raw['Email']`
// or `raw['email']` and nothing else — so a sheet with "EMAIL", "E-mail" or a
// stray trailing space in the header silently yielded an empty column and every
// row failed as "Email is required", with nothing on screen explaining why.
function cell(raw: Record<string, unknown>, ...aliases: string[]): string {
  const key = (s: string) => s.trim().toLowerCase().replace(/[\s_-]+/g, '');
  const index: Record<string, unknown> = {};
  for (const [header, value] of Object.entries(raw)) index[key(header)] = value;
  for (const alias of aliases) {
    const value = index[key(alias)];
    if (value !== undefined && String(value).trim() !== '') return String(value).trim();
  }
  return '';
}

function validateRow(raw: Record<string, unknown>, rowIndex: number): ParsedRow {
  const name = cell(raw, 'Full Name', 'Name');
  const email = cell(raw, 'Email', 'Email Address').toLowerCase();
  // Canonical headers first. `Role` and `Organisation Role` are kept as silent
  // aliases: they cost nothing, and a sheet written against the older template
  // should not fail for a naming decision the product made afterwards.
  const rolRaw = normalise(cell(raw, 'Authority', 'Role') || 'member');
  const orgRoleRaw = normalise(cell(raw, 'Title', 'Organisation Role', 'Org Role'));

  const errors: string[] = [];

  if (!name) errors.push('Full Name is required');
  if (!email) errors.push('Email is required');
  else if (!emailRegex.test(email)) errors.push('Invalid email address');

  const role = VALID_ROLES.includes(rolRaw) ? rolRaw : 'member';
  if (rolRaw && rolRaw !== 'member' && !VALID_ROLES.includes(rolRaw)) {
    errors.push(`Unknown authority "${rolRaw}" — use Member or Admin. Defaulted to Member.`);
  }

  // Matched against the firm's KEYS *and* its LABELS.
  //
  // A firm may rename a title — the label changes, the key does not. Everywhere
  // else in the app shows the label, so that is what somebody types into the
  // sheet; matching only keys would reject the very name the product told them
  // to use. A firm that renamed Paralegal to "Legal Assistant" can write either.
  //
  // A blank Title is not an error — it means "the firm's default" — but it is
  // resolved HERE so the preview shows the title the person will actually get.
  // An invited member now inherits that title's permissions, so a blank cell is
  // a grant and the admin should be able to see which one.
  const matched = resolveTitle(orgRoleRaw);
  const organisationRole = matched ?? defaultOrgRole.value;
  if (orgRoleRaw && !matched) {
    errors.push(`Unknown title "${orgRoleRaw}" — this firm uses: ${Object.values(orgRoleLabels.value).join(', ')}`);
  }

  return { _row: rowIndex, name, email, role, organisationRole, errors };
}

// ── Parse uploaded file ───────────────────────────────────────
async function parseFile(file: File) {
  parsing.value = true;
  rows.value = [];
  try {
    await (firmRolesLoaded ??= loadFirmRoles());
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
// The template is generated from this firm's own titles — see ./template.ts,
// invoked from ImportLawyersContent.vue.

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
      sendDirectInvite(row.email, user!.organisation!, row.role, row.name || undefined, row.organisationRole)
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

// The firm's titles are needed before a file is validated against them, so this
// runs when the dialog opens rather than on mount — the trigger may sit on a page
// the admin never opens it from.
watch(open, (val) => { if (val && !firmRolesLoaded) firmRolesLoaded = loadFirmRoles(); });

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

// ── Display helpers ───────────────────────────────────────────
const roleLabels: Record<string, string> = { member: 'Member', admin: 'Admin' };

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
          :role-descriptions="orgRoleDescriptions"
          :organisation-name="organisationName"
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

      <div class="flex-1 overflow-y-auto p-3">
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
          :role-descriptions="orgRoleDescriptions"
          :organisation-name="organisationName"
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

