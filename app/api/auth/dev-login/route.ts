import { NextResponse } from "next/server";
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
import { ensureUserProfile } from "@/lib/user-profile";

export async function POST(request: Request) {
  try {
    if (!isDevLoginAllowed()) {
      return NextResponse.json({ error: "开发版验证码登录已在当前环境禁用，请接入真实短信登录后再开放用户登录" }, { status: 403 });
    }

    const body = await request.json();
    const phone = normalizePhone(body.phone);
    const code = normalizeOtpCode(body.code);

    if (!isMainlandChinaPhone(phone)) {
      return NextResponse.json({ error: "请输入 11 位中国大陆手机号" }, { status: 400 });
    }

    if (!isSixDigitCode(code)) {
      return NextResponse.json({ error: "请输入 6 位数字验证码" }, { status: 400 });
    }

    if (code !== DEV_LOGIN_CODE) {
      return NextResponse.json({ error: `开发验证码错误，请输入 ${DEV_LOGIN_CODE}` }, { status: 400 });
    }

    const user = createDevPhoneUser(phone);
    await ensureUserProfile(user);

    const response = NextResponse.json(user);
    response.cookies.set(AUTH_COOKIE_NAME, phone, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30
    });

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "登录失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
