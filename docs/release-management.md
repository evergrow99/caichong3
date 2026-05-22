# Release Management

本文件用于统一上线前的功能汇总、风险整理、版本判断和发布校验。每次准备上线时，其他线程先提交进度摘要，本线程负责最终收口。

## 上线职责

- 汇总本轮变更：功能、接口、数据表、环境变量、定时任务、权限边界和用户可见影响。
- 评估上线风险：安全、资金、订单状态、短信成本、数据迁移、第三方依赖、回滚难度。
- 管理版本口径：确认当前分支、提交范围、未提交改动归属、生产环境差异。
- 执行发布校验：构建、关键接口、后台 readiness、核心用户路径、定时任务和日志。
- 给出上线结论：可上线、需补测后上线、暂缓上线，并说明原因。

## 其他线程提交摘要模板

每个线程在上线前提交以下内容：

```text
线程名称：
变更范围：
改动文件：
新增/修改的接口：
新增/修改的环境变量：
新增/修改的数据表或迁移：
用户可见变化：
已完成验证：
未验证项：
已知风险：
是否涉及真实付款/结算/短信：
是否需要上线后观察：
```

## 测试线程交付标准

测试线程负责按上线摘要执行测试、复现问题、修复可修复问题，并在测试结束后提交测试结论。测试结论必须能支持上线总控做二次评审。

给测试线程的简单指令：

```text
按上线摘要测试，能修就修，最后给测试结论。
```

测试结论按以下格式提交：

```text
测试线程名称：
对应上线摘要：
测试环境：
测试时间：

测试范围：
通过路径：
发现的问题：
已修复的问题：
仍未验证：
残留风险：
是否涉及真实付款/结算/短信：
是否改动了代码：
改动文件：
验证命令和结果：
是否建议上线：
```

字段要求：

- 测试范围：说明本次覆盖了哪些页面、接口、核心流程和边界场景。
- 通过路径：列出已经跑通的关键路径，例如登录、发单、附件上传、同步、查看投稿、选择投稿、后台检查。
- 发现的问题：写清楚复现步骤、实际结果、期望结果和影响范围。
- 已修复的问题：说明修了什么、改了哪些文件、修复后如何验证。
- 仍未验证：不能留空。没有未验证项时写“无”。
- 残留风险：不能只写“低风险”，要说明为什么低，或说明需要上线后观察什么。
- 是否改动了代码：如果测试线程修了 bug，必须列出文件并说明修复意图。
- 验证命令和结果：至少包含实际执行过的构建、lint、接口、浏览器或手工测试结果。
- 是否建议上线：只能写“建议上线 / 建议补测后上线 / 建议暂缓上线”，并给一句理由。

测试线程的“建议上线”不是最终上线结论。最终结论由上线总控在复查摘要、代码差异、风险点和最终校验后给出。

## 上线前硬门槛

- `git status --short --branch` 已确认，未提交改动都能解释来源。
- `npm run build` 通过。
- 生产环境不得启用 `ALLOW_DEV_LOGIN=true` 或 `CAICHONG_USE_MOCK=true`。
- 才虫 API Key、Supabase service role、短信 AK/SK 只能服务端使用，不进入浏览器包。
- 涉及订单、投稿、附件、下载、选择投稿的接口必须有用户归属校验。
- 涉及管理员能力的入口必须受 `ADMIN_PHONES` 保护。
- 涉及数据库结构时，迁移文件已列入上线步骤。
- 涉及短信或定时任务时，幂等、频率和失败日志已确认。
- 涉及真实付款或结算时，必须有人工确认点和测试单验证记录。

## 风险等级

P0 暂缓上线：
- 可能导致越权访问、密钥泄露、误结算、误发真实短信、订单丢失或生产不可用。

P1 补测后上线：
- 影响核心路径但有明确验证办法，例如支付后同步、选择投稿、附件预览下载、后台登录。

P2 可带观察上线：
- 局部 UI、文案、统计展示、非核心后台体验问题，不影响资金、权限和订单状态。

## 发布校验清单

基础校验：
- 构建：`npm run build`
- 静态检查：`npm run lint`
- 健康检查：`/api/health/readiness`
- 后台检查：`/admin` 的上线健康检查

