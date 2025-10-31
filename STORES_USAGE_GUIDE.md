# Store Usage Guide

This guide explains how to use the improved store architecture with smart caching, optimistic updates, and realtime subscriptions.

## Overview

The new store architecture provides:

1. **Smart Caching** - Data is cached with configurable TTL to reduce API calls
2. **Optimistic Updates** - UI updates immediately, rolls back on error
3. **Background Refresh** - Stale data refreshes without blocking UI
4. **Realtime Subscriptions** - Automatic updates from PocketBase
5. **Error Handling** - Proper error states and rollback mechanisms

## Stores

### 1. Templates Store (`useTemplatesStore`)

**Cache Duration:** 5 minutes

**Features:**
- Template list with pagination
- Individual template caching
- All templates for dropdowns
- Realtime subscriptions
- Optimistic CRUD operations

**Basic Usage:**

```vue
<script setup lang="ts">
import { useTemplatesStore } from '~/stores/templates'

const templatesStore = useTemplatesStore()

// Fetch all templates (for dropdowns)
await templatesStore.fetchAllTemplates()

// Fetch paginated templates
await templatesStore.fetchTemplates(1, 10, {
  sort: '-created',
  filter: 'name ~ "tax"',
  expand: 'author'
})

// Access data
const allTemplates = computed(() => templatesStore.allTemplates)
const templates = computed(() => templatesStore.listCache?.items || [])
const loading = computed(() => templatesStore.loading)

// Setup realtime subscription (call in onMounted)
onMounted(() => {
  templatesStore.ensureSubscribed()
})

// Cleanup (call in onUnmounted)
onUnmounted(() => {
  templatesStore.unsubscribe()
})
</script>
```

**CRUD Operations:**

```typescript
// Fetch single template (uses cache)
const template = await templatesStore.fetchTemplate('template_id')

// Get from cache only (no API call)
const cached = templatesStore.getTemplateById('template_id')

// Create template (optimistic update)
try {
  const newTemplate = await templatesStore.createNewTemplate({
    name: 'Tax Court Template',
    version: '1.0',
    fields: [],
    deadlines: []
  })
  // UI updates immediately, API call happens in background
} catch (error) {
  // Rolled back automatically
}

// Update template (optimistic update)
try {
  await templatesStore.updateExistingTemplate('template_id', {
    name: 'Updated Name'
  })
} catch (error) {
  // Rolled back automatically
}

// Force refresh (bypass cache)
await templatesStore.fetchAllTemplates(true)
await templatesStore.fetchTemplate('template_id', true)
```

---

### 2. Enhanced Matters Store (`useMattersStore`)

**Cache Duration:** 5 minutes (increased from 1 minute)

**New Features:**
- Individual matter caching
- Background refresh when cache is 75% stale
- Optimistic updates
- Improved realtime subscriptions

**Basic Usage:**

```vue
<script setup lang="ts">
import { useMattersStore } from '~/stores/matters'

const mattersStore = useMattersStore()

// Set filters
mattersStore.query = 'search term'
mattersStore.activeTab = 'organisation'
mattersStore.page = 1

// Fetch matters (uses cache automatically)
await mattersStore.fetchMatters()

// Access data
const matters = computed(() => mattersStore.items)
const total = computed(() => mattersStore.totalItems)
const loading = computed(() => mattersStore.loading)

// Setup subscription
onMounted(() => {
  mattersStore.ensureSubscribed()
})
</script>
```

**Optimistic Updates:**

```typescript
// Update matter immediately (no API call needed in component)
mattersStore.updateMatterOptimistic('matter_id', {
  name: 'Updated Matter Name',
  status: 'active'
})

// Add matter optimistically
mattersStore.addMatterOptimistic({
  id: 'new_id',
  name: 'New Matter',
  personal: false
})

// Remove from cache
mattersStore.removeMatterFromCache('matter_id')

// Force refresh in background (doesn't block UI)
mattersStore.fetchMattersInBackground()
```

**Get Single Matter from Cache:**

```typescript
// Get matter by ID from cache (no API call)
const matter = mattersStore.getMatterById('matter_id')
if (!matter) {
  // Not in cache, fetch from API
  // ... call your matter service
}
```

---

### 3. Profile Store (`useProfileStore`)

**Cache Duration:** 10 minutes

**Features:**
- User data caching
- User preferences caching
- Optimistic updates
- Realtime subscriptions

**Basic Usage:**

```vue
<script setup lang="ts">
import { useProfileStore } from '~/stores/profile'

const profileStore = useProfileStore()

// Fetch user data (uses cache)
await profileStore.fetchUser()

// Fetch preferences (uses cache)
await profileStore.fetchPreferences()

// Fetch both at once
await profileStore.fetchAll()

// Access data
const user = computed(() => profileStore.user)
const preferences = computed(() => profileStore.preferences)
const displayName = computed(() => profileStore.displayName)
const initials = computed(() => profileStore.initials)

// Loading states
const loading = computed(() => profileStore.loadingUser || profileStore.loadingPreferences)

// Setup subscription
onMounted(() => {
  profileStore.ensureSubscribed()
})

onUnmounted(() => {
  profileStore.unsubscribe()
})
</script>
```

