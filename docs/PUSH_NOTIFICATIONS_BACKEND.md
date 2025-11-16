# Push Notifications Backend Setup (PocketBase)

This guide covers the backend setup required for push notifications in PocketBase.

## 1. Create DeviceTokens Collection

In your PocketBase admin panel, create a new collection called `DeviceTokens` with the following schema:

### Fields:

```
user (Relation)
  - Type: Relation
  - Collection: Users
  - Single
  - Required: Yes

token (Text)
  - Type: Text
  - Required: Yes
  - Max length: 500

platform (Select)
  - Type: Select
  - Options: android, ios, web
  - Required: Yes

device_info (JSON)
  - Type: JSON
  - Required: No

is_active (Bool)
  - Type: Bool
  - Required: Yes
  - Default: true

last_updated (Date)
  - Type: Date
  - Required: Yes
```

### Indexes:
- Create index on: `user, token` (for efficient lookups)
- Create index on: `user, is_active` (for active token queries)

### API Rules:

**List/Search Rule:**
```javascript
@request.auth.id != "" && user = @request.auth.id
```

**View Rule:**
```javascript
@request.auth.id != "" && user = @request.auth.id
```

**Create Rule:**
```javascript
@request.auth.id != "" && @request.data.user = @request.auth.id
```

**Update Rule:**
```javascript
@request.auth.id != "" && user = @request.auth.id
```

**Delete Rule:**
```javascript
@request.auth.id != "" && user = @request.auth.id
```

## 2. Get Firebase Service Account Credentials (FCM HTTP v1 API)

The legacy FCM API is deprecated. You must use the newer FCM HTTP v1 API.

1. Go to Firebase Console: https://console.firebase.google.com/
2. Select your project (`practocore-72f49`)
3. Go to **Project Settings** → **Service Accounts**
4. Click **"Generate New Private Key"**
5. Save the JSON file (e.g., `firebase-service-account.json`)
6. **Enable Cloud Messaging API:**
   - Go to: https://console.cloud.google.com/apis/library/fcm.googleapis.com
   - Select your project
   - Click **"Enable"**

**Security:** Keep this JSON file secure and never commit it to version control!

## 3. Create Custom API Endpoints in PocketBase

You'll need to create a Node.js microservice to handle FCM HTTP v1 API calls, then create PocketBase JavaScript hooks to call this service.

### Step 1: Create Node.js FCM Microservice

This service handles the FCM HTTP v1 API authentication and message sending.

#### File: `fcm-service/index.js`

```javascript
const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');

// Initialize Firebase Admin SDK
const serviceAccount = require('./firebase-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const app = express();
app.use(express.json());
app.use(cors());

// Send notification endpoint
app.post('/send', async (req, res) => {
  try {
    const { tokens, title, body, data } = req.body;

    if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
      return res.status(400).json({ error: 'tokens array required' });
    }

    const messages = tokens.map(token => ({
      token,
      notification: { title, body },
      data: data || {},
      android: {
        priority: 'high',
        notification: {
          sound: 'default'
        }
      }
    }));

    const response = await admin.messaging().sendEach(messages);

    res.json({
      success: true,
      sent: response.successCount,
      failed: response.failureCount,
      responses: response.responses
    });
  } catch (error) {
    console.error('FCM Error:', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`FCM Service running on port ${PORT}`);
});
```

#### Setup:

```bash
mkdir fcm-service && cd fcm-service
npm init -y
npm install express firebase-admin cors
# Place your firebase-service-account.json in this directory
node index.js
```

### Step 2: Create PocketBase JavaScript Hooks

Create PocketBase hooks that call the FCM microservice:

#### File: `pb_hooks/push_notifications.pb.js`

