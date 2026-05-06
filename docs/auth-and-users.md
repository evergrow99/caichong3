# 用户体系与手机号登录设计

这个平台最终是给真实人类用户使用的，不是单人后台工具。因此从第一版开始，订单必须有明确的用户归属。

## 产品原则

- 用户用手机号注册/登录
- 用户只能看到自己发布的订单
- 用户只能操作自己的订单，包括刷新支付链接、查看投稿、选中投稿
- 才虫 `taskId` 不能直接当作你平台的唯一订单系统；你需要保存一份自己的订单记录
- 才虫 API Key 只放在服务端环境变量里，不能暴露给浏览器

## 推荐单人开发方案

第一阶段建议用托管认证服务，不自建短信系统。

优先方案：

- Supabase Auth + 手机号 OTP
- Supabase Postgres 存用户订单
- Next.js API Route 做才虫接口代理
- Vercel 部署前端和服务端接口

备选方案：

- Authing / Clerk / Firebase Phone Auth
- 阿里云短信 + 自建验证码表

对一个人来说，推荐先用 Supabase，因为登录、数据库、权限策略、部署环境变量都能放在一套工作流里。

## Supabase Key 说明

`.env.local` 需要三个 Supabase 配置：

- `NEXT_PUBLIC_SUPABASE_URL`：项目 URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`：浏览器可用的公开匿名 key
- `SUPABASE_SERVICE_ROLE_KEY`：只能放服务端的高权限 key

注意：`service_role key` 不是 `anon public key`。如果 JWT 里显示 `"role":"anon"`，它就是 anon key，不是 service role。没有 service role 时，手机号登录仍可先接；但服务端绕过 RLS 写入订单、同步才虫事件时会需要真正的 service role。

## 最小数据表

可执行 SQL 已放在 `supabase/migrations/0001_initial_schema.sql`。

### users

真实项目里 Supabase 会有内置 `auth.users`，我们可以再建一张业务资料表。

```sql
create table public.profiles (
  id uuid primary key references auth.users(id),
  phone text unique,
  display_name text,
  created_at timestamptz not null default now()
);
```

### caichong_accounts

这张表用于支持“先平台统一 Agent，未来允许每个用户绑定自己的才虫 Agent”。

```sql
create table public.caichong_accounts (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references auth.users(id),
  mode text not null check (mode in ('PLATFORM_AGENT', 'USER_AGENT')),
  label text not null,
  encrypted_api_key text not null,
  claimed_phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

第一版只需要一条平台记录：

```text
mode = PLATFORM_AGENT
owner_user_id = null
label = 平台代理 Agent
```

未来用户绑定自己的才虫 Agent 时，新增：

```text
mode = USER_AGENT
owner_user_id = 当前用户 id
```

### orders

这张表是你平台自己的订单表，用来把“你的网站用户”和“才虫任务”绑定起来。

```sql
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  caichong_account_id uuid references public.caichong_accounts(id),
  publish_mode text not null default 'PLATFORM_AGENT',
  caichong_task_id text not null unique,
  description text not null,
  price numeric(10, 2) not null,
  status text not null,
  payment_url text,
  deadline_at timestamptz,
  close_reason text,
  submission_count integer not null default 0,
  selected_submission_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

`publish_mode` 用来区分历史订单属于平台代理，还是未来用户自己的 Agent。这样以后迁移时，旧订单不需要硬转移。

### order_attachments

```sql
create table public.order_attachments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  file_url text not null,
  file_name text,
  file_size integer,
  mime_type text,
  created_at timestamptz not null default now()
);
```

### submissions

```sql
create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  caichong_submission_id text not null unique,
  agent_id text,
  agent_name text,
  content text not null,
  status text,
  selected boolean not null default false,
  created_at timestamptz not null default now()
);
```

## API 权限规则

所有订单接口以后都要经过登录校验。

- `GET /api/tasks`：只返回当前登录用户的订单
- `POST /api/tasks`：创建才虫任务后，把 `user_id + caichong_account_id + publish_mode + caichong_task_id` 存入本地订单表
- `GET /api/tasks/:taskId`：先确认这个 taskId 属于当前用户，再读取详情
- `GET /api/tasks/:taskId/submissions`：先确认订单归属，再读取投稿
- `POST /api/tasks/:taskId/select`：先确认订单归属，再调用才虫选中接口

## 为什么现在不直接接短信

短信登录会牵涉几个实际问题：

- 选哪家短信供应商
- 验证码频率限制
- 防刷和成本控制
- 国内手机号短信签名和模板审核
- 上线域名、隐私政策、用户协议

所以当前正确顺序是：先把发单闭环和用户归属结构定住，再接托管手机号登录。这样产品不会因为短信细节卡住。

## 当前开发版登录保护

本地联调阶段暂时使用固定验证码：

```text
123456
```

这个登录方式只应该用于开发环境。项目里增加了 `ALLOW_DEV_LOGIN`：

- 本地 `.env.local` 可以设置 `ALLOW_DEV_LOGIN=true`
- 生产环境必须不设置，或设置为 `false`

如果生产环境还没有接真实短信登录，`/api/auth/dev-login` 会拒绝固定验证码登录，避免测试入口误开放给真实用户。

## 真实短信接入预留接口

后续申请短信服务后，认证入口按下面拆分：

```text
POST /api/auth/send-code
```

负责发送验证码。需要做：

- 校验手机号格式
- 调用短信服务商
- 做发送频率限制
- 记录验证码请求，防刷

```text
POST /api/auth/verify-code
```

负责校验验证码并登录。需要做：

- 校验手机号和验证码
- 创建或更新 Supabase Auth 用户
- 写入 `profiles`
- 设置登录 cookie

当前这两个接口已经预留，但会返回 `501`，表示真实短信暂未接入。现阶段本地仍使用：

```text
POST /api/auth/dev-login
```

订单、发单、心跳、后台都只依赖 `getCurrentUser()` 和 `profiles`，所以以后替换短信供应商时，不需要重写订单系统。

## Agent 账户迁移策略

第一版采用平台统一 Agent：

```text
用户 -> 平台 Agent -> 才虫任务
```

未来支持个人 Agent：

```text
用户 -> 用户自己的 Agent -> 才虫任务
```

系统必须允许两种订单长期共存：

- 老订单：`publish_mode = PLATFORM_AGENT`
- 新订单：`publish_mode = USER_AGENT`

不要试图把旧订单强行迁移到用户自己的才虫 Agent 名下。你的平台可以继续显示旧订单归属，但才虫侧账务大概率仍然属于当时发单的平台代理 Agent。
