<template>
  <div class="flex flex-col border rounded-lg bg-muted">
    <div class="flex flex-col p-3 gap-3 h-full">
      <div class="flex flex-row gap-2 items-center">
        <Avatar class="size-10 shrink-0 rounded-lg">
          <AvatarImage v-if="avatar" :src="avatar" :alt="name"/>
          <AvatarFallback class="text-xs font-medium rounded-lg bg-primary text-primary-foreground">
            {{ initials }}
          </AvatarFallback>
        </Avatar>

        <div class="flex flex-col truncate">
          <span class="text-lg font-semibold ibm-plex-serif">{{ lawyer?.name }}</span>
          <span class="text-sm text-muted-foreground font-semibold">{{
              getOrganisationRoleString(lawyer?.organisationRole)
            }}</span>
        </div>
      </div>

      <div class="flex flex-row gap-1 items-center text-muted-foreground">
        <Mail class="size-4"/>

        <NuxtLink
            class="text-sm text-muted-foreground truncate hover:text-foreground underline-offset-4 hover:underline transition-colors"
            :to="`mailto:${lawyer?.email}`">{{ lawyer?.email }}
        </NuxtLink>
      </div>

      <div class="flex flex-col">
        <span class="font-semibold text-sm">Next Deadline</span>
        <template v-if="lawyer?.nextDeadline">
          <span class="text-lg font-semibold ibm-plex-serif truncate">{{ lawyer?.nextDeadline?.name }}</span>
          <span class="text-sm">{{ dayjs(lawyer?.nextDeadline?.date).format('D MMMM YYYY') }} ({{ dayjs(lawyer?.nextDeadline?.date).fromNow() }})</span>
        </template>
        <span class="font-semibold ibm-plex-serif" v-else>No Deadlines</span>
      </div>
    </div>

    <div class="flex flex-row border-t p-3 justify-end">
      <SharedLawyersLawyerDetails :lawyer-id="lawyer?.id">
        <Button size="sm">Profile</Button>
      </SharedLawyersLawyerDetails>
    </div>
  </div>
</template>

<script setup lang="ts">
import {Mail, Phone} from "lucide-vue-next";
import {getOrganisationRoleString} from "~/components/shared/Lawyers/members";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

const props = defineProps(['lawyer']);
const avatar = computed(() => props?.lawyer?.avatar || '')

const initials = computed(() => {
  return props.lawyer?.name
      ?.split(' ')
      .map((n: string) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || '??'
})
</script>