/**
 * Notification type definitions for PractoCore
 */

export type NotificationType = 'REMINDER' | 'ERROR' | 'WARNING' | 'SUCCESS' | 'INFO' | 'DEFAULT';

export interface NotificationAction {
  label: string;
  url?: string; // Internal route (e.g., "/main/matters/matter/abc123")
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  callback?: string; // Name of a callback function to execute
  external?: boolean; // Whether URL is external (opens in new tab)
}

export interface NotificationMetadata {
  // Links to related entities
  matterId?: string;
  deadlineId?: string;
  adjournmentId?: string;
  userId?: string;
  organisationId?: string;

  // Custom navigation
  clickAction?: string; // URL to navigate to when notification body is clicked

  // Additional data
  [key: string]: any;
}

export interface Notification {
  id: string;
  recipient: string; // User ID
  organisation: string; // Organisation ID
  title: string;
  body?: string;
  dateSent?: string;
  sent: boolean;
  avatar?: string;
  actions?: NotificationAction[];
  read: boolean;
  type?: NotificationType;
  metadata?: NotificationMetadata; // Store as JSON in PocketBase
  created: string;
  updated: string;
}

export interface NotificationListResponse {
  page: number;
  perPage: number;
  totalItems: number;
  totalPages: number;
  items: Notification[];
}

export interface CreateNotificationPayload {
  recipient: string;
  organisation: string;
  title: string;
  body?: string;
  type?: NotificationType;
  avatar?: string;
  actions?: NotificationAction[];
  metadata?: NotificationMetadata;
  read?: boolean;
  sent?: boolean;
}
