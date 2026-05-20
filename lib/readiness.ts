import { hasSupabaseServiceConfig, createSupabaseServiceClient } from "@/lib/supabase/server";

export type ReadinessItem = {
  key: string;
  label: string;
  ok: boolean;
  detail: string;
  action?: string;
};

export type ReadinessReport = {
  ready: boolean;
  items: ReadinessItem[];
};

async function checkSupabaseTable(table: string) {
  if (!hasSupabaseServiceConfig()) {
    return false;
  }

  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.from(table).select("id").limit(1);
  return !error;
}

export async function getReadinessReport(): Promise<ReadinessReport> {
  const hasCaichongApiKey = Boolean(process.env.CAICHONG_API_KEY);
  const useMock = process.env.CAICHONG_USE_MOCK === "true" || !hasCaichongApiKey;
  const hasAdminPhones = Boolean(process.env.ADMIN_PHONES?.split(",").map((phone) => phone.trim()).filter(Boolean).length);
  const hasCronSecret = Boolean(process.env.CRON_SECRET);
  const hasOrderReminderCronSecret = Boolean(process.env.ORDER_REMINDER_CRON_SECRET);
  const devLoginSafe = process.env.NODE_ENV !== "production" || process.env.ALLOW_DEV_LOGIN !== "true";
  const hasOrderReminderSms = Boolean(
    process.env.AUTH_SMS_PROVIDER === "aliyun" &&
      process.env.ALIYUN_SMS_ACCESS_KEY_ID &&
      process.env.ALIYUN_SMS_ACCESS_KEY_SECRET &&
      process.env.ALIYUN_SMS_SIGN_NAME &&
      process.env.ALIYUN_SMS_SUBMISSION_TEMPLATE_CODE &&
      process.env.ALIYUN_SMS_SELECTION_STARTED_TEMPLATE_CODE &&
      process.env.ALIYUN_SMS_SELECTION_DEADLINE_TEMPLATE_CODE
  );
  const hasRealSmsLogin = Boolean(
    (process.env.AUTH_SMS_PROVIDER === "aliyun" &&
      process.env.ALIYUN_SMS_ACCESS_KEY_ID &&
      process.env.ALIYUN_SMS_ACCESS_KEY_SECRET &&
      process.env.ALIYUN_SMS_SIGN_NAME &&
      process.env.ALIYUN_SMS_TEMPLATE_CODE) ||
      process.env.SUPABASE_AUTH_PHONE_ENABLED === "true"
  );
  const supabaseReady = hasSupabaseServiceConfig();
  const coreTablesReady = supabaseReady && (await checkSupabaseTable("orders"));
  const operationLogsReady = supabaseReady && (await checkSupabaseTable("operation_logs"));
  const smsTableReady = supabaseReady && (await checkSupabaseTable("sms_verifications"));
  const orderReminderTableReady = supabaseReady && (await checkSupabaseTable("order_sms_reminders"));

  const items: ReadinessItem[] = [
    {
      key: "caichong",
      label: "才虫真实接口",
      ok: hasCaichongApiKey && !useMock,
      detail: hasCaichongApiKey && !useMock ? "已配置真实 API Key，当前不是模拟模式。" : "还在模拟模式，或缺少才虫 API Key。",
      action: "上线必须设置 CAICHONG_USE_MOCK=false，并配置已认领 Agent 的 CAICHONG_API_KEY。"
    },
    {
      key: "supabase",
      label: "Supabase 服务端配置",
      ok: supabaseReady,
      detail: supabaseReady ? "已配置 Project URL 和 service_role key。" : "缺少 Supabase URL 或 service_role key。",
      action: "在部署环境配置 NEXT_PUBLIC_SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY。"
    },
    {
      key: "core_tables",
      label: "核心数据表",
      ok: Boolean(coreTablesReady),
      detail: coreTablesReady ? "核心订单表可读取。" : "核心表可能还没创建，或 service_role 无法访问。",
      action: "在 Supabase SQL Editor 执行 supabase/migrations/0001_initial_schema.sql。"
    },
    {
      key: "operation_logs",
      label: "异常日志表",
      ok: Boolean(operationLogsReady),
      detail: operationLogsReady ? "异常日志表可读取。" : "异常日志表还不可用，后台日志会暂时为空。",
      action: "在 Supabase SQL Editor 执行 supabase/migrations/0002_operation_logs.sql。"
    },
    {
      key: "admin",
      label: "管理员手机号",
      ok: hasAdminPhones,
      detail: hasAdminPhones ? "已配置 ADMIN_PHONES。" : "未配置管理员手机号，运营后台无法授权真实管理员。",
      action: "在环境变量 ADMIN_PHONES 填入你的手机号，多个手机号用英文逗号分隔。"
    },
    {
      key: "cron",
      label: "定时心跳密钥",
      ok: hasCronSecret,
      detail: hasCronSecret ? "已配置 CRON_SECRET。" : "未配置 CRON_SECRET，部署后的定时同步不能安全运行。",
      action: "在部署环境配置一段随机 CRON_SECRET。"
    },
    {
      key: "order_reminder_cron_secret",
      label: "订单提醒专用密钥",
      ok: hasOrderReminderCronSecret,
      detail: hasOrderReminderCronSecret ? "已配置 ORDER_REMINDER_CRON_SECRET，可供外部 Cron 单独使用。" : "尚未配置订单提醒专用密钥，外部 Cron 会复用通用 CRON_SECRET。",
      action: "在部署环境配置一段随机 ORDER_REMINDER_CRON_SECRET，并只把它填到外部 Cron。"
    },
    {
      key: "dev_login",
      label: "开发验证码登录",
      ok: devLoginSafe,
      detail: devLoginSafe ? "当前环境没有暴露生产固定验证码风险。" : "生产环境仍开启 ALLOW_DEV_LOGIN=true。",
      action: "生产环境必须移除 ALLOW_DEV_LOGIN=true，并接入真实短信登录。"
    },
    {
      key: "real_sms_login",
      label: "真实短信登录",
      ok: Boolean(hasRealSmsLogin && smsTableReady),
      detail:
        hasRealSmsLogin && smsTableReady
          ? "已配置真实短信服务和验证码表。"
          : "还没有完整接入真实短信验证码，暂时不能对外开放真实用户注册登录。",
      action: "配置 AUTH_SMS_PROVIDER=aliyun、阿里云短信环境变量，并执行 supabase/migrations/0004_sms_verifications.sql。"
    },
    {
      key: "order_reminder_sms",
      label: "订单短信提醒",
      ok: Boolean(hasOrderReminderSms && orderReminderTableReady),
      detail:
        hasOrderReminderSms && orderReminderTableReady
          ? "已配置投稿和选择期提醒模板，提醒日志表可读取。"
          : "订单短信提醒还未完整配置，选择期仍需要运营人工兜底。",
      action: "配置三个订单提醒模板码，并执行 supabase/migrations/0009_order_sms_reminders.sql。"
    }
  ];

  return {
    ready: items.every((item) => item.ok),
    items
  };
}
