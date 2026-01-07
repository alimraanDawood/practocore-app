# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PractoCore is a litigation deadline management application built as a multi-platform solution supporting web, desktop (Tauri), and mobile (Capacitor/Android). The app manages legal matters, deadlines, templates, and organization workflows with real-time collaboration features.

## Monorepo Structure

PractoCore is organized as a multi-repository project in `/home/dawood/projects/Practocore/`:

- **practocore-app** (current) - Frontend application (Nuxt 4 + Vue 3 + Tauri + Capacitor)
- **practocore-backend** - PocketBase backend with custom hooks (Go + JavaScript)
- **practocore-engine** - TypeScript deadline calculation engine (standalone library)
- **practocore-fcm** - Firebase Cloud Messaging microservice (Node.js/Express)
- **practocore-website** - Marketing/landing page website

### Repository Relationships

```
practocore-app (port 3000)
    ↓ HTTP requests
practocore-backend (port 8090) ← PocketBase with custom API routes
    ↓ imports engine logic
    ↓ HTTP POST to FCM service
practocore-engine ← Deadline calculation TypeScript library
practocore-fcm (port 2051) ← Push notification microservice
```

**Data Flow**:
1. Frontend (app) authenticates users and makes API calls to backend
2. Backend uses deadline engine to calculate matter deadlines with complex date logic
3. Backend sends push notifications via FCM microservice
4. Backend manages all data persistence (SQLite via PocketBase)
5. Real-time updates flow from backend to frontend via PocketBase subscriptions

## Technology Stack

