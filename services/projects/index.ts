import Pocketbase, { type RecordModel, type RecordSubscription } from 'pocketbase';
// const SERVER_URL = "http://192.168.5.1:8090";
const SERVER_URL = "https://www.practocore.com";

const pocketbase = new Pocketbase(SERVER_URL);

export async function getProjects(page : number, perPage : number, options : Object) {
    return pocketbase.collection('Projects').getList(page, perPage, {...options});
}

export async function getTemplates() {
    return pocketbase.collection('DeadlineTemplates').getFullList();
}

export async function createProject(options : { name: string, templateId: string, date: string }) {
    return fetch(`${SERVER_URL}/api/practocore/deadline`, {
        method: 'POST',
        body: JSON.stringify(options),
        headers: {
            'Authorization': pocketbase.authStore.token,
            'Content-Type': 'application/json'
        }
    }).then((e) => e.json());
}

export async function deleteProject(projectId: string) {
    return pocketbase.collection('Projects').delete(projectId);
}

export function subscribeToProjects(fn : (data: RecordSubscription<RecordModel>) => void) {
    return pocketbase.collection('Projects').subscribe('*', fn)
}

export function subscribeToProject(projectId : string, fn : (data: RecordSubscription<RecordModel>) => void) {
    return pocketbase.collection('Projects').subscribe(projectId, fn)
}

export function unsubscribeToProjects() {
    return pocketbase.collection('Projects').unsubscribe('*');
}

export function unsubscribeToProject(projectId : string) {
    return pocketbase.collection('Projects').unsubscribe(projectId);
}

export async function getProject(projectId : string, options: Object) {
    return pocketbase.collection('Projects').getOne(projectId, {...options});    
}

export async function updateDeadline(deadlineId : string, options: Object) {
    return pocketbase.collection('Deadlines').update(deadlineId, options);
}

export function subscribeToDeadlines(fn : (data: RecordSubscription<RecordModel>) => void) {
    return pocketbase.collection('Deadlines').subscribe('*', fn);
}

export function subscribeToDeadline(deadlineId : string, fn : (data: RecordSubscription<RecordModel>) => void) {
    return pocketbase.collection('Deadlines').subscribe(deadlineId, fn);
}

export function unsubscribeToDeadlines() {
    return pocketbase.collection('Deadlines').unsubscribe('*');
}

export function unsubscribeToDeadline(deadlineId : string) {
    return pocketbase.collection('Deadlines').unsubscribe(deadlineId);
}

export function unsubscribeToAllDeadlines() {
    return pocketbase.collection('Deadlines').unsubscribe();
}