核心路径：
- 手机号登录或管理员登录
- 创建任务草稿、附件上传、发布任务
- 支付链接展示
- 心跳同步订单状态
- 投稿列表读取和附件预览/下载
- 选择投稿确认流程
- 订单终态展示

运维路径：
- GitHub Actions 定时提醒心跳
- `/api/sync/heartbeat`
- `/api/sync/order-reminders`
- `/api/sync/market-activity`
- Supabase 迁移状态
- operation logs 是否记录异常

## 上线结论格式

```text
上线结论：可上线 / 需补测后上线 / 暂缓上线
本轮版本：
包含变更：
不包含变更：
必须配置：
必须执行迁移：
验证结果：
主要风险：
上线后观察指标：
回滚建议：
```

## 上线后观察指标

- `/api/health/readiness` 是否 ready。
- 生产首页、发单页、订单列表和后台是否可访问。
- 新订单是否能创建并落库。
- 心跳同步是否返回 200。
- 定时任务是否按计划运行。
- 短信提醒是否有重复发送或异常失败。
- Supabase operation logs 是否出现高频错误。
- Vercel 或服务器日志是否出现 5xx、超时、环境变量缺失。

## 上线摘要 2026-05-20 订单短信提醒与后台记录

上线结论：交上线总控复审；当前开发线程建议可带观察上线。

线程名称：

- 订单短信提醒链路与后台短信记录模块。

本轮版本：

- 分支：`main`
- 当前远端：`main...origin/main`
- 最新提交：`ac7e4e6 Add admin SMS reminder logs`
- 相关提交：
  - `619a02a Add dedicated order reminder cron secret`
  - `ac7e4e6 Add admin SMS reminder logs`

变更范围：

- 给 `/api/sync/order-reminders` 增加订单提醒专用密钥 `ORDER_REMINDER_CRON_SECRET`，外部 Cron 只需要持有这个专用密钥。
- 将 5 分钟订单短信提醒主调度迁移到 `cron-job.org`，GitHub Actions 30 分钟调度保留为兜底。
- 在 `/admin` 新增“短信提醒记录”模块，展示最近 30 条订单提醒短信。
- 后台健康检查新增订单提醒专用密钥状态；项目交接和部署文档已同步。

改动文件：

- `app/api/sync/order-reminders/route.ts`
- `app/admin/page.tsx`
- `app/globals.css`
- `lib/order-reminders.ts`
- `lib/readiness.ts`
- `.env.example`
- `docs/deployment-checklist.md`
- `docs/project-handoff.md`
- `docs/work-plan.md`

新增/修改的接口：

- `GET /api/sync/order-reminders`
  - 仍支持原 `CRON_SECRET`。
  - 新增支持 `ORDER_REMINDER_CRON_SECRET`。
  - 外部 Cron 推荐使用 `Authorization: Bearer <ORDER_REMINDER_CRON_SECRET>`。
- `/admin`
  - 新增只读短信提醒记录表格，不新增写操作。

新增/修改的环境变量：

- `ORDER_REMINDER_CRON_SECRET`
  - 已写入 `.env.example`。
  - 生产 Vercel 必须配置。
  - cron-job.org Header 必须使用同一值。

新增/修改的数据表或迁移：

- 依赖既有迁移 `supabase/migrations/0009_order_sms_reminders.sql`。
- 本轮没有新增新的 migration。
- 上线总控需确认生产 Supabase 已存在 `order_sms_reminders` 表。

用户可见变化：

- 普通用户侧无新增入口。
- 订单提醒短信发送仍按原模板执行：
  - 新投稿提醒。
  - 进入选择期提醒。
  - 选择截止前约 6 小时提醒。
- 管理员登录 `/admin` 后可以查看最近短信提醒的类型、手机号、状态、发送时间、关联订单、投稿 ID 和失败原因。

已完成验证：

- `npm run build` 通过。
- 本地管理员手机号 `18201500661` 登录 `/admin` 成功。
- 本地 `/admin` 已渲染“短信提醒记录”模块。
- 本地已读到历史记录：`2026/05/19 19:18` 的新投稿提醒，状态为“已发送”。
- cron-job.org 已配置每 5 分钟请求 `https://www.aichong.top/api/sync/order-reminders`。
- cron-job.org 历史记录显示多次 `Successful 200 OK`，执行时间约为 15:10、15:15、15:20、15:25、15:30、15:35。
- 生产 readiness 之前已确认订单短信提醒配置为正常；上线总控需在本轮部署后重新确认。

