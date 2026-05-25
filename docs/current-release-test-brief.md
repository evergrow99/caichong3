# Current Release Test Brief

给测试线程的简单指令：

```text
请读取 docs/current-release-test-brief.md，按本轮待测范围测试；能修就修，最后把测试结论写回本文件的“本轮测试结论”小节。
```

## 上线摘要名称

2026-05-25 首页市场动态规则与统计口径修正版本

## 本轮上线总控摘要

本轮重点验证：

- 首页市场动态不再展示未付款关闭任务。
- 成功发布后关闭的任务仍进入市场动态，但公开状态统一显示为“已完成”。
- `ACTIVE`、`PENDING_SELECTION` 在市场中显示为“进行中”。
- `COMPLETED` 在市场中显示为“已完成”。
- 市场动态统计与市场列表使用同一套公开展示规则。
- 右上角统计使用“官方锚点 + 锚点之后新增的符合展示规则任务”，避免重复计算锚点前历史任务。
- 本地首页右上角统计应显示：今日发单 `0`、本月发单 `32`、本月发单额 `¥578`、累计发单 `121`。
- 首页市场动态筛选条吸顶展示正常，桌面端不出现截断背景，手机端不与顶部菜单/登录按钮冲突。
- 本轮不主动触发真实付款、采用投稿、结算、退款、短信。

## 本轮版本状态

- 分支：`main`
- 当前状态：本轮包含 2 个业务文件改动和 4 个文档文件改动。
- 上一轮线上基础版本：以当前 `origin/main` 为准。
- 本轮发布提交：以最终上线提交为准。

## 本轮涉及文件

- `app/globals.css`
- `lib/market-activity.ts`
- `docs/market-dynamics-rules.md`
- `docs/project-handoff.md`
- `docs/current-release-test-brief.md`
- `docs/release-management.md`

## 本轮主要变更

1. 市场动态规则修正
- `CLOSED` 不再一刀切过滤。
- 未付款关闭任务不展示，例如 `TIMEOUT_NO_PAYMENT` 或没有成功发布证据的关闭任务。
- 成功发布后关闭的任务继续展示，包括无人投稿关闭、选择期超时关闭、有付款或有投稿证据的关闭任务。
- “无聊，有Agent和我聊天吗？”这类未付款关闭任务已被过滤。

2. 市场公开状态文案恢复约定
- `ACTIVE`、`PENDING_SELECTION`：显示为“进行中”。
- `COMPLETED`：显示为“已完成”。
- 可展示的 `CLOSED`：也显示为“已完成”。
- 市场卡片和详情不展示关闭原因，避免给普通用户解释过细状态。

3. 首页市场动态 UI 稳定
- 桌面端筛选条吸顶后的磨玻璃背景铺满右侧工作区，不再像被截断的黑色条。
- 手机端市场预览外层不再裁切 sticky 行。
- 手机端筛选条吸顶时避开顶部菜单/登录按钮。
- 保持页面无横向溢出。

4. 规则文档固化
- 新增 `docs/market-dynamics-rules.md` 作为市场动态规则的唯一口径文档。
- 规则文档已改为中文，便于产品侧查看和确认。
- `docs/project-handoff.md` 增加入口，后续改市场动态必须先读规则文档。
- 更新 release/test 文档里与本轮规则冲突的旧描述。

5. 右上角统计口径修正
- 后台已有官方锚点：官方累计发单、官方本月发单、官方本月发单额。
- 统计不再用“调整后基数 + 所有历史可展示任务”的方式，避免锚点前历史任务被重复计算。
- 统计改为“官方锚点 + 锚点之后新增的符合展示规则任务”。
- 本地验证结果：今日发单 `0`、本月发单 `32`、本月发单额 `¥578`、累计发单 `121`。

## 本轮重点测试路径

- `npm run build` 必须通过。
- `git diff --check` 必须通过。
- 建议执行 `npm run lint`，允许既有 warning，但不能有 error。
- 打开首页，确认市场动态卡片正常显示。
- 抽查 `/api/platform/market?pageSize=100`：
  - 不包含未付款关闭任务。
  - 不包含“无聊，有Agent和我聊天吗？”。
  - 可展示的 `CLOSED` 项 `statusLabel` 均为“已完成”。
- 抽查 `/api/platform/activity`：
  - `todayOrderCount` 为 `0`。
  - `monthOrderCount` 为 `32`。
  - `monthOrderAmount` 约为 `577.8`，首页展示为 `¥578`。
  - `totalOrderCount` 为 `121`。
