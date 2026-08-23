<template>
    <!-- Linked: show the ECCMIS case + an unlink affordance -->
    <DropdownMenu v-if="isLinked">
        <DropdownMenuTrigger as-child>
            <Button variant="outline" size="sm" class="gap-2">
                <Link2 class="size-4 text-emerald-600" />
                ECCMIS
                <Badge variant="secondary" class="font-mono text-xs">
                    {{ matter?.caseNumber || 'Linked' }}
                </Badge>
            </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" class="w-72">
            <DropdownMenuLabel class="flex flex-col gap-0.5">
                <span class="text-xs font-normal text-muted-foreground">Linked ECCMIS case</span>
                <span class="font-mono text-sm">{{ matter?.caseNumber }}</span>
                <span v-if="statusLabel" class="text-xs font-normal text-muted-foreground">
                    Status: {{ statusLabel }}
                </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <p class="px-2 py-1.5 text-xs text-muted-foreground">
                The court's hearings and status changes for this case sync into this
                matter twice a day.
            </p>
            <DropdownMenuSeparator />
            <DropdownMenuItem @select="scheduleRecord">
                <Landmark class="size-4" />
                View court record
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
                v-if="canManage"
                class="text-destructive focus:text-destructive"
                @select="scheduleConfirm"
            >
                <Unlink class="size-4" />
                Unlink from ECCMIS
            </DropdownMenuItem>
        </DropdownMenuContent>
    </DropdownMenu>

    <!-- Not linked: offer to attach -->
    <Button
        v-else-if="canManage"
        variant="outline"
        size="sm"
        class="gap-2"
        @click="openPicker"
    >
        <Link2 class="size-4" />
        Attach ECCMIS case
    </Button>

    <!-- Picker dialog -->
    <Dialog v-model:open="open">
        <DialogContent class="sm:max-w-xl">
            <DialogHeader>
                <DialogTitle>Attach an ECCMIS case</DialogTitle>
                <DialogDescription>
                    Link this matter to a case in your ECCMIS portfolio. Court updates
                    will sync into this matter automatically — nothing is sent to ECCMIS.
                </DialogDescription>
            </DialogHeader>

            <div v-if="loading" class="flex items-center justify-center py-12">
                <LoaderIcon class="size-5 animate-spin text-muted-foreground" />
            </div>

            <div
                v-else-if="loadError"
                class="flex flex-col gap-3 rounded-md border bg-muted/40 p-4 text-sm"
            >
                <div class="flex items-start gap-2 text-foreground">
                    <AlertCircle class="size-4 shrink-0 mt-0.5" />
                    <span>{{ loadError }}</span>
                </div>
                <Button variant="outline" size="sm" as-child>
                    <NuxtLink :to="settingsPath('eccmis')">Open ECCMIS settings</NuxtLink>
                </Button>
            </div>

            <template v-else>
                <!-- Court filter. A portfolio spans several courts and the case
                     number is the only thing distinguishing them, so narrowing
                     by court is the fastest way to a handful of candidates. -->
                <div v-if="courts.length > 1" class="flex flex-wrap gap-1">
                    <button
                        v-for="court in courts"
                        :key="court.value"
                        type="button"
                        class="rounded-full border px-2.5 py-1 text-xs transition-colors"
                        :class="courtFilter === court.value
                            ? 'border-foreground bg-foreground text-background'
                            : 'text-muted-foreground hover:text-foreground'"
                        @click="courtFilter = court.value"
                    >
                        {{ court.label }}
                        <span class="tabular-nums opacity-60">{{ court.count }}</span>
                    </button>
                </div>

                <Command class="rounded-lg border">
                    <CommandInput placeholder="Search case number, party, court or year…" />
                    <CommandList class="max-h-[22rem]">
                        <CommandEmpty>No matching cases in your portfolio.</CommandEmpty>

                        <CommandGroup v-if="availableCases.length" heading="Available to link">
                            <CommandItem
                                v-for="c in availableCases"
                                :key="c.caseInstanceId"
                                :value="searchIndex(c)"
                                :disabled="busy"
                                class="flex flex-col items-start gap-1 py-2.5"
                                @select="() => attach(c)"
                            >
                                <div class="flex w-full items-start justify-between gap-3">
                                    <span class="font-mono text-sm">{{ c.caseNumber }}</span>
                                    <Badge
                                        v-if="c.statusLabel"
                                        variant="secondary"
                                        class="shrink-0 text-[10px] font-normal"
                                    >
                                        {{ c.statusLabel }}
                                    </Badge>
                                </div>
                                <!-- What the case number encodes, spelled out. -->
                                <span v-if="contextLine(c)" class="text-xs text-muted-foreground">
                                    {{ contextLine(c) }}
                                </span>
                                <span
                                    v-if="c.parties?.length"
                                    class="w-full truncate text-xs"
                                >
                                    {{ c.parties.join(' v. ') }}
                                </span>
                            </CommandItem>
                        </CommandGroup>

                        <!-- Cases spoken for. Kept visible rather than hidden: an
                             advocate hunting a case they already linked needs to
                             see that it is linked, not that it is missing. -->
                        <CommandGroup v-if="linkedCases.length" heading="Already linked">
                            <CommandItem
                                v-for="c in linkedCases"
                                :key="c.caseInstanceId"
                                :value="searchIndex(c)"
                                disabled
                                class="flex flex-col items-start gap-0.5 py-2 opacity-60"
                            >
                                <div class="flex w-full items-center justify-between gap-3">
                                    <span class="font-mono text-sm">{{ c.caseNumber }}</span>
                                    <span class="shrink-0 text-[10px] text-muted-foreground">
                                        Linked to another matter
                                    </span>
                                </div>
                                <span v-if="contextLine(c)" class="text-xs text-muted-foreground">
                                    {{ contextLine(c) }}
                                </span>
                            </CommandItem>
                        </CommandGroup>
                    </CommandList>
                </Command>

                <p class="text-xs text-muted-foreground">
                    {{ availableCases.length }} of {{ cases.length }} case{{ cases.length === 1 ? '' : 's' }}
                    available to link.
                </p>
            </template>
        </DialogContent>
    </Dialog>

    <!-- The registry's own record of the case: history, fees, documents. Opened
         on demand — it reads ECCMIS live. -->
    <SharedMattersEccmisRecord v-if="isLinked" :matter="matter" v-model:open="recordOpen" />

    <!-- Unlink confirmation -->
    <AlertDialog v-model:open="confirmOpen">
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Unlink from ECCMIS?</AlertDialogTitle>
                <AlertDialogDescription>
                    This matter will stop receiving court updates from ECCMIS. Hearings
                    already imported are kept. You can re-attach the case at any time.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel :disabled="busy">Cancel</AlertDialogCancel>
                <AlertDialogAction
                    class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    :disabled="busy"
                    @click="detach"
                >
                    Unlink
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
</template>

