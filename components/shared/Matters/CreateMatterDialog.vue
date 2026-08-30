<script lang="ts" setup>
// Compact "New matter" flow, built to the same rhythm as the engagement dialog:
// a Dialog on desktop, a bottom Drawer below, one body, one question per step.
//
//   Procedure — pick the procedure this matter runs on (skipped when `template`
//               is supplied, e.g. "Use this procedure" in the Procedure Library)
//   Parties   — who is on each side (omitted when the procedure declares none)
//   Details   — case name, case number, court, judges, opposing counsel, team
//   Timeline  — entry anchor, trigger date, the procedure's intake fields → Create
//
// The order is the order a case file is assembled: what kind of matter, who is
// in it, how it is identified, and only then the dates the rules compute from.
// Parties come before Details because they derive the case name.
//
// One primary action throughout — "Continue" until the last step, "Create matter"
// on it. Every field outside Timeline is optional, so Continue is always live and
// clicking through a step is how you skip it.
//
// This is a parallel implementation. The 829-line stepper at
// CreateMatter/CreateMatter.vue and the full-page flow at pages/main/matters/create.vue
// both stay live and untouched.
import {
  Loader2, Search, Layers, CalendarClock, ShieldCheck, Building2,
  ChevronLeft, ArrowLeft,
} from 'lucide-vue-next';
import { toast } from 'vue-sonner';
import { getAllTemplates } from '~/services/templates';
import { createMatter } from '~/services/matters';
import { getSignedInUser } from '~/services/auth';
import { normalizeTemplateRecord } from '~/utils/normalizeTemplate';
import { splitFieldLabel } from '~/utils/splitFieldLabel';
import { useMattersStore } from '~/stores/matters';
import { useDashboardStore } from '~/stores/dashboard';
import type { DetailField } from '~/types/detailFields';

const props = defineProps<{
  // A DeadlineTemplates record. When supplied the picker step is omitted.
  // Safe to pass either raw or already normalised — normalising twice is a no-op.
  template?: any;
}>();

const open = defineModel<boolean>('open', { default: false });
const emit = defineEmits<{ created: [matter: any] }>();

const router = useRouter();
const { hasPermission } = usePermissions();
const mattersStore = useMattersStore();
const dashboardStore = useDashboardStore();

const [DefineBody, ReuseBody] = createReusableTemplate();

// ── State ────────────────────────────────────────────────────────────────────
const hasPresetTemplate = computed(() => !!props.template?.id);
const stepIndex = ref(0);
const search = ref('');
const selected = ref<any>(null);

const name = ref('');
// A name typed by hand is never overwritten by one derived from the parties.
const nameTouched = ref(false);
const caseNumber = ref('');
const court = ref('');
const judges = ref<string[]>([]);
const opposingCounsel = ref<any[]>([]);
const members = ref<any[]>([]);

const parties = ref<Record<string, any[]>>({});
const representing = ref<{ role_id: string; party_member_ids: string[] } | null>(null);
const partiesRef = ref<any>(null);

const triggerDate = ref('');
// The triggering event hasn't happened yet and this is a best estimate. The
// backend builds a projected timeline and holds reminders until it is confirmed.
const isProvisional = ref(false);
const fieldValues = reactive<Record<string, any>>({});

const templates = ref<any[]>([]);
const templatesLoading = ref(false);
const creating = ref(false);
const error = ref('');

function resetFieldValues() {
  for (const k of Object.keys(fieldValues)) delete fieldValues[k];
}

function resetForTemplate() {
  parties.value = {};
  representing.value = null;
  name.value = '';
  nameTouched.value = false;
  caseNumber.value = '';
  court.value = '';
  judges.value = [];
  opposingCounsel.value = [];
  triggerDate.value = '';
  isProvisional.value = false;
  resetFieldValues();
  error.value = '';
}