- 桌面端滚动首页，确认市场筛选条吸顶背景自然、不截断、不横向溢出。
- 手机视口滚动首页，确认筛选条不压住顶部菜单/登录按钮，底部发布条仍正常。
- 不测试真实付款、采用投稿、结算、退款、短信。

## 本轮高风险点

- 市场动态规则影响用户看到的任务数量，需要上线后观察数量是否符合预期。
- 统计依赖后台官方锚点和 `effective_at`，后续调整基数时必须同步确认锚点时间和官方数值。
- 才虫侧公开市场的 `CLOSED` 任务如果缺少 `paidAt`、`submission_count`、`closeReason`，会被保守过滤。
- 本轮修正规则文档后，后续市场动态改动必须遵循 `docs/market-dynamics-rules.md`。

## 本轮必须执行的验证命令

- `npm run build`
- `git diff --check`

## 本轮测试结论

测试线程名称：
上线总控自检

对应上线摘要：
2026-05-25 首页市场动态规则与统计口径修正版本

测试环境：
本地 `main` 工作区，Next dev server，连接本地配置的真实 Supabase / 才虫配置；浏览器桌面 1280x720、手机 390x844 视口。

测试时间：
2026-05-25 11:20 CST

测试范围：
覆盖构建、空白检查、本地市场接口、本地统计接口、首页市场动态桌面展示、右上角统计、规则文档口径。

通过路径：
- `npm run build` 通过。
- `git diff --check` 通过。
- 本地 `/api/platform/market?pageSize=100` 返回 11 条公开市场任务。
- 未包含未付款关闭任务 `f911e453-86e0-495d-8a7f-da98a315633f`，也未包含“无聊/聊天”相关关闭任务。
- `ACTIVE` / `PENDING_SELECTION` 均显示为“进行中”。
- `COMPLETED` 均显示为“已完成”。
- 可展示的 `CLOSED` 均显示为“已完成”。
- 本地 `/api/platform/activity` 返回：`todayOrderCount: 0`、`monthOrderCount: 32`、`monthOrderAmount: 577.8`、`totalOrderCount: 121`。
- 浏览器桌面 1280x720：首页右上角显示“今日发单 0 / 本月发单 32 / 本月发单额 ¥578 / 累计发单 121”。
- 首页市场动态显示 11 条，公开状态和统计口径符合 `docs/market-dynamics-rules.md`。

发现的问题：
- 右上角统计原先按“调整后基数 + 所有历史可展示任务”计算，导致锚点前历史任务被重复叠加；已修正。

已修复的问题：
- 已修正 `lib/market-activity.ts` 的基数锚点计算逻辑。
- 已把统计锚点规则补入 `docs/market-dynamics-rules.md`。
- 已将规则文档中文化，便于产品侧查看。

仍未验证：
- 未重新执行 `npm run lint`。
- 未用真实手机手动滑动。
- 未触发真实市场同步写入。
- 未创建真实订单。
- 未验证真实付款、采用投稿、结算、退款、短信。

残留风险：
- 市场动态数量和统计会因为重新纳入有成功发布证据的 `CLOSED` 任务、以及修正官方锚点计算而变化，这是预期变化，需上线后观察数量是否符合运营预期。
- 后续如果调整官方锚点，需要同步确认 `market_activity_baselines.note` 和 `effective_at`。
- 旧的 `market_observed_tasks` 记录如果缺少 `raw.closeReason` / `raw.paidAt`，会按保守规则过滤；后续同步成功后可逐步补足。

是否涉及真实付款/结算/短信：
否。本轮不应触发真实付款、采用投稿、结算、退款或真实短信发送。

是否改动了代码：
是。本轮包含市场动态规则和首页市场动态样式修复。

改动文件：
- `app/globals.css`
- `lib/market-activity.ts`
- `docs/market-dynamics-rules.md`
- `docs/project-handoff.md`
- `docs/current-release-test-brief.md`
- `docs/release-management.md`

验证命令和结果：
- `npm run build`：通过。
- `git diff --check`：通过。
- `curl http://localhost:3000/api/platform/market?pageSize=100`：通过，返回 11 条；未付款关闭任务被过滤；公开状态文案符合本轮规则。
- Browser/API：`/api/platform/activity` 返回 `0 / 32 / 577.8 / 121`；首页右上角展示 `0 / 32 / ¥578 / 121`。

是否建议上线：
建议上线，带观察。构建、接口规则、统计口径和首页右上角展示均通过；本轮不涉及真实资金和短信发送。
