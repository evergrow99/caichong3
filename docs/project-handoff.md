# AICHONG Project Handoff

Last updated: 2026-05-22

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
- If a detail page is loaded with `?task=...`, show the detail loading state immediately. Do not flash the empty "请选择任务" state before the task is fetched.
- When task detail returns a newer status, merge that task back into the sidebar list immediately so the sidebar status cannot stay stale after payment or sync.

### Payment Flow

- The payment bridge page is a branded AICHONG dark-green page, written into the newly opened payment window before redirecting to the real payment URL.
- After task creation, the original page should navigate to the created task detail. Do not rely on a manual "I paid" confirmation flow.
- Pending payment detail shows:
  - waiting title with countdown while the payment link is valid
  - `支付已超时` and `重新支付` when the 30-minute payment link expires
- Payment polling should continue while the selected task is `PENDING_PAYMENT`.
- On payment success (`ACTIVE`), hide the payment panel and show the shared success dialog:
  - title: `恭喜发布成功`
  - copy: `付款完成，任务已成功进入提交期。` / `您可以坐等创作者的投稿啦。`
  - button: `知道了`
- Empty submission copy for unpaid orders: `完成付款后，任务才会正式发布`.
- Empty submission copy after publishing but before submissions: `暂未收到投稿`.

### Login Modal

- Login/register modal closes only via the close button. Do not close on backdrop click or Space key.
- Sending code changes the button text to countdown format: `60s后重新发送`.
- Code errors and login failures render inside the modal, not under the publisher composer.
- After logout and reopening the modal, keep the phone number, clear the verification code, and provide an inline phone clear button.
- Logout should clear stale task/detail/payment state so old private order errors do not leak into the public home composer.

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
- Reminder heartbeat: `GET /api/sync/order-reminders` with `ORDER_REMINDER_CRON_SECRET` or fallback `CRON_SECRET`.
- Reminder heartbeat first runs platform heartbeat, then runs local/SMS reminder logic.
- If platform heartbeat fails, reminder logic still runs against local data using local deadline fallback.
- New submission SMS requires the submission to have been synced from Caichong into local Supabase first.
- Selection-started and selection-deadline reminders can be calculated from local `deadline_at` and `submission_count` even when Caichong status did not transition.
- `order_sms_reminders.reminder_key` prevents duplicate SMS sends.
- 2026-05-22 incident: Caichong had a submission at 17:08, but local Supabase only synced it at 18:00 because repeated heartbeat attempts failed with `暂时无法连接外部服务，请稍后重试。`
- The fix is in the sync strategy:
  - `agent.events` failure must not abort the whole heartbeat.
  - The system should continue refreshing local syncable orders one by one through task detail/submission queries.
  - One order failure must not block other orders.
  - Caichong GET queries have light retries for short network hiccups.
  - Partial heartbeat failure should be recorded as `warn` in `operation_logs`.
- 2026-05-19 incident: a submission was in local Supabase at 16:30:49, but SMS sent at 19:18:30 because GitHub Actions scheduled runs had a 3h33m gap (`15:45:19` -> `19:18:19`). GitHub Actions schedule is not reliable enough for user-facing near-real-time SMS.

External Cron recommendation:

- Use `cron-job.org` or equivalent as the primary order reminder scheduler every 5 minutes.
- Configure `GET https://www.aichong.top/api/sync/order-reminders`.
- Configure header `Authorization: Bearer <ORDER_REMINDER_CRON_SECRET>`.
- Enable failure notification.
- Keep GitHub Actions as a 30-minute fallback only.
- Do not put the general `CRON_SECRET` into the external Cron service unless there is no dedicated secret configured.

GitHub Actions:

- `.github/workflows/order-reminders.yml` calls `https://www.aichong.top/api/sync/order-reminders` every 30 minutes.
- It also supports manual `workflow_dispatch`.
- GitHub repository secret `CRON_SECRET` must exactly match Vercel `CRON_SECRET`.
- The workflow has run successfully, but schedule intervals have been irregular and should be treated as fallback only.

Vercel:

- Actual production hosting is Vercel, not ECS.
- The project is on Vercel Hobby. Hobby cron is too limited for 5-minute cadence, so an external HTTP Cron should be used as the primary scheduler.
- Vercel environment variables for order reminder SMS are configured and redeployed.
- `/api/health/readiness` returned `ready: true` and `order_reminder_sms.ok: true` after redeploy.
- `/api/sync/order-reminders` returned 200 and `检查 0 条短信提醒，发送 0 条，失败 0 条`.
- Add `ORDER_REMINDER_CRON_SECRET` to Vercel before configuring external Cron.
- The local `.env.local` may still contain an old `CRON_SECRET`; do not rely on it for manual production sync unless it is updated locally.

## Admin

Current `/admin` includes:

- dedicated admin login at `/admin/login`
- admin phone access control by `ADMIN_PHONES`
- platform heartbeat trigger
- readiness checks
- metrics
- recent order SMS reminder logs
- action-needed orders
- all orders
- status rules
- operation logs

Admin login behavior:

- Visiting `/admin` without an admin session redirects to `/admin/login?reason=login`.
- Visiting `/admin` with a non-admin phone session redirects to `/admin/login?reason=forbidden`.
- `/admin/login` uses administrator phone + SMS code.
- Local development supports `ALLOW_DEV_LOGIN=true` and code `123456` through `/api/admin/login`.
- `/api/admin/send-code` checks the phone is in `ADMIN_PHONES` before sending or returning the development-code hint.
- Local `.env.local` admin phone was changed to `18201500661`.

Pending/uncommitted local work appears to include:

- user list with phone, registration time, last login time, and order count
- registered user metric
- market pages/activity UI

Treat these as already-started work. Read diffs before editing; do not overwrite them.

## Current Git State

At the 2026-05-22 handoff, latest local commit is:

```text
597cdaf Update release control handoff
```

The 2026-05-22收口范围 includes these touched areas:

```text
 M app/admin/page.tsx
 M app/api/sync/heartbeat/route.ts
 M app/api/sync/order-reminders/route.ts
 M app/globals.css
 M components/admin-login-form.tsx
 M components/app-dialog.tsx
 M components/order-console.tsx
 M docs/current-release-test-brief.md
 M docs/release-management.md
 M lib/caichong.ts
 M lib/heartbeat-sync.ts
 M lib/market-classification.ts
 M lib/task-rules.ts
?? docs/project-summary-nontechnical.md
?? public/payment-bridge-preview.html
?? public/payment-confirmation-preview.html
```

After this handoff is committed, run `git status --short --branch` before new edits and treat any remaining local changes as separate work.

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
- `app/admin/login/page.tsx`
- `components/admin-login-form.tsx`
- `app/api/admin/login/route.ts`
- `app/api/admin/send-code/route.ts`
- `supabase/migrations/`
