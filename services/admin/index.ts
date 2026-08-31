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

/** Move ownership of the firm to another member.
 *
 *  Atomic on the server: the firm never passes through a state with no owner,
 *  which is a state nothing could recover from. Only the current owner may call
 *  it, and the outgoing owner stays on as an admin. */
export async function transferOwnership(newOwnerId: string, organisationId: string) {
    return api('/api/members/transfer-ownership', {
        method: 'POST',
        body: JSON.stringify({ newOwnerId, organisationId })
    });
}

/** Apply one change to several members.
 *
 *  Each member is its own transaction on the server, so the result is PARTIAL by
 *  design: `results` carries a per-member outcome and `updated` counts the ones
 *  that took. Show the failures — "2 of 3 updated" is not actionable on its own. */
export async function bulkUpdateMembers(userIds: string[], organisationId: string, action: string) {
    return api('/api/members/bulk-update', {
        method: 'POST',
        body: JSON.stringify({ userIds, organisationId, action })
    });
}

// Both handlers are implemented (internal/membership/ownership.go), so the
// controls they gate now do what they say. The flags are kept rather than
// deleted: they are the switch to reach for if either turns out to need pulling
// in a hurry, and their call sites read better for naming the capability.
export const BULK_MEMBER_ACTIONS_ENABLED = true;
export const OWNERSHIP_TRANSFER_ENABLED = true;

export async function getOrganisationMembers(organisationId: string) {
    return api(`/api/members/organisation/${organisationId}`, {
        method: 'GET',
    });
}

/** The firm directory.
 *
 *  Members and pending invitations come back as ONE list, each row carrying
 *  `kind: "member" | "invitation"` — but only when `include: "invitations"` is
 *  asked for, so a caller that still renders lawyer cards is not handed
 *  invitations it would draw as people.
 *
 *  Filtering and paging are the SERVER's, not the client's. The old page pulled
 *  every member and filtered in the browser, which is fine for six lawyers and
 *  wrong for sixty. */
export interface DirectoryQuery {
    page?: number;
    perPage?: number;
    search?: string;
    status?: string;
    role?: string;
    authority?: string;
    includeInvitations?: boolean;
}

export async function getUserOrganisationMembers(query: DirectoryQuery = {}) {
    const params = new URLSearchParams();
    if (query.page) params.set('page', String(query.page));
    if (query.perPage) params.set('perPage', String(query.perPage));
    if (query.search) params.set('search', query.search);
    if (query.status) params.set('status', query.status);
    if (query.role) params.set('role', query.role);
    if (query.authority) params.set('authority', query.authority);
    if (query.includeInvitations) params.set('include', 'invitations');
    const qs = params.toString();
    return api(`/api/members/organisation${qs ? `?${qs}` : ''}`, {
        method: 'GET',
    });
}

/** What the signed-in user may do here, resolved by the server.
 *
 *  Replaces the auth hook's get-user-permissions, which read the stored column
 *  directly. That column is now DERIVED — the resolver materialises it — so a
 *  client reading it raw would show one answer while an owner or admin was
 *  treated differently by every collection rule. */
export async function getMyEffectivePermissions() {
    return api('/api/members/me/effective-permissions', { method: 'GET' });
}

/** The firm's roles, with a holder count each. Readable by any member: a lawyer
 *  is entitled to know what their own title permits. */
export async function getOrganisationRoles(organisationId: string) {
    return api(`/api/organisations/${organisationId}/roles`, { method: 'GET' });
}

/** Edit what a role may do.
 *
 *  `preview: true` returns `affectedMembers` and commits NOTHING — that is the
 *  number behind "this will change access for 12 members currently assigned to
 *  Paralegal". Without preview the bundle is saved and every holder is
 *  re-materialised in the same transaction. */
export async function updateOrganisationRole(
    organisationId: string,
    roleId: string,
    body: { label?: string; description?: string; capabilities?: Record<string, string>; preview?: boolean },
) {
    return api(`/api/organisations/${organisationId}/roles/${roleId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
    });
}

/** Leave a firm of your own accord.
 *
 *  The same departure an admin's removal performs — assignments are swept either
 *  way — recorded as `left` rather than `removed`. The sole owner is refused:
 *  somebody has to be able to administer the firm. */
export async function leaveOrganisation(organisationId: string) {
    return api('/api/members/leave', {
        method: 'POST',
        body: JSON.stringify({ organisationId }),
    });
}

/** What has been done to one person's membership, newest first, with the actor
 *  named. Admin-only. This is what turns an override from a switch that is on
 *  into a decision somebody is accountable for. */
export async function getMemberHistory(userId: string) {
    return api(`/api/members/member/${userId}/history`, { method: 'GET' });
}

/** owner / admin / member. Distinct from the professional title, which carries
 *  the permission bundle. Ownership moves by transfer rather than being granted
 *  here, and the server refuses anything that would leave the firm with no
 *  owner or no administrator. */
export async function updateMemberAuthority(userId: string, organisationId: string, authority: string) {
    return api('/api/members/update-authority', {
        method: 'POST',
        body: JSON.stringify({ userId, organisationId, authority }),
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
