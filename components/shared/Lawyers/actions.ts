import { Trash2, Crown, ShieldOff, Copy, Send, Ban, UserPlus, RefreshCcw, Shield } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import type { MenuAction } from '~/components/shared/ActionMenu/Items.vue'
import type { DirectoryRow } from './members'
import {
    removeMember,
    updateMemberAuthority,
    resendInvite,
    revokeInvite,
    apiErrorMessage,
} from '~/services/admin'

/** One definition of "what you can do to this person".
 *
 *  The same list drives the row's ⋯ button and the right-click menu, so an
 *  action can never exist in one and be missing from the other — which is how
 *  the old surface ended up with a dropdown offering "Edit member" and "Change
 *  role" that nothing implemented.
 *
 *  Everything that opens a dialog goes through `requestConfirm` rather than
 *  setting the dialog's own state. A menu and a dialog are separate dismissable
 *  layers: opening the dialog while the menu is still closing leaves the body's
 *  pointer-events lock behind and the whole app stops responding to clicks (see
 *  CLAUDE.md). The caller defers it a tick.
 */
export interface DirectoryActionContext {
    canAdminister: boolean
    organisationId?: string
    currentUserId?: string
    /** Called after any change that the server accepted. */
    onChanged: () => void
    /** Opens a confirmation dialog for a destructive action, a tick later. */
    requestConfirm: (kind: 'remove' | 'revoke', row: DirectoryRow) => void
    /** Reports that a request is in flight, so menus can disable while it runs. */
    setBusy: (busy: boolean) => void
}

async function run(
    ctx: DirectoryActionContext,
    work: Promise<any>,
    success: string,
    failure: string,
) {
    ctx.setBusy(true)
    try {
        const result: any = await work
        toast.success(result?.message || success)
        ctx.onChanged()
    } catch (e) {
        console.error(e)
        toast.error(apiErrorMessage(e, failure))
    } finally {
        ctx.setBusy(false)
    }
}

export function directoryActions(row: DirectoryRow, ctx: DirectoryActionContext): MenuAction[] {
    const actions: MenuAction[] = []
    const isSelf = row.id === ctx.currentUserId
    const isInvitation = row.kind === 'invitation'
    // The owner is neither demotable nor removable from here — ownership moves by
    // transfer, in the member's own sheet, and the server refuses either way.
    // Offering an action that can only produce an error is worse than not
    // offering it.
    const isOwner = row.authority === 'owner'

    actions.push({
        id: 'copy-email',
        label: 'Copy email',
        icon: Copy,
        run: async () => {
            await navigator.clipboard.writeText(row.email)
            toast.success('Email copied')
        },
    })

    if (isInvitation) {
        if (row.invitation?.code) {
            actions.push({
                id: 'copy-code',
                label: 'Copy join code',
                icon: Copy,
                run: async () => {
                    // The join code, not the token: it is what the invited person
                    // types into the app, and the only part of an invitation safe
                    // to pass around by hand.
                    await navigator.clipboard.writeText(row.invitation!.code)
                    toast.success('Join code copied')
                },
            })
        }
        if (ctx.canAdminister) {
            actions.push({
                id: 'resend',
                label: 'Resend invitation',
                icon: Send,
                run: () => run(ctx, resendInvite(row.id), 'Invitation resent', 'Could not resend the invitation'),
            })
            actions.push({
                id: 'revoke',
                label: 'Revoke invitation',
                icon: Ban,
                danger: true,
                divider: true,
                run: () => ctx.requestConfirm('revoke', row),
            })
        }
        return actions
    }

    if (!ctx.canAdminister) return actions

    if (isSelf) {
        actions.push({
            id: 'self',
            label: 'This is you',
            icon: UserPlus,
            disabled: true,
            divider: true,
            run: () => {},
        })
        return actions
    }

    if (isOwner) {
        actions.push({
            id: 'owner',
            label: 'Owner — transfer ownership first',
            icon: Shield,
            disabled: true,
            divider: true,
            run: () => {},
        })
        return actions
    }

    if (!ctx.organisationId) return actions

    if (row.authority === 'member') {
        actions.push({
            id: 'make-admin',
            label: 'Make admin',
            icon: Crown,
            divider: true,
            run: () => run(ctx, updateMemberAuthority(row.id, ctx.organisationId!, 'admin'),
                'Member is now an admin', 'Could not change authority'),
        })
    } else {
        actions.push({
            id: 'make-member',
            label: 'Remove admin access',
            icon: ShieldOff,
            divider: true,
            run: () => run(ctx, updateMemberAuthority(row.id, ctx.organisationId!, 'member'),
                'Administrator access removed', 'Could not change authority'),
        })
    }

    actions.push({
        id: 'remove',
        label: 'Remove from firm',
        icon: Trash2,
        danger: true,
        divider: true,
        run: () => ctx.requestConfirm('remove', row),
    })

    return actions
}

/** What you can do to the directory itself, shown when the right-click lands on
 *  the table rather than on a row. Without it, missing a row by a few pixels
 *  opens an empty menu. */
export function directorySurfaceActions(options: {
    canAdminister: boolean
    onRefresh: () => void
    onInvite: () => void
    onRoles: () => void
}): MenuAction[] {
    const actions: MenuAction[] = [
        { id: 'refresh', label: 'Refresh', icon: RefreshCcw, run: options.onRefresh },
    ]
    if (options.canAdminister) {
        actions.push({ id: 'invite', label: 'Invite a colleague', icon: UserPlus, divider: true, run: options.onInvite })
        actions.push({ id: 'roles', label: 'Manage roles', icon: Shield, run: options.onRoles })
    }
    return actions
}
