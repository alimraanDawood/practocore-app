import Pocketbase from 'pocketbase';
const SERVER_URL = "http://192.168.0.110:8090";
const pocketbase = new Pocketbase(SERVER_URL);

export async function signUpWithGoogle() {
    return pocketbase.collection('Users').authWithOAuth2({provider: 'google'});
}

export async function submitAccountDetails(accountDetails : any) {
    return await fetch(`${SERVER_URL}/api/practocore/auth/create-account`, {
        method: "POST",
        body: JSON.stringify(accountDetails),
        headers: { "Content-Type": "application/json; charset=utf-8" },
    }).then(res => res.json());
}

export async function verifyOTP(otpId : string, userId : string, code : string) {
    return await fetch(`${SERVER_URL}/api/practocore/auth/verify-otp/${otpId}/${userId}/${code}`, {
        method: "GET",
    }).then(res => res.json());
}