import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Edge, Node } from '@vue-flow/core'
import dayjs from 'dayjs'
import dagre from '@dagrejs/dagre'

// Types based on the provided schema
export type FieldType = 'text' | 'select' | 'number' | 'date' | 'boolean'
export type ConditionOperator = 'equals' | 'not_equals' | 'in' | 'not_in' | 'greater_than' | 'less_than'
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
}

export interface ConditionalOffsetConfig {
  rules: ConditionalOffsetRule[]
  default: number
}

export interface DeadlineOffsetConfig {
  offsetId: string // parent deadline id or _date_
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
  triggerDatePrompt?: string
  date_rules: { allowWeekends: boolean, allowHolidays: boolean }
}

export interface DeadlineTemplate extends TemplateSettings {
  fields: TemplateField[]
  deadlines: Deadline[]
  conditionals: ConditionalNode[]
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
        id: '_date_',
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
          offsetId: '_root_',
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

  function selectNode(id: string | null) { selectedNodeId.value = id }

  // Validation (basic)
  function validate(): string[] {
    const errors: string[] = []
    if (!template.value.name?.trim()) errors.push('Template must have a name')

    const ids = new Set<string>()

    // Validate deadlines
    for (const d of template.value.deadlines) {
      if (ids.has(d.id)) errors.push(`Duplicate deadline id: ${d.id}`)
      ids.add(d.id)
      if (d.id !== '_date_') {
        if (!d.name?.trim()) errors.push(`Deadline ${d.id} must have a name`)
        if (!d.offset?.days || d.offset.days < 0) errors.push(`Deadline ${d.name || d.id} must have valid offset days`)
      }
    }

    // Validate conditionals
    for (const c of template.value.conditionals) {
      if (ids.has(c.id)) errors.push(`Duplicate conditional id: ${c.id}`)
      ids.add(c.id)
      if (!c.name?.trim()) errors.push(`Conditional ${c.id} must have a name`)
      if (!c.conditions?.length) errors.push(`Conditional ${c.name || c.id} must have at least one condition`)
    }

    // Field references valid
    const fieldIds = new Set(template.value.fields.map(f => f.id))

    // Check deadline conditions
    for (const d of template.value.deadlines) {
      const conds = [ ...(d.conditions || []), ...((d.offset?.conditional?.rules || []).flatMap(r => r.conditions)) ]
      for (const c of conds) {
        if (c && !fieldIds.has(c.fieldId)) {
          errors.push(`Deadline condition references missing field: ${c.fieldId}`)
        }
      }
    }

    // Check conditional node conditions
    for (const c of template.value.conditionals) {
      for (const cond of c.conditions) {
        if (!fieldIds.has(cond.fieldId)) {
          errors.push(`Conditional ${c.name} references missing field: ${cond.fieldId}`)
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
    if (dfs('_date_')) errors.push('Circular dependency detected')

    return errors
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
    validate, undo, redo, pushCommand,
    saveLocal, loadLocal, exportJSON, importJSON,
    calculatePreview,
  }
})