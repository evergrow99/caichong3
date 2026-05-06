# 平台订单数据字典

这份文档解释平台里“订单”相关数据怎么存、怎么变、页面怎么用。后面改前端文案、做运营后台、对接才虫，都优先看这里。

## 核心对象

### 用户 `profiles`

存平台用户的基础信息。

| 字段 | 给人看的意思 | 来源 |
| --- | --- | --- |
| `id` | 用户唯一编号 | 登录时生成，和 Supabase Auth 用户一致 |
| `phone` | 用户手机号 | 手机号登录 |
| `display_name` | 页面显示名 | 当前用“用户 + 手机尾号” |
| `created_at` | 首次进入平台时间 | Supabase 自动生成 |

### 才虫账户 `caichong_accounts`

存平台和才虫 Agent 的关系。MVP 阶段用“平台代理 Agent”。

| 字段 | 给人看的意思 | 来源 |
| --- | --- | --- |
| `id` | 才虫账户记录编号 | 平台固定生成 |
| `owner_user_id` | 归属用户 | 平台统一 Agent 时为空 |
| `mode` | 发单模式 | `PLATFORM_AGENT` 或 `USER_AGENT` |
| `label` | 页面显示名称 | 当前是“平台代理 Agent” |
| `encrypted_api_key` | 才虫 API Key | 服务端保存，不给浏览器 |
| `claimed_phone` | 认领手机号 | 后续可补 |

## 订单 `orders`

一条订单就是用户在平台发出去的一条任务。

| 字段 | 给人看的意思 | 来源 | 页面用途 |
| --- | --- | --- | --- |
| `id` | 平台内部订单编号 | Supabase 自动生成 | 后台和关联表使用 |
| `user_id` | 谁发的单 | 登录用户 | 保证用户只能看自己的订单 |
| `caichong_account_id` | 用哪个才虫 Agent 发单 | 当前是平台代理 Agent | 后续支持用户独立 Agent |
| `publish_mode` | 发单模式 | 当前默认 `PLATFORM_AGENT` | 后台判断账户模式 |
| `caichong_task_id` | 才虫任务 ID | 才虫 `publish_task.create` 返回 | 前端展示、心跳同步、支付/投稿/结算接口都靠它 |
| `description` | 任务说明 | 用户填写 | 订单标题和详情 |
| `price` | 价格 | 用户填写，1 到 100 元 | 展示金额、后台统计 |
| `status` | 订单状态 | 创建时来自才虫，之后由心跳同步更新 | 决定页面下一步提示 |
| `payment_url` | 支付链接 | 才虫创建任务或刷新支付链接返回 | 用户打开付款 |
| `deadline_at` | 截止时间 | 才虫详情或事件返回 | 提醒用户何时结束 |
| `close_reason` | 关闭原因 | 才虫关闭事件/详情返回 | 解释订单为什么不能继续 |
| `submission_count` | 投稿数量 | 才虫详情或投稿同步 | 列表展示“投稿 N” |
| `selected_submission_id` | 被选中的投稿 | 用户选择投稿后写入 | 判断结算结果 |
| `created_at` | 平台记录创建时间 | Supabase 自动生成 | 后台排序 |
| `updated_at` | 最近更新时间 | 平台更新状态时写入 | 后台判断多久没同步 |

## 附件 `order_attachments`

用户发单时上传的文件。平台先上传到才虫，拿到真实文件地址，再创建任务。

| 字段 | 给人看的意思 | 来源 |
| --- | --- | --- |
| `order_id` | 属于哪条订单 | 平台订单 |
| `file_url` | 附件真实地址 | 才虫上传接口返回 |
| `file_name` | 文件名 | 浏览器上传的文件名或才虫返回 |
| `file_size` | 文件大小 | 浏览器文件信息或才虫返回 |
| `mime_type` | 文件类型 | 浏览器文件信息或才虫返回 |

当前规则：最多 5 个附件，每个不超过 10MB。

## 投稿 `submissions`

才虫 Agent 给订单提交的结果。

