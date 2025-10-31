<script setup lang="ts">
const emit = defineEmits(['invited']);

const handleInvited = () => {
  emit('invited');
};
</script>

<template>
  <Dialog v-if="$viewport.isGreaterOrEquals('customxs')">
    <DialogTrigger as-child class="w-full">
      <slot/>
    </DialogTrigger>

    <DialogContent class="overflow-hidden max-h-[85vh]">
      <DialogHeader>
        <DialogTitle>
          Invite Members to your organisation
        </DialogTitle>
        <DialogDescription>Invite your team to collaborate on future matters and cases.</DialogDescription>
      </DialogHeader>

      <div class="flex flex-col w-full h-full overflow-y-scroll">
        <AuthInviteForm @invited="handleInvited" />
      </div>
    </DialogContent>
  </Dialog>

  <Sheet v-else>
    <SheetTrigger as-child class="w-full">
      <slot/>
    </SheetTrigger>

    <SheetContent class="w-full overflow-y-scroll">
      <SheetHeader>
        <SheetTitle>
          Invite Members to your organisation
        </SheetTitle>
        <SheetDescription>Invite your team to collaborate on future matters and cases.</SheetDescription>
      </SheetHeader>

      <AuthInviteForm @invited="handleInvited" />
    </SheetContent>

  </Sheet>
</template>