**Update Operations:**

```typescript
// Update user (optimistic)
try {
  await profileStore.updateUserData({
    name: 'New Name',
    timezone: 'Africa/Lagos'
  })
  // UI updates immediately
} catch (error) {
  // Rolled back automatically
  console.error('Update failed:', error)
}

// Update preferences (optimistic)
try {
  await profileStore.updatePreferencesData({
    emailNotifications: true,
    reminderTime: '09:00'
  })
} catch (error) {
  // Rolled back automatically
}

// Clear cache on logout
profileStore.clearCache()

// Force refresh in background
profileStore.refreshInBackground()
```

---

### 4. Organisation Store (`useOrganisationStore`)

**Cache Durations:**
- Organization data: 10 minutes
- Members: 5 minutes
- Invites: 2 minutes

**Features:**
- Organization data caching
- Members list with pagination
- Invites list with pagination
- Realtime subscriptions for invites
- Optimistic updates for all operations

**Basic Usage:**

```vue
<script setup lang="ts">
import { useOrganisationStore } from '~/stores/organisation'
import { useProfileStore } from '~/stores/profile'

const orgStore = useOrganisationStore()
const profileStore = useProfileStore()

// Get organization ID from user
const user = await profileStore.fetchUser()
const orgId = user.organisation

// Fetch organization data
await orgStore.fetchOrganisation(orgId)

// Access data
const org = computed(() => orgStore.organisation)
const loading = computed(() => orgStore.loadingOrg)
</script>
```

**Members Management:**

```typescript
// Fetch members (uses cache)
await orgStore.fetchMembers(1, 10, {
  filter: 'role = "admin"',
  sort: 'name',
  expand: 'avatar'
})

// Access members
const members = computed(() => orgStore.members)
const stats = computed(() => orgStore.memberStats)
// stats = { total, admins, moderators, members }

// Update member role (optimistic)
await orgStore.updateMemberRoleOptimistic(userId, orgId, 'admin')

// Remove member (optimistic)
await orgStore.removeMemberOptimistic(userId, orgId)

// Bulk update
await orgStore.bulkUpdateMembersOptimistic(
  ['user1', 'user2'],
  orgId,
  'promote_to_admin'
)

// Transfer ownership
await orgStore.transferOwnershipOptimistic(newOwnerId, orgId)

// Get member details (cached)
const memberDetails = await orgStore.fetchMemberDetails(userId)

// Background refresh
orgStore.fetchMembersInBackground()
```

**Invites Management:**

```typescript
// Fetch invites (uses cache)
await orgStore.fetchInvites(1, 10, {
  filter: 'status = "pending"',
  sort: '-created'
})

// Access invites
const invites = computed(() => orgStore.invites)
const stats = computed(() => orgStore.inviteStats)
// stats = { total, pending, accepted, expired, rejected }

// Setup realtime subscription
onMounted(() => {
  orgStore.ensureInvitesSubscribed()
})

// Send invite (optimistic)
await orgStore.sendDirectInviteOptimistic(
  'user@example.com',
  orgId,
  'member',
  'John Doe'
)

// Resend invite
await orgStore.resendInviteOptimistic(inviteId)

// Revoke invite (optimistic)
await orgStore.revokeInviteOptimistic(inviteId)

// Background refresh
orgStore.fetchInvitesInBackground()
```

**Update Organization:**

```typescript
// Update organization data (optimistic)
await orgStore.updateOrganisationData(orgId, {
  name: 'New Name',
  legalBusinessName: 'Legal Name Ltd',
  emailDomain: 'company.com'
})
```

---

## Component Migration Examples

### Before (No Store):

```vue
<script setup lang="ts">
const loading = ref(true)
const templates = ref([])

onMounted(async () => {
  loading.value = true
  try {
    const result = await getAllTemplates()
    templates.value = result
  } catch (error) {
    console.error(error)
  } finally {
    loading.value = false
  }
})
</script>
```

### After (With Store):

```vue
<script setup lang="ts">
import { useTemplatesStore } from '~/stores/templates'

const templatesStore = useTemplatesStore()

// Just fetch once - cache handles the rest
onMounted(async () => {
  await templatesStore.fetchAllTemplates()
  templatesStore.ensureSubscribed()
})

// Access directly from store
const templates = computed(() => templatesStore.allTemplates)
const loading = computed(() => templatesStore.loading)
</script>
```

**Benefits:**
- ✅ No redundant API calls on revisit
- ✅ Automatic updates via subscription
- ✅ Shared state across components
- ✅ Loading state handled automatically

---

### Profile Settings Component Migration:

**Before:**

```vue
<script setup lang="ts">
const loading = ref(true)
const user = ref(null)
const preferences = ref(null)

onMounted(async () => {
  loading.value = true
  try {
    user.value = getSignedInUser()
    preferences.value = await getUserPreferences()
  } catch (error) {
    console.error(error)
  } finally {
    loading.value = false
  }
})

const updateProfile = async (values) => {
  // UI waits for API
  await updateUser(values)
  user.value = getSignedInUser()
}
</script>
```

