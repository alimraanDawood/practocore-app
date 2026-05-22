import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle } from '@capacitor/haptics'
import { onMounted, onUnmounted } from 'vue'
import { useDebounceFn } from "@vueuse/core"
import { toast } from 'vue-sonner'

// TEMP DEBUG: set false to silence the on-screen back-button diagnostics.
const DEBUG_BACK = false

// Routes that should not be navigated back to
const PROTECTED_ROUTES = [
    'onboarding',
    'splash',
    'auth-login',
    'auth-register',
    'auth-otp',
    'org-switch'
]

// Root routes where back button should exit the app
const EXIT_ROUTES = [
    'main',
    'index'
]

export const useBackButton = () => {
    const { $router } = useNuxtApp()
    const router = $router
    let backButtonListener: any = null

    const triggerHaptic = async () => {
        if (!Capacitor.isNativePlatform()) return
        try {
            await Haptics.impact({ style: ImpactStyle.Light })
        } catch (e) {
            // Silently fail
        }
    }

    const { closeTop, stack } = useOverlayStack()

    const isProtectedRoute = (routeName: string | null | undefined): boolean => {
        if (!routeName) return false
        return PROTECTED_ROUTES.some(route =>
            routeName.toString().toLowerCase().includes(route.toLowerCase())
        )
    }

    const isExitRoute = (routeName: string | null | undefined): boolean => {
        if (!routeName) return false
        const name = routeName.toString().toLowerCase()
        return EXIT_ROUTES.some(exit => name === exit.toLowerCase())
    }

    const canNavigateBack = (): boolean => {
        const history = router.options.history
        const backPath = history.state.back as string | null

        if (!backPath) return false

        // Check if back route is protected
        const backRoute = router.resolve(backPath)
        if (isProtectedRoute(backRoute.name as string)) {
            return false
        }

        return true
    }

    const { goBackInTab } = useTabHistory()

    const handleBackButton = useDebounceFn(async () => {
        // await triggerHaptic()

        const overlayCount = stack.value.length
        if (DEBUG_BACK) toast(`⬅️ back fired — overlays open: ${overlayCount}`)

        // Priority 1: Close the topmost open overlay (dialog, sheet, drawer,
        // popover, dropdown menu, or any custom panel registered with the stack).
        if (closeTop()) {
            if (DEBUG_BACK) toast(`✅ closed top overlay (had ${overlayCount})`)
            return
        }

        const currentRoute = router.currentRoute.value
        const currentRouteName = currentRoute.name as string

        if (DEBUG_BACK) toast(`↪️ no overlay → navigating (route: ${currentRouteName})`)

        if (isExitRoute(currentRouteName)) {
            App.minimizeApp()
            return
        }

        // Priority 2: Navigate back within the current tab's history stack
        if (goBackInTab()) return

        // Priority 3: Fall back to router history
        if (canNavigateBack()) {
            router.go(-1)
            return
        }

        if (!isExitRoute(currentRouteName)) {
            router.push('/main')
            return
        }

        App.minimizeApp()
    }, 150)

    const setupBackButton = async () => {
        if (!Capacitor.isNativePlatform()) {
            if (DEBUG_BACK) toast('⚠️ back: not native platform — listener NOT registered')
            return
        }

        backButtonListener = await App.addListener('backButton', handleBackButton)
        if (DEBUG_BACK) toast('🔌 back listener registered')
    }

    const cleanup = () => {
        if (backButtonListener) {
            backButtonListener.remove()
            backButtonListener = null
        }
    }

    onMounted(() => {
        setupBackButton()
    })

    onUnmounted(() => {
        cleanup()
    })

    return {
        setupBackButton,
        cleanup
    }
}