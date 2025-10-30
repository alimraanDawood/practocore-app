import Pocketbase from 'pocketbase';
// const SERVER_URL = "https://www.practocore.com";
const SERVER_URL = "http://192.168.5.1:8090";
// const SERVER_URL = "http://127.0.0.1:8090"
const pocketbase = new Pocketbase(SERVER_URL);


export async function getOrganisationUsers(page : number, perPage: number, options : Object) {
    return pocketbase.collection('Users').getList(page, perPage, options);
}

export async function getInvites(page : number, perPage: number, options : Object) {
    return pocketbase.collection('OrganisationInviteRequests').getList(page, perPage, options);
}

export function subscribeToInvites(callBack : Function) {
    pocketbase.collection('OrganisationInviteRequests').subscribe('*', callBack);
}

export async function approveInvite(inviteId : string) {
    return fetch(`${SERVER_URL}/api/practocore/auth/approve-invite/${inviteId}`, {
        method: 'GET',
        headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Authorization": `Bearer ${pocketbase.authStore.token}`,
        },
    }).then(res => res.json());
}

export async function checkIfUserIsAdmin() {
    return fetch(`${SERVER_URL}/api/practocore/auth/check-organisation-admin`, {
        method: "GET",
        headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Authorization": `Bearer ${pocketbase.authStore.token}`,
        },
    }).then(res => res.json());
}