import { type RecordModel, type RecordSubscription } from 'pocketbase';
import {options} from "kolorist";
import { pb as pocketbase, SERVER_URL} from '~/lib/pocketbase';
import { track } from '~/utils/analytics';


/**
 * A matter's lifecycle state. Empty is treated as 'active' everywhere: rows written
 * before the status migration must read as live, never as closed.
 */
export type MatterStatus = 'active' | 'closed' | 'archived';

/** Lifecycle values the matters list can filter by; 'all' disables the filter. */
export type MatterStatusFilter = MatterStatus | 'all';

export const MATTER_STATUS_LABELS: Record<MatterStatus, string> = {
    active: 'Active',
    closed: 'Closed',
    archived: 'Archived',
};

/** Reads a matter's status, defaulting a missing or empty value to 'active'. */
export function matterStatusOf(matter: any): MatterStatus {
    const s = matter?.status;
    return s === 'closed' || s === 'archived' ? s : 'active';
}

/** One opposing-counsel entry as stored on a matter. */
export interface OpposingCounsel {
    id?: string;
    name: string;
    firm?: string;
    email?: string;
    phone?: string;
    address?: string;
}

/**
 * Reads a matter's opposingCounsel as a list.
 *
 * The column has historically held two shapes: the list of lawyer objects the
 * editor writes, and a bare string that an older AI write path stored. Rendering
 * a string with v-for iterates its CHARACTERS — one empty card per letter — so
 * every read goes through here. Mirrors loadCounsel in the Go tools package; the
 * value is repaired in the database the next time the matter's counsel is saved.
 */
export function coerceOpposingCounsel(value: any): OpposingCounsel[] {
    if (!value) return [];
    if (typeof value === 'string') {
        const name = value.trim();
        return name ? [{ name }] : [];
    }
    if (!Array.isArray(value)) return [];
    return value.filter((e) => e && typeof e === 'object' && typeof e.name === 'string');
}

/**
 * Escapes a value for interpolation into a PocketBase filter string literal.
 * Without it an apostrophe in a case name ("O'Brien v Nakato") closes the literal
 * early and the whole filter is rejected or silently mis-parsed.
 */
