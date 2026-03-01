import {type RecordModel, type RecordSubscription} from 'pocketbase';
import {pb as pocketbase, SERVER_URL} from '~/lib/pocketbase';

pocketbase.autoCancellation(false);

interface IndividualSubscriptionOptions {
    units: number;
    annual: boolean;
    phone: string;
}

export async function getSubscription(subscriptionId: string, options: Object) {
    return pocketbase.collection('Subscriptions').getOne(subscriptionId, options);
}

export async function getSubscriptions(page: number, perPage: number, options: any) {
    return pocketbase.collection('Subscriptions').getList(page, perPage, options);
}

export function subscribeToSubscriptions(callback: (data: RecordSubscription<RecordModel>) => void) {
    pocketbase.collection('Subscriptions').subscribe('*', callback)
}

export async function getSubscriptionPlans(page: number, perPage: number, options: any) {
    return pocketbase.collection('SubscriptionPlans').getList(page, perPage, options);
}

export async function getSubscriptionStatus(subscriptionId: string) {
    const endpoint = `${SERVER_URL}/api/individual/${subscriptionId}/subscription-status`
    return await fetch(endpoint, {
        method: "GET",
        headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Authorization": `Bearer ${pocketbase.authStore.token}`
        },
    }).then(r => r.json());
}

export async function subscribeAsIndividual(options: IndividualSubscriptionOptions) {
    const endpoint = `${SERVER_URL}/api/individual/subscribe`
    return await fetch(endpoint, {
        method: "POST",
        body: JSON.stringify(options),
        headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Authorization": `Bearer ${pocketbase.authStore.token}`
        },
    });
}

export async function getActiveSubscription() {
    const endpoint = `${SERVER_URL}/api/practocore/billing-status`
    return await fetch(endpoint, {
        method: "GET",
        headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Authorization": `Bearer ${pocketbase.authStore.token}`
        },
    }).then(r => r.json());
}