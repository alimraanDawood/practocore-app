<template>
  <section class="max-w-2xl space-y-5">
    <div>
      <h2 class="text-2xl font-semibold ibm-plex-serif">Application updates</h2>
      <p class="text-sm text-muted-foreground">{{ intro }}</p>
    </div>

    <!-- What is installed, on every platform. Quote these two lines in a support
         conversation and there is no ambiguity about what someone is running. -->
    <dl class="rounded-lg border divide-y text-sm">
      <div class="flex items-center justify-between gap-4 p-3">
        <dt class="text-muted-foreground">Application version</dt>
        <dd class="font-medium tabular-nums">{{ installedVersion }}</dd>
      </div>
      <div v-if="mobile" class="flex items-center justify-between gap-4 p-3">
        <dt class="text-muted-foreground">Content bundle</dt>
        <dd class="font-medium tabular-nums">{{ bundleLabel }}</dd>
      </div>
      <div class="flex items-center justify-between gap-4 p-3">
        <dt class="text-muted-foreground">Platform</dt>
        <dd class="font-medium capitalize">{{ platformLabel }}</dd>
      </div>
    </dl>

    <div v-if="!desktop" class="rounded-lg border p-4 text-sm text-muted-foreground">
      <template v-if="mobile">
        <div class="flex items-start justify-between gap-4">
          <div>
            <p class="font-medium text-foreground">{{ mobileHeading }}</p>
            <p v-if="capacitorState.lastCheckedAt" class="mt-1 text-xs">
              Last checked {{ capacitorState.lastCheckedAt.toLocaleString() }}
            </p>
          </div>
          <Button variant="outline" size="sm" :disabled="capacitorState.checking" @click="checkForCapacitorUpdate">
            {{ capacitorState.checking ? 'Checking…' : 'Check now' }}
          </Button>
        </div>

        <!-- The one state a user has to act on: the bundle is downloaded and
             waiting, and only a full close-and-reopen will apply it. -->
        <div v-if="capacitorState.status === 'ready-next-launch'" class="mt-3 rounded-md border border-primary/30 bg-primary/5 p-3">
          <p class="font-medium text-foreground">Update ready</p>
          <p class="mt-1">Fully close the app and open it again to apply {{ capacitorState.version }}. Leaving it in the background is not enough.</p>
        </div>
        <p v-else-if="capacitorState.status === 'downloading'" class="mt-2">
          Downloading {{ capacitorState.version }} in the background. You can keep working.
        </p>
        <p v-else-if="capacitorState.error" class="mt-2 text-destructive">{{ capacitorState.error }}</p>
        <p v-else class="mt-2">Updates download in the background and apply the next time you open the app.</p>
      </template>
      <template v-else>Updates for this platform are delivered through its app store or distribution channel.</template>
    </div>

    <div v-else class="rounded-lg border p-4 space-y-4">
      <div class="flex items-start justify-between gap-4">
        <div>
          <p class="font-medium">{{ heading }}</p>
          <p v-if="state.version" class="text-sm text-muted-foreground">Version {{ state.version }}</p>
          <p v-if="state.lastCheckedAt" class="text-xs text-muted-foreground mt-1">Last checked {{ state.lastCheckedAt.toLocaleString() }}</p>
        </div>
        <Button variant="outline" size="sm" :disabled="state.status === 'checking' || state.status === 'downloading'" @click="checkForDesktopUpdate">
          {{ state.status === 'checking' ? 'Checking…' : 'Check now' }}
        </Button>
      </div>

      <p v-if="state.notes" class="whitespace-pre-line text-sm text-muted-foreground">{{ state.notes }}</p>
      <p v-if="state.error" class="text-sm text-destructive">{{ state.error }}</p>

      <div v-if="control.configured" class="rounded-md bg-muted/50 p-3 text-sm">
        <p class="font-medium">Release policy</p>
        <p v-if="control.checking" class="mt-1 text-muted-foreground">Checking the configured channel…</p>
        <template v-else-if="control.decision">
          <p class="mt-1 text-muted-foreground">{{ policyMessage }}</p>
          <p v-if="control.version" class="mt-1 text-xs text-muted-foreground">Policy version {{ control.version }}</p>
        </template>
        <p v-else class="mt-1 text-muted-foreground">No policy decision has been received yet.</p>
        <p v-if="control.error" class="mt-1 text-destructive">{{ control.error }}</p>
      </div>

      <div v-if="state.status === 'downloading'" class="space-y-2">
        <Progress :model-value="state.progress ?? undefined" />
        <p class="text-sm text-muted-foreground">Downloading and verifying{{ state.progress === null ? '…' : ` (${state.progress}%)` }}</p>
      </div>

      <div v-if="state.status === 'available'" class="flex flex-wrap gap-2">
        <Button @click="downloadDesktopUpdate">Download update</Button>
        <p class="self-center text-xs text-muted-foreground">The app will only restart when you choose to apply it.</p>
      </div>

      <div v-if="state.status === 'ready'" class="flex flex-wrap gap-2">
        <Button @click="restartToApplyDesktopUpdate">Restart to update</Button>
        <p class="self-center text-xs text-muted-foreground">Save any open work before restarting.</p>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import {
  checkForDesktopUpdate,
  desktopUpdateState as state,
  downloadDesktopUpdate,
  restartToApplyDesktopUpdate,
} from '~/services/desktop-updates';
import {
  capacitorUpdateState as capacitorState,
  checkForCapacitorUpdate,
  refreshCapacitorVersions,
} from '~/services/capacitor-updates';
import { Capacitor } from '@capacitor/core';
import { isDesktop } from '~/utils/isDesktop';
import { updateControlState as control } from '~/services/update-control';

