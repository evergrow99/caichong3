import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error: "真实短信验证码暂未接入。申请短信服务后，这里会负责校验验证码并登录。"
    },
    { status: 501 }
  );
}
