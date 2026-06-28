<script lang="ts" setup>
// Outlook add-in task pane.
// Same shared <ChatSurface> as /main and the Word pane, in the Outlook surface, so UI
// changes propagate automatically. Office's manifest points its SourceLocation here
// (https://<app-origin>/outlook/taskpane).
//
// Wired here:
//  • Office.js loaded on demand + gated on Office.onReady (lib/office.ts via outlook.ts).
//  • Global auth/org middleware stand down for /outlook (see middleware).
//  • Sign-in: inline email/password + "Continue with Google" via the Office Dialog API
//    (reuses the host-agnostic /word/auth/{dialog,callback} routes).
//  • <ChatSurface surface="outlook" mode="outlook"> — surface gates the client-fulfilled
//    insert_into_email tool; mode partitions Outlook history from the web app & Word.
//  • clientTool — drafts replies into the open message (compose mode) via insert_into_email.
//  • contextProvider — attaches the open email (subject/from/to/body) to each message.
import {
  Loader2, TextSelect, FileText, Reply, CalendarClock, MessageSquareText, CornerDownRight,
} from 'lucide-vue-next';
import { toast } from 'vue-sonner';
import ChatSurface from '~/components/shared/AI/ChatSurface.vue';
import { pb } from '~/lib/pocketbase';
import { signInWithEmail, signUpWithGoogle } from '~/services/auth';
import {
  ensureOffice, isOutlookHost, getMailContext, isComposeMode, insertEmailMarkdown,
  type MailContext,
} from '~/lib/outlook';
import type { AiResponse } from '~/services/ai';

definePageMeta({ layout: 'blank' });

const phase = ref<'loading' | 'ready'>('loading');
const host = ref('');
const inOutlook = computed(() => isOutlookHost(host.value));

// Reactive auth: pb.authStore isn't a Vue ref, so mirror it and follow onChange.
function computeAuthed() {
  return pb.authStore.isValid && pb.authStore.record?.collectionName === 'Users';
}
const authed = ref(computeAuthed());
let stopAuthWatch: (() => void) | null = null;

// ── Sign-in (inline email/password + Google via Office dialog) ──────────────────
const email = ref('');
const password = ref('');
const signingIn = ref(false);
const googleBusy = ref(false);
const authError = ref('');

async function signInPassword() {
  if (signingIn.value) return;
  authError.value = '';
  signingIn.value = true;
  try {
    await signInWithEmail(email.value.trim(), password.value);
  } catch (e: any) {
    authError.value = e?.message ?? 'Sign in failed.';
  } finally {
    signingIn.value = false;
  }
}

function signInGoogle() {
  authError.value = '';
  if (!inOutlook.value) {
    googleBusy.value = true;
    signUpWithGoogle().catch((e: any) => { authError.value = e?.message ?? 'Google sign-in failed.'; })
      .finally(() => { googleBusy.value = false; });
    return;
  }
  // Inside Outlook: OAuth must run in an Office dialog (the pane iframe can't host the
  // Google popup). The dialog runs the PKCE flow and posts the token back here. The
  // /word/auth/* routes are host-agnostic, so we reuse them.
  googleBusy.value = true;
  const url = `${location.origin}/word/auth/dialog`;
  Office.context.ui.displayDialogAsync(url, { height: 60, width: 30 }, (result: any) => {
    if (result.status !== Office.AsyncResultStatus.Succeeded) {
      authError.value = 'Could not open the sign-in window.';
      googleBusy.value = false;
      return;
    }
    const dialog = result.value;
    dialog.addEventHandler(Office.EventType.DialogMessageReceived, (arg: any) => {
      googleBusy.value = false;
      try {
        const payload = JSON.parse(arg.message);
        if (payload.ok && payload.token) {
          pb.authStore.save(payload.token, payload.user);
          dialog.close();
        } else if (payload.ok === false) {
          dialog.close();
          authError.value = payload.error ?? 'Google sign-in failed.';
        }
      } catch { /* ignore non-JSON dialog chatter */ }
    });
    dialog.addEventHandler(Office.EventType.DialogEventReceived, () => { googleBusy.value = false; });
  });
}

// ── Open email (rides along with each message) ─────────────────────────────────
const mail = ref<MailContext | null>(null);
const composing = ref(false);
let stopItemWatch: (() => void) | null = null;

async function refreshMail() {
  if (!inOutlook.value) return;
  try {
    mail.value = await getMailContext();
    composing.value = isComposeMode();
  } catch { mail.value = null; }
}

