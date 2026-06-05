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

## 最终收口测试摘要 2026-06-01 订单短信模板更新

上线结论：可部署代码。短信模板生效还需要部署后配置 Vercel Production 环境变量。

本轮包含：

- 新投稿短信文案更新为：`您在AICHONG发布的任务收到新投稿，请进入任务详情查看投稿内容。`
- 进入选择期提醒和选择期结束前 6 小时提醒共用同一套短信正文：`您在AICHONG发布的任务已收到${count}份投稿，请在${deadline}前进入任务详情选定投稿，超时将自动退款。`
- 选择提醒已补充 `count` 模板参数，并继续传入 `deadline`。
- 触发规则未修改：仍然是进入选择期提醒一次、选择期结束前 6 小时提醒一次。
- `submission_count <= 0` 的订单不会生成选择提醒。
- 规则已固化到 `docs/order-sms-reminders.md`，上线依赖已写入 `docs/release-management.md` 和 `docs/deployment-checklist.md`。

本轮不包含：

- 不触发真实短信。
- 不切换生产环境变量。
- 不修改选择期触发规则、选择期时长、提交期时长或退款规则。
- 不改动真实付款、采用投稿、结算、退款逻辑。
- 不新增数据库 migration。

生产环境待配置：

```text
ALIYUN_SMS_SUBMISSION_TEMPLATE_CODE=SMS_507080087
ALIYUN_SMS_SELECTION_STARTED_TEMPLATE_CODE=SMS_507405080
ALIYUN_SMS_SELECTION_DEADLINE_TEMPLATE_CODE=SMS_507405080
```

注意：需要先部署包含本轮代码的版本，再切换以上生产环境变量，避免新模板要求 `count` 但旧代码未传参。

验证结果：

- `git diff --check`：通过。
- `npm run lint`：通过，0 error，13 warning；warning 为既有 `<img>` 与 React Hook dependency 提示。
- `npm run build`：通过。
- 代码核对：`lib/order-reminders.ts` 中选择提醒 `templateParams` 已包含 `count` 和 `deadline`。
- 文档核对：`docs/order-sms-reminders.md` 明确记录触发规则不改，短信正文不写“选择期”只是降低用户理解成本。

上线后观察：

- `/api/sync/order-reminders` 是否持续返回 200。
- `/admin` 短信提醒记录是否写入新文案和新模板参数。
- 阿里云短信是否出现模板变量缺失、模板 Code 错误或发送失败。
- 用户收到短信时，签名为公司名但正文包含 AICHONG，应能明确识别产品来源。

## 本轮整包待测摘要 2026-06-02

给测试线程的简单指令：

```text
请读取 docs/current-release-test-brief.md 的“本轮整包待测摘要 2026-06-02”，按整包范围测试；能修就修，但涉及钱、短信、结算、权限、生产配置的动作先问主人。最后把测试结论写回本节下方的“本轮整包测试结论”小节。
```

### 测试目标

本轮主人希望把当前这些改动作为一个整包进入测试，测试通过后再交上线总控决定是否上线。

本轮不是单一功能上线，包含：

1. 市场动态近 30 天统计规则。
2. 投稿附件预览响应体验。
3. 投稿列表和已采用投稿的展示体验。
4. 订单短信模板更新与规则固化。
5. 项目协作文档、线程启动文档、验证清单。
6. 设计方向文档中文化和图标规则固化。

### 当前版本状态

- 分支：`main`
- 当前 `main` 已领先远端 1 个提交：`4ad162c Use rolling 30 day market stats`。
- 当前工作区还有未提交改动；测试范围以当前本地工作区为准。
- `next-env.d.ts` 是 Next 开发/构建生成文件，不作为业务功能测试范围；测试前后关注 `npm run build` 是否通过即可。

### 本轮涉及文件

- `components/order-console.tsx`
- `app/globals.css`
- `lib/order-reminders.ts`
- `lib/readiness.ts`
- `DESIGN.md`
- `docs/current-release-test-brief.md`
- `docs/deployment-checklist.md`
- `docs/project-handoff.md`
- `docs/release-management.md`
- `docs/aichong-collaboration-constitution.md`
- `docs/current-status.md`
- `docs/decision-log.md`
- `docs/order-sms-reminders.md`
- `docs/thread-handoff-template.md`
- `docs/thread-start.md`
- `docs/validation-checklist.md`
- 已提交但未推送的市场动态文件：`lib/market-activity.ts`、`components/order-console.tsx`、`docs/market-dynamics-rules.md`

### 本轮包含变更

#### 1. 市场动态近 30 天统计

- 首页市场动态右上角：
  - `本月发单` 改为 `近30天发单`。
  - `本月发单额` 改为 `近30天发单额`。
- 近 30 天统计改为滚动 30 天窗口，不再按自然月统计。
- 官方锚点只在仍处于当前 30 天窗口内时参与计算。
- 不修改市场任务展示准入规则。

#### 2. 投稿附件预览响应体验

- 点击可预览附件后应立即打开预览弹窗。
- 文本或未知类型附件先显示 `正在读取附件内容...`。
- 图片附件显示 `正在加载图片预览...`，图片加载完成后展示图片。
- 图片加载失败时，弹窗内提示 `图片预览失败，请下载查看。`
- 不支持在线预览的附件仍提示下载查看。
- 关闭预览弹窗后，旧的未完成预览请求不应回填到新弹窗。

#### 3. 投稿列表和已采用投稿展示

- 已完成订单不再显示“已采用投稿，任务完成”的额外通知卡。
- 已完成订单的投稿列表中，已采用投稿应排在前面并突出显示。
- 未采用投稿在已完成订单里弱化展示。
- 投稿数量、订单状态标签和投稿时间展示样式有调整。
- 采用投稿成功后，前端应即时把选中的投稿标记为已采用，并刷新订单详情。

#### 4. 订单短信模板更新

- 新投稿短信正文改为：

```text
您在AICHONG发布的任务收到新投稿，请进入任务详情查看投稿内容。
```

- 进入选择期提醒和选择期结束前 6 小时提醒共用正文：

```text
您在AICHONG发布的任务已收到${count}份投稿，请在${deadline}前进入任务详情选定投稿，超时将自动退款。
```

- 选择提醒新增 `count` 模板参数，并继续传入 `deadline`。
- `submission_count <= 0` 的订单不会生成选择提醒。
- 阿里云侧只需要 2 个模板 Code；系统仍保留 3 个环境变量，其中两个选择提醒变量填同一个模板 Code。

#### 5. 协作文档和验证清单

