/**
 * Shared shape for a verified invitation.
 *
 * In a plain module rather than exported from the SFC: `<script setup>` cannot
 * carry ES module exports, and while a type-only export happens to survive the
 * compiler today, importing it from a `.vue` file is not something to rely on.
 */
export interface InviteDetails {
  orgName: string
  inviterName: string
  /** The address the invitation was sent to. Shown to the user because the
   *  server enforces a strict email match on accept. */
  email: string
}
