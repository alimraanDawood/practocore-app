import { App } from '@capacitor/app'
import { onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useDebounceFn } from "@vueuse/core";

export const useBackButton = () => {
    const { $router } = useNuxtApp();

    const router = $router;
    let backButtonListener: any = null

    const setupBackButton = () => {
        // Priority levels:
        // 100 - Modals/Dialogs/Sheets/Drawers (highest priority)
        // 50 - Navigation (medium priority)
        // 0 - Exit app (lowest priority)

        backButtonListener = App.addListener('backButton', useDebounceFn(({ canGoBack }) => {
            // Check for open modals, dialogs, sheets, or drawers
            // These should be closed first before navigation
            const openModal = document.querySelector('[data-state="open"][role="dialog"]')
            const openSheet = document.querySelector('[data-state="open"][data-sheet]')
            const openDrawer = document.querySelector('[data-state="open"][data-drawer]')

            if (openModal || openSheet || openDrawer) {
                // Trigger ESC key to close shadcn-vue components
                const escEvent = new KeyboardEvent('keydown', {
                    key: 'Escape',
                    code: 'Escape',
                    keyCode: 27,
                    bubbles: true,
                    cancelable: true
                });

                document.dispatchEvent(escEvent)
                return
            } else if (canGoBack && router.options.history.state.back) {
            // // If we can navigate back in the router history
                router.go(-1)
                return
            }
            //
            // // If we're at the root and can't go back, minimize or exit the app
            // App.exitApp()
        }, 1000))
    };

    const cleanup = () => {
        if (backButtonListener) {
            backButtonListener.remove()
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