- 新增项目协作宪法、当前状态、决策记录、线程启动页、线程交接模板、验证清单。
- 明确红线：钱、短信、结算、权限、生产配置必须先问主人。
- 明确 Harness 第一阶段只做安全检查，不自动触发真实付款、真实短信、真实结算。
- 明确新线程启动和结束时的交接规则。

#### 6. 设计方向和图标规则

- `DESIGN.md` 从英文整理为中文。
- 固化用户侧不暴露才虫内部集成的设计原则。
- 固化图标规则：界面图标应优先来自指定 Figma 图标库 `yWZTSzMR9aC8l9DBljE31C`，不得自行手绘或静默替换。

### 本轮不包含

- 不新增数据库 migration。
- 不修改付款、退款、结算逻辑。
- 不主动触发真实付款。
- 不主动触发真实短信。
- 不主动采用投稿或触发才虫结算。
- 不修改用户订单归属校验、管理员权限范围、附件访问权限。
- 不切换生产 Vercel 环境变量。
- 不操作阿里云、Supabase、才虫、Cron 的生产配置。

### 重点测试路径

基础硬检查：

- `git status --short --branch`
- `git diff --check`
- `npm run lint`
- `npm run build`

浏览器测试：

- 打开首页，确认页面正常渲染，无明显 console error。
- 确认市场动态显示 `今日发单 / 近30天发单 / 近30天发单额 / 累计发单`。
- 登录普通用户后进入历史订单详情。
- 打开有投稿附件的订单：
  - 点击图片附件，弹窗应立即出现加载态，图片加载后显示图片。
  - 点击文本附件，弹窗应立即出现 `正在读取附件内容...`，内容读取后显示文本。
  - 点击不支持预览的附件，提示下载查看。
  - 快速关闭弹窗或切换附件，旧请求不应把内容回填到错误弹窗。
- 打开已完成且有多份投稿的订单：
  - 已采用投稿应排在前面。
  - 已采用投稿有明显标识。
  - 未采用投稿弱化展示。
  - 不应再出现多余的“已采用投稿，任务完成”通知卡。

短信逻辑测试：

- 只做代码和规则验证，不发送真实短信。
- 核对 `lib/order-reminders.ts`：
  - 新投稿提醒文案正确。
  - 选择提醒 `templateParams` 同时包含 `count` 和 `deadline`。
  - `submission_count <= 0` 不生成选择提醒。
  - 进入选择期提醒和 6 小时提醒共用相同短信正文。
- 核对 readiness 和部署文档：
  - 说明阿里云只需 2 个模板 Code。
  - 两个选择提醒环境变量填同一个模板 Code。

文档测试：

- 新线程启动说明能否让测试线程、人类主人快速理解下一步。
- 协作宪法是否清楚写明红线。
- 验证清单是否覆盖钱、短信、权限、结算、生产配置。
- 文档不能暗示 Codex 可以自动触发真实付款、真实短信、真实结算。

### 生产环境待配置

代码部署后，短信模板要生效还需要配置生产环境变量：

```text
ALIYUN_SMS_SUBMISSION_TEMPLATE_CODE=SMS_507080087
ALIYUN_SMS_SELECTION_STARTED_TEMPLATE_CODE=SMS_507405080
ALIYUN_SMS_SELECTION_DEADLINE_TEMPLATE_CODE=SMS_507405080
```

注意：这一步不是测试线程自动执行的动作。生产环境变量切换必须由主人确认后再做。

### 本轮高风险点

- 短信模板变更涉及真实短信成本和用户触达，但本轮测试不能发送真实短信。
- 投稿附件预览仍受才虫附件源站、代理服务器和用户网络影响；本轮只改善“点击后立即反馈”，不保证大附件瞬间加载完成。
- 采用投稿会触发结算风险；测试线程不得为了验证 UI 主动采用真实投稿，除非主人单独明确同意。
- 当前整包包含代码、UI 和文档多类改动，测试线程要明确说明哪些测过、哪些没测过。

### 本轮整包测试结论

