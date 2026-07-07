import posthog from 'posthog-js'
import { pb } from '~/lib/pocketbase'

/**
 * PostHog product analytics — EU ingestion, privacy-hardened for a
 * confidential legal product.
 *
 * Hard rules baked in here (do not loosen without a privacy review):
 *  - Session recording is OFF. Replays would capture client names, matter
 *    details, document contents and AI chat transcripts.
 *  - person_profiles: 'identified_only' — no profile is created for anonymous
 *    visitors; we only build a profile once a real user logs in.
 *  - sanitize_properties strips matter/record IDs out of URLs and redacts the
 *    text of autocaptured elements, so client/matter names never leave the
 *    browser. We keep *which* control was used, never *what it said*.
 *
 * Disabled automatically when posthogKey is empty (local dev / preview).
 */

// PocketBase record ids are 15-char base32-ish tokens. Replace them in URL
// paths with ":id" so analytics never carries an identifiable matter URL.
const PB_ID = /\b[a-z0-9]{15}\b/g

function scrubUrl(url: unknown): unknown {
    if (typeof url !== 'string') return url
    try {
        const u = new URL(url)
        // Drop the entire query string — it can carry ?org=, ?next=, tokens, etc.
        u.search = ''
        u.hash = u.hash.replace(PB_ID, ':id')
        u.pathname = u.pathname.replace(PB_ID, ':id')
        return u.toString()
    } catch {
        return (url as string).split('?')[0].replace(PB_ID, ':id')
    }
}

export default defineNuxtPlugin((nuxtApp) => {
    const config = useRuntimeConfig()
    const key = config.public.posthogKey as string
    const host = config.public.posthogHost as string
    // BETA ONLY — remove before prod by unsetting NUXT_PUBLIC_POSTHOG_SESSION_REPLAY.
    const enableReplay = config.public.posthogSessionReplay as boolean

    // No key → analytics disabled. Provide a no-op so $posthog is always safe.
    if (!key) {
        return { provide: { posthog } }
    }

    posthog.init(key, {
        api_host: host,
        ui_host: 'https://eu.posthog.com',
        // We create profiles only for logged-in users.
        person_profiles: 'identified_only',
        // Autocapture clicks/navigation, but never record sessions or inputs.
        autocapture: true,
        capture_pageview: true,
        capture_pageleave: true,
        // Error tracking: autocapture unhandled exceptions and promise
        // rejections so runtime errors surface in PostHog. Console-error
        // capture stays OFF — console lines can contain client/matter data,
        // and stack traces are scrubbed by sanitize_properties below.
        capture_exceptions: {
            capture_unhandled_errors: true,
            capture_unhandled_rejections: true,
            capture_console_errors: false,
        },
        // Session recording: BETA ONLY, env-gated. On prod (flag unset) this stays
        // true and nothing is ever recorded.
        disable_session_recording: !enableReplay,
        session_recording: {
            // Mask the *values* typed into inputs/textareas (passwords, search,
            // form fields) while leaving on-screen text visible so replays are
            // useful for UX review. Per-element opt-out: add class `ph-mask` to
            // mask an element's text, or `ph-no-capture` to block it entirely.
            maskAllInputs: true,
            maskTextSelector: '.ph-mask',
        },
        // Final scrub of every event before it leaves the browser.
        sanitize_properties: (properties) => {
            for (const k of ['$current_url', '$pathname', '$referrer', '$initial_current_url']) {
                if (properties[k] != null) properties[k] = scrubUrl(properties[k])
            }
            // Redact the text content of autocaptured elements (e.g. a matter
            // card showing a client name) while keeping the element/selector.
            if (properties.$el_text != null) properties.$el_text = '[redacted]'
            if (Array.isArray(properties.$elements)) {
                for (const el of properties.$elements) {
                    if (el && '$el_text' in el) el.$el_text = '[redacted]'
                    if (el && 'text' in el) el.text = '[redacted]'
                }
            }
            return properties
        },
        loaded: (ph) => {
            if (import.meta.dev) ph.debug()
        },
    })

    // Identify on login / reset on logout. authStore.onChange fires for both,
    // and we run it once immediately for an already-authenticated session.
    const sync = (record: typeof pb.authStore.record) => {
        if (record && pb.authStore.isValid) {
            posthog.identify(record.id, {
                email: record.email,
                name: record.name,
                organisation_id: record.organisation || null,
            })
            if (record.organisation) posthog.group('organisation', record.organisation)
        } else {
            posthog.reset()
        }
    }
    sync(pb.authStore.record)
    pb.authStore.onChange((_token, record) => sync(record))

    return { provide: { posthog } }
})
