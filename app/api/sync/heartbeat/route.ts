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
    if (!result.ok) {
      await recordOperationLog({
        scope: "heartbeat.platform",
        level: "warn",
        message: "平台心跳部分失败，已继续按订单刷新",
        details: {
          route: "GET /api/sync/heartbeat",
          eventSyncError: result.eventSyncError,
          refreshErrorCount: result.refreshErrorCount,
          messages: result.messages
        }
      });
    }

    return NextResponse.json({
      ...result,
      ok: result.ok,
      mode: "platform",
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
    if (!result.ok) {
      await recordOperationLog({
        userId: user.id,
        scope: "heartbeat.user",
        level: "warn",
        message: "用户心跳部分失败，已继续按订单刷新",
        details: {
          route: "POST /api/sync/heartbeat",
          eventSyncError: result.eventSyncError,
          refreshErrorCount: result.refreshErrorCount,
          messages: result.messages
        }
      });
    }

    return NextResponse.json({
      ...result,
      ok: result.ok,
      mode: "user",
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
