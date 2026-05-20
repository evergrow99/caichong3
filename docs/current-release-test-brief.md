# Current Release Test Brief

给测试线程的简单指令：

```text
请读取 docs/current-release-test-brief.md，按上线摘要测试，能修就修，最后按 docs/release-management.md 的测试线程交付标准给测试结论。
```

## 上线摘要名称

2026-05-20 订单短信提醒与后台记录待测版本

## 本轮上线总控摘要

对应 `docs/release-management.md` 的 `上线摘要 2026-05-20 订单短信提醒与后台记录`。

本轮重点验证：

- 生产部署是否包含 `ac7e4e6 Add admin SMS reminder logs`。
- 发现页 / 市场动态是否包含 `3171435 Filter test tasks from market feed` 的过滤效果。
- `/admin` 是否能看到“短信提醒记录”模块。
- 短信提醒记录是否能展示最近记录，至少包含提醒类型、手机号、状态、发送时间、关联订单和失败原因。
- `/api/health/readiness` 是否 ready，尤其是“订单提醒专用密钥”和“订单短信提醒”。
- cron-job.org 是否继续每 5 分钟返回 `200 OK`。
- 不主动触发真实短信，除非主人明确同意。

## 本轮版本状态

- 分支：`main`
- 远端状态：`main...origin/main`
- 最新提交：
  - `ac7e4e6 Add admin SMS reminder logs`
  - `3171435 Filter test tasks from market feed`
  - `619a02a Add dedicated order reminder cron secret`

## 本轮涉及文件

- `app/api/sync/order-reminders/route.ts`
- `app/api/platform/market/route.ts`
- `app/admin/page.tsx`
- `app/globals.css`
- `lib/market-activity.ts`
- `lib/order-reminders.ts`
- `lib/readiness.ts`
- `.env.example`
- `docs/deployment-checklist.md`
- `docs/project-handoff.md`
- `docs/work-plan.md`

## 本轮主要变更

1. 订单提醒专用密钥
- `/api/sync/order-reminders` 支持 `ORDER_REMINDER_CRON_SECRET`。
- 外部 Cron 使用专用密钥，降低通用 `CRON_SECRET` 暴露面。

2. 外部 5 分钟 Cron
- cron-job.org 作为订单短信提醒主调度。
- GitHub Actions 30 分钟调度保留为兜底。

3. 发现页测试数据过滤
- 发现页 / 市场动态过滤内部测试手机号、短描述任务和明显测试联调任务。
- 旧表数据不物理删除，读取和后续同步时过滤。

4. 后台短信提醒记录
- `/admin` 新增“短信提醒记录”。
- 最近 30 条记录展示提醒类型、用户手机号、发送状态、发送时间、关联订单、投稿 ID、失败原因。

## 本轮重点测试路径

- Vercel 最新部署是否成功。
- 线上 `/api/health/readiness` 是否 ready。
- 管理员进入线上 `/admin` 后，“上线健康检查”是否正常。
- 管理员进入线上 `/admin` 后，“短信提醒记录”是否出现，并且数据列可读。
- 线上 `/api/platform/market?pageSize=20` 不应返回 `太短`、`测试任务`、`测试接单`、`真实接口` 等测试/联调任务。
- cron-job.org 最近执行历史是否继续为 `Successful 200 OK`。
- 不带或带错 `Authorization` 调用 `/api/sync/order-reminders` 应返回未授权。

## 本轮高风险点

- 真实短信链路会产生短信费用，测试不要随意制造真实提醒。
- 外部 Cron 依赖 cron-job.org 账号和任务配置，需要上线后持续观察。
- 如果 `ORDER_REMINDER_CRON_SECRET` 泄露，应同时更换 Vercel 和 cron-job.org 两处密钥。

## 本轮必须执行的验证命令

- `npm run build`

## 本轮测试结论格式

```text
测试线程名称：
对应上线摘要：2026-05-20 订单短信提醒与后台记录
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
是否建议上线：建议上线 / 建议补测后上线 / 建议暂缓上线
```

---

## 历史上线摘要名称

2026-05-20 上线前待测版本

## 测试目标

验证当前本地待上线改动是否稳定可用，重点检查订单详情页、附件上传/下载、任务创建校验、心跳同步、投稿读取、市场分类、构建与 lint。

## 当前版本状态

- 分支：`main`
- 远端状态：`main...origin/main`
- 最近提交：
  - `d3dc368 Refine market classification confidence`
  - `2fe6d95 Improve market task categorization`
  - `df38c3d Launch market activity and admin login`
- 当前存在未提交改动，需要一并测试；测试结论里要明确说明是否覆盖了这些本地改动。

## 本轮涉及文件

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

## 主要变更

1. 订单详情页体验调整
- 需求描述改为更可读的排版。
- 长需求支持展开/收起。
- 报酬、状态、截止时间、投稿提醒的位置和文案调整。
- 空投稿状态样式和文案调整。
- 切换订单时清空旧详情，避免短暂显示上一单内容。
- 初始路由解析前显示加载状态。
- 自动刷新间隔调整为 10 分钟。
- 自动刷新失败时显示可重试状态。

2. 心跳同步调整
- 用户侧 heartbeat 不再对 `PLATFORM_AGENT` 走事件 ack 流程。
- 改为刷新当前用户可同步订单。
- 只同步可同步状态订单，避免终态订单反复刷新。