function reset() {
  search.value = '';
  members.value = [];
  resetForTemplate();
  selected.value = hasPresetTemplate.value
    ? normalizeTemplateRecord(props.template, templates.value)
    : null;
  stepIndex.value = 0;
}

// Reload procedures every time the flow opens, so one just authored in Studio
// shows up without waiting on a cache.
watch(open, async (v) => {
  if (!v) return;
  reset();
  umTrackEvent('open-matter-creation-dialog');
  if (hasPresetTemplate.value) return;
  templatesLoading.value = true;
  error.value = '';
  try {
    templates.value = await getAllTemplates();
  } catch (e: any) {
    error.value = e?.message || 'Could not load procedures.';
  } finally {
    templatesLoading.value = false;
  }
});

// A procedure can also arrive after the dialog is already open.
watch(() => props.template, () => { if (open.value) reset(); });

// ── Steps ────────────────────────────────────────────────────────────────────
const templateData = computed(() => selected.value?.template?.data ?? null);
const partyConfig = computed(() => templateData.value?.parties ?? null);
const hasParties = computed(() => partyConfig.value?.enabled === true);
const partyRoles = computed(() => partyConfig.value?.roles ?? []);
const hasOrganisation = computed(() => !!getSignedInUser()?.organisation);

type StepId = 'procedure' | 'parties' | 'details' | 'timeline';

const steps = computed<{ id: StepId; title: string; subtitle: string }[]>(() => {
  const list: { id: StepId; title: string; subtitle: string }[] = [];
  if (!hasPresetTemplate.value) {
    list.push({
      id: 'procedure', title: 'Procedure',
      subtitle: 'Pick the procedure this matter runs on.',
    });
  }
  // A procedure that declares no party roles has nothing to ask here.
  if (hasParties.value) {
    list.push({
      id: 'parties', title: 'Parties',
      subtitle: "Who is on each side, and who you're acting for.",
    });
  }
  list.push(
    { id: 'details', title: 'Details', subtitle: 'How this matter is identified. All optional.' },
    { id: 'timeline', title: 'Timeline', subtitle: 'Enter the key dates. Everything else can be changed later.' },
  );
  return list;
});

const currentStep = computed(() => steps.value[stepIndex.value] ?? steps.value[steps.value.length - 1]);
const isLastStep = computed(() => stepIndex.value >= steps.value.length - 1);

// The party step appears and disappears with the chosen procedure, so an index
// held across that change can point past the end.
watch(steps, (list) => {
  if (stepIndex.value > list.length - 1) stepIndex.value = list.length - 1;
});

function back() {
  error.value = '';
  if (stepIndex.value > 0) stepIndex.value -= 1;
}

function next() {
  error.value = '';
  if (!isLastStep.value) stepIndex.value += 1;
}

// ── Procedure step ───────────────────────────────────────────────────────────
const filtered = computed(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return templates.value;
  return templates.value.filter((t) =>
    `${t.name} ${t.description ?? ''} ${t.matterType ?? ''} ${t.courtLevel ?? ''}`
      .toLowerCase().includes(q));
});

// PractoCore's procedures and the firm's stay visibly separate. A signed
// procedure carries PractoCore's authority against the rules of court and a
// firm-authored one does not — that distinction is the product's promise, so it
// is never collapsed into one list.
const isFirmAuthored = (t: any) => t?.provenance === 'firm';
const groups = computed(() => [
  {
    key: 'signed',
    label: 'PractoCore procedures',
    hint: 'Maintained against the rules of court.',
    items: filtered.value.filter((t) => !isFirmAuthored(t)),
  },
  {
    key: 'firm',
    label: "Your firm's procedures",
    hint: "Authored here — your firm's process, not a signed one.",
    items: filtered.value.filter(isFirmAuthored),
  },
].filter((g) => g.items.length));