export function escapeFilterValue(value: string): string {
    return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/**
 * Sets a matter's lifecycle status. Closing records when and why; reopening clears
 * both. Reminder stand-down is the backend's job (see set_matter_status) — this is
 * the direct-manipulation path, which only moves the file's own state.
 */
export async function setMatterStatus(matterId: string, status: MatterStatus, reason?: string) {
    const data: Record<string, any> = { status };
    if (status === 'active') {
        data.closedAt = null;
        data.closureReason = '';
    } else {
        data.closedAt = new Date().toISOString().slice(0, 10);
        if (reason !== undefined) data.closureReason = reason;
    }
    return updateMatter(matterId, data);
}

export async function getMatters(page: number, perPage: number, options: { filter?: string, sort?: string, expand?: string }) {
    // Use optimized backend route that fetches everything in one request
    const params = new URLSearchParams({
        page: page.toString(),
        perPage: perPage.toString(),
    });

    if (options.filter) params.set('filter', options.filter);
    if (options.sort) params.set('sort', options.sort);

    const res = await fetch(`${SERVER_URL}/api/practocore/matters?${params.toString()}`, {
        method: 'GET',
        headers: {
            'Authorization': pocketbase.authStore.token,
            'Content-Type': 'application/json'
        }
    });
    if (!res.ok) {
        // Never let an error body (e.g. {error:'...'}) be treated as a matters list.
        const body = await res.text().catch(() => '');
        throw new Error(`getMatters failed (${res.status}): ${body}`);
    }
    return res.json();
}

export async function getAllDeadlines(options: Object) {
    return pocketbase.collection('Deadlines').getFullList({ ...options });
}

export async function getDeadline(deadlineId: string, options = {}) {
    return pocketbase.collection('Deadlines').getOne(deadlineId, options);
}

export async function getDeadlineReminder(deadlineReminderId: string, options = {}) {
    return pocketbase.collection('DeadlineReminders').getOne(deadlineReminderId, options);
}


export async function getStatistics() {
    return fetch(`${SERVER_URL}/api/practocore/statistics`, {
        method: 'GET',
        headers: {
            'Authorization': pocketbase.authStore.token,
            'Content-Type': 'application/json'
        }
    }).then((e) => e.json());
}

export async function createAdjournment(options: Object) {
    return pocketbase.collection('DeadlineAdjournments').create(options);
}


export async function createMatter(options: {
    name: string,
    caseNumber: string,
    personal: boolean,
    members?: string[],
    templateId: string,
    date: string,
    // L6: which entry anchor `date` answers ("we filed it" vs "we were served
    // with it"). Omitted or empty means the template's default anchor.
    triggerId?: string,
    fieldValues: any[],
    parties?: Record<string, any[]>,
    representing?: { role_id: string, party_member_ids: string[] },
    triggerStatus?: 'confirmed' | 'provisional'
}) {
    const res = await fetch(`${SERVER_URL}/api/de/v1/create-matter`, {
        method: 'POST',
        body: JSON.stringify(options),
        headers: {
            'Authorization': pocketbase.authStore.token,
            'Content-Type': 'application/json'
        }
    });
    if (!res.ok) {
        // Never let an error body ({error:'...'}) be treated as a created matter —
        // otherwise callers report a false "success" and the matter is never created.
        const body = await res.text().catch(() => '');
        throw new Error(`createMatter failed (${res.status}): ${body}`);
    }
    track('matter_created', {
        template_id: options.templateId,
        personal: options.personal,
        members: options.members?.length ?? 0,
        source: 'form',
    });
    return res.json();
}

export async function createMatterFromDates(options: {
    name: string,
    caseNumber: string,
    personal: boolean,
    members?: string[],
    templateId: string,
    date: string,
    fieldValues: any[],
    deadlineDates: Record<string, string>,
    parties?: Record<string, any[]>,
    representing?: { role_id: string, party_member_ids: string[] }
}) {
    return fetch(`${SERVER_URL}/api/de/v1/create-matter-from-dates`, {
        method: 'POST',
        body: JSON.stringify(options),
        headers: {
            'Authorization': pocketbase.authStore.token,
            'Content-Type': 'application/json'
        }
    }).then((e) => {
        track('matter_created', { template_id: options.templateId, personal: options.personal, source: 'import_dates' });
        return e.json();
    });
}

export async function createApplication(matterId: string, options: {
    name: string,
    caseNumber: string,
    personal: boolean,
    members?: string[],
    templateId: string,
    date: string,
    fieldValues: any[],
    parties?: Record<string, any[]>,  // Party data organized by role ID
    representing?: { role_id: string, party_member_ids: string[] },  // Representation data
    inheritParties?: boolean,
    applicationType?: string,
    triggerStatus?: 'confirmed' | 'provisional'
}) {
    const res = await fetch(`${SERVER_URL}/api/practocore/create-application/${matterId}`, {
        method: 'POST',
        body: JSON.stringify(options),
        headers: {
            'Authorization': pocketbase.authStore.token,
            'Content-Type': 'application/json'
        }
    });
    if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`createApplication failed (${res.status}): ${body}`);
    }
    return res.json();
}

export async function updateMatter(matterId: string, data: any) {
    return pocketbase.collection('Matters').update(matterId, data);
}

export async function deleteMatter(matterId: string) {
    return pocketbase.collection('Matters').delete(matterId);
}

export async function subscribeToMatters(fn: (data: RecordSubscription<RecordModel>) => void) {
    return pocketbase.collection('Matters').subscribe('*', fn)
}

export function subscribeToMatter(matterId: string, fn: (data: RecordSubscription<RecordModel>) => void) {
    return pocketbase.collection('Matters').subscribe(matterId, fn)
}

export function unsubscribeToMatters() {
    return pocketbase.collection('Matters').unsubscribe('*');
}

export function unsubscribeToMatter(matterId: string) {
    return pocketbase.collection('Matters').unsubscribe(matterId);
}

