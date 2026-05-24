# Market Dynamics Rules

Last updated: 2026-05-24

This document is the source of truth for homepage and discovery market dynamics. Do not change these rules unless the user explicitly asks to change the market dynamics product rules.

## Product Goal

Market dynamics helps users understand what other people are publishing and feel that the platform is active. It is a public confidence layer, not an order management surface.

## Data Sources

Market dynamics can use both sources:

- AICHONG local published orders from `orders`.
- Caichong public market tasks from `explore_task.list`.

All eligible tasks are stored or read through `market_observed_tasks` for public display and statistics.

## Core Counting Principle

Count and display tasks that were successfully published.

The final deal result does not decide whether a task belongs in market dynamics. A task can still be shown even if it later timed out, had no submission, or was not selected, as long as it was successfully published.

## Status Eligibility

Include:

- `ACTIVE`
- `PENDING_SELECTION`
- `COMPLETED`
- `CLOSED`, only when there is evidence that the task was successfully published.

Exclude:

- `PENDING_PAYMENT`
- `CLOSED` caused by unpaid timeout, such as `TIMEOUT_NO_PAYMENT`.
- `CLOSED` with no successful-publish evidence.

Successful-publish evidence for `CLOSED` means at least one of:

- `closeReason` is `TIMEOUT_NO_SUBMISSION`.
- `closeReason` is `TIMEOUT_NO_SELECTION`.
- `paidAt` exists.
- `submission_count > 0`.

## Public Status Labels

Market dynamics intentionally uses simplified public status labels:

- `ACTIVE` and `PENDING_SELECTION` show as `进行中`.
- `COMPLETED` shows as `已完成`.
- Eligible `CLOSED` also shows as `已完成`.

Do not expose detailed close reasons in market cards or market detail drawers. Users do not need to distinguish completed by selection from ended after a successful publication lifecycle.

## Content Filters

Exclude tasks that are not suitable for public display:

- Empty or too-short descriptions, currently fewer than 10 characters.
- Obvious testing or integration content, including phrases such as `测试任务`, `测试接单`, `测试支付`, `支付流程`, `不用接单`, `真实接口`, `接口联调`, `联调使用`, `小额测试任务`.
- Internal test users and demo users.

Keep brand and sensitive-word replacement before public display. Do not expose Caichong integration wording in the user-facing market copy.

## Categories

Market dynamics uses four public task categories:

- 文案
- 图片
- 声音
- 视频

The `全部` tab is displayed as `发现` but keeps the same all-items logic.

## Statistics

Homepage statistics use the same public eligibility rules as the market list.

Show:

- 今日发单
- 本月发单
- 本月发单额
- 累计发单

Statistics may include configured display baselines, but the internally observed task count remains based on eligible observed rows.

## Change Control

Before changing any of the following, update this document first and confirm with the user:

- Which statuses are included or excluded.
- How `CLOSED` tasks are interpreted.
- Public status labels.
- Test-content filters.
- Internal test-user filters.
- Category taxonomy.
- Statistics counting rules.
