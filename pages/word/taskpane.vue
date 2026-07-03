<script lang="ts" setup>
// Word add-in task pane.
// The add-in folded into this codebase: it renders the SAME shared <ChatSurface> as
// /main, in the Word surface, so UI changes propagate automatically. Office's manifest
// points its SourceLocation here (https://<app-origin>/word/taskpane).
//
// Wired here:
//  • Office.js loaded on demand + gated on Office.onReady (lib/office.ts).
//  • Global auth/org middleware stand down for /word (see middleware).
//  • Sign-in: inline email/password (works in the pane) + "Continue with Google"
//    via the Office Dialog API (OAuth can't run in the pane iframe) — see
//    pages/word/auth/{dialog,callback}.vue. A plain-browser preview falls back to
//    the app's normal Google popup.
//  • <ChatSurface surface="word" mode="word"> — surface gates the client-fulfilled
//    insert_into_document tool; mode partitions Word history from the web app.
//  • clientTool — fulfils insert_into_document / generate_document into the live doc.
//  • contextProvider — attaches the current document SELECTION to each message.
//  • Quick actions — document-aware features the shared chat can't do: cite-check
//    (verify every citation against the Ugandan corpus, flag inline as comments) and
//    redline (revise the selection, apply as a tracked change).
import {
  Loader2, TextSelect, ScanLine, PenLine, FileText, MessageSquareText,
  CheckCircle2, XCircle, AlertCircle, ChevronRight, X, CornerDownRight,
  LogOut, UserRound, Building2, ChevronsUpDown,
  Plus, History,
} from 'lucide-vue-next';
// Our brand mark (the square, orange logo the login screen uses) replaces the generic
// Scale/Sparkles icons. Referenced inline in the template via the `@/assets` path.
import { toast } from 'vue-sonner';
import ChatSurface from '~/components/shared/AI/ChatSurface.vue';
import { pb } from '~/lib/pocketbase';
import { signInWithEmail, signUpWithGoogle, signOut, getOrganisation } from '~/services/auth';
import {
  ensureOffice, isWordHost, insertMarkdown, insertDocumentIr, getSelectionText, onSelectionChanged,
  getDocumentText, commentOnMatches, jumpToText,
} from '~/lib/office';
import { citeCheck, redline, type CiteResult } from '~/services/ai/word';
import type { AiResponse } from '~/services/ai';

definePageMeta({ layout: 'blank' });

const phase = ref<'loading' | 'ready'>('loading');
const host = ref('');
const inWord = computed(() => isWordHost(host.value));

// Reactive auth: pb.authStore isn't a Vue ref, so mirror it and follow onChange.
function computeAuthed() {
  return pb.authStore.isValid && pb.authStore.record?.collectionName === 'Users';
}
const authed = ref(computeAuthed());
let stopAuthWatch: (() => void) | null = null;

// ── Account (avatar menu: who am I, which account, sign out) ─────────────────────
// pb.authStore.record isn't a Vue ref, so mirror it and refresh on onChange.
const authRecord = ref<any>(pb.authStore.record);
const orgName = ref('');
const orgBusy = ref(false);

