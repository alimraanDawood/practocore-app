import { type RecordModel, type RecordSubscription } from 'pocketbase';
import type {
  DeadlineTemplateRecord,
  EnhancedTemplate,
  TemplateCategoryFilter,
  TemplateFormData
} from '~/lib/types/template';
import { enhanceTemplate } from '~/lib/types/template';

import { pb as pocketbase, SERVER_URL } from '~/lib/pocketbase';


/**
 * Build PocketBase filter from category filter object
 */
function buildFilterString(filter: TemplateCategoryFilter): string {
  const filters: string[] = [];

  if (filter.country?.length) {
    const countryFilter = filter.country.map(c => `country = '${c}'`).join(' || ');
    filters.push(`(${countryFilter})`);
  }

  if (filter.practiceArea?.length) {
    const practiceFilter = filter.practiceArea.map(p => `practiceArea = '${p}'`).join(' || ');
    filters.push(`(${practiceFilter})`);
  }

  if (filter.courtLevel?.length) {
    const courtFilter = filter.courtLevel.map(c => `courtLevel = '${c}'`).join(' || ');
    filters.push(`(${courtFilter})`);
  }

  if (filter.complexity?.length) {
    const complexityFilter = filter.complexity.map(c => `complexity = '${c}'`).join(' || ');
    filters.push(`(${complexityFilter})`);
  }

  if (filter.status?.length) {
    const statusFilter = filter.status.map(s => `status = '${s}'`).join(' || ');
    filters.push(`(${statusFilter})`);
  }

  if (filter.isPublic !== undefined) {
    filters.push(`isPublic = ${filter.isPublic}`);
  }

  if (filter.searchQuery) {
    const query = filter.searchQuery.replace(/'/g, "\\'");
    filters.push(`(name ~ '${query}' || description ~ '${query}' || matterType ~ '${query}')`);
  }

  return filters.join(' && ');
}

/**
 * Get all templates with optional filtering
 */
export async function getAllTemplates(filter?: TemplateCategoryFilter): Promise<EnhancedTemplate[]> {
  pocketbase.autoCancellation(false);

  const options: any = {
    expand: 'author',
    sort: '-created',
  };

  if (filter) {
    const filterString = buildFilterString(filter);
    if (filterString) {
      options.filter = filterString;
    }
  }

  const result = await pocketbase.collection('DeadlineTemplates').getFullList(options);
  pocketbase.autoCancellation(true);

  return result.map(record => enhanceTemplate(record as DeadlineTemplateRecord));
}

/**
 * Create a new template
 */
export async function createTemplate(options: TemplateFormData): Promise<DeadlineTemplateRecord> {
  return pocketbase.collection('DeadlineTemplates').create(options);
}

/**
 * Get paginated templates with filtering
 */
export async function getTemplates(
  page: number,
  numPerPage: number,
  filter?: TemplateCategoryFilter,
  sortBy: string = '-created'
): Promise<{ items: EnhancedTemplate[], page: number, perPage: number, totalItems: number, totalPages: number }> {
  pocketbase.autoCancellation(false);

  const options: any = {
    expand: 'author',
    sort: sortBy,
  };

  if (filter) {
    const filterString = buildFilterString(filter);
    if (filterString) {
      options.filter = filterString;
    }
  }

  const result = await pocketbase.collection('DeadlineTemplates').getList(page, numPerPage, options);
  pocketbase.autoCancellation(true);

  return {
    items: result.items.map(record => enhanceTemplate(record as DeadlineTemplateRecord)),
    page: result.page,
    perPage: result.perPage,
    totalItems: result.totalItems,
    totalPages: result.totalPages,
  };
}

/**
 * Get a single template by ID
 */
export async function getTemplate(id: string): Promise<EnhancedTemplate> {
  const record = await pocketbase.collection('DeadlineTemplates').getOne(id, { expand: 'author' });
  return enhanceTemplate(record as DeadlineTemplateRecord);
}

/**
 * Update a template
 */
export async function updateTemplate(id: string, data: Partial<TemplateFormData>): Promise<DeadlineTemplateRecord> {
  return pocketbase.collection('DeadlineTemplates').update(id, data);
}

/**
 * Subscribe to template changes
 */
export function subscribeToTemplates(callback: Function) {
  return pocketbase.collection('DeadlineTemplates').subscribe('*', callback);
}

/**
 * Unsubscribe from template changes
 */
export function unsubscribeToTemplates() {
  return pocketbase.collection('DeadlineTemplates').unsubscribe('*');
}

/**
 * Search templates by keyword
 */
export async function searchTemplates(query: string, limit: number = 20): Promise<EnhancedTemplate[]> {
  const filter: TemplateCategoryFilter = {
    searchQuery: query,
    isPublic: true, // Only search public templates
  };

  const result = await getTemplates(1, limit, filter, 'order');
  return result.items;
}

// ── Procedure stewardship ────────────────────────────────────────────────────
// The litigation counterpart of the playbook actions in services/engagements.
// The rules these mirror live in migrations 1784000000 (read/create) and
// 1784030000 (update/delete: author, or a canManageTemplates steward in the same
// firm), plus the provenance gate in internal/deadlinev2/provenance.go.

/**
 * Whether the current user may edit, delete or restore this procedure.
 *
 * A PractoCore-signed procedure is never editable by a firm — the route for
 * those is extending, not editing — so this returns false regardless of who is
 * asking. Mirrors procedureEditableBy() in the backend, which is the boundary.
 */
export function isSignedProcedure(t: RecordModel): boolean {
  return !!t.isPublic || (t.provenance ?? 'practocore') === 'practocore';
}

export function canManageProcedure(t: RecordModel, hasManagePermission = false): boolean {
  const me = pocketbase.authStore.record;
  if (!me) return false;
  if (t.isPublic || (t.provenance ?? 'practocore') === 'practocore') return false;
  if (t.author === me.id) return true;
  const org = t.organisation ?? '';
  // A personal procedure (empty organisation) belongs to its author alone — the
  // empty-string match that would otherwise let any solo user in is the same leak
  // migration 1784000000 closed on the read rule.
  if (!org || org !== (me.organisation ?? '')) return false;
  return hasManagePermission;
}

/**
 * Duplicate a procedure into an editable firm copy owned by the current user.
 *
 * What "a copy" means depends on who authored the original:
 *
 * - A FIRM procedure copies its content, as you would expect.
 * - A PRACTOCORE one cannot: a firm-provenance record holding our statutory
 *   deadlines and their citations is exactly what the provenance gate refuses
 *   ("your firm's procedure cannot state what the law requires"). The copy is
 *   instead an EXTENSION of it — `{extends: {templateId}, ir: {}}`, the bundle
 *   shape templateext.ParseBundle/Compose already accept — which composes to the
 *   same timeline while leaving the statutory spine ours to maintain and update.
 *   The firm then adds its own steps on top in Studio.
 */
export function duplicateTemplate(t: RecordModel): Promise<DeadlineTemplateRecord> {
  const me = pocketbase.authStore.record;
  const signed = t.isPublic || (t.provenance ?? 'practocore') === 'practocore';
  return pocketbase.collection('DeadlineTemplates').create({
    name: signed ? `${t.name} (firm version)` : `${t.name} (copy)`,
    template: signed
      ? { extends: { templateId: t.id, version: t.version || '' }, ir: {} }
      : t.template,
    version: t.version,
    status: t.status || 'draft',
    provenance: 'firm',
    isPublic: false,
    author: me?.id,
    authorName: me?.name ?? '',
    organisation: me?.organisation || '',
    matterType: t.matterType,
    courtLevel: t.courtLevel,
    practiceArea: t.practiceArea,
    country: t.country,
    caseNumberLabel: t.caseNumberLabel,
  });
}

export function deleteTemplate(id: string): Promise<boolean> {
  return pocketbase.collection('DeadlineTemplates').delete(id);
}

// ── Procedure version history ────────────────────────────────────────────────
// Every save of a procedure appends a snapshot (backend record hook), so an edit
// that went wrong is recoverable. Restoring writes an old snapshot back onto the
// procedure, which appends another snapshot — history only grows, and restoring
// is itself undoable. See internal/deadlinev2/procedureversions.go.

export interface ProcedureVersion {
  id: string;
  seq: number;
  name: string;
  version: string;
  authorName: string;
  note: string;
  created: string;
}

export async function listProcedureVersions(procedureId: string): Promise<ProcedureVersion[]> {
  const res = await fetch(`${SERVER_URL}/api/practocore/procedures/${procedureId}/versions`, {
    headers: { Authorization: pocketbase.authStore.token },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `listProcedureVersions failed (${res.status})`);
  }
  const data = await res.json() as { versions: ProcedureVersion[] };
  return data.versions ?? [];
}

// Restore goes through a route rather than an SDK update: the snapshot collection
// is not client-writable at all, and the route applies the same author-or-steward
// check before saving as the app.
export async function restoreProcedureVersion(procedureId: string, versionId: string) {
  const res = await fetch(
    `${SERVER_URL}/api/practocore/procedures/${procedureId}/restore/${versionId}`,
    { method: 'POST', headers: { Authorization: pocketbase.authStore.token } },
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `restoreProcedureVersion failed (${res.status})`);
  }
  return res.json() as Promise<{ success: boolean; name: string; seq: number }>;
}