未验证项：

- 本轮未触发新的真实短信发送，避免产生额外短信成本和重复通知。
- 未新建真实订单来验证“新投稿后 5 分钟内发送”的完整线上闭环。
- 未在 Vercel 部署完成后重新人工刷新线上 `/admin` 截图确认。

已知风险：

- `cron-job.org` 是外部第三方调度服务，若账号、任务、网络或对方服务异常，5 分钟提醒会延迟；GitHub Actions 30 分钟任务只作为兜底。
- 短信提醒依赖阿里云短信模板、Supabase service role、才虫订单同步、Vercel 环境变量；任一缺失都会导致提醒跳过或失败。
- 如果 `ORDER_REMINDER_CRON_SECRET` 泄露，攻击者可触发订单提醒同步接口；接口有短信幂等，但仍可能增加接口调用和日志压力。泄露时应立即更换 Vercel 和 cron-job.org 两处密钥。
- 历史记录只展示最近 30 条，足够运营排查近期问题，但不是完整审计后台。

是否涉及真实付款/结算/短信：

- 不涉及真实付款、结算、退款。
- 涉及真实短信链路，但本轮开发验证没有主动发送新短信。
- 后续线上调度会按真实订单状态自动发送短信。

是否需要上线后观察：

- 需要。
- 观察 cron-job.org 是否继续每 5 分钟返回 200。
- 观察 `/admin` 的“短信提醒记录”是否出现重复发送、失败或长时间无记录。
- 观察 `/api/health/readiness` 是否 ready，尤其是“订单提醒专用密钥”和“订单短信提醒”两项。
- 观察 Vercel Runtime Logs 是否有 `/api/sync/order-reminders` 5xx、超时、Unauthorized 或短信模板错误。

上线总控复审建议：

- 确认 `git status --short --branch` 为 `main...origin/main` 且无未提交代码改动。
- 确认 Vercel 最新部署包含 `ac7e4e6`。
- 确认生产 Vercel 已配置 `ORDER_REMINDER_CRON_SECRET`，并且 cron-job.org Header 使用同一个值。
- 打开线上 `/admin`，检查上线健康检查和“短信提醒记录”。
- 先不制造真实新投稿测试；若需要完整闭环测试，需由主人明确同意可能产生短信费用。

## 当前上线摘要 2026-05-20

上线结论：可带观察上线。

本轮版本：

- 分支：`main`
- 当前远端：`main...origin/main`
- 最新提交：`d3dc368 Refine market classification confidence`
- 相关提交：
  - `df38c3d Launch market activity and admin login`
  - `2fe6d95 Improve market task categorization`
  - `d3dc368 Refine market classification confidence`

包含变更：

- 首页接入市场动态和发单用例，保留首页发布入口，增强用户对平台活跃度的感知。
- 新增 `/market` 预览页和 `/api/platform/market` 市场数据接口。
- 新增后台专用登录页 `/admin/login`，管理员手机号受 `ADMIN_PHONES` 控制。
- 市场任务分类从简单关键词升级为规则打分、主题识别和置信度机制。
- 用户侧筛选首项显示为 `发现`，内部逻辑仍使用 `全部`，不改变接口筛选语义。
- “项目征集令 / 项目策划类”任务当前接口返回：
  - `category: 文案`
  - `topic: 项目策划`
  - `categoryConfidence: 0.98`

不包含变更：

- 当前本地未提交改动不属于已推送版本，不能默认纳入本轮上线。
- 当前本地未提交文件：
  - `app/api/download/submission-attachment/route.ts`
  - `app/api/tasks/route.ts`
  - `app/api/uploads/task-attachment/route.ts`
  - `app/globals.css`
  - `components/order-console.tsx`
  - `lib/caichong.ts`
  - `lib/heartbeat-sync.ts`
  - `lib/task-rules.ts`
  - `package.json`
  - `package-lock.json`
  - `eslint.config.mjs`
  - `docs/release-management.md`

必须配置：

