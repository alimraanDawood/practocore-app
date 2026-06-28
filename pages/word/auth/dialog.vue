<script lang="ts" setup>
// Word add-in Google sign-in — STEP 1 (runs inside the Office dialog window).
// The pane can't host the Google OAuth popup (iframe), so it opens this route in an
// Office dialog. Here we start the PocketBase OAuth2 (PKCE) flow: fetch the provider,
// stash the verifier/state in this window's sessionStorage, then redirect to Google.
// Google returns to /word/auth/callback (same dialog window) which finishes the
// exchange and messageParent()s the token back to the pane.
import { Loader2 } from 'lucide-vue-next';
import { pb } from '~/lib/pocketbase';

definePageMeta({ layout: 'blank' });

const OAUTH_KEY = 'practocore.word.oauth.pkce';
const error = ref('');

onMounted(async () => {
  try {
    const methods = await pb.collection('Users').listAuthMethods();
    const google = methods.oauth2?.providers?.find((p: any) => p.name === 'google');
    if (!google) throw new Error('Google sign-in is not enabled on this server.');

    const redirectUrl = `${location.origin}/word/auth/callback`;
    sessionStorage.setItem(OAUTH_KEY, JSON.stringify({
      provider: google.name,
      codeVerifier: google.codeVerifier,
      state: google.state,
      redirectUrl,
    }));
    // PocketBase's authURL ends with `redirect_uri=`; append the encoded callback.
    window.location.href = google.authURL + encodeURIComponent(redirectUrl);
  } catch (e: any) {
    error.value = e?.message ?? 'Could not start Google sign-in.';
  }
});
</script>

<template>
  <div class="flex min-h-screen items-center justify-center px-6 text-center text-sm">
    <p v-if="error" class="text-destructive">{{ error }}</p>
    <span v-else class="flex items-center gap-2 text-muted-foreground">
      <Loader2 class="size-4 animate-spin" /> Redirecting to Google…
    </span>
  </div>
</template>
