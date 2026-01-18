import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

const INTRO_SEEN_KEY = 'practocore_intro_seen';

/**
 * Composable to manage intro screen state for Capacitor apps
 */
export function useIntro() {
  /**
   * Check if we're running on a native Capacitor platform (Android/iOS)
   */
  const isNativePlatform = () => {
    return Capacitor.isNativePlatform();
  };

  /**
   * Check if the intro has been seen before
   */
  const hasSeenIntro = async (): Promise<boolean> => {
    if (!isNativePlatform()) {
      return true; // Web users skip intro
    }

    try {
      const { value } = await Preferences.get({ key: INTRO_SEEN_KEY });
      return value === 'true';
    } catch (error) {
      console.error('Error checking intro state:', error);
      return false;
    }
  };

  /**
   * Mark the intro as seen
   */
  const markIntroSeen = async (): Promise<void> => {
    try {
      await Preferences.set({
        key: INTRO_SEEN_KEY,
        value: 'true',
      });
    } catch (error) {
      console.error('Error saving intro state:', error);
    }
  };

  /**
   * Reset intro state (useful for testing or settings)
   */
  const resetIntro = async (): Promise<void> => {
    try {
      await Preferences.remove({ key: INTRO_SEEN_KEY });
    } catch (error) {
      console.error('Error resetting intro state:', error);
    }
  };

  /**
   * Check if intro should be shown
   * Returns true if: native platform AND intro not seen AND user not authenticated
   */
  const shouldShowIntro = async (isAuthenticated: boolean): Promise<boolean> => {
    // Only show intro on native platforms
    if (!isNativePlatform()) {
      return false;
    }

    // If user is already authenticated, don't show intro
    if (isAuthenticated) {
      return false;
    }

    // Check if intro has been seen
    const seen = await hasSeenIntro();
    return !seen;
  };

  return {
    isNativePlatform,
    hasSeenIntro,
    markIntroSeen,
    resetIntro,
    shouldShowIntro,
  };
}