import type { ColumnDef } from '@tanstack/vue-table'
import type { DirectoryRow } from './members'
import type { MenuAction } from '~/components/shared/ActionMenu/Items.vue'
import { h } from 'vue'
import MemberAvatar from '~/components/shared/Lawyers/MemberAvatar.vue'
import MemberRoleBadge from '~/components/shared/Lawyers/MemberRoleBadge.vue'
import MemberAuthorityBadge from '~/components/shared/Lawyers/MemberAuthorityBadge.vue'
import MemberStatusBadge from '~/components/shared/Lawyers/MemberStatusBadge.vue'
import MemberActions from '~/components/shared/Lawyers/MemberActions.vue'

/** Columns for the firm directory.
 *
 *  Member · Title · Authority · Status · Matters · Next deadline · actions.
 *
 *  Title and Authority are two columns because they answer two different
 *  questions — what this person does as a lawyer, and what they may do to the
 *  workspace — and collapsing them is what made "role" mean two things
 *  everywhere else in this surface.
 *
 *  Sorting, filtering and paging are the SERVER's. The table renders the page it
 *  is given; it does not re-sort or re-filter it, because a client that did
 *  would disagree with the pagination it is drawing.
 */
export function directoryColumns(options: {
    /** The same action list the right-click menu renders. Built by the page so
     *  the two menus cannot drift apart. */
    actionsFor: (row: DirectoryRow) => MenuAction[]
}): ColumnDef<DirectoryRow>[] {
    const dateOnly = (value?: string) =>
        value
            ? new Date(value).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' })
            : ''

    return [
        {
            id: 'member',
            accessorKey: 'name',
            header: 'Member',
            enableSorting: false,
            cell: ({ row }) =>
                row.original.kind === 'invitation'
                    // An invitation has no profile to open and often no name yet —
                    // only the address it was sent to. Rendering the avatar
                    // component would offer a sheet that 404s.
                    ? h('div', { class: 'flex flex-col p-2 min-w-0' }, [
                        h('span', { class: 'text-sm font-medium leading-none truncate' },
                            row.original.name || row.original.email),
                        h('span', { class: 'text-xs text-muted-foreground mt-0.5 truncate' },
                            row.original.name ? row.original.email : 'Invitation not yet accepted'),
                    ])
                    : h(MemberAvatar, {
                        name: row.original.name,
                        email: row.original.email,
                        avatar: row.original.avatar,
                        lawyerId: row.original.id,
                    }),
        },

        {
            id: 'title',
            accessorKey: 'organisationRole',
            header: 'Title',
            enableSorting: false,
            cell: ({ row }) =>
                h('div', { class: 'flex flex-row items-center gap-1.5' }, [
                    h(MemberRoleBadge, {
                        role: row.original.organisationRole,
                        label: row.original.roleLabel,
                    }),
                    // "Modified" is the answer to "what did we change for this
                    // person" — the whole reason overrides are stored apart from
                    // the role's bundle.
                    row.original.overridden?.length
                        ? h('span', {
                            class: 'text-[10px] uppercase tracking-wide text-muted-foreground',
                            title: `Access differs from ${row.original.roleLabel || row.original.organisationRole}`,
                        }, 'Modified')
                        : null,
                ]),
        },

        {
            id: 'authority',
            accessorKey: 'authority',
            header: 'Authority',
            enableSorting: false,
            cell: ({ row }) => h(MemberAuthorityBadge, { authority: row.original.authority }),
        },

        {
            id: 'status',
            accessorKey: 'status',
            header: 'Status',
            enableSorting: false,
            cell: ({ row }) =>
                h(MemberStatusBadge, {
                    status: row.original.status,
                    verified: row.original.verified,
                    kind: row.original.kind,
                }),
        },

        {
            id: 'workload',
            header: 'Active work',
            enableSorting: false,
            // Matters and engagements, counted apart rather than summed: a firm
            // does both kinds of work, and which kind somebody is carrying is the
            // point of looking. Null rather than 0 for an invitation and for a
            // deployment without the collection — a zero would read as "assigned
            // to nothing", which is a different statement from "not applicable".
            cell: ({ row }) => {
                const parts = []
                if (typeof row.original.matters === 'number') {
                    parts.push(h('span', { class: 'text-sm tabular-nums' },
                        `${row.original.matters} ${row.original.matters === 1 ? 'matter' : 'matters'}`))
                }
                if (typeof row.original.engagements === 'number' && row.original.engagements > 0) {
                    parts.push(h('span', { class: 'text-xs text-muted-foreground tabular-nums' },
                        `${row.original.engagements} ${row.original.engagements === 1 ? 'engagement' : 'engagements'}`))
                }
                if (!parts.length) {
                    return h('span', { class: 'text-sm text-muted-foreground' }, '—')
                }
                return h('div', { class: 'flex flex-col leading-tight' }, parts)
            },
        },

        {
            id: 'nextDeadline',
            header: 'Next deadline',
            enableSorting: false,
            cell: ({ row }) => {
                if (row.original.kind === 'invitation') {
                    const expires = row.original.invitation?.expiresAt
                    return h('span', { class: 'text-sm text-muted-foreground' },
                        expires ? `Invite expires ${dateOnly(expires)}` : '—')
                }
                const deadline = row.original.nextDeadline
                if (!deadline) {
                    return h('span', { class: 'text-sm text-muted-foreground' }, 'No deadlines')
                }
                return h('div', { class: 'flex flex-col' }, [
                    h('span', { class: 'ibm-plex-serif font-semibold truncate' }, deadline.name),
                    h('span', { class: 'text-sm text-muted-foreground' }, dateOnly(deadline.date)),
                ])
            },
        },

        {
            id: 'actions',
            enableHiding: false,
            enableSorting: false,
            cell: ({ row }) =>
                h(MemberActions, {
                    member: row.original,
                    actionsFor: options.actionsFor,
                }),
        },
    ]
}