- 生产环境不能启用 `ALLOW_DEV_LOGIN=true`。
- 生产环境不能启用 `CAICHONG_USE_MOCK=true`。
- `ADMIN_PHONES` 必须包含正式管理员手机号。
- 才虫市场数据需要 `CAICHONG_MARKET_API_KEY`，或可用的平台才虫账号配置。
- Supabase service role、才虫 API Key、短信 AK/SK 必须只在服务端环境变量中配置。
- GitHub Actions 的 `CRON_SECRET` 必须与生产环境 `CRON_SECRET` 一致。

必须执行迁移：

- 市场动态依赖 `market_observed_tasks`、`market_activity_state`、`market_activity_baselines`。
- 上线前确认相关 Supabase migration 已在生产库执行。
- 确认市场统计基数已配置，尤其历史订单数、月订单数和月金额基数。

验证结果：

- `npm run build` 通过，时间：2026-05-20。
- 本地 `http://localhost:3000/` 返回 200。
- 本地 `/api/platform/market?pageSize=3` 正常返回市场任务。
- 本地接口已确认“项目征集令”归类为 `文案`，主题为 `项目策划`。
- 本地 dev server 已启动在 `http://localhost:3000`。

主要风险：

- 市场分类仍是规则引擎，不是 AI 语义分类；置信度可以降低误判但不能完全避免误判。
- 当前本地存在较多未提交改动，涉及订单接口、附件接口、同步逻辑、样式和依赖文件；上线总控接手时必须先确认这些改动归属。
- `package-lock.json` 本地改动很大，若后续纳入上线，需要单独审查依赖变化。
- 市场动态依赖才虫公开市场数据和 Supabase 表；若生产环境缺表或缺 key，首页市场模块可能为空或接口报错。

上线后观察指标：

- Vercel 最新构建是否成功。
- 生产首页是否可访问，市场动态是否正常展示。
- `/api/platform/market?pageSize=3` 是否返回 200。
- 最新“项目征集令”是否展示在 `文案` 分类下，主题是否为 `项目策划`。
- `/admin` 未登录是否跳转 `/admin/login?reason=login`。
- `/api/health/readiness` 是否 ready。
- `/api/sync/order-reminders` 和 GitHub Actions 30 分钟心跳是否继续正常。
- Supabase operation logs 是否有高频市场接口、同步或权限错误。

回滚建议：

- 若只是分类异常，优先回滚 `d3dc368`。
- 若市场分类仍不符合预期，同时回滚 `2fe6d95` 和 `d3dc368`。
- 若首页市场动态或后台登录导致生产不可用，回滚到 `df38c3d` 之前的稳定提交，并保留数据库表不删除。

## 上线总控复审 2026-05-20

上线结论：建议补齐测试结论后上线。

原因：

- 当前仓库没有找到测试线程按标准提交的正式测试结论。
- 上线总控已完成代码差异复查、构建、lint 和本地冒烟检查。
- 当前未发现阻断上线的 P0 问题，但订单详情页和心跳同步属于核心路径改动，仍需要测试线程补交覆盖说明。

本轮复审范围：

- 订单详情页展示、切换订单、空投稿状态、投稿提醒文案。
- 用户侧心跳同步逻辑。
- 创建任务最小描述长度校验。
- 附件上传 content-type 校验和 10MB 文案。
- 投稿附件下载非法 URL 兜底。
- 市场分页 pageSize 下限调整。
- lint 配置从 `next lint` 切换为 `eslint .`。

验证结果：

- `npm run build` 通过。
- `npm run lint` 通过，存在 12 个 warning，无 error。
- 本地浏览器打开 `/`、`/market`、`/admin/login` 成功。
- 本地从首页历史任务进入订单详情成功。
- 非法附件下载 URL 返回 400。
- `/api/health/readiness` 本地返回 200。

残留风险：

- 缺少测试线程正式结论，不能确认其是否覆盖全部待测路径。
- `components/order-console.tsx` 有多处 hooks 依赖 warning，当前不是新错误阻断，但后续重构时应清理。
- 订单详情页 UI 改动较大，仍建议测试线程补测不同订单状态和投稿场景。
- 心跳同步不再对 `PLATFORM_AGENT` 走事件 ack 流程，需要测试线程确认真实用户订单刷新、投稿同步不回退。

下一步：

- 测试线程补交测试结论。
- 若测试结论为“建议上线”且无新增 P0/P1 问题，上线总控可进入最终发布步骤。

## 最终上线总控结论 2026-05-20