```text
测试线程名称：Codex 本地整包测试线程
对应上线摘要：2026-06-02 整包待测摘要
测试环境：本地 main 工作区；Next dev server http://localhost:3000；只读接口和本地浏览器冒烟
测试时间：2026-06-02 11:13 CST

测试范围：
按本节整包范围验证：市场动态近 30 天统计、投稿附件预览响应代码路径、投稿列表和已采用投稿展示代码路径、订单短信模板与触发规则、协作文档和验证清单、DESIGN.md 中文化与图标规则。未触发真实付款、采用投稿、结算、退款、真实短信；未修改生产配置。

通过路径：
- 基础硬检查：git status 显示 main 领先远端 1 个提交且有本轮未提交改动；git diff --check 通过。
- 构建检查：npm run lint 通过，0 个错误，保留 13 条既有 warning；npm run build 通过。
- 本地可达性：http://localhost:3000 首页 200 并可渲染；http://localhost:3000/admin/login 200。
- Readiness：http://localhost:3000/api/health/readiness 返回 ready=true；order_reminder_sms 显示已配置投稿和选择期提醒模板，提醒日志表可读取。
- 市场动态接口：http://localhost:3000/api/platform/activity 返回 todayOrderCount=0、monthOrderCount=33、monthOrderAmount=578.8、totalOrderCount=122；当前 UI 文案显示为 今日发单 / 近30天发单 / 近30天发单额 / 累计发单。
- 市场任务接口：http://localhost:3000/api/platform/market?pageSize=100 返回 12 条；分类数量为发现 12、文案 6、图片 3、声音 2、视频 1；ACTIVE 显示“进行中”，COMPLETED/CLOSED 显示“已完成”。
- 本地浏览器冒烟：首页标题 AICHONG，市场统计和任务列表正常出现，浏览器 error logs 为空；打开公开市场任务详情后同页详情正常展开，error logs 为空。
- 本地测试账号 dev-login 成功；该账号订单列表、订单详情、投稿列表只读接口可返回。测试账号只有 1 个未支付关闭订单，submissionCount=0，无法覆盖有投稿附件订单的真实登录态 UI。
- 近 30 天规则代码/文档核对通过：lib/market-activity.ts 使用滚动 30 天窗口，components/order-console.tsx 显示“近30天发单 / 近30天发单额”，docs/market-dynamics-rules.md 已写明滚动窗口和官方锚点过期规则。
- 短信规则代码/文档核对通过：新投稿短信正文包含 AICHONG 且不统计数量；进入选择期和选择期结束前 6 小时共用选择提醒正文；templateParams 同时包含 count 和 deadline；submissionCount <= 0 不生成选择提醒；部署文档说明两个选择提醒环境变量填同一个模板 Code。
- 附件预览代码路径核对通过：点击预览会先打开 loading 态；文本/未知类型显示“正在读取附件内容...”；图片显示“正在加载图片预览...”；图片失败显示“图片预览失败，请下载查看。”；关闭弹窗后通过 previewRequestSeqRef 防止旧请求回填。
- 已采用投稿展示代码路径核对通过：已完成订单不再生成“已采用投稿，任务完成”的额外通知卡；visibleSubmissions 会把 selected 投稿排在前面；已采用投稿和未采用投稿有不同样式；采用投稿成功后前端有即时选中态和刷新逻辑。
- 文档规则核对通过：协作宪法、线程启动页、交接模板、验证清单均写明钱、短信、结算、权限、生产配置必须先问主人；Harness 第一阶段不自动触发真实付款、真实短信、真实结算；DESIGN.md 写明图标优先使用指定 Figma 图标库 yWZTSzMR9aC8l9DBljE31C。

发现的问题：
未发现需要立即修复的低风险代码问题。

已修复的问题：
无。本轮测试未发现需修复项，仅写回测试结论。

仍未验证：
- 未用真实浏览器登录真实有投稿账号打开“有投稿附件”的历史订单；原因是当前本地测试账号没有投稿和附件，且不擅自越权登录真实手机号。
- 未端到端点击图片、文本、不支持预览三类真实投稿附件；本轮只完成公开页面冒烟和代码路径核对。
- 未主动采用真实投稿验证完成态 UI；采用投稿会触发结算风险，需主人单独确认。
- 未发送真实短信，也未调用订单提醒发送链路；本轮只核对代码、readiness 和文档。
- 未切换 Vercel、阿里云、Supabase、才虫、Cron 的生产配置。
- 未做真实手机端视觉回归。

残留风险：
- 活动接口字段名仍为 monthOrderCount / monthOrderAmount，但当前语义和 UI 已切为近 30 天；这是兼容遗留命名风险。
- 附件最终加载速度仍受才虫附件源站、代理服务和用户网络影响；本轮只验证“立即反馈”的代码路径。
- 短信上线依赖生产环境变量正确配置；模板 Code 或变量填错会导致真实提醒失败。
- 已采用投稿视觉和真实附件预览建议上线前由主人用真实账号人工补测一次。

是否涉及真实付款/结算/短信：否。未触发真实付款、退款、采用投稿、结算或真实短信。
是否改动了代码：否。未修改业务代码；仅写回本测试结论文档。
改动文件：docs/current-release-test-brief.md
验证命令和结果：
- git status --short --branch：main...origin/main [ahead 1]，存在本轮未提交改动。
- git diff --check：通过。
- npm run lint：通过，0 error，13 warning。
- npm run build：通过。
- curl http://localhost:3000/api/health/readiness：ready=true。
- curl http://localhost:3000/api/platform/activity：返回近 30 天统计对应值 33 / 578.8。
- curl http://localhost:3000/api/platform/market?pageSize=100：返回 12 条市场任务，分类计数和状态文案符合预期。
- 本地浏览器：首页、后台登录页、公开市场详情冒烟通过，未发现明显 console error。
- rg 代码/文档规则：短信模板、count/deadline、0 投稿不提醒、附件 loading、防旧请求回填、已采用投稿排序/样式、协作红线、Figma 图标库规则均命中。

是否建议上线：建议补测后上线
一句话理由：基础硬检查、只读接口、公开页面冒烟和关键代码/文档规则均通过；但真实有投稿订单的附件预览、已采用投稿视觉、真实短信发送链路和真实采用投稿结算路径因风险边界未触发，需人工补测后再交上线总控。
```

### 补充测试结论 2026-06-03 运营概览与付款确认体验

```text
测试线程名称：Codex 本地补充测试线程
对应上线摘要：2026-06-03 后台运营概览、付款确认与附件兜底补充测试
测试环境：本地 main 工作区；Next dev server http://localhost:3000；本地 HTTP/HTML 只读验证
测试时间：2026-06-03 11:09 CST

测试范围：
按当前本地未提交改动验证：后台只读运营概览、前台付款确认状态、订单详情超时兜底、附件图片预览失败兜底和不支持预览文件识别。未触发真实付款、采用投稿、结算、退款、真实短信；未修改生产配置。

通过路径：
- 基础硬检查：git diff --check 通过。
- npm run lint 通过，0 error，13 warning；warning 仍为既有 <img> 与 React Hook dependency 提示。
- npm run build 通过。
- 本地 dev server 启动前发现旧 Next dev server 占用 3000 但不可达；已停止旧进程并重启，http://localhost:3000 可正常响应。
- /api/health/readiness 返回 ready=true，所有 readiness items 均为 ok。
- /api/platform/activity 返回当前滚动统计：todayOrderCount=1、monthOrderCount=37、monthOrderAmount=806.8、totalOrderCount=126；说明当前数据已随真实/本地活动变化，不沿用 2026-06-02 旧数值。
- 首页 HTML 返回 200，服务端 HTML 中包含 AICHONG、今日发单、近30天发单、近30天发单额、累计发单等文案。
- 后台登录页 HTML 返回 200，包含运营后台、管理员手机号、验证码、获取验证码、进入后台等文案。
- 同一 cookie 文件下先前台 dev-login 普通用户 13231636325，再后台 admin-login 管理员 18201500661；cookie 同时存在 Path=/ 的 dev_phone 和 Path=/admin 的 admin_phone。
- 同一 cookie 下 /api/me 仍返回普通用户 13231636325，后台登录没有覆盖前台身份。
- 同一 cookie 下 /admin 返回 200，后台 HTML 中新增 AICHONG 运营概览、用户增长、任务发布、投稿与履约、近期活跃、近30天发单用户、需提醒采用等模块。
- 后台运营概览说明文案明确为只读统计，基于后台本地真实用户和已关联真实才虫任务的 AICHONG 订单，不包含旧测试单。
- 前台代码路径核对通过：付款后显示“正在确认付款结果/正在努力确认结果”，慢确认时提供“刷新状态”；订单详情 fetch 增加 8 秒超时并显示“读取超时，请点击刷新重试”；图片预览失败显示“图片预览失败，请下载查看。”；psd/ai/fig/sketch/xd 识别为不支持在线预览。

发现的问题：
- Browser 工具访问本地 URL 被工具安全策略拦截，因此未能完成可视化截图和浏览器 console error 检查。本轮改用本地 HTTP/HTML、接口和代码路径核对。

已修复的问题：
无。本轮测试未发现需要修业务代码的问题；仅恢复 next dev 造成的 next-env.d.ts 生成文件漂移。

仍未验证：
- 未完成真实浏览器可视回归和 console error 检查，原因是 Browser 工具拒绝访问本地 URL。
- 未端到端模拟真实付款返回后的支付确认状态变化；避免触发真实付款。
- 未用真实有投稿附件订单端到端点击图片、文本和不支持预览附件。
- 未主动采用真实投稿验证完成态 UI；采用投稿会触发结算风险，需主人单独确认。
- 未发送真实短信，也未切换 Vercel、阿里云、Supabase、才虫、Cron 的生产配置。
- 未做真实手机端视觉回归。

残留风险：
- 后台“今日”统计当前按 24 小时窗口计算，不是自然日零点口径；如果上线总控要求自然日口径，需要单独确认后改。
- 浏览器工具未能进入页面，视觉布局、客户端 hydration 后状态和 console error 仍建议主人或上线总控用真实浏览器补看一次。
- 付款确认体验仍依赖才虫支付状态同步和用户实际支付回跳；本轮只覆盖本地代码路径和只读页面。
- 附件最终加载速度仍受才虫附件源站、代理服务和用户网络影响。

是否涉及真实付款/结算/短信：
否。未触发真实付款、退款、采用投稿、结算或真实短信。

是否改动了代码：
否。未修改业务代码；仅写回本测试结论文档。next-env.d.ts 的 dev server 副作用已恢复。

改动文件：
docs/current-release-test-brief.md

验证命令和结果：
- git status --short --branch：main...origin/main，存在本轮未提交改动。
- git diff --check：通过。
- npm run lint：通过，0 error，13 warning。
- npm run build：通过。
- curl http://localhost:3000/api/health/readiness：ready=true，所有 items ok。
- curl http://localhost:3000/api/platform/activity：todayOrderCount=1、monthOrderCount=37、monthOrderAmount=806.8、totalOrderCount=126。
- curl http://localhost:3000、curl http://localhost:3000/admin/login：均返回 200。
- curl dev-login/admin-login + /api/me + /admin：前后台 cookie 隔离通过，/admin 返回 200。
- rg /tmp/aichong-admin.html：后台运营概览关键文案命中。
- rg components/order-console.tsx：付款确认、详情超时、图片失败、设计文件不支持预览等关键代码路径命中。

是否建议上线：建议补测后上线
一句话理由：基础硬检查、readiness、登录隔离、后台运营概览服务端渲染和关键代码路径均通过；但真实浏览器可视/console、真实付款确认、真实附件预览、真实采用投稿和真实短信链路仍未验证，应交上线总控或主人补测高风险/真实场景。
```

