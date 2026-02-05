/**
 * Push Notifications Type Definitions
 */

import type { RecordModel } from 'pocketbase';

/**
 * Device Token Record in PocketBase
 */
export interface DeviceTokenRecord extends RecordModel {
  user: string;
  token: string;
  platform: 'android' | 'ios' | 'web' | 'electron';
  device_info?: {
    model?: string;
    platform?: string;
    os_version?: string;
    manufacturer?: string;
  };
  is_active: boolean;
  last_updated: string;
}

/**
 * Push Notification Payload
 */
export interface PushNotificationPayload {
  user_ids: string[];
  title: string;
  body: string;
  data?: Record<string, any>;
  priority?: 'high' | 'normal';
  sound?: string;
  badge?: number;
}

/**
 * Organization Push Notification Payload
 */
export interface OrganizationPushPayload {
  organisation_id: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  priority?: 'high' | 'normal';
}

/**
 * Push Notification Response
 */
export interface PushNotificationResponse {
  success: boolean;
  sent: number;
  failed: number;
  results?: Array<{
    token: string;
    success: boolean;
  }>;
  errors?: Array<{
    token: string;
    error: string;
  }>;
}

/**
 * Notification Data Types
 */
export type NotificationDataType =
  | 'deadline_created'
  | 'deadline_approaching'
  | 'deadline_updated'
  | 'matter_created'
  | 'matter_updated'
  | 'invitation_received'
  | 'organization_announcement'
  | 'reminder'
  | 'test';

/**
 * Structured notification data
 */
export interface NotificationData {
  type: NotificationDataType;
  deadline_id?: string;
  matter_id?: string;
  organisation_id?: string;
  invitation_id?: string;
  [key: string]: any;
}

/**
 * Notification preference settings
 */
export interface NotificationPreferences {
  enabled: boolean;
  deadline_reminders: boolean;
  matter_updates: boolean;
  organization_announcements: boolean;
  invitation_alerts: boolean;
  sound_enabled: boolean;
  vibration_enabled: boolean;
}
