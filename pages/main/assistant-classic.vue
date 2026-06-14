<script lang="ts" setup>
import {
    Sparkles, Plus, ChevronsUpDown, MessageSquareText, FolderLock, Workflow,
    History, Library, LifeBuoy, Settings, Search, Globe,
    Loader2, Check, X, ChevronRight, ChevronDown, ArrowUpIcon, Trash2,
    Briefcase, FileText, BookOpen, AtSign, Paperclip, Building2, Clock, User,
    CalendarClock, CircleAlert, ArrowRight, Scale,
    type LucideIcon,
} from 'lucide-vue-next';
import { marked } from 'marked';
import { toast } from 'vue-sonner';
import { getSignedInUser } from '~/services/auth';
import ProposalCard from '~/components/shared/AI/ProposalCard.vue';
import { initials } from '~/components/shared/AI/proposals/theme';
import {
    sendAiMessageStream, confirmAiProposal, improvePrompt,
    listConversations, getConversation, deleteConversation,
    type AiMessage, type AiContentBlock, type AiImageBlock, type AiDocumentBlock,
    type AiImageMediaType, type AiResponse, type AiContext, type AiConversationSummary,
    type ConvDisplayMessage, type AiStreamStep,
} from '~/services/ai';
import { getMatters, getAllDeadlines } from '~/services/matters';
import { getOrganisationUsers } from '~/services/admin';

definePageMeta({ layout: 'blank' });

marked.use({ breaks: true, gfm: true });
function renderMarkdown(text: string): string {
    return marked.parse(text) as string;
}

const workspace = 'PractoCore';
const firstName = computed(() => getSignedInUser()?.name?.split(' ').at(0) || 'there');

// ── Home summary (assigned to me) ───────────────────────────────────────────
// The empty state doubles as a light "home": a stateful greeting, the deadlines
// that need me soon, and my recently-touched matters. Scoped to the signed-in
// user; scrolls away once a conversation starts.
const uid = computed(() => getSignedInUser()?.id ?? '');
const homeLoading = ref(false);
interface HomeDeadline { id: string; name?: string; date?: string; status?: string; matter?: string; expand?: { matter?: { id: string; name?: string } } }
interface HomeMatter { id: string; name?: string; caseNumber?: string }
const myDeadlines = ref<HomeDeadline[]>([]);
const recentMatters = ref<HomeMatter[]>([]);

function startOfTodayMs(): number {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime();
}

async function loadHome() {
    const id = uid.value;
    if (!id) return;
    homeLoading.value = true;
    try {
        const horizon = new Date(); horizon.setDate(horizon.getDate() + 7);
        const horizonStr = `${horizon.toISOString().slice(0, 10)} 23:59:59`;
        const [dls, matters] = await Promise.all([
            getAllDeadlines({
                filter: `assignees ~ "${id}" && (status = "pending" || status = "overdue") && date != "" && date <= "${horizonStr}"`,
                sort: 'date',
                expand: 'matter',
                fields: 'id,name,date,status,matter,expand.matter.id,expand.matter.name',
            }),
            getMatters(1, 5, {
                filter: `owner = "${id}" || members ~ "${id}" || supervisors ~ "${id}"`,
                sort: '-updated',
            }),
        ]);
        myDeadlines.value = (dls as HomeDeadline[]) ?? [];
        recentMatters.value = (matters?.items ?? []) as HomeMatter[];
    } catch {
        // Leave empty — the greeting falls back to "all clear".
    } finally {
        homeLoading.value = false;
    }
}

// Bucket assigned deadlines by urgency for the "Needs you" card.
const buckets = computed(() => {
    const today0 = startOfTodayMs();
    const todayEnd = today0 + 86_400_000 - 1;
    const overdue: HomeDeadline[] = [], today: HomeDeadline[] = [], week: HomeDeadline[] = [];
    for (const d of myDeadlines.value) {
        if (!d.date) continue;
        const t = new Date(d.date).getTime();
        if (t < today0) overdue.push(d);
        else if (t <= todayEnd) today.push(d);
        else week.push(d);
    }
    return { overdue, today, week };
});

const needsTodayCount = computed(() => buckets.value.overdue.length + buckets.value.today.length);
const dueThisWeekCount = computed(() => myDeadlines.value.length);

const greetingTime = computed(() => {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
});

const greetingSummary = computed(() => {
    const week = dueThisWeekCount.value;
    if (!week) return 'you’re all clear this week.';
    const parts = [`${week} deadline${week === 1 ? '' : 's'} this week`];
    if (needsTodayCount.value) parts.push(`${needsTodayCount.value} need${needsTodayCount.value === 1 ? 's' : ''} you today`);
    return `${parts.join(', ')}.`;
});

/** "Today" / "Tomorrow" / "in 3d" / "2d overdue" relative to the local day. */
function dueLabel(dateStr?: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr); d.setHours(0, 0, 0, 0);
    const diff = Math.round((d.getTime() - startOfTodayMs()) / 86_400_000);
    if (diff < 0) return `${-diff}d overdue`;
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    return `in ${diff}d`;
}

const deadlineGroups = computed(() => [
    { key: 'overdue', label: 'Overdue', tone: 'text-destructive', items: buckets.value.overdue },
    { key: 'today', label: 'Today', tone: 'text-amber-600 dark:text-amber-500', items: buckets.value.today },
    { key: 'week', label: 'This week', tone: 'text-muted-foreground', items: buckets.value.week },
].filter(g => g.items.length));

const smartPrompts = [
    'What’s on my plate today?',
    'Summarise what changed in my matters this week',
    'Which of my deadlines are most urgent?',
];

function matterIdOf(d: HomeDeadline): string | undefined {
    return d.matter || d.expand?.matter?.id;
}

function openDeadline(d: HomeDeadline) {
    const mid = matterIdOf(d);
    if (mid) navigateTo(`/main/matters/matter/${mid}`);
}

