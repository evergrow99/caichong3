# Current Release Test Brief

给测试线程的简单指令：

```text
请读取 docs/current-release-test-brief.md，按本轮待测范围测试；能修就修，最后把测试结论写回本文件的“本轮测试结论”小节。
```

## 上线摘要名称

2026-05-25 前后台登录隔离与订单详情兜底上线版本

## 本轮上线总控摘要

本轮重点验证：

- 前台普通用户登录和后台管理员登录不再互相覆盖。
- 同一个浏览器里，前台继续使用普通用户身份查看自己的订单，后台使用管理员身份查看后台。
- 后台登录页点击“获取验证码”后，本地开发环境能展示验证码提示并自动填入验证码。
- 后台右上角提供“退出登录”，退出后回到后台登录页，且不影响前台登录态。
- 前台订单详情读取失败时，不再把左侧已选订单清空成“请选择任务”；应保留可用订单摘要并显示真实错误。
- 返回发布页或切换订单时，历史订单详情错误不应串到发布表单。
- 本轮不主动触发真实付款、采用投稿、结算、退款、短信。

说明：本文件下方保留了上一轮“投稿附件下载”验证记录；本轮实际上线以“补充测试结论”和“最终收口测试摘要”为准。

## 本轮版本状态

- 分支：`main`
- 当前状态：本地 `main` 有本轮未提交改动，等待上线总控复核后提交并推送。
- 测试范围以当前本地工作区为准。
- 如果测试线程只能读取远端代码，需要先说明无法覆盖本轮未提交改动，不能直接按远端结论上线。

## 本轮涉及文件

- `app/admin/page.tsx`
- `app/api/admin/login/route.ts`
- `components/admin-login-form.tsx`
- `components/order-console.tsx`
- `lib/auth-utils.ts`
- `lib/current-user.ts`
- `docs/current-release-test-brief.md`
- `docs/release-management.md`

## 本轮主要变更

1. 前后台登录隔离
- 前台登录继续写入 `dev_phone`，路径为 `/`。
- 后台登录改为写入 `admin_phone`，路径为 `/admin`。
- 后台页面读取后台专用登录态，避免后台登录覆盖前台普通用户身份。
- 后台退出登录只清理 `admin_phone`，不影响前台 `dev_phone`。

2. 后台登录体验
- 后台登录页点击“获取验证码”后展示服务端返回信息。
- 本地开发环境返回 `123456` 时，页面可自动填入验证码。
- 后台右上角“返回工作台”改为“退出登录”。

3. 前台订单详情失败态
- 切换订单或返回发布页时清理旧错误。
- 订单详情读取失败时，优先保留任务列表里已有的订单摘要。
- 详情区展示真实错误，避免只显示“请选择任务，或发布一个新任务。”。

4. 不变范围
- 不改投稿同步。
- 不改订单状态。
- 不改附件预览读取逻辑。
- 不改附件下载代理。
- 不改真实付款、采用投稿、结算、退款。
- 不改短信提醒。

## 本轮重点测试路径

- `npm run build` 必须通过。
- `git diff --check` 必须通过。
- `npm run lint` 必须通过，允许既有 warning，但不能有 error。
- 同一 cookie 环境下，先前台登录普通用户，再后台登录管理员：
  - cookie 中应同时存在 `dev_phone` 和 `admin_phone`。
  - `/api/me` 应仍返回普通用户手机号。
  - `/admin` 应进入管理员后台。
- 浏览器打开后台登录页：
  - 点击“获取验证码”应展示验证码提示。
  - 本地开发环境应自动填入 `123456`。
  - 管理员登录后应进入后台。
  - 点击“退出登录”后应回到 `/admin/login`。
- 前台订单详情读取失败时，应显示真实错误并保留可用订单摘要；切回发布页不应残留订单详情错误。
- 不测试真实付款、采用投稿、结算、退款、短信。

## 建议接口验证命令

