<script setup lang="ts" generic="TData, TValue">
import { ref, watch, computed } from 'vue'
import type {
  ColumnDef,
  SortingState,
  ColumnFiltersState,
  VisibilityState,
  RowSelectionState,
} from '@tanstack/vue-table'
import {
  FlexRender,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  useVueTable,
} from '@tanstack/vue-table'
import { ChevronDown, X, Search } from 'lucide-vue-next'
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
}>()

const emit = defineEmits<{
  (e: 'selectionChange', selectedRows: TData[]): void
}>()

// Table state
const sorting = ref<SortingState>([])
const columnFilters = ref<ColumnFiltersState>([])
const columnVisibility = ref<VisibilityState>({})
const rowSelection = ref<RowSelectionState>({})

// Search input
const globalFilter = ref('')

const table = useVueTable({
  get data() { return props.data },
  get columns() { return props.columns },
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
  onSortingChange: updaterOrValue => valueUpdater(updaterOrValue, sorting),
  onColumnFiltersChange: updaterOrValue => valueUpdater(updaterOrValue, columnFilters),
  onColumnVisibilityChange: updaterOrValue => valueUpdater(updaterOrValue, columnVisibility),
  onRowSelectionChange: updaterOrValue => valueUpdater(updaterOrValue, rowSelection),
  state: {
    get sorting() { return sorting.value },
    get columnFilters() { return columnFilters.value },
    get columnVisibility() { return columnVisibility.value },
    get rowSelection() { return rowSelection.value },
  },
})

// Filter by name when globalFilter changes
watch(globalFilter, (value) => {
  table.getColumn('name')?.setFilterValue(value)
})

// Emit selection changes
watch(rowSelection, () => {
  const selectedRows = table.getFilteredSelectedRowModel().rows.map(row => row.original)
  emit('selectionChange', selectedRows)
}, { deep: true })

// Column labels for visibility dropdown
const columnLabels: Record<string, string> = {
  name: 'Name',
  caseNumber: 'Case Number',
  completion: 'Completion',
  nextDeadline: 'Next Deadline',
  members: 'Lawyers',
}

const selectedCount = computed(() => table.getFilteredSelectedRowModel().rows.length)
const totalCount = computed(() => table.getFilteredRowModel().rows.length)
</script>

<template>
  <div class="w-full flex flex-col h-full gap-4">
    <!-- Toolbar -->
    <div class="flex items-center justify-between gap-2">
      <div class="flex flex-1 items-center gap-2">
        <!-- Search/Filter input -->
        <div class="relative max-w-sm">
          <Search class="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            v-model="globalFilter"
            placeholder="Filter by name..."
            class="pl-8 max-w-sm"
          />
          <button
            v-if="globalFilter"
            class="absolute right-2 top-2.5 text-muted-foreground hover:text-foreground"
            @click="globalFilter = ''"
          >
            <X class="h-4 w-4" />
          </button>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <!-- Selection info -->
        <div v-if="selectedCount > 0" class="text-sm text-muted-foreground">
          {{ selectedCount }} of {{ totalCount }} selected
        </div>

        <!-- Column visibility dropdown -->
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button variant="outline" size="sm">
              Columns
              <ChevronDown class="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuCheckboxItem
              v-for="column in table.getAllColumns().filter((column) => column.getCanHide())"
              :key="column.id"
              class="capitalize"
              :checked="column.getIsVisible()"
              @update:checked="(value) => column.toggleVisibility(!!value)"
            >
              {{ columnLabels[column.id] || column.id }}
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>

    <!-- Table -->
    <div class="rounded-md border flex-1 overflow-auto">
      <Table>
        <TableHeader class="sticky top-0 bg-background z-10">
          <TableRow
            v-for="headerGroup in table.getHeaderGroups()"
            :key="headerGroup.id"
            class="bg-muted/50"
          >
            <TableHead
              v-for="header in headerGroup.headers"
              :key="header.id"
              :style="{ width: header.id === 'select' ? '40px' : header.id === 'actions' ? '60px' : 'auto' }"
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
          <template v-if="table.getRowModel().rows?.length">
            <TableRow
              v-for="row in table.getRowModel().rows"
              :key="row.id"
              :data-state="row.getIsSelected() ? 'selected' : undefined"
              class="hover:bg-muted/50 data-[state=selected]:bg-primary/10"
            >
              <TableCell
                v-for="cell in row.getVisibleCells()"
                :key="cell.id"
              >
                <FlexRender
                  :render="cell.column.columnDef.cell"
                  :props="cell.getContext()"
                />
              </TableCell>
            </TableRow>
          </template>
          <template v-else>
            <TableRow>
              <TableCell
                :colspan="columns.length"
                class="h-24 text-center text-muted-foreground"
              >
                No results.
              </TableCell>
            </TableRow>
          </template>
        </TableBody>
      </Table>
    </div>
  </div>
</template>
