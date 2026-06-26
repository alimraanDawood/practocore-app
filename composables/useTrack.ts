import { track, isFeatureEnabled, type TrackEvent } from '~/utils/analytics'

/**
 * Composable form of the analytics tracker for use in component setup.
 * Delegates to ~/utils/analytics (backed by the posthog-js singleton), so it
 * behaves identically whether called from a component or a service module.
 *
 *   const { track } = useTrack()
 *   track('document_generated', { kind: 'plaint' })
 */
export function useTrack() {
    return { track, isEnabled: isFeatureEnabled }
}

export type { TrackEvent }