```bash
curl -s -c /tmp/caichong-release-auth-isolation.txt -X POST http://127.0.0.1:3000/api/auth/dev-login -H "Content-Type: application/json; charset=utf-8" -d '{"phone":"13231636325","code":"123456"}'
curl -s -b /tmp/caichong-release-auth-isolation.txt -c /tmp/caichong-release-auth-isolation.txt -X POST http://127.0.0.1:3000/api/admin/login -H "Content-Type: application/json; charset=utf-8" -d '{"phone":"18201500661","code":"123456"}'
cat /tmp/caichong-release-auth-isolation.txt
curl -s -b /tmp/caichong-release-auth-isolation.txt http://127.0.0.1:3000/api/me
curl -s -b /tmp/caichong-release-auth-isolation.txt -w '\nHTTP_STATUS:%{http_code}\n' http://127.0.0.1:3000/admin
```

## 本轮高风险点

- 已经被旧版本后台登录覆盖过前台身份的浏览器，需要重新登录一次前台账号才能恢复正确身份。
- 生产环境后台登录依赖真实短信验证码；本地 `123456` 验证只适用于开发环境。
- 订单详情失败态修复的是错误展示和缓存兜底，不代表外部才虫详情接口永远可用。
- 本轮不触碰资金链路，但真实付款、采用投稿、结算、退款仍需独立闭环测试。

## 本轮必须执行的验证命令

- `npm run build`
- `npm run lint`
- `git diff --check`

## 本轮测试结论格式

```text
测试线程名称：
对应上线摘要：2026-05-25 前后台登录隔离与订单详情兜底上线版本
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

说明：下方第一段为上一轮附件下载验证记录；本轮实际测试结论请看后续“补充测试结论”和“最终收口测试摘要”。上线总控按最终收口摘要复审。

测试线程名称：
Codex 本地测试线程

对应上线摘要：
2026-05-25 投稿附件下载响应体验修复待测版本

测试环境：
本地工作区 `main`，以当前未提交改动为准；Next dev server `http://localhost:3000`；接口验证使用本地服务和真实才虫附件 URL。

测试时间：
2026-05-25 11:50:20 CST

测试范围：
按本轮待测范围验证：构建、diff 空白检查、lint、下载代理响应头、安全边界、开发登录态任务数据可用性、前端附件下载实现代码路径。未触发真实付款、采用投稿、结算、退款或短信。

通过路径：
- `npm run build` 通过。
- `git diff --check` 通过。
- `npm run lint` 通过，无 error，保留既有 13 个 warning。
- 真实才虫附件 URL 的 `disposition=attachment` 返回 200，`Content-Disposition` 包含 `attachment; filename="____.txt"; filename*=UTF-8''%E4%B8%AD%E6%96%87%E9%99%84%E4%BB%B6.txt`。
- 真实才虫附件 URL 的 `disposition=inline` 返回 200，`Content-Disposition` 包含 `inline; filename="____.txt"; filename*=UTF-8''%E4%B8%AD%E6%96%87%E9%99%84%E4%BB%B6.txt`。
- 缺少 `url` 返回 400。
- 非 HTTPS URL 返回 400。
- 非才虫附件域名返回 400。
- 格式错误 URL 返回 400。
- 伪造才虫后缀域名返回 400。
- 前端下载实现已核对：点击后调用 `showToast("正在开始下载")`，创建同源代理下载链接交给浏览器处理，并用 1200ms 定时恢复当前附件按钮禁用态。

发现的问题：
未发现需要改业务代码的问题。

已修复的问题：
无。本轮仅执行验证并写回测试结论。

仍未验证：
当前可用开发测试账号没有含投稿附件的真实订单详情，因此未能完整实测订单详情内点击附件下载按钮后的浏览器下载栏行为、按钮 1.2 秒恢复的真实 UI 动画，以及点击附件行打开预览的真实 UI 路径。已用真实才虫附件 URL 覆盖下载代理响应头和安全边界，并完成前端实现代码路径核对。

残留风险：
浏览器下载栏/保存文件名行为仍受浏览器和系统下载设置影响；中文文件名在具体浏览器里的最终展示建议用一个真实含投稿附件的订单再做一次手工补测。大附件下载总耗时仍取决于源站、代理服务器和用户网络。

