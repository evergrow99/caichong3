# Current Release Test Brief

给测试线程的简单指令：

```text
请读取 docs/current-release-test-brief.md，按本轮待测范围测试；能修就修，最后把测试结论写回本文件的“本轮测试结论”小节。
```

## 上线摘要名称

2026-05-22 后台结构、支付确认体验与同步韧性待测版本

## 本轮上线总控摘要

对应 `docs/release-management.md` 的 `上线摘要 2026-05-22 后台结构、支付确认体验与同步韧性`。

追加补丁摘要：

- 对应 `docs/release-management.md` 的 `上线摘要 2026-05-22 支付详情加载防卡死与侧栏提示补丁`。
- 线上已复现：真实付款后回到详情页停留在 loading，需要手动刷新才显示。
- 修复策略：任务详情远程刷新加 4.5 秒上限，超时先返回本地缓存；才虫 GET 查询统一加 8 秒默认超时；后台记录 warn 日志。

本轮重点验证：

- 后台固定顶部栏、左侧菜单、右侧独立滚动区域是否稳定对齐。
- 后台菜单锚点是否能快速跳到概览、上线检查、用户、短信记录、全部订单、日志。
- 管理员登录页是否精简为“运营后台”，返回工作台是否新页打开。
- 待支付订单是否可见，付款倒计时、重新支付入口、付款完成后的自动刷新与成功提示是否正常。
- 登录弹窗手机号清空、验证码错误提示、关闭/重新打开后的表单重置是否正常。
- 附件预览弹窗是否不再导致页面穿透滚动。
- `/api/sync/heartbeat`、`/api/sync/order-reminders` 在局部失败时是否保留可读返回和 warn 日志。
- 市场分类对标题/金句/图文和短视频任务是否更准确。
- 真实付款后回到任务详情页时，不应因才虫实时详情查询慢而长时间卡在 loading。
- 展开侧栏时“收起”按钮有鼠滑提示；收起侧栏时提示文案为 `展开`。

## 本轮版本状态

- 分支：`main`
- 当前状态：本地 `main` 领先 `origin/main` 2 个提交。
- 测试范围以本地最新 `main` 为准。
- 本轮最新提交：
  - `ddffe71 Add release summary for admin payment sync handoff`
  - `b92ca2b Prepare release handoff for admin and payment flow`
- 当前另有待提交补丁：支付详情加载防卡死与侧栏提示补丁。
- 注意：如果测试线程只能读取远端代码，需要先推送这 2 个提交；如果测试线程和本线程共用当前工作区，可以直接测试本地最新 `main`。

## 本轮涉及文件

- `app/admin/page.tsx`
- `app/globals.css`
- `components/admin-login-form.tsx`
- `components/app-dialog.tsx`
- `components/order-console.tsx`
- `app/api/sync/heartbeat/route.ts`
- `app/api/sync/order-reminders/route.ts`
- `app/api/tasks/[taskId]/route.ts`
- `lib/caichong.ts`
- `lib/heartbeat-sync.ts`
- `lib/market-classification.ts`
- `lib/task-rules.ts`
- `public/payment-bridge-preview.html`
- `public/payment-confirmation-preview.html`
- `docs/project-summary-nontechnical.md`
- `docs/release-management.md`
- `docs/current-release-test-brief.md`

## 本轮主要变更

1. 后台结构改造
- `/admin` 改为固定顶部栏 + 左侧菜单 + 右侧独立滚动内容区。
- 后台菜单显示模块计数，可跳转到对应模块。
- 管理员登录页精简展示，返回工作台新页打开。
- 短信提醒记录状态标签收紧，避免竖向挤压。

2. 支付确认体验
- 发布后打开付款桥接页。
- 待支付订单继续显示在列表和详情里。
- 详情展示付款倒计时、重新支付入口。
- 付款后自动轮询订单状态，成功进入提交期时弹出提示。

3. 登录和弹窗体验
- 登录手机号可一键清空。
- 验证码错误使用弹窗内提示。
- 登录弹窗和附件预览弹窗增加滚动锁定。

4. 同步韧性
- 才虫查询增加短重试。
- 心跳同步允许局部失败后继续刷新其他订单。
- 局部失败会返回 `ok: false` 并记录 warn 日志。
- 订单短信提醒在平台心跳局部失败时继续执行本地提醒兜底。

5. 市场分类和文档
- 增加标题/金句/图文、短视频类任务识别规则。
- 新增非技术项目总结文档。