// `enhanceTemplate`'s deadlineCount reads the v1 path only and so returns 0 on
// every v2-IR record. Resolve the shape here rather than trusting that count.
function deadlineCountOf(t: any): number {
  let blob = t?.template;
  if (typeof blob === 'string') { try { blob = JSON.parse(blob); } catch { blob = {}; } }
  const ir = Array.isArray(blob?.deadlines) ? blob : (blob?.ir ?? blob?.data ?? blob ?? {});
  return Array.isArray(ir?.deadlines) ? ir.deadlines.length : 0;
}

function pick(t: any) {
  // Normalise before use. A firm procedure that extends a PractoCore one stores
  // only its own additions, so without composing it against its base the form
  // has no trigger-date prompt and drops the fields the timeline depends on.
  selected.value = normalizeTemplateRecord(t, templates.value);
  resetForTemplate();
  stepIndex.value = 1;
}

// ── Parties step ─────────────────────────────────────────────────────────────
// The case name is assembled from the parties in the conventional form
// ("A, B v. C"), using each role's declared side. It only ever pre-fills the
// name — typing one by hand takes precedence from that point on.
function derivedFromParties(): string {
  const MAX_PER_SIDE = 2;
  const MAX_LEN = 60;
  const first: string[] = [];
  const second: string[] = [];

  for (const role of partyRoles.value) {
    const named = (parties.value[role.id] || []).filter((m: any) => m.name?.trim());
    if (!named.length) continue;
    const names = named.map((m: any) => m.name.trim());
    if (role.side === 'first') first.push(...names);
    else if (role.side === 'second') second.push(...names);
  }

  const format = (list: string[]) => {
    if (!list.length) return '';
    if (list.length > MAX_PER_SIDE) {
      const rest = list.length - MAX_PER_SIDE;
      return `${list.slice(0, MAX_PER_SIDE).join(', ')} and ${rest} ${rest === 1 ? 'other' : 'others'}`;
    }
    const full = list.join(', ');
    if (full.length > MAX_LEN && list.length > 1) {
      const rest = list.length - 1;
      return `${list[0]} and ${rest} ${rest === 1 ? 'other' : 'others'}`;
    }
    return full;
  };

  const a = format(first);
  const b = format(second);
  if (a && b) return `${a} v. ${b}`;
  return a || b;
}

watch(parties, () => {
  if (!hasParties.value || nameTouched.value) return;
  const derived = derivedFromParties();
  if (derived) name.value = derived;
}, { deep: true });

// The party step is the one place with real validation — a role with a minimum
// it hasn't met, an unnamed member, or a representation that was required and
// not given. But the step is still optional: a procedure whose roles each want a
// minimum of one would otherwise block Continue the moment it opened, with a
// disabled button and nothing said. So an untouched step is a skipped step, and
// validation only starts once something has actually been entered.
const partiesUntouched = computed(() =>
  !representing.value && Object.values(parties.value).every((l) => !l?.length));

const partiesValid = computed(() => {
  if (currentStep.value?.id !== 'parties' || !hasParties.value) return true;
  if (partiesUntouched.value) return true;
  return partiesRef.value?.isValid ?? false;
});

// Shown under the editor, so a blocked Continue always says why.
const partyErrors = computed<string[]>(() => {
  if (currentStep.value?.id !== 'parties' || partiesUntouched.value) return [];
  return partiesRef.value?.errors ?? [];
});

// ── Timeline step ────────────────────────────────────────────────────────────
// L6 — entry anchors. A procedure is one blueprint entered from more than one
// side, and the two sides know different dates: the firm that filed the plaint
// knows the filing date, the firm served with it does not. The anchor decides
// which date we ask for; everything downstream is computed the same way either way.
const anchorOptions = computed(() =>
  (templateData.value?.triggers ?? []).map((t: any) => ({
    id: t.id,
    label: t.label,
    prompt: t.prompt,
    // Named for the lawyer's benefit ("acting for the defendant"); never used to
    // compute anything.
    roleLabel: partyRoles.value.find((r: any) => r.id === t.forRole)?.name ?? '',
  })),
);
const hasAnchorChoice = computed(() => anchorOptions.value.length > 1);

