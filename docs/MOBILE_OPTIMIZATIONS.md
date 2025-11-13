# Mobile Performance Optimizations

This document describes the caching and prefetching strategies implemented to provide a native app-like experience on mobile.

## Problem

Mobile users experienced excessive loading/reloading when navigating between pages, breaking the native app experience:
- Every navigation showed loading spinners
- Matter detail pages refetched data every time
- No caching between page visits
- Slow perceived performance

## Solutions Implemented

### 1. **Stale-While-Revalidate Pattern**

The matters store (`stores/matters.ts`) now implements an intelligent caching strategy:

```typescript
// Returns cached data instantly if available
// Refreshes in background if stale
await mattersStore.fetchMatter(matterId, {
    showLoading: false  // Don't block UI
})
```

**Benefits:**
- ✅ **Instant page loads** when data is cached
- ✅ **Always fresh data** through background updates
- ✅ **Graceful degradation** if network fails (shows cached data)
- ✅ **No loading spinners** on repeat visits

### 2. **Intelligent Cache Management**

**Cache TTL:** 5 minutes (configurable in `stores/matters.ts:5`)

**Cache Strategy:**
- Fresh cache (<5 min): Returns immediately, no fetch
- Stale cache (>5 min): Returns cached + refreshes in background
- No cache: Shows loading, fetches data

**Cache Invalidation:**
- Real-time subscriptions update cache automatically
- Manual refresh available via `fetchMatter(id, { forceRefresh: true })`

### 3. **Navigation Prefetching**

Data is prefetched when users hover/touch matter cards:

**How it works:**
```typescript
// In Matter component
@mouseenter="prefetchMatter(matter.id)"  // Desktop hover
@touchstart="prefetchMatter(matter.id)"  // Mobile touch
@focus="prefetchMatter(matter.id)"       // Keyboard navigation
```

**Result:** By the time the user taps/clicks, data is already loaded!

### 4. **Optimistic Updates**

Real-time updates are applied optimistically without waiting for server confirmation:

```typescript
// When matter is updated via subscription
subscribeToMatter(matterId, (data) => {
    mattersStore.updateMatterOptimistic(data.record.id, data.record)
})
```

**Benefits:**
- ✅ Instant UI updates
- ✅ No loading states for real-time changes
- ✅ Syncs automatically in background

## Technical Details

### Store Architecture

**Individual Matter Cache:**
```typescript
matterCache: {
  [matterId]: {
    data: MatterWithDeadlines,
    timestamp: number  // For TTL checking
  }
}
```

**Getters:**
- `getMatterById(id)` - Get cached matter (null if stale/missing)
- `isMatterStale(id)` - Check if cache needs refresh

**Actions:**
- `fetchMatter(id, options)` - Smart fetch with caching
- `fetchMatterInBackground(id)` - Silent background refresh
- `updateMatterOptimistic(id, updates)` - Instant UI update

### Integration Points

**Matter Detail Page** (`pages/main/matters/matter/[matterId].vue`):
```typescript
// On mount: Use cached data
matter.value = await mattersStore.fetchMatter(matterId)

// On subscription update: Background refresh
await mattersStore.fetchMatter(matterId, {
    forceRefresh: true,
    showLoading: false
})
```

**Matter List** (`pages/main/matters/index.vue`):
- Already uses store with full caching
- Background refreshes when cache is >75% of TTL

**Matter Card** (`components/PageComponents/Home/Matter/Matter.vue`):
- Prefetches on hover/touch
- Populates cache before navigation

## Performance Impact

### Before Optimizations
- **Matter page load:** 12 API requests (1 matter + N deadlines + M adjournments)
- **Repeat visits:** Full refetch every time
- **Navigation:** Loading spinner on every page change
- **Network usage:** High (no caching)

### After Optimizations
- **Matter page load:** 1 API request (optimized backend route)
- **Repeat visits (cached):** 0 requests (instant load)
- **Repeat visits (stale):** 1 background request (no blocking)
- **Navigation:** Prefetched (often 0ms perceived load)
- **Network usage:** Significantly reduced

## Mobile-Specific Benefits

1. **Reduced Data Usage:** 5-minute cache reduces mobile data consumption
2. **Faster Load Times:** Instant navigation with cached data
3. **Offline Resilience:** Shows cached data if network unavailable
4. **Battery Savings:** Fewer network requests = less battery drain
5. **Native Feel:** No loading spinners = feels like a native app

## Configuration

### Adjust Cache Duration

Edit `stores/matters.ts`:
```typescript
// Default: 5 minutes
const CACHE_TTL = 5 * 60 * 1000;

// For more aggressive caching (10 minutes):
const CACHE_TTL = 10 * 60 * 1000;

// For fresher data (2 minutes):
const CACHE_TTL = 2 * 60 * 1000;
```

### Disable Prefetching

If prefetching causes issues, remove from `components/PageComponents/Home/Matter/Matter.vue`:
```vue
<!-- Remove these event handlers -->
@mouseenter="prefetchMatter(matter.id)"
@touchstart="prefetchMatter(matter.id)"
@focus="prefetchMatter(matter.id)"
```

## Future Enhancements

Potential improvements for even better performance:

1. **Service Worker:** Add offline support with SW caching
2. **IndexedDB:** Persist cache across app restarts
3. **Route-level Prefetching:** Use Nuxt's `prefetch` for automatic prefetching
4. **Image Lazy Loading:** Defer image loads for faster initial render
5. **Virtual Scrolling:** Handle large matter lists more efficiently
6. **Predictive Prefetching:** Learn user patterns and prefetch likely next pages

## Monitoring

Track performance improvements:

```typescript
// Check cache hit rate
const hitRate = cacheHits / (cacheHits + cacheMisses)

// Monitor loading states
const avgLoadTime = totalLoadTime / totalLoads

// Track network requests
const requestsPerSession = totalRequests / sessions
```

## Troubleshooting

**Data seems stale:**
- Reduce `CACHE_TTL` in stores/matters.ts
- Force refresh: `mattersStore.fetchMatter(id, { forceRefresh: true })`

**Prefetching too aggressive:**
- Add debouncing to prefetch handlers
- Increase delay before prefetch triggers

**Cache growing too large:**
- Implement LRU (Least Recently Used) cache eviction
- Clear cache on logout: `mattersStore.matterCache = {}`

## Related Files

- `stores/matters.ts` - Main caching logic
- `composables/usePrefetch.ts` - Prefetch utilities
- `pages/main/matters/matter/[matterId].vue` - Matter detail page
- `components/PageComponents/Home/Matter/Matter.vue` - Matter card with prefetch
- `services/matters/index.ts` - API layer (uses optimized routes)
- `/home/dawood/WebstormProjects/PractoCore/practocore-backend/pb_hooks/matters.pb.js` - Optimized backend routes
