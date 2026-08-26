import { pb as pocketbase, SERVER_URL } from '~/lib/pocketbase'

/**
 * Organisation membership: resolving an invite code, and joining with it.
 *
 * These call internal/membership, which replaced pb_hooks/invitations.pb.js.
 * The paths are unchanged from the goja version — the port deliberately kept
 * them byte-identical.
 */

/** Throws with the server's own message, which is written to be shown to a user. */
async function unwrap(res: Response, fallback: string) {
  const data = await res.json().catch(() => ({} as any))
  if (!res.ok) throw new Error(data?.message ?? fallback)
  return data
}

/** Exchange an 8-character invite code for the token the accept call needs. */
export async function resolveInviteCode(code: string): Promise<string> {
  const res = await fetch(`${SERVER_URL}/api/invitations/get-link`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  })
  const data = await unwrap(res, 'Invalid code. Please check and try again.')
  return data.token
}

export interface JoinResult {
  organisation: { id: string; name: string }
  message: string
}

/**
 * Join an organisation with a typed invite code, as an already-signed-in user.
 *
 * One call rather than resolve-then-accept: the server composes the two so the
 * email match, the seat check, and the current-workspace rule cannot drift
 * between the two entry points.
 *
 * Joining does NOT move you into the new workspace — `Users.organisation` is
 * the workspace you are currently looking at, and overwriting it would evict
 * you from your existing firm. The caller offers the switch instead.
 */
export async function joinOrganisation(code: string): Promise<JoinResult> {
  const res = await fetch(`${SERVER_URL}/api/organisations/join`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${pocketbase.authStore.token}`,
    },
    body: JSON.stringify({ code }),
  })
  return unwrap(res, 'We could not join that organisation. Please try again.') as Promise<JoinResult>
}

export type CreateOrganisationMode = 'create' | 'upgrade'

export interface CreateOrganisationInput {
  name: string
  mode: CreateOrganisationMode
  contactName?: string
  contactEmail?: string
  contactPhone?: string
  emailDomain?: string
}

export interface CreateOrganisationResult {
  organisation: { id: string; name: string }
  mode: CreateOrganisationMode
  /** True when the server already moved the caller into the new workspace. */
  switched: boolean
  subscription?: { id: string }
  /** Only present for an upgrade: rows moved, keyed by collection. */
  moved?: Record<string, number>
}

/**
 * Create an organisation, or upgrade a solo account into one.
 *
 * `create` makes an additional firm: existing work stays where it is and the
 * caller keeps their current workspace. `upgrade` turns a solo account into a
 * firm and moves that person's own work across — only valid when the caller has
 * no workspace, because someone already inside a firm has nothing to upgrade
 * and their work belongs to that firm.
 *
 * Both modes start a fresh trial.
 */
export async function createOrganisation(
  input: CreateOrganisationInput,
): Promise<CreateOrganisationResult> {
  const res = await fetch(`${SERVER_URL}/api/organisations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${pocketbase.authStore.token}`,
    },
    body: JSON.stringify(input),
  })
  return unwrap(res, 'We could not create that organisation. Please try again.') as Promise<CreateOrganisationResult>
}
