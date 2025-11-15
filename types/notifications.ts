/**
 * Notification type definitions for PractoCore
 */

export type NotificationType = 'REMINDER' | 'ERROR' | 'WARNING' | 'SUCCESS' | 'INFO' | 'DEFAULT';

export interface NotificationAction {
  label: string;
  url?: string; // Internal route (e.g., "/main/matters/abc123")
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

/**
 * Helper function to create notification with matter link
 */
export function createMatterNotification(
  recipient: string,
  organisation: string,
  matterId: string,
  title: string,
  body: string,
  options?: Partial<CreateNotificationPayload>
): CreateNotificationPayload {
  return {
    recipient,
    organisation,
    title,
    body,
    type: 'INFO',
    metadata: {
      matterId,
      clickAction: `/main/matters/${matterId}`,
    },
    actions: [
      {
        label: 'View Matter',
        url: `/main/matters/${matterId}`,
        variant: 'default',
      },
    ],
    ...options,
  };
}

/**
 * Helper function to create notification with deadline link
 */
export function createDeadlineNotification(
  recipient: string,
  organisation: string,
  deadlineId: string,
  matterId: string,
  title: string,
  body: string,
  options?: Partial<CreateNotificationPayload>
): CreateNotificationPayload {
  return {
    recipient,
    organisation,
    title,
    body,
    type: 'REMINDER',
    metadata: {
      deadlineId,
      matterId,
      clickAction: `/main/matters/${matterId}#deadline-${deadlineId}`,
    },
    actions: [
      {
        label: 'View Deadline',
        url: `/main/matters/${matterId}#deadline-${deadlineId}`,
        variant: 'default',
      },
      {
        label: 'View Matter',
        url: `/main/matters/${matterId}`,
        variant: 'outline',
      },
    ],
    ...options,
  };
}
