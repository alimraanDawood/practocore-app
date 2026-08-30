<template>
    <!--
        A popover was the wrong shell here. The picker lives inside the
        completion dialog, so on a narrow screen the popover was laid out
        against a container it was already nearly as wide as, and its list
        spilled past the dialog's edge. A modal surface owns the whole screen
        and has nothing to overflow.
    -->
    <Button
        type="button"
        variant="outline"
        role="combobox"
        :aria-expanded="open"
        class="h-8 w-full min-w-0 justify-between px-2 text-xs font-normal"
        :class="selected ? 'text-foreground' : 'text-muted-foreground'"
        @click="open = true">
        <!-- min-w-0 + truncate on the LABEL, not just the button: a flex child
             defaults to min-width:auto and refuses to shrink below its content,
             which is how a 64-character filename pushed the control past the
             edge of the dialog. -->
        <span class="flex min-w-0 items-center gap-1.5">
            <FileIcon class="size-3.5 shrink-0 opacity-60" />
            <span class="truncate" :title="selected?.filename">
                {{ selected ? middleTruncate(selected.filename, 34) : placeholder }}
            </span>
        </span>
        <ChevronsUpDownIcon class="size-3.5 shrink-0 opacity-50" />
    </Button>

    <Dialog v-if="isDesktop" v-model:open="open">
        <DialogContent class="max-w-lg gap-0 p-0">
            <DialogHeader class="px-4 pt-4">
                <DialogTitle class="text-base">Attach a document</DialogTitle>
                <DialogDescription class="text-xs">
                    Documents already in this matter's vault. Upload adds one here first.
                </DialogDescription>
            </DialogHeader>
            <SharedDeadlineCompleteDeadlineDocumentPickerList
                :model-value="modelValue"
                :documents="documents"
                :loading="loading"
                :uploading="uploading"
                @choose="choose"
                @upload="emits('upload')" />
        </DialogContent>
    </Dialog>

    <!--
        A reka-ui Sheet, NOT the vaul-vue Drawer. This picker always renders
        inside the completion Dialog/Sheet, and CLAUDE.md is explicit that a vaul
        Drawer nested in a reka-ui layer races two separate body-lock managers —
        which is exactly what rendered the picker as an empty sheet. reka-ui's
        own layers share one dismissable-layer stack and nest safely.
    -->
    <Sheet v-else v-model:open="open">
        <SheetContent side="bottom" class="flex max-h-[85dvh] flex-col gap-0 p-0">
            <SheetHeader class="px-4 pb-2 pt-4 text-left">
                <SheetTitle class="text-base">Attach a document</SheetTitle>
                <SheetDescription class="text-xs">
                    Documents already in this matter's vault. Upload adds one here first.
                </SheetDescription>
            </SheetHeader>
            <div class="min-h-0 flex-1 overflow-y-auto pb-4">
                <SharedDeadlineCompleteDeadlineDocumentPickerList
                    :model-value="modelValue"
                    :documents="documents"
                    :loading="loading"
                    :uploading="uploading"
                    @choose="choose"
                    @upload="emits('upload')" />
            </div>
        </SheetContent>
    </Sheet>
</template>

<script setup lang="ts">
import { ChevronsUpDownIcon, FileIcon } from 'lucide-vue-next';
import { useMediaQuery } from '@vueuse/core';
import { middleTruncate } from '~/lib/utils';
import { Button } from '~/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '~/components/ui/dialog';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '~/components/ui/sheet';
import type { VaultDocument } from '~/services/vault';

const props = withDefaults(defineProps<{
    modelValue?: string;
    documents: VaultDocument[];
    loading?: boolean;
    uploading?: boolean;
    placeholder?: string;
}>(), { modelValue: '', placeholder: 'Attach a document' });

const emits = defineEmits<{ 'update:modelValue': [string]; upload: [] }>();

// The parent owns the file input, because it is the parent that knows which
// evidence row is being filled. So the picker stays OPEN across the upload —
// showing its spinner — and closes itself once a document has actually been
// attached. Closing on the click instead would hide the only progress
// indication behind the OS file dialog.
watch(() => props.modelValue, (id) => { if (id && open.value) open.value = false; });

// Matches the breakpoint DocumentPreview and ChatSurface already switch on, so
// "desktop" means the same thing everywhere in the app.
const isDesktop = useMediaQuery('(min-width: 1024px)');
const open = ref(false);

const selected = computed(() => props.documents.find(d => d.id === props.modelValue));

function choose(id: string) {
    emits('update:modelValue', id === props.modelValue ? '' : id);
    open.value = false;
}
</script>
