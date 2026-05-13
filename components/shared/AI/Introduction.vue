<script lang="ts" setup>
const open = defineModel<boolean>('open', { default: false });
const emit = defineEmits<{ tryIt: [] }>();
</script>

<template>
  <Drawer v-model:open="open">
    <DrawerTrigger v-if="$slots.default" as-child>
      <slot />
    </DrawerTrigger>

    <DrawerContent>
      <div class="flex flex-col p-3 gap-5">
        <div class="grid grid-cols-2 w-full">
          <div class="flex flex-col p-3 items-center justify-center">
            <div class="size-10 bg-primary text-primary-foreground dark:bg-secondary dark:text-secondary-foreground grid place-items-center rounded-full font-semibold">AI</div>
          </div>

          <div class="flex flex-col w-full gap-1 h-44 overflow-hidden items-start justify-center relative">
            <div class="h-10 bg-gradient-to-b from-background/90 to-transparent w-full absolute top-0"></div>
            <Badge variant="secondary">Latest Deadline</Badge>
            <Badge variant="secondary">List Matters</Badge>
            <Badge variant="secondary">Latest Deadline</Badge>
            <Badge variant="secondary">Create Reminders</Badge>
            <Badge variant="secondary">Send Notifications</Badge>
            <Badge variant="secondary">Latest Deadline</Badge>
            <Badge variant="secondary">Latest Deadline</Badge>
            <div class="h-10 bg-gradient-to-t from-background/90 to-transparent w-full absolute bottom-0"></div>
          </div>
        </div>

        <div class="flex flex-col gap-1">
          <span class="text-lg ibm-plex-serif font-semibold">Meet PractoAI</span>
          <span>Lorem ipsum dolor sit amet consectetur adipisicing elit. Molestias amet dignissimos maiores animi eligendi ducimus.</span>
        </div>

        <div class="flex flex-col gap-1">
          <Button @click="emit('tryIt')">Try It</Button>
          <Button variant="secondary">Learn More</Button>
        </div>
      </div>
    </DrawerContent>
  </Drawer>
</template>
