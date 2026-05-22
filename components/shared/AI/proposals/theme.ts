// Shared helpers for the AI proposal (tool-permission) cards.
// `variant` lets one set of sub-views render on both the light "panel" surface
// (chat mode) and the dark glass surface (voice/audio overlay).

export type ProposalVariant = 'panel' | 'glass';

export interface ProposalTheme {
  glass: boolean;
  strong: string; // primary text
  muted: string; // secondary text
  subtle: string; // labels / least emphasis
  divider: string; // borders between rows
  chip: string; // neutral pill background
  surface: string; // nested panel background
}

export function proposalTheme(variant: ProposalVariant): ProposalTheme {
  const glass = variant === 'glass';
  return {
    glass,
    strong: glass ? 'text-white' : 'text-foreground',
    muted: glass ? 'text-white/60' : 'text-muted-foreground',
    subtle: glass ? 'text-white/40' : 'text-muted-foreground/80',
    divider: glass ? 'border-white/15' : 'border-border',
    chip: glass ? 'bg-white/10 text-white/80 border border-white/10' : 'bg-muted text-foreground border border-border',
    surface: glass ? 'bg-white/5 border border-white/10' : 'bg-background/60 border border-border',
  };
}

export function initials(name?: string): string {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0]?.at(0) ?? '').toUpperCase() + (parts[1]?.at(0) ?? '').toUpperCase();
  }
  return (parts[0]?.slice(0, 2) ?? '??').toUpperCase();
}

// Backend dates arrive as "2006-01-02 15:04:05.000Z" or plain "2006-01-02".
export function formatProposalDate(raw?: string): string {
  if (!raw) return '';
  const iso = raw.includes(' ') ? raw.replace(' ', 'T') : raw;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return raw;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatToolName(tool?: string): string {
  if (!tool) return 'Action';
  return tool.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
