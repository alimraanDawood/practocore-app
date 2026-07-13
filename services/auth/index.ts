import {pb as pocketbase, SERVER_URL} from '~/lib/pocketbase';
export { pocketbase, SERVER_URL };


import { Capacitor } from '@capacitor/core';

/**
 * Thrown when the user backs out of the native Google account picker.
 * Call sites should treat this as a no-op (no error toast), just clear their
 * loading flag. Distinguishing it is what stops the "button spins forever after
 * I cancel" bug: the native plugin rejects on cancel, so `await` unwinds and
 * `finally` runs — we just don't want to shout at the user for cancelling.
 */
export class GoogleAuthCancelledError extends Error {
    readonly code = 'CANCELLED';
    constructor() {
        super('Google sign-in was cancelled');
        this.name = 'GoogleAuthCancelledError';
    }
}

// The Capgo plugin's `initialize` is only valid once per process. Guard it so
// repeated login attempts don't re-init (and so we don't pay the import cost on
// web, where the native module isn't bundled).
let socialLoginInitialized = false;

async function ensureNativeGoogleInitialized() {
    const config = useRuntimeConfig();
    const webClientId = config.public.googleWebClientId as string;
    const iosClientId = config.public.googleIosClientId as string;

    if (!webClientId) {
        throw new Error(
            'Native Google Sign-In is not configured: set NUXT_PUBLIC_GOOGLE_WEB_CLIENT_ID.'
        );
    }

    if (socialLoginInitialized) return;

    const { SocialLogin } = await import('@capgo/capacitor-social-login');
    await SocialLogin.initialize({
        google: {
            webClientId,
            // iOS reads its own client id; harmless/ignored on Android.
            ...(iosClientId ? { iOSClientId: iosClientId } : {}),
            // 'online' returns the idToken + profile we exchange with the backend.
            mode: 'online',
        },
    });
    socialLoginInitialized = true;
}

/**
 * Native Google Sign-In for Capacitor (Android/iOS).
 *
 * Gets a Google idToken via the OS account picker (no browser hop, no blank
 * tab, OS-managed cancel), exchanges it at the backend for a PocketBase auth
 * token, and hydrates `pb.authStore` so the rest of the app behaves exactly as
 * it does after the web OAuth flow.
 */
async function signInWithGoogleNative() {
    await ensureNativeGoogleInitialized();

    const { SocialLogin } = await import('@capgo/capacitor-social-login');

    let idToken: string | null = null;
    try {
        const response = await SocialLogin.login({
            provider: 'google',
            options: { scopes: ['email', 'profile'] },
        });
        const result = response.result as { idToken?: string | null };
        idToken = result?.idToken ?? null;
    } catch (err: any) {
        // Capgo surfaces user cancellation as a thrown error whose message/code
        // varies by platform. Normalise it so callers can suppress the toast.
        const raw = `${err?.code ?? ''} ${err?.message ?? err ?? ''}`.toLowerCase();
        if (raw.includes('cancel') || raw.includes('12501') /* Android SIGN_IN_CANCELLED */) {
            throw new GoogleAuthCancelledError();
        }
        throw err;
    }

    if (!idToken) {
        throw new Error('Google did not return an identity token.');
    }

    const response = await fetch(`${SERVER_URL}/api/practocore/auth/google/native`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ idToken }),
    });

    if (!response.ok) {
        let message = 'Google sign-in could not be completed.';
        try {
            const body = await response.json();
            message = body?.message || message;
        } catch { /* non-JSON error body */ }
        throw new Error(message);
    }

    const data = await response.json();
    // Mirror the PocketBase SDK: persist the token + record so authStore.isValid
    // and the auth.global middleware (which checks collectionName === 'Users')
    // both work downstream.
    pocketbase.authStore.save(data.token, data.record);

    return { token: data.token, record: data.record };
}

export async function signUpWithGoogle() {
    if (Capacitor.isNativePlatform()) {
        return signInWithGoogleNative();
    }

    // Default Web Flow (popup + realtime redirect) — only reliable in a real
    // browser, never inside the Capacitor webview.
    return pocketbase.collection('Users').authWithOAuth2({ provider: 'google' });
}


export async function getUserPreferences() {
    if(pocketbase.authStore.record) {
        return await pocketbase.collection('UserPreferences').getFirstListItem( `user = '${pocketbase.authStore.record?.id}'`);
    }
}

export async function submitAccountDetails(accountDetails : any, organisationReference : string | null = null) {
    const endpoint = (organisationReference === null) ? `${SERVER_URL}/api/practocore/auth/create-account` : `${SERVER_URL}/api/practocore/auth/create-account?ref=${organisationReference}`;

    const response = await fetch( endpoint, {
        method: "POST",
        body: JSON.stringify(accountDetails),
        headers: { "Content-Type": "application/json; charset=utf-8" },
    });

    if(!response.ok) {
        throw new Error(response.statusText);
    }

    return response.json();
}

export async function individualSignUp(accountDetails : any, organisationReference : string | null = null) {
    const endpoint = organisationReference ? `${SERVER_URL}/api/practocore/auth/individual/signup?ref=${organisationReference}` : `${SERVER_URL}/api/practocore/auth/individual/signup`;

    const response = await fetch( endpoint, {
        method: "POST",
        body: JSON.stringify(accountDetails),
        headers: { "Content-Type": "application/json; charset=utf-8" },
    });

    if(!response.ok) {
        throw new Error(response.statusText);
    }

    return response.json();
}

