<template>
    <!--
        A completed step reads one of two ways, and the second is the one worth
        building: "done, proven" or "done, unevidenced". The absence is the whole
        point of P4 — a docket where everything is ticked and nothing is proven
        is exactly the file that fails a taxation.
    -->
    <div class="flex flex-col gap-1.5">
        <div v-if="current.length" class="flex flex-row flex-wrap items-center gap-1.5">
            <component
                :is="row.document ? 'button' : 'span'"
                v-for="row in current"
                :key="row.id"
                type="button"
                class="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground"
                :class="row.document && 'hover:bg-muted hover:text-foreground'"
                :title="tooltipFor(row)"
                @click="row.document && openDocument(row)">
                <component :is="iconFor(row.kind)" class="size-3 shrink-0" />
                <span class="max-w-[16rem] truncate">{{ middleTruncate(labelFor(row), 40) }}</span>
                <ShieldCheck v-if="row.verifiedBy" class="size-3 shrink-0 text-emerald-600 dark:text-emerald-500" />
            </component>
        </div>

        <div v-else class="flex flex-row items-center gap-1 text-[11px] text-muted-foreground">
            <FileQuestion class="size-3 shrink-0" />
            <span>Completed, no proof recorded</span>
        </div>

        <!--
            Superseded proof is shown, not hidden. "We filed on the 3rd" does not
            stop being true because the record was later corrected to the 4th; it
            becomes part of the history of the file.
        -->
        <div v-if="superseded.length" class="flex flex-row flex-wrap items-center gap-1.5">
            <span
                v-for="row in superseded"
                :key="row.id"
                class="inline-flex items-center gap-1 rounded-full border border-dashed border-border/60 px-2 py-0.5 text-[11px] text-muted-foreground/70 line-through"
                :title="`Superseded by a later correction — ${tooltipFor(row)}`">
                <History class="size-3 shrink-0 no-underline" />
                <span class="max-w-[16rem] truncate">{{ middleTruncate(labelFor(row), 40) }}</span>
            </span>
        </div>

        <!-- The in-app viewer, not a new tab: proof of filing is read beside the
             timeline it belongs to, and the vault's own preview already handles
             PDFs, images, markdown and .docx. -->
        <Sheet v-model:open="previewOpen">
            <SheetContent
                :side="isDesktop ? 'right' : 'bottom'"
                hide-x
                class="flex flex-col gap-0 p-0"
                :class="isDesktop ? 'w-full sm:max-w-xl' : 'h-[88dvh]'">
                <SheetTitle class="sr-only">Document preview</SheetTitle>
                <DocumentPreview
                    v-if="previewDoc"
                    :doc="previewDoc"
                    :resolve-url="resolvePreviewUrl"
                    :facts-doc-id="previewTarget?.id"
                    class="min-h-0 flex-1"
                    @close="previewOpen = false" />
            </SheetContent>
        </Sheet>
    </div>
</template>

<script setup lang="ts">
import { FileText, Receipt, Send, Files, Paperclip, ShieldCheck, FileQuestion, History } from 'lucide-vue-next';
import dayjs from 'dayjs';
import { middleTruncate } from '~/lib/utils';
import { EVIDENCE_KIND_LABELS, type DeadlineEvidenceRecord, type EvidenceKind } from '~/services/matters';
import { vaultFileUrl, type VaultDocument } from '~/services/vault';
import { useMediaQuery } from '@vueuse/core';
import { Sheet, SheetContent, SheetTitle } from '~/components/ui/sheet';
import DocumentPreview, { type PreviewDoc } from '~/components/shared/Vault/DocumentPreview.vue';

const props = defineProps<{ rows: DeadlineEvidenceRecord[] }>();

const current = computed(() => (props.rows || []).filter(r => !r.superseded));
const superseded = computed(() => (props.rows || []).filter(r => r.superseded));

const ICONS: Record<EvidenceKind, any> = {
    filed: FileText,
    receipt: Receipt,
    service: Send,
    record: Files,
    other: Paperclip,
};
const iconFor = (kind: EvidenceKind) => ICONS[kind] || Paperclip;

/** The most specific thing this row actually holds, in that order. */
function labelFor(row: DeadlineEvidenceRecord): string {
    return row.expand?.document?.filename
        || row.reference
        || row.note
        || EVIDENCE_KIND_LABELS[row.kind]
        || 'Proof';
}

function tooltipFor(row: DeadlineEvidenceRecord): string {
    const parts = [EVIDENCE_KIND_LABELS[row.kind] || 'Proof'];
    if (row.reference) parts.push(`Ref ${row.reference}`);
    if (row.note) parts.push(row.note);
    if (row.expand?.verifiedBy) {
        const who = row.expand.verifiedBy.name || row.expand.verifiedBy.email;
        parts.push(row.verifiedAt ? `Checked by ${who} on ${dayjs(row.verifiedAt).format('D MMM YYYY')}` : `Checked by ${who}`);
    }
    return parts.join(' · ');
}

// ── Document preview (reuses the vault DocumentPreview viewer) ────────────────
const isDesktop = useMediaQuery('(min-width: 1024px)');
const previewTarget = ref<VaultDocument | null>(null);
const previewOpen = computed({
    get: () => !!previewTarget.value,
    set: (v) => { if (!v) previewTarget.value = null; },
});
const previewDoc = computed<PreviewDoc | null>(() => {
    const d = previewTarget.value;
    if (!d) return null;
    return { id: d.id, filename: d.filename, file: d.file, mime: d.mime, ocr: d.ocr };
});
// A thunk, because a bare Promise is not in template scope — the same shape
// ChatSurface uses. Signed URLs are short-lived, so it resolves on open.
const resolvePreviewUrl = () => previewTarget.value
    ? vaultFileUrl(previewTarget.value)
    : Promise.resolve('');

function openDocument(row: DeadlineEvidenceRecord) {
    if (!row.expand?.document) return;
    previewTarget.value = row.expand.document as VaultDocument;
}
</script>