export async function getMatter(matterId: string, options: Object) {
    // Use optimized backend route that fetches everything in one request
    const res = await fetch(`${SERVER_URL}/api/practocore/matters/${matterId}`, {
        method: 'GET',
        headers: {
            'Authorization': pocketbase.authStore.token,
            'Content-Type': 'application/json'
        }
    });
    if (!res.ok) {
        // Never let an error body (403/404/etc.) be cached as a matter — that poisons the store.
        const body = await res.text().catch(() => '');
        throw new Error(`getMatter failed (${res.status}): ${body}`);
    }
    return res.json();
}

export async function updateDeadline(deadlineId: string, options: Object) {
    return pocketbase.collection('Deadlines').update(deadlineId, options);
}



/**
 * The kinds of proof a completed step can carry. Mirrors the server's
 * `evidenceKinds` (internal/deadlinev2/evidence.go) — an unknown value is
 * refused there rather than silently stored.
 *
 * Note there is no "service" slot beyond this list: whether service is its own
 * step, a milestone, or part of another step is decided by the procedure
 * template, not here.
 */
export const EVIDENCE_KINDS = ['filed', 'receipt', 'service', 'record', 'other'] as const;
export type EvidenceKind = typeof EVIDENCE_KINDS[number];

export const EVIDENCE_KIND_LABELS: Record<EvidenceKind, string> = {
    filed: 'Filed document',
    receipt: 'Registry receipt',
    service: 'Proof of service',
    record: 'Record / bundle',
    other: 'Other',
};

/**
 * One artefact of proof. One row per artefact, not one per completion: a step
 * can produce a filed memorandum AND a registry receipt.
 *
 * `document` is an AiVaultDocuments id — a reference to the vault row, never a
 * second copy of the file. The server refuses a document belonging to another
 * matter.
 */
export interface DeadlineEvidenceInput {
    kind: EvidenceKind;
    /** AiVaultDocuments id, scoped to this matter. */
    document?: string;
    /** Court receipt / registration number. */
    reference?: string;
    note?: string;
    /** Users id — who CHECKED, as distinct from who clicked complete. */
    verifiedBy?: string;
    /** YYYY-MM-DD. */
    verifiedAt?: string;
}

/**
 * Drops artefacts the server would refuse anyway: a row with no document, no
 * reference and no note is not proof of anything, and sending it would fail the
 * whole completion.
 */
export function usableEvidence(rows: DeadlineEvidenceInput[]): DeadlineEvidenceInput[] {
    return (rows || []).filter(r => (r.document || '').trim() || (r.reference || '').trim() || (r.note || '').trim());
}

/**
 * What the matter's PROCEDURE says a step should produce. Declared on the
 * template, not on the deadline row: the row is instance state that gets
 * recalculated, while what a step is supposed to yield belongs to the procedure.
 * An empty list means the template declares nothing — most predate the field —
 * not that the step produces nothing.
 */
export interface ExpectedArtefact {
    kind: EvidenceKind;
    label: string;
    /** A correctly-run step may legitimately lack this one, so its absence is not a gap. */
    optional?: boolean;
}

export async function getExpectedArtefacts(deadlineId: string, isEvent = false): Promise<ExpectedArtefact[]> {
    if (!deadlineId) return [];
    const url = `${SERVER_URL}/api/practocore/deadlines/${deadlineId}/expected-artefacts${isEvent ? '?type=events' : ''}`;
    const res = await fetch(url, { headers: { 'Authorization': pocketbase.authStore.token } });
    if (!res.ok) return [];
    const body = await res.json().catch(() => ({}));
    return body?.expected || [];
}

/** One recorded artefact of proof, as it comes back from the collection. */
export interface DeadlineEvidenceRecord extends RecordModel {
    deMatter: string;
    seq: number;
    target: string;
    deadline: string;
    event: string;
    matter: string;
    kind: EvidenceKind;
    document: string;
    reference: string;
    verifiedBy: string;
    verifiedAt: string;
    note: string;
    /**
     * The event this proves was later superseded by a correction. The row is
     * kept, never deleted — what the file recorded before the correction is part
     * of the file — so it reads as history rather than as current proof.
     */
    superseded: boolean;
    expand?: { document?: any; verifiedBy?: any };
}

/**
 * All proof recorded on one matter, keyed by the deadline or event row it hangs
 * off. The collection is read-only to clients (it is written only inside the
 * transaction that appends the event it proves), so this is a plain read.
 */
