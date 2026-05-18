import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/errors";
import { syncPlatformHeartbeat } from "@/lib/heartbeat-sync";
import { syncOrderSmsReminders } from "@/lib/order-reminders";
import { recordOperationLog } from "@/lib/operation-log";

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
    const heartbeat = await syncPlatformHeartbeat();
    const reminders = await syncOrderSmsReminders();

    return NextResponse.json({
      ok: reminders.ok,
      heartbeat,
      reminders
    });
  } catch (error) {
    const message = getErrorMessage(error, "同步订单短信提醒失败");
    await recordOperationLog({
      scope: "order.sms_reminder.sync",
      level: "error",
      message,
      details: {
        route: "GET /api/sync/order-reminders"
      }
    });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
