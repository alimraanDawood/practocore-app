# Notifications System

A comprehensive notification viewer component with real-time updates, filtering, and push notification support.

## Components

### `Notifications.vue`
The main notification viewer component displayed as a Sheet (side panel).

**Features:**
- Real-time notifications via PocketBase subscriptions
- Filter by: All, Read, Unread
- Pagination with infinite scroll
- Mark as read (single or all)
- Unread count badge
- Loading states
- Empty states

**Usage:**
```vue
<template>
  <SharedNotificationsNotifications>
    <Button>
      <Bell />
      View Notifications
    </Button>
  </SharedNotificationsNotifications>
</template>
```

### `Notification.vue`
Individual notification item component.

**Features:**
- Dynamic icons based on notification type
- Color coding by type (ERROR, WARNING, SUCCESS, INFO, REMINDER)
- Avatar support
- Unread indicator (left border + background highlight)
- Quick mark as read button (appears on hover)
- Action buttons support
- Read status badge
- Relative timestamps

**Notification Types:**
- `REMINDER` - Legal deadline reminders (Scale icon)
- `ERROR` - Error messages (AlertCircle icon, red color)
- `WARNING` - Warnings (AlertCircle icon, red color)
- `SUCCESS` - Success messages (CheckCircle icon, green color)
- `INFO` - Information (Info icon, blue color)
- `DEFAULT` - Generic notifications (Bell icon)

## Service Functions

Located in `services/notifications/index.ts`:

### `getNotifications(page, perPage, filter)`
Fetch paginated notifications with filtering.

```typescript
const notifications = await getNotifications(1, 20, 'unread');
```

### `markNotificationAsRead(notificationId)`
Mark a single notification as read.

```typescript
await markNotificationAsRead('abc123');
```

### `markAllNotificationsAsRead()`
Mark all user's notifications as read.

```typescript
await markAllNotificationsAsRead();
```

### `getUnreadCount()`
Get count of unread notifications.

```typescript
const count = await getUnreadCount();
```

### `subscribeToNotifications(callback)`
Subscribe to real-time notification updates.

```typescript
subscribeToNotifications((data) => {
  console.log('New notification:', data);
});
```

### `createNotification(data)`
Create a new notification.

```typescript
await createNotification({
  recipient: userId,
  organisation: orgId,
  title: 'Deadline Reminder',
  body: 'Case ABC123 deadline is tomorrow',
  type: 'REMINDER',
  actions: [
    { label: 'View Matter', url: '/main/matters/abc123' },
    { label: 'Dismiss', variant: 'ghost' }
  ]
});
```

## Database Schema

**Collection:** `Notifications`

| Field | Type | Description |
|-------|------|-------------|
| id | text | Unique identifier |
| recipient | relation | User receiving the notification |
| organisation | relation | Organisation context |
| title | text | Notification title |
| body | text | Notification body/description |
| dateSent | date | When notification was sent |
| sent | bool | Whether push notification was sent |
| avatar | url | Optional avatar URL |
| actions | json | Array of action buttons |
| read | bool | Read status |
| type | text | Notification type (REMINDER, ERROR, etc.) |
| created | autodate | Creation timestamp |
| updated | autodate | Update timestamp |

## Actions Format

Actions are stored as JSON array:

```json
[
  {
    "label": "View Matter",
    "url": "/main/matters/abc123",
    "variant": "default"
  },
  {
    "label": "Dismiss",
    "variant": "ghost"
  }
]
```

**Action Properties:**
- `label` (required): Button text
- `url` (optional): Navigation URL
- `variant` (optional): Button variant (default, destructive, outline, secondary, ghost, link)
- `callback` (optional): Named callback function to execute

## Real-time Updates

The component automatically subscribes to PocketBase real-time updates:

- **Create**: New notifications appear at the top
- **Update**: Existing notifications update in place
- **Delete**: Removed notifications disappear

Notifications are automatically filtered based on the current view (All/Read/Unread).

## Integration with Push Notifications

When a notification record is created in PocketBase, the `fcm.pb.js` hook automatically:
1. Fetches the recipient's device tokens
2. Sends push notifications to all their devices (web, Android, iOS)
3. Updates the `sent` field to `true`

See `/home/dawood/WebstormProjects/PractoCore/practocore-backend/pb_hooks/fcm.pb.js:151`

## Example: Creating a Deadline Reminder

```typescript
import { createNotification } from '~/services/notifications';

// When a deadline is approaching
await createNotification({
  recipient: matter.assignedTo,
  organisation: matter.organisation,
  title: 'Deadline Approaching',
  body: `${matter.title} deadline is in 2 days`,
  type: 'REMINDER',
  avatar: null,
  actions: [
    {
      label: 'View Matter',
      url: `/main/matters/${matter.id}`,
      variant: 'default'
    },
    {
      label: 'Snooze',
      variant: 'outline'
    }
  ],
  read: false
});
```

This will:
1. Create the notification in the database
2. Trigger FCM to send push notifications
3. Appear in real-time in the Notifications panel
4. Show on all user's devices (web, Android, iOS)

## Styling

The component uses:
- Shadcn UI components (Sheet, Button, Badge)
- TailwindCSS for styling
- Lucide icons
- Dark mode support

Unread notifications have:
- Left border (primary color)
- Subtle background highlight
- Bold title text