const selectedAnchorId = ref('');
const selectedAnchor = computed(
  () => anchorOptions.value.find((a: any) => a.id === selectedAnchorId.value) ?? null,
);

// Default to the procedure's first anchor whenever it changes, so the date
// question always has a prompt and the user can simply proceed. When the firm
// has said who it represents, prefer the anchor written for that role.
watch([anchorOptions, representing], ([opts, rep]: [any, any]) => {
  if ((opts as any[]).some((o: any) => o.id === selectedAnchorId.value)) return;
  const forRole = rep?.role_id
    ? (templateData.value?.triggers ?? []).find((t: any) => t.forRole === rep.role_id)
    : null;
  selectedAnchorId.value = forRole?.id ?? (opts as any[])[0]?.id ?? '';
}, { immediate: true });

// The trigger date renders through the same component as every other field so it
// looks identical, and its label comes from the chosen anchor — asking a
// defendant's lawyer when the plaint was "presented to the registry" is the
// defect the anchor question exists to fix.
const triggerField = computed<DetailField>(() => toDetailField({
  id: 'date',
  label: selectedAnchor.value?.prompt || templateData.value?.triggerDatePrompt || 'Enter the date',
  type: 'date',
  required: true,
}));

// normalizeTemplateRecord emits options as {value,label}[]; DetailField wants
// plain strings, and a select handed the object form renders empty.
function toDetailField(f: any): DetailField {
  const { label, hint } = splitFieldLabel(f.label ?? f.name ?? f.id);
  const options = (f.options ?? [])
    .map((o: any) => (typeof o === 'string' ? o : o?.value ?? o?.label))
    .filter((o: any): o is string => typeof o === 'string' && o !== '');
  return {
    id: f.id,
    label,
    ...(hint ? { hint } : {}),
    type: normalizeType(f.type),
    required: !!f.required,
    ...(options.length ? { options } : {}),
  };
}

// The two stored shapes disagree on type names ('string' vs 'text', 'bool' vs
// 'boolean'); FieldInput knows only the DetailField set.
function normalizeType(t: string): DetailField['type'] {
  switch (t) {
    case 'string': return 'text';
    case 'bool': return 'boolean';
    case 'number':
    case 'boolean':
    case 'select':
    case 'date': return t;
    default: return 'text';
  }
}

const intakeFields = computed<DetailField[]>(() =>
  (templateData.value?.fields ?? []).map(toDetailField));

// A switch left alone still carries an answer: "No". Nothing writes to
// fieldValues until the user touches the control, so an untouched required
// boolean used to reach the backend as absent rather than false — which it
// rejects as a missing required field. Seed every boolean the moment the
// procedure's fields are known, so the control and the payload agree from the
// start that the answer is No.
watch(intakeFields, (fields) => {
  for (const f of fields) {
    if (f.type === 'boolean' && fieldValues[f.id] === undefined) fieldValues[f.id] = false;
  }
}, { immediate: true });

// A required field is missing when its value is blank. Booleans are exempt: a
// switch always carries an answer (unset = false = "No"), so it is never missing.
const missingRequired = computed(() =>
  intakeFields.value.filter((f) => {
    if (!f.required || f.type === 'boolean') return false;
    const v = fieldValues[f.id];
    return v === undefined || v === null || v === '';
  }));

// ── Footer ───────────────────────────────────────────────────────────────────
// Every field outside Timeline is optional, so the only thing that can block
// forward movement is an invalid party set.
const canAdvance = computed(() => partiesValid.value);
const canCreate = computed(() => !!triggerDate.value && !creating.value);

// A name is never demanded — the matter page renames in one click — so derive
// something legible when it is left blank.
const derivedName = computed(() =>
  name.value.trim()
  || derivedFromParties()
  || (caseNumber.value.trim() && `Matter ${caseNumber.value.trim()}`)
  || `${selected.value?.name || 'New matter'}${triggerDate.value ? ` — ${triggerDate.value}` : ''}`);

