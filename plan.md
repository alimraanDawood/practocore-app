# PractoCore Development Blueprint

## Phase 1: Project Foundation and Architecture

### Step 1: Development Environment Setup
- Install Node.js, npm/yarn
- Set up Git repository
- Create project structure
- Configure ESLint and Prettier

### Step 2: Backend Foundation with Pocketbase
- Download and configure Pocketbase
- Set up basic authentication
- Create initial database schema
- Configure CORS and security settings

### Step 3: Frontend Foundation with NuxtJS
- Initialize NuxtJS project
- Configure TypeScript support
- Set up Tailwind CSS
- Create basic layout structure

### Step 4: API Integration Layer
- Create Pocketbase SDK wrapper
- Implement authentication flow
- Set up API error handling
- Create base API service class

## Phase 2: Core Data Models and Authentication

### Step 5: User Management
- Create user collection in Pocketbase
- Implement role-based permissions
- Create user profile pages
- Add team/organization structure

### Step 6: Task Data Model
- Create tasks collection
- Add priority, tags, deadlines fields
- Implement task relationships
- Create task CRUD operations

### Step 7: Authentication UI
- Create login/register pages
- Implement OAuth integration
- Add password reset flow
- Create auth middleware

## Phase 3: Task Management Features

### Step 8: Basic Task UI
- Create task list component
- Implement task creation form
- Add task detail view
- Create task editing functionality

### Step 9: Kanban Board Foundation
- Create board layout
- Implement column structure
- Add basic drag-and-drop
- Create task cards

### Step 10: Advanced Task Features
- Add subtasks/to-do lists
- Implement file attachments
- Add task comments
- Create task assignment UI

## Phase 4: Collaboration and Notifications

### Step 11: Real-time Updates
- Set up WebSocket connection
- Implement real-time task updates
- Add presence indicators
- Create activity feed

### Step 12: Notification System
- Create notification model
- Implement in-app notifications
- Add email notification service
- Create notification preferences

### Step 13: Collaboration Features
- Add @mentions functionality
- Implement multi-assignee support
- Create task reassignment
- Add group assignments

## Phase 5: Analytics and Customization

### Step 14: Analytics Dashboard
- Create analytics data models
- Build team leader dashboard
- Add performance metrics
- Implement data visualizations

### Step 15: Customization Features
- Add kanban column customization
- Create workflow templates
- Implement permission settings
- Add theme customization

## Phase 6: Polish and Deployment

### Step 16: Error Handling and Testing
- Implement global error handling
- Add loading states
- Create error boundaries
- Write integration tests

### Step 17: Performance Optimization
- Implement lazy loading
- Add caching strategies
- Optimize database queries
- Configure CDN

### Step 18: Deployment Setup
- Configure CI/CD pipeline
- Set up production environment
- Implement monitoring
- Create deployment scripts

---

# Code Generation Prompts

## Prompt 1: Development Environment Setup

```text
Create a new development environment for a legal productivity tool called PractoCore. Set up the following:

1. Create a new Git repository with a proper .gitignore file for Node.js projects
2. Initialize npm with a package.json file including these scripts:
   - dev: for development
   - build: for production build
   - test: for running tests
   - lint: for code linting
3. Install and configure ESLint with TypeScript support and Prettier for code formatting
4. Create a basic project structure with these directories:
   - /backend (for Pocketbase extensions and configurations)
   - /frontend (for NuxtJS application)
   - /shared (for shared types and utilities)
   - /docs (for documentation)
5. Create a README.md with project overview and setup instructions
6. Add a .env.example file with placeholder environment variables

Make sure all configurations follow best practices for a production-ready application.
```

## Prompt 2: Pocketbase Backend Setup

```text
Set up Pocketbase as the backend for PractoCore. Create the following:

1. Download and configure Pocketbase in the /backend directory
2. Create a pb_hooks directory for custom business logic
3. Create initial collections schema with these collections:
   - users (extend built-in auth collection with fields: role, organizationId, avatar)
   - organizations (name, description, createdAt, settings)
   - teams (name, organizationId, leaderId, memberIds)
4. Configure CORS settings to allow frontend access
5. Set up environment-based configuration for development and production
6. Create a startup script that initializes Pocketbase with proper settings
7. Add migration files for the initial schema
8. Configure file storage settings for attachments

Include proper validation rules and indexes for optimal performance.
```

## Prompt 3: NuxtJS Frontend Foundation

```text
Initialize a NuxtJS 3 application in the /frontend directory with the following setup:

1. Create a new NuxtJS project with TypeScript support
2. Install and configure Tailwind CSS with a custom color scheme suitable for a productivity tool
3. Set up the following directory structure:
   - /components (reusable UI components)
   - /composables (Vue composables for shared logic)
   - /layouts (application layouts)
   - /pages (route pages)
   - /plugins (NuxtJS plugins)
   - /stores (Pinia stores)
   - /types (TypeScript type definitions)
4. Create a default layout with:
   - Responsive navigation header
   - Sidebar for navigation
   - Main content area
   - Footer
5. Configure nuxt.config.ts with proper meta tags, modules, and build settings
6. Create a base color scheme and typography system
7. Set up Pinia for state management

Ensure the setup is optimized for both development and production environments.
```

