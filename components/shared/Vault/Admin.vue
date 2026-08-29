<script lang="ts" setup>
import { toast } from 'vue-sonner';
import { createVault, type Vault } from '~/services/vault';
import { useVaultLibraries } from '~/composables/useVaultLibraries';

// Creating a custom vault, and managing one's members and settings. Both live
// here so every surface that offers them — the rail, the home screen, a vault's
// own header — opens the same two dialogs rather than each growing its own.
const { vaults, upsertVault, removeVault, libraryPath } = useVaultLibraries();

const createOpen = ref(false);
const name = ref('');
const description = ref('');
const creating = ref(false);

async function submitCreate() {
  const n = name.value.trim();
  if (!n) return;
  creating.value = true;
  try {
    const v = await createVault({ name: n, description: description.value.trim() });
    upsertVault(v);
    name.value = '';
    description.value = '';
    createOpen.value = false;
    toast.success('Vault created.');
    // Straight into it: a new empty library the user cannot see is not created yet
    // as far as they are concerned.
    navigateTo(libraryPath({ scope: 'vault', scopeId: v.id }));
  } catch (e: any) {
    toast.error(e?.message || 'Could not create the vault.');
  } finally { creating.value = false; }
}

const manageTarget = ref<Vault | null>(null);

function onUpdated(v: Vault) { upsertVault(v); manageTarget.value = v; }
function onDeleted(id: string) {
  removeVault(id);
  manageTarget.value = null;
  navigateTo('/main/vault');
}

defineExpose({
  create: () => setTimeout(() => { createOpen.value = true; }, 0),
  manage: (v: Vault) => setTimeout(() => { manageTarget.value = v; }, 0),
  manageById: (id: string) => {
    const v = vaults.value.find((x) => x.id === id);
    if (v) setTimeout(() => { manageTarget.value = v; }, 0);
  },
});
</script>

<template>
  <div>
    <Dialog v-if="$viewport.isGreaterThan('tablet')" v-model:open="createOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New vault</DialogTitle>
          <DialogDescription>
            A private document library you can share with chosen colleagues. The AI reads its
            files, so you can ask about them in chat.
          </DialogDescription>
        </DialogHeader>
        <div class="flex flex-col gap-3">
          <div class="flex flex-col gap-1.5">
            <Label class="text-xs">Name</Label>
            <Input
              v-model="name" placeholder="e.g. Banking Litigation, Due Diligence"
              autofocus @keydown.enter.prevent="submitCreate" />
          </div>
          <div class="flex flex-col gap-1.5">
            <Label class="text-xs">Description <span class="text-muted-foreground">(optional)</span></Label>
            <Textarea v-model="description" rows="2" placeholder="What this vault is for" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" :disabled="creating" @click="createOpen = false">Cancel</Button>
          <Button :disabled="creating || !name.trim()" @click="submitCreate">
            {{ creating ? 'Creating…' : 'Create vault' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Drawer v-else v-model:open="createOpen">
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>New vault</DrawerTitle>
          <DrawerDescription>
            A private document library you can share with chosen colleagues. The AI reads its
            files, so you can ask about them in chat.
          </DrawerDescription>
        </DrawerHeader>
        <div class="flex flex-col gap-3 p-3">
          <div class="flex flex-col gap-1.5">
            <Label class="text-xs">Name</Label>
            <Input
                v-model="name" placeholder="e.g. Banking Litigation, Due Diligence"
                autofocus @keydown.enter.prevent="submitCreate" />
          </div>
          <div class="flex flex-col gap-1.5">
            <Label class="text-xs">Description <span class="text-muted-foreground">(optional)</span></Label>
            <Textarea v-model="description" rows="2" placeholder="What this vault is for" />
          </div>
        </div>
        <DrawerFooter>
          <Button :disabled="creating || !name.trim()" @click="submitCreate">
            {{ creating ? 'Creating…' : 'Create vault' }}
          </Button>
          <Button variant="outline" :disabled="creating" @click="createOpen = false">Cancel</Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>

    <SharedVaultManageDialog
      :vault="manageTarget"
      @update:open="(v) => { if (!v) manageTarget = null; }"
      @updated="onUpdated"
      @deleted="onDeleted" />
  </div>
</template>
