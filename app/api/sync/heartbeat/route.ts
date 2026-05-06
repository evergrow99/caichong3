import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { getErrorMessage } from "@/lib/errors";
import { syncHeartbeat, syncPlatformHeartbeat } from "@/lib/heartbeat-sync";
import { recordOperationLog } from "@/lib/operation-log";
import { ensureUserProfile } from "@/lib/user-profile";

function getCronSecret(request: Request) {
  const authorization = request.headers.get("authorization");
  if (authorization?.startsWith("Bearer ")) {
    return authorization.slice("Bearer ".length);
  }

  return request.headers.get("x-cron-secret");
}

function authorizeCron(request: Request) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json({ error: "Missing CRON_SECRET" }, { status: 500 });
  }

  if (getCronSecret(request) !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}

export async function GET(request: Request) {
  const unauthorized = authorizeCron(request);
  if (unauthorized) return unauthorized;

  try {
    const result = await syncPlatformHeartbeat();
    return NextResponse.json({
      ok: true,
      mode: "platform",
      ...result
    });
  } catch (error) {
    const message = getErrorMessage(error, "刷新任务进展失败");
    await recordOperationLog({
      scope: "heartbeat.platform",
      level: "error",
      message,
      details: {
        route: "GET /api/sync/heartbeat"
      }
    });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST() {
  try {
    const user = await getCurrentUser();
    await ensureUserProfile(user);
    const result = await syncHeartbeat(user);
    return NextResponse.json({
      ok: true,
      mode: "user",
      ...result
    });
  } catch (error) {
    const message = getErrorMessage(error, "刷新任务进展失败");
    await recordOperationLog({
      scope: "heartbeat.user",
      level: "error",
      message,
      details: {
        route: "POST /api/sync/heartbeat"
      }
    });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
