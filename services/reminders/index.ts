import { pb as pocketbase, SERVER_URL } from '~/lib/pocketbase';

// Standalone reminders the user scheduled (via the AI assistant or directly).
// These live in their own `Reminders` collection — they are NOT deadlines.

export type ScheduleEventPayload = {
    title: string;
    targetDate: string;            // YYYY-MM-DD
    atTime?: string;               // HH:MM (24h, user's local tz)
    matterId?: string;             // omit for a personal event
    mode: 'single' | 'series';
    offsets: number[];             // days-before-target per touchpoint (single -> [0])
    channels?: Array<'EMAIL' | 'PUSH' | 'APP' | 'SMS'>;
};

// Create a calendar event: a standalone reminder with one (single) or several
// (series) escalating touchpoints. Reuses the backend reminder pipeline.
export async function scheduleEvent(payload: ScheduleEventPayload) {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const res = await fetch(`${SERVER_URL}/api/practocore/reminders/schedule`, {
        method: 'POST',
        headers: {
            'Authorization': pocketbase.authStore.token,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...payload, timezone }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.success === false) {
        throw new Error(data?.error || data?.message || `Failed to schedule event (${res.status})`);
    }
    return data;
}

export async function getReminders(options: Record<string, any> = {}) {
    // Reminders the user created OR is a recipient of (someone set it for them).
    //
    // The scope is enforced by the collection's list rule; do NOT repeat it here as
    // a client filter. `recipients.id ?= '<id>'` traverses a MULTI-VALUE relation
    // into Users, and the Users list rule is organisation-scoped
    // (`@request.auth.organisation.users ~ id`) — so an individual account with no
    // organisation can read no Users row at all, that join matches nothing, and
    // PocketBase then returns zero rows for the WHOLE filter, discarding the rows
    // the OR'd `owner` clause had already matched. That silently emptied the
    // calendar and the reminders page of every event for such accounts. Verified
    // against the live API: the same request without this filter returns all rows.
    return pocketbase.collection('Reminders').getFullList({
        sort: 'targetDate',
        expand: 'matter,recipients,owner',
        ...options,
    });
}

// Mark a reminder done. The backend's Reminders update hook then deactivates any
// remaining scheduled nudges for it.
export async function markReminderDone(reminderId: string) {
    return pocketbase.collection('Reminders').update(reminderId, { status: 'done' });
}

export async function deleteReminder(reminderId: string) {
    return pocketbase.collection('Reminders').delete(reminderId);
}

export function subscribeToReminders(fn: (data: any) => void) {
    return pocketbase.collection('Reminders').subscribe('*', fn);
}

export function unsubscribeFromReminders() {
    return pocketbase.collection('Reminders').unsubscribe('*');
}
