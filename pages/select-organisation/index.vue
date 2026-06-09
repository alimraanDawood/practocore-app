<template>
  <div class="flex flex-col h-[100dvh] w-full items-center justify-center gap-8 p-6">
    <div class="flex flex-col items-center gap-2 text-center max-w-md">
      <Scale class="size-12 text-muted-foreground opacity-50" aria-hidden="true" />
      <h1 class="text-2xl ibm-plex-serif font-semibold">Choose your workspace</h1>
      <p class="text-sm text-muted-foreground">
        Your account isn’t attached to a workspace yet. Select an organisation to continue.
      </p>
    </div>

    <div v-if="loading" class="flex items-center justify-center py-8">
      <Loader class="animate-spin size-6" aria-hidden="true" />
      <span class="sr-only">Loading your workspaces</span>
    </div>

    <!-- Has at least one workspace to choose from -->
    <div v-else-if="options.length" class="flex flex-col w-full max-w-sm gap-2">
      <Button
        v-for="opt in options"
        :key="opt.id ?? 'individual'"
        variant="outline"
        class="justify-between h-auto py-3"
        :disabled="!!selecting"
        @click="choose(opt)"
      >
        <span class="flex items-center gap-2">
          <component :is="opt.id ? Building2 : User" class="size-4" aria-hidden="true" />
          {{ opt.name }}
        </span>
        <Loader v-if="selecting === (opt.id ?? 'individual')" class="animate-spin size-4" aria-hidden="true" />
        <ChevronRight v-else class="size-4 opacity-50" aria-hidden="true" />
      </Button>
    </div>

    <!-- Locked: no organisation membership and no individual subscription -->
    <div v-else class="flex flex-col items-center gap-4 max-w-md text-center">
      <div class="flex flex-col gap-1">
        <p class="font-semibold text-foreground">No workspace available</p>
        <p class="text-sm text-muted-foreground">
          You’re not a member of any organisation and don’t have an active individual
          subscription. Ask your firm’s administrator to add you to their organisation,
          or set up an individual plan to continue.
        </p>
      </div>
      <div class="flex items-center gap-2">
        <Button @click="reload">Try again</Button>
        <Button variant="ghost" @click="logout">Sign out</Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Scale, Loader, Building2, User, ChevronRight } from "lucide-vue-next";
import { toast } from "vue-sonner";
import { updateUser, signOut } from "~/services/auth";
import { loadAccountAccess, clearAccountAccessCache, type AccountOrg } from "~/composables/useAccountAccess";

definePageMeta({ layout: "blank" });

const route = useRoute();
const next = (route.query?.next as string | undefined) || "/";

const loading = ref(true);
const selecting = ref<string | null>(null);
const options = ref<Array<{ id: string | null; name: string }>>([]);

const load = async () => {
  loading.value = true;
  const access = await loadAccountAccess(true);
  options.value = [
    ...access.availableOrganisations.map((o: AccountOrg) => ({ id: o.id, name: o.name })),
    ...(access.hasIndividualAccount ? [{ id: null, name: "Your Individual Plan" }] : []),
  ];
  loading.value = false;
};

const choose = async (opt: { id: string | null; name: string }) => {
  if (selecting.value) return;
  selecting.value = opt.id ?? "individual";
  try {
    // Setting the active organisation pointer (null = individual context).
    await updateUser({ organisation: opt.id });
    clearAccountAccessCache();
    // Full reload so session singletons (permissions, plan, account access) re-init
    // cleanly under the newly-selected context instead of using stale cached state.
    window.location.href = next;
  } catch (e) {
    console.error(e);
    toast.error("Couldn’t switch to that workspace. Please try again.");
    selecting.value = null;
  }
};

const reload = () => load();

const logout = async () => {
  await signOut();
  window.location.href = "/auth/login";
};

onMounted(load);
</script>