function cleanedFieldValues(): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(fieldValues)) {
    if (v !== undefined && v !== null && v !== '') out[k] = v;
  }
  // Booleans are always sent, including false — the seeding watcher above covers
  // the normal path, but this guarantees it for a field that appeared late.
  for (const f of intakeFields.value) {
    if (f.type === 'boolean') out[f.id] = !!fieldValues[f.id];
  }
  return out;
}

// Strip the UI-only bookkeeping the party editor keeps on each member.
function cleanedParties(): Record<string, any[]> {
  const out: Record<string, any[]> = {};
  for (const [roleId, list] of Object.entries(parties.value)) {
    out[roleId] = (list as any[]).map((m) => ({
      id: m.id,
      role_id: m.role_id,
      name: m.name,
      type: m.type,
      contact_info: m.contact_info,
    }));
  }
  return out;
}

// createMatter throws with the status and the raw response body attached, which
// is the right thing for a log and the wrong thing for a dialog. Turn it into a
// sentence, and when the backend names a field it rejected, name that field by
// the question the user was actually asked.
function friendlyError(e: any): string {
  const raw = String(e?.message ?? '');

  let detail = '';
  const body = raw.match(/\{[\s\S]*\}\s*$/);
  if (body) {
    try { detail = String(JSON.parse(body[0])?.error ?? ''); } catch { /* not JSON */ }
  }

  const missing = detail.match(/missing required field\s*\\?"?([\w.-]+)\\?"?/i);
  if (missing) {
    const field = intakeFields.value.find((f) => f.id === missing[1]);
    return field
      ? `Please answer “${field.label}” before creating this matter.`
      : 'One of the answers this procedure needs is missing. Check the questions above.';
  }

  if (/\((401|403)\)/.test(raw)) return 'You do not have permission to create matters here.';
  if (/\(5\d\d\)/.test(raw)) return 'The server could not create this matter. Please try again in a moment.';
  if (/failed to fetch|networkerror/i.test(raw)) return 'Could not reach the server. Check your connection and try again.';
  return 'This matter could not be created. Check the answers above and try again.';
}

async function submit() {
  if (!selected.value?.id || !triggerDate.value) return;
  if (missingRequired.value.length) {
    error.value = `Please fill in: ${missingRequired.value.map((f) => f.label).join(', ')}`;
    return;
  }
  creating.value = true;
  error.value = '';
  try {
    const result = await createMatter({
      name: derivedName.value,
      caseNumber: caseNumber.value.trim(),
      personal: false,
      members: members.value.map((m: any) => m?.id).filter(Boolean),
      templateId: selected.value.id,
      date: triggerDate.value,
      // Which question `date` answers. Empty for single-anchor procedures, which
      // the backend reads as "the template default".
      triggerId: hasAnchorChoice.value ? selectedAnchorId.value : '',
      // The trigger date lives in fieldValues under `date`, as both older flows send it.
      fieldValues: { ...cleanedFieldValues(), date: triggerDate.value } as any,
      triggerStatus: isProvisional.value ? 'provisional' : 'confirmed',
      court: court.value,
      judges: judges.value,
      opposingCounsel: opposingCounsel.value,
      courtOfficers: { registrars: [], clerks: [] },
      ...(hasParties.value && {
        parties: cleanedParties(),
        representing: representing.value,
      }),
    } as any);

    // createMatter throws on a non-2xx response, so reaching here means success.
    toast.success('Matter created.');
    emit('created', result?.matter ?? result);
    umTrackEvent('created-matter', { result: result?.matter });

    // The list page caches for 5 minutes and only fetches on mount, so without
    // this the new matter is missing from it until the cache expires.
    if (result?.matter) mattersStore.addMatterOptimistic(result.matter);
    mattersStore.fetchMatters(true).catch(() => {});
    dashboardStore.fetchStatistics(true).catch(() => {});

    open.value = false;
    // The matter page is /main/matters/matter/<id>; there is no
    // /main/matters/<id> route, so the short form landed the user on the 404
    // page immediately after "Matter created." See stores/createMatter.ts
    // (openCreatedMatter) and utils/notificationRoute.ts, which both build it
    // the long way.
    if (result?.matter?.id) await router.push(`/main/matters/matter/${result.matter.id}`);
  } catch (e: any) {
    // The raw body still reaches the console for debugging; the dialog gets prose.
    console.error('[create-matter]', e);
    error.value = friendlyError(e);
    toast.error(error.value);
  } finally {
    creating.value = false;
  }
}