<script setup lang="ts">
import { useVModel } from '@vueuse/core';
import dayjs from 'dayjs';
import { toast } from 'vue-sonner';
import { Link2, Unlink, LoaderIcon, AlertCircle, Landmark } from 'lucide-vue-next';
import {
    fetchEccmisPortfolio,
    attachEccmisCase,
    detachEccmisCase,
    type PortfolioCase,
} from '~/services/eccmis';

// ECCMIS settings are a tab on desktop, a standalone page on mobile.
const { settingsPath } = useSettingsLink();

const props = defineProps<{
    matter: any;
    /** Whether the current user may attach/detach (supervisor/owner). */
    canManage?: boolean;
    /** Optional controlled open state for the attach dialog (e.g. a deep link). */
    open?: boolean;
}>();
const emits = defineEmits<{ updated: []; 'update:open': [value: boolean] }>();

// Controlled when the parent binds `v-model:open`, otherwise internal (passive).
const open = useVModel(props, 'open', emits, { passive: true, defaultValue: false });
const confirmOpen = ref(false);
const recordOpen = ref(false);
const loading = ref(false);
const busy = ref(false);
const loadError = ref('');
const cases = ref<PortfolioCase[]>([]);

const isLinked = computed(() => Number(props.matter?.eccmisCaseInstanceId) > 0);
const statusLabel = computed(() => props.matter?.eccmisData?.workflowStateLabel ?? '');