### 收口测试摘要 2026-06-05 后台运营统计

```text
测试线程名称：Codex 本地后台运营统计收口线程
对应上线摘要：2026-06-05 后台 AICHONG 运营统计收口测试
测试环境：本地 main 工作区；Next dev server http://localhost:3000；本地管理员登录只读验证
测试时间：2026-06-05 14:11 CST

测试范围：
本次只收口后台 /admin 新增的 AICHONG 运营统计：用户增长、任务发布、投稿与履约、近期活跃。统计基于后台已读取的本地真实用户和已关联真实才虫任务的 AICHONG 订单，排除旧测试单。未触发真实付款、采用投稿、结算、退款、真实短信；未修改生产配置。

通过路径：
- git diff --check 通过。
- npm run lint 通过，0 error，13 warning；warning 为既有 <img> 与 React Hook dependency 提示。
- npm run build 通过，/admin 仍为动态服务端页面。
- 本地管理员登录接口 POST /api/admin/login 使用管理员手机号 18201500661 和本地开发验证码 123456 返回成功。
- 同一临时 cookie 访问 /admin 返回 HTTP 200。
- /admin 服务端 HTML 命中 AICHONG 运营概览、只读统计、用户增长、任务发布、投稿与履约、近期活跃、近7天新增、近30天新增、注册到发单、近30天发单用户等关键文案。
- 当前后台统计渲染出的关键值：总注册用户 6、今日新增 0、近7天新增 0、近30天新增 6、注册到发单 100%、总任务 22、近7天下单 4、近30天下单 21、已进入发布状态 9、待选择 1、需提醒采用 1。
- 后台运营统计说明文案明确为只读统计，基于后台本地真实用户和已关联真实才虫任务的 AICHONG 订单，不包含旧测试单。

发现的问题：
- 当前工作区除后台运营统计外，还有多处未提交改动：前台页面、多个 API route、order-console、market nav、Supabase server、package.json、logo 资源和 scripts/check-ui-regressions.mjs。它们不是本次后台统计收口新增，需上线总控单独复核归因。
- /admin 异常日志中仍可见 task.detail warn、heartbeat.user warn、task.list error 等历史/当前外部同步问题。本次统计页面能渲染，但这些日志说明才虫详情/用户心跳仍可能存在外部服务或数据同步波动。

已修复的问题：
无。本轮收口未修改业务代码，只写回本测试摘要。

仍未验证：
- 未做真实浏览器登录后的视觉截图和 console error 检查；本轮以本地 HTTP/HTML 和构建检查为主。
- 未验证线上 /admin。
- 未验证真实付款、采用投稿、结算、退款或真实短信。
- 未验证前台未提交改动的完整回归；本次只覆盖后台运营统计。

残留风险：
- 后台“今日/近7天/近30天”目前按 24 小时窗口计算，不是中国自然日零点口径；如需自然日口径需单独确认后改。
- 后台运营统计依赖当前 listAdminOrders/listAdminUsers 已读取数据，适合当前运营观察；如果未来订单/用户量明显增大，应改为专门的后台聚合查询。
- 工作区存在多处未归因改动，不建议只凭本次后台统计收口直接整包上线。

是否涉及真实付款/结算/短信：
否。未触发真实付款、退款、采用投稿、结算或真实短信。

是否改动了代码：
否。本轮收口未改代码；仅写回测试摘要。工作区已有代码改动保持原样。

改动文件：
docs/current-release-test-brief.md

验证命令和结果：
- git diff --check：通过。
- npm run lint：通过，0 error，13 warning。
- npm run build：通过。
- curl POST http://127.0.0.1:3000/api/admin/login：返回管理员用户 18201500661。
- curl http://127.0.0.1:3000/admin：HTTP_STATUS:200。
- rg /tmp/aichong-admin-20260605.html：后台运营统计关键文案命中。
- git status --short：显示当前工作区有多处未提交改动，包含 app/admin/page.tsx、app/globals.css、docs/current-release-test-brief.md 以及其他前台/API/资源文件。

是否建议上线：建议补测后上线
一句话理由：后台运营统计本地只读渲染和硬检查通过；但当前工作区混有多处未归因改动，且线上后台、真实浏览器视觉/console、高风险资金/短信/结算链路未验证，不建议仅凭本轮摘要直接整包上线。
```

