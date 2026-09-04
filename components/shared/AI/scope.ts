import { Building2, Clock, User, Briefcase, Library, type LucideIcon } from 'lucide-vue-next';
import type { ContextType, ContextItem } from '~/services/ai';
import { getMatters, getAllDeadlines } from '~/services/matters';
import { getOrganisationUsers } from '~/services/admin';
import { listEngagements } from '~/services/engagements';
import { listVaults } from '~/services/vault';

// A conversation's scope — the one matter, engagement, vault, deadline or colleague
// it is about. Shared between the chip that displays it and the picker that sets it,
// so the two can never drift on what a type looks like or what it's called.

export const scopeIcons: Record<ContextType, LucideIcon> = {
  matter: Building2,
  engagement: Briefcase,
  vault: Library,
  deadline: Clock,
  user: User,
};

// Group headings, in the order the picker lists them: what a lawyer most often means
// by "this conversation is about X" comes first.
export const scopeGroups: { type: ContextType; label: string }[] = [
  { type: 'matter', label: 'Matters' },
  { type: 'engagement', label: 'Engagements' },
  { type: 'vault', label: 'Vaults' },
  { type: 'deadline', label: 'Deadlines' },
  { type: 'user', label: 'Lawyers' },
];

/**
 * Everything the current user could scope a chat to, as one flat list.
 *
 * Loaded once and filtered client-side: the picker is a search box over what the
 * user can already reach, not a query API. Each source is tolerated independently —
 * a firm with no engagements or no custom vaults must still get a working matter
 * search, not an empty picker.
 */
export async function loadScopeCandidates(): Promise<ContextItem[]> {
  const [matters, engagements, vaults, deadlines, users] = await Promise.all([
    getMatters(1, 100, { sort: '-created' }).catch(() => ({ items: [] })),
    listEngagements(1, 100, { sort: '-created' }).catch(() => ({ items: [] })),
    listVaults().catch(() => []),
    getAllDeadlines({
      sort: '-date',
      filter: "status = 'pending'",
      expand: 'matter',
      fields: 'id,name,date,expand.matter.name',
    }).catch(() => []),
    getOrganisationUsers(1, 100, {}).catch(() => ({ items: [] })),
  ]);

  return [
    ...((matters as any).items ?? []).map((m: any): ContextItem => ({
      type: 'matter', id: m.id, label: m.name, sublabel: m.caseNumber || 'Matter',
    })),
    ...((engagements as any)?.items ?? []).map((e: any): ContextItem => ({
      type: 'engagement', id: e.id, label: e.name,
      sublabel: e.expand?.template?.name ?? (e.status ? `Engagement · ${e.status}` : 'Engagement'),
    })),
    ...((vaults as any[]) ?? []).map((v: any): ContextItem => ({
      type: 'vault', id: v.id, label: v.name,
      sublabel: v.description || (v.visibility === 'personal' ? 'Personal vault' : 'Shared vault'),
    })),
    ...((deadlines as any[]) ?? []).map((d: any): ContextItem => ({
      type: 'deadline', id: d.id, label: d.name, sublabel: d.expand?.matter?.name ?? 'Deadline',
    })),
    ...((users as any).items ?? []).map((u: any): ContextItem => ({
      type: 'user', id: u.id, label: u.name,
      sublabel: u.organisationRole ?? u.role ?? 'Colleague',
    })),
  ];
}
