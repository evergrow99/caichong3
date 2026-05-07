import crypto from "crypto";
import { createSupabaseServiceClient, hasSupabaseServiceConfig } from "@/lib/supabase/server";

const CODE_TTL_MINUTES = 5;
const SEND_INTERVAL_SECONDS = 60;
const MAX_VERIFY_ATTEMPTS = 5;

type SmsVerificationRow = {
  id: string;
  phone: string;
  code_hash: string;
  expires_at: string;
  consumed_at: string | null;
  attempts: number | null;
  created_at: string;
};

function requireSmsStorage() {
  if (!hasSupabaseServiceConfig()) {
    throw new Error("缺少 Supabase 服务端配置，无法保存短信验证码");
  }

  return createSupabaseServiceClient();
}

function getHashSecret() {
  return process.env.SMS_CODE_HASH_SECRET || process.env.CRON_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "local-sms-code-secret";
}

function hashCode(phone: string, code: string) {
  return crypto.createHmac("sha256", getHashSecret()).update(`${phone}:${code}`).digest("hex");
}

export function generateSmsCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, "0");
}

export async function assertCanSendSmsCode(phone: string) {
  const supabase = requireSmsStorage();
  const since = new Date(Date.now() - SEND_INTERVAL_SECONDS * 1000).toISOString();
  const { data, error } = await supabase
    .from("sms_verifications")
    .select("id, created_at")
    .eq("phone", phone)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(`读取验证码发送记录失败：${error.message}`);
  }

  if (data?.length) {
    throw new Error("验证码发送太频繁，请 1 分钟后再试");
  }
}

export async function saveSmsCode(phone: string, code: string) {
  const supabase = requireSmsStorage();
  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000).toISOString();
  const { error } = await supabase.from("sms_verifications").insert({
    phone,
    code_hash: hashCode(phone, code),
    expires_at: expiresAt
  });

  if (error) {
    throw new Error(`保存短信验证码失败：${error.message}`);
  }
}

export async function verifySmsCode(phone: string, code: string) {
  const supabase = requireSmsStorage();
  const { data, error } = await supabase
    .from("sms_verifications")
    .select("id, phone, code_hash, expires_at, consumed_at, attempts, created_at")
    .eq("phone", phone)
    .is("consumed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`读取短信验证码失败：${error.message}`);
  }

  const row = data as SmsVerificationRow | null;
  if (!row) {
    throw new Error("请先获取验证码");
  }

  if (new Date(row.expires_at).getTime() < Date.now()) {
    throw new Error("验证码已过期，请重新获取");
  }

  if ((row.attempts || 0) >= MAX_VERIFY_ATTEMPTS) {
    throw new Error("验证码尝试次数过多，请重新获取");
  }

  if (row.code_hash !== hashCode(phone, code)) {
    await supabase
      .from("sms_verifications")
      .update({
        attempts: (row.attempts || 0) + 1
      })
      .eq("id", row.id);
    throw new Error("验证码错误");
  }

  const { error: consumeError } = await supabase
    .from("sms_verifications")
    .update({
      consumed_at: new Date().toISOString()
    })
    .eq("id", row.id);

  if (consumeError) {
    throw new Error(`更新短信验证码失败：${consumeError.message}`);
  }
}
