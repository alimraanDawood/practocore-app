<template>
  <DefineTemplate>
    <div class="flex flex-col gap-6">
      <div class="flex flex-col gap-2">
        <div class="flex flex-col">
          <span class="font-semibold">Subscription</span>
          <span class="text-sm text-muted-foreground">Details about your current subscription</span>
        </div>

        <div v-if="billingStore?.activeSubscription" class="flex flex-col border gap-1 p-1 rounded-lg">
          <div class="bg-muted p-3 border gap-2 flex flex-col rounded">
            <span class="text-xl ibm-plex-serif font-semibold">Free Trial</span>
            <div class="flex flex-row gap-2 text-sm items-center">{{ dayjs(billingStore?.activeSubscription?.startDate).format('d ddd, MMMM YYYY') }} <ArrowRight class="size-4" /> {{ dayjs(billingStore?.activeSubscription?.endDate).format('d ddd, MMMM YYYY') }}</div>
            <span class="text-sm">Plan Type: <b>{{ billingStore?.activeSubscription?.expand?.plan?.name }}</b></span>

            <div class="flex flex-col gap-1">
              <div class="flex flex-row w-full justify-between text-sm">
                <span class="font-semibold">Seats</span>
                <span class="font-bold ibm-plex-serif">{{ 1 }} / {{ billingStore?.activeSubscription?.expand?.plan?.maxSeats }}</span>
              </div>

              <div class="flex flex-row bg-muted-foreground/50 h-1 overflow-hidden rounded-full w-full">
                <div class="bg-primary h-full rounded-full" :style="{ width: `${(1/1) * 100}%` }"></div>
              </div>
            </div>
          </div>

          <div class="flex flex-row w-full justify-between pl-2">
            <span class="ibm-plex-serif text-lg font-semibold">Purchase a plan</span>

            <Button size="sm">Subscribe to PractoCore</Button>
          </div>
        </div>
      </div>

      <div class="w-full outline-2 outline-border text-muted-foreground bg-muted/30 items-center justify-center flex flex-col outline-dashed p-3 h-32 rounded-lg">
        <span>Subscription History</span>
      </div>
    </div>
  </DefineTemplate>

  <ReuseTemplate v-if="!asModal"/>

  <Dialog v-else-if="$viewport.isGreaterThan('customxs')">
    <DialogTrigger>
      <slot/>
    </DialogTrigger>

    <DialogContent
        class="flex flex-col gap-0 lg:!max-w-5xl xs:!max-w-[95vw] w-full p-0 max-h-[85vh] h-full overflow-hidden">
      <div class="flex flex-col border-b p-3">
        <span class="ibm-plex-serif font-semibold">Billing Settings</span>
      </div>

      <div class="flex flex-col lg:flex-row w-full  gap-3 h-full overflow-hidden">
        <!-- Tab Content -->
        <div class="flex flex-col w-full h-full overflow-y-scroll p-5">
          <ReuseTemplate />
        </div>
      </div>
    </DialogContent>
  </Dialog>

  <Drawer v-else>
    <DrawerTrigger>
      <slot/>
    </DrawerTrigger>

    <DrawerContent></DrawerContent>
  </Drawer>
</template>

<script setup lang="ts">
import {Bell, CreditCard, Calendar, User, Tag, CircleStop, ArrowRight} from "lucide-vue-next";
import dayjs from "dayjs";
import { useOrganisationStore } from "~/stores/organisation";
import {getSignedInUser} from "~/services/auth";

const props = defineProps(['asModal']);
const [DefineTemplate, ReuseTemplate] = createReusableTemplate();
const billingStore = useBillingStore();
billingStore.ensureSubscribed();

const organisationStore = useOrganisationStore();
organisationStore.fetchOrganisation(getSignedInUser()?.organisation);

</script>