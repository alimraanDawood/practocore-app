<template>
    <Sheet v-model:open="open">
        <SheetContent side="right" class="w-full sm:max-w-2xl flex flex-col gap-0 p-0">
            <SheetHeader class="px-6 pt-6 pb-4 border-b">
                <SheetTitle class="flex items-center gap-2">
                    <Landmark class="size-4 text-muted-foreground" />
                    Court record
                </SheetTitle>
                <SheetDescription>
                    What the registry holds on
                    <span class="font-mono">{{ caseNumber || 'this case' }}</span>, read from
                    ECCMIS when you opened this panel.
                </SheetDescription>
            </SheetHeader>

            <!-- Case header: the shape of the case at a glance. -->
            <div v-if="timeline" class="flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-6 py-3 text-xs">
                <Badge v-if="timeline.currentState" variant="secondary">
                    {{ timeline.currentState }}
                </Badge>
                <span v-if="timeline.entries?.length" class="text-muted-foreground">
                    {{ timeline.entries.length }} stage{{ timeline.entries.length === 1 ? '' : 's' }}
                </span>
                <!-- The registry timed every stage; this is its own measure of the
                     case's pace, not ours. -->
                <span v-if="recordedDays" class="text-muted-foreground">
                    {{ recordedDays }} day{{ recordedDays === '1' ? '' : 's' }} recorded
                </span>
                <span v-if="timeline.judges?.length" class="truncate text-muted-foreground">
                    {{ timeline.judges.join(', ') }}
                </span>
            </div>

            <Tabs v-model="tab" class="flex min-h-0 flex-1 flex-col">
                <TabsList class="mx-6 mt-4 grid w-auto grid-cols-3">
                    <TabsTrigger value="record">History</TabsTrigger>
                    <TabsTrigger value="fees" class="gap-1.5">
                        Court fees
                        <Badge v-if="outstandingCount" variant="destructive" class="px-1.5 py-0 text-[10px]">
                            {{ outstandingCount }}
                        </Badge>
                    </TabsTrigger>
                    <TabsTrigger value="documents" class="gap-1.5">
                        Documents
                        <span v-if="documents.length" class="text-[10px] text-muted-foreground tabular-nums">
                            {{ documents.length }}
                        </span>
                    </TabsTrigger>
                </TabsList>

                <!-- ---------------------------------------------------------- -->
                <!-- History                                                    -->
                <!-- ---------------------------------------------------------- -->
                <TabsContent value="record" class="min-h-0 flex-1 overflow-y-auto px-6 py-4">
                    <div v-if="loadingTimeline" class="flex flex-col gap-3">
                        <Skeleton v-for="n in 5" :key="n" class="h-16 w-full" />
                    </div>

                    <div
                        v-else-if="timelineError"
                        class="flex flex-col gap-3 rounded-md border bg-muted/40 p-4 text-sm"
                    >
                        <div class="flex items-start gap-2">
                            <AlertCircle class="mt-0.5 size-4 shrink-0" />
                            <span>{{ timelineError }}</span>
                        </div>
                        <Button variant="outline" size="sm" class="self-start" @click="loadTimeline">
                            Try again
                        </Button>
                    </div>

                    <p v-else-if="!timeline?.entries?.length" class="py-10 text-center text-sm text-muted-foreground">
                        The registry has recorded no stages on this case yet.
                    </p>

                    <ol v-else class="flex flex-col">
                        <li
                            v-for="(entry, i) in orderedEntries"
                            :key="entry.id"
                            class="relative flex gap-3 pb-5 last:pb-0"
                        >
                            <!-- Rail: one hairline, one small mark per stage. The
                                 current stage is the only one that reads loudly,
                                 because it is the only one that is still true. -->
                            <div class="relative flex w-3 shrink-0 justify-center">
                                <span
                                    v-if="i < orderedEntries.length - 1"
                                    class="absolute top-2.5 bottom-[-1.25rem] w-px bg-border"
                                />
                                <span
                                    class="relative mt-1.5 size-1.5 rounded-full"
                                    :class="entry.current
                                        ? 'size-2 bg-emerald-500 ring-4 ring-emerald-500/15'
                                        : entry.final ? 'bg-foreground' : 'bg-border'"
                                />
                            </div>

                            <div class="flex min-w-0 flex-1 gap-3">
                                <!-- What happened -->
                                <div class="min-w-0 flex-1">
                                    <div class="flex items-center gap-2">
                                        <span
                                            class="truncate text-sm"
                                            :class="entry.current ? 'font-medium' : ''"
                                        >
                                            {{ entry.state || 'Unnamed stage' }}
                                        </span>
                                        <Badge
                                            v-if="entry.current"
                                            variant="secondary"
                                            class="shrink-0 px-1.5 py-0 text-[10px] font-normal"
                                        >
                                            Current
                                        </Badge>
                                        <span
                                            v-else-if="entry.final"
                                            class="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground"
                                        >
                                            Final
                                        </span>
                                    </div>
                                    <p v-if="subLine(entry)" class="truncate text-xs text-muted-foreground">
                                        {{ subLine(entry) }}
                                    </p>
                                    <!-- The registry's own note. Real payloads carry
                                         the same sentence verbatim on consecutive
                                         stages, which reads as a rendering bug, so
                                         it shows on the row the reader meets first
                                         and is suppressed on the repeats below it. -->
                                    <p
                                        v-if="entry.details && entry.details !== orderedEntries[i - 1]?.details"
                                        class="mt-1 border-l-2 border-border pl-2 text-xs text-muted-foreground"
                                    >
                                        {{ entry.details }}
                                    </p>
                                </div>

                                <!-- When, and for how long -->
                                <div class="shrink-0 text-right">
                                    <p v-if="entry.startedAt" class="text-xs tabular-nums text-muted-foreground">
                                        {{ formatDate(entry.startedAt) }}
                                    </p>
                                    <p v-if="entry.durationDays" class="text-[11px] tabular-nums text-muted-foreground/70">
                                        {{ formatDuration(entry.durationDays) }}
                                    </p>
                                </div>
                            </div>
                        </li>
                    </ol>
                </TabsContent>

                <!-- ---------------------------------------------------------- -->
                <!-- Court fees                                                 -->
                <!-- ---------------------------------------------------------- -->
                <TabsContent value="fees" class="min-h-0 flex-1 overflow-y-auto px-6 py-4">
                    <div v-if="loadingFees" class="flex flex-col gap-3">
                        <Skeleton v-for="n in 3" :key="n" class="h-16 w-full" />
                    </div>

                    <div
                        v-else-if="feesError"
                        class="flex flex-col gap-3 rounded-md border bg-muted/40 p-4 text-sm"
                    >
                        <div class="flex items-start gap-2">
                            <AlertCircle class="mt-0.5 size-4 shrink-0" />
                            <span>{{ feesError }}</span>
                        </div>
                        <Button variant="outline" size="sm" class="self-start" @click="loadFees">
                            Try again
                        </Button>
                    </div>

                    <div v-else-if="!fees.length" class="py-10 text-center text-sm text-muted-foreground">
                        <p>No court fees recorded against this matter.</p>
                        <p class="mt-1 text-xs">
                            Fees appear here after a sync. They are mirrored from ECCMIS — paying is
                            still done in ECCMIS or by mobile money against the reference below.
                        </p>
                    </div>

                    <ul v-else class="flex flex-col gap-2">
                        <li
                            v-for="fee in fees"
                            :key="fee.id"
                            class="rounded-lg border p-3"
                            :class="fee.status === 'expired' ? 'border-destructive/40 bg-destructive/5' : ''"
                        >
                            <div class="flex items-start justify-between gap-3">
                                <div class="min-w-0">
                                    <p class="text-sm font-medium tabular-nums">
                                        {{ formatAmount(fee) }}
                                    </p>
                                    <p v-if="fee.description" class="truncate text-xs text-muted-foreground">
                                        {{ fee.description }}
                                    </p>
                                    <p v-if="fee.prn" class="font-mono text-xs text-muted-foreground">
                                        {{ fee.prn }}
                                    </p>
                                </div>
                                <Badge :variant="feeVariant(fee.status)" class="shrink-0 text-[10px]">
                                    {{ feeLabel(fee.status) }}
                                </Badge>
                            </div>
                            <p v-if="fee.dueDate" class="mt-2 text-xs text-muted-foreground">
                                Due {{ formatDate(fee.dueDate) }}
                            </p>
                            <!-- An expired reference is not a missed payment, it is a
                                 stalled filing: nothing proceeds until it is reissued. -->
                            <p v-if="fee.status === 'expired'" class="mt-2 text-xs text-destructive">
                                This reference has lapsed and has to be regenerated in ECCMIS before
                                the filing can proceed.
                            </p>
                        </li>
                    </ul>
                </TabsContent>

                <!-- ---------------------------------------------------------- -->
                <!-- Documents                                                  -->
                <!-- ---------------------------------------------------------- -->
                <TabsContent value="documents" class="min-h-0 flex-1 overflow-y-auto px-6 py-4">
                    <div v-if="loadingTimeline" class="flex flex-col gap-3">
                        <Skeleton v-for="n in 3" :key="n" class="h-12 w-full" />
                    </div>

                    <p v-else-if="!documents.length" class="py-10 text-center text-sm text-muted-foreground">
                        The registry lists no documents on this case.
                    </p>

                    <ul v-else class="flex flex-col gap-2">
                        <li
                            v-for="doc in documents"
                            :key="doc.documentId"
                            class="flex items-center justify-between gap-3 rounded-lg border p-3"
                        >
                            <div class="min-w-0">
                                <p class="truncate text-sm">{{ doc.title || `Document ${doc.documentId}` }}</p>
                                <p v-if="doc.addedOn" class="text-xs text-muted-foreground">
                                    Filed {{ formatDate(doc.addedOn) }}
                                </p>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                class="shrink-0 gap-1.5"
                                :disabled="openingDocId === doc.documentId"
                                @click="openDocument(doc)"
                            >
                                <LoaderIcon v-if="openingDocId === doc.documentId" class="size-3.5 animate-spin" />
                                <ExternalLink v-else class="size-3.5" />
                                Open
                            </Button>
                        </li>
                    </ul>

                    <!-- The court's own binary route has been seen answering with no
                         bytes at all. When that happens the server says exactly which
                         routes it tried; show that verbatim rather than "download
                         failed" — it is the evidence that tells a storage gap on the
                         court's side from a route we are calling wrongly. -->
                    <div
                        v-if="documentError"
                        class="mt-4 flex flex-col gap-2 rounded-md border bg-muted/40 p-3 text-xs"
                    >
                        <div class="flex items-start gap-2">
                            <AlertCircle class="mt-0.5 size-3.5 shrink-0" />
                            <span>{{ documentError }}</span>
                        </div>
                    </div>
                </TabsContent>
            </Tabs>

            <div class="border-t px-6 py-3 text-[11px] text-muted-foreground">
                Read-only. Nothing on this panel is written back to ECCMIS.
            </div>
        </SheetContent>
    </Sheet>
