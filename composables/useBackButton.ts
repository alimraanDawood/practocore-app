import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle } from '@capacitor/haptics'
import { onMounted, onUnmounted } from 'vue'
import { useDebounceFn } from "@vueuse/core"

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

    const findOpenOverlay = (): Element | null => {
        // Check for any open reka-ui/shadcn overlay components
        // Priority: AlertDialog > Dialog > Sheet > Drawer > Popover > DropdownMenu
        const selectors = [
            '[data-slot="alert-dialog-content"][data-state="open"]',
            '[data-slot="dialog-content"][data-state="open"]',
            '[data-slot="sheet-content"]', // Sheet doesn't have data-state, check if exists in DOM
            '[data-slot="drawer-content"][data-state="open"]',
            '[role="dialog"][data-state="open"]',
            '[data-radix-popper-content-wrapper]', // Popover/Dropdown menus
        ]

        for (const selector of selectors) {
            const element = document.querySelector(selector)
            if (element) return element
        }

        return null
    }

    const closeOverlay = (): boolean => {
        const overlay = findOpenOverlay()
        if (!overlay) return false

        // Dispatch escape key event to close the overlay
        const escEvent = new KeyboardEvent('keydown', {
            key: 'Escape',
            code: 'Escape',
            keyCode: 27,
            which: 27,
            bubbles: true,
            cancelable: true,
            composed: true
        })

        // Try dispatching to the overlay first, then to document
        overlay.dispatchEvent(escEvent)
        document.dispatchEvent(escEvent)

        return true
    }

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

    const handleBackButton = useDebounceFn(async () => {
        await triggerHaptic()

        // Priority 1: Close any open overlays (dialogs, sheets, drawers, etc.)
        if (closeOverlay()) {
            return
        }

        // Priority 2: Check current route
        const currentRoute = router.currentRoute.value
        const currentRouteName = currentRoute.name as string

        // If on exit route, minimize the app (standard Android behavior)
        if (isExitRoute(currentRouteName)) {
            App.minimizeApp()
            return
        }

        // Priority 3: Navigate back if possible
        if (canNavigateBack()) {
            router.go(-1)
            return
        }

        // Priority 4: If can't go back, go to main/home
        if (!isExitRoute(currentRouteName)) {
            router.push('/main')
            return
        }

        // Fallback: Minimize app
        App.minimizeApp()
    }, 150) // Short debounce to prevent double-taps but still feel responsive

    const setupBackButton = async () => {
        if (!Capacitor.isNativePlatform()) return

        backButtonListener = await App.addListener('backButton', handleBackButton)
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