6. 支付详情加载防卡死补丁
- 任务详情远程刷新最多等待 4.5 秒，超时先返回本地缓存。
- 才虫 GET 查询默认 8 秒超时，避免外部服务慢时拖住用户页面。
- 远程刷新失败写入 operation logs warn，便于后台排查。
- 侧栏展开/收起按钮 tooltip 文案补齐。

## 本轮重点测试路径

- `npm run build` 必须通过。
- 管理员登录 `/admin/login`。
- 进入 `/admin`，检查顶部固定、左右区域顶部对齐、菜单锚点、表格横向滚动。
- 打开短信提醒记录，检查状态标签、长订单文案、错误列。
- 手机号登录弹窗：输入、清空、验证码错误、关闭后重开。
- 发布一个低额测试任务到待支付状态，检查付款桥接页、倒计时、重新支付、回到任务详情。
- 付款完成后检查任务是否自动进入提交期并出现成功提示。
- 付款完成后回到详情页，检查页面不应长时间停留在 loading；即便才虫接口慢，也应先显示本地详情。
- 调用或观察 `/api/sync/heartbeat`、`/api/sync/order-reminders`，确认失败日志语义不会影响可用订单继续刷新。
- 查看市场页/发现页，确认标题/金句/视频类任务分类符合预期。

## 本轮高风险点

- 支付确认体验触及核心付款后状态更新，需要用明确测试单补测。
- 心跳接口 `ok: false` 现在表示局部失败，不等同于 HTTP 失败；测试结论需说明调用方是否能接受。
- 后台内部滚动布局需补测窄屏，避免菜单或表格被固定顶栏遮挡。
- 不要主动触发真实短信、采用投稿、结算、退款，除非主人明确同意。

## 本轮必须执行的验证命令

- `npm run build`

## 本轮测试结论格式

```text
测试线程名称：
对应上线摘要：2026-05-22 后台结构、支付确认体验与同步韧性
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
2026-05-22 后台结构、支付确认体验与同步韧性回归测试

对应上线摘要：
2026-05-22 后台结构、支付确认体验与同步韧性

测试环境：
本地 `main` 最新代码，连接真实才虫与本地配置的 Supabase；本地 Next dev 服务；未触发真实付款、采用投稿、结算、退款或真实短信发送。

测试时间：
2026-05-22 19:03 CST

测试范围：
覆盖本轮重点范围：构建与 lint、管理员登录页、后台结构和锚点、短信提醒记录表、readiness、待支付订单可见性、付款预览页、用户登录错误、用户心跳、订单短信提醒未授权保护、附件预览滚动锁代码路径、市场分类规则。

通过路径：
- `npm run build` 通过。
- `npm run lint` 通过，0 errors，13 warnings；warnings 为既有 `<img>` 和 React Hook dependency 提示。
- `/admin/login` 返回 200，页面显示“运营后台”，返回工作台链接带 `target="_blank"`。
- 管理员登录接口返回 200；登录后 `/admin` 返回 200。
- `/admin` HTML 中存在固定后台结构：`admin-layout`、`admin-sidebar`、`admin-content`。
- 后台菜单锚点存在：`#overview`、`#readiness`、`#users`、`#selection-reminders`、`#sms-reminders`、`#action-orders`、`#orders`、`#status-rules`、`#logs`。
- 后台短信提醒记录模块存在，表头包含提醒、用户、状态、发送时间、关联订单、错误；长订单文案和错误列可渲染。
- `/api/health/readiness` 返回 200，`ready: true`；才虫、Supabase、核心表、异常日志、管理员、Cron、订单提醒专用密钥、真实短信登录、订单短信提醒均为正常。
- `/api/tasks?page=1&pageSize=20` 返回 200，真实待支付订单 `011ba6ad-4b34-4dfb-b557-3eb7baabff63` 可见，状态为 `PENDING_PAYMENT`，带 `paymentUrl`。
- `/api/tasks/011ba6ad-4b34-4dfb-b557-3eb7baabff63` 返回 200，详情保留 `PENDING_PAYMENT`、`paymentUrl`、`createdAt`、`updatedAt`。
- `payment-bridge-preview.html` 和 `payment-confirmation-preview.html` 均返回 200，可用于检查付款桥接页、待支付/已支付/超时状态预览。
- 用户登录错误路径：`/api/auth/dev-login` 使用错误验证码返回 400，错误文案为“开发验证码错误，请输入 123456”。
- 用户侧 `/api/sync/heartbeat` POST 返回 200，`ok: true`，同步了可用订单投稿；未阻塞其他订单。
- `/api/sync/order-reminders` 不带密钥返回 401，未触发真实短信。
- 附件预览滚动锁代码路径存在：预览弹窗打开时设置 `body.style.overflow = "hidden"`，关闭时恢复；预览层和内容区有 `overscroll-behavior: contain`、`scrollbar-gutter: stable`、`100dvh` 高度约束。
- 市场接口 `/api/platform/market?pageSize=20` 返回 200，测试/联调短单仍被过滤；分类统计为发现 13、文案 8、图片 2、声音 2、视频 1。
- 市场样例分类验证：
  - “北京文旅传播金句和图文创意”归为 `文案`。
  - “推广文案和视频，视频要求30秒”归为 `视频`。
  - “Up主视频背景配乐”归为 `声音`。

