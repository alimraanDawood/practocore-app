import { pb as pocketbase } from '~/lib/pocketbase';

const SERVER_URL = "http://10.15.128.175:8090";


export async function getOrganisationUsers(page : number, perPage: number, options : Object) {
    return pocketbase.collection('Users').getList(page, perPage, options);
}

// Legacy invite requests (from shareable links)
export async function getInviteRequests(page : number, perPage: number, options : Object) {
    return pocketbase.collection('OrganisationInviteRequests').getList(page, perPage, options);
}

export function subscribeToInviteRequests(callBack : Function) {
    pocketbase.collection('OrganisationInviteRequests').subscribe('*', callBack);
}

export async function approveInviteRequest(inviteId : string) {
    return fetch(`${SERVER_URL}/api/practocore/auth/approve-invite/${inviteId}`, {
        method: 'GET',
        headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Authorization": `Bearer ${pocketbase.authStore.token}`,
        },
    }).then(res => res.json());
}

// Direct invitations (new system)
export async function getDirectInvites(page : number, perPage: number, options : Object) {
    return pocketbase.collection('OrganisationDirectInvites').getList(page, perPage, options);
}

export function subscribeToDirectInvites(callBack : Function) {
    pocketbase.collection('OrganisationDirectInvites').subscribe('*', callBack);
}

export async function sendDirectInvite(email: string, organisationId: string, role: string = 'member', name?: string) {
    return fetch(`${SERVER_URL}/api/invitations/send`, {
        method: 'POST',
        headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Authorization": `Bearer ${pocketbase.authStore.token}`,
        },
        body: JSON.stringify({
            email,
            organisationId,
            role,
            name
        })
    }).then(res => res.json());
}

export async function verifyInviteToken(token: string) {
    return fetch(`${SERVER_URL}/api/invitations/verify/${token}`, {
        method: 'GET',
        headers: {
            "Content-Type": "application/json; charset=utf-8",
        },
    }).then(res => res.json());
}

export async function acceptInvite(token: string) {
    return fetch(`${SERVER_URL}/api/invitations/accept/${token}`, {
        method: 'POST',
        headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Authorization": `Bearer ${pocketbase.authStore.token}`,
        },
    }).then(res => res.json());
}

export async function rejectInvite(token: string) {
    return fetch(`${SERVER_URL}/api/invitations/reject/${token}`, {
        method: 'POST',
        headers: {
            "Content-Type": "application/json; charset=utf-8",
        },
    }).then(res => res.json());
}

export async function resendInvite(inviteId: string) {
    return fetch(`${SERVER_URL}/api/invitations/resend/${inviteId}`, {
        method: 'POST',
        headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Authorization": `Bearer ${pocketbase.authStore.token}`,
        },
    }).then(res => res.json());
}

export async function revokeInvite(inviteId: string) {
    return fetch(`${SERVER_URL}/api/invitations/revoke/${inviteId}`, {
        method: 'DELETE',
        headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Authorization": `Bearer ${pocketbase.authStore.token}`,
        },
    }).then(res => res.json());
}

export async function getOrganisationInvites(organisationId: string) {
    return fetch(`${SERVER_URL}/api/invitations/organisation/${organisationId}`, {
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

// Member Management
export async function updateMemberRole(userId: string, organisationId: string, role: string) {
    return fetch(`${SERVER_URL}/api/members/update-role`, {
        method: 'POST',
        headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Authorization": `Bearer ${pocketbase.authStore.token}`,
        },
        body: JSON.stringify({ userId, organisationId, role })
    }).then(res => res.json());
}

export async function removeMember(userId: string, organisationId: string) {
    return fetch(`${SERVER_URL}/api/members/remove`, {
        method: 'POST',
        headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Authorization": `Bearer ${pocketbase.authStore.token}`,
        },
        body: JSON.stringify({ userId, organisationId })
    }).then(res => res.json());
}

export async function getMemberDetails(userId: string) {
    return fetch(`${SERVER_URL}/api/members/member/${userId}/details`, {
        method: 'GET',
        headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Authorization": `Bearer ${pocketbase.authStore.token}`,
        },
    }).then(res => res.json());
}

export async function transferOwnership(newOwnerId: string, organisationId: string) {
    return fetch(`${SERVER_URL}/api/members/transfer-ownership`, {
        method: 'POST',
        headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Authorization": `Bearer ${pocketbase.authStore.token}`,
        },
        body: JSON.stringify({ newOwnerId, organisationId })
    }).then(res => res.json());
}

export async function bulkUpdateMembers(userIds: string[], organisationId: string, action: string) {
    return fetch(`${SERVER_URL}/api/members/bulk-update`, {
        method: 'POST',
        headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Authorization": `Bearer ${pocketbase.authStore.token}`,
        },
        body: JSON.stringify({ userIds, organisationId, action })
    }).then(res => res.json());
}

export async function getOrganisationMembers(organisationId: string) {
    return fetch(`${SERVER_URL}/api/members/organisation/${organisationId}`, {
        method: 'GET',
        headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Authorization": `Bearer ${pocketbase.authStore.token}`,
        },
    }).then(res => res.json());
}