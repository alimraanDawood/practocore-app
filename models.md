# PractoCore Database Models

## Core Models

### Organizations
```typescript
interface Organization {
  id: string;
  name: string;
  description?: string;
  logo?: string;
  settings: {
    workingHours: {
      start: string; // "09:00"
      end: string;   // "17:00"
      timezone: string; // "America/New_York"
    };
    workingDays: number[]; // [1,2,3,4,5] (Mon-Fri)
    defaultTaskSettings: {
      defaultPriority: 'low' | 'medium' | 'high';
      defaultDueTime: string; // "17:00"
    };
    features: {
      smsNotifications: boolean;
      guestAccess: boolean;
      customFields: boolean;
    };
  };
  subscription: {
    plan: 'free' | 'pro' | 'enterprise';
    validUntil: Date;
    userLimit: number;
  };
  createdAt: Date;
  updatedAt: Date;
}
```

### Users (extends Pocketbase Auth)
```typescript
interface User {
  id: string;
  email: string;
  username: string;
  // Extended fields
  firstName: string;
  lastName: string;
  avatar?: string;
  phone?: string;
  role: 'admin' | 'team_lead' | 'member' | 'guest';
  organizationId: string;
  teamIds: string[];
  preferences: {
    notifications: {
      email: boolean;
      inApp: boolean;
      sms: boolean;
      digest: 'none' | 'daily' | 'weekly';
    };
    ui: {
      theme: 'light' | 'dark' | 'system';
      defaultView: 'list' | 'kanban' | 'calendar';
      taskListDensity: 'compact' | 'comfortable' | 'spacious';
    };
  };
  timezone: string;
  lastActiveAt: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

### Teams
```typescript
interface Team {
  id: string;
  name: string;
  description?: string;
  organizationId: string;
  leaderIds: string[];
  memberIds: string[];
  settings: {
    visibility: 'public' | 'private';
    allowSelfJoin: boolean;
    defaultAssignee?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}
```

## Task Management Models

### Tasks
```typescript
interface Task {
  id: string;
  organizationId: string;
  title: string;
  description?: string;
  status: 'todo' | 'in_progress' | 'review' | 'completed' | 'archived';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  
  // Assignment
  creatorId: string;
  assigneeIds: string[];
  teamIds: string[];
  watchers: string[]; // Users following the task
  
  // Dates
  dueDate?: Date;
  startDate?: Date;
  completedAt?: Date;
  
  // Organization
  projectId?: string;
  parentTaskId?: string; // For subtasks
  dependsOn: string[]; // Task IDs this task depends on
  
  // Metadata
  tags: string[];
  customFields?: Record<string, any>;
  estimatedHours?: number;
  actualHours?: number;
  
  // Kanban
  boardColumn: string;
  boardOrder: number;
  
  // Flags
  isTemplate: boolean;
  isRecurring: boolean;
  recurringPattern?: {
    frequency: 'daily' | 'weekly' | 'monthly';
    interval: number;
    endDate?: Date;
  };
  
