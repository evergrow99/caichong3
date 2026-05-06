import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/errors";

const allowedHosts = new Set(["caichong-agent-task-assets.caichong.net"]);

function getSafeFilename(value: string | null) {
  const fallback = "submission-attachment";
  if (!value) return fallback;

  const filename = value.split(/[\\/]/).pop()?.trim() || fallback;
  return filename.replace(/["\r\n]/g, "_");
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawUrl = searchParams.get("url");
    const filename = getSafeFilename(searchParams.get("filename"));
    const disposition = searchParams.get("disposition") === "inline" ? "inline" : "attachment";

    if (!rawUrl) {
      return NextResponse.json({ error: "缺少附件地址" }, { status: 400 });
    }

    const attachmentUrl = new URL(rawUrl);
    if (attachmentUrl.protocol !== "https:" || !allowedHosts.has(attachmentUrl.hostname)) {
      return NextResponse.json({ error: "不允许下载这个附件地址" }, { status: 400 });
    }

    const response = await fetch(attachmentUrl.toString(), {
      cache: "no-store"
    });

    if (!response.ok || !response.body) {
      return NextResponse.json({ error: "附件暂时无法下载，请稍后重试" }, { status: 502 });
    }

    const headers = new Headers({
      "Content-Type": response.headers.get("content-type") || "application/octet-stream",
      "Content-Disposition": `${disposition}; filename="${filename}"`,
      "Cache-Control": "private, no-store"
    });
    const contentLength = response.headers.get("content-length");
    if (contentLength) {
      headers.set("Content-Length", contentLength);
    }

    return new Response(response.body, {
      status: 200,
      headers
    });
  } catch (error) {
    const message = getErrorMessage(error, "附件下载失败");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
