<template>
    <!-- Shared body, rendered inside a Dialog (desktop) or bottom Sheet (mobile). -->
    <DefineBody>
        <div class="flex flex-col gap-4 w-full">
            <!-- STEP: input ------------------------------------------------ -->
            <template v-if="step === 'input'">
                <!-- How-to blurb. PROVISIONAL: Phase 0 (HANDOFF §7) hasn't confirmed
                     what ECCMIS exports natively — revise this copy once we have a
                     real sample. -->
                <div class="rounded-md border bg-muted/40 p-3 text-sm">
                    <div class="flex items-center gap-2 font-medium text-foreground">
                        <Info class="size-4 shrink-0" />
                        How to export from ECCMIS
                    </div>
                    <ol class="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
                        <li>Log in to ECCMIS at <span class="font-mono text-xs">eccmis.judiciary.go.ug</span>.</li>
                        <li>Open your case portfolio / case list.</li>
                        <li>Export or download your cases (with their hearing dates).</li>
                        <li>Upload the file below, or paste its contents.</li>
                    </ol>
                    <p class="mt-2 text-xs italic text-muted-foreground/80">
                        Exact steps are provisional and will be updated. Your file stays
                        private — it is sent only to PractoCore and never to a third party.
                    </p>
                </div>

                <!-- File upload -->
                <div>
                    <input
                        ref="fileInput"
                        type="file"
                        accept=".json,application/json,.txt,text/plain"
                        class="hidden"
                        @change="onFileChange"
                    />
                    <Button variant="outline" class="w-full" @click="fileInput?.click()">
                        <FileUp class="size-4" />
                        {{ fileName ? `Selected: ${fileName}` : 'Choose ECCMIS export file' }}
                    </Button>
                </div>

                <div class="flex items-center gap-2 text-xs text-muted-foreground">
                    <Separator class="flex-1" /> or paste the export text <Separator class="flex-1" />
                </div>

                <Textarea
                    v-model="content"
                    rows="6"
                    placeholder='Paste your ECCMIS export here, e.g. {"cases":[ ... ]}'
                    class="font-mono text-xs"
                    @input="fileName = ''"
                />

                <p v-if="errorMessage" class="text-sm text-destructive">{{ errorMessage }}</p>
            </template>

            <!-- STEP: preview ---------------------------------------------- -->
            <template v-else-if="step === 'preview' && preview">
                <!-- Summary chips -->
                <div class="flex flex-wrap gap-2">
                    <Badge variant="default" class="bg-emerald-600 text-white hover:bg-emerald-600">
                        {{ preview.summary.toCreate }} to create
                    </Badge>
                    <Badge variant="secondary">{{ preview.summary.toUpdate }} to update</Badge>
                    <Badge variant="outline">{{ preview.summary.deadlines }} hearing deadlines</Badge>
                    <Badge v-if="preview.summary.errors > 0" variant="destructive">
                        {{ preview.summary.errors }} error{{ preview.summary.errors === 1 ? '' : 's' }}
                    </Badge>
                </div>

                <div class="max-h-[45vh] overflow-auto rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Action</TableHead>
                                <TableHead>Case</TableHead>
                                <TableHead class="text-right">Hearings</TableHead>
                                <TableHead>Details</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            <TableRow v-for="(item, i) in preview.items" :key="i">
                                <TableCell>
                                    <Badge
                                        :variant="item.action === 'error' ? 'destructive' : item.action === 'update' ? 'secondary' : 'default'"
                                        :class="item.action === 'create' ? 'bg-emerald-600 text-white hover:bg-emerald-600' : ''"
                                    >
                                        {{ item.action }}
                                    </Badge>
                                </TableCell>
                                <TableCell class="font-medium">
                                    {{ item.eccmisCaseNumber || '—' }}
                                    <div v-if="item.matter" class="text-xs font-normal text-muted-foreground">
                                        {{ matterDetail(item.matter) }}
                                    </div>
                                </TableCell>
                                <TableCell class="text-right tabular-nums">
                                    {{ item.action === 'error' ? '—' : item.deadlines.length }}
                                </TableCell>
                                <TableCell class="text-xs">
                                    <span v-if="item.action === 'error'" class="text-destructive">
                                        {{ item.errorMessage || 'Could not be mapped.' }}
                                    </span>
                                    <a
                                        v-else-if="item.action === 'update' && item.matchedMatterId"
                                        :href="`/main/matters/matter/${item.matchedMatterId}`"
                                        class="inline-flex items-center gap-1 text-primary hover:underline"
                                        @click="open = false"
                                    >
                                        Matches existing matter <ExternalLink class="size-3" />
                                    </a>
                                    <span v-else class="text-muted-foreground">New matter</span>
                                </TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </div>

                <p v-if="nothingToImport" class="text-sm text-muted-foreground">
                    Nothing to import — every case either errored or has no changes.
                </p>
                <p v-if="errorMessage" class="text-sm text-destructive">{{ errorMessage }}</p>
            </template>

            <!-- STEP: success --------------------------------------------- -->
            <template v-else-if="step === 'success' && result">
                <div class="flex flex-col items-center gap-3 py-4 text-center">
                    <component
                        :is="result.alreadyImported ? Info : CheckCircle2"
                        :class="result.alreadyImported ? 'text-muted-foreground' : 'text-emerald-600'"
                        class="size-12"
                    />
                    <div v-if="result.alreadyImported" class="flex flex-col gap-1">
                        <span class="font-semibold">Already imported</span>
                        <span class="text-sm text-muted-foreground">
                            This export was imported before, so nothing was duplicated.
                        </span>
                    </div>
                    <div v-else class="flex flex-col gap-1">
                        <span class="font-semibold">Import complete</span>
                        <span class="text-sm text-muted-foreground">
                            {{ result.mattersCreated }} created · {{ result.mattersUpdated }} updated ·
                            {{ result.deadlinesCreated }} hearing deadline{{ result.deadlinesCreated === 1 ? '' : 's' }} added
                        </span>
                    </div>
                </div>
            </template>
        </div>
    </DefineBody>

    <!-- Footer actions (shared) -->
    <DefineFooter>
        <template v-if="step === 'input'">
            <Button variant="ghost" @click="open = false">Cancel</Button>
            <Button :disabled="!content.trim() || busy" @click="runPreview">
                <LoaderIcon v-if="busy" class="size-4 animate-spin" />
                Preview import
            </Button>
        </template>
        <template v-else-if="step === 'preview'">
            <Button variant="ghost" :disabled="busy" @click="backToInput">
                <ArrowLeft class="size-4" /> Back
            </Button>
            <Button :disabled="nothingToImport || busy" @click="runCommit">
                <LoaderIcon v-if="busy" class="size-4 animate-spin" />
                Confirm import
            </Button>
        </template>
        <template v-else-if="step === 'success'">
            <Button @click="finish">Done</Button>
        </template>
    </DefineFooter>

    <!-- Desktop: Dialog -->
    <Dialog v-if="$viewport.isGreaterOrEquals('customxs')" v-model:open="open">
        <DialogTrigger as-child>
            <slot />
        </DialogTrigger>
        <DialogContent class="sm:max-w-2xl">
            <DialogHeader>
                <DialogTitle>Import from ECCMIS</DialogTitle>
                <DialogDescription>
                    Pull your ECCMIS cases and hearing dates into PractoCore. We preview
                    everything before anything is saved.
                </DialogDescription>
            </DialogHeader>
            <ReuseBody />
            <DialogFooter>
                <ReuseFooter />
            </DialogFooter>
        </DialogContent>
    </Dialog>

    <!-- Mobile: bottom Sheet -->
    <Sheet v-else v-model:open="open">
        <SheetTrigger as-child>
            <slot />
        </SheetTrigger>
        <SheetContent side="bottom" class="max-h-[90vh] overflow-y-auto">
            <SheetHeader>
                <SheetTitle>Import from ECCMIS</SheetTitle>
                <SheetDescription>
                    Pull your ECCMIS cases and hearing dates into PractoCore. We preview
                    everything before anything is saved.
                </SheetDescription>
            </SheetHeader>
            <div class="p-3">
                <ReuseBody />
            </div>
            <SheetFooter>
                <ReuseFooter />
            </SheetFooter>
        </SheetContent>
    </Sheet>
