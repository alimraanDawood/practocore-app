<template>
  <div class="flex flex-col lg:w-[95vw] p-5 gap-3 w-full h-full overflow-hidden border-x">
    <div class="flex flex-row w-full justify-between">
      <div class="flex flex-col">
        <h1 class="text-2xl font-bold ibm-plex-serif">Team</h1>
        <p class="text-sm text-muted-foreground">MMAKS Advocates</p>
      </div>

      <div class="flex flex-row gap-3">
        <Button variant="outline">Export</Button>
        <Button><Plus /> Add Lawyer</Button>
      </div>
    </div>
    <div class="grid grid-cols-5 w-full gap-3">
      <div class="p-3 border bg-muted rounded-lg flex flex-col">
        <span class="text-lg font-semibold ibm-plex-serif">10 Lawyers</span>
      </div>

      <div class="p-3 border bg-muted rounded-lg flex flex-col">
        <span class="text-lg font-semibold ibm-plex-serif">8 Active</span>
      </div>

      <div class="p-3 border bg-muted rounded-lg flex flex-col">
        <span class="text-lg font-semibold ibm-plex-serif">3 In Court Today</span>
      </div>

      <div class="p-3 border bg-muted rounded-lg flex flex-col">
        <span class="text-lg font-semibold ibm-plex-serif">1 On Leave</span>
      </div>

      <div class="p-3 border bg-muted rounded-lg flex flex-col">
        <span class="text-lg font-semibold ibm-plex-serif">47 Open Matters</span>
      </div>
    </div>

    <div class="flex flex-row justify-between w-full">
      <div class="flex flex-row gap-3">
        <InputGroup>
          <InputGroupInput placeholder="Search..." />
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupAddon align="inline-end">
            12 results
          </InputGroupAddon>
        </InputGroup>
      </div>
    </div>
    {{ members }}
  </div>
</template>

<script setup>
import { Plus, Search } from "lucide-vue-next";
import {getOrganisationMembers} from "~/services/admin/index.ts";
import {getSignedInUser} from "~/services/auth/index.ts";

const members = await getOrganisationMembers(getSignedInUser()?.organisation);
</script>