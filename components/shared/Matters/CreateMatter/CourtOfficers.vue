<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-row items-center justify-between">
      <label class="text-sm font-medium">Court Officers (Custom)</label>
      <span class="text-xs text-muted-foreground">Add additional officers beyond database records</span>
    </div>

    <!-- Registrars -->
    <div class="flex flex-col gap-2">
      <div class="flex flex-row items-center justify-between">
        <label class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Registrars</label>
        <Button
          @click="addRegistrar"
          size="xs"
          variant="outline"
          type="button"
        >
          <Plus class="size-3 mr-1" />
          Add Registrar
        </Button>
      </div>

      <div v-if="localRegistrars.length > 0" class="flex flex-col gap-2">
        <div
          v-for="(registrar, index) in localRegistrars"
          :key="registrar.tempId"
          class="flex flex-col gap-2 p-3 border rounded-md bg-muted/30"
        >
          <div class="flex flex-row items-start justify-between gap-2">
            <span class="text-sm font-medium">Registrar {{ index + 1 }}</span>
            <Button
              @click="removeRegistrar(index)"
              size="icon"
              variant="ghost"
              class="h-6 w-6"
              type="button"
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

      <p v-else class="text-xs text-muted-foreground">
        No custom registrars added
      </p>
    </div>

    <!-- Clerks -->
    <div class="flex flex-col gap-2">
      <div class="flex flex-row items-center justify-between">
        <label class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Clerks</label>
        <Button
          @click="addClerk"
          size="xs"
          variant="outline"
          type="button"
        >
          <Plus class="size-3 mr-1" />
          Add Clerk
        </Button>
      </div>

      <div v-if="localClerks.length > 0" class="flex flex-col gap-2">
        <div
          v-for="(clerk, index) in localClerks"
          :key="clerk.tempId"
          class="flex flex-col gap-2 p-3 border rounded-md bg-muted/30"
        >
          <div class="flex flex-row items-start justify-between gap-2">
            <span class="text-sm font-medium">Clerk {{ index + 1 }}</span>
            <Button
              @click="removeClerk(index)"
              size="icon"
              variant="ghost"
              class="h-6 w-6"
              type="button"
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

      <p v-else class="text-xs text-muted-foreground">
        No custom clerks added
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { Plus, X } from 'lucide-vue-next';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';

interface Registrar {
  tempId: string;
  name: string;
  role?: string;
}

interface Clerk {
  tempId: string;
  name: string;
  email?: string;
  phone?: string;
}

interface CourtOfficers {
  registrars: Registrar[];
  clerks: Clerk[];
}

const props = defineProps<{
  modelValue?: CourtOfficers;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: CourtOfficers];
}>();

const localRegistrars = ref<Registrar[]>([]);
const localClerks = ref<Clerk[]>([]);
let tempIdCounter = 0;

// Initialize from modelValue
if (props.modelValue) {
  localRegistrars.value = props.modelValue.registrars || [];
  localClerks.value = props.modelValue.clerks || [];
}

// Add/Remove Registrar
const addRegistrar = () => {
  localRegistrars.value.push({
    tempId: `temp-${Date.now()}-${tempIdCounter++}`,
    name: '',
    role: '',
  });
  emitUpdate();
};

const removeRegistrar = (index: number) => {
  localRegistrars.value.splice(index, 1);
  emitUpdate();
};

// Add/Remove Clerk
const addClerk = () => {
  localClerks.value.push({
    tempId: `temp-${Date.now()}-${tempIdCounter++}`,
    name: '',
    email: '',
    phone: '',
  });
  emitUpdate();
};

const removeClerk = (index: number) => {
  localClerks.value.splice(index, 1);
  emitUpdate();
};

// Emit changes
const emitUpdate = () => {
  emit('update:modelValue', {
    registrars: localRegistrars.value,
    clerks: localClerks.value,
  });
};

// Watch for changes in fields
watch([localRegistrars, localClerks], () => {
  emitUpdate();
}, { deep: true });
</script>