## Prompt 4: API Integration Layer

```text
Create a robust API integration layer between NuxtJS and Pocketbase:

1. Install the Pocketbase JavaScript SDK
2. Create a plugin that initializes the Pocketbase client with:
   - Automatic token refresh
   - Request/response interceptors
   - Error handling
3. Create a base API service class in /composables/useApi.ts with:
   - Generic CRUD methods
   - Error handling with user-friendly messages
   - Loading state management
   - Retry logic for failed requests
4. Implement specific API services:
   - useAuth.ts for authentication operations
   - useUsers.ts for user management
   - useOrganizations.ts for organization operations
5. Create TypeScript interfaces for all API responses
6. Add request caching for GET requests
7. Implement offline detection and queueing

Include comprehensive error handling and TypeScript types for all operations.
```

## Prompt 5: User Management System

```text
Implement a complete user management system:

1. Extend the Pocketbase users collection with:
   - Custom fields (firstName, lastName, phone, timezone, preferences)
   - Role enum (admin, teamLead, member, guest)
   - Profile picture handling
2. Create user-related pages:
   - /pages/users/index.vue (user list with search and filters)
   - /pages/users/[id].vue (user profile view)
   - /pages/users/edit/[id].vue (user edit form)
3. Create components:
   - UserCard.vue (display user info)
   - UserForm.vue (create/edit users)
   - UserAvatar.vue (handle profile pictures)
   - RoleSelector.vue (role assignment)
4. Implement user store in Pinia with:
   - Current user state
   - User list with pagination
   - User CRUD operations
   - Permission checking helpers
5. Add user invitation system
6. Create user activity tracking

Include proper validation, error handling, and loading states for all operations.
```

## Prompt 6: Task Data Model Implementation

```text
Create a comprehensive task management data model:

1. Create Pocketbase collections:
   - tasks (title, description, priority, status, dueDate, tags, assigneeIds, creatorId, organizationId)
   - task_comments (taskId, userId, content, createdAt)
   - task_attachments (taskId, fileName, fileUrl, uploadedBy)
   - task_activities (taskId, userId, action, details, timestamp)
2. Create TypeScript interfaces for all task-related data
3. Implement task API service with:
   - CRUD operations for tasks
   - Bulk operations (assign, update status)
   - Task filtering and search
   - Task statistics queries
4. Create task validation rules:
   - Required fields validation
   - Date validation (due date must be future)
   - Permission-based validation
5. Add database indexes for performance:
   - Index on organizationId, status, dueDate
   - Full-text search index on title and description
6. Implement task relationships:
   - Parent-child tasks for subtasks
   - Task dependencies

Include proper error handling and optimistic updates for better UX.
```

## Prompt 7: Authentication UI Implementation

```text
Build a complete authentication system UI:

1. Create authentication pages:
   - /pages/auth/login.vue (email/password and OAuth login)
   - /pages/auth/register.vue (user registration with organization creation)
   - /pages/auth/forgot-password.vue (password reset request)
   - /pages/auth/reset-password.vue (password reset form)
2. Implement auth components:
   - LoginForm.vue with validation
   - RegisterForm.vue with password strength indicator
   - OAuthButtons.vue for social login
   - AuthLayout.vue for auth pages
3. Create auth middleware:
   - auth.ts (require authentication)
   - guest.ts (redirect if authenticated)
   - role.ts (check user roles)
4. Implement auth store with:
   - Login/logout actions
   - Token management
   - Remember me functionality
   - Session timeout handling
5. Add two-factor authentication UI (optional)
6. Create onboarding flow for new users

Include proper form validation, error messages, and loading states.
```

## Prompt 8: Basic Task UI Components

```text
Create the fundamental task UI components:

1. Create task list component (TaskList.vue):
   - Display tasks in a table/list format
   - Sortable columns (title, priority, due date, assignee)
   - Inline status updates
   - Bulk selection with checkboxes
   - Pagination controls
2. Create task creation form (TaskForm.vue):
   - Title and description fields
   - Priority selector (Low, Medium, High)
   - Due date picker with time
   - Tag input with autocomplete
   - Assignee selector with search
   - File upload area
3. Create task detail view (TaskDetail.vue):
   - Full task information display
   - Inline editing capabilities
   - Activity timeline
   - Comment section
   - Attachment list
4. Create task card component (TaskCard.vue):
   - Compact task display for kanban
   - Drag handle
   - Quick actions menu
   - Visual priority indicator
5. Add task filters component (TaskFilters.vue):
   - Status filter
   - Assignee filter
   - Date range picker
   - Tag filter

Ensure all components are responsive and accessible.
```

## Prompt 9: Kanban Board Implementation

