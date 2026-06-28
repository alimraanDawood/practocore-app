<script lang="ts" setup>
// Word add-in Google sign-in — STEP 2 (OAuth2 redirect target, inside the Office
// dialog). Google sends the user here with ?code&state. We retrieve the PKCE stash
// from STEP 1 (same dialog window's sessionStorage), exchange the code for a PB
// token, then messageParent() it back to the task pane, which saves it to authStore.
import { pb } from '~/lib/pocketbase';
import { ensureOffice } from '~/lib/office';

definePageMeta({ layout: 'blank' });

const OAUTH_KEY = 'practocore.word.oauth.pkce';
const message = ref('Completing sign-in…');
const failed = ref(false);

function fail(msg: string) {
  failed.value = true;
  message.value = msg;
  try { Office.context.ui.messageParent(JSON.stringify({ ok: false, error: msg })); } catch { /* not in a dialog */ }
}

onMounted(async () => {
  // messageParent needs Office.js loaded and this page running as an Office dialog.
  try { await ensureOffice(); } catch { /* still try below */ }
  try {
    const params = new URLSearchParams(location.search);
    const code = params.get('code');
    const state = params.get('state');
    const oauthErr = params.get('error');
    if (oauthErr) return fail(`Google sign-in was cancelled (${oauthErr}).`);
    if (!code || !state) return fail('Missing authorization code from Google.');

    const stashed = sessionStorage.getItem(OAUTH_KEY);
    if (!stashed) return fail('Sign-in session expired. Please try again.');
    const { provider, codeVerifier, state: savedState, redirectUrl } = JSON.parse(stashed);
    if (state !== savedState) return fail('Sign-in state mismatch. Please try again.');

    const authData = await pb.collection('Users').authWithOAuth2Code(provider, code, codeVerifier, redirectUrl);
    sessionStorage.removeItem(OAUTH_KEY);
    Office.context.ui.messageParent(JSON.stringify({ ok: true, token: pb.authStore.token, user: authData.record }));
    message.value = 'Signed in — you can close this window.';
  } catch (e: any) {
    fail(e?.message ?? 'Could not complete Google sign-in.');
  }
});
</script>

<template>
  <div class="flex min-h-screen items-center justify-center px-6 text-center text-sm"
       :class="failed ? 'text-destructive' : 'text-muted-foreground'">
    {{ message }}
  </div>
</template>