是否涉及真实付款/结算/短信：
否。本轮不应触发真实付款、采用投稿、结算、退款或真实短信发送。

是否改动了代码：
否。没有修改业务代码；仅按要求写回本测试结论文档。

改动文件：
`docs/current-release-test-brief.md`

验证命令和结果：
- `git diff --check`：通过，无输出。
- `npm run build`：通过。
- `npm run lint`：通过，0 error，13 warning（既有 `<img>`/hook dependency warning）。
- `curl -sI "http://localhost:3000/api/download/submission-attachment?url=<真实才虫附件URL>&filename=中文附件.txt&disposition=attachment"`：200，包含 ASCII 兜底 `filename` 和 UTF-8 `filename*`。
- `curl -sI "http://localhost:3000/api/download/submission-attachment?url=<真实才虫附件URL>&filename=中文附件.txt&disposition=inline"`：200，包含 ASCII 兜底 `filename` 和 UTF-8 `filename*`。
- `curl -sI` 缺少 `url`：400。
- `curl -sI` 非 HTTPS URL：400。
- `curl -sI` 非才虫附件域名：400。
- `curl -sI` 格式错误 URL：400。
- `curl -sI` 伪造才虫后缀域名：400。
- `curl -s -c /tmp/caichong-release-download-cookie.txt -X POST /api/auth/dev-login`：200，开发登录成功，未触发真实短信。
- `curl -s -b /tmp/caichong-release-download-cookie.txt /api/tasks?page=1&pageSize=20`：200，当前账号无含投稿附件订单。

是否建议上线：
建议补测后上线。接口与代码路径验证通过，但因当前测试账号缺少含投稿附件订单，建议补一个真实订单详情场景，手工确认点击下载按钮的 toast、按钮短暂禁用恢复、浏览器下载栏，以及附件行预览。

补充测试结论（2026-05-25 14:26:50 CST）：
- 复核用户反馈的“点击任意订单详情先 loading，随后只显示请选择任务；回到首页发布页出现无权限查看提示”问题，确认存在两类原因：
  - 前端详情读取失败后把 `selectedTask` 清空，导致详情区落到通用空态，真实错误没有留在详情页。
  - 订单详情错误状态没有在切换回发布页时清理，导致 `订单不存在，或你没有权限查看这条订单` 串到首页发布表单。
- 结合用户补充“线上前端登录一个账号，后台登录管理员账号”，确认后台登录接口复用前台 `dev_phone` cookie 且路径为 `/`，会覆盖前台登录身份。前台随后按管理员身份查用户订单，容易触发订单详情无权限。
- 已修复：
  - 后台登录改用独立 `admin_phone` cookie，路径限制为 `/admin`。
  - 后台页面改为读取后台专用登录态，不再依赖前台用户 cookie。
  - 前台切换订单/返回发布页时清理详情错误，避免错误提示串到发布表单。
  - 详情读取失败时优先保留左侧列表里已有的订单摘要，并在详情区展示错误提示；没有缓存订单时也展示真实错误，不再只显示“请选择任务，或发布一个新任务。”。
- 验证结果：
  - `git diff --check` 通过。
  - `npm run lint` 通过，0 error，仍为既有 13 个 warning。
  - `npm run build` 通过。
  - 本地浏览器验证后台管理员登录后可进入后台；返回前台 `/` 后未被登录成管理员，仍显示前台登录入口，说明前后台 cookie 隔离生效。
- 残留风险：
  - 已经被旧版本后台登录覆盖过前台 `dev_phone` 的浏览器，需要重新登录一次前台账号才能恢复正确身份。
  - 建议线上发布后用同一浏览器分别登录前台普通账号和后台管理员账号，再点开前台历史订单详情做一次回归。

最终收口测试摘要（2026-05-25 15:11:35 CST）：
- 本轮后续修复范围：
  - 前台账号和后台管理员账号登录态隔离。
  - 后台登录页“获取验证码”本地反馈。
  - 后台右上角“返回工作台”改为“退出登录”，退出后返回后台登录页。
  - 前台订单详情失败态和首页错误串联问题。
