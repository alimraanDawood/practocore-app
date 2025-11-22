<template>
  <Sheet v-model:open="open">
    <SheetTrigger as-child>
      <slot />
    </SheetTrigger>

    <SheetContent class="w-full overflow-y-auto">
      <SheetHeader>
        <SheetTitle>Update Matter Parties</SheetTitle>
        <SheetDescription>
          Be warned that updating the parties of this matter may reset the matter to the initial deadlines.
        </SheetDescription>
      </SheetHeader>

      <div class="p-3">
        <div v-if="loading" class="grid place-items-center h-32 w-full">
          <LoaderIcon class="size-5 animate-spin" />
        </div>

        <SharedMattersCreateMatterParties
          v-else
          ref="partiesRef"
          v-model="_parties"
          v-model:representing="_representing"
          :party-roles="matter?.partyConfig?.roles || []"
        />
      </div>

      <SheetFooter class="p-3 border-t gap-2">
        <Button
          @click="saveParties"
          :disabled="loading || !canSave"
          class="w-full sm:w-auto"
        >
          <LoaderIcon v-if="loading" class="size-4 mr-2 animate-spin" />
          Save Party Details
        </Button>
        <Button
          variant="secondary"
          @click="cancel"
          :disabled="loading"
          class="w-full sm:w-auto"
        >
          Cancel
        </Button>
      </SheetFooter>
    </SheetContent>
  </Sheet>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { toast } from 'vue-sonner';
import { LoaderIcon } from 'lucide-vue-next';
import { updateMatter } from '~/services/matters';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '~/components/ui/sheet';
import { Button } from '~/components/ui/button';

const props = defineProps<{
  matter: any;
  parties?: Record<string, any[]>;
  representing?: { role_id: string; party_member_ids: string[] } | null;
}>();

const emits = defineEmits<{
  updated: [];
}>();

const open = ref(false);
const loading = ref(false);
const partiesRef = ref<any>(null);

// Local state for editing
const _parties = ref<Record<string, any[]>>({});
const _representing = ref<{ role_id: string; party_member_ids: string[] } | null>(null);

// Initialize local state when props change or sheet opens
const initializeState = () => {
  _parties.value = props.parties ? JSON.parse(JSON.stringify(props.parties)) : {};
  _representing.value = props.representing ? JSON.parse(JSON.stringify(props.representing)) : null;
};

// Watch for sheet opening to reset state
watch(open, (isOpen) => {
  if (isOpen) {
    initializeState();
  }
});

// Validation
const canSave = computed(() => {
  if (!partiesRef.value) return false;
  return partiesRef.value.isValid;
});

// Save parties
const saveParties = async () => {
  if (!canSave.value) {
    toast.error('Please fix validation errors before saving', {
      description: partiesRef.value?.errors?.join(', ') || 'Invalid party data',
    });
    return;
  }

  loading.value = true;

  try {
    const result = await updateMatter(props.matter.id, {
      parties: _parties.value,
      representing: _representing.value,
    });

    if (result?.id) {
      toast.success('Party details updated successfully!', {
        description: 'Matter parties have been updated',
      });
      emits('updated');
      open.value = false;
    } else {
      throw new Error('Failed to update matter parties');
    }
  } catch (error: any) {
    console.error('Error updating parties:', error);
    toast.error('Failed to update party details', {
      description: error?.message || 'Please try again later',
    });
  } finally {
    loading.value = false;
  }
};

// Cancel editing
const cancel = () => {
  initializeState(); // Reset to original values
  open.value = false;
};

// Initialize on mount
initializeState();
</script>
