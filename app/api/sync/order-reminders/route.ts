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
  const allowedSecrets = [process.env.ORDER_REMINDER_CRON_SECRET, process.env.CRON_SECRET].filter(Boolean);

  if (allowedSecrets.length === 0) {
    return NextResponse.json({ error: "Missing ORDER_REMINDER_CRON_SECRET or CRON_SECRET" }, { status: 500 });
  }

  if (!allowedSecrets.includes(getCronSecret(request) || "")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}

export async function GET(request: Request) {
  const unauthorized = authorizeCron(request);
  if (unauthorized) return unauthorized;

  let heartbeat:
    | Awaited<ReturnType<typeof syncPlatformHeartbeat>>
    | {
        ok: false;
        error: string;
      };

  try {
    heartbeat = await syncPlatformHeartbeat();
  } catch (error) {
    const message = getErrorMessage(error, "平台心跳同步失败，已继续执行本地短信提醒兜底");
    heartbeat = {
      ok: false,
      error: message
    };
    await recordOperationLog({
      scope: "order.sms_reminder.heartbeat",
      level: "error",
      message,
      details: {
        route: "GET /api/sync/order-reminders"
      }
    });
  }

  try {
    const reminders = await syncOrderSmsReminders();

    return NextResponse.json({
      ok: reminders.ok && !("ok" in heartbeat && heartbeat.ok === false),
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