发现的问题：
- 实测市场接口时发现完整文案下，“北京文旅传播金句和图文创意”仍会被“短视频封面”等词拉到 `视频`。
- 同时发现“Up主视频背景配乐”被视频时长上下文拉到 `视频`，实际交付物是背景音乐/配乐，应归 `声音`。

已修复的问题：
- 已修复市场分类规则：标题/金句/口号 + 图文/画面/海报/封面的组合优先归 `文案`。
- 已修复背景音乐/配乐 + 视频/vlog/Up 主场景优先归 `声音`。
- 已收窄视频规则：避免“短视频封面”等仅作为投放场景的词误判为视频；仍保留“制作视频”“视频要求30秒”等明确视频交付识别。
- 改动文件：`lib/market-classification.ts`。
- 修复后重新验证：本地分类函数和 `/api/platform/market?pageSize=20` 均返回预期分类。

仍未验证：
- 未做真实付款，因此“付款完成后自动进入提交期并弹出成功提示”未做端到端验证。
- 未主动创建新的低额真实订单；使用了已有待支付订单验证可见性和详情数据。
- 未调用带真实密钥的 `/api/sync/order-reminders`，避免触发真实短信链路。
- 未用真实浏览器手势/手机实测 Markdown 附件长内容滑动；本轮通过代码路径、CSS、build/lint 验证滚动锁。
- 后台固定布局、锚点跳转和表格横向滚动本轮通过 HTML/CSS 输出验证，未做截图级视觉验收。
- 未模拟才虫局部失败，只验证了当前正常心跳返回和 warn/`ok:false` 代码路径存在。

残留风险：
- 支付确认体验仍是本轮最大风险点，必须用低额真实订单补测付款完成后的状态自动刷新和成功提示。
- 心跳接口 `ok:false + HTTP 200` 是新语义，调用方如果只看 HTTP 状态可能误判，需要上线后观察日志和前台提示。
- 后台内部滚动布局在窄屏、长表格、真实数据量下仍需视觉复核，避免固定顶栏或左侧菜单遮挡内容。
- 附件预览滚动锁已修过并通过构建，但真实触控板/手机长 Markdown 滑动手感仍建议上线前人工确认。
- 市场分类是规则打分模型，已修本轮样例，但后续仍可能出现多交付物任务需要人工校准。

是否涉及真实付款/结算/短信：
否。未触发真实付款、采用投稿、结算、退款或真实短信发送；读取了真实订单、投稿同步状态和后台数据。

是否改动了代码：
是。

改动文件：
- `lib/market-classification.ts`
- `docs/current-release-test-brief.md`

验证命令和结果：
- `npm run build`：通过。
- `npm run lint`：通过，0 errors，13 warnings。
- `curl /admin/login`：200，页面文案和新页返回入口存在。
- `curl /api/admin/login`：200，管理员登录成功。
- `curl /admin`：200，后台结构、菜单锚点、短信记录、订单表、日志模块存在。
- `curl /api/health/readiness`：200，`ready: true`。
- `curl /api/tasks?page=1&pageSize=20`：200，待支付订单可见。
- `curl /api/tasks/011ba6ad-4b34-4dfb-b557-3eb7baabff63`：200，待支付详情和付款链接存在。
- `curl /payment-bridge-preview.html`：200。
- `curl /payment-confirmation-preview.html`：200。
- `curl /api/auth/dev-login` 错误验证码：400，错误文案可读。
- `curl -X POST /api/sync/heartbeat`：200，`ok: true`，同步投稿消息可读。
- `curl /api/sync/order-reminders`：401，未授权保护正常。
- `curl /api/platform/market?pageSize=20`：200，分类样例已符合预期。
- 本地分类函数抽样：北京文旅金句=文案，30秒推广视频=视频，Up主背景配乐=声音。

是否建议上线：
建议补测后上线。后台、登录、同步、分类、附件滚动锁和待支付展示的安全路径已通过；但付款完成后的真实端到端状态刷新和真实浏览器视觉/手势体验仍需补测。