</template>

<script setup lang="ts">
import { useVModel } from '@vueuse/core';
import dayjs from 'dayjs';
import { toast } from 'vue-sonner';
import { AlertCircle, ExternalLink, Landmark, LoaderIcon } from 'lucide-vue-next';
import {
    fetchEccmisTimeline,
    fetchEccmisPayments,
    fetchEccmisDocument,
    type CaseTimeline,
    type CaseDocumentRef,
    type EccmisPaymentRecord,
} from '~/services/eccmis';

const props = defineProps<{
    matter: any;
    open?: boolean;
}>();
const emits = defineEmits<{ 'update:open': [value: boolean] }>();

const open = useVModel(props, 'open', emits, { passive: true, defaultValue: false });

const tab = ref('record');
const timeline = ref<CaseTimeline | null>(null);
const fees = ref<EccmisPaymentRecord[]>([]);
const loadingTimeline = ref(false);
const loadingFees = ref(false);
const timelineError = ref('');
const feesError = ref('');
const documentError = ref('');
const openingDocId = ref<number | null>(null);

const caseNumber = computed(() => timeline.value?.caseNumber || props.matter?.caseNumber || '');
const documents = computed<CaseDocumentRef[]>(() => timeline.value?.documents ?? []);
const outstandingCount = computed(
    () => fees.value.filter((f) => ['draft', 'pending_payment', 'expired'].includes(f.status)).length,
);