上线结论：可上线。

前提：

- 必须把当前工作区里的本轮修复一并纳入发布版本。
- 不建议发布只包含旧提交、但不包含本轮本地修复的版本。
- 生产环境必须确认 `ALLOW_DEV_LOGIN` 不是 `true`。
- 本轮不执行真实采用投稿、结算、退款或短信发送。

测试线程结论：

- 测试线程建议上线。
- 测试环境为本地开发环境，连接真实才虫数据。
- 未触发真实结算、退款、短信。
- `npm run build` 通过。
- `npm run lint` 通过，0 errors，12 warnings。

测试覆盖：

- 订单列表、订单详情、真实订单投稿同步、红点提示。
- 前台 10 分钟自动刷新和后台 30 分钟心跳差异。
- 市场页分类和分页。
- 附件上传、空文件/超大文件拦截、附件下载代理。
- 创建任务校验。
- 管理后台保护、readiness、定时心跳鉴权。

测试发现并修复：

- 市场接口 `pageSize=3` 时仍返回 6 条，已修复于 `lib/market-activity.ts`。
- 投稿接口返回多余原始 agent 数据，已收紧于 `lib/caichong.ts`。
- 进行中/待选择订单首次看到投稿不亮红点，已修复于 `components/order-console.tsx`。

残留风险：

- 部分历史市场数据 topic 仍有 `$undefined`，属于旧数据清洗问题，不阻断本轮上线。
- 当前工作区仍有未提交改动，上线前需要提交并确认发布版本包含这些改动。
- 线上 GitHub Actions 最近一次 30 分钟心跳记录尚未在 GitHub 页面人工确认，上线后需要观察。

## 当前上线摘要 2026-05-20 晚间

上线结论：可上线，建议上线后观察。

本轮版本：

- 分支：`main`
- 当前状态：`main...origin/main`
- 最新提交：`ac7e4e6 Add admin SMS reminder logs`
- 关键相关提交：
  - `619a02a Add dedicated order reminder cron secret`
  - `3171435 Filter test tasks from market feed`
  - `ac7e4e6 Add admin SMS reminder logs`

包含变更：

- 发现页 / 市场动态过滤测试数据：
  - 过滤内部测试手机号订单，包括 `13900000000`。
  - 过滤描述少于 10 个字的任务，例如 `太短`。
  - 过滤明显测试或联调任务，例如 `测试任务`、`测试接单`、`真实接口`、`接口联调`。
  - 已存在 `market_observed_tasks` 表内的旧测试数据不删除，但发现列表和统计读取时会过滤。
  - 后续同步时也不会再把这类本地测试单写进发现数据。
- 订单提醒心跳支持独立密钥：
  - `/api/sync/order-reminders` 可使用独立的订单提醒 cron secret。
  - 保留与原 `CRON_SECRET` 的关系，具体以代码和部署文档为准。
- 管理后台增加短信提醒记录展示：
  - `/admin` 可查看订单短信提醒日志。
  - 包含提醒类型、手机号、发送状态、尝试次数、错误信息、关联订单信息等运营排查字段。
- 文档更新：
  - `docs/deployment-checklist.md`
  - `docs/project-handoff.md`
  - `docs/work-plan.md`

不包含变更：

- 不包含真实付款、采用投稿、结算或退款操作。
- 不包含数据库表结构新增迁移。
- 不包含首页布局、发布框或市场卡片的大范围 UI 调整。
- 当前工作区干净，没有未提交代码需要纳入本轮上线。

必须配置：

- 生产环境不能启用 `ALLOW_DEV_LOGIN=true`。
- 生产环境不能启用 `CAICHONG_USE_MOCK=true`。
- 订单提醒心跳密钥需要与 GitHub Actions 或外部调度器配置一致。
- `CRON_SECRET` 及订单提醒专用 secret 的生产配置需按 `docs/deployment-checklist.md` 核对。
- `ADMIN_PHONES` 必须包含正式管理员手机号。
- Supabase service role、才虫 API Key、短信 AK/SK 只能在服务端环境变量中配置。

必须执行迁移：

- 本轮没有新增 migration。
- 仍需确认生产库已有：
  - `market_observed_tasks`
  - `market_activity_state`
  - `market_activity_baselines`
  - `order_sms_reminders`

验证结果：

