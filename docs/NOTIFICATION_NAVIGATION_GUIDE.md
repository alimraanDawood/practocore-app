# Notification Navigation & Actions Guide

This guide shows you how to add clickable links and actions to notifications that navigate to different parts of your app.

## Table of Contents
1. [Quick Start Examples](#quick-start-examples)
2. [Navigation Methods](#navigation-methods)
3. [Action Buttons](#action-buttons)
4. [Metadata & Click Actions](#metadata--click-actions)
5. [Helper Functions](#helper-functions)
6. [Real-World Examples](#real-world-examples)

---

## Quick Start Examples

### Example 1: Simple Matter Notification with Link

```typescript
import { createNotification } from '~/services/notifications';

// Create a notification that navigates to a specific matter when clicked
await createNotification({
  recipient: userId,
  organisation: orgId,
  title: 'New Matter Assigned',
  body: 'You have been assigned to Case ABC-123',
  type: 'INFO',
  metadata: {
    matterId: 'matter123',
    clickAction: '/main/matters/matter123' // Clicking notification body navigates here
  },
  actions: [
    {
      label: 'View Matter',
      url: '/main/matters/matter123',
      variant: 'default'
    }
  ]
});
```

### Example 2: Deadline Reminder with Multiple Actions

```typescript
import { createNotification } from '~/services/notifications';

await createNotification({
  recipient: userId,
  organisation: orgId,
  title: 'Deadline Approaching',
  body: 'Case ABC-123 deadline is tomorrow at 5:00 PM',
  type: 'REMINDER',
  metadata: {
    deadlineId: 'deadline456',
    matterId: 'matter123',
    clickAction: '/main/matters/matter123#deadline-deadline456' // Navigate with anchor
  },
  actions: [
    {
      label: 'View Deadline',
      url: '/main/matters/matter123#deadline-deadline456',
      variant: 'default'
    },
    {
      label: 'View Matter',
      url: '/main/matters/matter123',
      variant: 'outline'
    },
    {
      label: 'Snooze',
      url: '/main/settings/reminders',
      variant: 'ghost'
    }
  ]
});
```

---

## Navigation Methods

There are **three ways** to add navigation to notifications:

### 1. Click Action (Whole Notification Clickable)

The `metadata.clickAction` field makes the entire notification body clickable:

```typescript
metadata: {
  clickAction: '/main/matters/matter123' // Any internal route
}
```

**Behavior:**
- Clicking anywhere on the notification navigates to this URL
- Marks notification as read automatically
- Works with Nuxt's `navigateTo()`

### 2. Action Buttons (Multiple Navigation Options)

Add multiple action buttons with different destinations:

```typescript
actions: [
  {
    label: 'View Matter',
    url: '/main/matters/matter123',
    variant: 'default' // Button style
  },
  {
    label: 'Edit',
    url: '/main/matters/matter123/edit',
    variant: 'outline'
  }
]
```

**Behavior:**
- Each button can navigate to a different URL
- Clicking button marks notification as read
- Prevents event bubbling (won't trigger clickAction)

### 3. External Links

For external URLs (opens in new tab):

```typescript
actions: [
  {
    label: 'View Document',
    url: 'https://example.com/document.pdf',
    variant: 'link',
    external: true // Opens in new tab
  }
]
```

---

## Action Buttons

### Action Button Schema

```typescript
interface NotificationAction {
  label: string;          // Button text
  url?: string;           // Navigation URL
  variant?: string;       // UI variant: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
  callback?: string;      // Named callback function
  external?: boolean;     // Open in new tab
}
```

### Button Variants

```typescript
// Primary action
{ label: 'View', url: '/path', variant: 'default' }

// Destructive action
{ label: 'Delete', url: '/delete', variant: 'destructive' }

// Secondary action
{ label: 'Edit', url: '/edit', variant: 'outline' }

// Subtle action
{ label: 'Dismiss', variant: 'ghost' }

// Link style
{ label: 'Learn More', url: '/docs', variant: 'link' }
```

### Multiple Actions Example

```typescript
actions: [
  { label: 'Accept', url: '/invitations/accept/123', variant: 'default' },
  { label: 'Decline', url: '/invitations/decline/123', variant: 'destructive' },
  { label: 'View Details', url: '/invitations/123', variant: 'outline' }
]
```

---

## Metadata & Click Actions

### Metadata Schema

```typescript
interface NotificationMetadata {
  // Entity references
  matterId?: string;
  deadlineId?: string;
  adjournmentId?: string;
  userId?: string;
  organisationId?: string;

  // Navigation
  clickAction?: string;  // Main navigation URL

  // Custom fields
  [key: string]: any;
}
```

### Using Metadata

```typescript
// Store entity IDs for reference
metadata: {
  matterId: 'abc123',
  deadlineId: 'def456',
  clickAction: '/main/matters/abc123#deadline-def456',

  // Add custom data
  priority: 'high',
  dueDate: '2025-11-20',
  assignedBy: 'John Doe'
}
```

---

## Helper Functions

### Use Built-in Helper Functions

I've created helper functions for common notification types:

#### Matter Notification

```typescript
import { createMatterNotification } from '~/types/notifications';

const payload = createMatterNotification(
  userId,           // recipient
  orgId,            // organisation
  'matter123',      // matterId
  'New Matter',     // title
  'Case ABC-123 assigned to you', // body
  {
    // Optional: override defaults
    type: 'SUCCESS',
    avatar: 'https://example.com/avatar.jpg'
  }
);

await createNotification(payload);
```

**Default behavior:**
- Type: `INFO`
- Click action: `/main/matters/{matterId}`
- Action button: "View Matter"

#### Deadline Notification

```typescript
import { createDeadlineNotification } from '~/types/notifications';

const payload = createDeadlineNotification(
  userId,           // recipient
  orgId,            // organisation
  'deadline456',    // deadlineId
  'matter123',      // matterId
  'Deadline Tomorrow', // title
  'Case ABC-123 deadline at 5:00 PM', // body
  {
    // Optional: override defaults
    avatar: 'https://example.com/icon.png'
  }
);

await createNotification(payload);
```

**Default behavior:**
- Type: `REMINDER`
- Click action: `/main/matters/{matterId}#deadline-{deadlineId}`
- Two action buttons: "View Deadline" and "View Matter"

---

## Real-World Examples

### 1. Matter Assignment Notification

```typescript
// When a matter is assigned to a user
import { createNotification } from '~/services/notifications';

async function notifyMatterAssignment(matter, assignedUser) {
  await createNotification({
    recipient: assignedUser.id,
    organisation: matter.organisation,
    title: `New Matter: ${matter.title}`,
    body: `You have been assigned to handle ${matter.caseNumber}`,
    type: 'INFO',
    metadata: {
      matterId: matter.id,
      clickAction: `/main/matters/${matter.id}`,
      assignedBy: currentUser.name,
      assignedAt: new Date().toISOString()
    },
    actions: [
      {
        label: 'View Matter',
        url: `/main/matters/${matter.id}`,
        variant: 'default'
      },
      {
        label: 'View All Matters',
        url: '/main/matters',
        variant: 'outline'
      }
    ]
  });
}
```

### 2. Deadline Reminder (24 Hours Before)

```typescript
// Automated reminder system
import { createDeadlineNotification } from '~/types/notifications';

async function sendDeadlineReminder(deadline, matter, user) {
  const payload = createDeadlineNotification(
    user.id,
    matter.organisation,
    deadline.id,
    matter.id,
    `Deadline Tomorrow: ${matter.title}`,
    `${deadline.title} is due tomorrow at ${formatTime(deadline.dueDate)}`,
    {
      avatar: null,
      metadata: {
        ...createDeadlineNotification.metadata,
        reminderType: '24hours',
        dueDate: deadline.dueDate,
        priority: deadline.priority
      }
    }
  );

  await createNotification(payload);
}
```

### 3. Adjournment Approved

```typescript
// When an adjournment request is approved
async function notifyAdjournmentApproval(adjournment, matter, user) {
  await createNotification({
    recipient: user.id,
    organisation: matter.organisation,
    title: 'Adjournment Approved',
    body: `Your adjournment request for ${matter.title} has been approved`,
    type: 'SUCCESS',
    metadata: {
      matterId: matter.id,
      adjournmentId: adjournment.id,
      clickAction: `/main/matters/${matter.id}#adjournment-${adjournment.id}`,
      approvedBy: currentUser.name,
      newDate: adjournment.newDate
    },
    actions: [
      {
        label: 'View Adjournment',
        url: `/main/matters/${matter.id}#adjournment-${adjournment.id}`,
        variant: 'default'
      },
      {
        label: 'View Matter',
        url: `/main/matters/${matter.id}`,
        variant: 'outline'
      }
    ]
  });
}
```

### 4. Invitation to Organization

```typescript
// When user is invited to join organization
async function notifyOrganizationInvite(invite, orgName, invitedUser) {
  await createNotification({
    recipient: invitedUser.id,
    organisation: invite.organisation,
    title: `Invitation to ${orgName}`,
    body: `You've been invited to join ${orgName}`,
    type: 'INFO',
    metadata: {
      inviteId: invite.id,
      clickAction: `/org-switch?invite=${invite.id}`,
      invitedBy: invite.createdBy,
      role: invite.role
    },
    actions: [
      {
        label: 'Accept',
        url: `/api/invitations/accept/${invite.id}`,
        variant: 'default'
      },
      {
        label: 'Decline',
        url: `/api/invitations/decline/${invite.id}`,
        variant: 'destructive'
      },
      {
        label: 'View Details',
        url: `/org-switch?invite=${invite.id}`,
        variant: 'outline'
      }
    ]
  });
}
```

### 5. Document Upload Complete

```typescript
// When document processing is complete
async function notifyDocumentReady(document, matter, user) {
  await createNotification({
    recipient: user.id,
    organisation: matter.organisation,
    title: 'Document Ready',
    body: `${document.name} has been processed and is ready to view`,
    type: 'SUCCESS',
    metadata: {
      documentId: document.id,
      matterId: matter.id,
      clickAction: `/main/matters/${matter.id}/documents/${document.id}`,
      documentType: document.type,
      fileSize: document.size
    },
    actions: [
      {
        label: 'View Document',
        url: `/main/matters/${matter.id}/documents/${document.id}`,
        variant: 'default'
      },
      {
        label: 'Download',
        url: document.downloadUrl,
        variant: 'outline',
        external: true
      }
    ]
  });
}
```

### 6. Error Notification

```typescript
// When something goes wrong
async function notifyError(user, errorMessage, context) {
  await createNotification({
    recipient: user.id,
    organisation: user.organisation,
    title: 'Action Failed',
    body: errorMessage,
    type: 'ERROR',
    metadata: {
      errorCode: context.errorCode,
      timestamp: new Date().toISOString(),
      clickAction: '/main/settings/support'
    },
    actions: [
      {
        label: 'Contact Support',
        url: '/main/settings/support',
        variant: 'default'
      },
      {
        label: 'View Logs',
        url: '/main/settings/activity',
        variant: 'outline'
      }
    ]
  });
}
```

---

## PocketBase Storage

Notifications are stored in the `Notifications` collection. The `metadata` and `actions` fields are JSON fields:

```javascript
// Example PocketBase record
{
  "id": "abc123",
  "recipient": "user456",
  "organisation": "org789",
  "title": "Deadline Tomorrow",
  "body": "Case ABC-123 deadline at 5:00 PM",
  "type": "REMINDER",
  "read": false,
  "sent": true,
  "metadata": {
    "deadlineId": "deadline456",
    "matterId": "matter123",
    "clickAction": "/main/matters/matter123#deadline-deadline456"
  },
  "actions": [
    {
      "label": "View Deadline",
      "url": "/main/matters/matter123#deadline-deadline456",
      "variant": "default"
    },
    {
      "label": "View Matter",
      "url": "/main/matters/matter123",
      "variant": "outline"
    }
  ],
  "created": "2025-11-15T10:00:00Z",
  "updated": "2025-11-15T10:00:00Z"
}
```

---

## Best Practices

### 1. Always Provide Click Actions
Make notifications interactive - always include either `metadata.clickAction` or `actions`:

```typescript
// ✅ Good: Clickable notification
metadata: {
  clickAction: '/main/matters/123'
}

// ❌ Bad: No navigation
metadata: {}
```

### 2. Use Descriptive Action Labels
```typescript
// ✅ Good: Clear action
{ label: 'View Matter Details', url: '...' }

// ❌ Bad: Vague action
{ label: 'Click Here', url: '...' }
```

### 3. Limit Number of Actions
Don't overwhelm users - keep it to 2-3 actions max:

```typescript
// ✅ Good: 2-3 focused actions
actions: [
  { label: 'Accept', url: '...' },
  { label: 'Decline', url: '...' }
]

// ❌ Bad: Too many options
actions: [
  { label: 'Accept', ... },
  { label: 'Decline', ... },
  { label: 'Maybe', ... },
  { label: 'Details', ... },
  { label: 'Settings', ... }
]
```

### 4. Store Entity IDs in Metadata
Always store relevant IDs for future reference:

```typescript
metadata: {
  matterId: 'abc123',
  deadlineId: 'def456',
  userId: 'user789',
  clickAction: '/main/matters/abc123'
}
```

### 5. Use Appropriate Types
Match notification type to the message:

- `REMINDER` - Deadlines, appointments
- `ERROR` - Failures, problems
- `WARNING` - Important alerts
- `SUCCESS` - Completions, approvals
- `INFO` - General updates

---

## Testing Navigation

### Test in Browser Console

```javascript
// Import service
import { createNotification } from '~/services/notifications';

// Get current user from PocketBase
const { $pb } = useNuxtApp();
const user = $pb.authStore.model;

// Create test notification
await createNotification({
  recipient: user.id,
  organisation: user.organisation,
  title: 'Test Notification',
  body: 'Click me to navigate!',
  type: 'INFO',
  metadata: {
    clickAction: '/main/matters'
  },
  actions: [
    {
      label: 'Go to Matters',
      url: '/main/matters',
      variant: 'default'
    }
  ]
});
```

---

## Troubleshooting

### Navigation Not Working?

1. **Check URL format:**
   ```typescript
   // ✅ Correct
   clickAction: '/main/matters/123'

   // ❌ Wrong (missing leading slash)
   clickAction: 'main/matters/123'
   ```

2. **Check notification metadata:**
   ```javascript
   console.log(notification.metadata?.clickAction);
   ```

3. **Check action handler:**
   Look in browser console for logs when clicking actions.

### Actions Not Appearing?

1. **Verify JSON structure:**
   ```typescript
   actions: [  // Must be an array
     { label: '...', url: '...' }
   ]
   ```

2. **Check component props:**
   ```vue
   <SharedNotificationsNotification
     :notification="notification"
     @mark-as-read="handleMarkAsRead"
   />
   ```

---

## Summary

- **Click Action**: Makes whole notification clickable → `metadata.clickAction`
- **Action Buttons**: Multiple navigation options → `actions` array
- **Helper Functions**: Use `createMatterNotification()` and `createDeadlineNotification()`
- **Entity IDs**: Store in `metadata` for reference
- **Navigation**: Uses Nuxt's `navigateTo()` for internal routes
- **External Links**: Set `external: true` to open in new tab

**File Locations:**
- Types: `/home/dawood/WebstormProjects/PractoCore/practocore-app/types/notifications.ts`
- Service: `/home/dawood/WebstormProjects/PractoCore/practocore-app/services/notifications/index.ts`
- Component: `/home/dawood/WebstormProjects/PractoCore/practocore-app/components/shared/Notifications/Notification.vue`
