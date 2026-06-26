import posthog from 'posthog-js'

/**
 * Intentional product analytics — the named funnel steps we want in order to
 * refine the UI (vault, AI chat, docgen, workflows, …). Pageviews + clicks are
 * autocaptured by plugins/posthog.client.ts; use track() for meaningful steps.
 *
 * Backed by the posthog-js singleton (the same instance the plugin inits), so
 * this is safe to call from service modules and async code where the Nuxt
 * context isn't available — unlike a useNuxtApp()-based composable.
 *
 *   track('document_generated', { kind: 'plaint', from: 'workflow' })
 *
 * IMPORTANT: send metadata only — categories/ids/counts. Never document
 * bodies, client names, or matter titles. Same trust boundary as the plugin's
 * sanitize_properties scrubber.
 */

// Extend freely as you instrument more; the `(string & {})` keeps it open while
// still offering autocomplete for the known set.
export type TrackEvent =
    | 'document_generated'
    | 'vault_document_uploaded'
    | 'vault_created'
    | 'ai_chat_message_sent'
    | 'ai_skill_invoked'
    | 'workflow_started'
    | 'workflow_approved'
    | 'deep_research_started'
    | 'matter_created'
    | (string & {})

type TrackProps = Record<string, string | number | boolean | null | undefined>

function ready(): boolean {
    // __loaded flips true after posthog.init(); false when no key (analytics off).
    return Boolean((posthog as unknown as { __loaded?: boolean }).__loaded)
}

export function track(event: TrackEvent, properties?: TrackProps) {
    if (!ready()) return
    try {
        posthog.capture(event, properties)
    } catch {
        // Analytics must never break a user flow.
    }
}

export function isFeatureEnabled(flag: string): boolean {
    if (!ready()) return false
    try {
        return Boolean(posthog.isFeatureEnabled(flag))
    } catch {
        return false
    }
}
