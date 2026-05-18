import { NextResponse } from "next/server";
import { isAdminPhone } from "@/lib/admin";
import { isAliyunLoginSmsConfigured, sendAliyunLoginCode } from "@/lib/aliyun-sms";
import { DEV_LOGIN_CODE, isDevLoginAllowed, isMainlandChinaPhone, normalizePhone } from "@/lib/auth-utils";
import { assertCanSendSmsCode, generateSmsCode, saveSmsCode } from "@/lib/sms-code";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const phone = normalizePhone(body.phone);

    if (!isMainlandChinaPhone(phone)) {
      return NextResponse.json({ error: "请输入 11 位中国大陆手机号" }, { status: 400 });
    }

    if (!isAdminPhone(phone)) {
      return NextResponse.json({ error: "当前手机号没有后台权限" }, { status: 403 });
    }

    if (isDevLoginAllowed()) {
      return NextResponse.json({
        ok: true,
        message: `开发环境可直接输入验证码 ${DEV_LOGIN_CODE}`
      });
    }

    if (!isAliyunLoginSmsConfigured()) {
      return NextResponse.json({ error: "真实短信服务未配置完整" }, { status: 503 });
    }

    await assertCanSendSmsCode(phone);
    const code = generateSmsCode();
    await sendAliyunLoginCode(phone, code);
    await saveSmsCode(phone, code);

    return NextResponse.json({
      ok: true,
      message: "验证码已发送"
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "验证码发送失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
