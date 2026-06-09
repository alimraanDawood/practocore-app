// Typed client for the v2 deadline engine HTTP API (/api/de).
//
// This is a THIN wrapper: it does fetch + types only, never calculation. The
// engine runs exclusively on the backend; the frontend renders schedules and
// explanations, and gets instant preview via the stateless POST /preview
// round-trip. There is no second engine implementation in the browser.
//
// Domain/response types come from the generated ./types.gen.ts (single source
// of truth = the Go wire structs). The small request-body and calendar wire
// shapes below are hand-maintained.

import { pb, SERVER_URL } from "~/lib/pocketbase";
import type {
  Schedule,
  Explanation,
  MatterEvent,
  ValidationResult,
  TemplateIR,
} from "./types.gen";

export type {
  Schedule,
  Explanation,
  MatterEvent,
  ValidationResult,
  TemplateIR,
  ResolvedDeadline,
  ResolvedEvent,
  OffsetTrace,
  TraceStep,
  Status,
  EventType,
} from "./types.gen";

// --- request wire shapes (hand-maintained; small and stable) ---

/** A holiday in a calendar payload. */
export interface HolidayInput {
  date: string; // ISO YYYY-MM-DD
  name: string;
}

/** A court recess range (inclusive). */
export interface RecessInput {
  name: string;
  start: string;
  end: string;
}

/** The calendar wire shape: holidays as a list, weekends as weekday numbers. */
export interface CalendarInput {
  jurisdiction: string;
  version?: string;
  weekendDays: number[]; // 0 = Sunday … 6 = Saturday
  holidays: HolidayInput[];
  recesses: RecessInput[];
}

/** A matter party; eventDates are ISO strings keyed by event id. */
export interface PartyInput {
  id: string;
  roleId: string;
  eventDates?: Record<string, string>;
}

/** Raw field inputs, keyed by template field id (number | string | boolean | ISO date). */
export type FieldInputs = Record<string, number | string | boolean>;

export interface PreviewRequest {
  /** Provide an inline IR (authoring) … */
  ir?: TemplateIR;
  /** … or a stored template version (intake). */
  templateVersion?: string;
  /** Provide an inline calendar … */
  calendar?: CalendarInput;
  /** … or a stored calendar version. */
  calendarVersion?: string;
  trigger: string; // ISO YYYY-MM-DD
  fields?: FieldInputs;
  parties?: PartyInput[];
}

export interface CreateMatterRequest {
  templateVersion: string;
  calendarVersion: string;
  trigger: string;
  fields?: FieldInputs;
  parties?: PartyInput[];
}

export interface ActionRequest {
  type: "FULFILL_EVENT" | "FULFILL" | "ADJOURN" | "RECALCULATE" | "SPAWN" | "CORRECT";
  target?: string;
  date?: string; // ISO; required for FULFILL_EVENT / ADJOURN
  supersedes?: number;
}

// --- HTTP plumbing ---

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${SERVER_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: pb.authStore.token,
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    let detail: unknown;
    try {
      detail = await res.json();
    } catch {
      detail = await res.text();
    }
    throw new DeadlineApiError(res.status, detail);
  }
  return (await res.json()) as T;
}

export class DeadlineApiError extends Error {
  constructor(public status: number, public detail: unknown) {
    super(`deadline API error ${status}`);
    this.name = "DeadlineApiError";
  }
}

function post<T>(path: string, body: unknown): Promise<T> {
  return call<T>(path, { method: "POST", body: JSON.stringify(body) });
}

function get<T>(path: string): Promise<T> {
  return call<T>(path, { method: "GET" });
}

// --- API ---

/** Validate a template IR (live authoring); returns errors + warnings. */
export function validateTemplate(ir: TemplateIR): Promise<ValidationResult> {
  return post<ValidationResult>("/api/de/templates/validate", { ir });
}

/** The result of drafting a template from natural language. */
export interface DraftResult {
  ir: TemplateIR;
  validation: ValidationResult;
  ok: boolean;
  attempts: number;
}

