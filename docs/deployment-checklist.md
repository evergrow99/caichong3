# 上线检查清单

本文件按生产环境填写。若只是本地演示，可以临时设置 `CAICHONG_USE_MOCK=true`，但部署给真实用户时必须关闭模拟模式。

## Vercel 环境变量

上线前需要在 Vercel Project Settings 里配置：

```text
CAICHONG_USE_MOCK=false
CAICHONG_BASE_URL=https://main-api.caichong.net
CAICHONG_API_KEY=<已认领的才虫 Agent API Key>
NEXT_PUBLIC_SUPABASE_URL=<Supabase Project URL>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<Supabase anon public key>
SUPABASE_SERVICE_ROLE_KEY=<Supabase service_role key>
CRON_SECRET=<一段只有你知道的随机字符串>
ALLOW_DEV_LOGIN=false
AUTH_SMS_PROVIDER=<真实短信服务标识，接入后填写>
```

## 定时心跳

`vercel.json` 已配置每 30 分钟调用：

```text
GET /api/sync/heartbeat
```

接口会同步平台所有待处理订单，不依赖浏览器登录态。设置 `CRON_SECRET` 后，Vercel Cron 会带：

```text
Authorization: Bearer <CRON_SECRET>
```

注意：Vercel Hobby 计划的 Cron 最低频率通常只能到每天一次；如果要严格按才虫规则每 30 分钟同步，需要使用 Vercel Pro，或改用外部定时服务调用同一个接口。

## 上线前人工确认

- 本地 `npm run build` 通过
- 打开 `/admin` 查看“上线健康检查”
- 或访问 `/api/health/readiness` 查看 JSON 检查结果
- Supabase 表已创建
- Supabase SQL Editor 已执行 `supabase/migrations/0002_operation_logs.sql`
- 才虫 Agent 已认领
- 至少跑通过一次真实 1 元测试单
- 确认 `.env.local` 不提交到仓库
- 真实短信登录暂未接入，对外上线前不能继续使用固定验证码
- 生产环境不要设置 `ALLOW_DEV_LOGIN=true`
- `/api/auth/send-code` 和 `/api/auth/verify-code` 接入真实短信服务后，再把 `/admin` 的“真实短信登录”检查项变绿

## 异常日志表

如果运营后台的“异常与同步日志”一直为空，先在 Supabase SQL Editor 执行：

```text
supabase/migrations/0002_operation_logs.sql
```

这张表只新增日志记录，不会删除订单数据。
