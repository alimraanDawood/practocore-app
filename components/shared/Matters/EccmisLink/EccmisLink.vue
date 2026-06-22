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
        <DialogContent class="sm:max-w-lg">
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
                    <NuxtLink to="/main/settings/eccmis">Open ECCMIS settings</NuxtLink>
                </Button>
            </div>

            <Command v-else class="rounded-lg border">
                <CommandInput placeholder="Search by case number or party…" />
                <CommandList>
                    <CommandEmpty>No matching cases in your portfolio.</CommandEmpty>
                    <CommandGroup>
                        <CommandItem
                            v-for="c in cases"
                            :key="c.caseInstanceId"
                            :value="`${c.caseNumber} ${(c.parties || []).join(' ')}`"
                            :disabled="busy || isOtherwiseLinked(c)"
                            class="flex flex-col items-start gap-0.5"
                            @select="() => attach(c)"
                        >
                            <div class="flex w-full items-center justify-between gap-2">
                                <span class="font-mono text-sm">{{ c.caseNumber }}</span>
                                <Badge v-if="c.statusLabel" variant="secondary" class="text-xs">
                                    {{ c.statusLabel }}
                                </Badge>
                            </div>
                            <span
                                v-if="c.parties?.length"
                                class="w-full truncate text-xs text-muted-foreground"
                            >
                                {{ c.parties.join(' v. ') }}
                            </span>
                            <span v-if="isOtherwiseLinked(c)" class="text-xs text-amber-600">
                                Already linked to another matter
                            </span>
                        </CommandItem>
                    </CommandGroup>
                </CommandList>
            </Command>
        </DialogContent>
    </Dialog>

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
import { toast } from 'vue-sonner';
import { Link2, Unlink, LoaderIcon, AlertCircle } from 'lucide-vue-next';
import {
    fetchEccmisPortfolio,
    attachEccmisCase,
    detachEccmisCase,
    type PortfolioCase,
} from '~/services/eccmis';

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
const loading = ref(false);
const busy = ref(false);
const loadError = ref('');
const cases = ref<PortfolioCase[]>([]);

const isLinked = computed(() => Number(props.matter?.eccmisCaseInstanceId) > 0);
const statusLabel = computed(() => props.matter?.eccmisData?.workflowStateLabel ?? '');

const isOtherwiseLinked = (c: PortfolioCase) =>
    !!c.linkedMatterId && c.linkedMatterId !== props.matter?.id;

// Open the confirm dialog only after the dropdown has fully closed, so the two
// reka-ui dismissable layers don't race over the body pointer-events lock
// (see the nested-modal note in CLAUDE.md).
function scheduleConfirm() {
    setTimeout(() => {
        confirmOpen.value = true;
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
