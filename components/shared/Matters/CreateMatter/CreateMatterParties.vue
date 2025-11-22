<template>
  <div class="flex flex-col gap-6">
    <!-- Party Roles -->
    <div
      v-for="role in partyRoles"
      :key="role.id"
      class="flex flex-col gap-3"
    >
      <div class="flex flex-row items-center justify-between">
        <div>
          <h3 class="font-semibold text-sm">
            {{ role.label_plural || role.name }}
            <span v-if="role.min_count" class="text-muted-foreground text-xs font-normal">
              (Min: {{ role.min_count }})
            </span>
          </h3>
          <p v-if="role.min_count" class="text-xs text-muted-foreground">
            At least {{ role.min_count }} {{ role.label_singular || role.name }} required
          </p>
        </div>
        <Button variant="secondary" size="sm" @click="addPartyMember(role.id, role.name)">
          <Plus class="size-3 mr-1" /> Add {{ role.label_singular || role.name }}
        </Button>
      </div>

      <!-- Party Members List -->
      <div class="flex flex-col gap-2">
        <div
          v-for="(member, index) in modelValue[role.id] || []"
          :key="member.id"
          class="flex flex-col gap-2 p-3 border rounded-lg"
        >
          <!-- Name and Type Row -->
          <div class="flex flex-col gap-2 items-start">
            <div class="flex flex-col w-full">
              <Label class="text-xs">Name*</Label>
              <div class="flex flex-row items-center gap-2">
                <Input
                  v-model="member.name"
                  placeholder="Enter name"
                  class="w-full"
                />

                <Button
                    size="icon"
                    variant="destructive"
                    @click="removePartyMember(role.id, index)"
                >
                  <Trash2 class="size-4" />
                </Button>
              </div>
            </div>
            <div v-if="false" class="flex flex-col w-full">
              <Label class="text-xs">Type*</Label>
              <Select v-model="member.type" class="w-full">
                <SelectTrigger class="w-full">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent class="w-full">
                  <SelectItem value="individual">Individual</SelectItem>
                  <SelectItem value="corporate">Corporate</SelectItem>
                  <SelectItem value="government">Government</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <!-- Contact Info (Optional - Collapsible) -->
          <Collapsible v-if="false" v-model:open="member._showContact" class="w-full">
            <CollapsibleTrigger as-child>
              <Button variant="ghost" size="sm" class="w-full justify-between p-2 h-auto">
                <span class="text-xs text-muted-foreground">
                  {{ member._showContact ? 'Hide' : 'Add' }} Contact Info (Optional)
                </span>
                <ChevronDown :class="['size-3 transition-transform', member._showContact && 'rotate-180']" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent class="space-y-2 pt-2">
              <div class="grid grid-cols-1 gap-2">
                <div>
                  <Label class="text-xs">Email</Label>
                  <Input
                    v-model="member.contact_info.email"
                    placeholder="email@example.com"
                    type="email"
                    class="h-8 mt-1"
                  />
                </div>
                <div>
                  <Label class="text-xs">Phone</Label>
                  <Input
                    v-model="member.contact_info.phone"
                    placeholder="+256..."
                    type="tel"
                    class="h-8 mt-1"
                  />
                </div>
              </div>
              <div>
                <Label class="text-xs">Address</Label>
                <Input
                  v-model="member.contact_info.address"
                  placeholder="Physical address"
                  class="h-8 mt-1"
                />
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        <!-- Empty State -->
        <div
          v-if="!modelValue[role.id]?.length"
          class="text-xs text-muted-foreground italic p-3 border border-dashed rounded-lg text-center"
        >
          No {{ role.label_plural || role.name }} added yet.
          <span v-if="role.min_count" class="text-destructive block mt-1">
            Please add at least {{ role.min_count }}.
          </span>
        </div>
      </div>
    </div>

    <!-- Representation Selection -->
    <div v-if="partyRoles.length > 0" class="flex flex-col gap-2 mt-4 border-t pt-4">
      <Label class="text-sm font-semibold">Who are you representing?*</Label>
      <p class="text-xs text-muted-foreground mb-2">
        Select which party/parties you are representing in this matter
      </p>

      <!-- Role Selection -->
      <Select
        :model-value="representing?.role_id"
        @update:model-value="updateRepresentingRole"
      >
        <SelectTrigger class="w-full">
          <SelectValue placeholder="Select party role" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem
            v-for="role in partyRoles"
            :key="role.id"
            :value="role.id"
            :disabled="!modelValue[role.id]?.length"
          >
            {{ role.label_plural || role.name }}
            <span v-if="!modelValue[role.id]?.length" class="text-xs text-muted-foreground">
              (No members added)
            </span>
          </SelectItem>
        </SelectContent>
      </Select>

      <!-- Individual Party Member Selection (if role selected) -->
      <div v-if="representing?.role_id && modelValue[representing.role_id]?.length" class="flex flex-col gap-2 mt-2">
        <Label class="text-xs text-muted-foreground">
          Select specific party members (or leave empty to represent all)
        </Label>
        <div class="flex flex-col gap-1">
          <div
            v-for="member in modelValue[representing.role_id]"
            :key="member.id"
            class="flex items-center space-x-2"
          >
            <Checkbox
              :id="`rep-${member.id}`"
              :checked="representing.party_member_ids.includes(member.id)"
              @update:checked="(checked) => togglePartyMember(member.id, checked)"
            />
            <Label
              :for="`rep-${member.id}`"
              class="text-sm font-normal cursor-pointer"
            >
              {{ member.name || 'Unnamed party' }}
              <span class="text-xs text-muted-foreground">
                ({{ member.type || 'No type' }})
              </span>
            </Label>
          </div>
        </div>
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Plus, Trash2, ChevronDown } from "lucide-vue-next";
import { v4 as uuidv4 } from "uuid";
import { computed } from "vue";