- `npm run build` 通过，时间：2026-05-20。
- 本地市场接口已验证：
  - `太短` 不再返回。
  - 老的 `测试任务` 不再返回。
  - 发现总数由 11 降到 9。
- `git status --short --branch` 结果为 `main...origin/main`，工作区干净。

主要风险：

- 市场过滤是读取和同步双层过滤，不会物理删除旧表数据；如果后台直接查表，仍可能看到旧测试行。
- 发现统计会因过滤测试/短描述任务而下降，这是预期变化。
- 订单提醒日志属于后台运营视图，需上线后确认真实生产数据量下页面加载正常。
- 订单提醒独立 cron secret 涉及调度配置，若生产变量或 GitHub Actions secret 不一致，提醒心跳可能返回鉴权失败。

上线后观察指标：

- Vercel 最新构建是否成功。
- 生产首页发现模块是否不再展示 `太短` 和测试任务。
- `/api/platform/market?pageSize=20` 是否不返回测试短单。
- `/admin` 短信提醒记录是否可正常打开。
- `/api/sync/order-reminders` 是否继续返回 200。
- GitHub Actions 30 分钟订单提醒心跳是否继续成功。
- `/api/health/readiness` 是否 ready。
- Supabase operation logs 是否有市场接口、短信提醒日志、cron 鉴权相关错误。

回滚建议：

- 若仅发现页过滤异常，优先回滚 `3171435`。
- 若订单提醒 cron 鉴权异常，优先检查生产环境变量和 GitHub Actions secret；必要时回滚 `619a02a`。
- 若后台短信提醒日志导致 `/admin` 异常，优先回滚 `ac7e4e6`。

上线后观察：

- Vercel 构建是否成功。
- `/api/health/readiness` 是否 ready。
- 首页、市场页、订单详情是否正常。
- 真实订单投稿和附件是否仍能读取。

## 当前上线摘要 2026-05-22 后台结构、支付确认体验与同步韧性

上线结论：建议补测后上线。

本轮版本：

- 分支：`main`
- 本轮对应 2026-05-22 收口提交范围，测试时以最新 `main` 为准。
- 本轮不包含数据库迁移和新增环境变量。

包含变更：

- 运营后台改为固定顶部栏、左侧菜单和右侧独立滚动内容区，菜单可快速跳转概览、上线检查、用户、短信记录、订单、日志等模块。
- 管理员登录页精简为“运营后台”，移除重复说明和开发验证码提示；后台/登录页返回工作台改为新页打开。
- 短信提醒记录状态标签收紧，后台时间继续按中国时间展示。
- 前台支付体验调整：
  - 发布后打开付款桥接页，提示用户正在前往付款页面。
  - 待支付订单不再从列表隐藏，订单详情展示付款倒计时和重新支付入口。
  - 付款完成后自动轮询订单状态，进入提交期时弹出“恭喜发布成功”提示。
  - 新增付款状态预览 HTML，便于视觉检查。
- 前台登录体验调整：
  - 手机号输入支持清空。
  - 验证码错误使用弹窗内提示，不污染全局错误。
  - 登录弹窗和附件预览弹窗增加滚动锁定，降低移动端穿透滚动。
- 订单同步韧性增强：
  - 才虫查询增加短重试。
  - 用户/平台心跳允许事件同步或单个订单刷新局部失败，继续刷新其余订单并记录 warn 日志。
  - 订单短信提醒心跳在平台心跳局部失败时继续执行本地提醒兜底。
- 市场分类补充标题/金句/图文和短视频识别规则。
- 轻量中文项目总览文档：`docs/project-summary-nontechnical.md`。

不包含变更：

- 不改才虫发布、付款、采用投稿、结算接口协议。
- 不新增 Supabase 表、字段或 migration。
- 不新增短信模板、环境变量或 Cron 配置。
- 不主动触发真实短信、付款、采用投稿、结算、退款。

必须配置：

- 继续沿用现有生产环境变量：才虫 API Key、Supabase service role、短信 AK/SK、`ADMIN_PHONES`、`CRON_SECRET`、`ORDER_REMINDER_CRON_SECRET`。
- 生产环境仍不得启用 `ALLOW_DEV_LOGIN=true` 或 `CAICHONG_USE_MOCK=true`。

必须执行迁移：

- 本轮没有新增 migration。

