import type { ColumnDef } from '@tanstack/vue-table'
import {getOrganisationRoleString, type Member} from './members'
import { h } from 'vue'
import { ArrowUpDown } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import MemberAvatar from '~/components/shared/lawyers/MemberAvatar.vue'
import MemberRoleBadge from '~/components/shared/lawyers/MemberRoleBadge.vue'
import MemberVerifiedBadge from '~/components/shared/lawyers/MemberVerifiedBadge.vue'
import MemberActions from '~/components/shared/lawyers/MemberActions.vue'

export const columns: ColumnDef<Member>[] = [
    // ── Member (avatar + name + email) ─────────────────────────────────────────
    {
        id: 'member',
        accessorKey: 'name',
        header: ({ column }) =>
            h(
                Button,
                {
                    variant: 'ghost',
                    class: 'px-0 hover:bg-transparent font-medium',
                    onClick: () => column.toggleSorting(column.getIsSorted() === 'asc'),
                },
                () => ['Member', h(ArrowUpDown, { class: 'ml-2 h-4 w-4' })],
            ),
        cell: ({ row }) =>
            h(MemberAvatar, {
                name: row.original.name,
                email: row.original.email,
                avatar: row.original.avatar,
                lawyerId: row.original.id,
            }),
        filterFn: (row, _columnId, filterValue: string) => {
            if (!filterValue) return true
            const q = filterValue.toLowerCase()
            return (
                row.original.name?.toLowerCase().includes(q) ||
                row.original.email?.toLowerCase().includes(q)
            )
        },
    },

    // ── Email ───────────────────────────────────────────────────────────────────
    {
        accessorKey: 'email',
        header: 'Email',
        cell: ({ row }) =>
            h('a', {
                href: `mailto:${row.original.email}`,
                class: 'text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline transition-colors',
            }, row.original.email),
        enableSorting: false,
    },

    // ── Role ────────────────────────────────────────────────────────────────────
    {
        accessorKey: 'role',
        header: 'Role',
        cell: ({ row }) =>
            h(MemberRoleBadge, { role: getOrganisationRoleString(row.original.organisationRole) }),
        filterFn: (row, _columnId, filterValue: string[]) => {
            if (!filterValue.length) return true
            return filterValue.includes(row.original.organisationRole)
        },
    },

    {
        accessorKey: 'activeMatters',
        header: 'Active Matters',
        cell: ({ row }) =>
            h('span', {}, row.original?.activeMatters?.length || 0),
        // filterFn: (row, _columnId, filterValue: string[]) => {
        //     if (!filterValue.length) return true
        //     return filterValue.includes(row.original.organisationRole)
        // },
    },

    {
        accessorKey: 'nextDeadline',
        header: 'Next Deadline',
        cell: ({ row }) =>
            h('div', { class: 'flex flex-col' }, [
                h('span', { class: 'ibm-plex-serif font-semibold truncate' }, row.original?.nextDeadline?.name ||  'No deadlines'),
                h('span', { class: 'text-sm text-muted-foreground' }, row.original?.nextDeadline?.date ? new Date(row.original.nextDeadline.date).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' }) : '')
            ])
        // filterFn: (row, _columnId, filterValue: string[]) => {
        //     if (!filterValue.length) return true
        //     return filterValue.includes(row.original.organisationRole)
        // },
    },


    // ── Verified ────────────────────────────────────────────────────────────────
    {
        accessorKey: 'verified',
        header: 'Status',
        cell: ({ row }) =>
            h(MemberVerifiedBadge, { verified: row.original.verified }),
        filterFn: (row, _columnId, filterValue: string) => {
            if (filterValue === '') return true
            return row.original.verified === (filterValue === 'true')
        },
    },

    // ── Joined date ─────────────────────────────────────────────────────────────
    {
        accessorKey: 'created',
        header: ({ column }) =>
            h(
                Button,
                {
                    variant: 'ghost',
                    class: 'px-0 hover:bg-transparent font-medium',
                    onClick: () => column.toggleSorting(column.getIsSorted() === 'asc'),
                },
                () => ['Joined', h(ArrowUpDown, { class: 'ml-2 h-4 w-4' })],
            ),
        cell: ({ row }) => {
            const date = new Date(row.original.created)
            return h('span', { class: 'text-sm text-muted-foreground' },
                date.toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' }),
            )
        },
        enableColumnFilter: false,
    },

    // ── Row actions ─────────────────────────────────────────────────────────────
    {
        id: 'actions',
        enableHiding: false,
        enableSorting: false,
        cell: ({ row }) =>
            h(MemberActions, { member: row.original }),
    },
]