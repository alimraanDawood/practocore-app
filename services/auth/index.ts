import Pocketbase from 'pocketbase';
// const SERVER_URL = "https://www.practocore.com";
const SERVER_URL = "http://192.168.5.1:8090";
// const SERVER_URL = "http://127.0.0.1:8090"
const pocketbase = new Pocketbase(SERVER_URL);

export async function signUpWithGoogle() {
    return pocketbase.collection('Users').authWithOAuth2({provider: 'google'});
}

export async function getUserPreferences() {
    if(pocketbase.authStore.record) {
        return await pocketbase.collection('UserPreferences').getOne(pocketbase.authStore.record.preferences);
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

        return result;
    }

    throw(new Error('User not signed in!'));
}

export async function updateUserPreferences(options : Object) {
    if(pocketbase.authStore.record) {
        const result = await pocketbase.collection('UserPreferences').update(pocketbase.authStore.record.preferences, options);

        return result;
    }

    throw(new Error('User not signed in!'));
}

export async function resendOTP(otpId : string, userId : string) {
    return await fetch(`${SERVER_URL}/api/practocore/auth/resend-otp/${otpId}/${userId}`, {
        method: "GET",
    });
}

export async function signInWithEmail(email : string, password: string) {
    return pocketbase.collection('Users').authWithPassword(email, password, {});
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

export async function getOrganisations() {
    return pocketbase.collection('Organisations').getFullList();
}