**After:**

```vue
<script setup lang="ts">
import { useProfileStore } from '~/stores/profile'

const profileStore = useProfileStore()

onMounted(async () => {
  await profileStore.fetchAll()
  profileStore.ensureSubscribed()
})

// Computed from store
const user = computed(() => profileStore.user)
const preferences = computed(() => profileStore.preferences)
const loading = computed(() => profileStore.loadingUser || profileStore.loadingPreferences)

const updateProfile = async (values) => {
  // UI updates immediately, API happens in background
  await profileStore.updateUserData(values)
}
</script>
```

---

## Best Practices

### 1. Call `ensureSubscribed()` in `onMounted`

```typescript
onMounted(() => {
  templatesStore.ensureSubscribed()
  orgStore.ensureInvitesSubscribed()
  profileStore.ensureSubscribed()
  mattersStore.ensureSubscribed()
})
```

### 2. Cleanup subscriptions in `onUnmounted` (if needed)

```typescript
onUnmounted(() => {
  templatesStore.unsubscribe()
  profileStore.unsubscribe()
})
```

### 3. Use computed properties for reactivity

```typescript
// Good ✅
const templates = computed(() => templatesStore.allTemplates)

// Bad ❌
const templates = templatesStore.allTemplates
```

### 4. Handle errors in try-catch blocks

```typescript
try {
  await profileStore.updateUserData({ name: 'New Name' })
  // Show success toast
} catch (error) {
  // Show error toast (rollback happens automatically)
  toast.error('Failed to update profile')
}
```

### 5. Use background refresh for better UX

```typescript
// When user returns to a page after some time
onMounted(async () => {
  // This won't block if cache is valid
  await mattersStore.fetchMatters()

  // But if cache is old (>75% of TTL), it refreshes in background
  // User sees cached data immediately, fresh data loads behind the scenes
})
```

### 6. Force refresh when needed

```typescript
// After creating/deleting items in a modal
const onCreateSuccess = async () => {
  await templatesStore.fetchTemplates(1, 10, {}, true) // force = true
  closeModal()
}
```

### 7. Clear cache on logout

```typescript
const logout = async () => {
  await signOut()

  // Clear all caches
  profileStore.clearCache()
  orgStore.clearCache()
  templatesStore.invalidateCache()
  // matters store will auto-clear when user changes

  router.push('/auth/signin')
}
```

---

## Performance Tips

1. **Increase cache TTL for stable data** - Templates and org data rarely change
2. **Use background refresh** - Let stale cache refresh without blocking UI
3. **Leverage optimistic updates** - UI feels instant, errors roll back automatically
4. **Subscribe to realtime changes** - No need for polling or manual refresh
5. **Cache individual items** - Access by ID without fetching entire list

---

## Migration Checklist

For each component using direct API calls:

- [ ] Import the appropriate store
- [ ] Replace `ref()` with `computed(() => store.property)`
- [ ] Replace direct API calls with store methods
- [ ] Add `ensureSubscribed()` in `onMounted`
- [ ] Remove manual loading state management
- [ ] Remove manual error handling (or enhance with toasts)
- [ ] Test optimistic updates work correctly
- [ ] Verify cache behavior (check Network tab)

---

## Cache TTL Summary

| Store | Data Type | TTL | Rationale |
|-------|-----------|-----|-----------|
| Templates | All templates | 5 min | Stable data, created infrequently |
| Templates | Single template | 5 min | Stable data |
| Matters | List | 5 min | Moderate changes, realtime subscribed |
| Profile | User data | 10 min | Very stable |
| Profile | Preferences | 10 min | Very stable |
| Organisation | Org data | 10 min | Very stable |
| Organisation | Members | 5 min | Moderate changes |
| Organisation | Invites | 2 min | More dynamic, frequently changing |

---

## Troubleshooting

**Issue: Data not updating**
- Ensure `ensureSubscribed()` is called in `onMounted`
- Check if realtime subscriptions are working (PocketBase connection)
- Force refresh with `force = true` parameter

**Issue: Stale data showing**
- Check cache TTL settings
- Verify `isStale` getters are working correctly
- Clear cache manually: `store.invalidateCache()`

**Issue: Optimistic update not rolling back**
- Ensure original data is stored before update
- Check try-catch blocks are present
- Verify error is being thrown from service

**Issue: Memory leaks**
- Always call `unsubscribe()` in `onUnmounted` for subscriptions
- Clear caches on logout: `store.clearCache()`

---

## Next Steps

1. **Migrate existing components** one by one to use the new stores
2. **Test thoroughly** in different scenarios (offline, slow network, errors)
3. **Monitor performance** using Vue DevTools and Network tab
4. **Adjust cache TTLs** based on real-world usage patterns
5. **Add toast notifications** for optimistic update errors

Enjoy the snappier, more responsive application!