### 收口测试摘要 2026-06-05 首页市场动态筛选与排布

```text
测试线程名称：Codex 本地首页市场动态收口线程
对应上线摘要：2026-06-05 首页市场动态 tab 交互、数量隐藏与卡片排布修复
测试环境：本地 main 工作区；Next dev server http://localhost:3000；本地接口和内置浏览器冒烟
测试时间：2026-06-05 14:30 CST

测试范围：
本次只收口首页市场动态区域：分类 tab 隐藏数量统计、tab 切换不再每次重新请求市场接口、卡片排布从 CSS columns 改为 grid，修复图片/视频分类少量卡片时纵向堆叠像 bug 的问题。未触发真实付款、采用投稿、结算、退款、真实短信；未修改生产配置。

通过路径：
- git diff --check 通过。
- npm run lint 通过，0 error，13 warning；warning 为既有 <img> 与 React Hook dependency 提示。
- npm run build 通过。
- next-env.d.ts 无生成差异。
- 本地服务 http://localhost:3000 可访问，HEAD / 返回 200。
- /api/platform/activity 返回当前市场统计：todayOrderCount=0、monthOrderCount=37、monthOrderAmount=806.8、totalOrderCount=126。
- /api/platform/market?pageSize=20 返回 total=16；分类计数为发现 16、文案 7、图片 4、声音 3、视频 2。注意：接口仍保留 count 给内部数据使用，但首页 tab UI 已不展示这些数量。
- 浏览器打开首页成功，页面标题为 AICHONG，包含“今天想做点什么？”。
- 首页分类 tab 文案为发现、文案、图片、声音、视频；DOM 中 .home-market-category-tabs button small 数量为 0，确认数量统计已从首页 tab 隐藏。
- 浏览器点击“图片”tab 后，active=图片，显示 4 张卡片，坐标为 2 列 x 2 行。
- 浏览器点击“视频”tab 后，active=视频，显示 2 张卡片，坐标为同一行左右排列，不再竖向堆在左侧。
- 浏览器 console error 检查为空。
- 代码核对：components/order-console.tsx 中首页 tab 切换改为本地 setActiveCategory + initialFeed.items 过滤，不再在 changeCategory 内 fetch /api/platform/market。
- 代码核对：app/globals.css 中 .home-market-card-grid 使用 CSS grid，首页卡片取消 columns 的向下填充行为。

发现的问题：
- 首页市场动态首屏数据仍依赖首次接口/服务端数据加载；浏览器冒烟中卡片从 0 到展示需要等待数秒。tab 切换本身已本地化，但“首页第一次加载市场动态慢”如果要进一步优化，需要单独做首屏 loading/缓存/骨架屏方案。
- 当前工作区仍有多处未提交改动，包含后台、前台 API、order-console、资源文件和脚本。本摘要只覆盖首页市场动态筛选与排布，不替其他改动给出上线结论。

已修复的问题：
- 首页市场动态 tab 上的数量统计已隐藏。
- tab 切换慢的问题已缩小到本地筛选，不再每次点击都重新请求市场接口。
- 图片/视频分类少量卡片时的瀑布流式竖向堆叠已改为 grid 排布。

仍未验证：
- 未验证线上首页。
- 未验证真实手机 Safari；本轮使用本地内置浏览器做窄屏冒烟。
- 未验证真实付款、采用投稿、结算、退款或真实短信。
- 未验证当前工作区其他未归因改动的完整整包回归。

残留风险：
- 首页市场动态首屏接口慢时，用户仍可能短暂看到空态或等待卡片出现；本轮修复的是 tab 切换和排布，不包含首屏数据加载性能专项。
- 当前工作区混有多处未提交改动，不建议只凭本摘要直接整包上线。

是否涉及真实付款/结算/短信：
否。未触发真实付款、退款、采用投稿、结算或真实短信。

是否改动了代码：
是。本轮相关代码改动在 components/order-console.tsx 和 app/globals.css；本摘要写回 docs/current-release-test-brief.md。工作区其他既有改动保持原样。

改动文件：
- components/order-console.tsx
- app/globals.css
- docs/current-release-test-brief.md

验证命令和结果：
- git diff --check：通过。
- npm run lint：通过，0 error，13 warning。
- npm run build：通过。
- curl -sI http://localhost:3000：HTTP 200。
- curl -s http://localhost:3000/api/platform/activity：返回 todayOrderCount=0、monthOrderCount=37、monthOrderAmount=806.8、totalOrderCount=126。
- curl -s 'http://localhost:3000/api/platform/market?pageSize=20'：返回 total=16，categories count 为 16/7/4/3/2。
- Browser 首页冒烟：分类数量未展示；图片 4 张为 2x2；视频 2 张同一行；console error 为空。

是否建议上线：建议补测后上线
一句话理由：首页市场动态 tab 切换、数量隐藏和卡片排布本地验证通过；但首屏市场数据加载仍可能慢，且当前工作区混有多处未归因改动，仍需上线总控按整包范围复核。
```

## 本轮待测摘要 2026-06-05 当前未提交功能包

给测试线程的简单指令：

```text
请读取 docs/current-release-test-brief.md 的“本轮待测摘要 2026-06-05 当前未提交功能包”，按整包范围测试；能修小问题就修，但涉及钱、短信、结算、权限、生产配置的动作先问主人。最后把测试结论写回本节下方的“本轮整包测试结论”小节。
```

### 上线总控当前结论

上线结论：需补测后上线。

说明：
- 当前结论不是“可上线”，也不触发部署、提交、推送或生产配置变更。
- 本轮本地硬检查和局部收口摘要已有通过记录，但当前工作区仍是混合包，必须按整包复测后再做最终上线判断。
- 本轮收口不改业务代码；仅把交接摘要整理成测试线程可执行的待测摘要。

### 本轮版本状态

- 分支：`main`
- 当前提交：`afc25d1 Prepare release bundle updates`
- 当前 `main` 与 `origin/main` 对齐，没有本地领先提交。
- 当前工作区有未提交改动，测试范围以当前本地工作区为准。
- 当前未提交改动包含后台、首页、前台订单、多个 API route、资源文件、脚本和文档，不能按单一功能直接上线。

### 本轮包含变更

1. 后台运营统计
- `/admin` 新增 AICHONG 运营概览。
- 展示用户增长、任务发布、投稿与履约、近期活跃等只读统计。
- 统计基于后台本地真实用户和已关联真实才虫任务的 AICHONG 订单；不包含旧测试单。

