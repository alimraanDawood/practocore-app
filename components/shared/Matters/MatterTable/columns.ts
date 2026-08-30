import { h } from 'vue'
import type { MattersRecord, DeadlinesResponse, UsersResponse } from '~/lib/pocketbase-types'
import { type ColumnDef } from '@tanstack/vue-table'
import { CircleProgressBar } from 'vue3-m-circle-progress-bar'
import dayjs from 'dayjs'
import { ArrowUpDown, CalendarIcon, AlertTriangle } from 'lucide-vue-next'
import relativeTime from 'dayjs/plugin/relativeTime'
import Checkbox from '@/components/ui/checkbox/Checkbox.vue'
import MatterRowActions from './MatterRowActions.vue'
import { deadlineCountdown, isFulfilled, isOverdue, nextOpenDeadline } from '~/services/deadlines/urgency'

dayjs.extend(relativeTime)

// Type for matter with expanded relations
export type MatterWithExpand = MattersRecord & {
    expand?: {
        deadlines?: DeadlinesResponse[]
        members?: UsersResponse[]
    }
}

export const columns: ColumnDef<MatterWithExpand>[] = [
    {
        id: 'select',
        header: ({ table }) => h(Checkbox, {
            'checked': table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && 'indeterminate'),
            'onUpdate:checked': (value: boolean) => table.toggleAllPageRowsSelected(value),
            'ariaLabel': 'Select all',
        }),
        cell: ({ row }) => h(Checkbox, {
            'checked': row.getIsSelected(),
            'onUpdate:checked': (value: boolean) => row.toggleSelected(value),
            'ariaLabel': 'Select row',
        }),
        enableSorting: false,
        enableHiding: false,
    },
    {
        accessorKey: 'name',
        header: ({ column }) => {
            return h('button', {
                class: 'flex items-center gap-1 font-semibold ibm-plex-serif hover:text-primary transition-colors',
                onClick: () => column.toggleSorting(column.getIsSorted() === 'asc'),
            }, [
                'Name',
                h(ArrowUpDown, { class: 'h-4 w-4 opacity-50' })
            ])
        },
        cell: ({ row }) => {
            return h('a', {
                href: `/main/matters/matter/${row.original.id}`,
                class: 'font-semibold hover:text-primary hover:underline ibm-plex-serif'
            }, row.original.name)
        }
    },
    {
        accessorKey: 'caseNumber',
        header: ({ column }) => {
            return h('button', {
                class: 'flex items-center gap-1 font-semibold ibm-plex-serif hover:text-primary transition-colors',
                onClick: () => column.toggleSorting(column.getIsSorted() === 'asc'),
            }, [
                'Case Number',
                h(ArrowUpDown, { class: 'h-4 w-4 opacity-50' })
            ])
        },
        cell: ({ row }) => {
            return h('div', { class: 'font-semibold' }, row.original.caseNumber || '-')
        }
    },
    {
        accessorKey: 'completion',
        header: () => h('div', { class: 'font-semibold ibm-plex-serif' }, 'Completion'),
        cell: ({ row }) => {
            const deadlines = row.original.expand?.deadlines ?? []
            // `d.completed === true` was never true: Deadlines has no such
            // column (see lib/pocketbase-types.ts), so this table reported 0%
            // completion on every matter in every firm.
            const completed = deadlines.filter(isFulfilled).length
            const total = deadlines.length
            const completionRate = total === 0 ? 0 : Number(((completed / total) * 100).toFixed(1))

            return h('div', { class: 'font-semibold flex flex-row gap-1 items-center' }, [
                h(CircleProgressBar, { value: completionRate, max: 100, rounded: true, strokeWidth: 10, class: 'size-4' }),
                completionRate === 0 ? '-' : `${completionRate}%`
            ])
        },
        enableSorting: false,
    },
    {
        accessorKey: 'nextDeadline',
        header: ({ column }) => {
            return h('button', {
                class: 'flex items-center gap-1 font-semibold ibm-plex-serif hover:text-primary transition-colors',
                onClick: () => column.toggleSorting(column.getIsSorted() === 'asc'),
            }, [
                'Next Deadline',
                h(ArrowUpDown, { class: 'h-4 w-4 opacity-50' })
            ])
        },
        // `completed`/`missed` are fields Deadlines does not have, so this filter
        // was false for every row and the column read "-" on every matter — the
        // next date on the file, missing from the list view of the whole docket.
        accessorFn: (row) => {
            const next = nextOpenDeadline(row.expand?.deadlines ?? [])
            return next?.date ? new Date(next.date).getTime() : Infinity
        },
        cell: ({ row }) => {
            const nextDeadline = nextOpenDeadline(row.original.expand?.deadlines ?? [])

            if (nextDeadline) {
                const overdue = isOverdue(nextDeadline, { owner: row.original })
                return h('div', {
                    class: `flex flex-row gap-1 items-center ibm-plex-serif${overdue ? ' text-destructive font-medium' : ''}`
                }, [
                    h(overdue ? AlertTriangle : CalendarIcon, { class: "size-4" }),
                    dayjs(nextDeadline.date).format('D MMM YYYY'),
                    ` (${deadlineCountdown(nextDeadline)})`
                ])
            }

            return h('span', { class: 'text-muted-foreground' }, '-')
        }
    },
    {
        accessorKey: 'members',
        header: () => h('div', { class: 'font-semibold ibm-plex-serif' }, 'Lawyers'),
        cell: ({ row }) => {
            const matter = row.original
            const members = matter?.expand?.members ?? []

            if (members.length === 0) {
                return h('span', { class: 'text-muted-foreground' }, '-')
            }

            return h('div', {
                class: 'flex flex-row -space-x-2 items-center ibm-plex-serif',
            }, [
                members.slice(0, 4).map((m: UsersResponse) => {
                    return h('div', {
                        class: 'size-8 border rounded-full text-xs bg-muted grid place-items-center text-muted-foreground',
                        title: m?.name
                    }, m?.name?.split(' ').map((n: string) => n[0]).join(''))
                }),
                members.length > 4 ? h('div', {
                    class: 'size-8 border rounded-full text-xs bg-muted grid place-items-center text-muted-foreground'
                }, `+${members.length - 4}`) : null
            ])
        },
        enableSorting: false,
    },
    {
        id: 'actions',
        enableHiding: false,
        cell: ({ row }) => {
            const matter = row.original
            return h(MatterRowActions, { matter })
        },
    },
]
