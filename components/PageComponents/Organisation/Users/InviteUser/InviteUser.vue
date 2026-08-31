<script setup lang="ts">
const emit = defineEmits(['invited']);

// Optional controlled open, so a caller with no trigger of its own — the team
// page's right-click menu — can open this. The slot trigger still works when
// nothing binds it.
const open = defineModel<boolean>('open', { default: false });

const handleInvited = () => {
  emit('invited');
};
</script>

<template>
  <Dialog v-if="$viewport.isGreaterOrEquals('customxs')" v-model:open="open">
    <DialogTrigger as-child class="w-full">
      <slot/>
    </DialogTrigger>

    <!-- flex, not the DialogContent default grid.
         The form was clipped at the bottom — Send Invitation half cut off — because
         `overflow-hidden max-h-[85vh]` capped the dialog while its scroll wrapper
         had no bounded height to scroll within: `h-full` resolves against a parent
         whose own height is content-driven, so in the default auto-sized grid row
         the content simply grew past the cap and was hidden.

         A flex column plus `flex-1 min-h-0` on the scroll area is what bounds it.
         `min-h-0` is the load-bearing half: a flex item defaults to
         `min-height: auto`, which refuses to shrink below its content, so without
         it the wrapper still overflows and nothing scrolls. -->
    <DialogContent class="flex flex-col overflow-hidden max-h-[85vh]">
      <DialogHeader>
        <DialogTitle>
          Invite Members to your organisation
        </DialogTitle>
        <DialogDescription>Invite your team to collaborate on future matters and cases.</DialogDescription>
      </DialogHeader>

      <div class="flex flex-col w-full flex-1 min-h-0 overflow-y-auto">
        <AuthInviteForm @invited="handleInvited" />
      </div>
    </DialogContent>
  </Dialog>

  <Sheet v-else v-model:open="open">
    <SheetTrigger as-child class="w-full">
      <slot/>
    </SheetTrigger>

    <!-- Same shape on the sheet: the header stays put and only the form scrolls,
         rather than the whole panel scrolling as one block. -->
    <SheetContent class="w-full flex flex-col overflow-hidden">
      <SheetHeader>
        <SheetTitle>
          Invite Members to your organisation
        </SheetTitle>
        <SheetDescription>Invite your team to collaborate on future matters and cases.</SheetDescription>
      </SheetHeader>

      <div class="flex flex-col w-full flex-1 min-h-0 overflow-y-auto">
        <AuthInviteForm @invited="handleInvited" />
      </div>
    </SheetContent>

  </Sheet>
</template>