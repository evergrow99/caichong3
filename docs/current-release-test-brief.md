# Current Release Test Brief

给测试线程的简单指令：

```text
请读取 docs/current-release-test-brief.md，按本轮待测范围测试；能修就修，最后把测试结论写回本文件的“本轮测试结论”小节。
```

## 上线摘要名称

2026-05-22 支付详情加载防卡死与侧栏提示补丁待测版本

## 本轮上线总控摘要

对应 `docs/release-management.md` 的 `上线摘要 2026-05-22 支付详情加载防卡死与侧栏提示补丁`。

本轮重点验证：

- 付款后回到任务详情页，不应长时间卡在 loading。
- 才虫实时详情接口慢或失败时，任务详情接口应先返回本地缓存。
- 本地缓存返回时应记录可读 warn 日志，方便后台排查。
- 才虫 GET 查询应有默认超时，不应无限等待外部服务。
- 侧栏展开/收起按钮 tooltip 文案和位置正常。
- 不主动触发真实采用投稿、结算、退款、短信。

## 本轮版本状态

- 分支：`main`
- 当前状态：本地 `main` 领先 `origin/main` 1 个提交。
- 测试范围以本地最新 `main` 为准。
- 本轮最新提交：
  - `8446028 Fix payment detail loading fallback`
- 注意：如果测试线程只能读取远端代码，需要先推送该提交；如果测试线程和本线程共用当前工作区，可以直接测试本地最新 `main`。

## 本轮涉及文件

- `app/api/tasks/[taskId]/route.ts`
- `lib/caichong.ts`
- `lib/task-service.ts`
- `components/order-console.tsx`
- `app/globals.css`
- `docs/project-handoff.md`
- `docs/release-management.md`
- `docs/current-release-test-brief.md`

## 本轮主要变更

1. 任务详情加载防卡死
- 任务详情接口会先读取 Supabase 本地订单。
- 对真实才虫任务，远程刷新最多等待 4.5 秒。
- 如果才虫接口超时或失败，接口先返回本地订单缓存，避免前台一直 loading。
- 失败会写入 operation logs warn：`任务详情远程刷新超时或失败，已返回本地缓存`。

2. 才虫查询超时
- 才虫 GET 查询默认 8 秒超时。
- 超时错误会变成可读文案：`才虫服务响应超时：<endpoint>`。
- 保留轻量重试，调用方可按场景调整重试次数和超时时间。

3. 侧栏提示补丁
- 展开侧栏时，“收起”按钮增加鼠滑提示。
- 收起侧栏后，提示文案为 `展开`。

## 本轮重点测试路径

- `npm run build` 必须通过。
- `npm run lint` 建议执行，允许既有 warning，但不能有 error。
- 打开一个已有真实订单详情，确认页面能正常显示。
- 打开一个待支付或刚支付订单详情，确认不会长时间停留在 loading。
- 在才虫接口慢或不可用时，详情接口应在约 4.5-6 秒内返回本地缓存，而不是一直等待。
- 检查后台 operation logs 是否能看到 `task.detail` warn，文案应可读。
- 检查用户前台在返回本地缓存后仍可稍后通过轮询、手动刷新或心跳继续更新状态。
- 检查侧栏展开状态下“收起”按钮有提示。
- 检查侧栏收起状态下提示文案为 `展开`，且不被遮挡。
- 回归检查 `/api/sync/heartbeat` 和 `/api/sync/order-reminders` 不受本补丁影响。

## 本轮高风险点

- 本轮修复的是“不要卡死”，不是保证才虫实时状态一定立即成功。
- 如果返回本地缓存，用户可能先看到旧状态；后续轮询或心跳成功后再更新。
- 支付成功后的完整端到端体验仍建议用下一笔低额真实订单观察。
- 不要主动触发真实采用投稿、结算、退款、短信，除非主人明确同意。

## 本轮必须执行的验证命令

- `npm run build`

## 本轮测试结论格式