</template>

<script setup lang="ts">
import { toast } from 'vue-sonner';
import {
    Info, FileUp, LoaderIcon, CheckCircle2, ArrowLeft, ExternalLink,
} from 'lucide-vue-next';
import {
    previewEccmisImport, commitEccmisImport,
    type ImportPreview, type CommitResult, type MappedMatter,
} from '~/services/eccmis';

const emits = defineEmits<{ imported: [] }>();

const [DefineBody, ReuseBody] = createReusableTemplate();
const [DefineFooter, ReuseFooter] = createReusableTemplate();

type Step = 'input' | 'preview' | 'success';
const open = ref(false);
const step = ref<Step>('input');
const busy = ref(false);

const content = ref('');
const fileName = ref('');
const fileInput = ref<HTMLInputElement | null>(null);

const preview = ref<ImportPreview | null>(null);
const result = ref<CommitResult | null>(null);
const errorMessage = ref('');

// Confirm is disabled when there's nothing the server would write.
const nothingToImport = computed(() =>
    !preview.value || preview.value.summary.toCreate + preview.value.summary.toUpdate === 0,
);

// Reset the whole flow each time the modal opens, so a re-open starts clean.
watch(open, (isOpen) => {
    if (isOpen) resetState();
});

function resetState() {
    step.value = 'input';
    busy.value = false;
    content.value = '';
    fileName.value = '';
    preview.value = null;
    result.value = null;
    errorMessage.value = '';
}

async function onFileChange(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
        // Treat the file as untrusted text — the server validates it. We never
        // parse/eval it here.
        content.value = await file.text();
        fileName.value = file.name;
        errorMessage.value = '';
    } catch {
        toast.error('Could not read that file.');
    }
}

function matterDetail(m: MappedMatter): string {
    const parts: string[] = [];
    const cat = m.categoryLabel ?? (m.categoryId != null ? `Category #${m.categoryId}` : null);
    if (cat) parts.push(cat);
    if (m.filingDate) parts.push(`Filed ${new Date(m.filingDate).toLocaleDateString()}`);
    if (m.assignedJudge) parts.push(m.assignedJudge);
    return parts.join(' · ');
}

async function runPreview() {
    if (!content.value.trim()) return;
    busy.value = true;
    errorMessage.value = '';
    try {
        preview.value = await previewEccmisImport(content.value);
        step.value = 'preview';
    } catch (e: any) {
        errorMessage.value = e?.message || 'Could not preview the import.';
    } finally {
        busy.value = false;
    }
}

function backToInput() {
    step.value = 'input';
    errorMessage.value = '';
}

async function runCommit() {
    if (nothingToImport.value) return;
    busy.value = true;
    errorMessage.value = '';
    try {
        // Re-send the SAME content; the server re-parses + re-plans on commit.
        result.value = await commitEccmisImport(content.value);
        step.value = 'success';
        if (!result.value.alreadyImported) emits('imported');
    } catch (e: any) {
        errorMessage.value = e?.message || 'Import failed.';
        toast.error(errorMessage.value);
    } finally {
        busy.value = false;
    }
}

function finish() {
    open.value = false;
}
</script>
