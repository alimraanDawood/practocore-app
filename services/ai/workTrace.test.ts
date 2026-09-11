import { describe, expect, test } from 'bun:test';
import { formatWorkDuration, summarizeAgentTrace } from './workTrace';
import type { ResearchEvent } from '../deepTask';

describe('work trace presentation', () => {
  test('formats short and minute durations compactly', () => {
    expect(formatWorkDuration(0)).toBe('1s');
    expect(formatWorkDuration(35_100)).toBe('35s');
    expect(formatWorkDuration(72_000)).toBe('1m 12s');
    expect(formatWorkDuration(120_000)).toBe('2m');
  });

  test('derives agent facts from immutable public events', () => {
    const events = [
      { id: '1', taskId: 't', agentId: 'a', kind: 'agent_started', label: 'Started', created: '2026-09-09T10:00:00Z' },
      { id: '2', taskId: 't', agentId: 'a', kind: 'tool', label: 'Searched', tool: 'search_cases', created: '2026-09-09T10:00:05Z' },
      { id: '3', taskId: 't', agentId: 'a', kind: 'source_read', label: 'Read case', created: '2026-09-09T10:00:08Z' },
      { id: '4', taskId: 't', agentId: 'a', kind: 'finding', label: 'Recorded finding', created: '2026-09-09T10:00:10Z' },
      { id: '5', taskId: 't', agentId: 'a', kind: 'agent_finished', label: 'Finished', created: '2026-09-09T10:00:12Z' },
      { id: '6', taskId: 't', agentId: 'other', kind: 'tool', label: 'Ignored', created: '2026-09-09T10:00:20Z' },
    ] as ResearchEvent[];

    expect(summarizeAgentTrace(events, 'a')).toEqual({
      durationMs: 12_000,
      toolCalls: 1,
      sourceReads: 1,
      findings: 1,
      startedAt: '2026-09-09T10:00:00Z',
      finishedAt: '2026-09-09T10:00:12Z',
    });
  });
});
