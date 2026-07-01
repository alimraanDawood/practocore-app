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
  type: 'relative' | 'absolute' | 'recurring';
  days?: number;
  date?: string;
  recurrence?: string;
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
  isPublic: boolean;
  data: {
    sections: TemplateSection[];
    roles: TemplateRole[];
    stages: TemplateStage[];
    milestones: TemplateMilestone[];
    documents: TemplateDocument[];
    compliance: any[];
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
  expand?: { template?: EngagementTemplate };
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
  created: string;
  updated: string;
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

export function listEngagements(page: number, perPage: number, options: { filter?: string; sort?: string } = {}) {
  return pb.collection('Engagements').getList<Engagement>(page, perPage, {
    sort: options.sort ?? '-created',
    filter: options.filter,
    expand: 'template',
  });
}

export function getEngagement(id: string) {
  return pb.collection('Engagements').getOne<Engagement>(id, { expand: 'template' });
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

export function updateEngagement(id: string, data: Partial<Pick<Engagement, 'name' | 'status' | 'targetDate' | 'fieldValues' | 'parties' | 'stageStatus'>>) {
  return pb.collection('Engagements').update<Engagement>(id, data);
}