export async function listDeadlineEvidence(matterIds: string | string[]): Promise<Record<string, DeadlineEvidenceRecord[]>> {
    // Interlocutory applications are child matters with their own ids, so a
    // timeline showing a matter and its applications has to ask for several.
    const ids = (Array.isArray(matterIds) ? matterIds : [matterIds]).filter(Boolean);
    if (!ids.length) return {};
    const rows = await pocketbase.collection('DeadlineEvidence').getFullList<DeadlineEvidenceRecord>({
        filter: ids.map(id => `matter = "${id}"`).join(' || '),
        expand: 'document,verifiedBy',
        sort: 'created',
    });
    const byRow: Record<string, DeadlineEvidenceRecord[]> = {};
    for (const row of rows) {
        const key = row.deadline || row.event;
        if (!key) continue;
        (byRow[key] ||= []).push(row);
    }
    return byRow;
}

export async function fulfillDeadline(deadline: Deadline, date: string, evidence: DeadlineEvidenceInput[] = []) {
    const usable = usableEvidence(evidence);
    return await fetch(`${SERVER_URL}/api/practocore/deadlines/apply-action/${deadline.id}/deadlines`, {
        method: 'POST',
        body: JSON.stringify({
            action: {
                action: "FULFILL",
                meta: {
                    targetId: deadline?.t_id,
                    fulfilledDate: date,
                    // Omitted entirely when empty: the server refuses evidence on
                    // actions that do not discharge a step, and an empty array is
                    // not a claim that anything was captured.
                    ...(usable.length ? { evidence: usable } : {}),
                }
            }
        }),
        headers: {
            'Authorization': pocketbase.authStore.token,
            'Content-Type': 'application/json'
        }
    }).then(readActionResponse)
}

/**
 * Reads an apply-action response, THROWING the server's own message on a
 * refusal.
 *
 * The handlers answer a rejected action with 400 + `{"error": "..."}`, which a
 * bare `.then(e => e.json())` resolves happily — so the caller reported success
 * for an action the server declined. That matters most for evidence: the
 * refusals exist precisely so a completion cannot look better proven than it
 * is, and swallowing them would undo the point.
 *
 * The sibling mutators here (fulfillEvent, adjournDeadline, overrideDeadline)
 * still swallow theirs.
 */
async function readActionResponse(res: Response) {
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body?.error) {
        throw new Error(body?.error || body?.message || `Request failed (${res.status})`);
    }
    return body;
}

export async function fulfillEvent(event: any, date: string) {
    console.log(event);
    return await fetch(`${SERVER_URL}/api/practocore/deadlines/apply-action/${event.id}/events`, {
        method: 'POST',
        body: JSON.stringify({
            action: {
                action: "FULFILL_EVENT",
                meta: {
                    targetId: event?.t_id,
                    fulfilledDate: date,
                }
            }
        }),
        headers: {
            'Authorization': pocketbase.authStore.token,
            'Content-Type': 'application/json'
        }
    }).then((e) => e.json())
}

/**
 * Correct a deadline whose computed date is not the real date.
 *
 * Distinct from adjournDeadline: nothing was adjourned. The record and the
 * notification say "corrected", not "adjourned", so a lawyer fixing a date the
 * registry gave orally no longer has to file a false adjournment to do it. The
 * reason is mandatory — it is the audit record explaining why this date stopped
 * matching the rule the timeline still cites.
 */
export async function overrideDeadline(deadline: Deadline, date: string, reason: string) {
    return await fetch(`${SERVER_URL}/api/practocore/deadlines/apply-action/${deadline.id}/deadlines`, {
        method: 'POST',
        body: JSON.stringify({
            action: {
                action: "OVERRIDE",
                meta: {
                    targetId: deadline?.t_id,
                    overriddenDate: date,
                    reason: reason,
                }
            }
        }),
        headers: {
            'Authorization': pocketbase.authStore.token,
            'Content-Type': 'application/json'
        }
    }).then((e) => e.json())
}

