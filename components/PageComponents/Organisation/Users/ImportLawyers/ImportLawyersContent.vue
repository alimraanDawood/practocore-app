<script setup lang="ts">
import {
  Upload,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Trash2,
  Send,
  ArrowLeft,
  Loader2,
  Info,
  ExternalLink,
  FileSpreadsheet,
} from 'lucide-vue-next';

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

const props = defineProps<{
  step: 'guide' | 'preview' | 'results';
  rows: ParsedRow[];
  results: ResultRow[];
  validRows: ParsedRow[];
  hasErrors: boolean;
  parsing: boolean;
  sending: boolean;
  successCount: number;
  errorCount: number;
  roleLabels: Record<string, string>;
  orgRoleLabels: Record<string, string>;
  isDragging: boolean;
  fileInput: HTMLInputElement | null;
}>();

const emit = defineEmits<{
  (e: 'fileChange', event: Event): void;
  (e: 'drop', event: DragEvent): void;
  (e: 'dragEnter'): void;
  (e: 'dragLeave'): void;
  (e: 'removeRow', index: number): void;
  (e: 'goBack'): void;
  (e: 'send'): void;
  (e: 'close'): void;
}>();

const localFileInput = ref<HTMLInputElement | null>(null);

function triggerFilePick() {
  localFileInput.value?.click();
}

// The /copy suffix prompts each user to save their own private copy to
// their own Google Drive — no firm can view or edit another firm's data.
const GOOGLE_SHEET_TEMPLATE_URL =
  'https://docs.google.com/spreadsheets/d/1j4JRkPvbiXXX0kp6prB6Dc7LR2HtlYjT1rc7njBwhiM/copy';

function openTemplate() {
  window.open(GOOGLE_SHEET_TEMPLATE_URL, '_blank', 'noopener,noreferrer');
}
</script>