function openMatter(id: string) {
    navigateTo(`/main/matters/matter/${id}`);
}

/** Seed the composer with a prompt about a specific entity (user can edit before sending). */
function askAbout(prompt: string) {
    draft.value = prompt;
}

// ── Sidebar navigation ──────────────────────────────────────────────────────
interface NavItem { key: string; label: string; icon: LucideIcon }

const nav: NavItem[] = [
    { key: 'assistant', label: 'Assistant', icon: MessageSquareText },
    { key: 'matters', label: 'Matters', icon: Scale },
    { key: 'vault', label: 'Vault', icon: FolderLock },
    { key: 'workflows', label: 'Workflows', icon: Workflow },
    { key: 'history', label: 'History', icon: History },
    { key: 'library', label: 'Library', icon: Library },
    { key: 'guidance', label: 'Guidance', icon: LifeBuoy },
];

const footerNav: NavItem[] = [
    { key: 'settings', label: 'Settings', icon: Settings },
    { key: 'help', label: 'Help', icon: LifeBuoy },
];

const active = ref('assistant');

// ── Composer ────────────────────────────────────────────────────────────────
const draft = ref('');

// ── Chat engine ─────────────────────────────────────────────────────────────
type ToolEvent = { role: 'tool-event'; content: string; status: 'approved' | 'rejected' };
type DisplayAiMessage = AiMessage & { steps?: AiStreamStep[]; durationMs?: number; stepsOpen?: boolean };
type ChatMessage = DisplayAiMessage | ToolEvent;

const messages = ref<ChatMessage[]>([]);
const conversationId = ref('');
const pendingProposal = ref<AiResponse | null>(null);
const loading = ref(false);
const proposalLoading = ref(false);
const messagesEnd = ref<HTMLElement | null>(null);

// Live tool-activity steps streamed mid-turn; last one is in-flight (spinner).
const activeSteps = ref<AiStreamStep[]>([]);
const workStartedAt = ref(0);

const hasThread = computed(() => messages.value.length > 0);

// Only {role, content} turns are sent back to the model — drop tool-events + UI step metadata.
const apiMessages = computed<AiMessage[]>(() =>
    messages.value
        .filter((m): m is DisplayAiMessage => m.role !== 'tool-event')
        .map(m => ({ role: m.role, content: m.content })),
);

const convMessages = computed<ConvDisplayMessage[]>(() =>
    messages.value.map(m =>
        m.role === 'tool-event'
            ? { role: `tool-event:${m.status}`, content: m.content }
            : { role: m.role, content: messageText(m.content) },
    ),
);

/** Flatten string|content-block content to a displayable string (attachments → placeholders). */
function messageText(content: AiMessage['content']): string {
    if (typeof content === 'string') return content;
    return content.map(b =>
        b.type === 'text' ? b.text
            : b.type === 'image' ? '[image]'
            : b.source?.type === 'text' ? '[document]'
            : '[PDF]',
    ).join(' ');
}

/** Human label for a document attachment chip (text doc vs PDF). */
function docLabel(att: AiDocumentBlock): string {
    return att.source?.type === 'text' ? 'Document' : 'PDF';
}

/** Just the attachment blocks of a content array — drives the chips above a user bubble. */
function messageAttachments(content: AiMessage['content']): Array<AiImageBlock | AiDocumentBlock> {
    if (typeof content === 'string') return [];
    return content.filter((b): b is AiImageBlock | AiDocumentBlock => b.type === 'image' || b.type === 'document');
}

function buildContext(): AiContext | undefined {
    if (selectedItems.value.length === 0) return undefined;
    return {
        matterIds: selectedItems.value.filter(i => i.type === 'matter').map(i => i.id),
        deadlineIds: selectedItems.value.filter(i => i.type === 'deadline').map(i => i.id),
        userIds: selectedItems.value.filter(i => i.type === 'user').map(i => i.id),
    };
}

function scrollToBottom() {
    nextTick(() => messagesEnd.value?.scrollIntoView({ behavior: 'smooth' }));
}

function stepIcon(tool: string) {
    switch (tool) {
        case 'search_matters':
        case 'search_procedure':
        case 'find_applicable_procedure':
            return Search;
        case 'web_search':
            return Globe;
        case 'get_procedure_overview':
        case 'get_procedure_step':
        case 'get_procedure_citation':
        case 'list_legal_knowledge':
            return BookOpen;
        case 'load_skill':
        case 'list_skills':
            return Sparkles;
        case 'fetch_url':
            return FileText;
        case '':
            return Sparkles;
        default:
            return Briefcase;
    }
}

function formatDuration(ms: number): string {
    const secs = Math.max(1, Math.round(ms / 1000));
    if (secs < 60) return `${secs}s`;
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return s ? `${m}m ${s}s` : `${m}m`;
}

function formatToolName(tool: string): string {
    return tool.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

async function send(explicit?: string) {
    const text = (explicit ?? draft.value).trim();
    const hasAttachments = !explicit && attachments.value.length > 0;
    if ((!text && !hasAttachments) || loading.value) return;

    // Plain text turn, or a multimodal content-block array (attachments first, text as caption).
    let userContent: string | AiContentBlock[];
    if (hasAttachments) {
        const blocks: AiContentBlock[] = attachments.value.map(a => {
            if (a.kind === 'text') {
                // Prefix the filename so the model knows the document's name/type.
                const body = `# ${a.name}\n\n${a.text ?? ''}`;
                return { type: 'document', source: { type: 'text', media_type: 'text/plain', data: body } };
            }
            return a.mime === 'application/pdf'
                ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: a.base64 as string } }
                : { type: 'image', source: { type: 'base64', media_type: a.mime as AiImageMediaType, data: a.base64 as string } };
        });
        blocks.push({ type: 'text', text: text || 'Help me with this.' });
        userContent = blocks;
        attachments.value = [];
    } else {
        userContent = text;
    }

    messages.value.push({ role: 'user', content: userContent });
    draft.value = '';
    pendingProposal.value = null;
    loading.value = true;
    activeSteps.value = [];
    workStartedAt.value = Date.now();
    scrollToBottom();

    const response = await sendAiMessageStream(apiMessages.value, buildContext(), conversationId.value || undefined, {
        onStep: (s) => {
            activeSteps.value = [...activeSteps.value, s];
            scrollToBottom();
        },
    });

    const elapsedMs = Date.now() - workStartedAt.value;
    const turnSteps = activeSteps.value.filter(s => s.tool);
    activeSteps.value = [];
    loading.value = false;

    applyResponse(response, turnSteps, elapsedMs);
    scrollToBottom();
}

