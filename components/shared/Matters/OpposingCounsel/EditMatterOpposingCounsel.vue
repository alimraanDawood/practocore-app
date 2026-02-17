<template>
  <Sheet v-model:open="open">
    <SheetTrigger as-child>
      <slot />
    </SheetTrigger>

    <SheetContent class="w-full overflow-y-hidden">
      <SheetHeader>
        <SheetTitle>Update Opposing Counsel</SheetTitle>
        <SheetDescription>
          Manage the lawyers representing the opposing party in this matter.
        </SheetDescription>
      </SheetHeader>

      <div class="p-3 h-full overflow-y-scroll w-full flex flex-col">
        <div v-if="loading" class="grid place-items-center h-32 w-full">
          <LoaderIcon class="size-5 animate-spin" />
        </div>

        <SharedMattersCreateMatterOpposingCounsel
          v-else
          ref="opposingCounselRef"
          v-model="_opposingCounsel"
        />
      </div>

      <SheetFooter class="p-3 border-t gap-2">
        <Button
          @click="saveOpposingCounsel"
          :disabled="loading || !canSave"
          class="w-full sm:w-auto"
        >
          <LoaderIcon v-if="loading" class="size-4 mr-2 animate-spin" />
          Save Opposing Counsel
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
  opposingCounsel?: any[];
}>();

const emits = defineEmits<{
  updated: [];
}>();

const open = ref(false);
const loading = ref(false);
const opposingCounselRef = ref<any>(null);

// Local state for editing
const _opposingCounsel = ref<any[]>([]);

// Initialize local state when props change or sheet opens
const initializeState = () => {
  _opposingCounsel.value = props.opposingCounsel ? JSON.parse(JSON.stringify(props.opposingCounsel)) : [];
};

// Watch for sheet opening to reset state
watch(open, (isOpen) => {
  if (isOpen) {
    initializeState();
  }
});

// Validation
const canSave = computed(() => {
  if (!opposingCounselRef.value) return false;
  return opposingCounselRef.value.isValid;
});

// Save opposing counsel
const saveOpposingCounsel = async () => {
  if (!canSave.value) {
    toast.error('Please fix validation errors before saving', {
      description: opposingCounselRef.value?.errors?.join(', ') || 'Invalid opposing counsel data',
    });
    return;
  }

  loading.value = true;

  try {
    const result = await updateMatter(props.matter.id, {
      opposingCounsel: _opposingCounsel.value,
    });

    if (result?.id) {
      toast.success('Opposing counsel updated successfully!', {
        description: 'The opposing counsel details have been updated',
      });
      emits('updated');
      open.value = false;
    } else {
      throw new Error('Failed to update opposing counsel');
    }
  } catch (error: any) {
    console.error('Error updating opposing counsel:', error);
    toast.error('Failed to update opposing counsel', {
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

