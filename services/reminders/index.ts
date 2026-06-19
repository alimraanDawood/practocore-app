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

export async function getReminders(userId: string, options: Record<string, any> = {}) {
    // Reminders the user created OR is a recipient of (someone set it for them).
    return pocketbase.collection('Reminders').getFullList({
        filter: `owner = '${userId}' || recipients.id ?= '${userId}'`,
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
