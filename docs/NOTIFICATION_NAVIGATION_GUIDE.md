# Notification Navigation

Where a notification sends the user when it is clicked, and who decides.

> Rewritten 2026-08-30. The previous version of this file (684 lines) documented
> a model the product does not use: notifications composed in the browser with
> `createMatterNotification()` / `createDeadlineNotification()` helpers from
> `types/notifications.ts`. Nothing ever called those helpers, and every route in
> the guide — `/main/matters/<id>`, `/main/matters/<id>/edit`,
> `/main/matters/<id>/documents/<docId>`, `/main/deadlines/<id>` — is a page that
> does not exist. The helpers have been deleted rather than corrected, because
> the model they served is gone.

## Notifications are written on the server

Every notification in the product is created in Go and saved to the
`Notifications` collection. There is no supported path for the app to compose
one. The writers:

| Producer | What it announces |
| --- | --- |
| `ai/tools/send_notification.go` | anything the assistant is asked to notify about |
| `internal/reminders/source.go` | deadline reminders |
| `internal/deadlinev2/v1mutate.go` | adjournments, corrections, fulfilments |
| `internal/eccmis/changes.go` | ECCMIS case changes |
| `internal/billing/expiry_check.go`, `internal/billingv2/renewals.go` | billing and renewals |
| `ai/deeptask_notify.go` | deep research completion |

## The route is resolved in one place

`utils/notificationRoute.ts` → `resolveNotificationRoute(notification)`. Both the
in-app notification list (`components/shared/Notifications/Notification.vue`) and
push taps (`services/push-notifications.ts`) go through it. It returns a relative
path, or `null` when there is nowhere sensible to go — in which case leave the
user where they are rather than guess.

Its order of preference:

1. `metadata.clickAction` — a full relative path, what the Go writers set
2. `link` — the record's own column, treated as a relative path
3. bare ids in `metadata`: `matterId` (+ optional `deadlineId`), `engagementId`,
   `conversationId`, `taskId`

Absolute and protocol-relative values are rejected before navigating, and the
active workspace (`?org=`) is carried across.

**The matter route is `/main/matters/matter/<id>`.** There is no
`/main/matters/<id>` page — see `pages/main/matters/`. A deadline is an anchor on
that page (`#deadline-<id>`), not a route of its own. Getting this wrong does not
fail loudly; it lands the user on the 404 page.

Metadata keys are the ones the Go notifiers actually write — `matterId`,
`deadlineId`, `engagementId`, `conversationId`, `taskId`. Not `matter_id`. See
`utils/notificationRoute.test.ts`, whose payloads are transcribed from the
notifiers themselves.

## `link` is text, not a URL

`Notifications.link` (and `JobNotifications.link`) hold a relative app path.
The column was typed `url`, whose validator requires a scheme and host, so a
relative path failed validation and killed the entire record save — every
notification carrying a link was silently never written. Migration
`1786200000_notifications_link_text.js` retypes it to text; its header comment is
the full account. Do not re-type it to `url`.

## Action buttons

`Notifications.actions` is a JSON array rendered as buttons under the body:

```jsonc
[
  { "label": "Pay now", "url": "https://…", "variant": "default", "external": true }
]
```

`handleAction` in `Notification.vue` opens `external` urls in a new tab and
otherwise navigates to `url` **verbatim** — it does not go through
`resolveNotificationRoute`, so an internal `url` here must already be a real
route. Today the only producer is `internal/billingv2/renewals.go`, which sets an
external checkout link.

## Adding a notification

Set `metadata.clickAction` (and `link`) to a complete, existing route in the Go
writer. Add a bare-id fallback to `resolveNotificationRoute` only when a whole
class of notifications needs one, and cover it in `notificationRoute.test.ts`.
