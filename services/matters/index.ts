import { type RecordModel, type RecordSubscription } from 'pocketbase';
import { pb as pocketbase } from '~/lib/pocketbase';

const SERVER_URL = "https://www.practocore.com";

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


export async function createMatter(options: { name: string, caseNumber: string, personal: boolean, members?: string[], templateId: string, date: string, fieldValues: any[] }) {
    return fetch(`${SERVER_URL}/api/practocore/deadline`, {
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
