# AICHONG Project Handoff

Last updated: 2026-05-12

This document is the starting point for a new Codex thread. Read it together with `DESIGN.md`, `git status`, and the current diff before making changes.

## Current Product

AICHONG is a demand-side creative task publishing workspace. Users describe a creative need, attach reference files, pay, receive submissions, preview/download attachments, and choose one submission to complete the order.

The user-facing product should feel like AICHONG owns the relationship. Do not expose Caichong integration wording, API mechanics, or internal sync language in the demand-side flow.

## Visual Direction

- Product mood: calm, capable, dark green-black, restrained futuristic.
- Green is the primary action and active state.
- Keep the homepage as a usable workspace, not a landing page.
- Use cards for repeated items and modals only. Avoid nested cards and decorative clutter.
- Operational pages should be compact and status-led.
- UI copy should be plain, professional, concise, and understandable to ordinary users.
- Small text should not be heavy. Tooltips, meta text, helper text, chips, and status copy should generally use lighter weights unless they are primary labels.
- Validation and tips must use consistent patterns. Do not fix one-off messages in isolation when they belong to a shared class of UI feedback.

## Confirmed UI And Interaction Rules

### Task Publisher

- Requirement text must be at least 10 Chinese characters.
- Price must be 1-100 RMB.
- Publishing can be drafted before login; login-gated actions open the login modal.
- Publisher validation messages should use the same `composer-validation-message` style:
  - requirement too short
  - invalid price
  - too many attachments
  - attachment too large

### Attachments

- Max 5 attachments per task.
- Single attachment max size is 10MB.
- Upload tooltip copy:
  - `支持常见图片、文档、音视频等参考附件`
  - `单个附件最大 10MB, 最多 5 个`
- Price tooltip copy:
  - `平台客单价 1-100 元`
  - `通常报酬越高，越能收到更多投稿`
- Attachment size validation copy: `附件最大不能超过 10MB`
- Too-many validation copy: `最多上传 5 个附件。如需调整，请先删除已选附件。`
- Upload tooltip should hide immediately when the upload button is clicked, not after upload succeeds.
- Before publishing, selected attachments can be removed/reselected. Remove button tooltip: `发布前可删除重传`.
- After publishing, the current UI only supports preview/download. There is no fake post-publish attachment editing flow.
- Known preview support:
  - image-like attachments preview in image modal
  - text-like attachments including `.md`, `.txt`, `.csv`, `.json` preview as text
  - unsupported formats show toast: `请下载查看`
- Attachment rows should show a pointer cursor when clickable.
- Attachment download button should be vertically centered in the attachment row.

### Modals, Toasts, And Confirmation

- Use the shared `AppConfirmDialog` and `AppToast` from `components/app-dialog.tsx`.
- Do not use browser-native `window.confirm`.
- Current submission selection dialog copy:
  - title: `确认采用这个投稿吗？`
  - description: `确认后，系统将按此结果进行结算`
  - buttons: `再看看` / `确认采用`

### Sidebar And Mobile

- Sidebar collapse is a secondary function. It should look like a weak icon control, without an outer circle/background.
- Mobile top-left menu button should not show total order count.
- Mobile menu button shows a red dot only when there are unread/new submissions.
- Task list still shows per-task new submission marks.
- Clicking a task in the list should not mark submissions read by itself. Mark read only after the task detail and submissions have loaded successfully.

### Refresh And Read State

- Detail page refresh button should sync all tasks for the current user, not just the current task.
- The refresh button now calls `syncHeartbeat()`, which calls `/api/sync/heartbeat`, then reloads the task list and current detail.
- Loading a task detail successfully marks that task's known submissions as read.

## Data And Backend Rules

### Auth And Users

- Users log in by phone.
- `getCurrentUser()` maps phone to a deterministic UUID.
- `profiles` stores phone and display name.
- A pending local change adds `profiles.last_login_at`.
- `ensureUserProfile(user, { markLogin: true })` records login time when the column exists, with fallback if the migration has not run.

### Orders

- Users only see and operate their own orders.
- Admin users are controlled by `ADMIN_PHONES`.
- Orders are stored locally in Supabase and linked to Caichong `taskId`.
- Real Caichong task IDs are UUIDs. Legacy/mock tasks are excluded from real-money admin metrics.

### Task Statuses

Status labels:

- `PENDING_PAYMENT`: `待支付`
- `ACTIVE`: `提交期`
- `PENDING_SELECTION`: `选择期`
- `COMPLETED`: `已完成`
- `CLOSED`: `已关闭`

Selection is allowed during `ACTIVE` and `PENDING_SELECTION`.

### Heartbeat

- User heartbeat: `POST /api/sync/heartbeat`, current user only.
- Platform heartbeat: `GET /api/sync/heartbeat` with cron secret, all syncable orders.
- Heartbeat syncs Caichong events, order status, deadlines, close reasons, submission counts, and submissions.

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

Pending local admin change adds:

- user list with phone, registration time, last login time, and order count
- registered user metric
- migration `supabase/migrations/0005_profile_last_login.sql`

## Deployment

Repo remote: `https://github.com/evergrow99/caichong3.git`

Current deployed/pushed commit before pending admin changes:

- `b12b7c0 Polish attachment and task notification UX`

Deployment appears to be ECS + GitHub + PM2 according to `DEPLOY_ECS.md`:

```bash
cd /www/caichong3
git pull origin main
npm install
npm run build
pm2 restart caichong3
```

No SSH config is available in this workspace. Updating GitHub is possible, but updating ECS requires server access.

## Current Git State At Time Of Writing

Committed and pushed:

- attachment UX and validation polish
- shared modal/toast component
- mobile unread dot and global refresh behavior
- sidebar collapse weakening

Uncommitted local changes:

- `app/admin/page.tsx`
- `app/api/auth/dev-login/route.ts`
- `app/api/auth/verify-code/route.ts`
- `app/globals.css`
- `lib/user-profile.ts`
- `supabase/migrations/0005_profile_last_login.sql`

Untracked files unrelated to the admin user-list task, unless the user decides otherwise:

- `DEPLOY_ECS.md`
- `ecosystem.config.cjs`

Before committing or deploying, re-run:

```bash
npm run build
git status --short
```

## Useful Files To Read First

- `DESIGN.md`
- `docs/project-handoff.md`
- `components/order-console.tsx`
- `components/app-dialog.tsx`
- `app/admin/page.tsx`
- `lib/user-profile.ts`
- `lib/order-repository.ts`
- `lib/task-rules.ts`
- `lib/heartbeat-sync.ts`
- `supabase/migrations/`

