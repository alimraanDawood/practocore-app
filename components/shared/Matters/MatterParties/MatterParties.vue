<template>
  <Popover v-if="hasParties" class="flex flex-col lg:max-w-lg w-full border rounded-lg p-3 gap-3 bg-muted/30">
    <PopoverTrigger>
      <Button variant="outline" size="sm">
        <Users class="size-4"/>
        Parties

        <ChevronDown class="size-5"/>
      </Button>
    </PopoverTrigger>

    <PopoverContent class="flex flex-col w-md gap-3">
      <SharedMattersMatterPartiesEditMatterParties @click="e => e.stopPropagation()" :matter="matter" :representing="matter?.representing"
                                                   :parties="matter?.parties" class="ml-auto">

        <div class="flex flex-row w-full justify-between items-center">
         <span class="text-lg font-semibold ibm-plex-serif">Parties</span>
        <Button class="w-fit ml-auto" size="xs" variant="destructive">Edit</Button>
        </div>
      </SharedMattersMatterPartiesEditMatterParties>
      <!-- Party Roles -->
      <div class="flex flex-col gap-4">
        <div v-for="(members, roleId) in parties" :key="roleId" class="flex flex-col gap-2">
          <!-- Role Header -->
          <div class="flex flex-row items-center justify-between">
            <h4 class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {{ getRoleLabel(roleId) }}
            </h4>
            <Badge
                v-if="isRepresentedRole(roleId)"
                variant="default"
                class="text-xs gap-1"
            >
              <Scale class="size-3"/>
              We Represent
            </Badge>
          </div>

          <!-- Party Members -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div
                v-for="member in members"
                :key="member.id"
                class="flex flex-col gap-1 p-2 bg-background border rounded-md"
                :class="{
                'ring-2 ring-primary ring-offset-2 ring-offset-background': isRepresentedMember(member.id),
              }"
            >
              <div class="flex flex-row items-start justify-between gap-2">
                <div class="flex flex-col gap-0.5 flex-1 min-w-0">
                  <span class="font-medium text-sm truncate">{{ member.name }}</span>
                  <!--                <Badge variant="outline" class="w-fit text-xs">-->
                  <!--                  {{ formatPartyType(member.type) }}-->
                  <!--                </Badge>-->
                </div>
                <CheckCircle2
                    v-if="isRepresentedMember(member.id)"
                    class="size-4 text-primary shrink-0 mt-0.5"
                />
              </div>

              <!-- Contact Info (if available) -->
              <div
                  v-if="hasContactInfo(member)"
                  class="flex flex-col gap-0.5 text-xs text-muted-foreground mt-1"
              >
                <div v-if="member.contact_info?.email" class="flex items-center gap-1">
                  <Mail class="size-3"/>
                  <span class="truncate">{{ member.contact_info.email }}</span>
                </div>
                <div v-if="member.contact_info?.phone" class="flex items-center gap-1">
                  <Phone class="size-3"/>
                  <span>{{ member.contact_info.phone }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Summary Footer -->
      <div class="flex flex-row items-center justify-between pt-2 border-t text-xs text-muted-foreground">
        <span>
          Total: {{ totalPartyCount }} {{ totalPartyCount === 1 ? 'party' : 'parties' }}
        </span>
        <span v-if="representedCount > 0">
          Representing: {{ representedCount }} {{ representedCount === 1 ? 'party' : 'parties' }}
        </span>
      </div>
    </PopoverContent>
  </Popover>
</template>

<script setup lang="ts">
import {computed} from "vue";
import {Users, Scale, CheckCircle2, Mail, Phone, ChevronDown} from "lucide-vue-next";
import {Badge} from "~/components/ui/badge";

interface Props {
  matter: any;
}

const props = defineProps<Props>();

// Check if matter has parties
const hasParties = computed(() => {
  return props.matter?.parties && Object.keys(props.matter.parties).length > 0;
});

// Get parties from matter
const parties = computed(() => {
  return props.matter?.parties || {};
});

// Get representing info
const representing = computed(() => {
  return props.matter?.representing;
});

// Get party role label from template
const getRoleLabel = (roleId: string) => {
  if (!props.matter?.partyConfig?.roles) return roleId;

  const role = props.matter?.partyConfig?.roles.find((r: any) => r.id === roleId);
  return role?.label_plural || role?.name || roleId;
};

// Check if a role is represented
const isRepresentedRole = (roleId: string) => {
  return representing.value?.role_id === roleId;
};

// Check if a specific member is represented
const isRepresentedMember = (memberId: string) => {
  return representing.value?.party_member_ids?.includes(memberId);
};

// Format party type
const formatPartyType = (type: string) => {
  const typeMap: Record<string, string> = {
    individual: "Individual",
    corporate: "Corporate",
    government: "Government",
    other: "Other",
  };
  return typeMap[type] || type;
};

// Check if member has contact info
const hasContactInfo = (member: any) => {
  return (
      member.contact_info?.email ||
      member.contact_info?.phone ||
      member.contact_info?.address
  );
};

// Total party count
const totalPartyCount = computed(() => {
  return Object.values(parties.value).reduce(
      (sum: number, members: any) => sum + members.length,
      0
  );
});

// Represented party count
const representedCount = computed(() => {
  return representing.value?.party_member_ids?.length || 0;
});
</script>