function applyResponse(response: AiResponse, turnSteps: AiStreamStep[] = [], elapsedMs = 0) {
    if (response.type === 'text') {
        messages.value.push({
            role: 'assistant',
            content: response.content ?? '',
            steps: turnSteps.length ? turnSteps : undefined,
            durationMs: turnSteps.length ? elapsedMs : undefined,
            stepsOpen: false,
        });
        if (response.conversationId) {
            const isNew = !conversationId.value;
            conversationId.value = response.conversationId;
            if (isNew && historyLoaded.value) refreshHistory();
            else if (!isNew && historyLoaded.value) {
                const idx = conversations.value.findIndex(c => c.id === response.conversationId);
                if (idx >= 0) conversations.value[idx]!.updated = new Date().toISOString();
            }
        }
    } else if (response.type === 'proposal') {
        pendingProposal.value = response;
    } else {
        messages.value.push({ role: 'assistant', content: response.error ?? 'Something went wrong.' });
    }
}

function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
}

// ── Proposals ───────────────────────────────────────────────────────────────
function dismissProposal() {
    if (pendingProposal.value) {
        messages.value.push({ role: 'tool-event', content: formatToolName(pendingProposal.value.tool ?? ''), status: 'rejected' });
    }
    pendingProposal.value = null;
}

async function approveProposal() {
    if (!pendingProposal.value || proposalLoading.value) return;
    proposalLoading.value = true;
    const proposal = pendingProposal.value;
    pendingProposal.value = null;

    messages.value.push({ role: 'tool-event', content: formatToolName(proposal.tool ?? ''), status: 'approved' });
    loading.value = true;
    scrollToBottom();

    const response = await confirmAiProposal(
        proposal, true, buildContext(),
        conversationId.value || undefined,
        convMessages.value,
    );
    loading.value = false;
    proposalLoading.value = false;

    applyResponse(response);
    scrollToBottom();
}

// ── Attachments (PDF + images + text/Markdown) ──────────────────────────────
// kind 'binary' = image/PDF (base64); kind 'text' = Markdown/plain-text/source
// files, carried as raw UTF-8 in `text` and sent as an Anthropic text document.
interface Attachment {
    id: string; name: string; mime: string; size: number;
    kind: 'binary' | 'text';
    base64?: string; dataUrl?: string; text?: string;
}
const attachments = ref<Attachment[]>([]);
const fileInput = ref<HTMLInputElement | null>(null);
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_BYTES = 25 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES: AiImageMediaType[] = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
// Text/Markdown/source files. Browsers report an unreliable (often empty) MIME for
// .md, so we also match on extension. These are sent as text document blocks.
const TEXT_EXTENSIONS = ['.md', '.markdown', '.txt', '.text', '.csv', '.json', '.log', '.rtf'];
function isTextFile(file: File): boolean {
    const name = file.name.toLowerCase();
    if (TEXT_EXTENSIONS.some(ext => name.endsWith(ext))) return true;
    const t = file.type;
    return t.startsWith('text/') || t === 'application/json' || t === 'application/markdown';
}

const totalAttachmentBytes = computed(() => attachments.value.reduce((s, a) => s + a.size, 0));

function formatBytes(n: number): string {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function fileToBase64(file: File): Promise<{ base64: string; dataUrl: string }> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const dataUrl = String(reader.result ?? '');
            const comma = dataUrl.indexOf(',');
            resolve({ base64: comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl, dataUrl });
        };
        reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
        reader.readAsDataURL(file);
    });
}

function isAcceptedFile(file: File): boolean {
    return file.type === 'application/pdf'
        || (ACCEPTED_IMAGE_TYPES as string[]).includes(file.type)
        || isTextFile(file);
}

async function addFiles(files: File[] | FileList) {
    for (const file of Array.from(files)) {
        if (!isAcceptedFile(file)) {
            toast('Unsupported file', { description: `${file.name} — PDFs, images, and text/Markdown only.` });
            continue;
        }
        if (file.size > MAX_FILE_BYTES) {
            toast('File too large', { description: `${file.name} is ${formatBytes(file.size)}. Max ${formatBytes(MAX_FILE_BYTES)}.` });
            continue;
        }
        if (totalAttachmentBytes.value + file.size > MAX_TOTAL_BYTES) {
            toast('Attachment limit reached', { description: `Total must stay under ${formatBytes(MAX_TOTAL_BYTES)}.` });
            continue;
        }
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        try {
            if (isTextFile(file)) {
                const text = await file.text();
                attachments.value.push({ id, name: file.name, mime: file.type || 'text/markdown', size: file.size, kind: 'text', text });
            } else {
                const { base64, dataUrl } = await fileToBase64(file);
                attachments.value.push({ id, name: file.name, mime: file.type, size: file.size, kind: 'binary', base64, dataUrl });
            }
        } catch (err: any) {
            toast('Could not read file', { description: file.name + (err?.message ? ` — ${err.message}` : '') });
        }
    }
}