/**
 * Draft a template from a plain-English procedure description. An LLM proposes a
 * TemplateIR and the engine validates it (with a repair loop); `ok` indicates
 * whether the result passed validation. The engine — not the LLM — is the
 * correctness authority, so always review `validation` and preview before saving.
 */
export function draftTemplate(text: string, maxAttempts?: number): Promise<DraftResult> {
  return post<DraftResult>("/api/de/templates/draft", { text, maxAttempts });
}

/** Persist a validated template; returns its content-hash version id. */
export function createTemplate(ir: TemplateIR, templateId?: string): Promise<{ templateVersion: string }> {
  return post("/api/de/templates", { ir, templateId });
}

/** Persist a calendar; returns its content-hash version id. */
export function createCalendar(calendar: CalendarInput, calendarId?: string): Promise<{ calendarVersion: string }> {
  return post("/api/de/calendars", { calendar, calendarId });
}

/** Stateless schedule computation for instant authoring/intake preview. */
export function preview(req: PreviewRequest): Promise<Schedule> {
  return post<Schedule>("/api/de/preview", req);
}

/** Create a matter; returns its id and the initial schedule. */
export function createMatter(req: CreateMatterRequest): Promise<{ matterId: string; schedule: Schedule }> {
  return post("/api/de/matters", req);
}

/** Append an event to a matter; returns the new seq and recomputed schedule. */
export function applyAction(matterId: string, action: ActionRequest): Promise<{ seq: number; schedule: Schedule }> {
  return post(`/api/de/matters/${matterId}/actions`, action);
}

/** Get a matter's current materialized schedule. */
export function getMatter(matterId: string): Promise<Schedule> {
  return get<Schedule>(`/api/de/matters/${matterId}`);
}

/** Get a matter's full append-only event log. */
export function getEvents(matterId: string): Promise<MatterEvent[]> {
  return get<MatterEvent[]>(`/api/de/matters/${matterId}/events`);
}

/** Get the reproducible derivation of a single deadline instance. */
export function explain(matterId: string, deadlineId: string): Promise<Explanation> {
  return get<Explanation>(`/api/de/matters/${matterId}/explain/${deadlineId}`);
}

// --- v1 bridge (transition period) ---
// These compute with the v2 engine but accept v1-shaped templates and return the
// legacy output shape, so existing UI keeps working while the backend moves to
// v2 under the hood. Remove once templates are migrated to v2 IR.

export interface LegacyPreviewDeadline {
  id: string;
  name: string;
  date: string | null; // ISO YYYY-MM-DD, or null if not yet resolved
  // The bridge emits pending|fulfilled|unavailable; "overdue" is a display-time
  // state the UI derives from date-vs-today, included here so views can style it.
  status: "pending" | "fulfilled" | "unavailable" | "overdue";
}

export interface LegacyPreviewOutput {
  triggerDate: string;
  deadlines: LegacyPreviewDeadline[];
  events: { id: string; name: string; date: string | null; status: string }[];
  warnings: string[];
}

/**
 * Preview a v1-shaped template through the v2 engine. Replaces the old
 * in-browser DeadlineEngine.generate() call — computation now happens once, on
 * the backend (no second engine in the browser).
 */
export function previewLegacyTemplate(
  template: unknown,
  triggerDate: string,
  fieldValues?: Record<string, unknown>,
): Promise<LegacyPreviewOutput> {
  return post<LegacyPreviewOutput>("/api/de/v1/preview", { template, triggerDate, fieldValues });
}

/**
 * Preview a v1-shaped template with some deadline dates pinned (imported),
 * through the v2 engine. Replaces the in-browser DeadlineEngine.generateFromDates()
 * call — pinned dates are applied server-side and cascade to dependents.
 */
export function previewLegacyFromDates(
  template: unknown,
  triggerDate: string,
  deadlineDates: Record<string, string>,
  fieldValues?: Record<string, unknown>,
): Promise<LegacyPreviewOutput> {
  return post<LegacyPreviewOutput>("/api/de/v1/preview-from-dates", {
    template,
    triggerDate,
    deadlineDates,
    fieldValues,
  });
}
