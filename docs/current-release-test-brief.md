# Current Release Test Brief

给测试线程的简单指令：

```text
请读取 docs/current-release-test-brief.md，按本轮待测范围测试；能修就修，最后把测试结论写回本文件的“本轮测试结论”小节。
```

## 上线摘要名称

2026-05-24 首页市场动态规则修正与展示稳定版本

## 本轮上线总控摘要

本轮重点验证：

- 首页市场动态不再展示未付款关闭任务。
- 成功发布后关闭的任务仍进入市场动态，但公开状态统一显示为“已完成”。
- `ACTIVE`、`PENDING_SELECTION` 在市场中显示为“进行中”。
- `COMPLETED` 在市场中显示为“已完成”。
- 市场动态统计与市场列表使用同一套公开展示规则。
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
- `docs/project-handoff.md` 增加入口，后续改市场动态必须先读规则文档。
- 更新 release/test 文档里与本轮规则冲突的旧描述。

## 本轮重点测试路径

- `npm run build` 必须通过。
- `git diff --check` 必须通过。
- 建议执行 `npm run lint`，允许既有 warning，但不能有 error。
- 打开首页，确认市场动态卡片正常显示。
- 抽查 `/api/platform/market?pageSize=100`：
  - 不包含未付款关闭任务。
  - 不包含“无聊，有Agent和我聊天吗？”。
  - 可展示的 `CLOSED` 项 `statusLabel` 均为“已完成”。
- 桌面端滚动首页，确认市场筛选条吸顶背景自然、不截断、不横向溢出。
- 手机视口滚动首页，确认筛选条不压住顶部菜单/登录按钮，底部发布条仍正常。
- 不测试真实付款、采用投稿、结算、退款、短信。

## 本轮高风险点

- 市场动态规则影响用户看到的任务数量，需要上线后观察数量是否符合预期。
- 才虫侧公开市场的 `CLOSED` 任务如果缺少 `paidAt`、`submission_count`、`closeReason`，会被保守过滤。
- 本轮修正规则文档后，后续市场动态改动必须遵循 `docs/market-dynamics-rules.md`。

## 本轮必须执行的验证命令

- `npm run build`
- `git diff --check`

## 本轮测试结论

测试线程名称：
上线总控自检

对应上线摘要：
2026-05-24 首页市场动态规则修正与展示稳定版本

测试环境：
本地 `main` 工作区，Next dev server，连接本地配置的真实 Supabase / 才虫配置；浏览器桌面 1280x720、手机 390x844 视口。

测试时间：
2026-05-24 21:55 CST

测试范围：
覆盖构建、lint、空白检查、本地市场接口、首页市场动态桌面/手机展示、筛选条吸顶、横向溢出、底部紧凑发布条、浏览器控制台 error。

通过路径：
- `npm run build` 通过。
- `npm run lint` 通过，0 errors，13 warnings；warnings 为既有 `<img>` 和 React Hook dependency 提示。
- `git diff --check` 通过。
- 本地 `/api/platform/market?pageSize=100` 返回 11 条公开市场任务。
- 未包含未付款关闭任务 `f911e453-86e0-495d-8a7f-da98a315633f`，也未包含“无聊/聊天”相关关闭任务。
- `ACTIVE` / `PENDING_SELECTION` 均显示为“进行中”。
- `COMPLETED` 均显示为“已完成”。
- 可展示的 `CLOSED` 均显示为“已完成”。
- 浏览器桌面 1280x720：首页市场动态显示 11 条，滚动后筛选条 `is-pinned` 生效，背景为 fixed，不横向溢出。
- 浏览器手机 390x844：首页市场动态显示正常，筛选条吸顶位置在顶部菜单和登录按钮下方，不横向溢出。
- 手机端滚动后底部紧凑发布条仍正常出现。
- 干净浏览器复测无 console error。

发现的问题：
- 内置浏览器直接打开本地 API URL 时被浏览器侧拦截；已改用本地 `curl` 读取接口 JSON，不属于应用代码问题。

已修复的问题：
- 本轮自检未追加业务代码修复。

仍未验证：
- 未用真实手机手动滑动。
- 未触发真实市场同步写入。
- 未创建真实订单。
- 未验证真实付款、采用投稿、结算、退款、短信。

残留风险：
- 市场动态数量会因为重新纳入有成功发布证据的 `CLOSED` 任务而变化，这是预期变化，需上线后观察数量是否符合运营预期。
- 旧的 `market_observed_tasks` 记录如果缺少 `raw.closeReason` / `raw.paidAt`，会按保守规则过滤；后续同步成功后可逐步补足。
- 手机端 sticky 行在真实设备上仍需观察手感和遮挡情况。

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
- `npm run lint`：通过，0 errors，13 warnings。
- `git diff --check`：通过。
- `curl http://localhost:3000/api/platform/market?pageSize=100`：通过，返回 11 条；未付款关闭任务被过滤；公开状态文案符合本轮规则。
- Browser：桌面首页、手机首页冒烟通过；筛选条吸顶、无横向溢出、底部紧凑发布条、console error 均通过。

是否建议上线：
建议上线，带观察。构建、lint、接口规则和关键浏览器冒烟均通过；本轮不涉及真实资金和短信发送。
