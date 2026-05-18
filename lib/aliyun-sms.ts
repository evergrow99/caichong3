import crypto from "crypto";

type SendSmsResponse = {
  Code?: string;
  Message?: string;
  RequestId?: string;
  BizId?: string;
};

function requireSmsEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`缺少短信环境变量 ${name}`);
  }

  return value;
}

function percentEncode(value: string) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

function buildSignedAliyunUrl(params: Record<string, string>) {
  const accessKeySecret = requireSmsEnv("ALIYUN_SMS_ACCESS_KEY_SECRET");
  const allParams: Record<string, string> = {
    ...params,
    AccessKeyId: requireSmsEnv("ALIYUN_SMS_ACCESS_KEY_ID"),
    Format: "JSON",
    RegionId: process.env.ALIYUN_SMS_REGION_ID || "cn-hangzhou",
    SignatureMethod: "HMAC-SHA1",
    SignatureNonce: crypto.randomUUID(),
    SignatureVersion: "1.0",
    Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
    Version: "2017-05-25"
  };

  const canonicalizedQuery = Object.keys(allParams)
    .sort()
    .map((key) => `${percentEncode(key)}=${percentEncode(allParams[key])}`)
    .join("&");

  const stringToSign = `GET&${percentEncode("/")}&${percentEncode(canonicalizedQuery)}`;
  const signature = crypto.createHmac("sha1", `${accessKeySecret}&`).update(stringToSign).digest("base64");

  return `https://dysmsapi.aliyuncs.com/?Signature=${percentEncode(signature)}&${canonicalizedQuery}`;
}

export function isAliyunSmsConfigured() {
  return Boolean(
    process.env.AUTH_SMS_PROVIDER === "aliyun" &&
      process.env.ALIYUN_SMS_ACCESS_KEY_ID &&
      process.env.ALIYUN_SMS_ACCESS_KEY_SECRET &&
      process.env.ALIYUN_SMS_SIGN_NAME
  );
}

export function isAliyunLoginSmsConfigured() {
  return Boolean(isAliyunSmsConfigured() && process.env.ALIYUN_SMS_TEMPLATE_CODE);
}

export function isAliyunOrderReminderSmsConfigured() {
  return Boolean(
    isAliyunSmsConfigured() &&
      process.env.ALIYUN_SMS_SUBMISSION_TEMPLATE_CODE &&
      process.env.ALIYUN_SMS_SELECTION_STARTED_TEMPLATE_CODE &&
      process.env.ALIYUN_SMS_SELECTION_DEADLINE_TEMPLATE_CODE
  );
}

export async function sendAliyunTemplateSms(phone: string, templateCode: string, templateParams: Record<string, string> = {}) {
  const url = buildSignedAliyunUrl({
    Action: "SendSms",
    PhoneNumbers: phone,
    SignName: requireSmsEnv("ALIYUN_SMS_SIGN_NAME"),
    TemplateCode: templateCode,
    TemplateParam: JSON.stringify(templateParams)
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal
    });
    const data = (await response.json()) as SendSmsResponse;

    if (!response.ok || data.Code !== "OK") {
      throw new Error(data.Message || data.Code || "短信发送失败");
    }

    return data;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("短信服务请求超时，请稍后重试");
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function sendAliyunLoginCode(phone: string, code: string) {
  return sendAliyunTemplateSms(phone, requireSmsEnv("ALIYUN_SMS_TEMPLATE_CODE"), { code });
}
