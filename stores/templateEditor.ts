import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Edge, Node } from '@vue-flow/core'
import dayjs from 'dayjs'
import dagre from '@dagrejs/dagre'
import { deadlineTemplateSchema } from '~/lib/validation/template-schemas'
import type { ZodError } from 'zod'

// Types based on the provided schema
export type FieldType = 'text' | 'select' | 'number' | 'date' | 'boolean'
export type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'in'
  | 'not_in'
  | 'greater_than'
  | 'less_than'
  // Date-specific operators
  | 'within_days'
  | 'beyond_days'
  | 'days_until'
  | 'days_since'
  | 'day_of_week'
  | 'is_weekend'
  | 'is_weekday'
export type ReminderPriority = 'moderate' | 'urgent' | 'critical'
export type ReminderChannel = 'MAIL' | 'APP' | 'ALARM'

export interface TemplateFieldOption { value: string | number | boolean, label: string }
export interface TemplateField {
  id: string
  name: string
  label: string
  type: FieldType
  required?: boolean
  options?: TemplateFieldOption[]
}

export interface TemplateCondition {
  type: 'field'
  fieldId: string
  operator: ConditionOperator
  value: any
}

export interface ConditionalOffsetRule {
  conditions: TemplateCondition[]
  days: number
  offsetId?: string // Optional: Override the base offsetId for this rule
}

export interface ConditionalOffsetConfig {
  rules: ConditionalOffsetRule[]
  default: number
}

export interface DeadlineOffsetConfig {
  offsetId: string // Can be: '_date_' (start date), 'd_xxx' (deadline ID), or 'f_xxx' (date field ID)
  days: number
  ignoreWeekends?: boolean
  ignoreHolidays?: boolean
  allowWeekends?: boolean
  allowHolidays?: boolean
  includeFirst?: boolean
  conditional?: ConditionalOffsetConfig
}

export interface ReminderConfig {
  id: string
  title: string
  body?: string
  bodyHTML?: string
  priority: ReminderPriority
  escalate: boolean
  offset: number
  channels: ReminderChannel[]
}

export interface PartyRole {
  id: string
  name: string
  label_singular?: string
  label_plural?: string
  side: 'first' | 'second'
  min_count: number
  max_count: number | null
  default_count: number
}

export interface PartyConfig {
  enabled: boolean
  roles: PartyRole[]
  allow_multiple_per_role: boolean
  representation_required: boolean
}

export interface MultiplicityConfig {
  type: 'single' | 'per_party' | 'per_side'
  role_id?: string
  side?: string
  apply_to_representing?: boolean
}

export interface Deadline {
  id: string
  name: string
  description?: string
  action_label?: string
  prompts: {
    input: string
    pending: string
    fulfilled: string
  }
  type: 'offset'
  dynamic?: boolean
  conditions?: TemplateCondition[]
  offset: DeadlineOffsetConfig
  reminders?: ReminderConfig[]
  multiplicity?: MultiplicityConfig
  name_template?: string
  description_template?: string
  dependencies?: string[]
}

export interface ConditionalNode {
  id: string
  name: string
  description?: string
  conditions: TemplateCondition[]
  truePathOffset?: DeadlineOffsetConfig
  falsePathOffset?: DeadlineOffsetConfig
}

export interface TemplateSettings {
  id: string
  name: string
  version: string
  description?: string
  triggerPrompt?: string
  triggerDateMessage?: string
  date_rules: { allowWeekends: boolean, allowHolidays: boolean }
}

export interface DeadlineTemplate extends TemplateSettings {
  fields: TemplateField[]
  deadlines: Deadline[]
  conditionals: ConditionalNode[]
  party_config?: PartyConfig
}

export interface ValidationError {
  type: 'error' | 'warning'
  category: 'schema' | 'dependency' | 'semantic' | 'type'
  message: string
  location?: string  // e.g., "deadline:d_001" or "field:f_002"
  suggestion?: string
}

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
  warnings: ValidationError[]
}

// Utility ids
const uid = (p = '') => `${p}${Math.random().toString(36).slice(2, 8)}`

// Simple in-memory command stack for undo/redo
interface Command<T = any> { do: () => void; undo: () => void; label?: string; payload?: T }