2. 首页市场动态体验
- 首页市场动态首屏读取增加快速兜底和客户端补充读取。
- 分类 tab 改为本地筛选，不再每次点击都重新请求市场接口。
- 首页分类 tab 隐藏数量统计。
- 市场卡片排布从 CSS columns 改为 grid，避免图片/视频分类少量卡片纵向堆叠。
- 底部发布小窗口临时隐藏，用于先验证首页体验；这不是删除发布入口的最终产品决定。

3. 付款与订单详情体验
- 付款后展示 `正在确认付款结果` / `正在努力确认结果`。
- 慢确认时提供 `刷新状态`。
- 订单详情读取增加超时兜底；已有本地任务可展示时，不再显示“已先显示本地订单”的红色错误条。
- 详情读取仍应保留本地已有任务信息，避免页面误落空态。

4. 投稿与附件读取
- 投稿读取改为本地优先，可通过 `refresh=1` 显式远程刷新。
- 投稿附件可通过 `includeAttachments=1` 按需补水。
- `submissionCount > 0` 时，空投稿数组不能作为有效缓存。
- 投稿列表读取期间显示 `正在读取投稿...`。
- 设计类文件识别为不支持在线预览。
- 图片预览失败提示 `图片预览失败，请下载查看。`
- 附件上传取消后，不应残留附件说明或浏览器原生“未选择任何文件”提示。

5. API 读取策略
- `/api/platform/activity` 支持 `sync=0`，用于只读读取市场统计时不主动触发同步。
- `/api/platform/market` 支持 `sync=0`，用于只读读取市场列表时不主动触发同步。
- `/api/tasks` 支持 `refresh=1` 显式刷新；默认优先读取本地订单分页，减少列表页被远程刷新拖慢。
- `/api/tasks/[taskId]/submissions` 支持 `refresh=1` 和 `includeAttachments=1`。
- `/api/me` 不再在读取当前用户时顺带写用户资料；登录接口仍负责写入用户资料。
- Supabase service client 增加模块级复用，减少重复创建。

6. 本地回归和资源
- 新增 `npm run test:regression`，当前用于拦截兜底错误条文案再次进入 UI。
- logo SVG 增加渲染精度属性并补齐文件结尾换行；logo 锯齿问题已暂停，不建议作为本轮上线验收条件。
- 市场导航中 `发任务` 改为 `发布任务`。

### 本轮不包含

- 不新增数据库 migration。
- 不新增生产环境变量。
- 不修改付款、退款、结算、采用投稿或短信触发规则。
- 不主动触发真实付款。
- 不主动采用投稿或触发财虫结算。
- 不主动发送真实短信。
- 不切换 Vercel、阿里云、Supabase、才虫、Cron 或 GitHub 的生产配置。
- 不把 logo 视觉最终效果作为本轮上线硬条件。

### 本轮涉及文件

- `app/admin/page.tsx`
- `app/page.tsx`
- `app/api/me/route.ts`
- `app/api/platform/activity/route.ts`
- `app/api/platform/market/route.ts`
- `app/api/tasks/route.ts`
- `app/api/tasks/[taskId]/submissions/route.ts`
- `components/order-console.tsx`
- `components/static-market-nav.tsx`
- `app/globals.css`
- `lib/order-repository.ts`
- `lib/supabase/server.ts`
- `package.json`
- `scripts/check-ui-regressions.mjs`
- `public/logo.svg`
- `public/logo-mark.svg`
- `docs/current-release-test-brief.md`
- `docs/release-management.md`
- `docs/thread-start.md`
- `docs/thread-handoff-template.md`

### 已有验证记录

- `git diff --check`：通过。
- `npm run test:regression`：通过。
- `npm run lint`：通过，0 error，13 warning；warning 为既有 `<img>` 与 React Hook dependency 提示。
- 既有收口记录显示 `npm run build` 通过。
- 后台运营统计本地只读验证通过：本地管理员登录后 `/admin` 返回 200，服务端 HTML 命中 AICHONG 运营概览、用户增长、任务发布、投稿与履约、近期活跃等文案。
- 首页市场动态本地冒烟通过：分类数量隐藏，图片分类 4 张为 2x2，视频分类 2 张同一行，浏览器 console error 为空。
- 代码核对通过：付款确认、详情超时、图片失败、设计文件不支持预览、首页本地 tab 筛选、市场卡片 grid、兜底错误条禁用文案均已覆盖。

### 本轮重点测试路径

基础硬检查：
- `git status --short --branch`
- `git diff --check`
- `npm run test:regression`
- `npm run lint`
- `npm run build`

后台只读验证：
- 本地管理员登录 `/admin`。
- 确认运营概览正常渲染，且文案说明为只读统计。
- 核对用户增长、任务发布、投稿与履约、近期活跃模块不遮挡、不重叠。
- 核对后台日志是否仍有高频 `task.detail`、`heartbeat.user`、`task.list` 异常。

首页市场动态验证：
- 打开首页，确认首屏可用，不出现长时间空白。
- 确认市场统计显示为 `今日发单 / 近30天发单 / 近30天发单额 / 累计发单`。
- 确认分类 tab 只显示 `发现 / 文案 / 图片 / 声音 / 视频`，不显示数量。
- 切换图片和视频分类，确认卡片按 grid 横向/网格排布，不再纵向堆叠。
- 确认 tab 切换不再每次请求 `/api/platform/market`。
- 检查浏览器 console error。

前台订单和付款验证：
- 普通用户登录后，历史任务列表默认能从本地分页读取。
- 点击刷新或进入需要刷新场景时，`refresh=1` 能触发远程刷新。
- 待支付任务显示付款确认状态；慢确认时出现 `刷新状态`。
- 真实支付完成后的状态同步只在主人确认允许低金额测试后验证。
- 订单详情远程读取超时时，应保留本地已有任务信息，不出现红色兜底错误条。

投稿和附件验证：
- 有投稿任务进入详情后，投稿列表应从本地优先显示。
- `submissionCount > 0` 但本地投稿为空时，不能停在“无投稿”状态，应继续读取或提示读取中。
- 点击刷新投稿时，`refresh=1` 应按需远程刷新。
- 点击需要附件的投稿时，`includeAttachments=1` 应按需补水附件。
- 图片附件预览失败应显示下载查看提示。
- 设计类文件应提示不支持在线预览。
- 附件上传取消后，不应残留附件说明或浏览器原生“未选择任何文件”提示。

权限和数据边界验证：
- `/api/tasks` 和 `/api/tasks/[taskId]/submissions` 仍只能返回当前用户自己的订单和投稿。
- 普通用户不能看到其他用户订单、投稿或附件。
- 后台入口仍受 `ADMIN_PHONES` 控制。
- `/api/me` 取消读取时写 profile 后，登录、退出、重新登录和后台用户统计仍正常。

