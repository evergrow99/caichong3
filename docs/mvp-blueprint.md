# 才虫发单网站 MVP 蓝图

目标：一个人完成从设计、前端、后端到上线的第一版。第一版只追求跑通闭环：人类在你的网站发单，才虫 Agent 接单投稿，人类选中结果，才虫完成结算。

## 第一版页面

1. 发单页
   - 任务说明：对应 `description`
   - 价格：对应 `price`，范围 1 到 100 元
   - 附件：前端限制单文件不超过 10MB，最多 5 个；发布前先通过才虫上传接口拿到真实 `fileUrl`

2. 我的订单
   - 读取 `publish_task.list`
   - 展示任务说明、价格、状态、投稿数、任务 ID

3. 订单详情
   - 读取 `publish_task.detail`
   - 展示支付链接、截止时间、附件、关闭原因

4. 投稿选择
   - 读取 `publish_task.submissions`
   - 人类明确选择后调用 `publish_task.select`

5. 手机号登录
   - 真实用户使用手机号验证码注册/登录
   - 用户只能看到和操作自己的订单
   - 才虫 API Key 只在服务端使用，不能暴露给浏览器

## 第一版接口

- `POST /api/tasks`：创建才虫任务，对应 `publish_task.create`
- `GET /api/tasks`：读取我的发单列表，对应 `publish_task.list`
- `GET /api/tasks/:taskId`：读取订单详情，对应 `publish_task.detail`
- `GET /api/tasks/:taskId/submissions`：读取投稿，对应 `publish_task.submissions`
- `POST /api/tasks/:taskId/select`：选中投稿并结算，对应 `publish_task.select`
- `POST /api/tasks/:taskId/payment-url`：刷新支付链接，对应 `agent.getPaymentUrl`

## 必须遵守的才虫规则

- 除 `agent.register` 外，所有接口都需要 `X-API-Key`
- API Key 必须来自已认领的 Agent
- POST JSON 必须使用 `Content-Type: application/json; charset=utf-8`
- 任务价格只能是 1 到 100 元
- 支付链接有效期 30 分钟
- 任务创建后 24 小时不付款会关闭
- 支付成功后任务有 72 小时提交/选择窗口
- 结算必须由人类明确选择某个 `submissionId`

## 单人开发顺序

1. 配置 `.env.local`，填入才虫已认领 Agent 的 API Key
2. 跑通发单页和 `publish_task.create`
3. 跑通订单列表和 `publish_task.list`
4. 增加订单详情页
5. 增加投稿列表和选中按钮
6. 增加附件上传
7. 接 Supabase，保存你平台用户和才虫 `taskId` 的关系
8. 增加手机号登录，让订单属于真实用户
9. 增加事件轮询，把状态自动同步到你自己的数据库

## 当前本地开发状态

- 没有 `CAICHONG_API_KEY` 时，系统自动使用本地模拟数据
- 本地模拟模式可以测试发单、刷新支付链接、查看投稿、选中投稿
- 附件会先上传到才虫接口，拿到 OSS `fileUrl` 后再创建任务
- 用户体系设计见 `docs/auth-and-users.md`
- 订单数据结构见 `docs/order-data-dictionary.md`

## 心跳同步

当前心跳同步会：

- 拉取才虫 `agent.events`
- 处理 `TASK_ACTIVE`、`SUBMISSION_RECEIVED`、`TASK_SELECTION_WINDOW_STARTED`、`TASK_CLOSED`
- 将订单状态和投稿同步到 Supabase
- 调用 `agent.eventsAck` 确认已读

页面手动同步继续使用：

```text
POST /api/sync/heartbeat
```

它只同步当前登录用户的订单。

部署后的定时同步使用：

```text
GET /api/sync/heartbeat
```

它不依赖浏览器登录态，会同步平台所有 `PENDING_PAYMENT`、`ACTIVE`、`PENDING_SELECTION` 订单。设置 `CRON_SECRET` 后，请求必须带下面任意一种认证方式：

```text
x-cron-secret: <CRON_SECRET>
```

或：

```text
Authorization: Bearer <CRON_SECRET>
```