async function onFilesChosen(e: Event) {
    const input = e.target as HTMLInputElement;
    if (!input.files?.length) return;
    await addFiles(input.files);
    input.value = '';
}

function removeAttachment(id: string) {
    attachments.value = attachments.value.filter(a => a.id !== id);
}

function openFilePicker() {
    fileInput.value?.click();
}

// ── Context picker (matters / deadlines / lawyers) ──────────────────────────
type ContextType = 'matter' | 'deadline' | 'user';
interface ContextItem { type: ContextType; id: string; label: string; sublabel?: string }

const selectedItems = ref<ContextItem[]>([]);
const contextIcons: Record<ContextType, LucideIcon> = { matter: Building2, deadline: Clock, user: User };

const contextDrawerOpen = ref(false);
const contextTab = ref<ContextType>('matter');
const contextSearch = ref('');
const mattersList = ref<{ id: string; name: string; caseNumber: string }[]>([]);
const deadlinesList = ref<{ id: string; name: string; matterName: string }[]>([]);
const usersList = ref<{ id: string; name: string; role: string; avatar?: string }[]>([]);
const contextLoading = ref(false);

watch(contextDrawerOpen, async (isOpen) => {
    if (!isOpen) { contextSearch.value = ''; return; }
    if (mattersList.value.length > 0) return;
    contextLoading.value = true;
    try {
        const [mattersRes, deadlinesRes, usersRes] = await Promise.all([
            getMatters(1, 100, { sort: '-created' }),
            getAllDeadlines({ sort: '-date', filter: "status = 'pending'", expand: 'matter', fields: 'id,name,date,expand.matter.name' }),
            getOrganisationUsers(1, 100, {}),
        ]);
        mattersList.value = (mattersRes.items ?? []).map((m: any) => ({ id: m.id, name: m.name, caseNumber: m.caseNumber }));
        deadlinesList.value = (deadlinesRes ?? []).map((d: any) => ({ id: d.id, name: d.name, matterName: d.expand?.matter?.name ?? '' }));
        usersList.value = (usersRes.items ?? []).map((u: any) => ({ id: u.id, name: u.name, role: u.organisationRole ?? u.role ?? '', avatar: u.avatar }));
    } finally {
        contextLoading.value = false;
    }
});

const q = computed(() => contextSearch.value.toLowerCase());
const filteredMatters = computed(() => q.value ? mattersList.value.filter(m => m.name.toLowerCase().includes(q.value) || m.caseNumber?.toLowerCase().includes(q.value)) : mattersList.value);
const filteredDeadlines = computed(() => q.value ? deadlinesList.value.filter(d => d.name.toLowerCase().includes(q.value) || d.matterName.toLowerCase().includes(q.value)) : deadlinesList.value);
const filteredUsers = computed(() => q.value ? usersList.value.filter(u => u.name.toLowerCase().includes(q.value)) : usersList.value);

function isSelected(id: string) {
    return selectedItems.value.some(i => i.id === id);
}

function toggleItem(item: ContextItem) {
    const idx = selectedItems.value.findIndex(i => i.id === item.id);
    if (idx >= 0) selectedItems.value.splice(idx, 1);
    else selectedItems.value.push(item);
}

function removeItem(id: string) {
    selectedItems.value = selectedItems.value.filter(i => i.id !== id);
}

// ── Prompt enhancement ──────────────────────────────────────────────────────
const enhancing = ref(false);
const canEnhance = computed(() => draft.value.trim().length > 0 && !enhancing.value && !loading.value);
const canSend = computed(() => (draft.value.trim().length > 0 || attachments.value.length > 0) && !loading.value);

async function enhancePrompt() {
    const original = draft.value.trim();
    if (!original || enhancing.value || loading.value) return;
    enhancing.value = true;
    try {
        const result = await improvePrompt(original, buildContext());
        if (result.error) { toast.error(result.error); return; }
        if (result.improved.trim() === original) { toast('Prompt already looks clear — left it as is.'); return; }
        draft.value = result.improved;
        toast('Prompt enhanced', { action: { label: 'Undo', onClick: () => { draft.value = original; } } });
    } finally {
        enhancing.value = false;
    }
}

// ── Conversation history (left rail) ────────────────────────────────────────
const conversations = ref<AiConversationSummary[]>([]);
const historyLoading = ref(false);
const historyLoaded = ref(false);

async function refreshHistory() {
    historyLoading.value = true;
    try {
        const page = await listConversations(1, 30);
        conversations.value = page?.items ?? [];
        historyLoaded.value = true;
    } finally {
        historyLoading.value = false;
    }
}

async function loadConversation(id: string) {
    if (conversationId.value === id) return;
    const conv = await getConversation(id);
    if (!conv) return;
    messages.value = (conv.messages ?? []).map((m): ChatMessage => {
        if (m.role.startsWith('tool-event:')) {
            const status = m.role.slice('tool-event:'.length) as 'approved' | 'rejected';
            return { role: 'tool-event', content: m.content, status };
        }
        if (m.role === 'assistant' && m.steps?.length) {
            return { role: 'assistant', content: m.content, steps: m.steps, durationMs: m.durationMs, stepsOpen: false } as DisplayAiMessage;
        }
        return m as AiMessage;
    });
    conversationId.value = conv.id;
    pendingProposal.value = null;
    active.value = 'assistant';
    scrollToBottom();
}

async function removeConversation(id: string) {
    const ok = await deleteConversation(id);
    if (!ok) return;
    conversations.value = conversations.value.filter(c => c.id !== id);
    if (conversationId.value === id) newChat();
}

function newChat() {
    messages.value = [];
    conversationId.value = '';
    pendingProposal.value = null;
    draft.value = '';
    activeSteps.value = [];
    active.value = 'assistant';
}

onMounted(() => { refreshHistory(); loadHome(); });
</script>