```text
Build a fully functional kanban board:

1. Create kanban board page (/pages/board.vue):
   - Responsive column layout
   - Board header with filters and view options
   - Column count badges
2. Implement KanbanColumn.vue component:
   - Column header with title and count
   - Scrollable task list
   - Drop zone indicators
   - Column actions menu
3. Add drag-and-drop functionality:
   - Use @vueuse/draggable or similar
   - Visual feedback during drag
   - Auto-scroll when dragging near edges
   - Multi-select drag support
4. Create board customization:
   - Add/remove/reorder columns
   - Column color customization
   - WIP limits per column
   - Column collapse/expand
5. Implement board store:
   - Board state management
   - Optimistic updates for drag operations
   - Undo/redo functionality
   - Board preferences persistence
6. Add board views:
   - Filter by assignee
   - Filter by tags
   - Group by priority

Include smooth animations and proper error handling for failed operations.
```

## Prompt 10: Advanced Task Features

```text
Implement advanced task management features:

1. Create subtask/checklist system:
   - SubtaskList.vue component
   - Add/edit/delete subtasks inline
   - Progress calculation
   - Reorder subtasks
   - Convert subtask to full task
2. Implement file attachment system:
   - FileUploader.vue with drag-and-drop
   - AttachmentList.vue with preview
   - Support for images, PDFs, documents
   - File size and type validation
   - Progress indicators for uploads
3. Create task comment system:
   - CommentList.vue with nested replies
   - CommentForm.vue with rich text editor
   - Mention support with @
   - Comment editing and deletion
   - Real-time comment updates
4. Add task assignment features:
   - AssigneeSelector.vue with search
   - Multiple assignee support
   - Assignment history
   - Workload indicators
   - Auto-assignment rules
5. Implement task templates:
   - Template creation from existing tasks
   - Template library
   - Quick task creation from templates

Ensure all features work seamlessly together with proper state management.
```

## Prompt 11: Real-time Updates System

```text
Implement real-time collaboration features:

1. Set up WebSocket connection:
   - Create WebSocket plugin for NuxtJS
   - Implement auto-reconnection logic
   - Handle connection state in UI
   - Queue messages during disconnection
2. Create real-time task updates:
   - Listen for task changes
   - Update local state optimistically
   - Merge remote changes intelligently
   - Show update indicators
3. Implement presence system:
   - Show active users on board
   - Display user avatars on tasks
   - "User is typing" indicators
   - Last seen timestamps
4. Create activity feed:
   - ActivityFeed.vue component
   - Real-time activity stream
   - Filter activities by type
   - Grouped similar activities
5. Add collaboration indicators:
   - Show who's viewing a task
   - Lock tasks being edited
   - Conflict resolution for simultaneous edits
   - Visual indicators for recent changes
6. Implement notification toast system:
   - Toast component for real-time alerts
   - Notification queue management
   - Click actions for notifications

Ensure the system gracefully handles network issues and doesn't impact performance.
```

## Prompt 12: Notification System

```text
Build a comprehensive notification system:

1. Create notification data model:
   - notifications collection in Pocketbase
   - Notification types (task_assigned, deadline_approaching, comment_added, etc.)
   - Read/unread status tracking
   - Notification preferences per user
2. Implement notification center:
   - NotificationCenter.vue dropdown component
   - Grouped notifications by date
   - Mark as read/unread
   - Clear all functionality
   - Notification badges
3. Create notification service:
   - In-app notification delivery
   - Email notification queue
   - SMS integration preparation
   - Notification batching logic
4. Build notification preferences:
   - NotificationSettings.vue page
   - Per-type notification toggles
   - Delivery channel selection
   - Quiet hours configuration
   - Notification frequency settings
5. Implement smart notifications:
   - Deadline reminders (1 day, 1 hour before)
   - Task assignment alerts
   - Comment mentions
   - Status change notifications
   - Daily/weekly digests
6. Add notification actions:
   - Quick actions from notifications
   - Deep linking to relevant content

Include unsubscribe options and respect user preferences.
```

## Prompt 13: Collaboration Features

```text
Implement advanced collaboration features:

1. Create @mention system:
   - MentionInput.vue component
   - User search and autocomplete
   - Mention highlighting in text
   - Mention notifications
   - Extract and store mentions
2. Implement multi-assignee support:
   - Update task model for multiple assignees
   - MultiAssigneeSelector.vue
   - Workload distribution view
   - Assignment notifications to all assignees
3. Create task reassignment:
   - ReassignDialog.vue component
   - Reassignment history tracking
   - Bulk reassignment tool
   - Handover notes feature
4. Add group/team assignments:
   - Team selector component
   - Auto-expand to team members
   - Team workload views
   - Team notification settings
5. Build collaboration features:
   - Task following/watching
   - Share task via link
   - Guest access for external users
   - Task discussion threads
6. Create collaborative editing:
   - Lock mechanism for descriptions
   - Show active editors
   - Auto-save