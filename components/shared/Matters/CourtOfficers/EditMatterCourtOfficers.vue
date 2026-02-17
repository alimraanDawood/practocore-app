<template>
  <Sheet v-model:open="open">
    <SheetTrigger as-child>
      <slot />
    </SheetTrigger>

    <SheetContent class="w-full overflow-y-auto">
      <SheetHeader>
        <SheetTitle>Update Court Officers</SheetTitle>
        <SheetDescription>
          Manage the court, judge, registrars, and clerks for this matter.
        </SheetDescription>
      </SheetHeader>

      <div class="p-3">
        <div v-if="loading" class="grid place-items-center h-32 w-full">
          <LoaderIcon class="size-5 animate-spin" />
        </div>

        <div v-else class="flex flex-col gap-6">
          <!-- Court Selection -->
          <div class="flex flex-col gap-2">
            <label class="text-sm font-medium">Court</label>
            <SharedMattersCreateMatterCourtSelector
              v-model="_courtId"
            />
          </div>

          <!-- Judge Selection -->
          <div class="flex flex-col gap-2">
            <label class="text-sm font-medium">Judge</label>
            <SharedMattersCreateMatterJudgeSelector
              v-model="_judgeId"
              :court="_courtId"
            />
          </div>

          <!-- Registrars -->
          <div class="flex flex-col gap-2">
            <div class="flex flex-row items-center justify-between">
              <label class="text-sm font-medium">Registrars</label>
              <Button
                @click="addRegistrar"
                size="xs"
                variant="outline"
              >
                <Plus class="size-3 mr-1" />
                Add Registrar
              </Button>
            </div>

            <div v-if="_registrars.length > 0" class="flex flex-col gap-2">
              <div
                v-for="(registrar, index) in _registrars"
                :key="registrar.tempId || registrar.id"
                class="flex flex-col gap-2 p-3 border rounded-md bg-muted/30"
              >
                <div class="flex flex-row items-start justify-between gap-2">
                  <span class="text-sm font-medium">Registrar {{ index + 1 }}</span>
                  <Button
                    @click="removeRegistrar(index)"
                    size="icon"
                    variant="ghost"
                    class="h-6 w-6"
                  >
                    <X class="size-3" />
                  </Button>
                </div>

                <div class="flex flex-col gap-2">
                  <Input
                    v-model="registrar.name"
                    placeholder="Registrar Name"
                  />
                  <Input
                    v-model="registrar.role"
                    placeholder="Role (optional)"
                  />
                </div>
              </div>
            </div>

            <p v-else class="text-sm text-muted-foreground">
              No registrars added yet
            </p>
          </div>

          <!-- Clerks -->
          <div class="flex flex-col gap-2">
            <div class="flex flex-row items-center justify-between">
              <label class="text-sm font-medium">Clerks</label>
              <Button
                @click="addClerk"
                size="xs"
                variant="outline"
              >
                <Plus class="size-3 mr-1" />
                Add Clerk
              </Button>
            </div>

            <div v-if="_clerks.length > 0" class="flex flex-col gap-2">
              <div
                v-for="(clerk, index) in _clerks"
                :key="clerk.tempId || clerk.id"
                class="flex flex-col gap-2 p-3 border rounded-md bg-muted/30"
              >
                <div class="flex flex-row items-start justify-between gap-2">
                  <span class="text-sm font-medium">Clerk {{ index + 1 }}</span>
                  <Button
                    @click="removeClerk(index)"
                    size="icon"
                    variant="ghost"
                    class="h-6 w-6"
                  >
                    <X class="size-3" />
                  </Button>
                </div>

                <div class="flex flex-col gap-2">
                  <Input
                    v-model="clerk.name"
                    placeholder="Clerk Name"
                  />
                  <Input
                    v-model="clerk.email"
                    type="email"
                    placeholder="Email (optional)"
                  />
                  <Input
                    v-model="clerk.phone"
                    type="tel"
                    placeholder="Phone (optional)"
                  />
                </div>
              </div>
            </div>

            <p v-else class="text-sm text-muted-foreground">
              No clerks added yet
            </p>
          </div>
        </div>
      </div>

      <SheetFooter class="p-3 border-t gap-2">
        <Button
          @click="saveCourtOfficers"
          :disabled="loading || !canSave"
          class="w-full sm:w-auto"
        >
          <LoaderIcon v-if="loading" class="size-4 mr-2 animate-spin" />
          Save Court Officers
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
import { LoaderIcon, Plus, X } from 'lucide-vue-next';
import { updateMatter } from '~/services/matters';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '~/components/ui/sheet';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';

