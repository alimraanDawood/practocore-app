import { z } from 'zod'

// Field Type Schema
export const fieldTypeSchema = z.enum(['text', 'select', 'number', 'date', 'boolean'])

// Condition Operator Schema
export const conditionOperatorSchema = z.enum([
  'equals',
  'not_equals',
  'in',
  'not_in',
  'greater_than',
  'less_than',
  // Date-specific operators
  'within_days',
  'beyond_days',
  'days_until',
  'days_since',
  'day_of_week',
  'is_weekend',
  'is_weekday'
])

// Reminder Priority Schema
export const reminderPrioritySchema = z.enum(['moderate', 'urgent', 'critical'])

// Reminder Channel Schema
export const reminderChannelSchema = z.enum(['MAIL', 'APP', 'ALARM'])

// Template Field Option Schema
export const templateFieldOptionSchema = z.object({
  value: z.union([z.string(), z.number(), z.boolean()]),
  label: z.string()
})

// Template Field Schema
export const templateFieldSchema = z.object({
  id: z.string(),
  name: z.string(),
  label: z.string(),
  type: fieldTypeSchema,
  required: z.boolean().optional(),
  options: z.array(templateFieldOptionSchema).optional()
})

// Template Condition Schema
export const templateConditionSchema = z.object({
  type: z.literal('field').optional(),
  fieldId: z.string(),
  operator: conditionOperatorSchema,
  value: z.any()
})

// Conditional Offset Rule Schema
export const conditionalOffsetRuleSchema = z.object({
  conditions: z.array(templateConditionSchema),
  days: z.number().int('Offset days must be an integer')
})

// Conditional Offset Config Schema
export const conditionalOffsetConfigSchema = z.object({
  rules: z.array(conditionalOffsetRuleSchema),
  default: z.number().int('Default offset must be an integer')
})

// Deadline Offset Config Schema
export const deadlineOffsetConfigSchema = z.object({
  offsetId: z.string().min(1, 'Offset ID is required'),
  days: z.number().int('Offset days must be an integer'),
  ignoreWeekends: z.boolean().optional(),
  ignoreHolidays: z.boolean().optional(),
  allowWeekends: z.boolean().optional(),
  allowHolidays: z.boolean().optional(),
  includeFirst: z.boolean().optional(),
  conditional: conditionalOffsetConfigSchema.optional()
})

// Reminder Config Schema
export const reminderConfigSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string().optional(),
  bodyHTML: z.string().optional(),
  priority: reminderPrioritySchema,
  escalate: z.boolean(),
  offset: z.number().int(),
  channels: z.array(reminderChannelSchema)
})

// Party Role Schema
export const partyRoleSchema = z.object({
  id: z.string().min(1, 'Party role ID is required'),
  name: z.string(),
  label_singular: z.string().optional(),
  label_plural: z.string().optional(),
  side: z.enum(['first', 'second']),
  min_count: z.number().int().nonnegative('Minimum count must be non-negative'),
  max_count: z.number().int().positive('Maximum count must be positive').nullable(),
  default_count: z.number().int().positive('Default count must be positive')
}).refine(
  (data) => {
    // If max_count is specified, it must be >= min_count
    if (data.max_count !== null && data.max_count !== undefined) {
      return data.max_count >= data.min_count
    }
    return true
  },
  {
    message: 'Maximum count must be greater than or equal to minimum count',
    path: ['max_count']
  }
).refine(
  (data) => {
    // default_count must be between min_count and max_count (if max_count is set)
    if (data.default_count < data.min_count) {
      return false
    }
    if (data.max_count !== null && data.max_count !== undefined && data.default_count > data.max_count) {
      return false
    }
    return true
  },
  {
    message: 'Default count must be between minimum and maximum count',
    path: ['default_count']
  }
)

// Party Config Schema
export const partyConfigSchema = z.object({
  enabled: z.boolean(),
  roles: z.array(partyRoleSchema),
  allow_multiple_per_role: z.boolean(),
  representation_required: z.boolean()
}).refine(
  (data) => {
    // If enabled, at least one role must be defined
    if (data.enabled) {
      return data.roles.length > 0
    }
    return true
  },
  {
    message: 'At least one party role must be defined when party system is enabled',
    path: ['roles']
  }
)

// Multiplicity Config Schema
export const multiplicityConfigSchema = z.object({
  type: z.enum(['single', 'per_party', 'per_side']),
  role_id: z.string().optional(),
  side: z.string().optional(),
  apply_to_representing: z.boolean().optional()
}).refine(
  (data) => {
    // If type is per_party, role_id must be specified
    if (data.type === 'per_party') {
      return !!data.role_id
    }
    return true
  },
  {
    message: 'Role ID must be specified for per_party multiplicity',
    path: ['role_id']
  }
).refine(
  (data) => {
    // If type is per_side, side must be specified
    if (data.type === 'per_side') {
      return !!data.side
    }
    return true
  },
  {
    message: 'Side must be specified for per_side multiplicity',
    path: ['side']
  }
)

// Deadline Schema
export const deadlineSchema = z.object({
  id: z.string().min(1, 'Deadline ID is required'),
  name: z.string(),
  description: z.string().optional(),
  action_label: z.string().optional(),
  prompts: z.object({
    input: z.string(),
    pending: z.string(),
    fulfilled: z.string()
  }).optional(),
  type: z.literal('offset').optional(),
  dynamic: z.boolean().optional(),
  conditions: z.array(templateConditionSchema).optional(),
  offset: deadlineOffsetConfigSchema,
  reminders: z.array(reminderConfigSchema).optional(),
  multiplicity: multiplicityConfigSchema.optional(),
  name_template: z.string().optional(),
  description_template: z.string().optional(),
  dependencies: z.array(z.string()).optional()
})

// Conditional Node Schema
export const conditionalNodeSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  conditions: z.array(templateConditionSchema),
  truePathOffset: deadlineOffsetConfigSchema.optional(),
  falsePathOffset: deadlineOffsetConfigSchema.optional()
})

// Template Settings Schema
export const templateSettingsSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  version: z.string().optional(),
  description: z.string().optional(),
  triggerPrompt: z.string().optional(),
  triggerDateMessage: z.string().optional(),
  date_rules: z.object({
    allowWeekends: z.boolean(),
    allowHolidays: z.boolean()
  }).optional()
})

// Deadline Template Schema (Main Schema)
export const deadlineTemplateSchema = templateSettingsSchema.extend({
  fields: z.array(templateFieldSchema),
  deadlines: z.array(deadlineSchema),
  conditionals: z.array(conditionalNodeSchema),
  party_config: partyConfigSchema.optional()
})

// Export type inference helpers
export type TemplateField = z.infer<typeof templateFieldSchema>
export type TemplateCondition = z.infer<typeof templateConditionSchema>
export type Deadline = z.infer<typeof deadlineSchema>
export type PartyRole = z.infer<typeof partyRoleSchema>
export type PartyConfig = z.infer<typeof partyConfigSchema>
export type DeadlineTemplate = z.infer<typeof deadlineTemplateSchema>
