import { NextResponse } from "next/server";
import { isAdminPhone } from "@/lib/admin";
import {
  AUTH_COOKIE_NAME,
  DEV_LOGIN_CODE,
  isDevLoginAllowed,
  isMainlandChinaPhone,
  isSixDigitCode,
  normalizeOtpCode,
  normalizePhone
} from "@/lib/auth-utils";
import { createDevPhoneUser } from "@/lib/current-user";
import { verifySmsCode } from "@/lib/sms-code";
import { ensureUserProfile } from "@/lib/user-profile";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const phone = normalizePhone(body.phone);
    const code = normalizeOtpCode(body.code);

    if (!isMainlandChinaPhone(phone)) {
      return NextResponse.json({ error: "请输入 11 位中国大陆手机号" }, { status: 400 });
    }

    if (!isSixDigitCode(code)) {
      return NextResponse.json({ error: "请输入 6 位数字验证码" }, { status: 400 });
    }

    if (!isAdminPhone(phone)) {
      return NextResponse.json({ error: "当前手机号没有后台权限" }, { status: 403 });
    }

    if (isDevLoginAllowed() && code === DEV_LOGIN_CODE) {
      const user = createDevPhoneUser(phone);
      await ensureUserProfile(user, { markLogin: true });

      const response = NextResponse.json(user);
      response.cookies.set(AUTH_COOKIE_NAME, phone, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24
      });

      return response;
    }

    await verifySmsCode(phone, code);

    const user = createDevPhoneUser(phone);
    await ensureUserProfile(user, { markLogin: true });

    const response = NextResponse.json(user);
    response.cookies.set(AUTH_COOKIE_NAME, phone, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24
    });

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "后台登录失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
