// @practocore/deadline-client — typed client for the v2 deadline engine.
//
// Usage:
//   import { deadline } from "~/services/deadline-v2";
//   const schedule = await deadline.preview({ templateVersion, calendarVersion, trigger, fields });
//
// Types are generated from the Go wire structs (types.gen.ts); the API wrapper
// (client.ts) is a thin fetch layer. No calculation happens in the browser.

export * from "./client";
export * as deadline from "./client";
