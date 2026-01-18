
<template>
  <DefineTemplate>
    <div class="flex flex-row bg-background p-3 border-b">
      <span class="ibm-plex-serif font-semibold text-lg">Billing</span>
    </div>
    <div class="flex flex-col p-3 gap-5">
      <div v-if="billingStore?.activeSubscription" class="bg-muted w-full flex flex-col border p-3 text-muted-foreground gap-3 rounded-lg">
        <span class="ibm-plex-serif font-semibold">Active Subscription</span>
        <div class="flex flex-row w-full gap-2">
          <Badge variant="outline">{{ billingStore?.activeSubscription?.type === 'organisation' ? 'Organisation Plan' : 'Individual Plan' }}</Badge>
          <Badge v-if="billingStore?.activeSubscription?.trial" variant="outline">Free Trial</Badge>
        </div>

        <div class="flex flex-row gap-2 items-ceter">
          <span>Valid Until:  <b class="text-foreground">12/13/2026 (3 months from now)</b></span>

          <Subscribe>
            <Button variant="secondary" class="gap-1" size="xs">
              <RotateCw class="size-3" />
              Renew
            </Button>
          </Subscribe>
        </div>
      </div>

      <div class="flex flex-col gap-2">
        <div class="flex flex-row items-center w-full justify-between">
          <span class="font-semibold ibm-plex-serif">Subscription History</span>

          <Button @click="billingStore?.reloadSubscriptionData()" size="sm" variant="outline"> <RotateCw /> Reload</Button>
        </div>
        <div class="border flex flex-col">
          <Table>
            <TableHeader>
              <TableRow class="divide-x bg-muted text-muted-foreground">
                <TableHead class="font-semibold ibm-plex-serif">Date</TableHead>
                <TableHead class="font-semibold ibm-plex-serif">Period</TableHead>
                <TableHead class="font-semibold ibm-plex-serif">Amount</TableHead>
                <TableHead class="font-semibold ibm-plex-serif">Paid Via</TableHead>
                <TableHead class="font-semibold ibm-plex-serif">Action</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              <TableRow v-for="subscription in (billingStore.subscriptionHistory?.items || [])" class="divide-x">
                <TableCell>{{ dayjs(subscription?.created)?.format('DD/MM/YYYY HH:MM') }}</TableCell>
                <TableCell>1 month</TableCell>
                <TableCell>{{ subscription?.trial ? 'free' : `UGX ${subscription?.amount?.toLocaleString()}` }}</TableCell>
                <TableCell>
                  <Badge variant="outline">{{ subscription?.type }}</Badge>
                </TableCell>
                <TableCell>
                  <Button variant="outline" size="sm">View Receipt</Button>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>

          <div class="flex flex-row w-full p-3 items-center justify-center border-t">
            <span class="italic text-xs font-medium">Pagination</span>
          </div>
        </div>
      </div>
    </div>
  </DefineTemplate>

  <Dialog v-if="$viewport.isGreaterOrEquals('customxs')">
    <DialogTrigger>
      <slot />
    </DialogTrigger>

    <DialogContent class="p-0 flex flex-col overflow-hidden gap-0 w-full xs:min-w-xl lg:min-w-3xl">
      <ReuseTemplate />
    </DialogContent>
  </Dialog>

  <Drawer v-else>
    <DrawerTrigger>
      <slot />
    </DrawerTrigger>

    <DrawerContent class="p-0 flex flex-col overflow-hidden gap-0 w-full max-w-3xl">
      <ReuseTemplate />
    </DrawerContent>
  </Drawer>
</template>

<script setup>
import { RotateCw } from "lucide-vue-next";
import {getSubscriptions} from "~/services/subscriptions/index.ts";
import dayjs from "dayjs";
import Subscribe from "~/components/shared/Billing/Subscribe.vue";
import {useBillingStore} from "~/stores/billing.ts";

const subscriptions = ref(null);

const [DefineTemplate, ReuseTemplate] = createReusableTemplate();

const billingStore = useBillingStore();


onMounted(async () => {
  billingStore.init();
})
</script>