<template>
  <div class="flex flex-col gap-4 p-1">

    <!-- ── STEP 1: Guide ──────────────────────────────── -->
    <template v-if="step === 'guide'">
      <!-- How it works -->
      <div class="flex flex-col gap-3 p-4 rounded-lg border bg-muted/30">
        <div class="flex items-center gap-2">
          <Info class="size-4 text-primary shrink-0" />
          <span class="font-semibold text-sm">How it works</span>
        </div>
        <ol class="flex flex-col gap-2 pl-1 text-sm text-muted-foreground list-decimal list-inside">
          <li>Open the Google Sheets template and click <strong class="text-foreground">Make a copy</strong> — it saves privately to your own Google Drive.</li>
          <li>Fill in each lawyer's details, one row per person. Use the built-in dropdowns for Role and Organisation Role.</li>
          <li>When done, go to <strong class="text-foreground">File → Download → Microsoft Excel (.xlsx)</strong> or <em>CSV</em>.</li>
          <li>Upload the downloaded file below and review before sending invitations.</li>
        </ol>
      </div>

      <!-- Open template button -->
      <Button class="w-full" @click="openTemplate">
        <FileSpreadsheet class="size-4 mr-2" />
        Open Template in Google Sheets
        <ExternalLink class="size-3.5 ml-2 opacity-70" />
      </Button>

      <!-- Privacy note -->
      <p class="text-xs text-muted-foreground text-center -mt-1">
        Each firm gets their own private copy — your data is never shared with other firms.
      </p>

      <!-- Column guide -->
      <div class="flex flex-col gap-2">
        <p class="text-sm font-semibold">Column reference</p>
        <div class="rounded-md border overflow-hidden text-sm">
          <table class="w-full">
            <thead class="bg-muted/50">
              <tr>
                <th class="text-left px-3 py-2 font-medium text-muted-foreground">Column</th>
                <th class="text-left px-3 py-2 font-medium text-muted-foreground">Accepted values</th>
              </tr>
            </thead>
            <tbody class="divide-y">
              <tr>
                <td class="px-3 py-2 font-medium">Full Name</td>
                <td class="px-3 py-2 text-muted-foreground">Any text (required)</td>
              </tr>
              <tr>
                <td class="px-3 py-2 font-medium">Email</td>
                <td class="px-3 py-2 text-muted-foreground">Valid email (required)</td>
              </tr>
              <tr>
                <td class="px-3 py-2 font-medium">Role</td>
                <td class="px-3 py-2 font-mono text-xs text-muted-foreground">member · admin</td>
              </tr>
              <tr>
                <td class="px-3 py-2 font-medium">Organisation Role</td>
                <td class="px-3 py-2 font-mono text-xs text-muted-foreground leading-relaxed">
                  partner · senior_associate<br/>associate · paralegal · intern
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Divider -->
      <div class="flex items-center gap-3">
        <div class="flex-1 border-t" />
        <span class="text-xs text-muted-foreground">then upload your exported file</span>
        <div class="flex-1 border-t" />
      </div>

      <!-- Drop zone -->
      <div
        class="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 text-center transition-colors cursor-pointer"
        :class="isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30'"
        @click="triggerFilePick"
        @dragover.prevent
        @dragenter.prevent="emit('dragEnter')"
        @dragleave.prevent="emit('dragLeave')"
        @drop.prevent="emit('drop', $event)"
      >
        <div v-if="parsing" class="flex flex-col items-center gap-2">
          <Loader2 class="size-8 text-primary animate-spin" />
          <p class="text-sm text-muted-foreground">Parsing file…</p>
        </div>
        <template v-else>
          <Upload class="size-8 text-muted-foreground" />
          <div>
            <p class="text-sm font-medium">Drop your exported file here or click to browse</p>
            <p class="text-xs text-muted-foreground mt-1">Supports .xlsx, .xls and .csv</p>
          </div>
        </template>
      </div>

      <input
        ref="localFileInput"
        type="file"
        accept=".xlsx,.xls,.csv"
        class="hidden"
        @change="emit('fileChange', $event)"
      />
    </template>

    <!-- ── STEP 2: Preview ────────────────────────────── -->
    <template v-else-if="step === 'preview'">
      <!-- Summary bar -->
      <div class="flex flex-row items-center justify-between gap-2 flex-wrap">
        <div class="flex items-center gap-2">
          <Badge variant="secondary">{{ rows.length }} row{{ rows.length === 1 ? '' : 's' }}</Badge>
          <Badge v-if="validRows.length" class="bg-green-500/15 text-green-700 border-green-200">
            <CheckCircle2 class="size-3 mr-1" />
            {{ validRows.length }} valid
          </Badge>
          <Badge v-if="hasErrors" variant="destructive">
            <AlertCircle class="size-3 mr-1" />
            {{ rows.length - validRows.length }} issue{{ rows.length - validRows.length === 1 ? '' : 's' }}
          </Badge>
        </div>
        <Button variant="ghost" size="sm" @click="emit('goBack')">
          <ArrowLeft class="size-4 mr-1" />
          Re-upload
        </Button>
      </div>

      <!-- Rows table -->
      <div class="rounded-md border overflow-hidden">
        <div class="overflow-x-auto max-h-[40vh] overflow-y-auto">
          <table class="w-full text-sm">
            <thead class="bg-muted/50 sticky top-0">
              <tr>
                <th class="text-left px-3 py-2 font-medium text-muted-foreground w-8">#</th>
                <th class="text-left px-3 py-2 font-medium text-muted-foreground">Name</th>
                <th class="text-left px-3 py-2 font-medium text-muted-foreground">Email</th>
                <th class="text-left px-3 py-2 font-medium text-muted-foreground">Role</th>
                <th class="text-left px-3 py-2 font-medium text-muted-foreground">Org Role</th>
                <th class="w-8 px-2"></th>
              </tr>
            </thead>
            <tbody class="divide-y">
              <tr
                v-for="(row, idx) in rows"
                :key="idx"
                :class="row.errors.length ? 'bg-red-50 dark:bg-red-950/20' : ''"
              >
                <td class="px-3 py-2 text-muted-foreground">{{ row._row }}</td>
                <td class="px-3 py-2 font-medium">
                  {{ row.name || '—' }}
                </td>
                <td class="px-3 py-2">{{ row.email || '—' }}</td>
                <td class="px-3 py-2">
                  <Badge variant="outline" class="text-xs">
                    {{ roleLabels[row.role] ?? row.role }}
                  </Badge>
                </td>
                <td class="px-3 py-2">
                  <Badge v-if="row.organisationRole" variant="outline" class="text-xs">
                    {{ orgRoleLabels[row.organisationRole] ?? row.organisationRole }}
                  </Badge>
                  <span v-else class="text-muted-foreground text-xs">—</span>
                </td>
                <td class="px-2 py-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    class="size-7 text-muted-foreground hover:text-destructive"
                    @click="emit('removeRow', idx)"
                  >
                    <Trash2 class="size-3.5" />
                  </Button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Inline errors -->
      <div v-if="hasErrors" class="flex flex-col gap-1.5">
        <p class="text-xs font-semibold text-destructive flex items-center gap-1.5">
          <AlertCircle class="size-3.5" />
          Rows with issues — fix the file and re-upload, or remove the rows above
        </p>
        <ul class="flex flex-col gap-1">
          <li
            v-for="row in rows.filter(r => r.errors.length)"
            :key="row._row"
            class="text-xs text-destructive bg-destructive/5 rounded px-2 py-1"
          >
            <span class="font-medium">Row {{ row._row }}:</span>
            {{ row.errors.join(' · ') }}
          </li>
        </ul>
      </div>

      <!-- Actions -->
      <div class="flex flex-col gap-2 pt-1">
        <Button
          class="w-full"
          :disabled="validRows.length === 0"
          @click="emit('send')"
        >
          <Send class="size-4 mr-2" />
          Send {{ validRows.length }} Invitation{{ validRows.length === 1 ? '' : 's' }}
        </Button>
        <p v-if="hasErrors && validRows.length > 0" class="text-xs text-center text-muted-foreground">
          Rows with errors will be skipped — only valid rows will be invited.
        </p>
      </div>
    </template>

    <!-- ── STEP 3: Results ────────────────────────────── -->
    <template v-else-if="step === 'results'">
      <!-- Summary -->
      <div
        v-if="!sending"
        class="flex flex-col items-center gap-2 py-4 text-center"
      >
        <div class="size-12 rounded-full flex items-center justify-center"
          :class="errorCount === 0 ? 'bg-green-100 dark:bg-green-900/30' : 'bg-amber-100 dark:bg-amber-900/30'">
          <CheckCircle2
            v-if="errorCount === 0"
            class="size-6 text-green-600"
          />
          <AlertCircle v-else class="size-6 text-amber-600" />
        </div>
        <p class="font-semibold">
          {{ errorCount === 0 ? 'All invitations sent!' : `${successCount} sent, ${errorCount} failed` }}
        </p>
        <p class="text-sm text-muted-foreground">
          {{ successCount }} lawyer{{ successCount === 1 ? '' : 's' }} will receive an email invitation.
        </p>
      </div>

      <div v-else class="flex flex-col items-center gap-3 py-6">
        <Loader2 class="size-8 text-primary animate-spin" />
        <p class="text-sm text-muted-foreground">Sending invitations…</p>
      </div>

      <!-- Per-row results -->
      <div class="rounded-md border overflow-hidden">
        <div class="overflow-x-auto max-h-[40vh] overflow-y-auto">
          <table class="w-full text-sm">
            <thead class="bg-muted/50 sticky top-0">
              <tr>
                <th class="text-left px-3 py-2 font-medium text-muted-foreground">Name</th>
                <th class="text-left px-3 py-2 font-medium text-muted-foreground">Email</th>
                <th class="text-left px-3 py-2 font-medium text-muted-foreground w-24">Status</th>
              </tr>
            </thead>
            <tbody class="divide-y">
              <tr v-for="(r, idx) in results" :key="idx">
                <td class="px-3 py-2 font-medium">{{ r.name }}</td>
                <td class="px-3 py-2 text-muted-foreground">{{ r.email }}</td>
                <td class="px-3 py-2">
                  <div v-if="r.status === 'pending'" class="flex items-center gap-1 text-muted-foreground">
                    <Loader2 class="size-3.5 animate-spin" />
                    <span class="text-xs">Sending</span>
                  </div>
                  <div v-else-if="r.status === 'success'" class="flex items-center gap-1 text-green-600">
                    <CheckCircle2 class="size-3.5" />
                    <span class="text-xs">Sent</span>
                  </div>
                  <div v-else class="flex items-center gap-1 text-destructive">
                    <XCircle class="size-3.5" />
                    <span class="text-xs">{{ r.message ?? 'Failed' }}</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <Button class="w-full" variant="outline" @click="emit('close')">
        Done
      </Button>
    </template>

  </div>
</template>

