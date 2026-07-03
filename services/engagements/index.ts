import { pb, SERVER_URL } from '~/lib/pocketbase';

// ── Engagements service ─────────────────────────────────────────────────────
// Surfaces the "Engagements" matter type (practocore-backend/ai/engagements,
// FLEXIBLE_MATTERS_STRATEGY.md): the flexible, stage/milestone-driven workspace
// for advisory/transactional/regulatory work that isn't a litigation matter.
//
// Reads (list/view engagements, templates, milestones) go straight through the
// PocketBase SDK — the collections expose their own owner/org-scoped access
// rules. Creation goes through a gated custom endpoint because it must
// materialize milestones atomically alongside the engagement row.

export type EngagementStatus = 'draft' | 'active' | 'completed' | 'archived';
export type MilestoneStatus = 'pending' | 'done' | 'skipped';

export interface TemplateField {
  id: string;
  label: string;
  type: 'text' | 'number' | 'boolean' | 'select' | 'date';
  options?: string[];
  required?: boolean;
}

export interface TemplateSection {
  id: string;
  label: string;
  fields: TemplateField[];
}

export interface TemplateRole {
  id: string;
  label: string;
}

export interface TemplateStage {
  id: string;
  label: string;
  order: number;
}

export interface DueRule {
  type: 'relative' | 'absolute';
  days?: number;
  date?: string;
}

export interface ComplianceAnchor {
  type?: 'from_completion' | 'anniversary' | 'fixed_calendar';
  dateSource?: string; // completion | target | field:<id>
  monthDay?: string; // MM-DD, for fixed_calendar
}

export interface TemplateCompliance {
  id: string;
  label: string;
  recurrence: ComplianceRecurrence;
  periodMonths?: number;
  spawnOn?: 'completion' | 'creation';
  anchor?: ComplianceAnchor;
  reminder?: boolean;
}

export interface TemplateMilestone {
  id: string;
  label: string;
  stageId: string;
  ownerRole?: string;
  dueRule: DueRule;
  reminder?: boolean;
}

export interface TemplateDocument {
  id: string;
  label: string;
  optional?: boolean;
}

export interface EngagementTemplate {
  id: string;
  name: string;
  description: string;
  organisation: string;
  author: string;
  isPublic: boolean;
  data: {
    sections: TemplateSection[];
    roles: TemplateRole[];
    stages: TemplateStage[];
    milestones: TemplateMilestone[];
    documents: TemplateDocument[];
    compliance: TemplateCompliance[];
  };
  created: string;
  updated: string;
}

export interface Engagement {
  id: string;
  template: string;
  name: string;
  owner: string;
  organisation: string;
  members: string[];
  status: EngagementStatus;
  targetDate?: string;
  fieldValues: Record<string, any>;
  parties: Record<string, any>;
  stageStatus?: { currentStageId?: string; completedStageIds?: string[] };
  created: string;
  updated: string;
  expand?: { template?: EngagementTemplate; members?: EngagementMember[]; owner?: EngagementMember };
}

