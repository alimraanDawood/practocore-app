<template>
    <div class="flex flex-col gap-3">
        <div class="flex items-center justify-between gap-2">
            <div class="flex flex-col">
                <span class="text-sm font-medium">Proof of completion</span>
                <span class="text-xs text-muted-foreground">
                    {{ expected.length
                        ? "What this step should produce, per the procedure. Optional."
                        : "Optional. What was filed, the registry's reference, who checked it." }}
                </span>
            </div>
            <Button type="button" variant="outline" size="sm" @click="addRow">
                <Plus class="mr-1 h-3.5 w-3.5" />
                Add
            </Button>
        </div>

        <p v-if="!usableCount" class="text-xs text-muted-foreground">
            Nothing attached — this step will be recorded as completed but unevidenced.
        </p>

        <div v-for="(row, i) in rows" :key="i" class="flex flex-col gap-2 rounded-md border p-3">
            <!-- The procedure's own words for what belongs here. Only present on
                 rows seeded from the template; a row the user added has none. -->
            <div v-if="hints[i]" class="flex min-w-0 items-center gap-1.5 text-xs font-medium">
                <span class="truncate" :title="hints[i].label">{{ hints[i].label }}</span>
                <span v-if="hints[i].optional" class="font-normal text-muted-foreground">(if applicable)</span>
            </div>

            <div class="flex items-center gap-2">
                <Select :model-value="row.kind" @update:model-value="(v: any) => row.kind = v">
                    <SelectTrigger class="h-8 min-w-0 flex-1 text-xs">
                        <SelectValue placeholder="Kind" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem v-for="k in EVIDENCE_KINDS" :key="k" :value="k">
                            {{ EVIDENCE_KIND_LABELS[k] }}
                        </SelectItem>
                    </SelectContent>
                </Select>
                <Button type="button" variant="ghost" size="icon" class="h-8 w-8 shrink-0" @click="removeRow(i)">
                    <X class="h-4 w-4" />
                </Button>
            </div>

            <!-- The document is picked from this matter's vault, not re-uploaded
                 as a second copy. Upload is the fallback when it is not there
                 yet, and it uploads INTO the matter's vault so the file keeps
                 its preview, OCR and extracted facts. -->
            <!-- min-w-0 on the flex child: without it the picker refuses to
                 shrink below its content and a long filename pushes the whole
                 row past the edge of the dialog. -->
            <!-- One control, full width. Upload used to sit beside the picker
                 and was the first thing to be clipped on a narrow screen; it now
                 lives inside the picker, where it is also the answer to an empty
                 vault. -->
            <div class="min-w-0">
                <SharedDeadlineCompleteDeadlineDocumentPicker
                    v-model="row.document"
                    :documents="documents"
                    :loading="documentsLoading"
                    :uploading="uploadingIndex === i"
                    @upload="pickFile(i)" />
            </div>

            <Input v-model="row.reference" class="h-8 text-xs" placeholder="Receipt / registration number" />
            <Input v-model="row.note" class="h-8 text-xs" placeholder="Note (optional)" />

            <label class="flex items-center gap-2 text-xs text-muted-foreground">
                <Checkbox :model-value="row.verifiedBy === userId"
                          @update:model-value="(v: any) => setVerified(row, !!v)" />
                I have checked this against the original
            </label>

            <p v-if="!isUsable(row)" class="text-xs text-amber-600 dark:text-amber-500">
                Add a document, a reference or a note — an empty entry would show as proof where there is none.
            </p>
        </div>

        <input ref="fileInput" type="file" class="hidden" @change="onFileChosen" />
    </div>
</template>

<script setup lang="ts">
import { Plus, X } from 'lucide-vue-next';
import { toast } from 'vue-sonner';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Checkbox } from '~/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { EVIDENCE_KINDS, EVIDENCE_KIND_LABELS, getExpectedArtefacts, type DeadlineEvidenceInput, type ExpectedArtefact } from '~/services/matters';
import { listDocuments, uploadDocument, type VaultDocument } from '~/services/vault';
import { getSignedInUser } from '~/services/auth';

const props = defineProps<{ matterId: string; deadlineId?: string; isEvent?: boolean }>();
const rows = defineModel<DeadlineEvidenceInput[]>({ required: true });

const expected = ref<ExpectedArtefact[]>([]);
// Parallel to rows by index, and deliberately NOT a field on the row itself:
// rows are the request payload, and the procedure's label is not something the
// server should be told back.
const hints = ref<(ExpectedArtefact | null)[]>([]);
const documents = ref<VaultDocument[]>([]);
const documentsLoading = ref(false);
const uploadingIndex = ref<number | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);
const userId = getSignedInUser()?.id;

const isUsable = (row: DeadlineEvidenceInput) =>
    !!((row.document || '').trim() || (row.reference || '').trim() || (row.note || '').trim());

// Declared after isUsable: a computed getter runs lazily, but ordering it this
// way keeps the file readable and cannot trip the TDZ if that ever changes.
const usableCount = computed(() => rows.value.filter(isUsable).length);

function addRow() {
    rows.value.push({ kind: 'filed', document: '', reference: '', note: '' });
    hints.value.push(null);
    if (!documents.value.length) loadDocuments();
}

function removeRow(i: number) {
    rows.value.splice(i, 1);
    hints.value.splice(i, 1);
}

/**
 * Seed one row per artefact the procedure expects, so the dialog asks for the
 * registry receipt by name instead of leaving the lawyer to know it belongs
 * there. Seeded rows are empty and empty rows are dropped on submit, so
 * offering them costs nothing when a step really produced only one document.
 */
async function loadExpected() {
    if (!props.deadlineId || rows.value.length) return;
    try {
        expected.value = await getExpectedArtefacts(props.deadlineId, props.isEvent);
    } catch (e) {
        // A template that declares nothing, or will not resolve, simply offers
        // no defaults — it must never block recording a completion.
        console.error(e);
        return;
    }
    if (!expected.value.length) return;
    for (const a of expected.value) {
        rows.value.push({ kind: a.kind, document: '', reference: '', note: '' });
        hints.value.push(a);
    }
    loadDocuments();
}

// verifiedAt is stamped alongside verifiedBy: a verifier with no date is half a
// record, and the date it was checked is not always the date it was filed.
function setVerified(row: DeadlineEvidenceInput, checked: boolean) {
    row.verifiedBy = checked ? userId : '';
    row.verifiedAt = checked ? new Date().toISOString().slice(0, 10) : '';
}

async function loadDocuments() {
    if (!props.matterId) return;
    documentsLoading.value = true;
    try {
        documents.value = await listDocuments('matter', props.matterId);
    } catch (e) {
        console.error(e);
    }
    documentsLoading.value = false;
}

function pickFile(index: number) {
    uploadingIndex.value = index;
    fileInput.value?.click();
}

async function onFileChosen(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    const index = uploadingIndex.value;
    input.value = '';
    if (!file || index === null) {
        uploadingIndex.value = null;
        return;
    }
    try {
        const result = await uploadDocument({ file, scope: 'matter', scopeId: props.matterId });
        await loadDocuments();
        const row = rows.value[index];
        if (row) row.document = result.id;
        toast.success('Document attached to this matter.');
    } catch (err: any) {
        toast.error(err?.message || 'We were unable to upload that document.');
    }
    uploadingIndex.value = null;
}

onMounted(() => {
    loadExpected();
    if (rows.value.length) loadDocuments();
});
</script>