// Fractional days read as noise ("0.88 days"); hours are what a stage of under a
// day actually took.
const recordedDays = computed(() => {
    const total = timeline.value?.elapsedDays ?? 0;
    if (!total) return '';
    return total >= 10 ? String(Math.round(total)) : total.toFixed(1).replace(/\.0$/, '');
});

const orderedEntries = computed(() =>
    [...(timeline.value?.entries ?? [])].sort((a, b) => (b.startedAt || '').localeCompare(a.startedAt || '')),
);

function formatDate(value?: string) {
    return value ? dayjs(value).format('D MMM YYYY') : '';
}

/**
 * The one line under a stage's name: what moved it, and who. The time of day is
 * dropped — a registry stamp of 5:29 PM is noise next to which day it was, and
 * it was pushing the officer's name onto a second line.
 */
function subLine(entry: CaseTimelineEntry) {
    return [entry.action, entry.user].filter(Boolean).join(' · ');
}

function formatDuration(days: number) {
    if (days >= 1) return `${days >= 10 ? Math.round(days) : Number(days.toFixed(1))} days`;
    const hours = Math.round(days * 24);
    return hours <= 1 ? 'under an hour' : `${hours} hours`;
}

// UGX is zero-decimal: the figure the court states is the figure shown.
function formatAmount(fee: EccmisPaymentRecord) {
    if (!fee.amount) return fee.currency || 'UGX';
    return `${fee.currency || 'UGX'} ${fee.amount.toLocaleString('en-UG')}`;
}