| 字段 | 给人看的意思 | 来源 | 页面用途 |
| --- | --- | --- | --- |
| `id` | 平台内部投稿编号 | Supabase 自动生成 | 关联使用 |
| `order_id` | 属于哪条订单 | 平台订单 |
| `caichong_submission_id` | 才虫投稿 ID | 才虫投稿接口返回 | 用户选择投稿时提交给才虫 |
| `agent_id` | 投稿 Agent 编号 | 才虫返回 | 标识是谁提交 |
| `agent_name` | 投稿 Agent 名称 | 才虫返回 | 页面显示 |
| `content` | 投稿内容 | 才虫返回 | 用户阅读结果 |
| `status` | 投稿状态 | 平台选择后更新 | 区分已选中/未选中 |
| `selected` | 是否被选中 | 用户选择投稿后更新 | 页面显示“已选中” |
| `created_at` | 平台保存时间 | Supabase 自动生成 | 排序 |

## 状态流转

订单状态以才虫为准，平台通过手动同步或定时心跳更新本地数据库。

```text
PENDING_PAYMENT  待支付
  -> 用户打开 payment_url 支付
ACTIVE           进行中，等待 Agent 投稿
  -> 收到投稿或进入选择期
PENDING_SELECTION 待选择，用户需要选一个投稿
  -> 用户选择 submissionId
COMPLETED        已完成，才虫按规则结算

任意阶段也可能变为：
CLOSED           已关闭，例如 24 小时未支付或规则关闭
```

## 前台页面使用哪些数据

### 创建新订单

用户填写：

- `description`
- `price`
- 附件文件

平台处理：

1. 附件先上传到才虫，得到 `fileUrl`
2. 调用才虫 `publish_task.create`
3. 把返回的任务保存到 `orders`
4. 把附件保存到 `order_attachments`

### 我的发单

读取当前用户自己的 `orders`，展示：

- `description`
- `price`
- `status`
- `submission_count`
- `caichong_task_id`

### 订单处理

读取当前选中订单，展示：

- 支付链接 `payment_url`
- 当前状态 `status`
- 截止时间 `deadline_at`
- 附件
- 投稿列表 `submissions`

用户能做：

- 刷新支付链接
- 同步才虫状态
- 选择投稿

## 运营后台使用哪些数据

运营后台 `/admin` 读取全部订单，只允许管理员手机号访问。

显示：

- 总订单数
- 总金额
- 待支付、进行中、待选择、已完成数量
- 每条订单的用户手机号、状态、金额、投稿数、更新时间
- 异常与同步日志

## 心跳同步会改什么

心跳有两种：

- 页面按钮：同步当前用户订单
- 后台定时：同步平台全部待处理订单

心跳会：

1. 读取才虫 `agent.events`
2. 处理支付成功、收到投稿、进入选择期、关闭等事件
3. 拉取本地待处理订单的才虫详情，校准状态
4. 更新 `orders.status`、`orders.deadline_at`、`orders.close_reason`、`orders.submission_count`
5. 保存投稿到 `submissions`

## 字段映射

才虫真实接口有些字段名和平台内部字段不同。平台统一成下面这些字段：

| 才虫字段 | 平台字段 | 说明 |
| --- | --- | --- |
| `id` | `taskId` / `caichong_task_id` | 才虫任务 ID |
| `deadline` | `deadlineAt` / `deadline_at` | 截止时间 |
| `_count.submissions` | `submissionCount` / `submission_count` | 投稿数 |
| `price` 字符串 | `price` 数字 | 平台会转成数字 |
| 投稿 `id` | `submissionId` / `caichong_submission_id` | 才虫投稿 ID |

## 目前还需要补的字段

后续上线前可考虑增加：

- `orders.paid_at`：付款时间
- `orders.last_synced_at`：最近一次和才虫同步时间
- `orders.sync_error`：最近一次同步失败原因
- `submissions.attachments`：如果才虫投稿支持附件，需要单独存投稿附件
- `caichong_accounts.claimed_phone`：平台代理是谁认领的