const desktop = isDesktop();
const mobile = Capacitor.isNativePlatform() && !desktop;
const buildVersion = useRuntimeConfig().public.appVersion as string;
// The native shell is the authority on mobile; elsewhere the bundle's own build
// version is all there is. `installedVersion` is deliberately never the version
// being *offered* — conflating the two is what makes update UIs confusing.
const installedVersion = computed(() => capacitorState.nativeVersion || buildVersion || 'unknown');
const bundleLabel = computed(() =>
  !capacitorState.bundleVersion || capacitorState.bundleVersion === 'builtin'
    ? 'Shipped with the app'
    : capacitorState.bundleVersion,
);
const platformLabel = computed(() => (desktop ? 'Desktop' : Capacitor.getPlatform()));
const intro = computed(() =>
  desktop
    ? 'Keep the desktop application current without interrupting your work.'
    : 'See what you are running and when it last checked for an update.',
);

onMounted(() => {
  void refreshCapacitorVersions();
});
const heading = computed(() => {
  switch (state.status) {
    case 'checking': return 'Checking for updates…';
    case 'available': return 'An update is ready to download';
    case 'downloading': return 'Downloading update';
    case 'ready': return 'Update ready to install';
    case 'error': return 'Update check failed';
    default: return 'Your application is up to date';
  }
});
const mobileHeading = computed(() => {
  switch (capacitorState.status) {
    case 'downloading': return 'Downloading an update';
    case 'ready-next-launch': return 'Update ready for your next launch';
    case 'failed': return 'Update was not applied';
    default: return 'Mobile updates are checked automatically';
  }
});
const policyMessage = computed(() => {
  switch (control.decision) {
    case 'none': return 'This channel has no update for this installation.';
    case 'prompt_native_update': return 'A native update is approved for this installation.';
    case 'require_native_update': return 'A native update is required before you continue.';
    case 'silent_web_update': return 'A web update is approved; it activates safely on a future launch.';
    case 'prompt_restart': return 'A web update is ready to activate on restart.';
    case 'backend_update_required': return 'Your firm backend must be updated before this release can be used.';
    case 'incompatible': return 'This installation does not meet the release compatibility requirements.';
    case 'rollback': return 'This channel has rolled back to the approved release.';
    default: return 'No policy decision has been received yet.';
  }
});
</script>
