// composables/usePlanActive.ts
import { ref, computed } from 'vue'
import { getActiveSubscription } from "~/services/subscriptions";

const activePlan = ref<Record<string, any> | null>(null)

export default function () {
    const init = async () => {
        console.log("Loading from storage")
        // 1. Try to load from localStorage immediately for offline support
        const cached = localStorage.getItem('pb_active_subscription')
        if (cached) {
            activePlan.value = JSON.parse(cached)
        }

        try {
            // 2. Refresh from server
            const { subscription } = await getActiveSubscription();
            if (subscription) {
                activePlan.value = subscription
                // 3. Update cache for next time
                localStorage.setItem('pb_active_subscription', JSON.stringify(subscription))
            }
        } catch (err) {
            console.warn("Offline or server error. Using cached subscription if available.")
        }
    }

    // Initialize on first use
    if (!activePlan.value) init()

    return computed(() => activePlan.value)
}
