import { requestWebPushPermission, checkPushPermissions, isPushNotificationsSupported } from '~/services/push-notifications';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';

const STORAGE_KEY = 'notification_permission_prompt';

interface PermissionPromptState {
  lastAsked: string | null;
  lastResponse: 'granted' | 'denied' | 'not_now' | null;
  timesAsked: number;
}

/**
 * Composable to manage notification permission prompts
 * Handles when to show prompts and persists user decisions
 */
export const useNotificationPermission = () => {
  const shouldShowPrompt = ref(false);
  const isProcessing = ref(false);

  /**
   * Get the stored permission prompt state from localStorage
   */
  const getPromptState = (): PermissionPromptState => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('Error reading permission prompt state:', error);
    }

    return {
      lastAsked: null,
      lastResponse: null,
      timesAsked: 0
    };
  };

  /**
   * Save the permission prompt state to localStorage
   */
  const savePromptState = (state: PermissionPromptState) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.error('Error saving permission prompt state:', error);
    }
  };

  /**
   * Calculate if enough time has passed since last prompt
   */
  const shouldAskAgain = (state: PermissionPromptState): boolean => {
    // Never asked before
    if (!state.lastAsked || !state.lastResponse) {
      return true;
    }

    const lastAskedDate = new Date(state.lastAsked);
    const now = new Date();
    const daysSinceLastAsked = Math.floor((now.getTime() - lastAskedDate.getTime()) / (1000 * 60 * 60 * 24));

    // If granted, never ask again
    if (state.lastResponse === 'granted') {
      return false;
    }

    // If "not now", ask again after 1 day
    if (state.lastResponse === 'not_now') {
      return daysSinceLastAsked >= 1;
    }

    // If denied, ask again after 7 days
    if (state.lastResponse === 'denied') {
      return daysSinceLastAsked >= 7;
    }

    return false;
  };

  /**
   * Check if we should show the permission prompt
   */
  const checkShouldShowPrompt = async (): Promise<boolean> => {
    // Check if push notifications are supported
    const isSupported = await isPushNotificationsSupported();
    if (!isSupported) {
      return false;
    }

    // Check current permission status
    const permissionStatus = await checkPushPermissions();

    // If already granted, don't show prompt
    if (permissionStatus?.receive === 'granted') {
      return false;
    }

    // Check stored state
    const state = getPromptState();

    // Check if enough time has passed
    return shouldAskAgain(state);
  };

  /**
   * Initialize and check if prompt should be shown
   */
  const initializePrompt = async () => {
    const show = await checkShouldShowPrompt();
    shouldShowPrompt.value = show;
  };

  /**
   * Handle user granting permission
   */
  const handleGrant = async () => {
    isProcessing.value = true;

    try {
      const platform = Capacitor.getPlatform();

      if (platform === 'web') {
        // Request web permission
        const permission = await requestWebPushPermission();

        if (permission === 'granted') {
          // Save state
          const state = getPromptState();
          savePromptState({
            lastAsked: new Date().toISOString(),
            lastResponse: 'granted',
            timesAsked: state.timesAsked + 1
          });
          shouldShowPrompt.value = false;
          return true;
        } else if (permission === 'denied') {
          // User denied at browser level
          const state = getPromptState();
          savePromptState({
            lastAsked: new Date().toISOString(),
            lastResponse: 'denied',
            timesAsked: state.timesAsked + 1
          });
          shouldShowPrompt.value = false;
          return false;
        }
      } else {
        // Request native permission
        const permResult = await PushNotifications.requestPermissions();

        if (permResult.receive === 'granted') {
          // Register for push notifications
          await PushNotifications.register();

          // Save state
          const state = getPromptState();
          savePromptState({
            lastAsked: new Date().toISOString(),
            lastResponse: 'granted',
            timesAsked: state.timesAsked + 1
          });
          shouldShowPrompt.value = false;
          return true;
        } else {
          // User denied
          const state = getPromptState();
          savePromptState({
            lastAsked: new Date().toISOString(),
            lastResponse: 'denied',
            timesAsked: state.timesAsked + 1
          });
          shouldShowPrompt.value = false;
          return false;
        }
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    } finally {
      isProcessing.value = false;
    }

    return false;
  };

  /**
   * Handle user declining permission (not now)
   */
  const handleNotNow = () => {
    const state = getPromptState();
    savePromptState({
      lastAsked: new Date().toISOString(),
      lastResponse: 'not_now',
      timesAsked: state.timesAsked + 1
    });
    shouldShowPrompt.value = false;
  };

  /**
   * Handle user permanently declining
   */
  const handleNever = () => {
    const state = getPromptState();
    savePromptState({
      lastAsked: new Date().toISOString(),
      lastResponse: 'denied',
      timesAsked: state.timesAsked + 1
    });
    shouldShowPrompt.value = false;
  };

  /**
   * Manually trigger the prompt check (e.g., when notifications sheet opens)
   */
  const triggerPromptCheck = async () => {
    await initializePrompt();
  };

  return {
    shouldShowPrompt,
    isProcessing,
    initializePrompt,
    handleGrant,
    handleNotNow,
    handleNever,
    triggerPromptCheck
  };
};
