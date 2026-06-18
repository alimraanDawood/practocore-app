// A person shown in the reusable MemberPicker. Shaped to match the org-members
// endpoint (getOrganisationMembers / getUserOrganisationMembers) so callers can
// pass its rows straight through, but every field beyond `id` is optional.
export interface PickerMember {
  id: string;
  name?: string;
  email?: string;
  avatar?: string;
  /** Firm position (partner / associate / …) → rendered as a badge. */
  organisationRole?: string;
  /** Access role (admin / lawyer / …); not shown but available to callers. */
  role?: string;
}