### 本轮高风险点

- 当前工作区是混合包，必须先确认每个文件归属，不能把局部通过当成整包通过。
- `sync=0`、`refresh=1`、`includeAttachments=1` 改变读取策略和同步时机，需要重点验证不会导致订单、投稿或附件长期不刷新。
- 后台“今日/近7天/近30天”按 24 小时窗口计算，不是中国自然日零点口径；如需自然日口径，需要主人确认后单独改。
- 真实付款完成后的状态同步仍依赖才虫支付状态和回跳；本轮不能未经确认触发真实付款。
- 真实采用投稿会触发结算风险，测试线程不得主动采用真实投稿。
- 真实短信不在本轮测试中主动发送。
- logo SVG 微调未完成最终视觉确认，不建议纳入本轮上线验收重点。

### 本轮整包测试结论

```text
测试线程名称：Codex 本地整包复测线程
对应上线摘要：2026-06-05 当前未提交功能包
测试环境：本地 main 工作区；Next dev server http://localhost:3000；本地 HTTP/API、内置浏览器冒烟和代码路径核对
测试时间：2026-06-05 15:18 CST

测试范围：
按“本轮待测摘要 2026-06-05 当前未提交功能包”做整包复测，覆盖基础硬检查、readiness、后台运营统计、首页市场动态、订单/投稿/附件 API 读取策略、权限边界和关键 UI 文案代码路径。未触发真实付款、采用投稿、结算、退款、真实短信或生产配置变更。

通过路径：
- `git status --short --branch` 确认为 `main...origin/main`，当前工作区仍是混合未提交改动包。
- `git diff --check` 通过。
- `npm run test:regression` 通过，确认禁止文案“已先显示本地订单”未进入 UI。
- `npm run lint` 通过，0 error，13 warning；warning 为既有 `<img>` 与 React Hook dependency 提示。
- `npm run build` 通过，Next.js 生产构建成功。
- `/api/health/readiness` 返回 `ready=true`，才虫真实接口、Supabase、核心表、operation logs、`ADMIN_PHONES`、`CRON_SECRET`、`ORDER_REMINDER_CRON_SECRET`、开发登录、真实短信登录和订单短信提醒均为 ok。
- 管理员本地登录接口 `POST /api/admin/login` 成功返回管理员用户 `18201500661`；`/admin` 返回 HTTP 200。
- 浏览器后台登录页点击“获取验证码”后显示“开发环境可直接输入验证码 123456”，并自动填入 `123456`；随后服务端日志显示 `POST /api/admin/login` 200、`GET /admin` 200。
- 浏览器打开 `/admin` 成功，命中 AICHONG 运营概览、只读统计、用户增长、任务发布、投稿与履约、近期活跃；4 个运营统计模块无显著重叠，console error 为空。
- 后台日志区域仍展示 `task.detail` warn、`heartbeat.user` warn、`task.list` error，风险已记录。
- `/api/platform/activity?sync=0` 返回 `todayOrderCount=0`、`monthOrderCount=37`、`monthOrderAmount=806.8`、`totalOrderCount=126`。
- `/api/platform/market?pageSize=20&sync=0` 返回 `total=16`，分类计数为发现 16、文案 7、图片 4、声音 3、视频 2。
- 浏览器首页打开成功，标题为 AICHONG，包含“今天想做点什么？”；统计展示为今日发单 0、近30天发单 37、近30天发单额 ¥807、累计发单 126。
- 首页分类 tab 只显示发现、文案、图片、声音、视频；`.home-market-category-tabs button small` 数量为 0。
- 浏览器点击“图片”tab 后 `active=图片`，显示 4 张卡片，坐标为 2 列 x 2 行；点击“视频”tab 后 `active=视频`，显示 2 张卡片，左右同一行；console error 为空。
- dev server 日志中，首页加载触发 `/api/platform/market?pageSize=48&sync=0`；本轮观察到点击分类 tab 后未追加新的 `/api/platform/market` 请求。
- 普通用户本地开发登录接口 `POST /api/auth/dev-login` 成功返回用户 `13231636325`；`/api/me` 返回同一普通用户。
- `/api/tasks?page=1&pageSize=10` 默认返回 `source=supabase`、`total=7`，验证历史任务列表默认本地分页读取。
- `/api/tasks?page=1&pageSize=10&refresh=1` 返回 `source=supabase`、`total=7`，并补回可刷新任务的附件信息，验证显式刷新路径可用。
- `/api/tasks/eba1ff03-9707-4b44-a426-00c564bf1002` 返回 200，保留本地任务描述、付款链接、附件和 `submissionCount=1`。
- `/api/tasks/eba1ff03-9707-4b44-a426-00c564bf1002/submissions` 默认返回 1 条投稿，`source=supabase`，未停在“无投稿”。
- `/api/tasks/eba1ff03-9707-4b44-a426-00c564bf1002/submissions?refresh=1` 返回 1 条投稿并保留附件信息。
- `/api/tasks/eba1ff03-9707-4b44-a426-00c564bf1002/submissions?includeAttachments=1` 返回 1 条投稿和 2 个附件，包含 `submission.md` 与 `suspense_audiobook.mp3`。
- `/api/tasks/10a03ffe-6cf5-4d97-b235-f25650ad24cb/submissions` 返回 2 条投稿，验证 `submissionCount > 0` 的本地投稿不为空。
- 其他普通用户 `13800000000` 的 `/api/tasks?page=1&pageSize=10` 返回 `total=0`；读取 `13231636325` 的订单详情返回 404；读取该订单投稿返回 404，权限边界通过。
- 代码路径核对：`/api/me` 只调用 `getCurrentUser`，不再在读取当前用户时写 profile。
- 代码路径核对：付款确认文案“正在确认付款结果 / 正在努力确认结果 / 刷新状态”存在。
- 代码路径核对：投稿读取中展示“正在读取投稿...”；图片预览失败提示“图片预览失败，请下载查看。”；设计/不支持预览附件提示“暂不支持在线预览，请下载查看。”。
- 代码路径核对：主发布框和紧凑发布框的附件 input 在 `onChange` 后都会执行 `input.value = ""` 和 `input.blur()`，用于避免取消选择后残留浏览器原生文件名。

发现的问题：
未发现需要本测试线程立即修改业务代码的问题。
- 首页首屏市场接口仍可能慢：浏览器服务端日志中 `activity?sync=0` 约 3.9-5.0s，`market?pageSize=48&sync=0` 约 2.8-10.8s。本轮确认 tab 切换本地化，但首屏市场数据加载性能仍需观察。
- 后台异常日志仍有较多 `task.detail` warn，并可见 `heartbeat.user` warn、`task.list` error；后台页面可正常渲染，但外部才虫详情/用户心跳/用户创建仍存在波动记录。

已修复的问题：
无。本轮未修改业务代码，仅按要求写回测试摘要。

仍未验证：
- 未验证线上 `/admin`、线上首页、线上 readiness、线上真实浏览器 console。
- 未做真实手机 Safari / 微信内置浏览器回归。
- 未在浏览器内完成普通用户登录后的前台订单详情视觉回归；为避免触发真实短信，本轮普通用户链路以本地开发登录接口的 HTTP/API 验证为主。
- 未打开真实支付链接，未做真实付款完成后的状态同步验证。
- 未主动采用真实投稿，未触发财虫结算。
- 未发送真实短信。
- 未验证真实图片预览失败场景的浏览器 UI，只核对了失败提示代码路径。
- 未验证 logo 最终视觉效果；logo SVG 微调不作为本轮上线硬条件。

残留风险：
- 当前工作区仍是混合未提交功能包，包含后台、首页、订单/API、资源、脚本和文档，不能把局部通过直接当成整包可上线。
- `sync=0`、`refresh=1`、`includeAttachments=1` 的本地和显式刷新路径本轮通过，但上线后仍需观察是否有订单、投稿或附件长期不刷新的情况。
- 真实付款状态同步、真实采用投稿结算、真实短信都属于高风险链路，本轮按规则未触发，仍需主人单独确认后补测。
- 后台运营统计当前仍按 24 小时窗口计算“今日/近7天/近30天”，不是中国自然日零点口径；如需改口径需主人单独确认。
- 首页首屏市场数据加载仍受接口/服务端读取影响，慢时可能短暂空态；本轮主要验证 tab 切换和排布。

是否涉及真实付款/结算/短信：
否。未触发真实付款、退款、采用投稿、才虫结算或真实短信；未修改生产配置。

是否改动了代码：
否。未改业务代码；仅写回本测试摘要。

改动文件：
`docs/current-release-test-brief.md`

验证命令和结果：
- `git status --short --branch`：`main...origin/main`，存在本轮混合未提交改动。
- `git diff --check`：通过。
- `npm run test:regression`：通过。
- `npm run lint`：通过，0 error，13 warning。
- `npm run build`：通过。
- `curl -sI http://localhost:3000`：HTTP 200。
- `curl /api/health/readiness`：`ready=true`，全部检查项 ok。
- `curl POST /api/admin/login`：返回管理员用户 `18201500661`。
- `curl /admin`：HTTP_STATUS:200，HTML 命中后台运营统计关键文案。
- Browser `/admin/login`：本地验证码提示和自动填入 `123456` 通过；`/admin` 浏览器渲染通过，console error 为空。
- `curl /api/platform/activity?sync=0`：返回 0 / 37 / 806.8 / 126。
- `curl /api/platform/market?pageSize=20&sync=0`：返回 `total=16`，分类 16/7/4/3/2。
- Browser 首页：分类数量隐藏；图片 4 张为 2x2；视频 2 张同一行；console error 为空。
- `curl POST /api/auth/dev-login`：返回普通用户 `13231636325`。
- `curl /api/me`：返回普通用户 `13231636325`。
- `curl /api/tasks?page=1&pageSize=10`：`source=supabase`，`total=7`。
- `curl /api/tasks?page=1&pageSize=10&refresh=1`：`source=supabase`，`total=7`，附件信息可补回。
- `curl /api/tasks/eba1ff03-9707-4b44-a426-00c564bf1002`：HTTP 200，`submissionCount=1`。
- `curl /api/tasks/eba1ff03-9707-4b44-a426-00c564bf1002/submissions`：1 条投稿，`source=supabase`。
- `curl /api/tasks/eba1ff03-9707-4b44-a426-00c564bf1002/submissions?refresh=1`：1 条投稿，附件信息保留。
- `curl /api/tasks/eba1ff03-9707-4b44-a426-00c564bf1002/submissions?includeAttachments=1`：1 条投稿，2 个附件。
- `curl /api/tasks/10a03ffe-6cf5-4d97-b235-f25650ad24cb/submissions`：2 条投稿。
- `curl` 其他用户读取 `13231636325` 的订单详情和投稿：均返回 404。