3. 任务创建与附件接口校验
- 创建任务要求需求描述至少 10 个字。
- 附件上传增加 `multipart/form-data` 校验。
- 附件大小错误文案统一为“附件最大不能超过 10MB”。
- 投稿附件下载增加 URL 格式异常处理，避免非法 URL 直接抛错。

4. 才虫任务数据规范化
- `normalizeTask` 明确保留 `description`、`createdAt`、`paymentUrl`、`attachments`、`closeReason` 等字段。
- 需要确认订单详情、附件、付款链接、关闭原因展示不回退。

5. 市场分类与首页市场动态
- 已推送版本包含市场动态、`/market` 页面、`/api/platform/market` 接口。
- 市场任务分类已升级为规则打分和置信度机制。
- 顺带验证首页市场动态、分类显示、任务详情预览是否正常。

6. 工程配置
- lint 命令从 `next lint` 改为 `eslint .`。
- 新增 `eslint.config.mjs`。
- Next 版本锁为 `^16.2.6`。
- `package-lock.json` 有大量变化，需要确认 `npm install`、`npm run build`、`npm run lint` 可用。

## 重点测试路径

- 普通用户登录。
- 创建任务：少于 10 字、等于/超过 10 字、价格 1-100、非法价格。
- 附件上传：正常文件、超过 10MB、非 multipart 请求或空文件。
- 发布任务后查看订单详情。
- 订单列表切换多个订单，确认不会显示旧订单详情或旧投稿。
- 有投稿订单：投稿列表、投稿数量、采用投稿确认。
- 无投稿订单：空状态文案和样式。
- `ACTIVE`、`PENDING_SELECTION`、`COMPLETED`、`CLOSED` 状态展示。
- `PENDING_SELECTION` 截止时间提醒。
- `CLOSED` 的 `TIMEOUT_NO_SUBMISSION` / `TIMEOUT_NO_SELECTION` 文案。
- 手动刷新订单。
- 自动刷新失败场景如能模拟则验证提示。
- 附件预览/下载，尤其是非法 `url` 参数应返回 400。
- 首页市场动态、`/market` 页面、市场分类展示。
- `/admin` readiness 检查。

## 必须执行的验证命令

- `npm run build`
- `npm run lint`

## 高风险点

- 订单详情页改动较多，可能出现状态文案、截止时间、投稿列表展示错误。
- 心跳同步逻辑改了，可能影响订单状态刷新、投稿同步、已读标记。
- 附件上传/下载涉及安全边界，需确认非法输入不会 500。
- `package-lock.json` 大量变化，需确认依赖安装和构建稳定。
- 涉及真实付款/结算/短信时不要随意触发真实采用投稿或真实短信，除非主人明确同意。

## 测试结论格式

```text
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
是否建议上线：建议上线 / 建议补测后上线 / 建议暂缓上线
```

## 补交测试结论

测试线程名称：
2026-05-20 上线前待测版本回归测试

对应上线摘要：
`docs/current-release-test-brief.md` 的 `2026-05-20 上线前待测版本`

测试环境：
本地开发环境，连接真实才虫数据；未触发真实结算、退款、短信。

测试时间：
2026-05-20 上午

测试范围：
订单列表、订单详情、真实订单投稿同步、红点提示、前台自动刷新、后台 30 分钟心跳、市场页分类/分页、附件上传下载、创建任务校验、管理后台保护、构建和 lint。

通过路径：
- 真实订单【项目征集令】“碎片变日记”已同步到 `1 条投稿` 和 `5 个附件`。
- 前台刷新确认会请求才虫最新数据，不只是刷新本地状态。
- 用户前台自动刷新间隔是 `10 分钟`；GitHub 后台心跳是 `30 分钟`，两者不是同一套资源。
- 附件上传、空文件/超大文件拦截、附件下载代理、非法创建任务校验均通过。
- 首页、市场页、订单详情、投稿接口、后台 readiness、定时心跳鉴权均通过。
- `npm run build` 通过；`npm run lint` 通过，只有 12 个 warning，0 个 error。

发现的问题：
- 市场接口传 `pageSize=3` 时仍返回 6 条。
- 投稿接口返回了多余的原始 agent 数据。
- 红点逻辑会把首次看到的“进行中订单已有投稿”当成已读，所以真实订单有投稿但可能不亮红点。
- 部分历史市场数据 topic 仍有 `$undefined`，属于旧数据清洗问题。

已修复的问题：
- 已修复市场分页不听参数的问题：`lib/market-activity.ts`。
- 已收紧投稿/订单返回字段，避免多余原始数据外露：`lib/caichong.ts`。
- 已修复进行中/待选择订单首次看到投稿不亮红点的问题：`components/order-console.tsx`。

仍未验证：
- 没有做真实采用投稿、结算、退款、短信发送。
- 没有在线上 GitHub Actions 页面确认最近一次 30 分钟心跳实际运行记录。

残留风险：
- 当前工作区有未提交改动，必须把这些修复一起纳入发布版本。
- 生产环境必须确认没有开启开发登录。

是否涉及真实付款/结算/短信：
未触发真实付款、结算、退款、短信；只读取了真实订单和真实投稿数据。

是否改动了代码：
是。

改动文件：
- `lib/market-activity.ts`
- `lib/caichong.ts`
- `components/order-console.tsx`

验证命令和结果：
- `npm run build`：通过。
- `npm run lint`：通过，0 errors，12 warnings。
- 关键 API 和页面 curl 验证：通过。

是否建议上线：
建议上线，但前提是把本轮修复一并发布；不建议直接发布未包含这些修复的旧版本。
