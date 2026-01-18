<script setup lang="ts">
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';

import {X, Minus, Maximize2, Minimize2, AlertCircle} from "lucide-vue-next";
import {computed, ref} from "vue";
import DarkModeSwitch from "~/components/shared/DarkModeSwitch/DarkModeSwitch.vue";
import {acceptInvite, getOrganisationInviteReference, getSignedInUser} from "~/services/auth";
import {toast} from "vue-sonner";

definePageMeta({
  layout: 'blank',
});

const query = useRoute().query;

const isTauri = computed(() => {
  return '__TAURI_INTERNALS__' in window;
});

const isMainWindow = computed(() => {
  const currentWindow = getCurrentWindow();

  return currentWindow?.label === 'main';
});

const closeWindow = () => {
  const currentWindow = getCurrentWindow();
  currentWindow?.close();
}

const minimizeWindow = () => {
  const currentWindow = getCurrentWindow();
  currentWindow?.minimize();
}

const toggleMaximizeWindow = () => {
  const currentWindow = getCurrentWindow();
  currentWindow?.toggleMaximize();
}

const [DefineTemplate, ReuseTemplate] = createReusableTemplate();
const organisationRef = ref(null);
const accepted = ref(false);
const loading = ref(false);

onMounted(async () => {
  organisationRef.value = await getOrganisationInviteReference(query?.ref);
})

const isSignedIn = computed(() => {
  return !!getSignedInUser();
})

const _acceptInvitation = async () => {
  loading.value = true;
  try {
    const result = await acceptInvite(query?.ref);

    if(result) {
      toast.success("Invitation accepted successfully!");
      accepted.value = true;
    }
  } catch(e) {
    console.error(e);
    toast.error("Something went wrong!");
  }
  loading.value = false;
}
</script>
<template>
  <DefineTemplate>
    <div v-if="accepted" class="flex flex-col items-center p-5 justify-center h-full w-full gap-3">
      <img src="@/assets/img/logos/Practo%20Core%20Square%20--%20orange.png" class="size-16 mb-5" />

      <span class="font-semibold text-2xl ibm-plex-serif text-center">Invitation Accepted!</span>
      <span class="text-center">Your acceptance has been processed successfully, keep an eye on your inbox for the next steps.</span>

      <NuxtLink to="/main/">
        <Button class="w-full" variant="secondary">Go to Dashboard</Button>
      </NuxtLink>
    </div>

    <div v-else-if="organisationRef && isSignedIn" class="flex flex-col items-center p-5 justify-center h-full w-full gap-3">
      <img src="@/assets/img/logos/Practo%20Core%20Square%20--%20orange.png" class="size-16 mb-5" />

      <span class="font-semibold text-2xl ibm-plex-serif text-center">You are being invited to join an organisation</span>
      <span class="text-center"><b>{{ organisationRef?.invite?.invitedBy?.name }}</b> is inviting you to join <b>{{ organisationRef?.invite?.organisation?.name }}</b> on PractoCore.</span>


      <Button :disabled="loading" @click="_acceptInvitation" class="w-full">Accept Invitation</Button>

      <NuxtLink to="/main/" class="w-full">
        <Button :disabled="loading" class="w-full" variant="secondary">Skip</Button>
      </NuxtLink>

      <div class="flex flex-col w-full items-center">
        <Button :disabled="loading" variant="destructive" class="w-full">Reject Invitation</Button>
        <div class="flex flex-row gap-1 justify-center bg-muted w-[95%] items-center rounded-b-lg p-1 border">
          <AlertCircle class="size-3" />
          <span class="text-xs text-muted-foreground">You wont be able to use this link to join again!</span>
        </div>
      </div>
    </div>


    <div v-else-if="!organisationRef" class="flex flex-col items-center p-5 justify-center h-full w-full gap-3">
      <img src="@/assets/img/logos/Practo%20Core%20Square%20--%20orange.png" class="size-16 mb-5" />

      <span class="font-semibold text-2xl ibm-plex-serif text-center">Invalid Invite Reference!</span>
      <span class="text-center">We were unable to verify your invitation. Please request for a valid invitation from your administrator to continue</span>

      <Button class="w-full" variant="secondary">Go to Dashboard</Button>
    </div>

    <div v-else-if="organisationRef && !isSignedIn" class="flex flex-col items-center p-5 justify-center h-full w-full gap-3">
      <img src="@/assets/img/logos/Practo%20Core%20Square%20--%20orange.png" class="size-16 mb-5" />

      <span class="font-semibold text-2xl ibm-plex-serif text-center">You are being invited to join an organisation</span>
      <span class="text-center"><b>{{ organisationRef?.invite?.invitedBy?.name }}</b> is inviting you to join <b>{{ organisationRef?.invite?.organisation?.name }}</b> on PractoCore.</span>
      <span class="text-center">We have noticed you are not currently signed in. To continue, you need to be registered to use PractoCore.</span>
      <NuxtLink :to="`/auth/register?ref=${query?.ref}`" class="w-full">
        <Button class="w-full" variant="secondary">I have no account. Create one</Button>
      </NuxtLink>

      <NuxtLink :to="`/auth/login?ref=${query?.ref}`" class="w-full">
        <Button class="w-full">I have an account. Sign me in instead</Button>
      </NuxtLink>

    </div>
  </DefineTemplate>
  <div v-if="isTauri" class="flex flex-col w-full overflow-hidden items-center justify-center h-[100dvh]">
    <div data-tauri-drag-region class="flex flex-row w-full px-3 py-2 items-center border-b">
      <div data-tauri-drag-region class="flex flex-row w-full">
        <NuxtLink :to="query?.ref ? `/auth/register?ref=${query?.ref}` : '/auth/register'">
          <Button size="sm" variant="outline">Sign Up Instead</Button>
        </NuxtLink>
      </div>
      <div data-tauri-drag-region class="flex flex-row w-full text-center  items-center justify-center">
        <span class="ibm-plex-serif">Sign In to PractoCore</span>
      </div>
      <div data-tauri-drag-region class="flex flex-row w-full justify-end gap-2 items-center">
        <DarkModeSwitch class="mr-2" />
        <button @click="minimizeWindow" class="bg-muted text-muted-foreground size-6 grid place-items-center rounded-full"><Minus class="size-4" /></button>
        <button @click="toggleMaximizeWindow" class="bg-muted text-muted-foreground size-6 grid place-items-center rounded-full">
          <Maximize2 class="size-3 stroke-3" />
        </button>
        <button @click="closeWindow" class="bg-muted text-muted-foreground size-6 grid place-items-center rounded-full"><X class="size-4" /></button>
      </div>
    </div>

    <div class="flex flex-col items-center w-full divide-x h-full">
      <div class="flex flex-col h-full w-full max-w-xl items-center justify-center border-x overflow-hidden p-3">
        <div class="flex flex-col max-w-md w-full">
          <ReuseTemplate />
        </div>
      </div>
    </div>

    <div class="flex flex-row text-sm text-center w-full justify-center text-muted-foreground border-t p-3">
    </div>
  </div>

  <div v-else class="flex flex-col w-full h-[100dvh]">
    <div class="flex flex-row p-3 border-b"></div>
    <div class="flex flex-col w-full h-full gap-5 items-center justify-center">
      <div class="flex flex-col w-[95vw] items-center justify-center  max-w-xl  p-3 border-x h-full">
        <div class="flex flex-col w-full lg:max-w-md gap-5">
          <ReuseTemplate />
        </div>
      </div>
    </div>

    <div class="flex flex-row p-3 border-t"></div>
  </div>
</template>