export interface EngagementMember {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

export interface EngagementMilestone {
  id: string;
  engagement: string;
  label: string;
  stageId: string;
  owner: string;
  dueDate?: string;
  status: MilestoneStatus;
  source: string;
  reminder: string;
  remind: boolean;
  /** Days-before-due touchpoints for an incremental reminder (e.g. [7, 1, 0]). */
  reminderOffsets?: number[];
  reminderChannels?: string[];
  created: string;
  updated: string;
  expand?: { engagement?: Engagement };
}

// The reminder plan the schedule dialog sends: due date + incremental (or single)
// reminder touchpoints + channels. Mirrors milestonePlanRequest on the backend.
export interface MilestonePlan {
  label?: string;
  stageId?: string;
  dueDate?: string;        // YYYY-MM-DD; '' clears
  remind: boolean;
  offsets?: number[];      // days-before-due; [] => a single on-the-day reminder
  channels?: Array<'APP' | 'EMAIL' | 'PUSH' | 'SMS'>;
}

export function listEngagementTemplates(options: { filter?: string; sort?: string } = {}) {
  return pb.collection('EngagementTemplates').getFullList<EngagementTemplate>({
    sort: options.sort ?? 'name',
    filter: options.filter,
  });
}

export function getEngagementTemplate(id: string) {
  return pb.collection('EngagementTemplates').getOne<EngagementTemplate>(id);
}

// Whether the current user may edit/delete this playbook directly (SDK write rule
// is author-only). Firm colleagues can still refine an org playbook via Studio
// (upsert-by-name), and anyone can fork a global seed — those routes don't need
// this, they go through the chat tool.
export function canManageTemplate(t: EngagementTemplate): boolean {
  return !!pb.authStore.record && t.author === pb.authStore.record.id;
}

// Duplicate a playbook into a fresh, editable copy owned by the current user (in
// their firm scope if they have one). The write rule is author-only, so a copy is
// how a lawyer bases new work on a starter/colleague's playbook they can't edit.
export function duplicateEngagementTemplate(t: EngagementTemplate) {
  const rec = pb.authStore.record;
  return pb.collection('EngagementTemplates').create<EngagementTemplate>({
    name: `${t.name} (copy)`,
    description: t.description,
    organisation: rec?.organisation || '',
    author: rec?.id,
    isPublic: false,
    data: t.data,
  });
}

export function deleteEngagementTemplate(id: string) {
  return pb.collection('EngagementTemplates').delete(id);
}

// describeCompliance mirrors engagements.DescribeCompliance in the backend so the
// playbook library renders a recurring obligation in the same trust language the
// Studio review card uses. Keep in sync with practocore-backend/ai/engagements/describe.go.
export function describeCompliance(c: TemplateCompliance, fieldLabels: Record<string, string> = {}): string {
  const parts: string[] = [cadencePhrase(c.recurrence, c.periodMonths)];
  const anchor = anchorPhrase(c, fieldLabels);
  if (anchor) parts[0] += `, ${anchor}`;
  parts.push(c.reminder ? 'reminders on' : 'reminders off');
  parts.push(c.spawnOn === 'creation' ? 'starts when created' : 'starts when completed');
  return parts.join(' · ');
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function cadencePhrase(recurrence: ComplianceRecurrence, periodMonths?: number): string {
  switch (recurrence) {
    case 'weekly': return 'Weekly';
    case 'monthly': return 'Monthly';
    case 'quarterly': return 'Quarterly';
    case 'yearly': return 'Yearly';
    case 'custom': {
      const m = periodMonths ?? 0;
      if (m <= 0) return 'Yearly';
      if (m % 12 === 0) { const y = m / 12; return y === 1 ? 'Yearly' : `Every ${y} years`; }
      return m === 1 ? 'Monthly' : `Every ${m} months`;
    }
    default: return 'Yearly';
  }
}

function anchorPhrase(c: TemplateCompliance, fieldLabels: Record<string, string>): string {
  const a = c.anchor;
  if (!a) return '';
  if (a.type === 'anniversary') {
    const src = a.dateSource || 'completion';
    if (src === 'completion') return 'on the completion anniversary';
    if (src === 'target') return 'on the target-date anniversary';
    if (src.startsWith('field:')) {
      const label = fieldLabels[src.slice(6)];
      return label ? `on the anniversary of ${label}` : 'on the anniversary of a recorded date';
    }
    return 'on the completion anniversary';
  }
  if (a.type === 'fixed_calendar' && a.monthDay) {
    const [mm, dd] = a.monthDay.split('-').map((n) => parseInt(n, 10));
    if (mm >= 1 && mm <= 12 && dd) return `on ${dd} ${MONTHS[mm - 1]} each period`;
    return 'on a fixed calendar date';
  }
  return '';
}

export function listEngagements(page: number, perPage: number, options: { filter?: string; sort?: string } = {}) {
  return pb.collection('Engagements').getList<Engagement>(page, perPage, {
    sort: options.sort ?? '-created',
    filter: options.filter,
    expand: 'template,members',
  });
}

export function getEngagement(id: string) {
  return pb.collection('Engagements').getOne<Engagement>(id, { expand: 'template,members,owner' });
}

export function subscribeEngagement(id: string, callback: (data: any) => void) {
  return pb.collection('Engagements').subscribe(id, callback);
}

export function unsubscribeEngagement(id: string) {
  return pb.collection('Engagements').unsubscribe(id);
}

export function listMilestones(engagementId: string) {
  return pb.collection('EngagementMilestones').getFullList<EngagementMilestone>({
    filter: `engagement = '${engagementId}'`,
    sort: 'dueDate',
  });
}

export function updateMilestoneStatus(milestoneId: string, status: MilestoneStatus) {
  return pb.collection('EngagementMilestones').update<EngagementMilestone>(milestoneId, { status });
}

// Toggle a reminder on ANY dated milestone — not only the ones a playbook flagged
// (fix d). The backend's milestone hooks schedule/cancel the standalone reminder
// from this `remind` flag whenever it changes.
export function setMilestoneReminder(milestoneId: string, remind: boolean) {
  return pb.collection('EngagementMilestones').update<EngagementMilestone>(milestoneId, { remind });
}

// Add an ad-hoc milestone to an engagement (fix e: a "thing with a dated reminder"
// on a ceremony-free engagement). A future dueDate + remind schedules a reminder
// via the create hook.
export function addMilestone(engagementId: string, input: { label: string; dueDate?: string; remind?: boolean; stageId?: string }) {
  return pb.collection('EngagementMilestones').create<EngagementMilestone>({
    engagement: engagementId,
    label: input.label,
    dueDate: input.dueDate || undefined,
    remind: !!input.remind,
    stageId: input.stageId || '',
    status: 'pending',
    source: '',
  });
}

// Create a milestone AND schedule its (single or incremental) reminder in one call,
// with AI-written touchpoint wording. Goes through the gated endpoint rather than the
// SDK so the reminder series + copy are produced server-side.
export async function createMilestone(engagementId: string, plan: MilestonePlan) {
  const res = await fetch(`${SERVER_URL}/api/practocore/engagements/${engagementId}/milestones`, {
    method: 'POST',
    headers: { Authorization: pb.authStore.token, 'Content-Type': 'application/json' },
    body: JSON.stringify(plan),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || data?.error || `createMilestone failed (${res.status})`);
  return data.milestone as EngagementMilestone;
}

// Set/move a milestone's due date and (re)configure its reminder series. Returns the
// refreshed milestone.
export async function scheduleMilestone(engagementId: string, milestoneId: string, plan: MilestonePlan) {
  const res = await fetch(`${SERVER_URL}/api/practocore/engagements/${engagementId}/milestones/${milestoneId}/schedule`, {
    method: 'POST',
    headers: { Authorization: pb.authStore.token, 'Content-Type': 'application/json' },
    body: JSON.stringify(plan),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || data?.error || `scheduleMilestone failed (${res.status})`);
  return data.milestone as EngagementMilestone;
}

// Delete a milestone entirely (as opposed to marking it skipped). Goes straight
// through the SDK — a milestone is a leaf row, and the backend's after-delete hook
// cancels any reminder scheduled for it and re-derives the engagement's stages.
export function deleteMilestone(milestoneId: string) {
  return pb.collection('EngagementMilestones').delete(milestoneId);
}

// Milestones with a due date across every engagement the user can see, for the
// unified calendar "what's due" view. The collection's own membership read rule
// scopes this to the caller; skipped milestones are excluded, done ones kept so
// they render as completed (mirrors how reminders/deadlines behave).
export function listCalendarMilestones() {
  return pb.collection('EngagementMilestones').getFullList<EngagementMilestone>({
    filter: "dueDate != '' && status != 'skipped'",
    sort: 'dueDate',
    expand: 'engagement',
  });
}

export function subscribeMilestones(callback: (data: any) => void) {
  return pb.collection('EngagementMilestones').subscribe('*', callback);
}

export function unsubscribeMilestones() {
  return pb.collection('EngagementMilestones').unsubscribe('*');
}

// ── Compliance obligations (§3.4 compliance tail) ───────────────────────────
export type ComplianceStatus = 'active' | 'paused' | 'ended';
export type ComplianceRecurrence = 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom';

export interface ComplianceObligation {
  id: string;
  engagement: string;
  organisation: string;
  owner: string;
  label: string;
  recurrence: ComplianceRecurrence;
  periodMonths?: number;
  anchorDate?: string;
  nextDueDate?: string;
  status: ComplianceStatus;
  remind: boolean;
  reminder: string;
  source: string;
  created: string;
  updated: string;
  expand?: { engagement?: Engagement };
}

// ── Compliance filings (the per-occurrence register, fix c) ──────────────────
// One row per occurrence of an obligation — the durable, defensible record that a
// given cycle was filed (with date, reference and evidence) or lapsed.
export type FilingStatus = 'pending' | 'filed' | 'missed';

export interface ComplianceFiling {
  id: string;
  obligation: string;
  engagement: string;
  organisation: string;
  owner: string;
  label: string;
  dueDate?: string;
  status: FilingStatus;
  filedDate?: string;
  reference: string;
  note: string;
  evidence: string; // filename ('' if none)
  reminder: string;
  created: string;
  updated: string;
  expand?: { engagement?: Engagement; obligation?: ComplianceObligation };
}

// Every occurrence of one obligation, newest due first — the register history.
export function listObligationFilings(obligationId: string) {
  return pb.collection('ComplianceFilings').getFullList<ComplianceFiling>({
    filter: `obligation = '${obligationId}'`,
    sort: '-dueDate',
  });
}

// All still-open occurrences the user can see — the "what needs filing" worklist.
export function listPendingFilings() {
  return pb.collection('ComplianceFilings').getFullList<ComplianceFiling>({
    filter: "status = 'pending'",
    sort: 'dueDate',
    expand: 'engagement',
  });
}

// Resolve an evidence file to a downloadable URL. ComplianceFilings is a protected
// collection, so the URL needs a short-lived file token appended — hence async.
// Returns "" if the occurrence has no evidence attached.
export async function filingEvidenceUrl(filing: ComplianceFiling) {
  if (!filing.evidence) return '';
  const token = await pb.files.getToken();
  return pb.files.getURL(filing as any, filing.evidence, { token });
}

export interface FileComplianceInput {
  filedDate?: string; // YYYY-MM-DD; defaults to today server-side
  reference?: string;
  note?: string;
  evidence?: File;
}

// Record an occurrence as filed, with an optional evidence file (multipart). The
// backend opens the next occurrence on the statutory grid automatically.
export async function fileCompliance(filingId: string, input: FileComplianceInput) {
  const form = new FormData();
  if (input.filedDate) form.append('filedDate', input.filedDate);
  if (input.reference) form.append('reference', input.reference);
  if (input.note) form.append('note', input.note);
  if (input.evidence) form.append('evidence', input.evidence);
  const res = await fetch(`${SERVER_URL}/api/practocore/compliance/filings/${filingId}/file`, {
    method: 'POST',
    headers: { Authorization: pb.authStore.token },
    body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `fileCompliance failed (${res.status})`);
  }
  return res.json() as Promise<{ filing: string; status: string }>;
}

// Spawn an engagement's compliance obligations on demand — so a lawyer never has to
// fake-"complete" an engagement to start its recurring clock (fix b). Idempotent.
export async function spawnCompliance(engagementId: string) {
  const res = await fetch(`${SERVER_URL}/api/practocore/engagements/${engagementId}/compliance/spawn`, {
    method: 'POST',
    headers: { Authorization: pb.authStore.token },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `spawnCompliance failed (${res.status})`);
  }
  return res.json() as Promise<{ count: number }>;
}

// Active, dated obligations across every engagement the user can see — the
// calendar "what's due" source for recurring compliance.
export function listCalendarCompliance() {
  return pb.collection('ComplianceObligations').getFullList<ComplianceObligation>({
    filter: "status = 'active' && nextDueDate != ''",
    sort: 'nextDueDate',
    expand: 'engagement',
  });
}

// Every obligation (incl. paused) for the firm-wide Compliance Calendar page.
export function listAllCompliance() {
  return pb.collection('ComplianceObligations').getFullList<ComplianceObligation>({
    sort: 'nextDueDate',
    expand: 'engagement',
  });
}

export function listEngagementCompliance(engagementId: string) {
  return pb.collection('ComplianceObligations').getFullList<ComplianceObligation>({
    filter: `engagement = '${engagementId}'`,
    sort: 'nextDueDate',
  });
}

export function updateComplianceStatus(id: string, status: ComplianceStatus) {
  return pb.collection('ComplianceObligations').update<ComplianceObligation>(id, { status });
}

export function subscribeCompliance(callback: (data: any) => void) {
  return pb.collection('ComplianceObligations').subscribe('*', callback);
}

export function unsubscribeCompliance() {
  return pb.collection('ComplianceObligations').unsubscribe('*');
}

export interface CreateEngagementInput {
  templateId: string;
  name: string;
  targetDate?: string;
  fieldValues?: Record<string, any>;
  parties?: Record<string, any>;
  members?: string[];
}

export async function createEngagement(input: CreateEngagementInput) {
  const res = await fetch(`${SERVER_URL}/api/practocore/engagements`, {
    method: 'POST',
    headers: {
      Authorization: pb.authStore.token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `createEngagement failed (${res.status})`);
  }
  return res.json() as Promise<{ engagement: { id: string; name: string }; milestoneIds: string[] }>;
}

export function updateEngagement(id: string, data: Partial<Pick<Engagement, 'name' | 'status' | 'targetDate' | 'fieldValues' | 'parties' | 'stageStatus' | 'members'>>) {
  return pb.collection('Engagements').update<Engagement>(id, data, { expand: 'template,members,owner' });
}

// Deletion goes through a gated custom endpoint (not the SDK) because an
// engagement's milestones are first-class rows on a non-cascade relation — the
// endpoint sweeps them alongside the engagement atomically so none are orphaned.
export async function deleteEngagement(id: string) {
  const res = await fetch(`${SERVER_URL}/api/practocore/engagements/${id}`, {
    method: 'DELETE',
    headers: { Authorization: pb.authStore.token },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `deleteEngagement failed (${res.status})`);
  }
  return res.json() as Promise<{ deleted: string }>;
}

// Lawyers/members are a plain relation on the Engagements row, edited directly
// through the SDK (the collection's own owner/org access rule governs who may
// write). We set the whole array; the owner is always kept so they never lose
// access. Returns the refreshed engagement with members/owner expanded.
export function setEngagementMembers(id: string, memberIds: string[], ownerId: string) {
  const members = Array.from(new Set([ownerId, ...memberIds])).filter(Boolean);
  return updateEngagement(id, { members });
}
