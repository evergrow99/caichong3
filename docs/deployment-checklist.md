# 上线检查清单

本文件按生产环境填写。若只是本地演示，可以临时设置 `CAICHONG_USE_MOCK=true`，但部署给真实用户时必须关闭模拟模式。

## Vercel 环境变量

上线前需要在 Vercel Project Settings 里配置：

```text
CAICHONG_USE_MOCK=false
CAICHONG_BASE_URL=https://main-api.caichong.net
CAICHONG_API_KEY=<已认领的才虫 Agent API Key>
CAICHONG_MARKET_API_KEY=<可选，专门用于读取公开市场的才虫 Agent API Key>
CAICHONG_MARKET_SYNC_INTERVAL_MINUTES=30
CAICHONG_MARKET_MAX_PAGES=10
CAICHONG_MARKET_DISPLAY_BASELINE_TASK_COUNT=<首页累计发单展示基数，可先填 0>
CAICHONG_MARKET_DISPLAY_BASELINE_AMOUNT=<首页累计发单额展示基数，可先填 0>
CAICHONG_MARKET_DISPLAY_MONTH_BASELINE_TASK_COUNT=<首页本月发单展示基数，可先填 0>
CAICHONG_MARKET_DISPLAY_MONTH_BASELINE_AMOUNT=<首页本月发单额展示基数，可先填 0>
NEXT_PUBLIC_SUPABASE_URL=<Supabase Project URL>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<Supabase anon public key>
SUPABASE_SERVICE_ROLE_KEY=<Supabase service_role key>
CRON_SECRET=<一段只有你知道的随机字符串>
ORDER_REMINDER_CRON_SECRET=<专门给外部订单提醒 Cron 使用的随机字符串>
ALLOW_DEV_LOGIN=false
AUTH_SMS_PROVIDER=<真实短信服务标识，接入后填写>
ALIYUN_SMS_SUBMISSION_TEMPLATE_CODE=<收到投稿提醒模板 Code>
ALIYUN_SMS_SELECTION_STARTED_TEMPLATE_CODE=<进入选择期提醒模板 Code>
ALIYUN_SMS_SELECTION_DEADLINE_TEMPLATE_CODE=<选择截止前 6 小时提醒模板 Code>
ORDER_REMINDER_SYNC_INTERVAL_MINUTES=5
ORDER_REMINDER_SUBMISSION_LOOKBACK_HOURS=48
```

## 定时心跳

生产环境建议每 5 分钟调用：

```text
GET /api/sync/heartbeat
```

接口会同步平台所有待处理订单，不依赖浏览器登录态。设置 `CRON_SECRET` 后，Vercel Cron 会带：

```text
Authorization: Bearer <CRON_SECRET>
```

注意：Vercel Hobby 计划的 Cron 最低频率通常只能到每天一次；如果要按现在的订单提醒和状态兜底规则每 5 分钟同步，需要使用 Vercel Pro，或改用 ECS/外部定时服务调用同一个接口。

## 才虫市场活跃统计

首页的活跃数据来自我们对才虫公开市场的持续观测。上线前先在 Supabase SQL Editor 执行：

```text
supabase/migrations/0008_market_activity.sql
```

然后每 30 分钟调用：

```text
GET /api/sync/market-activity
Authorization: Bearer <CRON_SECRET>
```

如果部署在 ECS，`ecosystem.config.cjs` 已包含 `caichong3-market-sync` 进程，会启动后同步一次，之后按 `CAICHONG_MARKET_SYNC_INTERVAL_MINUTES` 持续同步。

## 订单短信提醒

上线前先在 Supabase SQL Editor 执行：

```text
supabase/migrations/0009_order_sms_reminders.sql
```

然后配置 3 个阿里云短信模板：

```text
你的任务有新投稿，请登录查看。
你的任务已进入选择期，请在${deadline}前选择满意投稿。
你的任务选择截止时间临近，请在${deadline}前处理，超时将自动关闭并退款。
```

部署后每 5 分钟调用：

```text
GET /api/sync/order-reminders
Authorization: Bearer <ORDER_REMINDER_CRON_SECRET>
```

这个接口会先同步平台订单状态，再按投稿和选择期节点发送提醒，并用 `order_sms_reminders.reminder_key` 防止重复发送。如果部署在 ECS，`ecosystem.config.cjs` 已包含 `caichong3-order-reminders` 进程。

上线后可在 `/admin` 的“短信提醒记录”查看最近提醒的发送状态、手机号、发送时间、关联订单和失败原因。

`/api/sync/order-reminders` 兼容 `CRON_SECRET`，方便 GitHub Actions 兜底；外部 Cron 应优先使用 `ORDER_REMINDER_CRON_SECRET`，不要把通用 `CRON_SECRET` 填到第三方服务。

推荐使用 `cron-job.org` 作为主调度：

```text
Title: AICHONG order reminders
URL: https://www.aichong.top/api/sync/order-reminders
Schedule: Every 5 minutes
Request method: GET
Header: Authorization: Bearer <ORDER_REMINDER_CRON_SECRET>
Failure notification: enabled
```

GitHub Actions 的 30 分钟工作流可以保留为兜底，但不要再把它当作准实时提醒主链路。

## 上线前人工确认

- 本地 `npm run build` 通过
- 打开 `/admin` 查看“上线健康检查”
- 或访问 `/api/health/readiness` 查看 JSON 检查结果
- Supabase 表已创建
- Supabase SQL Editor 已执行 `supabase/migrations/0002_operation_logs.sql`
- Supabase SQL Editor 已执行 `supabase/migrations/0008_market_activity.sql`
- Supabase SQL Editor 已执行 `supabase/migrations/0009_order_sms_reminders.sql`
- Vercel 已配置 `ORDER_REMINDER_CRON_SECRET`
- 外部 Cron 已配置 5 分钟订单提醒心跳，并开启失败通知
- 才虫 Agent 已认领
- 至少跑通过一次真实 1 元测试单
- 确认 `.env.local` 不提交到仓库
- 真实短信登录暂未接入，对外上线前不能继续使用固定验证码
- 生产环境不要设置 `ALLOW_DEV_LOGIN=true`
- `/api/auth/send-code` 和 `/api/auth/verify-code` 接入真实短信服务后，再把 `/admin` 的“真实短信登录”检查项变绿

## 异常日志表

如果运营后台的“异常与同步日志”一直为空，先在 Supabase SQL Editor 执行：

```text
supabase/migrations/0002_operation_logs.sql
```

这张表只新增日志记录，不会删除订单数据。