  createdAt: Date;
  updatedAt: Date;
}
```

### Subtasks/Checklists
```typescript
interface Subtask {
  id: string;
  taskId: string;
  title: string;
  completed: boolean;
  assigneeId?: string;
  order: number;
  completedAt?: Date;
  completedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### Task Comments
```typescript
interface TaskComment {
  id: string;
  taskId: string;
  userId: string;
  content: string;
  mentions: string[]; // User IDs mentioned
  parentCommentId?: string; // For nested replies
  isEdited: boolean;
  editedAt?: Date;
  attachments: {
    id: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
  }[];
  reactions: {
    emoji: string;
    userIds: string[];
  }[];
  createdAt: Date;
  updatedAt: Date;
}
```

### Task Attachments
```typescript
interface TaskAttachment {
  id: string;
  taskId: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  uploadedBy: string;
  thumbnailUrl?: string; // For images/videos
  metadata?: {
    width?: number;
    height?: number;
    duration?: number; // For videos
    pageCount?: number; // For PDFs
  };
  createdAt: Date;
}
```

### Task Activities
```typescript
interface TaskActivity {
  id: string;
  taskId: string;
  userId: string;
  action: 
    | 'created'
    | 'updated'
    | 'status_changed'
    | 'assigned'
    | 'unassigned'
    | 'commented'
    | 'attachment_added'
    | 'attachment_removed'
    | 'due_date_changed'
    | 'priority_changed'
    | 'completed'
    | 'reopened';
  details: {
    field?: string;
    oldValue?: any;
    newValue?: any;
    comment?: string;
    attachmentId?: string;
    assigneeId?: string;
  };
  createdAt: Date;
}
```

## Project/Case Management

### Projects
```typescript
interface Project {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  clientName?: string;
  caseNumber?: string;
  status: 'planning' | 'active' | 'on_hold' | 'completed' | 'archived';
  leaderId: string;
  memberIds: string[];
  startDate?: Date;
  endDate?: Date;
  budget?: {
    hours?: number;
    amount?: number;
    currency?: string;
  };
  settings: {
    visibility: 'public' | 'team' | 'private';
    taskPrefix?: string; // e.g., "CASE-001"
  };
  createdAt: Date;
  updatedAt: Date;
}
```

## Kanban/Board Models

### Boards
```typescript
interface Board {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  type: 'team' | 'project' | 'personal';
  ownerId: string;
  projectId?: string;
  teamId?: string;
  isDefault: boolean;
  settings: {
    defaultColumns: string[];
    wipLimits?: Record<string, number>;
    autoArchiveDays?: number;
  };
  createdAt: Date;
  updatedAt: Date;
}
```

### Board Columns
```typescript
interface BoardColumn {
  id: string;
  boardId: string;
  name: string;
  color?: string;
  order: number;
  wipLimit?: number;
  isDefault: boolean;
  autoComplete: boolean; // Auto-complete tasks moved here
  settings: {
    defaultAssignee?: string;
    requiredFields?: string[]; // Fields required before moving here
  };
  createdAt: Date;
  updatedAt: Date;
}
```

## Notification Models

### Notifications
```typescript
interface Notification {
  id: string;
  userId: string;
  type: 
    | 'task_assigned'
    | 'task_completed'
    | 'comment_mention'
    | 'deadline_approaching'
    | 'deadline_passed'
    | 'status_changed'
    | 'comment_added'
    | 'team_invite'
    | 'weekly_summary';
  title: string;
  message: string;
  data: {
    taskId?: string;
    commentId?: string;
    projectId?: string;
    teamId?: string;
    userId?: string; // Who triggered the notification
  };
  priority: 'low' | 'normal' | 'high';
  isRead: boolean;
  readAt?: Date;
  channels: ('inApp' | 'email' | 'sms')[];
  emailSentAt?: Date;
  smsSentAt?: Date;
  createdAt: Date;
  expiresAt?: Date;
}
```

### Notification Preferences
```typescript
interface NotificationPreference {
  id: string;
  userId: string;
  type: string; // Notification type
  channels: {
    inApp: boolean;
    email: boolean;
    sms: boolean;
  };
  timing: {
    immediate: boolean;
    digest: boolean;
  };
  conditions?: {
    onlyHighPriority?: boolean;
    onlyMyTasks?: boolean;
    excludeTeams?: string[];
  };
  createdAt: Date;
  updatedAt: Date;
}
```

## Analytics Models

### Task Metrics
```typescript
interface TaskMetric {
  id: string;
  organizationId: string;
  date: Date;
  metrics: {
    created: number;
    completed: number;
    overdue: number;
    averageCompletionTime: number; // in hours
    byPriority: {
      low: { created: number; completed: number };
      medium: { created: number; completed: number };
      high: { created: number; completed: number };
      urgent: { created: number; completed: number };
    };
    byUser: Record<string, {
      assigned: number;
      completed: number;
      overdue: number;
    }>;
    byTeam: Record<string, {
      assigned: number;
      completed: number;
      overdue: number;
    }>;
  };
  createdAt: Date;
}
```

### User Activity
```typescript
interface UserActivity {
  id: string;
  userId: string;
  date: Date;
  activities: {
    tasksCreated: number;
    tasksCompleted: number;
    commentsAdded: number;
    hoursLogged: number;
    loginCount: number;
    lastActiveAt: Date;
  };
  createdAt: Date;
}
```

## Template Models

### Task Templates
```typescript
interface TaskTemplate {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  category: string;
  isPublic: boolean;
  createdBy: string;
  template: {
    title: string;
    description?: string;
    priority: 'low' | 'medium' | 'high';
    tags: string[];
    estimatedHours?: number;
    subtasks: {
      title: string;
      order: number;
    }[];
    customFields?: Record<string, any>;
  };
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
}
```

### Workflow Templates
```typescript
interface WorkflowTemplate {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  category: string; // e.g., "Case Preparation", "Document Review"
  tasks: {
    templateId?: string;
    title: string;
    description?: string;
    order: number;
    dependencies: number[]; // Indices of dependent tasks
    assigneeRole?: string;
    daysFromStart: number;
  }[];
  createdBy: string;
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
}
```

## Session/Security Models

### Sessions
```typescript
interface Session {
  id: string;
  userId: string;
  token: string;
  deviceInfo: {
    userAgent: string;
    ip: string;
    device?: string;
    browser?: string;
  };
  lastActiveAt: Date;
  expiresAt: Date;
  createdAt: Date;
}
```

### Audit Log
```typescript
interface AuditLog {
  id: string;
  userId: string;
  organizationId: string;
  action: string;
  resource: string;
  resourceId: string;
  changes?: {
    field: string;
    oldValue: any;
    newValue: any;
  }[];
  ipAddress: string;
  userAgent: string;
  createdAt: Date;
}
```

## Indexes and Relationships

### Key Indexes:
1. **Tasks**:
    - `organizationId, status, dueDate`
    - `assigneeIds` (array index)
    - `creatorId, createdAt`
    - Full-text on `title, description`

2. **Notifications**:
    - `userId, isRead, createdAt`
    - `userId, type`

3. **Activities**:
    - `taskId, createdAt`
    - `userId, createdAt`

4. **Comments**:
    - `taskId, createdAt`
    - `mentions` (array index)

### Key Relationships:
- Organization → has many → Users, Teams, Projects, Tasks
- User → belongs to → Organization
- User → belongs to many → Teams
- Task → has many → Comments, Attachments, Activities, Subtasks
- Task → belongs to many → Users (assignees), Teams
- Project → has many → Tasks
- Board → has many → Columns
- Task → belongs to → Column (through boardColumn field)