- **Framework**: Nuxt 4 (SSR disabled - SPA mode)
- **Frontend**: Vue 3 with TypeScript
- **UI**: Shadcn-nuxt, Reka UI, TailwindCSS 4
- **State Management**: Pinia
- **Backend Integration**: PocketBase (http://127.0.0.1:8090)
- **Desktop Platform**: Tauri 2.x
- **Mobile Platform**: Capacitor 7.x (Android)
- **Animations**: GSAP, AnimXYZ, anime.js
- **Package Manager**: Bun (preferred) / Yarn / npm

## Development Commands

### Web Development
```bash
bun run dev                 # Start Nuxt dev server on localhost:3000
bun run build               # Build for production
bun run generate            # Generate static site
bun run preview             # Preview production build
```

### Tauri Desktop Development
```bash
cd src-tauri
bun tauri dev               # Run desktop app in dev mode
bun tauri build             # Build desktop app for production
```

### Capacitor Android Development
```bash
bun run build               # Build Nuxt first
npx cap sync android        # Sync web assets to Android
npx cap open android        # Open Android Studio
npx cap run android         # Run on Android device/emulator
```

**Note**: For mobile development, update `capacitor.config.ts:8` with your local IP address to enable hot reload on device. The config points to `.output/public` as webDir.

### Backend Development (practocore-backend)
```bash
cd ../practocore-backend
./practocore-backend serve --dev    # Start PocketBase on port 8090
```
- Admin dashboard: http://127.0.0.1:8090/_/
- Custom hooks in `pb_hooks/*.pb.js` (auto-reload enabled)
- See `../practocore-backend/pb_hooks/CLAUDE.md` for backend-specific guidance

### Engine Development (practocore-engine)
```bash
cd ../practocore-engine
bun test                    # Run deadline engine tests
```
- TypeScript library for deadline calculation
- Handles holiday/weekend logic, conditional deadlines, and date offsets
- Tested with comprehensive test suite in `deadline-engine.test.ts`

### FCM Service (practocore-fcm)
```bash
cd ../practocore-fcm
npm start                   # Start FCM microservice on port 2051
```
- Requires `firebase-service-account.json` for Firebase Admin SDK
- Health check: http://localhost:2051/health
- POST endpoint: `/send` (tokens, title, body, data)

## Architecture

### Multi-Platform Support

The application runs on three platforms with shared codebase:
- **Web**: Standard Nuxt SPA
- **Desktop**: Tauri wrapper with native notifications and window management
- **Mobile**: Capacitor with local/push notifications support

Platform detection should use `@tauri-apps/api` for desktop features and `@capacitor/core` for mobile features.

### Backend Communication

All backend communication goes through PocketBase (http://127.0.0.1:8090):
- Authentication state managed via `pocketbase.authStore`
- Real-time updates via PocketBase subscriptions
- Custom API endpoints at `/api/practocore/*` and `/api/invitations/*`
- Authorization header: `Bearer ${pocketbase.authStore.token}`

**Important**: The PocketBase client is centralized:
- Shared instance: `lib/pocketbase.ts` exports `pb` singleton (auto-cancellation disabled globally)
- Plugin: `plugins/pocketbase.client.ts` provides `$pb` using the shared instance
- Service modules: Import `pb` from `lib/pocketbase` to ensure consistent authStore
- Runtime config: `nuxt.config.ts:86-90` defines `pocketbaseUrl` (defaults to http://127.0.0.1:8090)

**Backend Custom Endpoints** (defined in `practocore-backend/pb_hooks/*.pb.js`):
- `/api/practocore/matters` - Optimized matter fetching with expanded deadlines/adjournments
- `/api/practocore/create-matter` - Matter creation with deadline engine integration
- `/api/practocore/create-application` - Create child application matters
- `/api/practocore/statistics` - Dashboard statistics
- `/api/practocore/auth/*` - User registration, OTP verification, organisation joining
- `/api/invitations/*` - Organisation invitation system (direct invites, invite links)

The backend uses PocketBase hooks to automatically:
- Calculate deadlines when matters are created (via deadline engine)
- Update dependent deadlines when parent deadlines change (cascading)
- Send push notifications via FCM service
- Manage reminder schedules with timezone localization
- Handle organisation membership and access control

### Service Layer Architecture

Services are organized by domain in `services/` directory:

- **auth/**: Authentication, user management, organization invites
- **matters/**: Legal matter CRUD, deadlines, adjournments, statistics
- **templates/**: Deadline template management with real-time subscriptions
- **admin/**: Organization management, member roles, invite system (legacy + direct invites)
- **notifications/**: Notification system (currently under refactor)
- **intelligence/**: (Domain-specific features)
- **subscriptions/**: (Domain-specific features)

Each service module exports:
- CRUD functions for PocketBase collections
- `subscribe*` and `unsubscribe*` functions for real-time updates
- Custom API integrations for complex operations

**Service Layer Patterns**:
- **Direct PocketBase**: Simple CRUD operations use `pb.collection().getOne()`, `.create()`, etc.
- **Custom API Endpoints**: Complex operations (matter creation, statistics) use fetch to `/api/practocore/*`
- **Manual Data Expansion**: Some endpoints (e.g., getMatters) return manually expanded/nested data instead of using PocketBase's expand parameter for performance
- **Authorization**: Custom endpoints expect `Authorization: pocketbase.authStore.token` (not Bearer prefix in header value)

### Global Middleware

Two critical middleware files run on every route:

1. **auth.global.ts**: Authentication guard
   - Redirects to `/auth/login?next={path}` if user not authenticated
   - Allows `/auth/*` and `/splash/*` routes without auth
   - Checks `pb.authStore.isValid` and collection is 'Users'

2. **organisation.global.ts**: Organization context switching
   - Handles `?org={id}` query parameter
   - Redirects to `/org-switch` if organization mismatch
   - Enables cross-organization navigation

### Component Organization

- **components/ui/**: Shadcn UI components (auto-imported via shadcn-nuxt, no prefix)
- **components/shared/**: Domain-specific shared components (auto-imported):
  - Deadline, Matters, Templates (complex feature modules)
  - Notifications, Profile, Search, Settings (feature components)
  - SideBar, TopBar, MobileNavigation, DesktopTitleBar (shell/layout components)
  - RichEditor (TipTap integration), Chat, AvatarStack (utility components)
- **components/layout/**: Layout wrapper components

### Page Structure

- **auth/**: Login, register, OTP verification
- **main/**: Main application pages (requires auth) - contains dashboard, deadlines, matters, templates, settings, etc.
- **onboarding/**: New user onboarding flow
- **org-switch/**: Organization switching interface
- **splash/**: Desktop/mobile splash screens
- **index.vue**: Root page (typically redirects to main app)

### Data Model Patterns

Core PocketBase collections:
- **Users**: User accounts with `organisation` and `preferences` relations
- **Organisations**: Multi-tenant organizations
- **Matters**: Legal matters with related deadlines
- **Deadlines**: Matter deadlines with adjournments
- **DeadlineAdjournments**: Deadline modifications
- **DeadlineTemplates**: Reusable deadline templates
- **OrganisationInviteRequests**: Legacy invite system
- **OrganisationDirectInvites**: New direct invite system

**Important Patterns**:
- Manual data expansion: The `/api/practocore/matters` endpoint returns manually expanded/nested deadlines and adjournments for performance (see `services/matters/index.ts:9-28`)
- Mixed approach: Matter creation and applications use custom API endpoints (`/api/practocore/create-matter`, `/api/practocore/create-application`) while simple CRUD uses PocketBase collections directly

### Deadline Engine Integration

The deadline calculation system is powered by `practocore-engine`, a TypeScript library that handles complex date logic:

**Key Concepts**:
- **Templates**: DeadlineTemplate defines fields, deadlines, holidays, and calculation rules
- **Trigger Date**: The initial date from which all deadlines are calculated (e.g., case filing date)
- **Offset Rules**: Each deadline has offset days from its dependency (or trigger date)
- **Conditional Deadlines**: Deadlines can be activated/skipped based on field values or other deadline statuses
- **Date Adjustment**: Configurable rules for handling weekends/holidays (forward/backward adjustment)
- **Counting Rules**: Control whether to include/exclude weekends and holidays when counting offset days
- **Cascading Updates**: When a deadline date changes, all dependent deadlines automatically recalculate

**Template Structure** (see `practocore-engine/deadline-engine.ts`):
- `data.fields[]` - Dynamic form fields for matter creation (text, number, boolean, select, date)
- `data.deadlines[]` - Deadline definitions with dependencies, offsets, conditions, and prompts
- `data.holidays[]` - Holiday dates to consider in calculations
- `data.triggerDateRules` - Rules for the initial trigger date
- `data.parties` - Party/role configuration for legal matters

**Frontend Integration**:
- Template editor in `stores/templateEditor.ts` (22KB of complex state management)
- Template marketplace design in `TEMPLATE_MARKETPLACE_DESIGN.md`
- Matter creation UI uses templates to generate dynamic forms
- All deadline calculations happen server-side via backend API

### Tauri-Specific Features

Desktop app configuration in `src-tauri/tauri.conf.json`:
- **Multi-window**: main, splashscreen, login windows
- **Window Management**: Windows start hidden/invisible, shown programmatically
- **Notifications**: Via `tauri-plugin-notification`
- **Build**: `beforeDevCommand` runs Nuxt dev, `beforeBuildCommand` generates static build

Rust dependencies focus on notifications and async runtime (tokio, chrono).

### Notifications System

Currently under refactor (see git status - deleted/modified files):
- Old system: `composables/useNotifications.ts`, `plugins/notifications.client.ts`, `stores/notifications.ts`
- New system: `components/shared/Notifications/` (Notification.vue, Notifications.vue)
- Platform adapters being consolidated

### Styling & Theming

- **Dark Mode**: Default preference, managed via `@nuxtjs/color-mode` (classSuffix: '')
- **TailwindCSS 4**: Via `@tailwindcss/vite` plugin, config in `assets/css/tailwind.css`
- **Shadcn**: Components in `components/ui/`, no prefix, uses Reka UI primitives
- **Typography**: Custom IBM Plex fonts in `public/fonts/ibm-plex/`, loaded via `assets/css/fonts.css`
- **Viewport Breakpoints**: Custom responsive breakpoints in `nuxt.config.ts:54-85` (mobile: 320, tablet: 800, desktop: 1024, etc.)
- **Animations**: Multiple libraries available:
  - GSAP (with ScrollSmoother and SplitText club plugins) via `@hypernym/nuxt-gsap`
  - AnimXYZ via `@animxyz/vue3` plugin
  - anime.js, v-wave for Vue components
  - tw-animate-css for Tailwind-based animations

### State Management Considerations

- **Pinia stores** in `stores/` directory:
  - auth, calendar, dashboard, matters, organisation, profile, subscription
  - templateEditor (complex state for deadline template builder)
  - templates (template listing and management)
- **Real-time data**: Typically managed through service-layer subscriptions rather than stores
- **Auth state**: Primarily in PocketBase authStore (`pb.authStore`), not Pinia
- **Pattern**: Use stores for UI state and complex component state; use service subscriptions for server-synced data

## Development Workflow

### Full Stack Development

To run the complete PractoCore system locally:

1. **Start Backend** (Terminal 1):
   ```bash
   cd ../practocore-backend
   ./practocore-backend serve --dev
   ```
   - Runs on http://127.0.0.1:8090
   - Admin dashboard: http://127.0.0.1:8090/_/

2. **Start FCM Service** (Terminal 2) - Optional, only needed for push notifications:
   ```bash
   cd ../practocore-fcm
   npm start
   ```
   - Runs on http://localhost:2051

3. **Start Frontend** (Terminal 3):
   ```bash
   cd practocore-app
   bun run dev                    # Web at localhost:3000
   # OR
   cd src-tauri && bun tauri dev  # Desktop app
   ```

### Platform-Specific Workflows

- **Web Development**: Standard browser dev tools at localhost:3000
- **Desktop Development**: `bun tauri dev` opens native window with dev tools
- **Mobile Development**:
  1. Update `capacitor.config.ts:8` with your local IP
  2. `bun run build && npx cap sync android && npx cap run android`
- **Real-time Features**: Test subscription handlers with multiple clients
- **Hot Reload**: Nuxt dev server supports HMR; PocketBase auto-reloads hooks on file changes

## Important Development Patterns

### Working with PocketBase
- Always import `pb` from `lib/pocketbase` (not creating new instances)
- Authorization header for custom endpoints: just the token (not "Bearer {token}")
- Service files use both direct PocketBase SDK and custom fetch endpoints
- Auto-cancellation is disabled globally - handle request cancellation manually if needed

### Component Development
- All components in `components/` are auto-imported (no manual imports needed)
- Use `defineNuxtComponent` or standard Vue SFC syntax
- Shadcn components have no prefix (e.g., `<Button>` not `<UiButton>`)
- Dark mode is default - always test both modes

### Type Safety
- PocketBase types in `pocketbase-types.ts` (generated from PocketBase schema)
- TypeScript strict mode enabled
- Use Zod schemas with vee-validate for form validation

### Routing & Navigation
- All routes protected by `auth.global.ts` middleware (except /auth and /splash)
- Organization switching handled by `organisation.global.ts` via `?org=` query param
- Use `navigateTo()` for programmatic navigation (Nuxt helper)

## Key Technical Decisions

- **SSR Disabled**: `nuxt.config.ts:10` - App runs in SPA mode for Tauri/Capacitor compatibility
- **Auto Cancellation**: Disabled globally in `lib/pocketbase.ts:10` via `pb.autoCancellation(false)` to prevent race conditions
- **Server URL**: Hardcoded to localhost:8090 in `lib/pocketbase.ts` and service files (search for SERVER_URL to change for production)
- **Auth Flow**: OTP-based verification system with email invitations
- **Multi-tenancy**: Organization-based with member roles (owner, admin, member)
- **Rich Text**: TipTap editor via `nuxt-tiptap-editor` module with custom extensions (text-align, underline)
- **Icons**: Lucide icons via `@nuxt/icon` module and `@iconify-json/lucide`
- **Deadline Calculations**: Server-side only (backend imports engine, frontend never calculates directly)
- **Push Notifications**: Delegated to separate FCM microservice to isolate Firebase Admin SDK

## Cross-Repository Development

### Working Across Multiple Codebases

When making changes that span multiple repositories:

1. **Engine Changes** (`practocore-engine`):
   - Update TypeScript interfaces and logic
   - Run `bun test` to verify all tests pass
   - Build with `bun run build` (outputs to `dist/`)
   - Backend will need to re-import the updated engine code

2. **Backend Changes** (`practocore-backend`):
   - Modify `pb_hooks/*.pb.js` files
   - PocketBase auto-reloads hooks on save (with `--hooksWatch` flag)
   - Test via admin dashboard or API calls from frontend
   - Check `pb_hooks/CLAUDE.md` for backend-specific patterns

3. **Frontend Changes** (`practocore-app`):
   - Update services to match new backend endpoints
   - Update types in `pocketbase-types.ts` if schema changed
   - Test real-time subscriptions if collections modified

### Common Cross-Repository Scenarios

- **Adding a new deadline template field**:
  1. Update `DeadlineTemplateField` interface in `practocore-engine/deadline-engine.ts`
  2. Update template editor UI in `practocore-app/stores/templateEditor.ts`
  3. Update matter creation form in `practocore-app/components/shared/Matters/CreateMatter/`

- **Adding a new PocketBase collection**:
  1. Create/update migration in `practocore-backend/pb_migrations/`
  2. Add hooks in `practocore-backend/pb_hooks/` if needed
  3. Generate new types: update `practocore-app/pocketbase-types.ts`
  4. Create service module in `practocore-app/services/` for CRUD operations

- **Modifying push notification format**:
  1. Update FCM service in `practocore-fcm/index.js`
  2. Update notification hooks in `practocore-backend/pb_hooks/notifications.pb.js`
  3. Update frontend handlers in `practocore-app/services/push-notifications.ts`

## Important Notes

- **Database**: PocketBase stores data in `practocore-backend/pb_data/data.db` (SQLite)
- **File Uploads**: Stored in `practocore-backend/pb_data/storage/`
- **Schema**: View/edit in PocketBase admin dashboard or `pb_hooks/pb_schema.json`
- **Type Generation**: PocketBase types need manual sync between backend schema and frontend `pocketbase-types.ts`
- **Testing**: Engine has comprehensive tests; backend/frontend testing is manual via dev environment
- **Documentation**: Each repo has domain-specific docs:
  - Backend: `pb_hooks/CLAUDE.md`, `DEADLINE_ASSIGNMENT_IMPLEMENTATION.md`, `NOTIFICATION_INTEGRATION.md`
  - Frontend: `STORES_USAGE_GUIDE.md`, `TEMPLATE_MARKETPLACE_DESIGN.md`, `docs/*.md` (notifications, push, FCM setup)
