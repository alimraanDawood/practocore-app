import type { ResearchEvent } from '~/services/deepTask';

/** Shared display formatting for chat work and deep-research agents. */
export function formatWorkDuration(ms: number): string {
  const seconds = Math.max(1, Math.round(Math.max(0, ms) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return remainder ? `${minutes}m ${remainder}s` : `${minutes}m`;
}

function timestamp(value?: string): number | null {
  if (!value) return null;
  const parsed = new Date(value.replace(' ', 'T')).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

export interface AgentTraceSummary {
  durationMs: number | null;
  toolCalls: number;
  sourceReads: number;
  findings: number;
  startedAt: string | null;
  finishedAt: string | null;
}

/** Derive inspectable agent facts from its immutable public event journal. */
export function summarizeAgentTrace(events: ResearchEvent[], agentId: string, now = Date.now()): AgentTraceSummary {
  const relevant = events.filter(event => event.agentId === agentId);
  const started = relevant.find(event => event.kind === 'agent_started') ?? relevant[0];
  const finished = [...relevant].reverse().find(event => event.kind === 'agent_finished');
  const startMs = timestamp(started?.created);
  const finishMs = timestamp(finished?.created);

  return {
    durationMs: startMs === null ? null : Math.max(0, (finishMs ?? now) - startMs),
    toolCalls: relevant.filter(event => event.kind === 'tool').length,
    sourceReads: relevant.filter(event => event.kind === 'source_read').length,
    findings: relevant.filter(event => event.kind === 'finding').length,
    startedAt: started?.created ?? null,
    finishedAt: finished?.created ?? null,
  };
}