验证结果：

- `npx tsc --noEmit` 已通过。
- `npm run build` 已通过。
- 本地 `/admin` 已手工查看后台固定顶部、左侧菜单、右侧独立滚动和短信状态标签。
- 本地 `/admin/login` 已手工查看登录页精简后的视觉。

主要风险：

- 支付确认体验属于核心路径，虽然没有改服务端付款接口，但改了前端打开付款页、待支付展示、轮询刷新和成功提示，需重点补测。
- 心跳接口现在可能返回 `ok: false` 但 HTTP 仍为 200，用于表达“局部失败但已继续处理”；调用方如只看 HTTP 状态，需要同步理解新语义。
- 后台改为内部滚动布局，需补测桌面和窄屏，确认表格横向滚动、锚点跳转和固定菜单不会遮挡内容。
- 才虫查询重试会略微拉长失败请求耗时，但能降低短暂网络抖动导致整次同步失败的概率。

上线后观察指标：

- `/api/health/readiness` 是否 ready。
- `/api/sync/heartbeat` 和 `/api/sync/order-reminders` 是否出现高频 `ok: false` 或 warn 日志。
- 支付后订单是否能自动从“待支付”变为“提交期”。
- 待支付订单重新支付入口是否能正常打开新的付款页。
- `/admin` 在真实数据量下是否可快速打开，短信提醒记录、全部订单和日志表格是否可读。
- operation logs 是否出现心跳、短信提醒、付款状态刷新相关高频错误。

回滚建议：

- 若仅后台布局异常，优先回滚 `app/admin/page.tsx`、`components/admin-login-form.tsx` 和后台相关 CSS。
- 若支付确认体验异常，优先回滚 `components/order-console.tsx` 中付款轮询、倒计时和桥接页相关改动。
- 若同步日志出现异常放大，优先回滚 `lib/heartbeat-sync.ts`、`app/api/sync/heartbeat/route.ts`、`app/api/sync/order-reminders/route.ts` 和 `lib/caichong.ts` 的韧性改动。

## 上线总控复审 2026-05-20 订单短信提醒、后台记录与发现页过滤

上线结论：可上线，带观察。

判断依据：

- 测试线程建议“补测后上线”，未发现业务代码阻断问题。
- 上线总控复核线上 `/api/health/readiness` 返回 `ready: true`。
- readiness 中“订单提醒专用密钥”“订单短信提醒”“开发验证码登录”均为正常状态。
- 线上 `/api/platform/market?pageSize=3` 返回 `pageSize: 3`，且返回 3 条。
- 线上发现数据总数为 9，未返回 `太短`、`测试任务`、`测试接单`、`真实接口` 等测试/联调任务。
- 线上 `/api/sync/order-reminders` 无 Authorization 返回 `401`。

未阻断项：

- 当前 Vercel 连接器没有 `sunny-ts-projects` team scope 权限，无法直接读取部署提交号；但线上接口行为已证明关键代码能力生效。
- 当前没有 cron-job.org 后台权限，无法直接查看最近执行历史；该项转为上线后人工观察。

本轮不涉及：

- 真实付款、采用投稿、结算、退款。
- 主动触发真实短信发送。
- 新增数据库迁移。

上线后观察：

- cron-job.org 最近执行历史是否持续 `Successful 200 OK`。
- `/admin` 的短信提醒记录是否持续正常展示。
- `/api/sync/order-reminders` 是否有 5xx、超时、Unauthorized 异常。
- Supabase operation logs 是否出现短信模板、同步或权限相关高频错误。
- GitHub Actions 30 分钟心跳是否继续运行。
- operation logs 是否出现高频同步、附件、市场接口错误。

## 上线摘要 2026-05-22 支付链路、登录体验与同步兜底

上线结论：建议补测后上线。

本轮状态：

- 分支：`main`
- 当前最新提交：`597cdaf Update release control handoff`
- 当前工作区仍有未提交改动，本轮摘要用于交接和上线前核对。
- 本轮未推送线上，生产环境需在确认后重新部署。

本轮包含变更：

- 支付链路体验：
  - 付款跳转页改为 AICHONG 自有品牌样式，不再显示简陋白页。
  - 创建任务后原页面进入任务详情，不再依赖用户手动确认付款。
  - 待支付详情页显示倒计时和“重新支付”，支付成功后自动更新状态并弹出成功提示。
  - 支付成功后左侧任务列表会合并详情最新状态，避免侧栏仍显示“待支付”。
