import Pocketbase, { type RecordModel, type RecordSubscription } from 'pocketbase';

const SERVER_URL = "https://www.practocore.com";
// const SERVER_URL = "http://192.168.100.198:8090";
// const SERVER_URL = "http://127.0.0.1:8090";

const pocketbase = new Pocketbase(SERVER_URL);

export async function getMatters(page: number, perPage: number, options: Object) {
    const matters = await pocketbase.collection('Matters').getList(page, perPage, { ...options });
    let matterList = matters.items;
    let deadlines = [];
    for (let matter of matters.items) {

        let deadlines = await pocketbase.collection('Deadlines').getFullList({ filter: `matter = '${matter.id}'` });

        for (let deadline of deadlines) {
            const adjournments = await pocketbase.collection('DeadlineAdjournments').getFullList({ filter: `deadline = '${deadline.id}'` });

            deadlines = [...deadlines.filter(d => d.id !== deadline.id), { ...deadline, adjournments: [...adjournments.map(a => a.id)], expand: { ...deadline?.expand, adjournments } }];
        }

        matterList = [...matterList.filter(p => p.id !== matter.id), { ...matter, deadlines: [...deadlines.map(d => d.id)], expand: { ...matter?.expand, deadlines: deadlines } }];
    }

    return { ...matters, items: matterList };
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


export async function createMatter(options: { name: string, templateId: string, date: string, fieldValues: any[] }) {
    return fetch(`${SERVER_URL}/api/practocore/deadline`, {
        method: 'POST',
        body: JSON.stringify(options),
        headers: {
            'Authorization': pocketbase.authStore.token,
            'Content-Type': 'application/json'
        }
    }).then((e) => e.json());
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
    const matter = await pocketbase.collection('Matters').getOne(matterId, { ...options });
    let deadlines = await pocketbase.collection('Deadlines').getFullList({ filter: `matter = '${matter.id}'` });

    for (let deadline of deadlines) {
        const adjournments = await pocketbase.collection('DeadlineAdjournments').getFullList({ filter: `deadline = '${deadline.id}'` });

        deadlines = [...deadlines.filter(d => d.id !== deadline.id), { ...deadline, adjournments: [...adjournments.map(a => a.id)], expand: { ...deadline?.expand, adjournments } }];
    }

    return { ...matter, deadlines: [...deadlines.map(d => d.id)], expand: { ...matter?.expand, deadlines: deadlines } };
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
