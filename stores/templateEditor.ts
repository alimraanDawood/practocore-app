import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Edge, Node } from '@vue-flow/core'
import dayjs from 'dayjs'

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

export interface TemplateSettings {
  id: string
  name: string
  version: string
  description?: string
  date_rules: { allowWeekends: boolean, allowHolidays: boolean }
}

export interface DeadlineTemplate extends TemplateSettings {
  fields: TemplateField[]
  deadlines: Deadline[]
}

// Utility ids
const uid = (p = '') => `${p}${Math.random().toString(36).slice(2, 8)}`

// Simple in-memory command stack for undo/redo
interface Command<T = any> { do: () => void; undo: () => void; label?: string; payload?: T }

export const useTemplateEditorStore = defineStore('templateEditor', () => {
  // Core state
  const template = ref<DeadlineTemplate>({
    id: uid('t_'),
    name: 'Untitled Template',
    version: '1.0',
    description: '',
    date_rules: { allowWeekends: true, allowHolidays: true },
    fields: [],
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

  // Graph <-> JSON conversion (simplified)
  function rebuildGraphFromTemplate() {
    const ns: Node[] = []
    const es: Edge[] = []

    // Start node
    ns.push({ id: '_date_', type: 'start-node', position: { x: 0, y: 0 }, data: { label: 'Start Date' } })

    // Create nodes for non-start deadlines
    template.value.deadlines.filter(d => d.id !== '_date_').forEach((d, i) => {
      ns.push({
        id: d.id,
        type: 'deadline-node',
        position: { x: 250 + (i % 3) * 250, y: Math.floor(i / 3) * 160 },
        data: { deadline: d }
      })

      // Edge from offsetId -> this
      const parent = d.offset?.offsetId || '_date_'
      if (parent && parent !== '_root_') {
        es.push({
          id: `${parent}_${d.id}`,
          source: parent,
          target: d.id,
          label: `+${d.offset?.days ?? 0}d`,
          data: { conditional: !!d.offset?.conditional },
          type: 'smoothstep',
          style: d.offset?.conditional ? { strokeDasharray: '6 4',  } : undefined
        })
      }
    })

    nodes.value = ns
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
    const used = template.value.deadlines.some(d =>
      (d.conditions || []).some(c => c.fieldId === id) ||
      (d.offset?.conditional?.rules || []).some(r => r.conditions.some(c => c.fieldId === id))
    )
    if (used) throw new Error('Field is used in conditions and cannot be deleted')

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
        nodes.value.push({ id: d.id, type: 'deadline-node', position: { x: 300, y: 100 }, data: { deadline: d } })
        edges.value.push({ id: `${parentId}_${d.id}` , source: parentId, target: d.id, label: '+1d', type: 'smoothstep' })
      },
      undo: () => {
        template.value.deadlines = template.value.deadlines.filter(x => x.id !== d.id)
        nodes.value = nodes.value.filter(n => n.id !== d.id)
        edges.value = edges.value.filter(e => !(e.source === parentId && e.target === d.id))
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
    for (const d of template.value.deadlines) {
      if (ids.has(d.id)) errors.push(`Duplicate deadline id: ${d.id}`)
      ids.add(d.id)
      if (d.id !== '_date_') {
        if (!d.name?.trim()) errors.push(`Deadline ${d.id} must have a name`)
        if (!d.offset?.days || d.offset.days <= 0) errors.push(`Deadline ${d.name || d.id} must have offset days > 0`)
      }
    }

    // Field references valid
    const fieldIds = new Set(template.value.fields.map(f => f.id))
    for (const d of template.value.deadlines) {
      const conds = [ ...(d.conditions || []), ...((d.offset?.conditional?.rules || []).flatMap(r => r.conditions)) ]
      for (const c of conds) { if (c && !fieldIds.has(c.fieldId)) errors.push(`Condition references missing field: ${c.fieldId}`) }
    }

    // Circular deps - simple DFS
    const graph: Record<string, string[]> = {}
    for (const d of template.value.deadlines) graph[d.id] = []
    for (const d of template.value.deadlines) {
      if (d.id === '_date_') continue
      const p = d.offset?.offsetId || '_date_'
      if (!graph[p]) graph[p] = []
      graph[p].push(d.id)
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

  // Preview calculation (very simplified; ignores holidays/weekends rules for now)
  function calculatePreview(startDate: string, fieldValues: Record<string, any>) {
    const dateMap: Record<string, string> = { '_date_': dayjs(startDate).toISOString() }
    const activeMap: Record<string, boolean> = { '_date_': true }

    // Topological order naive: iterate until no changes
    const remaining = new Set(template.value.deadlines.map(d => d.id))
    remaining.delete('_date_')

    for (let iter = 0; iter < 100; iter++) {
      let progressed = false
      for (const d of template.value.deadlines) {
        if (d.id === '_date_' || !remaining.has(d.id)) continue
        const p = d.offset?.offsetId || '_date_'
        if (!dateMap[p]) continue

        // Activation conditions
        const active = (d.conditions || []).every(c => evalCondition(c, fieldValues))
        activeMap[d.id] = active
        if (!active) { dateMap[d.id] = '' ; remaining.delete(d.id); progressed = true; continue }

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

    return { dates: dateMap, active: activeMap }
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
    setTemplate, rebuildGraphFromTemplate, templateFromGraph,
    addField, deleteField, addDeadline, deleteDeadline, selectNode,
    validate, undo, redo, pushCommand,
    saveLocal, loadLocal, exportJSON, importJSON,
    calculatePreview,
  }
})
