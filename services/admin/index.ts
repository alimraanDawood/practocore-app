import { pb as pocketbase, SERVER_URL } from '~/lib/pocketbase';

async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${SERVER_URL}${path}`, {
        ...options,
        headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Authorization": `Bearer ${pocketbase.authStore.token}`,
            ...options.headers,
        },
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body?.message || `Request failed (${response.status})`);
    return body as T;
}

export async function getOrganisation(id : string) {
    return pocketbase.collection('Organisations').getOne(id);
}

export async function updateOrganisation(id: string, options: Object) {
    return pocketbase.collection('Organisations').update(id, options);
}
export async function getOrganisationUsers(page : number, perPage: number, options : Object) {
    return pocketbase.collection('Users').getList(page, perPage, options);
}

// Direct invitations (new system)
export async function getDirectInvites(page : number, perPage: number, options : Object) {
    return pocketbase.collection('OrganisationDirectInvites').getList(page, perPage, options);
}

export function subscribeToDirectInvites(callBack : Function) {
    pocketbase.collection('OrganisationDirectInvites').subscribe('*', callBack);
}

export async function sendDirectInvite(email: string, organisationId: string, role: string = 'member', name?: string, organisationRole?: string) {
    return api('/api/invitations/send', {
        method: 'POST',
        body: JSON.stringify({
            email,
            organisationId,
            role,
            name,
            organisationRole
        })
    });
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
    return api(`/api/invitations/resend/${inviteId}`, {
        method: 'POST',
    });
}

export async function revokeInvite(inviteId: string) {
    return api(`/api/invitations/revoke/${inviteId}`, {
        method: 'DELETE',
    });
}

export async function getOrganisationInvites(organisationId: string) {
    return api(`/api/invitations/organisation/${organisationId}`, {
        method: 'GET',
    });
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
    return api('/api/members/update-role', {
        method: 'POST',
        body: JSON.stringify({ userId, organisationId, role })
    });
}

export async function removeMember(userId: string, organisationId: string) {
    return api('/api/members/remove', {
        method: 'POST',
        body: JSON.stringify({ userId, organisationId })
    });
}

export async function getMemberDetails(userId: string) {
    return api(`/api/members/member/${userId}/details`, {
        method: 'GET',
    });
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
    return api(`/api/members/organisation/${organisationId}`, {
        method: 'GET',
    });
}

export async function getUserOrganisationMembers() {
    return api('/api/members/organisation', {
        method: 'GET',
    });
}

export function updateProfessionalRole(userId: string, organisationId: string, organisationRole: string) {
    return api('/api/members/update-professional-role', { method: 'POST', body: JSON.stringify({ userId, organisationId, organisationRole }) });
}

export function updateMemberPermissionsForOrganisation(userId: string, organisationId: string, permissions: string[]) {
    return api('/api/members/update-permissions', { method: 'POST', body: JSON.stringify({ userId, organisationId, permissions }) });
}

export function updateUserPermissions(permissionsId : string, permissions: Object) {
    return pocketbase.collection("OrganisationUserPermissions").update(permissionsId, permissions);
}

export function getUserPermissions(permissionsId : string) {
    return pocketbase.collection("OrganisationUserPermissions").getOne(permissionsId);
}

export function updateUser(userId : string, options: object) {
    return pocketbase.collection("Users").update(userId, options);
}
