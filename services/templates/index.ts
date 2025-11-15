import { type RecordModel, type RecordSubscription } from 'pocketbase';
import { pb as pocketbase } from '~/lib/pocketbase';

const SERVER_URL = "http://127.0.0.1:8090";


export async function getAllTemplates() {
    pocketbase.autoCancellation(false);
    const result = await pocketbase.collection('DeadlineTemplates').getFullList();
    pocketbase.autoCancellation(true);
    return result;
}

export async function createTemplate(options : Object) {
    return pocketbase.collection('DeadlineTemplates').create(options);
}

export async function getTemplates(page : number, numPerPage : number, options : Object) {
    pocketbase.autoCancellation(false);
    const result = await pocketbase.collection('DeadlineTemplates').getList(page, numPerPage, options);
    pocketbase.autoCancellation(true);
    return result;
}

export async function getTemplate(id : string) {
    return pocketbase.collection('DeadlineTemplates').getOne(id, { expand: 'author' });
}

export async function updateTemplate(id : string, data : Object) {
    return pocketbase.collection('DeadlineTemplates').update(id, data);
}

export function subscribeToTemplates(callback : Function) {
    return pocketbase.collection('DeadlineTemplates').subscribe('*', callback);
}

export function unsubscribeToTemplates() {
    return pocketbase.collection('DeadlineTemplates').unsubscribe('*');
}