- 登录/退出体验：
  - 登录注册弹窗只允许点击关闭按钮关闭，避免误点遮罩或空格导致关闭。
  - 发送验证码后按钮内显示倒计时，不再用底部横条提示。
  - 验证码错误和登录失败显示在登录弹窗内。
  - 退出登录后再次打开弹窗保留手机号，但清空验证码，并提供手机号清空按钮。
  - 退出登录后清理旧详情、旧错误和待支付恢复状态，避免无权限订单残留。
- 详情页与侧栏：
  - 详情页浏览器刷新时不再先闪“请选择任务”，直接进入详情加载态。
  - 空投稿文案改为 `暂未收到投稿`。
  - ACTIVE 且 0 投稿时移除重复的“任务已发布，等待投稿”提示条。
  - 收起态侧栏图标增加右侧平台样式 tooltip。
- 同步和短信提醒兜底：
  - 才虫事件接口失败时，不再中断整次心跳；系统继续按本地进行中订单逐个刷新详情和投稿。
  - 单个订单同步失败不再阻塞其他订单。
  - 才虫查询类 GET 接口增加轻量重试，降低短暂网络抖动影响。
  - 心跳部分失败会写入 `operation_logs` 的 warn 记录，方便后台排查。

本轮不包含变更：

- 不包含生产数据库迁移。
- 不包含真实付款、采用投稿、结算或退款操作。
- 不主动触发真实短信发送；本轮只读查询过真实订单、投稿和短信记录用于排查。
- 暂未把“最近一次同步成功时间、失败次数、才虫投稿时间、同步入库时间”做成完整后台展示模块；本轮先修了同步兜底和 warn 日志。

验证结果：

- `npm run build` 通过，时间：2026-05-22。
- `npm run lint` 无错误，仅保留既有 warning：
  - `<img>` 建议替换为 Next `<Image />`
  - 既有 React Hook dependency warning

上线前建议补测：

- 发布任务后支付跳转页样式。
- 未支付任务详情页倒计时、重新支付、支付成功弹窗。
- 支付成功后左侧列表状态是否从“待支付”及时变为“提交期”。
- 登录弹窗：遮罩/空格不能关闭，验证码倒计时、错误提示、退出后保留手机号。
- 详情页带 `?task=` 刷新时是否直接显示加载态，不闪空态。
- 收起态侧栏 tooltip 位置是否在图标右侧，且不被裁切。
- `/api/sync/order-reminders` 在线上真实 cron 下是否返回 200，并观察 operation logs 是否出现 warn/error。

主要风险：

- 支付链路涉及真实付款体验，上线后需要用低金额订单做完整端到端确认。
- 同步兜底降低了事件接口失败造成的延迟，但如果才虫所有查询接口都不可用，仍无法即时同步投稿。
- 短信提醒依赖外部 cron、才虫接口、Supabase 和阿里云短信；任一环节异常都会影响提醒时效。
- 外部 cron-job.org 后台执行历史无法从本地直接验证，上线后需要人工查看最近执行是否持续 `Successful 200 OK`。

上线后观察：

- `/api/health/readiness` 是否 ready。
- `/api/sync/order-reminders` 是否持续 200。
- `/admin` 短信提醒记录是否正常。
- Supabase `operation_logs` 是否出现高频 `heartbeat.platform`、`order.sms_reminder.heartbeat` warn/error。
- 新投稿短信是否能在 5 分钟主调度窗口内发出。
- 用户登录、退出、重新登录是否没有旧订单错误残留。

回滚建议：

- 若支付体验异常，优先回滚 `components/order-console.tsx` 与支付相关 CSS 改动。
- 若登录弹窗异常，优先回滚 `components/order-console.tsx` 登录状态相关改动和 `app/globals.css` 登录样式。
- 若同步接口异常，优先检查 `lib/heartbeat-sync.ts`、`lib/caichong.ts`、`app/api/sync/heartbeat/route.ts`、`app/api/sync/order-reminders/route.ts`。
- 若仅侧栏 tooltip 显示异常，可单独回滚 `data-sidebar-tooltip` 和收起态 tooltip CSS。