```javascript
/// <reference path="../pb_data/types.d.ts" />

const FCM_SERVICE_URL = "http://localhost:3001"; // Your FCM microservice

/**
 * Send push notification via FCM service
 */
function sendFCMNotification(tokens, title, body, data) {
  const response = $http.send({
    url: `${FCM_SERVICE_URL}/send`,
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      tokens: tokens,
      title: title,
      body: body,
      data: data || {}
    }),
    timeout: 10
  });

  if (response.statusCode !== 200) {
    console.error("FCM Service Error:", response.statusCode, response.raw);
    throw new Error(`FCM request failed: ${response.statusCode}`);
  }

  return response.json;
}

/**
 * API endpoint to send push notification to specific users
 */
routerAdd("POST", "/api/push-notifications/send", (c) => {
  // Check authentication
  const authRecord = c.get("authRecord");
  if (!authRecord) {
    throw new UnauthorizedError("Authentication required");
  }

  // Parse request body
  const data = new DynamicModel({
    user_ids: [],
    title: "",
    body: "",
    data: {}
  });
  c.bind(data);

  if (!data.user_ids || data.user_ids.length === 0) {
    throw new BadRequestError("user_ids is required");
  }

  if (!data.title || !data.body) {
    throw new BadRequestError("title and body are required");
  }

  // Get active device tokens for specified users
  const tokens = arrayOf(new Record);
  try {
    $app.dao().recordQuery("DeviceTokens")
      .andWhere($dbx.in("user", data.user_ids))
      .andWhere($dbx.hashExp({"is_active": true}))
      .all(tokens);
  } catch (err) {
    throw new BadRequestError("Error fetching device tokens: " + err.message);
  }

  // Collect all tokens
  const tokenList = [];
  tokens.forEach((tokenRecord) => {
    tokenList.push(tokenRecord.getString("token"));
  });

  // Send to FCM service
  try {
    const result = sendFCMNotification(tokenList, data.title, data.body, data.data);
    return c.json(200, result);
  } catch (err) {
    throw new BadRequestError("Failed to send notifications: " + err.message);
  }
}, $apis.requireAuth());

/**
 * API endpoint to send push notification to all users in an organization
 */
routerAdd("POST", "/api/push-notifications/send-to-org", (c) => {
  // Check authentication
  const authRecord = c.get("authRecord");
  if (!authRecord) {
    throw new UnauthorizedError("Authentication required");
  }

  // Parse request body
  const data = new DynamicModel({
    organisation_id: "",
    title: "",
    body: "",
    data: {}
  });
  c.bind(data);

  if (!data.organisation_id) {
    throw new BadRequestError("organisation_id is required");
  }

  if (!data.title || !data.body) {
    throw new BadRequestError("title and body are required");
  }

  // Get all users in the organization
  const orgUsers = arrayOf(new Record);
  try {
    $app.dao().recordQuery("Users")
      .andWhere($dbx.hashExp({"organisation": data.organisation_id}))
      .all(orgUsers);
  } catch (err) {
    throw new BadRequestError("Error fetching organization users: " + err.message);
  }

  const userIds = orgUsers.map((user) => user.id);

  // Get active device tokens for these users
  const tokens = arrayOf(new Record);
  try {
    $app.dao().recordQuery("DeviceTokens")
      .andWhere($dbx.in("user", userIds))
      .andWhere($dbx.hashExp({"is_active": true}))
      .all(tokens);
  } catch (err) {
    throw new BadRequestError("Error fetching device tokens: " + err.message);
  }

  // Collect all tokens
  const tokenList = [];
  tokens.forEach((tokenRecord) => {
    tokenList.push(tokenRecord.getString("token"));
  });

  // Send to FCM service
  try {
    const result = sendFCMNotification(tokenList, data.title, data.body, data.data);
    return c.json(200, result);
  } catch (err) {
    throw new BadRequestError("Failed to send notifications: " + err.message);
  }
}, $apis.requireAuth());

/**
 * Hook to send push notifications when a new deadline is created
 * Example of automatic push notifications
 */
onRecordAfterCreateRequest((e) => {
  if (e.collection.name !== "Deadlines") {
    return;
  }

  const deadline = e.record;

  // Get the matter to find related users
  const matter = $app.dao().findRecordById("Matters", deadline.getString("matter"));
  const organisation = matter.getString("organisation");

  // Get all users in this organization
  const orgUsers = arrayOf(new Record);
  $app.dao().recordQuery("Users")
    .andWhere($dbx.hashExp({"organisation": organisation}))
    .all(orgUsers);

  const userIds = orgUsers.map((user) => user.id);

  // Get active device tokens
  const tokens = arrayOf(new Record);
  $app.dao().recordQuery("DeviceTokens")
    .andWhere($dbx.in("user", userIds))
    .andWhere($dbx.hashExp({"is_active": true}))
    .all(tokens);

  // Collect all tokens and send notification
  const tokenList = [];
  tokens.forEach((tokenRecord) => {
    tokenList.push(tokenRecord.getString("token"));
  });

  if (tokenList.length > 0) {
    try {
      sendFCMNotification(
        tokenList,
        "New Deadline Created",
        `A new deadline has been added to ${matter.getString("title")}`,
        {
          type: "deadline_created",
          deadline_id: deadline.id,
          matter_id: matter.id
        }
      );
    } catch (err) {
      console.error("Failed to send push notification:", err);
    }
  }
}, "Deadlines");
```

## 4. Testing Your Setup

### Test Token Registration:

```bash
# After running your app and granting permissions, check PocketBase:
# Go to Collections > DeviceTokens
# You should see a new record with your device token
```

### Test Sending Notification:

```bash
# Using curl (replace with your actual values):
curl -X POST http://10.15.128.175:8090/api/push-notifications/send \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_USER_TOKEN" \
  -d '{
    "user_ids": ["USER_ID_HERE"],
    "title": "Test Notification",
    "body": "This is a test push notification",
    "data": {
      "type": "test",
      "custom_field": "custom_value"
    }
  }'
```

### Test from Frontend:

```typescript
import { sendPushNotification } from '~/services/notifications';

// Send to specific users
await sendPushNotification({
  user_ids: ['user123', 'user456'],
  title: 'New Deadline',
  body: 'A deadline is approaching',
  data: {
    deadline_id: 'deadline123',
    matter_id: 'matter456'
  }
});
```

## 6. Common Use Cases

### Send notification when deadline is approaching:

```javascript
// In PocketBase hook
onRecordAfterUpdateRequest((e) => {
  const deadline = e.record;
  // Check if deadline is within 24 hours
  // Send notification to relevant users
}, "Deadlines");
```

### Send notification when user is invited to organization:

```javascript
onRecordAfterCreateRequest((e) => {
  const invite = e.record;
  const invitedUser = invite.getString("invitedUser");

  // Send push notification
  // ...
}, "OrganisationDirectInvites");
```

## 7. Security Considerations

1. **Never expose FCM Server Key in frontend code**
2. **Always validate user permissions before sending notifications**
3. **Rate limit notification sending to prevent abuse**
4. **Clean up inactive tokens periodically**
5. **Implement user preferences for notification types**

## 8. Troubleshooting

### Notifications not received:
- Check FCM Server Key is correct
- Verify google-services.json matches your Firebase project
- Check device token is saved in DeviceTokens collection
- Verify `is_active` is true for the token
- Check Android notification permissions are granted

### Token not saving:
- Check PocketBase collection rules
- Verify user is authenticated when registering
- Check browser console for errors

### FCM errors:
- Check Firebase Cloud Messaging API is enabled
- Verify Server Key hasn't expired
- Check token format is valid