export async function organisationSignUp(accountDetails : any, organisationReference : string | null = null) {
    const endpoint = `${SERVER_URL}/api/practocore/auth/organisation/signup`;

    const response = await fetch( endpoint, {
        method: "POST",
        body: JSON.stringify(accountDetails),
        headers: { "Content-Type": "application/json; charset=utf-8" },
    });

    if(!response.ok) {
        throw new Error(response.statusText);
    }

    return response.json();
}

export function getSignedInUser() {
    return pocketbase.authStore.record;
}

export async function verifyOTP(otpId : string, userId : string, code : string) {
    return await fetch(`${SERVER_URL}/api/practocore/auth/verify-otp/${otpId}/${userId}/${code}`, {
        method: "GET",
    });
}

export async function updateUser(options : Object) {
    if(pocketbase.authStore.record) {
        const result = await pocketbase.collection('Users').update(pocketbase.authStore.record.id, options);
        refreshUserData();
        return result;
    }

    throw(new Error('User not signed in!'));
}

export async function signOut() {
    pocketbase.authStore.clear();

    return true;
}

export async function updateUserPreferences(options : Object) {
    if(pocketbase.authStore.record) {
        return await pocketbase.collection('UserPreferences').update(pocketbase.authStore.record.preferences, options);
    }

    throw(new Error('User not signed in!'));
}

export async function updateUserPreferencesById(preferenceId : string, options : Object) {
    if(pocketbase.authStore.record) {
        return await pocketbase.collection('UserPreferences').update(preferenceId, options);
    }

    throw(new Error('User not signed in!'));
}

export async function resendOTP(otpId : string, userId : string) {
    return await fetch(`${SERVER_URL}/api/practocore/auth/resend-otp/${otpId}/${userId}`, {
        method: "GET",
    });
}

export async function sendOTP(userId : string) {
    return await fetch(`${SERVER_URL}/api/practocore/auth/send-otp/${userId}`, {
        method: "GET",
    });
}

export async function signInWithEmail(email : string, password: string) {
    return pocketbase.collection('Users').authWithPassword(email, password, {});
}

export async function requestPasswordReset(email : string) {
    return pocketbase.collection('Users').requestPasswordReset(email);
}

export async function confirmPasswordReset(token : string, password : string, passwordConfirm : string) {
    return pocketbase.collection('Users').confirmPasswordReset(token, password, passwordConfirm);
}

export async function inviteUsers(emails : string[]) {
    const user = getSignedInUser();

    if (!user) {
        throw("No user found");
    }
    return await fetch(`${SERVER_URL}/api/practocore/auth/invite`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Authorization": `Bearer ${pocketbase.authStore.token}`,
        },
        body: JSON.stringify({
            inviter: user.id,
            invitees: emails
        }),
    })
}

export async function requestInviteLink(organisationId : string) {
    const user = getSignedInUser();

    if (!user) {
        throw("No user found");
    }

    return await fetch(`${SERVER_URL}/api/practocore/auth/request-invite-link/${organisationId}`, {
        method: "GET",
        headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Authorization": `Bearer ${pocketbase.authStore.token}`,
        },
    }).then(res => res.json());
}

export async function getOrganisationInviteReference(token : string) {
    return fetch(`${SERVER_URL}/api/invitations/verify/${token}`, { method: 'GET',
        headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Authorization": `Bearer ${pocketbase.authStore.token}`,
        }
    }).then(res => { return res.status === 200 ? res.json() : null; }).catch(console.error);
}

export async function acceptInvite(token :  string) {
    return fetch(`${SERVER_URL}/api/invitations/accept/${token}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Authorization": `Bearer ${pocketbase.authStore.token}`
        }
    });
}

export async function rejectInvite(token :  string) {
    return fetch(`${SERVER_URL}/api/invitations/reject/${token}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Authorization": `Bearer ${pocketbase.authStore.token}`
        }
    });
}

export async function getOrganisation(organisationId : string) {
    return pocketbase.collection('Organisations').getOne(organisationId);
}

export async function updateOrganisation(organisationId : string, options : Object) {
    return pocketbase.collection('Organisations').update(organisationId, options);
}

export function subscribeToUser(callback : Function) {
    pocketbase.collection('Users').subscribe(getSignedInUser()?.id, callback);
}

export function unsubscribeFromUser() {
    pocketbase.collection('Users').unsubscribe();
}

export function refreshUserData() {
    pocketbase.collection('Users').authRefresh();
}

export function getUserPermissions() {
    return fetch(`${SERVER_URL}/api/practocore/auth/get-user-permissions`, {
        method: "GET",
        headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Authorization": `Bearer ${pocketbase.authStore.token}`
        }
    });
}

export async function subscribeToPermissions(permissionId : string, callback : Function) {
    return pocketbase.collection('OrganisationUserPermissions').subscribe(permissionId, callback);
}

export function unsubscribeFromPermissions(permissionId : string) {
    return pocketbase.collection('OrganisationUserPermissions').unsubscribe(permissionId);
}

export function getOrganisations() {
    return fetch(`${SERVER_URL}/api/practocore/auth/get-organisations`, {
        method: "GET",
        headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Authorization": `Bearer ${pocketbase.authStore.token}`
        }
    });
}

export function changeOrganisation(organisationId : string) {
    return fetch(`${SERVER_URL}/api/practocore/auth/change-organisation/${organisationId}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Authorization": `Bearer ${pocketbase.authStore.token}`
        }
    });
}
