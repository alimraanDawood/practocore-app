<template>
    <div class="flex flex-col">
        <!-- Upload lives INSIDE the picker, and above the list. It is the only
             useful action when the matter's vault is empty, which for a step
             being completed for the first time is the common case — a picker
             that can only offer what is already there is a dead end exactly when
             someone has the filed document in front of them. -->
        <button
            type="button"
            class="flex w-full items-center gap-2.5 border-b px-4 py-3 text-left hover:bg-muted/50 active:bg-muted"
            :disabled="uploading"
            @click="emits('upload')">
            <span class="flex size-8 shrink-0 items-center justify-center rounded-md border bg-muted/40">
                <Loader v-if="uploading" class="size-4 animate-spin" />
                <Upload v-else class="size-4" />
            </span>
            <span class="flex min-w-0 flex-col">
                <span class="text-sm font-medium">
                    {{ uploading ? "Uploading…" : "Choose a file from this device" }}
                </span>
                <span class="text-[11px] text-muted-foreground">
                    Added to this matter's vault, then attached here
                </span>
            </span>
        </button>

        <p v-if="!loading && !documents.length" class="px-4 py-6 text-center text-xs text-muted-foreground">
            This matter's vault has no documents yet.
        </p>

        <Command v-else>
        <CommandInput class="h-9" placeholder="Search this matter's documents…" />
        <CommandList class="max-h-[50vh]">
            <CommandEmpty>
                {{ loading ? "Loading…" : "No document matches that search." }}
            </CommandEmpty>
            <CommandGroup>
                <CommandItem v-if="modelValue" value="__clear__" @select="emits('choose', '')">
                    <X class="mr-2 size-3.5 opacity-60" />
                    <span class="text-muted-foreground">Remove the attached document</span>
                </CommandItem>
                <CommandItem
                    v-for="doc in documents"
                    :key="doc.id"
                    :value="doc.filename + ' ' + doc.id"
                    class="items-start gap-2"
                    @select="emits('choose', doc.id)">
                    <FileIcon class="mt-0.5 size-3.5 shrink-0 opacity-60" />
                    <span class="flex min-w-0 flex-col">
                        <!-- The full name wraps rather than being cut: in a list
                             there is room, and a hashed filename is only
                             distinguishable across its whole length. -->
                        <span class="break-all text-xs leading-snug">{{ doc.filename }}</span>
                        <span class="text-[11px] text-muted-foreground">{{ meta(doc) }}</span>
                    </span>
                    <CheckIcon
                        :class="cn('ml-auto size-3.5 shrink-0', modelValue === doc.id ? 'opacity-100' : 'opacity-0')" />
                </CommandItem>
            </CommandGroup>
        </CommandList>
        </Command>
    </div>
</template>

<script setup lang="ts">
import { CheckIcon, FileIcon, Loader, Upload, X } from 'lucide-vue-next';
import dayjs from 'dayjs';
import { cn } from '~/lib/utils';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '~/components/ui/command';
import type { VaultDocument } from '~/services/vault';

// Split out of DocumentPicker so the identical list can sit inside a Dialog on
// desktop and a Drawer on touch without being written twice — the two shells
// are different components, so the content cannot simply be re-parented.
defineProps<{ modelValue?: string; documents: VaultDocument[]; loading?: boolean; uploading?: boolean }>();
const emits = defineEmits<{ choose: [string]; upload: [] }>();

function meta(doc: VaultDocument): string {
    const parts: string[] = [];
    if (doc.size) parts.push(formatSize(doc.size));
    if (doc.created) parts.push(dayjs(doc.created).format('D MMM YYYY'));
    return parts.join(' · ');
}

function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
</script>
