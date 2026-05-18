# AICHONG Project Handoff

Last updated: 2026-05-18

This document is the first thing to read in a new Codex thread. Also read `DESIGN.md`, then run `git status --short --branch` before editing.

## Product

AICHONG is a demand-side creative task publishing workspace. Users describe a creative need, attach reference files, pay, receive submissions, preview/download attachments, and choose one submission to complete the order.

The user-facing product should feel like AICHONG owns the relationship. Do not expose Caichong integration wording, API mechanics, or internal sync language in the demand-side flow.

## Visual And UX Rules

- Product mood: calm, capable, dark green-black, restrained futuristic.
- Green is the primary action and active state.
- Keep the homepage as a usable workspace, not a landing page.
- Use cards for repeated items and modals only. Avoid nested cards and decorative clutter.
- Operational pages should be compact and status-led.
- UI copy should be plain, professional, concise, and understandable to ordinary users.
- Small text should not be heavy. Tooltips, meta text, helper text, chips, and status copy should generally use lighter weights unless they are primary labels.
- Validation and tips must use consistent patterns. Do not fix one-off messages in isolation when they belong to a shared class of UI feedback.
- Avoid native browser `title` tooltips unless explicitly needed; use platform-styled tooltips selectively.

## Confirmed UI Rules

### Publisher

- Requirement text must be at least 10 Chinese characters.
- Price must be 1-100 RMB.
- Publishing can be drafted before login; login-gated actions open the login modal.
- Publisher validation messages should use the same `composer-validation-message` style.
- Price tooltip copy:
  - `平台客单价 1-100 元`
  - `通常报酬越高，越能收到更多投稿`

### Attachments

- Max 5 attachments per task.
- Single attachment max size is 10MB.
- Upload tooltip copy:
  - `支持常见图片、文档、音视频等参考附件`
  - `单个附件最大 10MB, 最多 5 个`
- Attachment size validation copy: `附件最大不能超过 10MB`
- Too-many validation copy: `最多上传 5 个附件。如需调整，请先删除已选附件。`
- Upload tooltip should hide immediately when the upload button is clicked.
- Before publishing, selected attachments can be removed/reselected. Remove button tooltip: `发布前可删除重传`.
- After publishing, the current UI only supports preview/download. There is no fake post-publish attachment editing flow.
- Preview support:
  - images preview in image modal
  - text-like files including `.md`, `.txt`, `.csv`, `.json` preview as text
  - unsupported formats show toast: `请下载查看`
- Attachment rows should show a pointer cursor when clickable.
- Attachment download button should be vertically centered in the attachment row.

### Modals And Toasts

- Use shared `AppConfirmDialog` and `AppToast` from `components/app-dialog.tsx`.
- Do not use browser-native `window.confirm`.
- Submission selection dialog copy:
  - title: `确认采用这个投稿吗？`
  - description: `确认后，系统将按此结果进行结算`
  - buttons: `再看看` / `确认采用`

### Sidebar And Mobile

- Sidebar collapse is secondary. It should look like a weak icon control, without an outer circle/background.
- Mobile top-left menu button should not show total order count.
- Mobile menu button shows a red dot only when there are unread/new submissions.
- Task list still shows per-task new submission marks.
- Clicking a task in the list should not mark submissions read by itself. Mark read only after the task detail and submissions have loaded successfully.

### Refresh And Read State

- Detail page refresh button should sync all tasks for the current user, not just the current task.
- The refresh button calls `POST /api/sync/heartbeat`, then reloads task list and current detail.
- Loading a task detail successfully marks that task's known submissions as read.
- Terminal tasks (`COMPLETED`, `CLOSED`) should not show the refresh button because further Caichong sync is not useful and can be slow.

## Data And Backend Rules

### Auth And Users

- Users log in by phone.
- `getCurrentUser()` maps phone to a deterministic UUID.
- `profiles` stores phone and display name.
- Admin users are controlled by `ADMIN_PHONES`.

### Orders

- Users only see and operate their own orders.
- Orders are stored locally in Supabase and linked to Caichong `taskId`.
- Real Caichong task IDs are UUIDs. Legacy/mock tasks are excluded from real-money admin metrics.

### Task Statuses

- `PENDING_PAYMENT`: `待支付`
- `ACTIVE`: `提交期`
- `PENDING_SELECTION`: `选择期`
- `COMPLETED`: `已完成`
- `CLOSED`: `已关闭`

Selection is allowed during `ACTIVE` and `PENDING_SELECTION`.

### Local Deadline Fallback

Committed and pushed in `f8ada14 Fix overdue task status fallback`.