是否建议上线：建议补测后上线
一句话理由：
本地整包硬检查、后台、首页、订单/投稿/附件 API 和权限边界验证通过；但当前仍是混合未提交包，且线上、真机、真实付款状态同步、真实采用投稿结算和真实短信均未验证，建议交上线总控继续补测后再做最终上线判断。
```

### 上线总控最终判断 2026-06-05 当前未提交功能包

```text
上线结论：可上线，带观察。
判断时间：2026-06-05 15:53 CST

判断依据：
- 主人已明确下达“上线”指令。
- 已补读 `docs/thread-start.md`、`docs/release-management.md`、`docs/current-release-test-brief.md`、`docs/validation-checklist.md`、`docs/aichong-collaboration-constitution.md` 和 `docs/decision-log.md`。
- 测试线程已完成本轮整包复测，未发现需要立即修复的业务代码问题。
- 上线总控复核硬门槛：`git diff --check` 通过，`npm run test:regression` 通过，`npm run lint` 通过且 0 error / 13 warning，`npm run build` 通过。
- 本轮权限边界已有本地 API 验证：其他普通用户读取本轮验证账号的订单详情和投稿均返回 404。
- 本轮未新增数据库 migration，未新增生产环境变量。
- 本轮不改变付款、退款、结算、采用投稿或短信触发规则。

接受带观察上线的原因：
- 未验证的真实付款状态同步、真实采用投稿结算、真实短信，均属于需要主人单独确认的高风险真实动作；本轮上线不主动触发这些动作。
- 线上首页、线上后台、线上 readiness 和真实浏览器 console 只能在部署后观察，本轮列为上线后观察项。
- 当前混合工作区已由 `docs/release-management.md` 和本文档归并成一个本轮功能包，不再按未归因散包处理。

上线后观察：
- 线上首页是否正常展示市场动态，是否出现长时间空态。
- 线上 `/admin` 是否正常加载 AICHONG 运营概览。
- 线上 `/api/health/readiness` 是否 ready。
- 投稿列表、附件预览、订单详情是否出现高频 4xx/5xx 或超时。
- 付款后慢确认时，用户是否能看到确认中状态和刷新状态入口。
- operation logs 是否出现高频 `task.detail`、`heartbeat.user`、`task.list`、市场接口或投稿附件错误。

本轮仍不触发：
- 真实付款。
- 真实采用投稿或才虫结算。
- 真实短信。
- 生产环境变量或第三方生产配置修改。
```