export async function adjournDeadline(deadline: Deadline, date: string, force = false, reason = "") {
    return await fetch(`${SERVER_URL}/api/practocore/deadlines/apply-action/${deadline.id}/deadlines`, {
        method: 'POST',
        body: JSON.stringify({
            action: {
                action: "ADJOURN",
                meta: {
                    targetId: deadline?.t_id,
                    adjournedDate: date,
                    force: force,
                    reason: reason,
                }
            }
        }),
        headers: {
            'Authorization': pocketbase.authStore.token,
            'Content-Type': 'application/json'
        }
    }).then((e) => e.json())
}

/**
 * Detail fields on a matter. `fieldValues` holds the values for BOTH the
 * blueprint's fields and the firm's own ad-hoc ones; `extraFields` holds the
 * ad-hoc DEFINITIONS. Written through the collection's own update rule (owner or
 * member), the same way engagements do it — no custom endpoint, because nothing
 * here touches the deadline engine.
 */
export async function updateMatterFields(
    matterId: string,
    data: { fieldValues: Record<string, any>; extraFields: any[] },
) {
    return pocketbase.collection('Matters').update(matterId, data);
}

/**
 * Ad-hoc deadlines — rows the firm added to a matter itself (origin: 'adhoc'),
 * as opposed to the court deadlines generated from the matter's procedure.
 * Only ad-hoc rows can be edited or deleted; the backend refuses the rest.
 * Renaming is the exception and works on every row — see renameDeadline below.
 */
export interface AdhocDeadlineInput {
    name: string
    date?: string
    description?: string
    note?: string
    assignees?: string[]
    reminderOffsets?: number[]
}

export async function createAdhocDeadline(matterId: string, input: AdhocDeadlineInput) {
    return await fetch(`${SERVER_URL}/api/practocore/matters/${matterId}/deadlines`, {
        method: 'POST',
        body: JSON.stringify(input),
        headers: {
            'Authorization': pocketbase.authStore.token,
            'Content-Type': 'application/json'
        }
    }).then((e) => e.json())
}