const isOtherwiseLinked = (c: PortfolioCase) =>
    !!c.linkedMatterId && c.linkedMatterId !== props.matter?.id;

const courtFilter = ref('all');

/** Courts present in the portfolio, as filter chips with counts. */
const courts = computed(() => {
    const counts = new Map<string, number>();
    for (const c of cases.value) {
        const name = c.courtName || 'Other';
        counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    const chips = [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([label, count]) => ({ value: label, label, count }));
    return [{ value: 'all', label: 'All courts', count: cases.value.length }, ...chips];
});

const visibleCases = computed(() =>
    courtFilter.value === 'all'
        ? cases.value
        : cases.value.filter((c) => (c.courtName || 'Other') === courtFilter.value),
);

const availableCases = computed(() => visibleCases.value.filter((c) => !isOtherwiseLinked(c)));
const linkedCases = computed(() => visibleCases.value.filter((c) => isOtherwiseLinked(c)));

const yearOf = (c: PortfolioCase) => {
    if (c.filingDate) return dayjs(c.filingDate).format('YYYY');
    // Fall back to the year the case number itself carries.
    const parts = c.caseNumber?.split('-') ?? [];
    const last = parts[parts.length - 1];
    return /^\d{4}$/.test(last ?? '') ? last : '';
};

/** The secondary line: what the case number encodes, in words. */
function contextLine(c: PortfolioCase) {
    const filed = c.filingDate ? `Filed ${dayjs(c.filingDate).format('D MMM YYYY')}` : yearOf(c);
    return [c.courtName, c.category, filed].filter(Boolean).join(' · ');
}

/**
 * Everything a row can be found by. Command matches a single case-insensitive
 * substring against this, so search reaches the court, the category, the status
 * and the parties — not just the case number the advocate is trying to avoid
 * memorising.
 */
function searchIndex(c: PortfolioCase) {
    return [
        c.caseNumber,
        c.courtName,
        c.category,
        c.statusLabel,
        yearOf(c),
        ...(c.parties ?? []),
    ]
        .filter(Boolean)
        .join(' ');
}


// Open the confirm dialog only after the dropdown has fully closed, so the two
// reka-ui dismissable layers don't race over the body pointer-events lock
// (see the nested-modal note in CLAUDE.md).
function scheduleConfirm() {
    setTimeout(() => {
        confirmOpen.value = true;
    }, 50);
}

// Same deferral for the record sheet, for the same reason.
function scheduleRecord() {
    setTimeout(() => {
        recordOpen.value = true;
    }, 50);
}

async function loadPortfolio() {
    loadError.value = '';
    cases.value = [];
    loading.value = true;
    try {
        cases.value = await fetchEccmisPortfolio();
    } catch (e: any) {
        loadError.value = e?.message || 'Could not load your ECCMIS portfolio.';
    } finally {
        loading.value = false;
    }
}

function openPicker() {
    open.value = true;
    loadPortfolio();
}

// When the dialog is opened externally (deep link sets `open` true) rather than
// via the button, load the portfolio too — otherwise it would show empty.
watch(open, (isOpen) => {
    if (isOpen && !loading.value && !cases.value.length && !loadError.value) {
        loadPortfolio();
    }
});

async function attach(c: PortfolioCase) {
    if (busy.value || isOtherwiseLinked(c)) return;
    busy.value = true;
    try {
        const res = await attachEccmisCase(props.matter.id, c.caseInstanceId);
        toast.success(`Linked to ${res.caseNumber}`, {
            description: res.deadlinesCreated
                ? `${res.deadlinesCreated} hearing(s) imported. Court updates will now sync here.`
                : 'Court updates will now sync into this matter.',
        });
        open.value = false;
        emits('updated');
    } catch (e: any) {
        toast.error('Could not attach case', { description: e?.message });
    } finally {
        busy.value = false;
    }
}

async function detach() {
    busy.value = true;
    try {
        await detachEccmisCase(props.matter.id);
        toast.success('Unlinked from ECCMIS');
        confirmOpen.value = false;
        emits('updated');
    } catch (e: any) {
        toast.error('Could not unlink', { description: e?.message });
    } finally {
        busy.value = false;
    }
}
</script>
