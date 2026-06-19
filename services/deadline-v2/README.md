# deadline-v2 — typed client for the v2 deadline engine

Thin TypeScript client for the backend's `/api/de` endpoints. **No calculation
happens in the browser** — the Go engine on the backend is the single source of
truth. Instant preview is a stateless `POST /api/de/preview` round-trip.

## Files

- `types.gen.ts` — **generated, do not edit.** TypeScript wire types produced
  from the Go engine structs (the single source of truth).
- `client.ts` — the typed fetch wrapper (`preview`, `validateTemplate`,
  `createTemplate`, `createCalendar`, `createMatter`, `applyAction`,
  `getMatter`, `getEvents`, `explain`) plus the small hand-maintained request
  shapes (`CalendarInput`, `PartyInput`, …).
- `index.ts` — re-exports; import as `import { deadline } from "~/services/deadline-v2"`.

## Usage

```ts
import { deadline } from "~/services/deadline-v2";

const { errors } = await deadline.validateTemplate(ir);
const schedule = await deadline.preview({ ir, calendar, trigger: "2026-03-02", fields });
const { matterId } = await deadline.createMatter({ templateVersion, calendarVersion, trigger, fields });
await deadline.applyAction(matterId, { type: "FULFILL_EVENT", target: "service", date: "2026-03-10" });
const ex = await deadline.explain(matterId, "defence");
```

## Regenerating types (single source of truth = Go)

```bash
bun run gen:deadline-types     # regenerate types.gen.ts from the Go structs
bun run check:deadline-types   # regenerate + fail if it differs (CI drift gate)
```

The generator is `practocore-backend/deadlineengine/cmd/gents` (stdlib only, no
external deps). Run `check:deadline-types` in CI so a Go wire-type change that
isn't reflected here fails the build — eliminating the type-drift bug class.