- 已确认的登录态边界：
  - 前台登录写入 `dev_phone`，路径为 `/`。
  - 后台登录写入 `admin_phone`，路径为 `/admin`。
  - 后台页面读取 `admin_phone`，前台订单接口继续读取 `dev_phone`。
  - 后台退出登录只清理 `admin_phone`，不影响前台 `dev_phone`。
- 本地测试地址：
  - 电脑前台：`http://localhost:3000`
  - 电脑后台：`http://localhost:3000/admin/login`
  - 手机前台：`http://10.255.97.187:3000`
  - 如需更强浏览器侧隔离，可用 `http://localhost:3000` 测前台、`http://127.0.0.1:3000/admin/login` 测后台。
- 后台验证码验证：
  - 本地 `/api/admin/send-code` 返回 `开发环境可直接输入验证码 123456`。
  - 后台登录页点击“获取验证码”后不再静默，展示本地提示，并可自动填入 `123456`。
- 后台退出验证：
  - 后台右上角按钮已改为“退出登录”。
  - 点击后清理后台专用登录态并跳回 `/admin/login`。
- 最终验证命令：
  - `git diff --check`：通过。
  - `npm run lint`：通过，0 error，仍为既有 13 个 warning。
  - `npm run build`：通过。
  - `curl -s -D - -o /tmp/admin-login-check.txt -X POST http://localhost:3000/api/admin/login ...`：返回 `Set-Cookie: admin_phone=...; Path=/admin`。
  - `curl -s -D - -o /tmp/front-login-check.txt -X POST http://localhost:3000/api/auth/dev-login ...`：返回 `Set-Cookie: dev_phone=...; Path=/`。
- 改动文件：
  - `app/admin/page.tsx`
  - `app/api/admin/login/route.ts`
  - `components/admin-login-form.tsx`
  - `components/order-console.tsx`
  - `lib/auth-utils.ts`
  - `lib/current-user.ts`
  - `docs/current-release-test-brief.md`
- 最终建议：
  - 建议补一次真实浏览器手工回归后上线：同一浏览器内先登录前台普通账号，再登录后台管理员账号，确认前台历史订单详情不再变成无权限；后台点击“退出登录”后返回后台登录页，前台仍保持原账号。

## 补充上线摘要 2026-06-01 市场动态近30天统计规则

上线结论：可上线，带观察。

本轮包含变更：

- 首页市场动态右上角统计文案：
  - `本月发单` 改为 `近30天发单`。
  - `本月发单额` 改为 `近30天发单额`。
- 市场动态统计规则：
  - 近30天数据使用滚动 30 天窗口，从当前时间向前计算 30 个自然日内符合展示规则的任务。
  - 不再使用自然月口径，避免每月 1 日月度数据突然归零或错误沿用上月基数。
  - 官方锚点只有在锚点时间仍处于当前近30天窗口内时参与计算；锚点过期后不再沿用。
- 规则文档：
  - `docs/market-dynamics-rules.md` 已同步记录“近30天发单 / 近30天发单额”的展示和统计规则。

本轮不包含：

- 不新增数据库 migration。
- 不修改市场任务展示准入规则。
- 不修改 `CLOSED` 任务公开状态文案。
- 不触发真实付款、采用投稿、结算、退款或短信。

上线总控验证：

- `npm run build` 通过。
- `git diff --check` 通过。
- 本地首页右上角显示：`今日发单 0 / 近30天发单 33 / 近30天发单额 ¥579 / 累计发单 122`。
- 搜索用户可见代码，`lib/market-activity.ts`、`components/order-console.tsx`、`docs/market-dynamics-rules.md` 中不再保留“本月发单 / 本月发单额”作为市场动态展示口径。

残留风险：

- 近30天数据会随时间自然滚动；如果一周内没有新增发单，数据短期可能保持稳定，但当旧锚点或旧任务滑出 30 天窗口时会自然回落。
- 当前接口字段名仍沿用 `monthOrderCount` / `monthOrderAmount`，但展示和计算语义已改为近30天；后续若要彻底重命名字段，需要单独做兼容改造。
