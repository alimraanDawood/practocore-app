import Pocketbase, { type RecordModel, type RecordSubscription } from 'pocketbase';

// const SERVER_URL = "https://www.practocore.com";
const SERVER_URL = "http://192.168.5.1:8090";
// const SERVER_URL = "http://127.0.0.1:8090";

const pocketbase = new Pocketbase(SERVER_URL);


export async function getAllTemplates() {
    pocketbase.autoCancellation(false);
    const result = await pocketbase.collection('DeadlineTemplates').getFullList();
    pocketbase.autoCancellation(true);
    return result;
}

export async function getTemplates(page : number, numPerPage : number, options : Object) {
    pocketbase.autoCancellation(false);
    const result = await pocketbase.collection('DeadlineTemplates').getList(page, numPerPage, options);
    pocketbase.autoCancellation(true);
    return result;
}

export async function getTemplate(id : string) {
    return pocketbase.collection('DeadlineTemplates').getOne(id);
}