<template>
    <SidebarProvider class="h-svh overflow-hidden">
        <!-- ── Left rail ──────────────────────────────────────────────────────── -->
        <Sidebar collapsible="icon">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <DropdownMenu>
                            <DropdownMenuTrigger as-child>
                                <SidebarMenuButton size="lg" class="data-[state=open]:bg-sidebar-accent">
                                    <div
                                        class="grid size-8 shrink-0 place-items-center rounded-md bg-foreground text-sm font-bold text-background">
                                        <img src="@/assets/img/logos/Practo Core Square -- orange.png" class="size-8" />
                                    </div>
                                    <div class="grid flex-1 text-left leading-tight">
                                        <span class="truncate text-sm font-semibold">{{ workspace }}</span>
                                        <span class="truncate text-xs text-muted-foreground">Legal assistant</span>
                                    </div>
                                    <ChevronsUpDown class="ml-auto size-4 text-muted-foreground" />
                                </SidebarMenuButton>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent class="min-w-56 w-[--radix-dropdown-menu-trigger-width]" align="start"
                                side="bottom">
                                <DropdownMenuLabel class="text-xs text-muted-foreground">Workspace</DropdownMenuLabel>
                                <DropdownMenuItem>{{ workspace }}</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                <!-- Create -->
                <SidebarGroup>
                    <SidebarMenu>
                        <SidebarMenuItem>
                            <SidebarMenuButton class="border" tooltip="New chat" @click="newChat">
                                <Plus />
                                <span>Create</span>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    </SidebarMenu>
                </SidebarGroup>

                <!-- Primary nav -->
                <SidebarGroup>
                    <SidebarGroupLabel>Workspace</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            <SidebarMenuItem v-for="item in nav" :key="item.key">
                                <SidebarMenuButton :tooltip="item.label" :is-active="active === item.key"
                                    @click="active = item.key">
                                    <component :is="item.icon" />
                                    <span>{{ item.label }}</span>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>

                <!-- Recent conversations -->
                <SidebarGroup class="group-data-[collapsible=icon]:hidden">
                    <SidebarGroupLabel>Recent</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <div v-if="historyLoading" class="flex justify-center py-3">
                            <Loader2 class="size-4 animate-spin text-muted-foreground" />
                        </div>
                        <SidebarMenu v-else-if="conversations.length">
                            <SidebarMenuItem v-for="conv in conversations" :key="conv.id" class="group/conv">
                                <SidebarMenuButton :is-active="conversationId === conv.id"
                                    @click="loadConversation(conv.id)">
                                    <MessageSquareText />
                                    <span class="truncate">{{ conv.title }}</span>
                                </SidebarMenuButton>
                                <SidebarMenuAction
                                    class="opacity-0 group-hover/conv:opacity-100 hover:text-destructive"
                                    @click="removeConversation(conv.id)">
                                    <Trash2 />
                                </SidebarMenuAction>
                            </SidebarMenuItem>
                        </SidebarMenu>
                        <p v-else class="px-2 py-2 text-xs text-muted-foreground">No conversations yet.</p>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>

            <SidebarFooter>
                <SidebarMenu>
                    <SidebarMenuItem v-for="item in footerNav" :key="item.key">
                        <SidebarMenuButton :tooltip="item.label" @click="active = item.key">
                            <component :is="item.icon" />
                            <span>{{ item.label }}</span>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarFooter>
        </Sidebar>

        <!-- ── Main panel ─────────────────────────────────────────────────────── -->
        <SidebarInset>
            <!-- Top bar -->
            <header class="flex h-14 shrink-0 items-center gap-2 border-b px-3">
                <SidebarTrigger />
                <div v-if="hasThread" class="flex items-center gap-2">
                    <div class="grid size-6 place-items-center rounded-full bg-primary text-primary-foreground">
                        <Sparkles class="size-3.5" />
                    </div>
                    <span class="text-sm font-semibold">PractoAI</span>
                </div>
                <div class="ml-auto flex items-center gap-1">
                    <Button v-if="hasThread" size="icon-sm" variant="ghost" title="New chat" @click="newChat">
                        <Plus class="size-4" />
                    </Button>
                    <SharedDarkModeSwitch />
                    <Button size="icon-sm" variant="ghost" title="Search">
                        <Search class="size-4" />
                    </Button>
                </div>
            </header>

            <!-- ░░ Scrollable content ░░ -->
            <div class="min-h-0 flex-1 overflow-y-auto">
                <!-- Vault panel — the shared vault workspace (libraries → nested browser) -->
                <div v-if="active === 'vault'" class="mx-auto w-full max-w-4xl px-4 py-6">
                    <SharedVaultWorkspace />
                </div>
                <!-- Empty state — light "home" summary -->
                <div v-else-if="!hasThread" class="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
                    <!-- Stateful greeting -->
                    <div class="flex items-center gap-3">
                        <div class="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground">
                            <Sparkles class="size-5" />
                        </div>
                        <div class="min-w-0">
                            <h1 class="text-lg font-semibold leading-tight">{{ greetingTime }}, {{ firstName }}</h1>
                            <p class="text-sm text-muted-foreground">{{ greetingSummary }}</p>
                        </div>
                    </div>

                    <!-- Needs you — assigned deadlines due soon -->
                    <div v-if="homeLoading" class="flex items-center gap-2 rounded-xl border px-4 py-5 text-sm text-muted-foreground">
                        <Loader2 class="size-4 animate-spin" /> Loading your day…
                    </div>
                    <div v-else-if="deadlineGroups.length" class="rounded-xl border">
                        <div class="flex items-center gap-2 border-b px-4 py-2.5">
                            <CalendarClock class="size-4 text-muted-foreground" />
                            <span class="text-sm font-semibold">Needs you</span>
                            <Badge variant="secondary" class="ml-auto px-1.5 text-xs">{{ dueThisWeekCount }}</Badge>
                        </div>
                        <div v-for="group in deadlineGroups" :key="group.key">
                            <p class="px-4 pt-2.5 pb-1 text-[11px] font-medium uppercase tracking-wide" :class="group.tone">
                                {{ group.label }}
                            </p>
                            <button v-for="d in group.items" :key="d.id"
                                class="group/dl flex w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-accent"
                                @click="openDeadline(d)">
                                <CircleAlert v-if="group.key === 'overdue'" class="size-4 shrink-0 text-destructive" />
                                <Clock v-else class="size-4 shrink-0 text-muted-foreground" />
                                <div class="flex min-w-0 flex-1 flex-col">
                                    <span class="truncate text-sm font-medium">{{ d.name || 'Deadline' }}</span>
                                    <span class="truncate text-xs text-muted-foreground">{{ d.expand?.matter?.name || 'Matter' }}</span>
                                </div>
                                <span class="shrink-0 text-xs font-medium" :class="group.tone">{{ dueLabel(d.date) }}</span>
                                <span
                                    class="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-background hover:text-primary group-hover/dl:opacity-100"
                                    title="Ask PractoAI about this"
                                    @click.stop="askAbout(`Tell me about the “${d.name}” deadline on ${d.expand?.matter?.name || 'this matter'} and what I need to do.`)">
                                    <Sparkles class="size-3.5" />
                                </span>
                            </button>
                        </div>
                    </div>

                    <!-- Recent matters -->
                    <div v-if="!homeLoading && recentMatters.length" class="flex flex-col gap-1.5">
                        <p class="px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Recent matters</p>
                        <div class="flex flex-col">
                            <button v-for="m in recentMatters" :key="m.id"
                                class="group/m flex items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-accent"
                                @click="openMatter(m.id)">
                                <div class="grid size-7 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                                    <Briefcase class="size-3.5" />
                                </div>
                                <div class="flex min-w-0 flex-1 flex-col">
                                    <span class="truncate text-sm font-medium">{{ m.name || 'Matter' }}</span>
                                    <span v-if="m.caseNumber" class="truncate text-xs text-muted-foreground">{{ m.caseNumber }}</span>
                                </div>
                                <span
                                    class="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-background hover:text-primary group-hover/m:opacity-100"
                                    title="Ask PractoAI about this"
                                    @click.stop="askAbout(`Summarise recent activity on the matter “${m.name}”.`)">
                                    <Sparkles class="size-3.5" />
                                </span>
                                <ArrowRight class="size-4 shrink-0 text-muted-foreground/40 transition-transform group-hover/m:translate-x-0.5" />
                            </button>
                        </div>
                    </div>

                    <!-- Smart prompts -->
                    <div class="flex flex-wrap gap-2">
                        <button v-for="p in smartPrompts" :key="p"
                            class="rounded-full border bg-background px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                            @click="send(p)">
                            {{ p }}
                        </button>
                    </div>
                </div>

                <!-- Thread -->
                <div v-else class="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6">
                    <template v-for="(msg, i) in messages" :key="i">
                        <!-- Tool event -->
                        <div v-if="msg.role === 'tool-event'" class="flex justify-center">
                            <span class="inline-flex items-center gap-1 rounded-full border bg-muted/50 px-2.5 py-0.5 text-xs text-muted-foreground">
                                <Check v-if="msg.status === 'approved'" class="size-3 text-emerald-500" />
                                <X v-else class="size-3" />
                                {{ msg.status === 'approved' ? 'Approved' : 'Dismissed' }}: {{ msg.content }}
                            </span>
                        </div>

                        <!-- User -->
                        <div v-else-if="msg.role === 'user'" class="flex justify-end">
                            <div class="flex max-w-[80%] flex-col items-end gap-1">
                                <div v-if="messageAttachments(msg.content).length" class="flex flex-wrap justify-end gap-1">
                                    <template v-for="(att, j) in messageAttachments(msg.content)" :key="j">
                                        <img v-if="att.type === 'image'"
                                            :src="`data:${att.source.media_type};base64,${att.source.data}`"
                                            :alt="`Attachment ${j + 1}`" class="size-16 rounded-md border object-cover" />
                                        <span v-else class="inline-flex items-center gap-1.5 rounded-md border bg-background px-2 py-1 text-xs">
                                            <FileText class="size-3 shrink-0" /> {{ docLabel(att as AiDocumentBlock) }}
                                        </span>
                                    </template>
                                </div>
                                <div v-if="messageText(msg.content)"
                                    class="whitespace-pre-wrap rounded-2xl bg-muted px-4 py-2.5 text-sm leading-relaxed">
                                    {{ messageText(msg.content) }}
                                </div>
                            </div>
                        </div>

                        <!-- Assistant -->
                        <div v-else class="flex items-start gap-2.5">
                            <div class="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
                                <Sparkles class="size-3.5" />
                            </div>
                            <div class="flex min-w-0 flex-1 flex-col gap-1">
                                <!-- Collapsed activity summary -->
                                <div v-if="msg.steps && msg.steps.length" class="mb-0.5">
                                    <button type="button"
                                        class="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                                        @click="msg.stepsOpen = !msg.stepsOpen">
                                        <Check class="size-3 text-emerald-500" />
                                        <span>Worked for {{ formatDuration(msg.durationMs ?? 0) }}</span>
                                        <component :is="msg.stepsOpen ? ChevronDown : ChevronRight" class="size-3" />
                                    </button>
                                    <ul v-if="msg.stepsOpen" class="ml-1 mt-1.5 flex flex-col gap-1 border-l border-border pl-3">
                                        <li v-for="step in msg.steps" :key="step.id"
                                            class="flex items-center gap-2 text-xs text-muted-foreground">
                                            <component :is="stepIcon(step.tool)" class="size-3 shrink-0 opacity-70" />
                                            <span class="truncate">{{ step.label }}<span v-if="step.detail" class="opacity-60"> · {{ step.detail }}</span></span>
                                        </li>
                                    </ul>
                                </div>
                                <div class="prose prose-sm dark:prose-invert prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-pre:my-1 prose-code:text-xs max-w-none text-sm leading-relaxed"
                                    v-html="renderMarkdown(messageText(msg.content))" />
                            </div>
                        </div>
                    </template>

                    <!-- Live working panel -->
                    <div v-if="loading" class="flex items-start gap-2.5">
                        <div class="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
                            <Sparkles class="size-3.5" />
                        </div>
                        <div class="min-w-[11rem] pt-1">
                            <div class="flex items-center gap-1.5 text-xs font-medium">
                                <Loader2 class="size-3.5 animate-spin text-muted-foreground" />
                                <span>Working…</span>
                            </div>
                            <ul v-if="activeSteps.length" class="mt-2 flex flex-col gap-1.5">
                                <li v-for="(step, idx) in activeSteps" :key="step.id"
                                    class="flex items-center gap-2 text-xs">
                                    <Loader2 v-if="idx === activeSteps.length - 1" class="size-3 shrink-0 animate-spin text-muted-foreground" />
                                    <Check v-else class="size-3 shrink-0 text-emerald-500" />
                                    <span class="truncate" :class="idx === activeSteps.length - 1 ? 'text-foreground' : 'text-muted-foreground'">
                                        {{ step.label }}<span v-if="step.detail" class="opacity-60"> · {{ step.detail }}</span>
                                    </span>
                                </li>
                            </ul>
                        </div>
                    </div>

                    <!-- Pending proposal -->
                    <div v-if="pendingProposal" class="max-w-[85%]">
                        <ProposalCard :proposal="pendingProposal" variant="panel" :loading="proposalLoading"
                            @approve="approveProposal" @dismiss="dismissProposal" />
                    </div>

                    <div ref="messagesEnd" />
                </div>
            </div>

            <!-- ░░ Composer (widget-style InputGroup) ░░ — hidden on non-chat panels (e.g. Vault) -->
            <div v-if="active !== 'vault'" class="shrink-0 border-t px-4 py-3">
                <div class="mx-auto flex w-full max-w-3xl flex-col gap-2">
                    <!-- Active context badges -->
                    <div v-if="selectedItems.length" class="flex flex-wrap gap-1">
                        <Badge v-for="item in selectedItems" :key="item.id" variant="secondary" class="flex items-center gap-1 pr-1">
                            <component :is="contextIcons[item.type]" class="size-3 shrink-0" />
                            <span class="max-w-[160px] truncate text-xs">{{ item.label }}</span>
                            <button class="ml-1 shrink-0 text-muted-foreground transition-colors hover:text-foreground" @click="removeItem(item.id)">
                                <X class="size-3" />
                            </button>
                        </Badge>
                    </div>

                    <!-- Pending attachment chips -->
                    <div v-if="attachments.length" class="flex flex-wrap gap-1.5">
                        <div v-for="att in attachments" :key="att.id"
                            class="flex items-center gap-1.5 rounded-md border bg-background px-1 py-1 text-xs">
                            <img v-if="att.mime.startsWith('image/')" :src="att.dataUrl" :alt="att.name" class="size-8 shrink-0 rounded object-cover" />
                            <FileText v-else class="size-4 shrink-0 text-muted-foreground" />
                            <span class="max-w-[140px] truncate font-medium">{{ att.name }}</span>
                            <span class="text-muted-foreground">{{ formatBytes(att.size) }}</span>
                            <button class="ml-0.5 shrink-0 text-muted-foreground transition-colors hover:text-foreground"
                                :aria-label="`Remove ${att.name}`" @click="removeAttachment(att.id)">
                                <X class="size-3" />
                            </button>
                        </div>
                    </div>

                    <input ref="fileInput" type="file" multiple
                        accept="application/pdf,image/jpeg,image/png,image/webp,image/gif,text/markdown,text/plain,text/*,.md,.markdown,.txt,.text,.csv,.json,.log"
                        class="hidden" @change="onFilesChosen" />

                    <InputGroup>
                        <InputGroupAddon align="block-start">
                            <Button size="sm" variant="outline"
                                :class="selectedItems.length ? 'border-primary/50 text-primary' : ''"
                                @click="contextDrawerOpen = true">
                                <AtSign class="size-4" />
                                Add Context
                                <Badge v-if="selectedItems.length" variant="secondary" class="ml-1 px-1 text-xs">
                                    {{ selectedItems.length }}
                                </Badge>
                            </Button>
                        </InputGroupAddon>

                        <InputGroupTextarea v-model="draft" placeholder="Ask, Search or Chat…" @keydown="handleKeydown" />

                        <InputGroupAddon align="block-end">
                            <InputGroupButton variant="outline" size="icon-sm" title="Attach a PDF or image"
                                @click="openFilePicker">
                                <Paperclip class="size-4" />
                                <span class="sr-only">Attach a PDF or image</span>
                            </InputGroupButton>
                            <InputGroupButton variant="outline" size="sm" :disabled="!canEnhance"
                                title="Enhance prompt — rewrite it for better results" @click="enhancePrompt">
                                <Loader2 v-if="enhancing" class="size-4 animate-spin" />
                                <Sparkles v-else class="size-4" />
                                {{ enhancing ? 'Enhancing…' : 'Enhance' }}
                            </InputGroupButton>
                            <Separator orientation="vertical" class="ml-auto !h-4" />
                            <InputGroupButton variant="default" class="rounded-full" size="icon-sm"
                                :disabled="!canSend" @click="send()">
                                <ArrowUpIcon class="size-4" />
                                <span class="sr-only">Send</span>
                            </InputGroupButton>
                        </InputGroupAddon>
                    </InputGroup>
                </div>
            </div>

            <!-- ░░ Context picker — inline overlay (no nested modal) ░░ -->
            <Transition name="context-panel">
                <div v-if="contextDrawerOpen" class="absolute inset-0 z-30 flex flex-col justify-end">
                    <div class="absolute inset-0 bg-black/40" @click="contextDrawerOpen = false" />
                    <div class="relative flex max-h-[75vh] min-h-0 flex-col rounded-t-xl border-t bg-background shadow-xl">
                        <div class="flex shrink-0 items-center gap-2 border-b px-4 py-3">
                            <AtSign class="size-4 text-muted-foreground" />
                            <span class="text-sm font-semibold">Add Context</span>
                            <Button size="icon-sm" variant="ghost" class="ml-auto" @click="contextDrawerOpen = false">
                                <X class="size-4" />
                            </Button>
                        </div>
                        <div class="shrink-0 border-b px-4 pb-2 pt-3">
                            <input v-model="contextSearch" placeholder="Search matters, deadlines, lawyers…"
                                class="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
                        </div>
                        <Tabs v-model="contextTab" class="flex min-h-0 flex-1 flex-col">
                            <TabsList class="h-auto shrink-0 justify-start gap-1 rounded-none border-b bg-transparent px-4 py-2">
                                <TabsTrigger value="matter" class="gap-1.5 text-xs"><Building2 class="size-3" /> Matters</TabsTrigger>
                                <TabsTrigger value="deadline" class="gap-1.5 text-xs"><Clock class="size-3" /> Deadlines</TabsTrigger>
                                <TabsTrigger value="user" class="gap-1.5 text-xs"><User class="size-3" /> Lawyers</TabsTrigger>
                            </TabsList>
                            <div v-if="contextLoading" class="flex items-center justify-center p-8">
                                <Loader2 class="size-5 animate-spin text-muted-foreground" />
                            </div>
                            <template v-else>
                                <TabsContent value="matter" class="mt-0 flex-1 overflow-y-auto pb-8">
                                    <button v-for="m in filteredMatters" :key="m.id"
                                        class="flex w-full items-center gap-3 border-b px-4 py-3 text-left transition-colors last:border-0 hover:bg-accent"
                                        :class="isSelected(m.id) ? 'bg-accent' : ''"
                                        @click="toggleItem({ type: 'matter', id: m.id, label: m.name, sublabel: m.caseNumber })">
                                        <div class="flex min-w-0 flex-1 flex-col"><span class="truncate text-sm font-medium">{{ m.name }}</span><span class="text-xs text-muted-foreground">{{ m.caseNumber }}</span></div>
                                        <Check v-if="isSelected(m.id)" class="size-4 shrink-0 text-primary" />
                                    </button>
                                    <p v-if="!filteredMatters.length" class="px-4 py-6 text-center text-sm text-muted-foreground">No matters found.</p>
                                </TabsContent>
                                <TabsContent value="deadline" class="mt-0 flex-1 overflow-y-auto pb-8">
                                    <button v-for="d in filteredDeadlines" :key="d.id"
                                        class="flex w-full items-center gap-3 border-b px-4 py-3 text-left transition-colors last:border-0 hover:bg-accent"
                                        :class="isSelected(d.id) ? 'bg-accent' : ''"
                                        @click="toggleItem({ type: 'deadline', id: d.id, label: d.name, sublabel: d.matterName })">
                                        <div class="flex min-w-0 flex-1 flex-col"><span class="truncate text-sm font-medium">{{ d.name }}</span><span class="truncate text-xs text-muted-foreground">{{ d.matterName }}</span></div>
                                        <Check v-if="isSelected(d.id)" class="size-4 shrink-0 text-primary" />
                                    </button>
                                    <p v-if="!filteredDeadlines.length" class="px-4 py-6 text-center text-sm text-muted-foreground">No pending deadlines found.</p>
                                </TabsContent>
                                <TabsContent value="user" class="mt-0 flex-1 overflow-y-auto pb-8">
                                    <button v-for="u in filteredUsers" :key="u.id"
                                        class="flex w-full items-center gap-3 border-b px-4 py-3 text-left transition-colors last:border-0 hover:bg-accent"
                                        :class="isSelected(u.id) ? 'bg-accent' : ''"
                                        @click="toggleItem({ type: 'user', id: u.id, label: u.name, sublabel: u.role })">
                                        <Avatar class="size-7 shrink-0">
                                            <AvatarImage :src="u.avatar ?? ''" :alt="u.name" />
                                            <AvatarFallback class="bg-primary text-[10px] text-primary-foreground">{{ initials(u.name) }}</AvatarFallback>
                                        </Avatar>
                                        <div class="flex min-w-0 flex-1 flex-col"><span class="text-sm font-medium">{{ u.name }}</span><span v-if="u.role" class="text-xs capitalize text-muted-foreground">{{ u.role }}</span></div>
                                        <Check v-if="isSelected(u.id)" class="size-4 shrink-0 text-primary" />
                                    </button>
                                    <p v-if="!filteredUsers.length" class="px-4 py-6 text-center text-sm text-muted-foreground">No lawyers found.</p>
                                </TabsContent>
                            </template>
                        </Tabs>
                    </div>
                </div>
            </Transition>
        </SidebarInset>
    </SidebarProvider>
</template>

<style scoped>
/* Context picker slide-up */
.context-panel-enter-active,
.context-panel-leave-active { transition: opacity 0.2s ease; }
.context-panel-enter-active > div:last-child,
.context-panel-leave-active > div:last-child { transition: transform 0.25s ease; }
.context-panel-enter-from,
.context-panel-leave-to { opacity: 0; }
.context-panel-enter-from > div:last-child,
.context-panel-leave-to > div:last-child { transform: translateY(100%); }
</style>
