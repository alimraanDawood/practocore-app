import { type RecordModel, type RecordSubscription } from 'pocketbase';
import { pb as pocketbase, SERVER_URL } from '~/lib/pocketbase';

pocketbase.autoCancellation(false);

export async function getSubscriptions(page: number, perPage: number, options: any) {
  return pocketbase.collection('Subscriptions').getList(page, perPage, options);
}

export function subscribeToSubscriptions(callback : (data: RecordSubscription<RecordModel>) => void) {
  pocketbase.collection('Subscriptions').subscribe('*', callback)
}

export async function getSubscriptionPlans(page: number, perPage: number, options: any) {
  return pocketbase.collection('SubscriptionPlans').getList(page, perPage, options);
}