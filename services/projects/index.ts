import Pocketbase, { type RecordModel, type RecordSubscription } from 'pocketbase';

// const SERVER_URL = "https://www.practocore.com";
const SERVER_URL = "http://192.168.5.1:8090";
// const SERVER_URL = "http://127.0.0.1:8090";

const pocketbase = new Pocketbase(SERVER_URL);

export async function getProjects(page : number, perPage : number, options : Object) {
    const projects = await pocketbase.collection('Projects').getList(page, perPage, {...options});
    let projectList = projects.items;
    let deadlines = [];
    for(let project of projects.items) {
        const deadlines = await pocketbase.collection('Deadlines').getFullList({ filter: `project = '${project.id}'` });

        projectList = [...projectList.filter(p => p.id !== project.id), { ...project, deadlines: [...deadlines.map(d => d.id)], expand: { ...project?.expand, deadlines: deadlines } }];
    }

    return {...projects, items: projectList};
}

export async function getAllDeadlines(options : Object) {
    return pocketbase.collection('Deadlines').getFullList({...options});
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

export async function getTemplates() {
    pocketbase.autoCancellation(false);
    const result = await pocketbase.collection('DeadlineTemplates').getFullList();
    pocketbase.autoCancellation(true);
    return result;
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
    const project = await pocketbase.collection('Projects').getOne(projectId, {...options});
    const deadlines = await pocketbase.collection('Deadlines').getFullList({ filter: `project = '${project.id}'` });

    return { ...project, deadlines: [...deadlines.map(d => d.id)], expand: { ...project?.expand, deadlines: deadlines } };
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