// Dagre layout configuration
const NODE_WIDTH = 200
const NODE_HEIGHT = 80
const RANK_SEP = 120 // Vertical spacing between ranks
const NODE_SEP = 80 // Horizontal spacing between nodes

export const useTemplateEditorStore = defineStore('templateEditor', () => {
  // Core state
  const template = ref<DeadlineTemplate>({
    id: uid('t_'),
    name: 'Untitled Template',
    version: '1.0',
    description: '',
    date_rules: { allowWeekends: true, allowHolidays: true },
    fields: [],
    conditionals: [],
    deadlines: [
      {
        id: 'id001',
        name: 'Start Date',
        description: 'Project start/reference date',
        type: 'offset',
        dynamic: false,
        prompts: {
          input: '',
          pending: '',
          fulfilled: ''
        },
        offset: {
          offsetId: '_date_',
          days: 0,
          allowHolidays: true,
          allowWeekends: true,
        },
        reminders: []
      }
    ]
  })

  // Graph state
  const nodes = ref<Node<any>[]>([])
  const edges = ref<Edge<any>[]>([])
  const selectedNodeId = ref<string | null>(null)

  // Undo/Redo stacks
  const undoStack = ref<Command[]>([])
  const redoStack = ref<Command[]>([])

  const dirty = ref(false)
  const autosaveKey = computed(() => `pc.template.${template.value.id}`)

  // Derived
  const startNode = computed(() => nodes.value.find(n => n.id === '_date_'))
  const selectedDeadline = computed(() => template.value.deadlines.find(d => d.id === selectedNodeId.value) || null)

  function pushCommand(cmd: Command) {
    undoStack.value.push(cmd)
    redoStack.value = []
    dirty.value = true
    try { cmd.do() } catch (e) { console.error('Command do failed', e) }
  }

  function undo() {
    const cmd = undoStack.value.pop()
    if (!cmd) return
    try { cmd.undo() } finally { redoStack.value.push(cmd) }
  }

  function redo() {
    const cmd = redoStack.value.pop()
    if (!cmd) return
    try { cmd.do() } finally { undoStack.value.push(cmd) }
  }

  function setTemplate(newT: DeadlineTemplate) {
    template.value = JSON.parse(JSON.stringify(newT))

    // Migration: Ensure party_config has all required fields if it exists
    if (template.value.party_config) {
      if (template.value.party_config.enabled === undefined) {
        template.value.party_config.enabled = false
      }
      if (!template.value.party_config.roles) {
        template.value.party_config.roles = []
      }
      if (template.value.party_config.allow_multiple_per_role === undefined) {
        template.value.party_config.allow_multiple_per_role = false
      }
      if (template.value.party_config.representation_required === undefined) {
        template.value.party_config.representation_required = false
      }
    }

    rebuildGraphFromTemplate()
    dirty.value = true
    saveLocal()
  }

  // Dagre layout function
  function applyDagreLayout(nodesList: Node[], edgesList: Edge[]): Node[] {
    const g = new dagre.graphlib.Graph()
    g.setDefaultEdgeLabel(() => ({}))

    // Configure graph for top-to-bottom layout
    g.setGraph({
      rankdir: 'TB', // Top to Bottom
      ranksep: RANK_SEP,
      nodesep: NODE_SEP,
      edgesep: 50,
      marginx: 50,
      marginy: 50
    })

    // Add nodes to dagre graph
    nodesList.forEach((node) => {
      g.setNode(node.id, {
        width: NODE_WIDTH,
        height: NODE_HEIGHT
      })
    })

    // Add edges to dagre graph
    edgesList.forEach((edge) => {
      g.setEdge(edge.source, edge.target)
    })

    // Calculate layout
    dagre.layout(g)

    // Apply calculated positions to nodes
    return nodesList.map((node) => {
      const nodeWithPosition = g.node(node.id)
      return {
        ...node,
        position: {
          x: nodeWithPosition.x - NODE_WIDTH / 2,
          y: nodeWithPosition.y - NODE_HEIGHT / 2,
        },
      }
    })
  }

  // Graph <-> JSON conversion with Dagre layout
  function rebuildGraphFromTemplate() {
    const ns: Node[] = []
    const es: Edge[] = []

    // Start node
    ns.push({
      id: '_date_',
      type: 'start-node',
      position: { x: 0, y: 0 },
      data: { label: 'Start Date' }
    })

    // Create nodes for conditionals
    template.value.conditionals.forEach((c) => {
      ns.push({
        id: c.id,
        type: 'conditional-node',
        position: { x: 0, y: 0 }, // Will be set by dagre
        data: { conditional: c }
      })

      // Edge from parent (either _date_ or another node based on truePathOffset/falsePathOffset)
      if (c.truePathOffset?.offsetId) {
        const parent = c.truePathOffset.offsetId
        if (parent && parent !== '_root_') {
          es.push({
            id: `${parent}_${c.id}`,
            source: parent,
            target: c.id,
            label: `+${c.truePathOffset?.days ?? 0}d`,
            type: 'smoothstep',
          })
        }
      }
    })

    // Create nodes for non-start deadlines
    template.value.deadlines.filter(d => d.id !== '_date_').forEach((d) => {
      ns.push({
        id: d.id,
        type: 'deadline-node',
        position: { x: 0, y: 0 }, // Will be set by dagre
        data: { deadline: d }
      })

      // Edge from offsetId -> this
      const parent = d.offset?.offsetId || '_date_'
      if (parent && parent !== '_root_') {
        const sourceNode = ns.find(n => n.id === parent)
        const isConditional = sourceNode?.type === 'conditional-node'

        es.push({
          id: `${parent}_${d.id}`,
          source: parent,
          target: d.id,
          label: isConditional ? undefined : `+${d.offset?.days ?? 0}d`,
          data: {
            conditional: !!d.offset?.conditional,
            conditionalBranch: isConditional ? (d.offset?.days ?? 0) > 0 ? 'true' : 'false' : undefined
          },
          type: 'smoothstep',
          style: d.offset?.conditional ? { strokeDasharray: '6 4' } : undefined,
          animated: isConditional
        })
      }
    })

    // Apply Dagre layout
    nodes.value = applyDagreLayout(ns, es)
    edges.value = es
  }

  function templateFromGraph(): DeadlineTemplate {
    // Keep existing deadlines but update order/offset parents based on edges
    const dlMap = new Map(template.value.deadlines.map(d => [d.id, { ...d }]))

    edges.value.forEach(e => {
      const child = dlMap.get(e.target as string)
      if (child) {
        child.offset = child.offset || { offsetId: '_date_', days: 1 }
        child.offset.offsetId = e.source as string
        // Parse days from label if present
        const m = /([+-]?\d+)/.exec(e.label ?? '')
        if (m) child.offset.days = Number(m[1])
      }
    })

    // Ensure start node exists
    if (!dlMap.has('_date_')) {
      dlMap.set('_date_', {
        id: '_date_', name: 'Start Date', type: 'offset', dynamic: false,
        offset: { offsetId: '_root_', days: 0, allowHolidays: true, allowWeekends: true }, reminders: []
      } as any)
    }

    const deadlines = Array.from(dlMap.values())
    return { ...template.value, deadlines }
  }

  // Re-layout function that can be called manually
  function relayoutGraph() {
    nodes.value = applyDagreLayout(nodes.value, edges.value)
  }

  // Conditional ops
  function addConditional(parentId = '_date_') {
    const c: ConditionalNode = {
      id: uid('c_'),
      name: 'New Condition',
      description: '',
      conditions: [],
      truePathOffset: { offsetId: parentId, days: 0, allowHolidays: false, allowWeekends: false },
      falsePathOffset: { offsetId: parentId, days: 0, allowHolidays: false, allowWeekends: false }
    }

    pushCommand({
      label: 'Add Conditional',
      do: () => {
        template.value.conditionals.push(c)
        const newNode = {
          id: c.id,
          type: 'conditional-node',
          position: { x: 0, y: 0 },
          data: { conditional: c }
        }
        const newEdge = {
          id: `${parentId}_${c.id}`,
          source: parentId,
          target: c.id,
          type: 'smoothstep'
        }

        nodes.value.push(newNode)
        edges.value.push(newEdge)

        // Re-apply layout after adding
        nodes.value = applyDagreLayout(nodes.value, edges.value)
      },
      undo: () => {
        template.value.conditionals = template.value.conditionals.filter(x => x.id !== c.id)
        nodes.value = nodes.value.filter(n => n.id !== c.id)
        edges.value = edges.value.filter(e => e.source !== c.id && e.target !== c.id)

        // Re-apply layout after removal
        nodes.value = applyDagreLayout(nodes.value, edges.value)
      }
    })
  }

  function deleteConditional(id: string) {
    const idx = template.value.conditionals.findIndex(c => c.id === id)
    if (idx === -1) return

    // Check if any deadlines depend on this conditional
    const hasChildren = template.value.deadlines.some(d => d.offset?.offsetId === id)
    if (hasChildren) throw new Error('Cannot delete conditional that has dependent deadlines')

    const snapshot = JSON.parse(JSON.stringify(template.value.conditionals[idx]))
    const nSnapshot = nodes.value.slice()
    const eSnapshot = edges.value.slice()

    pushCommand({
      label: 'Delete Conditional',
      do: () => {
        template.value.conditionals.splice(idx, 1)
        nodes.value = nodes.value.filter(n => n.id !== id)
        edges.value = edges.value.filter(e => e.source !== id && e.target !== id)

        // Re-apply layout after deletion
        nodes.value = applyDagreLayout(nodes.value, edges.value)
      },
      undo: () => {
        template.value.conditionals.splice(idx, 0, snapshot)
        nodes.value = nSnapshot
        edges.value = eSnapshot
      }
    })
  }
  // Field ops
  function addField(ft: Partial<TemplateField> = {}) {
    const field: TemplateField = {
      id: uid('f_'),
      name: 'field_name',
      label: 'Field Label',
      type: 'text',
      required: false,
      options: [],
      ...ft,
    }
    pushCommand({
      label: 'Add Field',
      do: () => template.value.fields.push(field),
      undo: () => template.value.fields = template.value.fields.filter(f => f.id !== field.id)
    })
  }

  function deleteField(id: string) {
    // Prevent deletion if used in conditions
    const usedInDeadlines = template.value.deadlines.some(d =>
        (d.conditions || []).some(c => c.fieldId === id) ||
        (d.offset?.conditional?.rules || []).some(r => r.conditions.some(c => c.fieldId === id))
    )
    const usedInConditionals = template.value.conditionals.some(c =>
        c.conditions.some(cond => cond.fieldId === id)
    )

    if (usedInDeadlines || usedInConditionals) {
      throw new Error('Field is used in conditions and cannot be deleted')
    }

    const idx = template.value.fields.findIndex(f => f.id === id)
    if (idx === -1) return
    const snapshot = template.value.fields[idx]
    pushCommand({
      label: 'Delete Field',
      do: () => template.value.fields.splice(idx, 1),
      undo: () => template.value.fields.splice(idx, 0, snapshot)
    })
  }

  // Deadline ops
  function addDeadline(parentId = '_date_') {
    const d: Deadline = {
      id: uid('d_'),
      name: 'New Deadline',
      description: '',
      action_label: '',
      prompts: {
        input: '',
        pending: '',
        fulfilled: ''
      },
      type: 'offset',
      dynamic: true,
      offset: { offsetId: parentId, days: 1, allowHolidays: false, allowWeekends: false, includeFirst: false },
      reminders: []
    }

    pushCommand({
      label: 'Add Deadline',
      do: () => {
        template.value.deadlines.push(d)
        const newNode = {
          id: d.id,
          type: 'deadline-node',
          position: { x: 0, y: 0 },
          data: { deadline: d }
        }
        const newEdge = {
          id: `${parentId}_${d.id}`,
          source: parentId,
          target: d.id,
          label: '+1d',
          type: 'smoothstep'
        }

        nodes.value.push(newNode)
        edges.value.push(newEdge)

        // Re-apply layout after adding
        nodes.value = applyDagreLayout(nodes.value, edges.value)
      },
      undo: () => {
        template.value.deadlines = template.value.deadlines.filter(x => x.id !== d.id)
        nodes.value = nodes.value.filter(n => n.id !== d.id)
        edges.value = edges.value.filter(e => !(e.source === parentId && e.target === d.id))

        // Re-apply layout after removal
        nodes.value = applyDagreLayout(nodes.value, edges.value)
      }
    })
  }

  function deleteDeadline(id: string) {
    if (id === '_date_') return
    const idx = template.value.deadlines.findIndex(d => d.id === id)
    if (idx === -1) return
    const snapshot = JSON.parse(JSON.stringify(template.value.deadlines[idx]))
    const nSnapshot = nodes.value.slice()
    const eSnapshot = edges.value.slice()
    pushCommand({
      label: 'Delete Deadline',
      do: () => {
        template.value.deadlines.splice(idx, 1)
        nodes.value = nodes.value.filter(n => n.id !== id)
        edges.value = edges.value.filter(e => e.source !== id && e.target !== id)

        // Re-apply layout after deletion
        nodes.value = applyDagreLayout(nodes.value, edges.value)
      },
      undo: () => {
        template.value.deadlines.splice(idx, 0, snapshot)
        nodes.value = nSnapshot
        edges.value = eSnapshot
      }
    })
  }

  // Party management ops
  function initializePartyConfig() {
    template.value.party_config = {
      enabled: true,
      roles: [],
      allow_multiple_per_role: false,
      representation_required: false
    }
  }

  function addPartyRole(role?: Partial<PartyRole>) {
    if (!template.value.party_config) initializePartyConfig()

    const newRole: PartyRole = {
      id: uid('role_'),
      name: 'New Role',
      side: 'neutral',
      min_count: 1,
      max_count: undefined,
      ...role
    }

    pushCommand({
      label: 'Add Party Role',
      do: () => template.value.party_config!.roles.push(newRole),
      undo: () => {
        template.value.party_config!.roles = template.value.party_config!.roles.filter(r => r.id !== newRole.id)
      }
    })
  }

  function updatePartyRole(roleId: string, updates: Partial<PartyRole>) {
    if (!template.value.party_config) return

    const idx = template.value.party_config.roles.findIndex(r => r.id === roleId)
    if (idx === -1) return

    const oldRole = JSON.parse(JSON.stringify(template.value.party_config.roles[idx]))

    pushCommand({
      label: 'Update Party Role',
      do: () => {
        template.value.party_config!.roles[idx] = { ...template.value.party_config!.roles[idx], ...updates }
      },
      undo: () => {
        template.value.party_config!.roles[idx] = oldRole
      }
    })
  }

  function deletePartyRole(roleId: string) {
    if (!template.value.party_config) return

    // Check if role is used in any deadline multiplicity
    const usedInDeadlines = template.value.deadlines.some(
      d => d.multiplicity?.role_id === roleId
    )
    if (usedInDeadlines) {
      throw new Error('Role is used in deadlines and cannot be deleted')
    }

    const idx = template.value.party_config.roles.findIndex(r => r.id === roleId)
    if (idx === -1) return

    const roleSnapshot = JSON.parse(JSON.stringify(template.value.party_config.roles[idx]))

    pushCommand({
      label: 'Delete Party Role',
      do: () => {
        template.value.party_config!.roles.splice(idx, 1)
      },
      undo: () => {
        template.value.party_config!.roles.splice(idx, 0, roleSnapshot)
      }
    })
  }

  function togglePartySystem(enabled: boolean) {
    if (!template.value.party_config && enabled) {
      initializePartyConfig()
    } else if (template.value.party_config) {
      const oldEnabled = template.value.party_config.enabled

      pushCommand({
        label: `${enabled ? 'Enable' : 'Disable'} Party System`,
        do: () => {
          template.value.party_config!.enabled = enabled
        },
        undo: () => {
          template.value.party_config!.enabled = oldEnabled
        }
      })
    }
  }

  function selectNode(id: string | null) { selectedNodeId.value = id }

  // Validation (4-layer system)
  function validate(): ValidationResult {
    const errors: ValidationError[] = []
    const warnings: ValidationError[] = []

    // Layer 1: Schema Validation (Zod)
    try {
      deadlineTemplateSchema.parse(template.value)
    } catch (error) {
      if (error && typeof error === 'object' && 'issues' in error) {
        const zodError = error as ZodError
        for (const issue of zodError.issues) {
          errors.push({
            type: 'error',
            category: 'schema',
            message: issue.message,
            location: issue.path.join('.'),
            suggestion: 'Fix the schema validation error'
          })
        }
      }
    }

    // Layer 2 & 3: Dependency and Semantic Validation
    if (!template.value.name?.trim()) {
      errors.push({
        type: 'error',
        category: 'schema',
        message: 'Template must have a name',
        location: 'template',
        suggestion: 'Provide a descriptive template name'
      })
    }

    const ids = new Set<string>()

    // Validate deadlines
    for (const d of template.value.deadlines) {
      if (ids.has(d.id)) {
        errors.push({
          type: 'error',
          category: 'schema',
          message: `Duplicate deadline id: ${d.id}`,
          location: `deadline:${d.id}`,
          suggestion: 'Ensure each deadline has a unique ID'
        })
      }
      ids.add(d.id)
      if (d.id !== '_date_') {
        if (!d.name?.trim()) {
          errors.push({
            type: 'error',
            category: 'schema',
            message: `Deadline ${d.id} must have a name`,
            location: `deadline:${d.id}`,
            suggestion: 'Provide a descriptive name for this deadline'
          })
        }
        if (d.offset?.days === undefined || !Number.isInteger(d.offset.days)) {
          errors.push({
            type: 'error',
            category: 'schema',
            message: `Deadline ${d.name || d.id} must have valid offset days`,
            location: `deadline:${d.id}`,
            suggestion: 'Set offset days to an integer value (positive for days after, negative for days before)'
          })
        }
      }
    }

    // Validate conditionals
    for (const c of template.value.conditionals) {
      if (ids.has(c.id)) {
        errors.push({
          type: 'error',
          category: 'schema',
          message: `Duplicate conditional id: ${c.id}`,
          location: `conditional:${c.id}`,
          suggestion: 'Ensure each conditional has a unique ID'
        })
      }
      ids.add(c.id)
      if (!c.name?.trim()) {
        errors.push({
          type: 'error',
          category: 'schema',
          message: `Conditional ${c.id} must have a name`,
          location: `conditional:${c.id}`,
          suggestion: 'Provide a name for this conditional'
        })
      }
      if (!c.conditions?.length) {
        errors.push({
          type: 'error',
          category: 'schema',
          message: `Conditional ${c.name || c.id} must have at least one condition`,
          location: `conditional:${c.id}`,
          suggestion: 'Add at least one condition to this conditional'
        })
      }
    }

    // Field references valid
    const fieldIds = new Set(template.value.fields.map(f => f.id))

    // Check deadline conditions
    for (const d of template.value.deadlines) {
      const conds = [ ...(d.conditions || []), ...((d.offset?.conditional?.rules || []).flatMap(r => r.conditions)) ]
      for (const c of conds) {
        if (c && !fieldIds.has(c.fieldId)) {
          errors.push({
            type: 'error',
            category: 'dependency',
            message: `Deadline condition references missing field: ${c.fieldId}`,
            location: `deadline:${d.id}`,
            suggestion: 'Remove the condition or add the missing field to the template'
          })
        }
      }
    }

    // Check conditional node conditions
    for (const c of template.value.conditionals) {
      for (const cond of c.conditions) {
        if (!fieldIds.has(cond.fieldId)) {
          errors.push({
            type: 'error',
            category: 'dependency',
            message: `Conditional ${c.name} references missing field: ${cond.fieldId}`,
            location: `conditional:${c.id}`,
            suggestion: 'Remove the condition or add the missing field to the template'
          })
        }
      }
    }

    // Circular deps - simple DFS (including conditionals)
    const graph: Record<string, string[]> = {}
    for (const d of template.value.deadlines) graph[d.id] = []
    for (const c of template.value.conditionals) graph[c.id] = []

    for (const d of template.value.deadlines) {
      if (d.id === '_date_') continue
      const p = d.offset?.offsetId || '_date_'
      if (!graph[p]) graph[p] = []
      graph[p].push(d.id)
    }

    for (const c of template.value.conditionals) {
      const p = c.truePathOffset?.offsetId || '_date_'
      if (!graph[p]) graph[p] = []
      if (!graph[p].includes(c.id)) graph[p].push(c.id)
    }

    const seen: Record<string, number> = {}
    function dfs(n: string): boolean {
      seen[n] = 1
      for (const m of graph[n] || []) {
        if (seen[m] === 1) return true
        if (seen[m] !== 2 && dfs(m)) return true
      }
      seen[n] = 2
      return false
    }
    if (dfs('_date_')) {
      errors.push({
        type: 'error',
        category: 'dependency',
        message: 'Circular dependency detected in deadline graph',
        location: 'template',
        suggestion: 'Review deadline dependencies and remove circular references'
      })
    }

    // Layer 3: Semantic Validation (Warnings)

    // Warn about deadlines with very long offsets (potential errors)
    for (const d of template.value.deadlines) {
      if (d.id !== '_date_' && d.offset?.days && d.offset.days > 365) {
        warnings.push({
          type: 'warning',
          category: 'semantic',
          message: `Deadline "${d.name}" has a very long offset of ${d.offset.days} days`,
          location: `deadline:${d.id}`,
          suggestion: 'Verify this offset is correct'
        })
      }
    }

    // Warn about deadlines without reminders
    for (const d of template.value.deadlines) {
      if (d.id !== '_date_' && (!d.reminders || d.reminders.length === 0)) {
        warnings.push({
          type: 'warning',
          category: 'semantic',
          message: `Deadline "${d.name}" has no reminders configured`,
          location: `deadline:${d.id}`,
          suggestion: 'Consider adding reminders to ensure this deadline is not missed'
        })
      }
    }

    // Warn about fields that are not used in any conditions
    const usedFieldIds = new Set<string>()
    for (const d of template.value.deadlines) {
      const conds = [ ...(d.conditions || []), ...((d.offset?.conditional?.rules || []).flatMap(r => r.conditions)) ]
      for (const c of conds) {
        if (c) usedFieldIds.add(c.fieldId)
      }
    }
    for (const c of template.value.conditionals) {
      for (const cond of c.conditions) {
        usedFieldIds.add(cond.fieldId)
      }
    }
    for (const field of template.value.fields) {
      if (!usedFieldIds.has(field.id)) {
        warnings.push({
          type: 'warning',
          category: 'semantic',
          message: `Field "${field.label}" is not used in any conditions`,
          location: `field:${field.id}`,
          suggestion: 'Remove this field or use it in a condition'
        })
      }
    }

    // Warn about party config enabled but no deadlines use multiplicity
    if (template.value.party_config?.enabled) {
      const hasMultiplicityDeadlines = template.value.deadlines.some(d => d.multiplicity && d.multiplicity.type !== 'single')
      if (!hasMultiplicityDeadlines) {
        warnings.push({
          type: 'warning',
          category: 'semantic',
          message: 'Party system is enabled but no deadlines use party multiplicity',
          location: 'party_config',
          suggestion: 'Either disable the party system or configure deadlines to use per-party multiplicity'
        })
      }
    }

    return { valid: errors.length === 0, errors, warnings }
  }

  // Auto-save to localStorage
  function saveLocal() {
    try { localStorage.setItem(autosaveKey.value, JSON.stringify(template.value)) } catch (e) {}
  }
  function loadLocal(id?: string) {
    const key = id ? `pc.template.${id}` : autosaveKey.value
    try {
      const raw = localStorage.getItem(key)
      if (raw) setTemplate(JSON.parse(raw))
    } catch (e) { console.warn('Failed to load local template', e) }
  }

  // Import/Export
  function exportJSON(): string { return JSON.stringify(template.value, null, 2) }
  function importJSON(raw: string) {
    const parsed = JSON.parse(raw)
    setTemplate(parsed)
  }

  // Preview calculation (simplified; now handles conditionals)
  function calculatePreview(startDate: string, fieldValues: Record<string, any>) {
    const dateMap: Record<string, string> = { '_date_': dayjs(startDate).toISOString() }
    const activeMap: Record<string, boolean> = { '_date_': true }
    const conditionalResults: Record<string, boolean> = {}

    // Topological order naive: iterate until no changes
    const remaining = new Set([
      ...template.value.deadlines.map(d => d.id),
      ...template.value.conditionals.map(c => c.id)
    ])
    remaining.delete('_date_')

    for (let iter = 0; iter < 100; iter++) {
      let progressed = false

      // Process conditionals
      for (const c of template.value.conditionals) {
        if (!remaining.has(c.id)) continue
        const p = c.truePathOffset?.offsetId || '_date_'
        if (!dateMap[p]) continue

        // Evaluate conditions
        const result = c.conditions.every(cond => evalCondition(cond, fieldValues))
        conditionalResults[c.id] = result
        activeMap[c.id] = true

        // Set date based on parent
        const offset = result ? c.truePathOffset : c.falsePathOffset
        const days = offset?.days ?? 0
        const parentDate = dayjs(dateMap[p])
        dateMap[c.id] = parentDate.add(days, 'day').toISOString()

        remaining.delete(c.id)
        progressed = true
      }

      // Process deadlines
      for (const d of template.value.deadlines) {
        if (d.id === '_date_' || !remaining.has(d.id)) continue
        const p = d.offset?.offsetId || '_date_'
        if (!dateMap[p]) continue

        // Activation conditions
        const active = (d.conditions || []).every(c => evalCondition(c, fieldValues))
        activeMap[d.id] = active
        if (!active) {
          dateMap[d.id] = ''
          remaining.delete(d.id)
          progressed = true
          continue
        }

        // conditional offset
        let days = d.offset?.days ?? 0
        const cond = d.offset?.conditional
        if (cond && cond.rules?.length) {
          const match = cond.rules.find(r => r.conditions.every(c => evalCondition(c, fieldValues)))
          days = match?.days ?? (cond.default ?? days)
        }

        const parentDate = dayjs(dateMap[p])
        const target = parentDate.add(days, 'day')
        dateMap[d.id] = target.toISOString()
        remaining.delete(d.id)
        progressed = true
      }

      if (!progressed) break
    }

    return { dates: dateMap, active: activeMap, conditionalResults }
  }

  function evalCondition(c: TemplateCondition, values: Record<string, any>): boolean {
    const v = values[c.fieldId]
    switch (c.operator) {
      case 'equals': return v === c.value
      case 'not_equals': return v !== c.value
      case 'in': return Array.isArray(c.value) && c.value.includes(v)
      case 'not_in': return Array.isArray(c.value) && !c.value.includes(v)
      case 'greater_than': return Number(v) > Number(c.value)
      case 'less_than': return Number(v) < Number(c.value)

      // Date-specific operators
      case 'within_days': {
        if (!v) return false
        const date = new Date(v)
        const now = new Date()
        const diffDays = Math.floor((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        return diffDays >= 0 && diffDays <= Number(c.value)
      }
      case 'beyond_days': {
        if (!v) return false
        const date = new Date(v)
        const now = new Date()
        const diffDays = Math.floor((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        return diffDays > Number(c.value)
      }
      case 'days_until': {
        if (!v) return false
        const date = new Date(v)
        const now = new Date()
        const diffDays = Math.floor((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        return diffDays === Number(c.value)
      }
      case 'days_since': {
        if (!v) return false
        const date = new Date(v)
        const now = new Date()
        const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
        return diffDays === Number(c.value)
      }
      case 'day_of_week': {
        if (!v) return false
        const date = new Date(v)
        return date.getDay() === Number(c.value)
      }
      case 'is_weekend': {
        if (!v) return false
        const date = new Date(v)
        const day = date.getDay()
        return day === 0 || day === 6
      }
      case 'is_weekday': {
        if (!v) return false
        const date = new Date(v)
        const day = date.getDay()
        return day >= 1 && day <= 5
      }

      default: return false
    }
  }

  // Initialize default graph
  rebuildGraphFromTemplate()

  return {
    // state
    template, nodes, edges, selectedNodeId, selectedDeadline, dirty,
    // actions
    setTemplate, rebuildGraphFromTemplate, templateFromGraph, relayoutGraph,
    addField, deleteField,
    addConditional, deleteConditional,
    addDeadline, deleteDeadline, selectNode,
    initializePartyConfig, addPartyRole, updatePartyRole, deletePartyRole, togglePartySystem,
    validate, undo, redo, pushCommand,
    saveLocal, loadLocal, exportJSON, importJSON,
    calculatePreview,
  }
})