```text
测试线程名称：
对应上线摘要：2026-05-22 支付详情加载防卡死与侧栏提示补丁
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

## 本轮测试结论

测试线程名称：
Codex 接替测试线程

对应上线摘要：
2026-05-22 支付详情加载防卡死与侧栏提示补丁

测试环境：
本地 `main` 最新代码（HEAD `8446028 Fix payment detail loading fallback`），本机 Next dev / production server，连接本地配置的 Supabase 与真实才虫配置；另起本机慢响应 mock 才虫服务验证详情超时兜底。

测试时间：
2026-05-22 23:19 CST

测试范围：
覆盖本轮重点范围：构建、lint、真实配置订单列表与详情、才虫详情慢响应兜底、operation logs warn、侧栏展开/收起 tooltip、用户心跳、订单短信提醒未授权保护。

通过路径：
- `npm run build` 通过。
- `npm run lint` 通过，0 errors，13 warnings；warnings 为既有 `<img>` 和 React Hook dependency 提示。
- 测试账号登录成功，`/api/tasks?page=1&pageSize=20` 返回 200，当前可见订单 `08487707-1982-4d25-ba1c-7187c047ac09`。
- 真实配置下 `/api/tasks/08487707-1982-4d25-ba1c-7187c047ac09` 返回 200，详情正常显示本地订单数据，未长时间 loading。
- 慢响应 mock 才虫详情服务延迟 10 秒返回时，任务详情接口返回 200 和本地缓存，没有等满 10 秒。
- mock 日志确认 `/trpc/publish_task.detail` 请求在约 4.5 秒被关闭，说明详情远程刷新超时上限生效。
- Supabase `operation_logs` 查到 `task.detail` warn，文案为 `任务详情远程刷新超时或失败，已返回本地缓存`，details 中错误为 `才虫服务响应超时：publish_task.detail`。
- 浏览器验证侧栏按钮：展开状态 `aria-label=收起侧栏`、`data-sidebar-tooltip=收起`；收起状态 `aria-label=展开侧栏`、`data-sidebar-tooltip=展开`，CSS 存在基于 `data-sidebar-tooltip` 的提示规则。
- 真实配置 production server 下 `/api/sync/heartbeat` POST 返回 200，`ok: true`，`refreshErrorCount: 0`。
- `/api/sync/order-reminders` 不带密钥返回 401，未触发真实短信。

发现的问题：
- 慢响应 mock 下，远程请求本身约 4.5 秒被 abort，但本地 production server 端到端详情响应约 6.89 秒，略高于测试 brief 中“约 4.5-6 秒”的目标窗口；接口没有卡死，主要残留是本机环境下整体耗时仍偏高。
- 本地 production server 的 `/api/health/readiness` 因 `ALLOW_DEV_LOGIN=true` 返回 503；这是本地生产模式风险提示，真实上线环境需关闭固定验证码。

已修复的问题：
- 本轮接替测试未改动业务代码。

仍未验证：
- 未做真实付款，因此“付款后回到任务详情页”和“付款完成后自动进入提交期/成功提示”的完整端到端链路未验证。
- 未主动创建新的低额真实订单。
- 未调用带真实密钥的 `/api/sync/order-reminders`，避免触发真实短信链路。
- 侧栏 tooltip 通过浏览器 DOM/CSS 状态验证，未做人工鼠标悬停截图级验收。

残留风险：
- 支付成功后的真实链路仍建议用下一笔低额真实订单补测。
- 慢接口兜底已避免无限 loading，但本机 production 端到端耗时略超目标窗口，上线后建议观察 `task.detail` warn 频率和用户详情页耗时。
- 如果返回本地缓存，用户可能短时间看到旧状态；需依赖后续轮询、手动刷新或心跳继续更新。
- 上线环境必须确认 `ALLOW_DEV_LOGIN` 未开启。

是否涉及真实付款/结算/短信：
否。未触发真实付款、采用投稿、结算、退款或真实短信发送；读取了真实配置下的订单、心跳和后台日志数据。

是否改动了代码：
否。仅写回本测试结论文档。

改动文件：
- `docs/current-release-test-brief.md`

验证命令和结果：
- `npm run build`：通过。
- `npm run lint`：通过，0 errors，13 warnings。
- `curl /api/health/readiness`：dev server 返回 200，全部 ready；production server 因 `ALLOW_DEV_LOGIN=true` 返回 503。
- `curl /api/auth/dev-login`：200，测试账号登录成功。
- `curl /api/tasks?page=1&pageSize=20`：200，订单列表可读。
- `curl /api/tasks/08487707-1982-4d25-ba1c-7187c047ac09`：真实配置下 200，详情可读。
- 慢响应 mock + `curl /api/tasks/08487707-1982-4d25-ba1c-7187c047ac09`：200，返回本地缓存；mock 侧确认约 4.5 秒 abort；curl 总耗时约 6.89 秒。
- Supabase `operation_logs` 查询：存在 `task.detail` warn，错误文案可读。
- `curl -X POST /api/sync/heartbeat`：200，`ok: true`，`refreshErrorCount: 0`。
- `curl /api/sync/order-reminders`：401，未授权保护正常。
- Browser 检查 `/` 侧栏按钮：展开/收起 tooltip 数据和 CSS 规则存在。

是否建议上线：
建议补测后上线。构建、lint、详情兜底、warn 日志、侧栏提示和同步安全回归已通过；但真实付款后的端到端状态刷新仍未验证，且慢接口本机端到端耗时略高于目标窗口。