const MAX_CONTEXT_CHARS = 8000;

// Attach the open email to the SENT payload only (the bubble shows just what the user
// typed). Read fresh at send time.
async function contextProvider(): Promise<string> {
  if (!inOutlook.value) return '';
  try {
    const m = await getMailContext();
    if (!m || (!m.subject && !m.body)) return '';
    const head = [
      m.subject && `Subject: ${m.subject}`,
      m.from && `From: ${m.from}`,
      m.to && `To: ${m.to}`,
    ].filter(Boolean).join('\n');
    const body = (m.body ?? '').slice(0, MAX_CONTEXT_CHARS);
    return `The email the user is working on (${m.mode} mode):\n"""\n${head}\n\n${body}\n"""`;
  } catch {
    return '';
  }
}

const contextLabel = computed(() => {
  if (!mail.value) return 'No email open';
  const subj = mail.value.subject?.trim();
  return subj ? `Using this email · ${subj.slice(0, 40)}${subj.length > 40 ? '…' : ''}` : 'Using the open email';
});

onMounted(async () => {
  stopAuthWatch = pb.authStore.onChange(() => { authed.value = computeAuthed(); });
  try {
    const res = await Promise.race([
      ensureOffice(),
      new Promise<{ host: string }>((resolve) => setTimeout(() => resolve({ host: '' }), 3000)),
    ]);
    host.value = res.host;
  } catch {
    host.value = '';
  } finally {
    phase.value = 'ready';
  }
  if (inOutlook.value) {
    await refreshMail();
    // Re-read when the user opens a different message (read pane).
    try {
      Office.context.mailbox.addHandlerAsync(Office.EventType.ItemChanged, refreshMail);
      stopItemWatch = () => {
        try { Office.context.mailbox.removeHandlerAsync(Office.EventType.ItemChanged, { handler: refreshMail }); } catch { /* ignore */ }
      };
    } catch { /* no item events available */ }
  }
});

onBeforeUnmount(() => { stopAuthWatch?.(); stopItemWatch?.(); });

// ── Client-fulfilled tools (write to the open message) ─────────────────────────
const clientTool = {
  classify(resp: AiResponse) {
    if (resp.tool === 'insert_into_email') return 'auto' as const;
    return null;
  },
  async fulfill(resp: AiResponse) {
    if (!inOutlook.value) throw new Error('Open this pane inside Outlook to draft into a message.');
    const content = String(resp.input?.content ?? '');
    const mode: 'insert' | 'replace' = resp.input?.mode === 'replace' ? 'replace' : 'insert';
    if (!content) throw new Error('The assistant proposed an empty draft.');
    // Works in both modes: writes into a draft you're composing, or opens a prefilled
    // reply when you're reading a received message.
    const how = await insertEmailMarkdown(content, mode);
    if (how === 'reply-opened') {
      toast('Reply drafted', { description: 'Opened a reply prefilled with the draft.' });
    }
  },
};

// ── Quick actions ──────────────────────────────────────────────────────────────
const chat = ref<InstanceType<typeof ChatSurface> | null>(null);

function quickAsk(prompt: string) {
  if (!mail.value) {
    toast('Open an email first', { description: 'Select or open a message, then try again.' });
    return;
  }
  chat.value?.send(prompt);
}

// Empty-state suggestions (Harvey-style): clicking one drops it into the composer.
// Tuned to whether the user is reading or composing.
const suggestions = computed<string[]>(() => composing.value
  ? [
      'Draft a reply',
      'Draft a polite reply declining this request',
      'Make my draft more formal',
      'Suggest a response asking for the hearing date',
    ]
  : [
      'Summarise this email',
      'What does this require me to do, and by when?',
      'Draft a reply',
      'Extract any dates or deadlines mentioned',
    ]);
</script>

