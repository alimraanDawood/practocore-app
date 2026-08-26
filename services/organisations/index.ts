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
