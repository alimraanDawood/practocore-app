import { pb as pocketbase } from '~/lib/pocketbase';

// Standalone reminders the user scheduled (via the AI assistant or directly).
// These live in their own `Reminders` collection — they are NOT deadlines.

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
