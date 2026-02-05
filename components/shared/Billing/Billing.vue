<template>
  <DefineTemplate>
    <div class="flex flex-col gap-6">
      <div class="flex flex-col gap-2">
        <div class="flex flex-col">
          <span class="font-semibold">Subscription</span>
          <span class="text-sm text-muted-foreground">Details about your current subscription</span>
        </div>

        <div v-if="billingStore?.activeSubscription" class="flex flex-col bg-muted border p-2 rounded-lg">
          <table class="border-separate border-spacing-y-1">
            <tbody>
            <tr class="align-center">
              <td>
                <div class="flex text-sm text-muted-foreground flex-row gap-1 items-center">
                  <Tag class="size-4"/>
                  <span class="font-semibold">Plan</span>
                </div>
              </td>

              <td class="gap-2 flex flex-row items-center">
                <Badge>{{ billingStore?.activeSubscription?.trial ? 'Free Trial' : ( billingStore?.activeSubscription?.type === 'organisation' ? 'Organisation' : 'Individual' ) }}</Badge>

                <span class="text-xs text-muted-foreground">Expiring <b>{{ dayjs(billingStore?.activeSubscription?.endDate).format('d MMMM YYYY') }}</b></span>
              </td>
            </tr>

            <tr class="align-center">
              <td>
                <div class="flex text-sm text-muted-foreground flex-row gap-1 items-center">
                  <User class="size-4"/>
                  <span class="font-semibold">Seats</span>
                </div>
              </td>
              <td>
                <span class="font-semibold text-muted-foreground text-xs">1 seat</span>
              </td>
            </tr>
            </tbody>
          </table>
        </div>

        <div class="flex flex-row gap-2">
          <Button variant="secondary" size="sm">Switch to Yearly</Button>
        </div>
      </div>

      <div class="flex flex-col gap-2">
        <div class="flex flex-col">
          <span class="font-semibold">Manage billing information</span>
          <span class="text-sm text-muted-foreground">Edit payment method, see your invoices and more</span>
        </div>

        <div class="flex flex-row gap-2">
          <Button variant="secondary" size="sm"> <CreditCard /> View Billing Details</Button>
        </div>
      </div>

      <div class="flex flex-col gap-2">
        <div class="flex flex-col">
          <span class="font-semibold">Cancel subscription</span>
          <span class="text-sm text-muted-foreground">Your workspace will be disabled on subscription expiry</span>
        </div>

        <div class="flex flex-row gap-2">
          <Button variant="destructive" size="sm"> <CircleStop /> Cancel Plan</Button>
        </div>
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
import {Bell, CreditCard, Calendar, User, Tag, CircleStop} from "lucide-vue-next";
import dayjs from "dayjs";

const props = defineProps(['asModal']);
const [DefineTemplate, ReuseTemplate] = createReusableTemplate();
const billingStore = useBillingStore();
billingStore.ensureSubscribed();

</script>