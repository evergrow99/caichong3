# Current Release Test Brief

给测试线程的简单指令：

```text
请读取 docs/current-release-test-brief.md，按本轮待测范围测试；能修就修，最后把测试结论写回本文件的“本轮测试结论”小节。
```

## 上线摘要名称

2026-05-25 投稿附件下载响应体验修复待测版本

## 本轮上线总控摘要

本轮重点验证：

- 投稿附件点击下载后，前端不再等待完整文件变成 blob 后才触发下载。
- 点击下载按钮后，应立即看到 `正在开始下载` 提示，并进入浏览器原生下载流程。
- 当前被点击的附件下载按钮只短暂禁用，约 1.2 秒后恢复。
- 投稿附件预览能力不应受影响。
- 下载代理仍只允许才虫附件域名，不应放开任意 URL 下载。
- 中文文件名下载响应头应同时包含 ASCII 兜底文件名和 `filename*` UTF-8 文件名。
- 本轮不主动触发真实付款、采用投稿、结算、退款、短信。

## 本轮版本状态

- 分支：`main`
- 当前状态：本地 `main` 领先 `origin/main` 1 个提交；本轮附件下载修复仍是未提交改动。
- 测试范围以当前本地工作区为准。
- 如果测试线程只能读取远端代码，需要先说明无法覆盖本轮未提交改动，不能直接按远端结论上线。

## 本轮涉及文件

- `app/api/download/submission-attachment/route.ts`
- `components/order-console.tsx`
- `docs/release-management.md`
- `docs/current-release-test-brief.md`

## 本轮主要变更

1. 投稿附件下载体验
- 旧逻辑：前端先 `fetch` 下载完整附件，转成 blob，再创建本地 object URL 触发下载。
- 新逻辑：前端点击后立即创建 `<a>`，把同源下载代理 URL 交给浏览器处理。
- 用户点击后立即显示 `正在开始下载`。
- 只短暂禁用当前附件下载按钮，避免用户连续点击。
- 页面不再因为大附件 blob 生成而承担明显等待和内存压力。

2. 下载代理响应头
- 保留才虫附件域名白名单校验。
- 保留服务端流式转发，不把文件先完整读入前端。
- `Content-Disposition` 增加：
  - `filename="ASCII 兜底名"`
  - `filename*=UTF-8''中文文件名编码`
- 目标是提升中文附件名在主流浏览器下载保存时的兼容性。

3. 不变范围
- 不改投稿同步。
- 不改订单状态。
- 不改附件预览读取逻辑。
- 不改真实付款、采用投稿、结算、退款。
- 不改短信提醒。

## 本轮重点测试路径

- `npm run build` 必须通过。
- `git diff --check` 必须通过。
- 建议执行 `npm run lint`，允许既有 warning，但不能有 error。
- 打开一个包含投稿附件的订单详情。
- 点击投稿附件的下载按钮：
  - 页面应立即出现 `正在开始下载`。
  - 当前按钮应短暂禁用后恢复。
  - 浏览器应进入下载流程，不能长时间表现为“点了没反应”。
- 重复点击不同附件，确认不会相互长期锁死。
- 点击附件行本身，确认预览仍可打开。
- 使用真实才虫附件 URL 验证下载代理：
  - `disposition=attachment` 应返回 `Content-Disposition: attachment; ... filename*=UTF-8''...`。
  - `disposition=inline` 应返回 `Content-Disposition: inline; ... filename*=UTF-8''...`。
  - 中文文件名应有 UTF-8 编码字段。
- 验证安全边界：
  - 缺少 `url` 返回 400。
  - 非 HTTPS URL 返回 400。
  - 非才虫附件域名返回 400。
- 不测试真实付款、采用投稿、结算、退款、短信。

## 建议接口验证命令

把 `<encoded-url>` 替换成一个真实才虫投稿附件 URL 的 URL 编码值。

```bash
curl -sI "http://localhost:3000/api/download/submission-attachment?url=<encoded-url>&filename=中文附件.txt&disposition=attachment"
curl -sI "http://localhost:3000/api/download/submission-attachment?url=<encoded-url>&filename=中文附件.txt&disposition=inline"
curl -sI "http://localhost:3000/api/download/submission-attachment?url=https%3A%2F%2Fexample.com%2Fbad.txt&filename=bad.txt"
```

## 本轮高风险点

- 大附件下载总耗时仍取决于才虫附件源站、代理服务器到源站网络、用户网络，不可能通过前端完全消除。
- 本轮解决的是“点击后尽快交给浏览器下载”，不是保证所有附件都瞬间下载完成。
- 浏览器下载栏行为会受浏览器和系统下载设置影响。
- 中文文件名兼容性需要真实浏览器验证。
- 如果测试线程无法进入真实订单详情，需要至少用下载代理接口覆盖响应头和安全边界。

## 本轮必须执行的验证命令

- `npm run build`
- `git diff --check`

## 本轮测试结论格式

```text
测试线程名称：
对应上线摘要：2026-05-25 投稿附件下载响应体验修复待测版本
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
