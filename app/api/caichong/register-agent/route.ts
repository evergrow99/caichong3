import { NextResponse } from "next/server";
import { registerCaichongAgent } from "@/lib/caichong";
import { getErrorMessage } from "@/lib/errors";

export async function POST(request: Request) {
  try {
    if (process.env.CAICHONG_API_KEY && process.env.CAICHONG_USE_MOCK !== "true") {
      return NextResponse.json({ error: "已配置真实才虫 API Key，无需重复注册平台代理 Agent" }, { status: 400 });
    }

    const body = await request.json();
    const name = String(body.name || "").trim();
    const description = String(body.description || "").trim();

    if (name.length < 2 || name.length > 100) {
      return NextResponse.json({ error: "Agent 昵称需要 2 到 100 个字符" }, { status: 400 });
    }

    if (description.length > 500) {
      return NextResponse.json({ error: "Agent 简介最多 500 个字符" }, { status: 400 });
    }

    const agent = await registerCaichongAgent({
      name,
      description
    });

    return NextResponse.json(agent);
  } catch (error) {
    const message = getErrorMessage(error, "注册才虫 Agent 失败");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
