import { type RecordModel, type RecordSubscription } from 'pocketbase';
import { pb as pocketbase } from '~/lib/pocketbase';
import {options} from "kolorist";

const SERVER_URL = "https://api.practocore.com";

export async function getMatters(page: number, perPage: number, options: { filter?: string, sort?: string, expand?: string }) {
    // Use optimized backend route that fetches everything in one request
    const params = new URLSearchParams({
        page: page.toString(),
        perPage: perPage.toString(),
    });

    if (options.filter) params.set('filter', options.filter);
    if (options.sort) params.set('sort', options.sort);

    return fetch(`${SERVER_URL}/api/practocore/matters?${params.toString()}`, {
        method: 'GET',
        headers: {
            'Authorization': pocketbase.authStore.token,
            'Content-Type': 'application/json'
        }
    }).then((e) => e.json());
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
    fieldValues: any[],
    parties?: Record<string, any[]>,  // Party data organized by role ID
    representing?: { role_id: string, party_member_ids: string[] }  // Representation data
}) {
    return fetch(`${SERVER_URL}/api/practocore/create-matter`, {
        method: 'POST',
        body: JSON.stringify(options),
        headers: {
            'Authorization': pocketbase.authStore.token,
            'Content-Type': 'application/json'
        }
    }).then((e) => e.json());
}

export async function updateMatter(matterId: string, data: any) {
    return pocketbase.collection('Matters').update(matterId, data);
}

export async function deleteMatter(matterId: string) {
    return pocketbase.collection('Matters').delete(matterId);
}

export function subscribeToMatters(fn: (data: RecordSubscription<RecordModel>) => void) {
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
    return fetch(`${SERVER_URL}/api/practocore/matters/${matterId}`, {
        method: 'GET',
        headers: {
            'Authorization': pocketbase.authStore.token,
            'Content-Type': 'application/json'
        }
    }).then((e) => e.json());
}

export async function updateDeadline(deadlineId: string, options: Object) {
    return pocketbase.collection('Deadlines').update(deadlineId, options);
}

export async function fulfillDeadline(deadline: Deadline, date: string) {
    return await fetch(`${SERVER_URL}/api/practocore/deadlines/apply-action/${deadline.id}`, {
        method: 'POST',
        body: JSON.stringify({
            action: {
                action: "FULFILL",
                meta: {
                    targetId: deadline?.t_id,
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

export async function adjournDeadline(deadline: Deadline, date: string, force = false, reason = "") {
    return await fetch(`${SERVER_URL}/api/practocore/deadlines/apply-action/${deadline.id}`, {
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
    return fetch(`${SERVER_URL}/api/practocore/deadlines/${deadlineId}/reset`, {
        method: 'POST',
        headers: {
            'Authorization': pocketbase.authStore.token,
            'Content-Type': 'application/json'
        }
    }).then((e) => e.json());
}

/**
 * Change the trigger date for a matter and recalculate all deadlines
 * @param matterId - Matter ID
 * @param date - New trigger date (ISO string or Date)
 */
export async function changeMatterTriggerDate(matterId: string, date: string | Date, resetCompleted: boolean = false) {
    return fetch(`${SERVER_URL}/api/practocore/matters/${matterId}/trigger-date`, {
        method: 'PUT',
        body: JSON.stringify({
            date: typeof date === 'string' ? date : date.toISOString(),
            reset_completed: resetCompleted
        }),
        headers: {
            'Authorization': pocketbase.authStore.token,
            'Content-Type': 'application/json'
        }
    }).then((e) => e.json());
}
