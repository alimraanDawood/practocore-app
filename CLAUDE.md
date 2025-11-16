# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PractoCore is a litigation deadline management application built as a multi-platform solution supporting web, desktop (Tauri), and mobile (Capacitor/Android). The app manages legal matters, deadlines, templates, and organization workflows with real-time collaboration features.

## Technology Stack

- **Framework**: Nuxt 4 (SSR disabled - SPA mode)
- **Frontend**: Vue 3 with TypeScript
- **UI**: Shadcn-nuxt, Reka UI, TailwindCSS 4
- **State Management**: Pinia
- **Backend Integration**: PocketBase (http://10.15.128.175:8090)
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

## Architecture

### Multi-Platform Support

The application runs on three platforms with shared codebase:
- **Web**: Standard Nuxt SPA
- **Desktop**: Tauri wrapper with native notifications and window management
- **Mobile**: Capacitor with local/push notifications support

Platform detection should use `@tauri-apps/api` for desktop features and `@capacitor/core` for mobile features.

### Backend Communication

All backend communication goes through PocketBase (http://10.15.128.175:8090):
- Authentication state managed via `pocketbase.authStore`
- Real-time updates via PocketBase subscriptions
- Custom API endpoints at `/api/practocore/*` and `/api/invitations/*`
- Authorization header: `Bearer ${pocketbase.authStore.token}`

**Important**: The PocketBase client is initialized in multiple places:
- Plugin: `plugins/pocketbase.client.ts` (provides `$pb`)
- Service modules: Each service file has its own instance

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

- **components/ui/**: Shadcn UI components (auto-imported)
- **components/shared/**: Domain-specific shared components:
  - Deadline, Matters, Templates (complex feature modules)
  - Notifications, Profile, Search, SideBar, TopBar (shell components)
  - RichEditor (TipTap integration)
- **components/layout/**: Layout components

### Page Structure

- **auth/**: Login, register, OTP verification
- **main/**: Main application (requires auth)
- **onboarding/**: New user onboarding flow
- **org-switch/**: Organization switching interface
- **splash/**: Desktop/mobile splash screens

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

**Important Pattern**: When fetching matters, deadlines and adjournments are manually expanded and nested in the response (see `services/matters/index.ts:9-28` and `81-91`).

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

- **Dark Mode**: Default preference, managed via `@nuxtjs/color-mode`
- **TailwindCSS 4**: Via `@tailwindcss/vite` plugin
- **Shadcn**: Components in `components/ui/`, no prefix
- **Typography**: Custom fonts in `public/fonts/ibm-plex/`, loaded via `assets/css/fonts.css`
- **Viewport Breakpoints**: Custom breakpoints defined in `nuxt.config.ts:56-87`

### State Management Considerations

- Pinia stores in `stores/` directory
- Real-time data typically managed through service-layer subscriptions rather than stores
- Auth state primarily in PocketBase authStore, not Pinia

## Development Workflow

1. **Local Backend**: Ensure PocketBase is running on port 8090 before starting dev
2. **Hot Reload**: Nuxt dev server supports HMR for all platforms
3. **Platform Testing**:
   - Web: Standard browser dev tools
   - Desktop: `bun tauri dev` opens native window with dev tools
   - Mobile: Build and sync to Android, test via Android Studio
4. **Real-time Features**: Test subscription handlers with multiple clients

## Key Technical Decisions

- **SSR Disabled**: `nuxt.config.ts:10` - App runs in SPA mode for Tauri/Capacitor compatibility
- **Auto Cancellation**: Disabled in template service to prevent race conditions with getFullList
- **Server URL**: Hardcoded to localhost:8090 in service files (search for SERVER_URL to change)
- **Auth Flow**: OTP-based verification system with email invitations
- **Multi-tenancy**: Organization-based with member roles (owner, admin, member)