<template>
  <div class="flex h-screen flex-col bg-background text-foreground">
    <!-- Loading Office -->
    <div v-if="phase === 'loading'" class="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
      <Loader2 class="size-5 animate-spin" />
      <p class="text-sm">Connecting to Outlook…</p>
    </div>

    <!-- Sign-in gate -->
    <div v-else-if="!authed" class="flex flex-1 flex-col items-center justify-center px-6">
      <div class="flex w-full max-w-sm flex-col">
        <div class="mb-5 grid gap-2 text-center">
          <div class="flex justify-center">
            <img src="@/assets/img/logos/Practo%20Core%20Square%20--%20orange.png" alt="PractoCore" class="size-12 rounded-xl" />
          </div>
          <h1 class="ibm-plex-serif text-xl font-semibold tracking-tight">Connect to Outlook</h1>
          <p class="text-balance text-sm text-muted-foreground">
            Triage, summarise, and reply to correspondence against your matters — right here in Outlook.
          </p>
        </div>

        <Button variant="outline" :disabled="googleBusy" @click="signInGoogle">
          <Loader2 v-if="googleBusy" class="size-4 animate-spin" />
          {{ googleBusy ? 'Connecting to Google…' : 'Continue with Google' }}
        </Button>

        <div class="my-4 flex items-center gap-2.5 text-xs text-muted-foreground">
          <span class="h-px flex-1 bg-border" /> or <span class="h-px flex-1 bg-border" />
        </div>

        <form class="space-y-3" @submit.prevent="signInPassword">
          <div class="space-y-1.5">
            <label class="text-xs font-medium">Email</label>
            <Input v-model="email" type="email" autocomplete="username" required />
          </div>
          <div class="space-y-1.5">
            <label class="text-xs font-medium">Password</label>
            <Input v-model="password" type="password" autocomplete="current-password" required />
          </div>
          <Button type="submit" class="w-full" :disabled="signingIn">
            {{ signingIn ? 'Signing in…' : 'Sign in' }}
          </Button>
          <p v-if="authError" class="text-sm text-destructive">{{ authError }}</p>
        </form>
      </div>
    </div>

    <!-- The shared assistant, in the Outlook surface -->
    <template v-else>
      <div v-if="!inOutlook" class="shrink-0 border-b bg-amber-500/10 px-3 py-1.5 text-[11px] text-amber-700 dark:text-amber-400">
        Preview mode — open inside Microsoft Outlook to read the message and insert replies.
      </div>

      <!-- Quick actions: act on the open email. -->
      <div class="flex shrink-0 items-center gap-1.5 overflow-x-auto border-b px-2 py-1.5">
        <Button size="sm" variant="ghost" class="h-7 shrink-0 gap-1.5 px-2 text-xs"
                @click="quickAsk('Summarise this email.')">
          <FileText class="size-3.5" /> Summarise
        </Button>
        <Button size="sm" variant="ghost" class="h-7 shrink-0 gap-1.5 px-2 text-xs"
                @click="quickAsk('Draft a reply to this email.')">
          <Reply class="size-3.5" /> Draft reply
        </Button>
        <Button size="sm" variant="ghost" class="h-7 shrink-0 gap-1.5 px-2 text-xs"
                @click="quickAsk('Extract any dates or deadlines mentioned in this email and offer to schedule reminders.')">
          <CalendarClock class="size-3.5" /> Find dates
        </Button>
        <Button size="sm" variant="ghost" class="h-7 shrink-0 gap-1.5 px-2 text-xs"
                @click="quickAsk('Explain what this email requires me to do.')">
          <MessageSquareText class="size-3.5" /> Explain
        </Button>
      </div>

      <div class="relative min-h-0 flex-1">
        <ChatSurface
          ref="chat"
          class="absolute inset-0"
          surface="outlook"
          mode="outlook"
          :client-tool="clientTool"
          :context-provider="contextProvider"
        >
          <template #empty="{ ask }">
            <div class="flex flex-col items-center pt-4">
              <img src="@/assets/img/logos/Practo%20Core%20Square%20--%20orange.png" alt="PractoCore" class="size-11 rounded-xl" />
              <p class="mt-3 text-sm text-muted-foreground">Suggestions for this email</p>
              <ul class="mt-4 w-full space-y-1">
                <li v-for="s in suggestions" :key="s">
                  <button
                    class="group flex w-full items-center gap-2.5 rounded-lg border border-transparent px-2.5 py-2.5 text-left text-sm transition hover:border-border hover:bg-muted"
                    @click="ask(s)">
                    <CornerDownRight class="size-4 shrink-0 text-muted-foreground" />
                    <span class="min-w-0 flex-1">{{ s }}</span>
                  </button>
                </li>
              </ul>
            </div>
          </template>

          <!-- Which email rides with the next message. -->
          <template #composer-top>
            <div v-if="inOutlook"
                 class="flex items-center gap-1.5 self-start rounded-full border bg-muted/50 px-2.5 py-1 text-[11px] text-muted-foreground">
              <TextSelect class="size-3.5 text-primary" />
              {{ contextLabel }}
            </div>
          </template>
        </ChatSurface>
      </div>
    </template>
  </div>
</template>
