// Platform detection utility
import { Capacitor } from '@capacitor/core';

export function isMobile(): boolean {
    return Capacitor.isNativePlatform() && (Capacitor.getPlatform() === 'android' || Capacitor.getPlatform() === 'ios');
}

export function isDesktop(): boolean {
    // Check if we're running in Tauri
    return typeof window !== 'undefined' && '__TAURI__' in window;
}

export function getPlatformType(): 'mobile' | 'desktop' | 'web' {
    if (isMobile()) {
        return 'mobile';
    }
    if (isDesktop()) {
        return 'desktop';
    }
    return 'web';
}
