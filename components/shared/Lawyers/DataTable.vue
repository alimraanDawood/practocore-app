<script setup lang="ts" generic="TData, TValue">
import type { ColumnDef, SortingState, ColumnFiltersState, VisibilityState, RowSelectionState } from '@tanstack/vue-table'
import {
  FlexRender,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useVueTable,
} from '@tanstack/vue-table'
import { valueUpdater } from '@/lib/utils'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const props = defineProps<{
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  total?: number
  loading?: boolean
  // Server-side pagination props
  page?: number
  pageSize?: number
  /** Enables the selection column. Off by default so a table that has nothing to
   *  do with a selection does not grow a column of dead checkboxes. */
  selectable?: boolean
  /** Rows that cannot be selected — the caller themselves, the owner — keyed by
   *  row id. A selection that silently drops them server-side would report a
   *  bulk failure the admin could have been spared. */
  isSelectable?: (row: TData) => boolean
}>()

const emit = defineEmits<{
  (e: 'update:page', page: number): void
  (e: 'update:pageSize', size: number): void
  (e: 'update:selected', ids: string[]): void
  /** Fired in the TARGET phase, so a capture-phase handler on the container
   *  above has already cleared the aim. See the page: there is ONE context menu
   *  for the whole table, not one per row. */
  (e: 'row-contextmenu', row: TData): void
}>()

// ── Table state ──────────────────────────────────────────────────────────────
//
// Sorting and filtering are the SERVER's; this table renders the page it is
// given. The client-side filter sync that used to live here fought the server's
// pagination — it hid rows out of a page whose count and page numbers had already
// been computed elsewhere, so a filtered view showed "10 results" over four
// visible rows.
const sorting = ref<SortingState>([])
const columnFilters = ref<ColumnFiltersState>([])
const columnVisibility = ref<VisibilityState>({})
const rowSelection = ref<RowSelectionState>({})

const table = useVueTable({
  get data() { return props.data },
  get columns() { return props.columns },
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
  getPaginationRowModel: getPaginationRowModel(),
  manualPagination: true, // we handle pagination server-side
  get rowCount() { return props.total ?? 0 },
  state: {
    get sorting() { return sorting.value },
    get columnFilters() { return columnFilters.value },
    get columnVisibility() { return columnVisibility.value },
    get rowSelection() { return rowSelection.value },
    get pagination() {
      return {
        pageIndex: (props.page ?? 1) - 1,
        pageSize: props.pageSize ?? 10,
      }
    },
  },
  onSortingChange: (updater) => valueUpdater(updater, sorting),
  onColumnFiltersChange: (updater) => valueUpdater(updater, columnFilters),
  onColumnVisibilityChange: (updater) => valueUpdater(updater, columnVisibility),
  onRowSelectionChange: (updater) => valueUpdater(updater, rowSelection),
  enableRowSelection: (row) => (props.isSelectable ? props.isSelectable(row.original) : true),
  // The row id is the record id, not the index. Without this a selection follows
  // POSITION across a page change and would act on whoever happens to be third
  // on the next page.
  getRowId: (row: any) => String(row?.id ?? ''),
  onPaginationChange: (updater) => {
    const old = { pageIndex: (props.page ?? 1) - 1, pageSize: props.pageSize ?? 10 }
    const next = typeof updater === 'function' ? updater(old) : updater
    if (next.pageIndex !== old.pageIndex) emit('update:page', next.pageIndex + 1)
    if (next.pageSize !== old.pageSize) emit('update:pageSize', next.pageSize)
  },
})

watch(rowSelection, (value) => {
  emit('update:selected', Object.keys(value).filter((id) => value[id]))
}, { deep: true })

function clearSelection() {
  rowSelection.value = {}
}

// expose table to parent (for toolbar filters etc.)
defineExpose({ table, clearSelection })
</script>

<template>
  <div class="rounded-md border bg-card">
    <Table>
      <TableHeader>
        <TableRow
            v-for="headerGroup in table.getHeaderGroups()"
            :key="headerGroup.id"
            class="hover:bg-transparent"
        >
          <TableHead v-if="selectable" class="w-10">
            <Checkbox
                :model-value="table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && 'indeterminate')"
                aria-label="Select all"
                @update:model-value="(v) => table.toggleAllPageRowsSelected(!!v)"
            />
          </TableHead>
          <TableHead
              v-for="header in headerGroup.headers"
              :key="header.id"
              :class="{ 'cursor-pointer select-none': header.column.getCanSort() }"
          >
            <FlexRender
                v-if="!header.isPlaceholder"
                :render="header.column.columnDef.header"
                :props="header.getContext()"
            />
          </TableHead>
        </TableRow>
      </TableHeader>

      <TableBody>
        <!-- Loading skeleton rows -->
        <template v-if="loading">
          <TableRow v-for="i in pageSize ?? 10" :key="`skeleton-${i}`">
            <TableCell v-if="selectable" class="py-3" />
            <TableCell
                v-for="col in columns"
                :key="String(col)"
                class="py-3"
            >
              <div class="h-4 rounded bg-muted animate-pulse" :style="{ width: `${60 + Math.random() * 30}%` }" />
            </TableCell>
          </TableRow>
        </template>

        <!-- Actual rows -->
        <template v-else-if="table.getRowModel().rows.length">
          <TableRow
              v-for="row in table.getRowModel().rows"
              :key="row.id"
              :data-state="row.getIsSelected() && 'selected'"
              class="group/row"
              @contextmenu="emit('row-contextmenu', row.original)"
          >
            <TableCell v-if="selectable" class="py-3">
              <Checkbox
                  :model-value="row.getIsSelected()"
                  :disabled="!row.getCanSelect()"
                  aria-label="Select row"
                  @update:model-value="(v) => row.toggleSelected(!!v)"
              />
            </TableCell>
            <TableCell v-for="cell in row.getVisibleCells()" :key="cell.id" class="py-3">
              <FlexRender :render="cell.column.columnDef.cell" :props="cell.getContext()" />
            </TableCell>
          </TableRow>
        </template>

        <!-- Empty state -->
        <template v-else>
          <TableRow class="hover:bg-transparent">
            <TableCell :colspan="columns.length + (selectable ? 1 : 0)" class="h-40 text-center">
              <div class="flex flex-col items-center gap-2 text-muted-foreground">
                <span class="text-2xl">👥</span>
                <p class="text-sm font-medium">No members found</p>
                <p class="text-xs">Try adjusting your search or filters</p>
              </div>
            </TableCell>
          </TableRow>
        </template>
      </TableBody>
    </Table>
  </div>
</template>