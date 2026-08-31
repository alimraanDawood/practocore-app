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

/** The server's own message for a failed call, or `fallback` for anything that
 *  is not an Error (a network drop, a thrown string). Pair it with `api()`:
 *  that wrapper throws `new Error(body.message)`, and this is what puts that
 *  sentence in front of the person who needs it. */
export function apiErrorMessage(error: unknown, fallback: string): string {
    const message = error instanceof Error ? error.message.trim() : '';
    return message || fallback;
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

// Invite verification, acceptance and rejection live in ~/services/auth, which is
// what every caller imports. The copies that used to sit here shared neither the
// error handling nor the auth-store refresh, so a second implementation could only
// drift.

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

// Throws on a non-2xx reply. It used to swallow one and hand back
// `{ isAdmin: undefined }`, which reads as false — so a transient failure here
// silently hid the Lawyers nav item from a real admin with no way to tell that
// anything had gone wrong. Callers decide what a failure means.
export async function checkIfUserIsAdmin(): Promise<{ isAdmin: boolean }> {
    return api('/api/practocore/auth/check-organisation-admin', { method: 'GET' });
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

// Both of these currently answer 400 — the server handlers are stubs until
// ownership is modelled explicitly (internal/membership/members.go). They throw
// that message rather than returning it as if it were a result, and their UI is
// gated on OWNERSHIP_TRANSFER_ENABLED / BULK_MEMBER_ACTIONS_ENABLED below.
export async function transferOwnership(newOwnerId: string, organisationId: string) {
    return api('/api/members/transfer-ownership', {
        method: 'POST',
        body: JSON.stringify({ newOwnerId, organisationId })
    });
}

export async function bulkUpdateMembers(userIds: string[], organisationId: string, action: string) {
    return api('/api/members/bulk-update', {
        method: 'POST',
        body: JSON.stringify({ userIds, organisationId, action })
    });
}

// Server-side stubs. Flip these on in the same change that implements the
// handlers; until then the controls they gate can only produce an error toast.
export const BULK_MEMBER_ACTIONS_ENABLED = false;
export const OWNERSHIP_TRANSFER_ENABLED = false;

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

// Removed: updateUserPermissions / getUserPermissions / updateUser.
//
// The first wrote OrganisationUserPermissions straight from the browser, which
// only worked because that collection's updateRule had been loosened to a public
// write — the hole migration 1787500000 closes. Permission and title changes go
// through POST /api/members/update-permissions and /update-professional-role,
// which verify caller-is-admin and target-is-member in one transaction.
//
// updateUser here let an admin PATCH any column on a colleague's Users record,
// including the active-workspace pointer. Self-service profile edits use
// updateUser() in ~/services/auth; administrative changes belong behind a
// server command that names the fields it is willing to change.