const accountName = computed(() => authRecord.value?.name || 'Your account');
const accountEmail = computed(() => authRecord.value?.email || '');
const accountAvatar = computed(() => authRecord.value?.avatar || '');
const accountInitials = computed(() => {
  const parts = String(authRecord.value?.name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return (authRecord.value?.email?.[0] || '?').toUpperCase();
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
});
// Personal account = no organisation relation (mirrors composables/usePermissions isIndividual).
const isPersonal = computed(() => !authRecord.value?.organisation);
const accountContext = computed(() =>
  isPersonal.value ? 'Personal account' : (orgName.value || 'Organisation account'));

// Resolve the organisation's display name for the current account.
async function loadOrg() {
  const oid = pb.authStore.record?.organisation;
  if (!oid) { orgName.value = ''; return; }
  if (orgName.value && authRecord.value?.organisation === oid) return; // already resolved
  orgBusy.value = true;
  try {
    const o: any = await getOrganisation(oid);
    orgName.value = o?.name || '';
  } catch {
    orgName.value = '';
  } finally {
    orgBusy.value = false;
  }
}

async function logout() {
  await signOut(); // clears pb.authStore → onChange flips `authed` to false → back to sign-in gate
  authRecord.value = null;
  orgName.value = '';
  toast('Signed out');
}

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
  // Outside Word (browser preview) use the app's normal Google popup flow.
  if (!inWord.value) {
    googleBusy.value = true;
    signUpWithGoogle().catch((e: any) => { authError.value = e?.message ?? 'Google sign-in failed.'; })
      .finally(() => { googleBusy.value = false; });
    return;
  }
  // Inside Word: OAuth must run in an Office dialog (the pane iframe can't host the
  // Google popup). The dialog runs the PKCE flow and posts the token back here.
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

// ── Document selection (rides along with each message) ─────────────────────────
const selectionText = ref('');
const selectionWords = computed(() =>
  selectionText.value ? selectionText.value.split(/\s+/).filter(Boolean).length : 0);
let stopSelectionWatch: (() => void) | null = null;

// Cap on how much document text we attach as ambient context per turn (keeps token
// cost bounded — a long brief still gives the model plenty to work with).
const MAX_CONTEXT_CHARS = 8000;

// Attach document context to the SENT payload only (the bubble shows just what the
// user typed). A selection takes priority; otherwise the whole document rides along,
// so prompts like "summarise this document" have something to work on. Read fresh at
// send time.
async function contextProvider(): Promise<string> {
  if (!inWord.value) return '';
  try {
    const sel = (await getSelectionText()).trim();
    if (sel) {
      return `Selected text from the document:\n"""\n${sel.slice(0, MAX_CONTEXT_CHARS)}\n"""`;
    }
    const doc = (await getDocumentText()).trim();
    if (!doc) return '';
    return `The full document the user is working on:\n"""\n${doc.slice(0, MAX_CONTEXT_CHARS)}\n"""`;
  } catch {
    return '';
  }
}

// Label for the "what context is attached" chip above the composer.
const contextLabel = computed(() => hasSelection.value
  ? `Including selected text · ${selectionWords.value} ${selectionWords.value === 1 ? 'word' : 'words'}`
  : 'Editing the full document');

onMounted(async () => {
  stopAuthWatch = pb.authStore.onChange(() => {
    authed.value = computeAuthed();
    authRecord.value = pb.authStore.record;
    if (authed.value) loadOrg();
  });
  if (authed.value) loadOrg();
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
  if (inWord.value) {
    try { stopSelectionWatch = onSelectionChanged((t) => { selectionText.value = t.trim(); }); } catch { /* no doc */ }
  }
});

onBeforeUnmount(() => { stopAuthWatch?.(); stopSelectionWatch?.(); });

// ── Client-fulfilled tools (write to the open document) ────────────────────────
const clientTool = {
  classify(resp: AiResponse) {
    if (resp.tool === 'insert_into_document') return 'auto' as const;
    if (resp.tool === 'generate_document') return 'card' as const;
    return null;
  },
  async fulfill(resp: AiResponse) {
    if (!inWord.value) throw new Error('Open this pane inside Microsoft Word to write to the document.');
    if (resp.tool === 'insert_into_document') {
      const content = String(resp.input?.content ?? '');
      const mode: 'insert' | 'replace' = resp.input?.mode === 'replace' ? 'replace' : 'insert';
      if (!content) throw new Error('The assistant proposed an empty insertion.');
      await insertMarkdown(content, mode, true);
    } else if (resp.tool === 'generate_document') {
      await insertDocumentIr(resp.input ?? {});
    }
  },
};

// ── Quick actions ──────────────────────────────────────────────────────────────
const chat = ref<InstanceType<typeof ChatSurface> | null>(null);
const hasSelection = computed(() => selectionWords.value > 0);
// Conversation history lives in the top bar now (ChatSurface's own toolbar is hidden),
// so we drive its Sheet from here via the exposed conversations/selectConversation.
const historyOpen = ref(false);
function selectConversationFromBar(id: string) {
  chat.value?.selectConversation(id);
  historyOpen.value = false;
}
function newChatFromBar() {
  chat.value?.newChat();
  historyOpen.value = false;
}

// Empty-state suggestions (Harvey-style): clicking one drops it into the composer for
// the user to review and send. Tailored to whether there's a selection or not.
const suggestions = computed<string[]>(() => hasSelection.value
  ? [
      'Strengthen the selected clause',
      'Explain the selected text in plain English',
      'Identify the risks in the selected text',
      'Rewrite the selection in more formal terms',
    ]
  : [
      'Summarise this document',
      'Find inconsistencies or contradictions',
      'Identify missing or weak clauses',
      'Check the obligations and deadlines in this document',
    ]);

// Scroll the document to a passage the assistant linked (doc: jump link in a chat
// answer). The snippet is verbatim text the model copied from the document.
async function locateInDocument(snippet: string) {
  if (!inWord.value) {
    toast('Open in Word', { description: 'Jump-to-passage works inside the document.' });
    return;
  }
  const ok = await jumpToText(snippet);
  if (!ok) {
    toast('Couldn’t find that passage', {
      description: 'It may have changed since the assistant referenced it.',
    });
  }
}

// Send a chat turn for the selection (Summarize / Explain). The selection rides along
// automatically via contextProvider, so the prompt only needs to name the task.
function quickAsk(prompt: string) {
  if (!hasSelection.value) {
    toast('Select some text first', { description: 'Highlight a passage in the document, then try again.' });
    return;
  }
  chat.value?.send(prompt);
}

// ── Cite-check ───────────────────────────────────────────────────────────────
const citeBusy = ref(false);
const citeOpen = ref(false);
const citeScope = ref<'document' | 'selection'>('document');
const citeResults = ref<CiteResult[]>([]);
const citeSummary = ref({ total: 0, verified: 0, notFound: 0, uncertain: 0 });
const commenting = ref(false);

// Citations worth flagging in the document: anything not cleanly verified.
const flaggable = computed(() => citeResults.value.filter(c => c.status !== 'verified'));

async function runCiteCheck(scope: 'document' | 'selection') {
  if (citeBusy.value) return;
  if (!inWord.value) {
    toast('Open in Word', { description: 'Citation checking reads the open document.' });
    return;
  }
  citeBusy.value = true;
  citeScope.value = scope;
  try {
    const text = scope === 'selection' ? await getSelectionText() : await getDocumentText();
    if (!text.trim()) {
      toast(scope === 'selection' ? 'Nothing selected' : 'The document is empty');
      return;
    }
    const res = await citeCheck(text);
    if (res.type === 'error') {
      toast('Citation check failed', { description: res.error });
      return;
    }
    citeResults.value = res.citations;
    citeSummary.value = res.summary;
    citeOpen.value = true;
    if (res.summary.total === 0) {
      toast('No citations found', { description: `Scanned the ${scope} — no legal citations detected.` });
    }
  } catch (e: any) {
    toast('Citation check failed', { description: e?.message });
  } finally {
    citeBusy.value = false;
  }
}

// Drop a Word comment on each unverifiable citation so the lawyer sees it in context.
async function commentIssues() {
  if (commenting.value || !flaggable.value.length) return;
  commenting.value = true;
  try {
    const n = await commentOnMatches(flaggable.value.map(c => ({
      raw: c.raw,
      note: `PractoCore: ${c.detail}`,
    })));
    toast(n > 0 ? `Flagged ${n} citation${n === 1 ? '' : 's'} in the document` : 'Couldn’t locate those citations to comment',
      n > 0 ? { description: 'Added as Word comments you can review or resolve.' } : undefined);
  } catch (e: any) {
    toast('Couldn’t add comments', { description: e?.message });
  } finally {
    commenting.value = false;
  }
}

function statusIcon(s: CiteResult['status']) {
  return s === 'verified' ? CheckCircle2 : s === 'not_found' ? XCircle : AlertCircle;
}
function statusClass(s: CiteResult['status']) {
  return s === 'verified' ? 'text-emerald-600 dark:text-emerald-400'
    : s === 'not_found' ? 'text-destructive'
    : 'text-amber-600 dark:text-amber-400';
}

// ── Redline (revise selection → tracked change) ───────────────────────────────
const redlineOpen = ref(false);
const redlineBusy = ref(false);
const redlineInstruction = ref('');
const redlineSelection = ref('');
const redlinePresets = [
  'Tighten the wording and make it more concise',
  'Make it more formal and precise',
  'Fix grammar and punctuation only',
  'Rewrite in plain English without losing legal meaning',
];

function openRedline() {
  if (!hasSelection.value) {
    toast('Select some text first', { description: 'Highlight the passage you want to revise.' });
    return;
  }
  redlineSelection.value = selectionText.value;
  redlineInstruction.value = '';
  redlineOpen.value = true;
}

async function applyRedline() {
  if (redlineBusy.value) return;
  redlineBusy.value = true;
  try {
    // Re-read the selection at apply time in case it moved.
    const sel = (await getSelectionText()).trim() || redlineSelection.value;
    if (!sel) { toast('Nothing selected to revise'); return; }
    const res = await redline(sel, redlineInstruction.value.trim());
    if (res.type === 'error' || !res.revised) {
      toast('Revision failed', { description: res.error });
      return;
    }
    await insertMarkdown(res.revised, 'replace', true);
    redlineOpen.value = false;
    toast('Revision applied as a tracked change', {
      description: 'Review it in Word — accept or reject like any suggestion.',
    });
  } catch (e: any) {
    toast('Couldn’t apply the revision', { description: e?.message });
  } finally {
    redlineBusy.value = false;
  }
}
</script>

<template>
  <div class="flex h-screen flex-col bg-background text-foreground">
    <!-- Loading Office -->
    <div v-if="phase === 'loading'" class="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
      <Loader2 class="size-5 animate-spin" />
      <p class="text-sm">Connecting to Word…</p>
    </div>

    <!-- Sign-in gate -->
    <div v-else-if="!authed" class="flex flex-1 flex-col items-center justify-center px-6">
      <div class="flex w-full max-w-sm flex-col">
        <div class="mb-5 grid gap-2 text-center">
          <div class="flex justify-center">
            <img src="@/assets/img/logos/Practo%20Core%20Square%20--%20orange.png" alt="PractoCore" class="size-12 rounded-xl" />
          </div>
          <h1 class="ibm-plex-serif text-xl font-semibold tracking-tight">Connect to Word</h1>
          <p class="text-balance text-sm text-muted-foreground">
            Draft, cite, and revise against your matters — right here in Word.
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

    <!-- The shared assistant, in the Word surface -->
    <template v-else>
      <!-- Single top bar. Two layers cross-fade in the same 44px strip:
           • no selection → identity + chat nav (new chat, history) + avatar
           • text selected → document actions (check citations, redline, summarise, explain)
           ChatSurface's own toolbar is hidden (:hide-toolbar) so this is the only chrome. -->
      <div class="relative h-11 shrink-0 border-b">
        <!-- Layer A — PractoCore identity + chat nav + account (shown when nothing selected) -->
        <div class="absolute inset-0 flex items-center gap-2 px-2.5 transition-opacity duration-200"
             :class="hasSelection ? 'pointer-events-none opacity-0' : 'opacity-100'">
          <img src="@/assets/img/logos/Practo%20Core%20Square%20--%20orange.png" alt="PractoCore" class="size-6 rounded-md" />
          <span class="ibm-plex-serif text-sm font-semibold tracking-tight">PractoCore</span>

          <TooltipProvider :delay-duration="300">
          <div class="ml-auto flex items-center gap-0.5">
            <Tooltip>
              <TooltipTrigger as-child>
                <Button size="icon-sm" variant="ghost" @click="newChatFromBar">
                  <Plus class="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>New chat</TooltipContent>
            </Tooltip>

            <!-- Conversation history (moved out of ChatSurface's toolbar into this bar) -->
            <Sheet v-model:open="historyOpen">
              <Tooltip>
                <TooltipTrigger as-child>
                  <SheetTrigger as-child>
                    <Button size="icon-sm" variant="ghost">
                      <History class="size-4" />
                    </Button>
                  </SheetTrigger>
                </TooltipTrigger>
                <TooltipContent>Chat history</TooltipContent>
              </Tooltip>
              <SheetContent side="right" class="w-72 p-0">
                <SheetHeader class="border-b">
                  <span class="text-sm font-semibold">Recent chats</span>
                </SheetHeader>
                <div v-if="chat?.historyLoading" class="flex justify-center py-6">
                  <Loader2 class="size-4 animate-spin text-muted-foreground" />
                </div>
                <div v-else-if="chat?.conversations?.length" class="flex flex-col gap-1 overflow-y-auto py-1">
                  <div class="flex flex-col gap-1">
                    <button v-for="conv in chat.conversations" :key="conv.id"
                            class="mx-1.5 flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent"
                            :class="chat?.conversationId === conv.id ? 'bg-accent' : ''"
                            @click="selectConversationFromBar(conv.id)">
                      <MessageSquareText class="size-3.5 shrink-0 text-muted-foreground" />
                      <span class="truncate">{{ conv.title }}</span>
                    </button>
                  </div>
                </div>
                <p v-else class="px-3 py-6 text-center text-xs text-muted-foreground">No conversations yet.</p>
              </SheetContent>
            </Sheet>

            <!-- Account (avatar last) -->
            <DropdownMenu>
              <DropdownMenuTrigger as-child>
                <button class="ml-0.5 flex items-center gap-1 rounded-full py-0.5 pl-0.5 pr-1 transition hover:bg-muted"
                        title="Account">
                  <Avatar class="size-7">
                    <AvatarImage :src="accountAvatar" :alt="accountName" />
                    <AvatarFallback class="bg-primary text-[11px] font-medium text-primary-foreground">
                      {{ accountInitials }}
                    </AvatarFallback>
                  </Avatar>
                  <ChevronsUpDown class="size-3.5 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" class="w-64">
                <!-- Profile view: name, email, and the account you're operating in. -->
                <DropdownMenuLabel class="p-0 font-normal">
                  <div class="flex items-center gap-2 px-1 py-1.5">
                    <Avatar class="size-9">
                      <AvatarImage :src="accountAvatar" :alt="accountName" />
                      <AvatarFallback class="bg-primary text-xs font-medium text-primary-foreground">
                        {{ accountInitials }}
                      </AvatarFallback>
                    </Avatar>
                    <div class="grid min-w-0 flex-1 text-left leading-tight">
                      <span class="truncate text-sm font-semibold">{{ accountName }}</span>
                      <span class="truncate text-xs text-muted-foreground">{{ accountEmail }}</span>
                    </div>
                  </div>
                </DropdownMenuLabel>

                <DropdownMenuSeparator />
                <div class="px-2 py-1.5">
                  <p class="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Signed in to</p>
                  <div class="flex items-center gap-2">
                    <component :is="isPersonal ? UserRound : Building2" class="size-4 shrink-0 text-primary" />
                    <span class="min-w-0 flex-1 truncate text-sm">
                      <Loader2 v-if="orgBusy" class="inline size-3.5 animate-spin align-[-2px]" />
                      <template v-else>{{ accountContext }}</template>
                    </span>
                    <Badge variant="secondary" class="shrink-0 text-[10px]">
                      {{ isPersonal ? 'Personal' : 'Org' }}
                    </Badge>
                  </div>
                </div>

                <DropdownMenuSeparator />
                <DropdownMenuItem class="text-destructive focus:text-destructive" @click="logout">
                  <LogOut class="size-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          </TooltipProvider>
        </div>

        <!-- Layer B — document actions (fades in when text is selected). Cite-check
             runs on the whole document; redline/summarise/explain act on the selection. -->
        <div class="absolute inset-0 flex items-center gap-1.5 overflow-x-auto px-2 transition-opacity duration-200"
             :class="hasSelection ? 'opacity-100' : 'pointer-events-none opacity-0'">
          <Button size="sm" variant="ghost" class="h-7 shrink-0 gap-1.5 px-2 text-xs"
                  :disabled="citeBusy" @click="runCiteCheck('document')">
            <Loader2 v-if="citeBusy && citeScope === 'document'" class="size-3.5 animate-spin" />
            <ScanLine v-else class="size-3.5" />
            Check citations
          </Button>
          <div class="h-4 w-px shrink-0 bg-border" />
          <Button size="sm" variant="ghost" class="h-7 shrink-0 gap-1.5 px-2 text-xs"
                  :disabled="!hasSelection" @click="openRedline">
            <PenLine class="size-3.5" /> Redline
          </Button>
          <Button size="sm" variant="ghost" class="h-7 shrink-0 gap-1.5 px-2 text-xs"
                  :disabled="!hasSelection" @click="quickAsk('Summarise the selected text.')">
            <FileText class="size-3.5" /> Summarise
          </Button>
          <Button size="sm" variant="ghost" class="h-7 shrink-0 gap-1.5 px-2 text-xs"
                  :disabled="!hasSelection" @click="quickAsk('Explain the selected text in plain English.')">
            <MessageSquareText class="size-3.5" /> Explain
          </Button>
        </div>
      </div>

      <div v-if="!inWord" class="shrink-0 border-b bg-amber-500/10 px-3 py-1.5 text-[11px] text-amber-700 dark:text-amber-400">
        Preview mode — open inside Microsoft Word to insert output and attach selections.
      </div>

      <div class="relative min-h-0 flex-1">
      <ChatSurface
        ref="chat"
        class="absolute inset-0"
        surface="word"
        mode="word"
        hide-toolbar
        :client-tool="clientTool"
        :context-provider="contextProvider"
        :on-locate="locateInDocument"
      >
        <template #empty="{ ask }">
          <div class="flex flex-col items-center pt-4">
            <img src="@/assets/img/logos/Practo%20Core%20Square%20--%20orange.png" alt="PractoCore" class="size-11 rounded-xl" />
            <p class="mt-3 text-sm text-muted-foreground">Suggestions for your document</p>
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

        <!-- What document context rides with the next message (selection or full doc). -->
        <template #composer-top>
          <div v-if="inWord"
               class="flex items-center gap-1.5 self-start rounded-full border bg-muted/50 px-2.5 py-1 text-[11px] text-muted-foreground">
            <TextSelect class="size-3.5 text-primary" />
            {{ contextLabel }}
          </div>
        </template>
      </ChatSurface>

      <!-- Cite-check results — slides over the chat; close to return. -->
      <Transition
        enter-active-class="transition-transform duration-200" enter-from-class="translate-y-full"
        leave-active-class="transition-transform duration-200" leave-to-class="translate-y-full">
        <div v-if="citeOpen" class="absolute inset-0 flex flex-col bg-background">
          <div class="flex shrink-0 items-center justify-between border-b px-3 py-2">
            <div class="flex items-center gap-2">
              <ScanLine class="size-4 text-primary" />
              <span class="text-sm font-semibold">Citation check</span>
              <span class="text-xs text-muted-foreground">({{ citeScope }})</span>
            </div>
            <Button size="icon" variant="ghost" class="size-7" @click="citeOpen = false">
              <X class="size-4" />
            </Button>
          </div>

          <!-- Summary line -->
          <div class="flex shrink-0 flex-wrap items-center gap-2 border-b px-3 py-2 text-xs">
            <Badge variant="outline" class="gap-1 border-emerald-500/40 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 class="size-3" /> {{ citeSummary.verified }} verified
            </Badge>
            <Badge v-if="citeSummary.notFound" variant="outline" class="gap-1 border-destructive/40 text-destructive">
              <XCircle class="size-3" /> {{ citeSummary.notFound }} not found
            </Badge>
            <Badge v-if="citeSummary.uncertain" variant="outline" class="gap-1 border-amber-500/40 text-amber-600 dark:text-amber-400">
              <AlertCircle class="size-3" /> {{ citeSummary.uncertain }} uncertain
            </Badge>
          </div>

          <!-- Results -->
          <div class="min-h-0 flex-1 overflow-y-auto px-2 py-2">
            <p v-if="!citeResults.length" class="px-2 py-8 text-center text-sm text-muted-foreground">
              No legal citations were detected in the {{ citeScope }}.
            </p>
            <ul v-else class="space-y-1">
              <li v-for="(c, i) in citeResults" :key="i">
                <button
                  class="group flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left hover:bg-muted"
                  @click="jumpToText(c.raw)">
                  <component :is="statusIcon(c.status)" class="mt-0.5 size-4 shrink-0" :class="statusClass(c.status)" />
                  <span class="min-w-0 flex-1">
                    <span class="block truncate text-sm font-medium">{{ c.citation || c.raw }}</span>
                    <span class="block text-xs text-muted-foreground">{{ c.detail }}</span>
                  </span>
                  <ChevronRight class="mt-0.5 size-4 shrink-0 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
                </button>
              </li>
            </ul>
          </div>

          <!-- Flag-in-document action -->
          <div v-if="flaggable.length" class="shrink-0 border-t p-2">
            <Button class="w-full gap-2" :disabled="commenting" @click="commentIssues">
              <Loader2 v-if="commenting" class="size-4 animate-spin" />
              <AlertCircle v-else class="size-4" />
              Flag {{ flaggable.length }} issue{{ flaggable.length === 1 ? '' : 's' }} in the document
            </Button>
          </div>
        </div>
      </Transition>
      </div>
    </template>

    <!-- Redline: instruction → tracked-change revision of the selection. -->
    <Sheet v-model:open="redlineOpen">
      <SheetContent side="bottom" class="max-h-[80vh]">
        <SheetHeader>
          <SheetTitle class="flex items-center gap-2">
            <PenLine class="size-4 text-primary" /> Redline selection
          </SheetTitle>
          <SheetDescription>
            The revision is inserted as a tracked change — review, accept, or reject it in Word.
          </SheetDescription>
        </SheetHeader>

        <div class="space-y-3 px-4">
          <p class="line-clamp-3 rounded-md border bg-muted/40 p-2 text-xs text-muted-foreground">
            {{ redlineSelection }}
          </p>
          <div class="flex flex-wrap gap-1.5">
            <Button v-for="p in redlinePresets" :key="p" size="sm" variant="outline"
                    class="h-7 px-2 text-xs"
                    :class="redlineInstruction === p ? 'border-primary text-primary' : ''"
                    @click="redlineInstruction = p">
              {{ p.split(' ').slice(0, 3).join(' ') }}…
            </Button>
          </div>
          <Textarea v-model="redlineInstruction" :rows="2"
                    placeholder="Or describe the change you want (optional)…" />
        </div>

        <SheetFooter>
          <Button :disabled="redlineBusy" @click="applyRedline">
            <Loader2 v-if="redlineBusy" class="size-4 animate-spin" />
            {{ redlineBusy ? 'Revising…' : 'Apply as tracked change' }}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  </div>
</template>
