// composables/usePlanActive.ts
import { ref, computed } from 'vue'
import { getActiveSubscription } from "~/services/subscriptions";

// The holder's *current effective* term (server-derived; see billing-status).
const activePlan = ref<Record<string, any> | null>(null)
// The soonest queued term that starts after the current one ends — e.g. a paid
// plan stacked on top of a still-running trial. Null when there's nothing queued.
const nextPlan = ref<Record<string, any> | null>(null)

async function loadPlan() {
    // 1. Load from localStorage immediately for offline support.
    const cached = localStorage.getItem('pb_active_subscription')
    if (cached) {
        activePlan.value = JSON.parse(cached)
    }

    try {
        // 2. Refresh from server.
        const { subscription, next } = await getActiveSubscription();
        activePlan.value = subscription ?? null
        nextPlan.value = next ?? null
        if (subscription) {
            localStorage.setItem('pb_active_subscription', JSON.stringify(subscription))
        } else {
            localStorage.removeItem('pb_active_subscription')
        }
    } catch (err) {
        console.warn("Offline or server error. Using cached subscription if available.")
    }
}

export default function () {
    if (!activePlan.value) loadPlan()
    return computed(() => activePlan.value)
}

// The queued/scheduled term (or null). Shares the same load as usePlanActive.
export function useNextPlan() {
    return computed(() => nextPlan.value)
}

// Force a refresh (e.g. after a successful payment).
export function refreshPlan() {
    return loadPlan()
}