interface Registrar {
  id?: string;
  tempId?: string;
  name: string;
  role?: string;
}

interface Clerk {
  id?: string;
  tempId?: string;
  name: string;
  email?: string;
  phone?: string;
}

const props = defineProps<{
  matter: any;
}>();

const emits = defineEmits<{
  updated: [];
}>();

const open = ref(false);
const loading = ref(false);

// Local state for editing
const _courtId = ref<string>('');
const _judgeId = ref<string>('');
const _registrars = ref<Registrar[]>([]);
const _clerks = ref<Clerk[]>([]);

let tempIdCounter = 0;

// Initialize local state when props change or sheet opens
const initializeState = () => {
  _courtId.value = props.matter?.court || '';
  // Handle judge - could be string (relation ID) or need to extract from expand
  _judgeId.value = props.matter?.judges || '';
  _registrars.value = props.matter?.courtOfficers?.registrars
    ? JSON.parse(JSON.stringify(props.matter.courtOfficers.registrars))
    : [];
  _clerks.value = props.matter?.courtOfficers?.clerks
    ? JSON.parse(JSON.stringify(props.matter.courtOfficers.clerks))
    : [];
  tempIdCounter = 0;
};

// Watch for sheet opening to reset state
watch(open, (isOpen) => {
  if (isOpen) {
    initializeState();
  }
});

// Add/Remove Registrar
const addRegistrar = () => {
  _registrars.value.push({
    tempId: `temp-${tempIdCounter++}`,
    name: '',
    role: '',
  });
};

const removeRegistrar = (index: number) => {
  _registrars.value.splice(index, 1);
};

// Add/Remove Clerk
const addClerk = () => {
  _clerks.value.push({
    tempId: `temp-${tempIdCounter++}`,
    name: '',
    email: '',
    phone: '',
  });
};

const removeClerk = (index: number) => {
  _clerks.value.splice(index, 1);
};

// Validation
const canSave = computed(() => {
  // At minimum, require valid names for any added officers
  const validRegistrars = _registrars.value.every(r => r.name.trim().length > 0);
  const validClerks = _clerks.value.every(c => c.name.trim().length > 0);

  return validRegistrars && validClerks;
});

// Save court officers
const saveCourtOfficers = async () => {
  if (!canSave.value) {
    toast.error('Please fix validation errors before saving', {
      description: 'All officers must have names',
    });
    return;
  }

  loading.value = true;

  try {
    // Clean up temp IDs and empty optional fields
    const cleanedRegistrars = _registrars.value.map(({ tempId, ...rest }) => ({
      ...rest,
      role: rest.role?.trim() || undefined,
    }));

    const cleanedClerks = _clerks.value.map(({ tempId, ...rest }) => ({
      ...rest,
      email: rest.email?.trim() || undefined,
      phone: rest.phone?.trim() || undefined,
    }));

    const result = await updateMatter(props.matter.id, {
      court: _courtId.value || '',
      judges: _judgeId.value || '',
      courtOfficers: {
        registrars: cleanedRegistrars,
        clerks: cleanedClerks,
      },
    });

    if (result?.id) {
      toast.success('Court officers updated successfully!', {
        description: 'The court officer details have been updated',
      });
      emits('updated');
      open.value = false;
    } else {
      throw new Error('Failed to update court officers');
    }
  } catch (error: any) {
    console.error('Error updating court officers:', error);
    toast.error('Failed to update court officers', {
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