function goStudio() {
  open.value = false;
  router.push('/main/matters/studio');
}
</script>

<template>
  <!-- Shared body for both the Dialog (desktop) and Drawer (mobile) shells. -->
  <DefineBody>
    <div class="flex min-h-0 flex-1 flex-col">
      <!-- ── Procedure ───────────────────────────────────────────────────── -->
      <template v-if="currentStep?.id === 'procedure'">
        <div class="border-b p-3">
          <div class="relative">
            <Search class="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input v-model="search" placeholder="Search procedures…" class="pl-9" />
          </div>
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto p-3">
          <div v-if="templatesLoading" class="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 class="size-4 animate-spin" /> Loading procedures…
          </div>

          <p v-else-if="error" class="py-6 text-center text-sm text-destructive">{{ error }}</p>

          <div v-else-if="!filtered.length" class="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
            <Layers class="size-6" />
            <p class="text-sm">No procedures match “{{ search }}”.</p>
          </div>

          <div v-else class="flex flex-col gap-5">
            <section v-for="g in groups" :key="g.key" class="flex flex-col gap-2">
              <div class="flex flex-col gap-0.5">
                <h3 class="text-[11px] uppercase tracking-wide text-muted-foreground">{{ g.label }}</h3>
                <p class="text-[11px] text-muted-foreground/80">{{ g.hint }}</p>
              </div>
              <button
                v-for="t in g.items" :key="t.id"
                type="button"
                class="flex flex-col gap-1.5 rounded-lg border bg-muted/40 p-3 text-left transition-colors hover:border-primary hover:bg-muted"
                @click="pick(t)"
              >
                <div class="flex flex-wrap items-center gap-2">
                  <span class="min-w-0 break-words text-sm font-medium">{{ t.name }}</span>
                  <Badge variant="outline" class="gap-1 text-[10px]">
                    <component :is="isFirmAuthored(t) ? Building2 : ShieldCheck" class="size-2.5" />
                    {{ isFirmAuthored(t) ? 'Firm' : 'PractoCore' }}
                  </Badge>
                </div>
                <p v-if="t.description" class="line-clamp-2 text-xs text-muted-foreground">{{ t.description }}</p>
                <div class="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                  <span v-if="deadlineCountOf(t)" class="flex items-center gap-1">
                    <CalendarClock class="size-3" />
                    {{ deadlineCountOf(t) }} deadline{{ deadlineCountOf(t) === 1 ? '' : 's' }}
                  </span>
                  <span v-if="t.courtLevel">{{ t.courtLevel }}</span>
                </div>
              </button>
            </section>
          </div>
        </div>

        <div class="border-t p-3">
          <p class="text-xs text-muted-foreground">
            Don't see the procedure you need?
            <button type="button" class="text-primary hover:underline" @click="goStudio">Build one →</button>
          </p>
        </div>
      </template>

      <!-- ── Every other step: chosen procedure + the step's own body ─────── -->
      <template v-else>
        <!-- Which procedure this matter runs on, and the way back to change it.
             One line: on a phone the full card plus a separate "Change procedure"
             button cost more vertical space than the step's own questions. -->
        <div class="flex shrink-0 items-center gap-2 border-b px-3 py-2">
          <button
            v-if="!hasPresetTemplate"
            type="button"
            class="-ml-1 flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Change procedure"
            title="Change procedure"
            @click="stepIndex = 0"
          >
            <ArrowLeft class="size-4" />
          </button>
          <span class="min-w-0 flex-1 truncate text-xs font-medium" :title="selected?.name">
            {{ selected?.name }}
          </span>
          <Badge v-if="selected" variant="outline" class="shrink-0 gap-1 text-[10px]">
            <component :is="isFirmAuthored(selected) ? Building2 : ShieldCheck" class="size-2.5" />
            {{ isFirmAuthored(selected) ? 'Firm' : 'PractoCore' }}
          </Badge>
        </div>

        <!-- pb-16 keeps the last field clear of the footer, so a scrollable body
             never reads as a truncated one. -->
        <div class="min-h-0 flex-1 overflow-y-auto p-4 pb-16">
          <!-- Parties -->
          <div v-if="currentStep?.id === 'parties'" class="flex flex-col gap-4">
            <SharedMattersCreateMatterParties
              ref="partiesRef"
              v-model="parties"
              v-model:representing="representing"
              :party-roles="partyRoles"
            />
            <p v-if="partiesUntouched" class="text-xs text-muted-foreground">
              Optional — continue without adding anyone and fill this in from the matter later.
            </p>
            <ul v-else-if="partyErrors.length" class="flex flex-col gap-1">
              <li v-for="(e, i) in partyErrors" :key="i" class="text-xs text-destructive">{{ e }}</li>
            </ul>
          </div>

          <!-- Details -->
          <div v-else-if="currentStep?.id === 'details'" class="flex flex-col gap-4">
            <div class="flex flex-col gap-1.5">
              <Label for="new-matter-name">Case name</Label>
              <Input
                id="new-matter-name"
                :model-value="name"
                :placeholder="derivedName"
                @update:model-value="(v: any) => { name = String(v ?? ''); nameTouched = true; }"
              />
              <p class="text-xs text-muted-foreground">
                {{ hasParties
                  ? "Filled in from the parties. Edit it and we'll keep what you type."
                  : "Leave blank and we'll name it from the procedure. You can rename it any time." }}
              </p>
            </div>

            <div class="flex flex-col gap-1.5">
              <Label for="new-matter-case-number">{{ selected?.caseNumberLabel || 'Case number' }}</Label>
              <Input id="new-matter-case-number" v-model="caseNumber" placeholder="e.g. HCCS No. 27 of 2026" />
            </div>

            <div class="flex flex-col gap-1.5">
              <Label>Court</Label>
              <SharedMattersCreateMatterCourtSelector v-model="court" :limit-courts="selected?.courts" />
            </div>

            <div class="flex flex-col gap-1.5">
              <Label>Judges</Label>
              <SharedMattersCreateMatterJudgeSelector v-model="judges" :court="court" />
            </div>

            <Separator />

            <div class="flex flex-col gap-1.5">
              <Label>Opposing counsel</Label>
              <SharedMattersCreateMatterOpposingCounsel v-model="opposingCounsel" />
            </div>

            <!-- Only a firm has anyone to assign; a personal account has no list. -->
            <template v-if="hasOrganisation">
              <Separator />
              <div class="flex flex-col gap-1.5">
                <Label>Who should get the reminders</Label>
                <SharedMattersCreateMatterMemberSelector v-model="members" />
              </div>
            </template>
          </div>

          <!-- Timeline -->
          <div v-else class="flex flex-col gap-4">
            <!-- Entry anchor, asked immediately above the date question it governs
                 and only when the procedure offers a real choice. -->
            <div v-if="hasAnchorChoice" class="flex flex-col gap-3 rounded-lg border p-3">
              <div class="flex flex-col gap-1">
                <p class="text-sm font-medium">How did this matter reach you?</p>
                <p class="text-xs text-muted-foreground">
                  This decides which date we ask for. The rest of the timeline is the same either way.
                </p>
              </div>
              <div class="grid gap-2">
                <button
                  v-for="opt in anchorOptions"
                  :key="opt.id"
                  type="button"
                  class="break-words rounded-md border px-3 py-2 text-left text-sm transition-colors"
                  :class="selectedAnchorId === opt.id ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'"
                  @click="selectedAnchorId = opt.id"
                >
                  <span class="font-medium">{{ opt.label }}</span>
                  <span v-if="opt.roleLabel" class="text-muted-foreground">
                    — acting for the {{ opt.roleLabel.toLowerCase() }}
                  </span>
                </button>
              </div>
            </div>

            <SharedFieldsFieldInput :field="triggerField" v-model="triggerDate" />

            <div class="flex items-start gap-2 rounded-md border border-dashed p-2">
              <Checkbox
                id="provisional-trigger"
                :model-value="isProvisional"
                class="mt-0.5"
                @update:model-value="(v: any) => (isProvisional = !!v)"
              />
              <label for="provisional-trigger" class="cursor-pointer select-none text-sm text-muted-foreground">
                This date hasn't happened yet — it's an estimate.
                <span class="block text-xs">
                  We'll build a <b>projected</b> timeline you can work from. Reminders stay off until you confirm the real date.
                </span>
              </label>
            </div>

            <template v-if="intakeFields.length">
              <Separator />
              <SharedFieldsFieldInput
                v-for="f in intakeFields"
                :key="f.id"
                :field="f"
                v-model="fieldValues[f.id]"
              />
            </template>
          </div>

          <p v-if="error" class="mt-4 text-sm text-destructive">{{ error }}</p>
        </div>

        <div class="flex items-center justify-end gap-2 border-t p-3">
          <!-- Absent on the first visible step rather than shown disabled. -->
          <Button v-if="stepIndex > 0" variant="outline" @click="back">
            <ChevronLeft class="size-4" /> Back
          </Button>
          <Button v-if="!isLastStep" :disabled="!canAdvance" @click="next">Continue</Button>
          <Button v-else :disabled="!canCreate" @click="submit">
            <Loader2 v-if="creating" class="mr-1.5 size-4 animate-spin" />
            Create matter
          </Button>
        </div>
      </template>
    </div>
  </DefineBody>

  <div v-if="hasPermission('canCreateMatters')" class="contents">
    <!-- Desktop: Dialog -->
    <Dialog v-if="$viewport.isGreaterOrEquals('customxs')" v-model:open="open">
      <DialogTrigger v-if="$slots.default" :disabled="!usePlanActive()?.value?.active" class="disabled:opacity-60">
        <slot />
      </DialogTrigger>
      <DialogContent class="flex h-[80vh] max-h-[640px] flex-col gap-0 p-0 sm:max-w-lg">
        <DialogHeader class="gap-1 border-b px-4 py-3">
          <DialogTitle class="text-base">New matter</DialogTitle>
          <DialogDescription class="text-xs">
            <span class="font-medium text-foreground">Step {{ stepIndex + 1 }}/{{ steps.length }}</span>
            · {{ currentStep?.subtitle }}
          </DialogDescription>
        </DialogHeader>
        <ReuseBody />
      </DialogContent>
    </Dialog>

    <!-- Mobile: bottom Drawer -->
    <Drawer v-else v-model:open="open">
      <DrawerTrigger v-if="$slots.default" :disabled="!usePlanActive()?.value?.active" class="disabled:opacity-60">
        <slot />
      </DrawerTrigger>
      <DrawerContent class="h-[94dvh] max-h-[94dvh]">
        <DrawerHeader class="gap-1 border-b px-4 py-3 text-left">
          <DrawerTitle class="text-base">New matter</DrawerTitle>
          <DrawerDescription class="text-xs">
            <span class="font-medium text-foreground">Step {{ stepIndex + 1 }}/{{ steps.length }}</span>
            · {{ currentStep?.subtitle }}
          </DrawerDescription>
        </DrawerHeader>
        <ReuseBody />
      </DrawerContent>
    </Drawer>
  </div>
</template>
