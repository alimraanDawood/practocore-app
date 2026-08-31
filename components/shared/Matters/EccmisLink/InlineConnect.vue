<script setup lang="ts">
// Signing in to ECCMIS without leaving the matter.
//
// The full connect form lives in Settings (PageComponents/Settings/Eccmis.vue)
// and that is still where the account is managed. But the moment an advocate
// discovers the connection is missing or expired is almost always mid-task —
// the attach dialog is open, a case is half-chosen — and sending them to another
// page to fix it loses that context and the dialog with it.
//
// The consent notice travels with the form. It is compressed, not dropped: the
// credentials are stored server-side, so the advocate must be told that here
// too, with the full terms one link away.
import { ref } from 'vue';
import { Eye, EyeOff, Link2, Loader2 } from 'lucide-vue-next';
import { connectEccmis } from '~/services/eccmis';

const emits = defineEmits<{ connected: [] }>();

const { settingsPath } = useSettingsLink();

const username = ref('');
const password = ref('');
const showPassword = ref(false);
const busy = ref(false);
const error = ref('');

async function submit() {
    if (busy.value || !username.value || !password.value) return;
    busy.value = true;
    error.value = '';
    try {
        await connectEccmis(username.value, password.value);
        // Never keep the password in memory past the request that used it.
        username.value = '';
        password.value = '';
        emits('connected');
    } catch (e: any) {
        error.value = e?.message || 'ECCMIS could not sign you in. Try again in a moment.';
    } finally {
        busy.value = false;
    }
}
</script>

<template>
    <form class="flex flex-col gap-3" @submit.prevent="submit">
        <div class="flex flex-col gap-1.5">
            <Label for="eccmis-inline-username" class="text-xs">ECCMIS username</Label>
            <Input
                id="eccmis-inline-username"
                v-model="username"
                placeholder="Your ECCMIS login handle"
                autocomplete="username"
                :disabled="busy"
                required
            />
        </div>

        <div class="flex flex-col gap-1.5">
            <Label for="eccmis-inline-password" class="text-xs">ECCMIS password</Label>
            <div class="relative">
                <Input
                    id="eccmis-inline-password"
                    v-model="password"
                    :type="showPassword ? 'text' : 'password'"
                    placeholder="Your ECCMIS password"
                    autocomplete="current-password"
                    class="pr-10"
                    :disabled="busy"
                    required
                />
                <button
                    type="button"
                    class="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                    :aria-label="showPassword ? 'Hide password' : 'Show password'"
                    @click="showPassword = !showPassword"
                >
                    <Eye v-if="!showPassword" class="size-4" />
                    <EyeOff v-else class="size-4" />
                </button>
            </div>
        </div>

        <p v-if="error" class="text-sm text-destructive">{{ error }}</p>

        <Button type="submit" size="sm" class="w-fit" :disabled="busy || !username || !password">
            <Loader2 v-if="busy" class="size-4 animate-spin" />
            <Link2 v-else class="size-4" />
            {{ busy ? 'Signing in…' : 'Sign in' }}
        </Button>

        <p class="text-xs text-muted-foreground">
            PractoCore signs in to ECCMIS on your behalf; your password is encrypted and
            stored on our servers, and disconnecting removes it immediately.
            <NuxtLink :to="settingsPath('eccmis')" class="underline underline-offset-2">
                Full terms in Settings
            </NuxtLink>.
        </p>
    </form>
</template>
