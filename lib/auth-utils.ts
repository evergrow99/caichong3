export const DEV_LOGIN_CODE = "123456";
export const AUTH_COOKIE_NAME = "dev_phone";
export const ADMIN_AUTH_COOKIE_NAME = "admin_phone";

export function isDevLoginAllowed() {
  if (process.env.ALLOW_DEV_LOGIN === "true") return true;
  return process.env.NODE_ENV !== "production";
}

export function normalizePhone(phone: unknown) {
  return String(phone || "").replace(/\D/g, "");
}

export function normalizeOtpCode(code: unknown) {
  return String(code || "").replace(/\D/g, "");
}

export function isMainlandChinaPhone(phone: string) {
  return /^1\d{10}$/.test(phone);
}

export function isSixDigitCode(code: string) {
  return /^\d{6}$/.test(code);
}
