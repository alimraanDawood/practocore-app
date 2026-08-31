/** One row of the firm directory.
 *
 *  Members and pending invitations are the same shape deliberately: they are the
 *  same thing at different stages — a person the firm has decided should be here
 *  — and the table renders them as one list. `kind` is what separates them.
 */
export interface DirectoryRow {
    kind: 'member' | 'invitation'
    id: string
    name: string
    email: string
    avatar?: string
    /** The OLD name for authority, kept because parts of the app still read it.
     *  It never carries 'owner' — the server clamps an owner to 'admin' here and
     *  puts the truth in `authority`. Prefer `authority`. */
    role?: 'admin' | 'member'
    /** owner | admin | member — who administers the workspace. */
    authority: 'owner' | 'admin' | 'member'
    /** The professional title's key. It now CARRIES the permission bundle rather
     *  than merely labelling the person. */
    organisationRole: string
    /** The firm's own name for that title, which a firm may edit. Prefer this
     *  over deriving a label from the key. */
    roleLabel?: string
    status: 'active' | 'suspended' | 'pending'
    /** What this person actually holds, resolved and materialised — not the
     *  switches somebody once flipped. */
    permissions?: string[]
    /** Capability keys whose effective level differs from their role's default.
     *  Non-empty is what the row shows as "Modified". */
    overridden?: string[]
    /** How much ACTIVE work this person is carrying. Closed and archived work is
     *  excluded — the question the column answers is who has capacity now.
     *  Null for an invitation, and where the collection is absent, because zero
     *  would read as "assigned to nothing". */
    matters?: number | null
    engagements?: number | null
    verified?: boolean
    created?: string
    updated?: string
    nextDeadline?: { id: string; name: string; date: string } | null
    invitation?: {
        id: string
        status: string
        expiresAt: string
        invitedBy: string
        code: string
    }
}

/** Retained under its old name because several components still import it. */
export type Member = DirectoryRow

export interface DirectoryResponse {
    page: number
    perPage: number
    totalItems: number
    totalPages: number
    items: DirectoryRow[]
}

/** The five seeded titles. A firm may rename them and may define its own, so
 *  this is a FALLBACK for a row that arrived without `roleLabel` — never the
 *  source of truth. The roles endpoint is. */
const SEEDED_ROLE_LABELS: Record<string, string> = {
    partner: 'Partner',
    senior_associate: 'Senior Associate',
    associate: 'Associate',
    paralegal: 'Paralegal',
    intern: 'Intern',
}

export function getOrganisationRoleString(role: string) {
    return SEEDED_ROLE_LABELS[role] ?? role
}

export const AUTHORITY_LABELS: Record<string, string> = {
    owner: 'Owner',
    admin: 'Admin',
    member: 'Member',
}

/** The capability grid, mirrored from internal/membership/resolver.go. Used by
 *  the roles screen and by the "Modified" tooltip. */
export const CAPABILITIES: { key: string; label: string; description: string; graded: boolean }[] = [
    {
        key: 'matters.all',
        label: 'Firm-wide matters',
        description: 'See matters they are not assigned to.',
        graded: true,
    },
    {
        key: 'matters.create',
        label: 'Open matters',
        description: 'Start a new matter.',
        graded: false,
    },
    {
        key: 'matters.delete',
        label: 'Delete matters',
        description: 'Remove a matter and its deadlines.',
        graded: false,
    },
    {
        key: 'applications.create',
        label: 'File applications',
        description: 'Add an application to a matter.',
        graded: false,
    },
    {
        key: 'templates.firm',
        label: 'Firm templates',
        description: "Edit playbooks and procedures a colleague authored. Everyone can always create their own.",
        graded: true,
    },
]

export const CAPABILITY_LABELS: Record<string, string> = Object.fromEntries(
    CAPABILITIES.map((c) => [c.key, c.label]),
)
