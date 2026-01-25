import { h } from 'vue'
import type { MattersRecord, DeadlinesResponse, UsersResponse } from '~/lib/pocketbase-types'
import { type ColumnDef } from '@tanstack/vue-table'
import { CircleProgressBar } from 'vue3-m-circle-progress-bar'
import dayjs from 'dayjs'
import { ArrowUpDown, CalendarIcon } from 'lucide-vue-next'
import relativeTime from 'dayjs/plugin/relativeTime'
import Checkbox from '@/components/ui/checkbox/Checkbox.vue'
import MatterRowActions from './MatterRowActions.vue'

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
            const completed = deadlines.filter((d: DeadlinesResponse) => d.completed === true).length
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
        accessorFn: (row) => {
            const deadlines = row.expand?.deadlines ?? []
            const nextDeadline = deadlines
                .filter((d: DeadlinesResponse) => d.completed === false && d.missed === false)
                .sort((d1: DeadlinesResponse, d2: DeadlinesResponse) => new Date(d1.date).getTime() - new Date(d2.date).getTime())
                .at(0)
            return nextDeadline?.date ? new Date(nextDeadline.date).getTime() : Infinity
        },
        cell: ({ row }) => {
            const deadlines = row.original.expand?.deadlines ?? []
            const nextDeadline = deadlines
                .filter((d: DeadlinesResponse) => d.completed === false && d.missed === false)
                .sort((d1: DeadlinesResponse, d2: DeadlinesResponse) => new Date(d1.date).getTime() - new Date(d2.date).getTime())
                .at(0)

            if (nextDeadline) {
                return h('div', { class: 'flex flex-row gap-1 items-center ibm-plex-serif' }, [
                    h(CalendarIcon, { class: "size-4" }),
                    dayjs(nextDeadline.date).format('D MMM YYYY'),
                    ` (${dayjs(nextDeadline.date).fromNow()})`
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
