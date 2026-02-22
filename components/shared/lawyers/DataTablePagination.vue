<script setup lang="ts" generic="TData, TValue">
import type { ColumnDef, SortingState, ColumnFiltersState, VisibilityState } from '@tanstack/vue-table'
import {
  FlexRender,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useVueTable,
} from '@tanstack/vue-table'
import { valueUpdater } from '@/lib/utils'
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
}>()

const emit = defineEmits<{
  (e: 'update:page', page: number): void
  (e: 'update:pageSize', size: number): void
}>()

// ── Table state ──────────────────────────────────────────────────────────────
const sorting = ref<SortingState>([])
const columnFilters = ref<ColumnFiltersState>([])
const columnVisibility = ref<VisibilityState>({})

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
  onPaginationChange: (updater) => {
    const old = { pageIndex: (props.page ?? 1) - 1, pageSize: props.pageSize ?? 10 }
    const next = typeof updater === 'function' ? updater(old) : updater
    if (next.pageIndex !== old.pageIndex) emit('update:page', next.pageIndex + 1)
    if (next.pageSize !== old.pageSize) emit('update:pageSize', next.pageSize)
  },
})

// expose table to parent (for toolbar filters etc.)
defineExpose({ table })
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
          >
            <TableCell v-for="cell in row.getVisibleCells()" :key="cell.id" class="py-3">
              <FlexRender :render="cell.column.columnDef.cell" :props="cell.getContext()" />
            </TableCell>
          </TableRow>
        </template>

        <!-- Empty state -->
        <template v-else>
          <TableRow class="hover:bg-transparent">
            <TableCell :colspan="columns.length" class="h-40 text-center">
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