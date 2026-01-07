<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-row items-center justify-between">
      <div>
        <h3 class="font-semibold text-sm">Opposing Counsel</h3>
        <p class="text-xs text-muted-foreground">
          Add lawyers representing the opposing party
        </p>
      </div>
      <Button variant="secondary" size="sm" @click="addLawyer">
        <Plus class="size-3 mr-1" /> Add Lawyer
      </Button>
    </div>

    <!-- Lawyers List -->
    <div class="flex flex-col gap-2">
      <div
        v-for="(lawyer, index) in modelValue"
        :key="lawyer.id"
        class="flex flex-col gap-3 p-3 border rounded-lg"
      >
        <!-- Name Row -->
        <div class="flex flex-col gap-2">
          <Label class="text-xs">Name<span class="text-destructive">*</span></Label>
          <div class="flex flex-row items-center gap-2">
            <Input
              v-model="lawyer.name"
              placeholder="Enter lawyer name"
              class="w-full"
            />
            <Button
              size="icon"
              variant="destructive"
              @click="removeLawyer(index)"
            >
              <Trash2 class="size-4" />
            </Button>
          </div>
        </div>

        <!-- Contact Info -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
          <div>
            <Label class="text-xs">Email</Label>
            <Input
              v-model="lawyer.email"
              placeholder="email@example.com"
              type="email"
              class="h-9 mt-1"
            />
          </div>
          <div>
            <Label class="text-xs">Phone</Label>
            <Input
              v-model="lawyer.phone"
              placeholder="+256..."
              type="tel"
              class="h-9 mt-1"
            />
          </div>
        </div>

        <!-- Firm Name -->
        <div>
          <Label class="text-xs">Firm/Organization</Label>
          <Input
            v-model="lawyer.firm"
            placeholder="Law firm or organization"
            class="h-9 mt-1"
          />
        </div>

        <!-- Address -->
        <div>
          <Label class="text-xs">Address</Label>
          <Input
            v-model="lawyer.address"
            placeholder="Physical address"
            class="h-9 mt-1"
          />
        </div>
      </div>

      <!-- Empty State -->
      <div
        v-if="!modelValue?.length"
        class="text-xs text-muted-foreground italic p-3 border border-dashed rounded-lg text-center"
      >
        No opposing counsel added yet. Click "Add Lawyer" to add one.
      </div>
    </div>

    <!-- Validation Messages -->
    <div v-if="validationErrors.length" class="flex flex-col gap-1 text-xs text-destructive">
      <div v-for="error in validationErrors" :key="error">
        • {{ error }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-vue-next";
import { v4 as uuidv4 } from "uuid";
import { computed } from "vue";

interface Lawyer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  firm?: string;
  address?: string;
}

const props = withDefaults(
  defineProps<{
    modelValue?: Lawyer[];
  }>(),
  {
    modelValue: () => [],
  }
);

const emits = defineEmits<{
  "update:modelValue": [value: Lawyer[]];
}>();

const addLawyer = () => {
  const newLawyer: Lawyer = {
    id: uuidv4(),
    name: "",
    email: "",
    phone: "",
    firm: "",
    address: "",
  };

  const currentLawyers = props.modelValue || [];
  emits("update:modelValue", [...currentLawyers, newLawyer]);
};

const removeLawyer = (index: number) => {
  const currentLawyers = props.modelValue || [];
  const newLawyers = [...currentLawyers];
  newLawyers.splice(index, 1);
  emits("update:modelValue", newLawyers);
};

// Validation
const validationErrors = computed(() => {
  const errors: string[] = [];
  const lawyers = props.modelValue || [];

  // Check for empty names only if there are lawyers added
  if (lawyers.length > 0) {
    const emptyNames = lawyers.filter((lawyer) => !lawyer.name?.trim());
    if (emptyNames.length > 0) {
      errors.push(`${emptyNames.length} lawyer(s) missing names`);
    }
  }

  return errors;
});

// Expose validation method for parent component
defineExpose({
  isValid: computed(() => validationErrors.value.length === 0),
  errors: validationErrors,
});
</script>