export async function updateAdhocDeadline(deadlineId: string, input: Partial<AdhocDeadlineInput>) {
    return await fetch(`${SERVER_URL}/api/practocore/deadlines/adhoc/${deadlineId}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
        headers: {
            'Authorization': pocketbase.authStore.token,
            'Content-Type': 'application/json'
        }
    }).then((e) => e.json())
}

export async function deleteAdhocDeadline(deadlineId: string) {
    return await fetch(`${SERVER_URL}/api/practocore/deadlines/adhoc/${deadlineId}`, {
        method: 'DELETE',
        headers: {
            'Authorization': pocketbase.authStore.token,
            'Content-Type': 'application/json'
        }
    }).then((e) => e.json())
}

export async function completeAdhocDeadline(deadlineId: string, undo = false) {
    return await fetch(`${SERVER_URL}/api/practocore/deadlines/adhoc/${deadlineId}/complete`, {
        method: 'POST',
        body: JSON.stringify({ undo }),
        headers: {
            'Authorization': pocketbase.authStore.token,
            'Content-Type': 'application/json'
        }
    }).then((e) => e.json())
}

/**
 * Rename any deadline — statutory, court or ad-hoc alike.
 *
 * Separate from updateAdhocDeadline because it is not an ad-hoc operation: it
 * writes `label`, a display override, and never `name`. The rule's own wording
 * (or the registry's, for a court sitting) stays on the row, which is what keeps
 * this safe on a deadline nobody may otherwise touch. Pass an empty string to
 * clear the override and go back to the canonical name.
 */
export async function renameDeadline(deadlineId: string, label: string) {
    return await fetch(`${SERVER_URL}/api/practocore/deadlines/label/${deadlineId}`, {
        method: 'PATCH',
        body: JSON.stringify({ label }),
        headers: {
            'Authorization': pocketbase.authStore.token,
            'Content-Type': 'application/json'
        }
    }).then((e) => e.json())
}

/**
 * Annotate any deadline — statutory, court or ad-hoc alike.
 *
 * Same reasoning as renameDeadline: a note changes no date and nothing computes
 * with it, so it is safe on a row the firm does not own. Until this existed the
 * only way to write `note` was the ad-hoc PATCH, which refuses precisely the
 * rows a lawyer most wants to annotate. Pass an empty string to clear it.
 */
export async function annotateDeadline(deadlineId: string, note: string) {
    return await fetch(`${SERVER_URL}/api/practocore/deadlines/note/${deadlineId}`, {
        method: 'PATCH',
        body: JSON.stringify({ note }),
        headers: {
            'Authorization': pocketbase.authStore.token,
            'Content-Type': 'application/json'
        }
    }).then((e) => e.json())
}

/**
 * Court hearings (origin: 'court') the firm has hidden.
 *
 * Hiding, not deleting: ECCMIS re-sends its sittings twice a day, so removing
 * the row on its own would last until the next sync. The backend records a
 * tombstone against the sitting's identity and the sync skips it — which is
 * what makes the removal mean anything, and what makes it reversible.
 */
export interface HiddenHearing {
    id: string
    name: string
    date: string
    hiddenBy: string
    hiddenAt: string
}

export async function hideCourtDeadline(deadlineId: string, note = '') {
    return await fetch(`${SERVER_URL}/api/practocore/deadlines/court/${deadlineId}`, {
        method: 'DELETE',
        body: JSON.stringify({ note }),
        headers: {
            'Authorization': pocketbase.authStore.token,
            'Content-Type': 'application/json'
        }
    }).then((e) => e.json())
}

export async function listHiddenHearings(matterId: string): Promise<{ hidden: HiddenHearing[] }> {
    return await fetch(`${SERVER_URL}/api/practocore/matters/${matterId}/hidden-hearings`, {
        headers: { 'Authorization': pocketbase.authStore.token }
    }).then((e) => e.json())
}

export async function restoreHiddenHearing(matterId: string, hiddenId: string) {
    return await fetch(`${SERVER_URL}/api/practocore/matters/${matterId}/hidden-hearings/${hiddenId}/restore`, {
        method: 'POST',
        headers: {
            'Authorization': pocketbase.authStore.token,
            'Content-Type': 'application/json'
        }
    }).then((e) => e.json())
}

export function subscribeToDeadlines(fn: (data: RecordSubscription<RecordModel>) => void) {
    return pocketbase.collection('Deadlines').subscribe('*', fn);
}

export function subscribeToDeadline(deadlineId: string, fn: (data: RecordSubscription<RecordModel>) => void) {
    return pocketbase.collection('Deadlines').subscribe(deadlineId, fn);
}

export function unsubscribeToDeadlines() {
    return pocketbase.collection('Deadlines').unsubscribe('*');
}

export function unsubscribeToDeadline(deadlineId: string) {
    return pocketbase.collection('Deadlines').unsubscribe(deadlineId);
}

export function unsubscribeToAllDeadlines() {
    return pocketbase.collection('Deadlines').unsubscribe();
}

export async function addMemberToMatter(matterId: string, userId: string) {
    return fetch(`${SERVER_URL}/api/practocore/matters/${matterId}/members/add`, {
        method: 'POST',
        body: JSON.stringify({ userId }),
        headers: {
            'Authorization': pocketbase.authStore.token,
            'Content-Type': 'application/json'
        }
    }).then((e) => e.json());
}

export async function removeMemberFromMatter(matterId: string, userId: string) {
    return fetch(`${SERVER_URL}/api/practocore/matters/${matterId}/members/remove`, {
        method: 'POST',
        body: JSON.stringify({ userId }),
        headers: {
            'Authorization': pocketbase.authStore.token,
            'Content-Type': 'application/json'
        }
    }).then((e) => e.json());
}

/**
 * Promote a member to supervisor status
 * @param matterId - Matter ID
 * @param userId - User ID to promote
 */
export async function promoteMemberToSupervisor(matterId: string, userId: string) {
    return fetch(`${SERVER_URL}/api/practocore/matters/${matterId}/supervisors/promote`, {
        method: 'POST',
        body: JSON.stringify({ userId }),
        headers: {
            'Authorization': pocketbase.authStore.token,
            'Content-Type': 'application/json'
        }
    }).then((e) => e.json());
}

/**
 * Demote a supervisor back to regular member status
 * @param matterId - Matter ID
 * @param userId - User ID to demote
 */
export async function demoteSupervisorToMember(matterId: string, userId: string) {
    return fetch(`${SERVER_URL}/api/practocore/matters/${matterId}/supervisors/demote`, {
        method: 'POST',
        body: JSON.stringify({ userId }),
        headers: {
            'Authorization': pocketbase.authStore.token,
            'Content-Type': 'application/json'
        }
    }).then((e) => e.json());
}

// ============================================================================
// Deadline Assignment & Supervisor Functions
// ============================================================================

/**
 * Update assignees for a deadline
 * @param deadlineId - Deadline ID
 * @param assignees - Array of user IDs to assign
 */
export async function updateDeadlineAssignees(deadlineId: string, assignees: string[]) {
    return fetch(`${SERVER_URL}/api/practocore/deadlines/${deadlineId}/assignees`, {
        method: 'PUT',
        body: JSON.stringify({ assignees }),
        headers: {
            'Authorization': pocketbase.authStore.token,
            'Content-Type': 'application/json'
        }
    }).then((e) => e.json());
}

/**
 * Get assignees for a deadline with user details
 * @param deadlineId - Deadline ID
 */
export async function getDeadlineAssignees(deadlineId: string) {
    return fetch(`${SERVER_URL}/api/practocore/deadlines/${deadlineId}/assignees`, {
        method: 'GET',
        headers: {
            'Authorization': pocketbase.authStore.token,
            'Content-Type': 'application/json'
        }
    }).then((e) => e.json());
}

/**
 * Acknowledge a reminder (mark as handled)
 * @param reminderId - Reminder ID
 */
export async function acknowledgeReminder(reminderId: string) {
    return fetch(`${SERVER_URL}/api/practocore/reminders/${reminderId}/acknowledge`, {
        method: 'POST',
        headers: {
            'Authorization': pocketbase.authStore.token,
            'Content-Type': 'application/json'
        }
    }).then((e) => e.json());
}


/**
 * Reset a deadline to its template-calculated value
 * @param deadlineId - Deadline ID
 */
export async function resetDeadline(deadlineId: string) {
    return fetch(`${SERVER_URL}/api/practocore/deadlines/reset/${deadlineId}`, {
        method: 'POST',
        headers: {
            'Authorization': pocketbase.authStore.token,
            'Content-Type': 'application/json'
        }
    }).then((e) => e.json());
}

/**
 * Confirm a provisional matter's trigger date: pins the real date, flips
 * triggerStatus to confirmed, and materialises the (previously-suppressed) reminders.
 * @param matterId - Matter ID
 * @param date - Confirmed trigger date (ISO string or Date)
 */
export async function confirmTriggerDate(matterId: string, date: string | Date) {
    const res = await fetch(`${SERVER_URL}/api/practocore/matters/${matterId}/trigger-date/confirm`, {
        method: 'PUT',
        body: JSON.stringify({
            date: typeof date === 'string' ? date : date.toISOString(),
        }),
        headers: {
            'Authorization': pocketbase.authStore.token,
            'Content-Type': 'application/json'
        }
    });
    if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`confirmTriggerDate failed (${res.status}): ${body}`);
    }
    return res.json();
}

/**
 * Change the trigger date for a matter and recalculate all deadlines
 * @param matterId - Matter ID
 * @param date - New trigger date (ISO string or Date)
 */
export async function changeMatterTriggerDate(matterId: string, date: string | Date) {
    return fetch(`${SERVER_URL}/api/practocore/matters/${matterId}/trigger-date`, {
        method: 'PUT',
        body: JSON.stringify({
            date: typeof date === 'string' ? date : date.toISOString(),
        }),
        headers: {
            'Authorization': pocketbase.authStore.token,
            'Content-Type': 'application/json'
        }
    }).then((e) => e.json());
}

export async function getCourts(page : number, perPage : number, options : any) {
    return pocketbase.collection("Courts").getList(page, perPage, options);
}

export async function getJudges(page : number, perPage : number, options : any) {
    return pocketbase.collection("Judges").getList(page, perPage, options);
}

export async function getRegistrars(page : number, perPage : number, options : any) {
    return pocketbase.collection("Registrars").getList(page, perPage, options);
}

export async function getClerks(page : number, perPage : number, options : any) {
    return pocketbase.collection("Clerks").getList(page, perPage, options);
}

export async function getFirms(page : number, perPage : number, options : any) {
    return pocketbase.collection("Firms").getList(page, perPage, options);
}