- If a task is `ACTIVE` and `deadlineAt` has passed:
  - with submissions: derive `PENDING_SELECTION` until `deadlineAt + 24h`
  - with no submissions: derive `CLOSED` with `TIMEOUT_NO_SUBMISSION`
- If `ACTIVE` had submissions and `deadlineAt + 24h` has passed, derive `CLOSED` with `TIMEOUT_NO_SELECTION`.
- If `PENDING_SELECTION` deadline has passed, derive `CLOSED` with `TIMEOUT_NO_SELECTION`.
- This fallback is applied when mapping order rows and when writing refreshed Caichong task data.
- It does not create second-level timers by itself; it runs when the API, admin, user refresh, or scheduled workflow reads/syncs orders.

## Heartbeat And SMS Reminder Chain

Committed and pushed:

- `1493d34 Add order reminder heartbeat`
- `5a4d94f Use local task timing for reminder fallback`
- `d3d51d8 Run order reminder sync every 30 minutes`

Current chain:

- User heartbeat: `POST /api/sync/heartbeat`, current user only.
- Platform heartbeat: `GET /api/sync/heartbeat` with `CRON_SECRET`, all syncable orders.
- Reminder heartbeat: `GET /api/sync/order-reminders` with `CRON_SECRET`.
- Reminder heartbeat first runs platform heartbeat, then runs local/SMS reminder logic.
- If platform heartbeat fails, reminder logic still runs against local data using local deadline fallback.
- New submission SMS requires the submission to have been synced from Caichong into local Supabase first.
- Selection-started and selection-deadline reminders can be calculated from local `deadline_at` and `submission_count` even when Caichong status did not transition.
- `order_sms_reminders.reminder_key` prevents duplicate SMS sends.

GitHub Actions:

- `.github/workflows/order-reminders.yml` calls `https://www.aichong.top/api/sync/order-reminders` every 30 minutes.
- It also supports manual `workflow_dispatch`.
- GitHub repository secret `CRON_SECRET` must exactly match Vercel `CRON_SECRET`.
- User reported the workflow has a green check after adding the secret.

Vercel:

- Actual production hosting is Vercel, not ECS.
- The project is on Vercel Hobby. Hobby cron is too limited for 30-minute cadence, so GitHub Actions is used as the external scheduler.
- Vercel environment variables for order reminder SMS are configured and redeployed.
- `/api/health/readiness` returned `ready: true` and `order_reminder_sms.ok: true` after redeploy.
- `/api/sync/order-reminders` returned 200 and `检查 0 条短信提醒，发送 0 条，失败 0 条`.
- The local `.env.local` may still contain an old `CRON_SECRET`; do not rely on it for manual production sync unless it is updated locally.

## Admin

Current `/admin` includes:

- access control by `ADMIN_PHONES`
- platform heartbeat trigger
- readiness checks
- metrics
- action-needed orders
- all orders
- status rules
- operation logs

Pending/uncommitted local work appears to include:

- user list with phone, registration time, last login time, and order count
- registered user metric
- admin login route/components
- market pages/activity UI

Treat these as already-started work. Read diffs before editing; do not overwrite them.

## Current Git State

At handoff, `main` is aligned with `origin/main` at:

```text
d3d51d8 Run order reminder sync every 30 minutes
```

Uncommitted local changes at handoff:

```text
 M app/admin/page.tsx
 M app/globals.css
 M app/page.tsx
 M components/order-console.tsx
 M components/static-market-nav.tsx
 M lib/admin.ts
 M lib/market-activity.ts
?? app/admin/login/
?? app/api/admin/
?? app/api/platform/market/
?? app/market/
?? components/admin-login-form.tsx
?? components/market-dynamics-client.tsx
?? public/icons/case-design.svg
?? public/icons/case-other.svg
```

These are not part of the heartbeat/SMS fixes. Do not revert them unless the user explicitly asks.

## Deployment Notes

- GitHub push works after user updated token permissions.
- Vercel redeploy was done after SMS env vars were configured.
- If changing env vars in Vercel, redeploy production before testing.
- If testing cron manually, run GitHub Actions workflow `Order reminder heartbeat` or call the endpoint with the current `CRON_SECRET`.

## Useful Files To Read First

- `DESIGN.md`
- `docs/project-handoff.md`
- `components/order-console.tsx`
- `components/app-dialog.tsx`
- `app/admin/page.tsx`
- `lib/order-repository.ts`
- `lib/task-rules.ts`
- `lib/heartbeat-sync.ts`
- `lib/order-reminders.ts`
- `.github/workflows/order-reminders.yml`
- `supabase/migrations/`