const FEE_LABELS: Record<string, string> = {
    draft: 'Draft',
    pending_payment: 'Awaiting payment',
    paid_offline_pending: 'Paid offline — confirming',
    paid_pending: 'Paid — confirming',
    paid: 'Paid',
    expired: 'Expired',
    unknown: 'Unknown',
};

function feeLabel(status: string) {
    return FEE_LABELS[status] ?? FEE_LABELS.unknown;
}

function feeVariant(status: string) {
    if (status === 'expired') return 'destructive' as const;
    if (status === 'paid') return 'secondary' as const;
    return 'outline' as const;
}

async function loadTimeline() {
    timelineError.value = '';
    loadingTimeline.value = true;
    try {
        timeline.value = await fetchEccmisTimeline(props.matter.id);
    } catch (e: any) {
        timelineError.value = e?.message || 'Could not read the case record from ECCMIS.';
    } finally {
        loadingTimeline.value = false;
    }
}

async function loadFees() {
    feesError.value = '';
    loadingFees.value = true;
    try {
        fees.value = await fetchEccmisPayments({ matterId: props.matter.id });
    } catch (e: any) {
        feesError.value = e?.message || 'Could not read court fees.';
    } finally {
        loadingFees.value = false;
    }
}

async function openDocument(doc: CaseDocumentRef) {
    documentError.value = '';
    openingDocId.value = doc.documentId;
    try {
        const blob = await fetchEccmisDocument(props.matter.id, doc.documentId);
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank', 'noopener');
        // Give the new tab time to take the blob before it is revoked.
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e: any) {
        documentError.value = e?.message || 'Could not open that document.';
        toast.error('Could not open the document');
    } finally {
        openingDocId.value = null;
    }
}

// The timeline is a live per-case read against the court, so it is fetched when
// the panel is opened — never eagerly for a list of matters.
watch(open, (isOpen) => {
    if (!isOpen) return;
    documentError.value = '';
    if (!timeline.value && !loadingTimeline.value) loadTimeline();
    if (!fees.value.length && !loadingFees.value) loadFees();
});
</script>