interface PartyRole {
  id: string;
  name: string;
  label_singular: string;
  label_plural: string;
  side: 'first' | 'second';
  min_count: number;
  max_count: number | null;
}

interface PartyMember {
  id: string;
  role_id: string;
  role_name: string;
  name: string;
  type: "individual" | "corporate" | "government" | "other";
  contact_info: {
    email?: string;
    phone?: string;
    address?: string;
  };
  _showContact?: boolean; // UI state
}

const props = defineProps<{
  partyRoles: PartyRole[];
  modelValue: Record<string, PartyMember[]>;
  representing: { role_id: string; party_member_ids: string[] } | null;
}>();

const emits = defineEmits<{
  "update:modelValue": [value: Record<string, PartyMember[]>];
  "update:representing": [value: { role_id: string; party_member_ids: string[] } | null];
}>();

const addPartyMember = (roleId: string, roleName: string) => {
  const currentMembers = props.modelValue[roleId] || [];
  const newMember: PartyMember = {
    id: uuidv4(),
    role_id: roleId,
    role_name: roleName,
    name: "",
    type: "individual",
    contact_info: {},
    _showContact: false,
  };

  emits("update:modelValue", {
    ...props.modelValue,
    [roleId]: [...currentMembers, newMember],
  });
};

const removePartyMember = (roleId: string, index: number) => {
  const currentMembers = props.modelValue[roleId] || [];
  const memberToRemove = currentMembers[index];
  const newMembers = [...currentMembers];
  newMembers.splice(index, 1);

  // Update model value
  emits("update:modelValue", {
    ...props.modelValue,
    [roleId]: newMembers,
  });

  // If this member was in representing, remove them
  if (props.representing?.party_member_ids.includes(memberToRemove.id)) {
    const newPartyMemberIds = props.representing.party_member_ids.filter(
      (id) => id !== memberToRemove.id
    );
    emits("update:representing", {
      ...props.representing,
      party_member_ids: newPartyMemberIds,
    });
  }
};

const updateRepresentingRole = (roleId: string) => {
  // When role changes, automatically select all members of that role
  const roleMembers = props.modelValue[roleId] || [];
  emits("update:representing", {
    role_id: roleId,
    party_member_ids: roleMembers.map((m) => m.id),
  });
};

const togglePartyMember = (memberId: string, checked: boolean) => {
  if (!props.representing) return;

  const currentIds = props.representing.party_member_ids;
  const newIds = checked
    ? [...currentIds, memberId]
    : currentIds.filter((id) => id !== memberId);

  emits("update:representing", {
    ...props.representing,
    party_member_ids: newIds,
  });
};

// Validation
const validationErrors = computed(() => {
  const errors: string[] = [];

  // Check min_count for each role
  for (const role of props.partyRoles) {
    const members = props.modelValue[role.id] || [];
    if (members.length < role.min_count) {
      errors.push(
        `${role.name} requires at least ${role.min_count} member(s), but only ${members.length} provided`
      );
    }

    // Check for empty names
    const emptyNames = members.filter((m) => !m.name.trim());
    if (emptyNames.length > 0) {
      errors.push(
        `${emptyNames.length} ${role.name} member(s) missing names`
      );
    }
  }

  // Check if representing is set (if parties exist)
  const hasParties = Object.values(props.modelValue).some((arr) => arr.length > 0);
  if (hasParties && !props.representing?.role_id) {
    errors.push("Please select which party you are representing");
  }

  if (props.representing?.role_id && props.representing.party_member_ids.length === 0) {
    errors.push("Please select at least one party member to represent");
  }

  return errors;
});

// Expose validation method for parent component
defineExpose({
  isValid: computed(() => validationErrors.value.length === 0),
  errors: validationErrors,
});
</script>
